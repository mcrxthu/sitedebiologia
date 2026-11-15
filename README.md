# Célula de Purkinje — site + comentários SQL

O site estático é publicado no GitHub Pages. A API Node.js e o PostgreSQL precisam ser hospedados separadamente (Render + Neon, por exemplo). GitHub Pages não executa PHP/Node nem hospeda banco SQL.

## Arquivos
- `index.html`, `galeria.html`, `informacoes.html`, `grupo.html`: quatro páginas do site.
- `config.js`: URL pública da API.
- `app.js`: envio, leitura e moderação dos comentários.
- `api/server.js`: API Node/Express.
- `api/schema.sql`: estrutura PostgreSQL.
- `api/render.yaml`: modelo de serviço para Render.

## 1. Banco PostgreSQL (Neon)
1. Crie um projeto PostgreSQL no Neon.
2. Abra o SQL Editor e execute todo o conteúdo de `api/schema.sql`.
3. Copie a connection string (DATABASE_URL). Não a publique no GitHub.

## 2. Senha administrativa
Gere um hash bcrypt localmente, sem enviar sua senha a ninguém:

```bash
cd api
npm install
node -e "const b=require('bcryptjs'); console.log(b.hashSync(process.argv[1],12))" "SUA_SENHA_FORTE"
```

Guarde o hash gerado para a variável `ADMIN_PASSWORD_HASH`. Defina também `ADMIN_USERNAME` com seu usuário administrativo. Defina `JWT_SECRET` com uma chave aleatória longa (ou deixe o Render gerar uma).

## 3. API no Render
1. Crie um Web Service conectado a este repositório.
2. Root Directory: `api`; Build Command: `npm install`; Start Command: `npm start`.
3. Configure as variáveis `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` e `ALLOWED_ORIGIN`.
4. `ALLOWED_ORIGIN` deve ser a origem do GitHub Pages, por exemplo `https://SEU-USUARIO.github.io` (sem caminho).
5. Depois de publicar, teste `https://SUA-API.onrender.com/api/health`.

## 4. Ligar o site à API
Edite `config.js` e substitua `https://SUA-API.onrender.com` pela URL real da API. Faça commit.

## 5. Publicar GitHub Pages
No GitHub: Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save. Aguarde a publicação.

## Segurança
- Nunca coloque `DATABASE_URL`, senha administrativa, hash ou `JWT_SECRET` em arquivos do site.
- O login administrativo é validado no servidor e o token expira em 8 horas.
- Comentários são públicos e limitados por tamanho e frequência.
- Use senha exclusiva e forte para a administração.
