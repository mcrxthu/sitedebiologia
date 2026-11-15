import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false } })
  : null;
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(",") : true }));
app.use(express.json({ limit: "10mb" }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const pages = new Set(["galeria", "informacoes", "grupo"]);
const clean = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
function adminOnly(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    if (req.admin.role !== "admin") throw Error();
    next();
  } catch { res.status(401).json({ error: "Sessão administrativa inválida ou expirada." }); }
}
function requireDatabase(res) {
  if (!pool) { res.status(503).json({ error: "Banco de dados não configurado: adicione 'DATABASE_URL' nas variáveis do Render." }); return false; }
  return true;
}
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/ready", async (req, res) => {
  if (!requireDatabase(res)) return;
  try { await pool.query("SELECT 1"); res.json({ ok: true, database: true }); }
  catch (e) { console.error("Falha de conexão com PostgreSQL:", e.message); res.status(503).json({ ok: false, database: false, error: "Não foi possível conectar ao banco de dados." }); }
});
app.get("/api/comments", limiter, async (req, res) => {
  const page = clean(req.query.pagina, 20);
  if (!pages.has(page)) return res.status(400).json({ error: "Mural inválido." });
  if (!requireDatabase(res)) return;
  try {
    const q = await pool.query("SELECT id,pagina,nome,serie_curso,mensagem,created_at FROM comentarios WHERE pagina=$1 ORDER BY created_at DESC LIMIT 100", [page]);
    res.json({ comments: q.rows });
  } catch (e) { console.error("Erro ao consultar comentários:", e.message); res.status(500).json({ error: "Erro ao consultar comentários. Verifique 'DATABASE_URL' e se a tabela comentarios foi criada no Neon." }); }
});
app.post("/api/comments", limiter, async (req, res) => {
  const page = clean(req.body?.pagina, 20), name = clean(req.body?.nome, 80), course = clean(req.body?.serie_curso, 40), message = clean(req.body?.mensagem, 1500);
  if (!pages.has(page) || !name || !course || !message) return res.status(400).json({ error: "Preencha todos os campos corretamente." });
  if (!requireDatabase(res)) return;
  try {
    const q = await pool.query("INSERT INTO comentarios(pagina,nome,serie_curso,mensagem) VALUES($1,$2,$3,$4) RETURNING id", [page, name, course, message]);
    res.status(201).json({ ok: true, id: q.rows[0].id });
  } catch (e) { console.error("Erro ao salvar comentário:", e.message); res.status(500).json({ error: "Não foi possível salvar o comentário. Verifique se a tabela comentarios existe no Neon." }); }
});
app.post("/api/admin/login", loginLimiter, async (req, res) => {
  const username = clean(req.body?.username, 100), password = typeof req.body?.password === "string" ? req.body.password : "";
  try {
    const validUser = username === process.env.ADMIN_USERNAME;
    const validPass = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || "");
    if (!validUser || !validPass) return res.status(401).json({ error: "Usuário ou senha incorretos." });
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token });
  } catch (e) { console.error("Falha no login administrativo:", e.message); res.status(500).json({ error: "Falha no login administrativo." }); }
});
app.delete("/api/admin/comments/:id", adminOnly, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Identificador inválido." });
  if (!requireDatabase(res)) return;
  try {
    const q = await pool.query("DELETE FROM comentarios WHERE id=$1", [req.params.id]);
    if (!q.rowCount) return res.status(404).json({ error: "Comentário não encontrado." });
    res.json({ ok: true });
  } catch (e) { console.error("Erro ao excluir comentário:", e.message); res.status(500).json({ error: "Não foi possível excluir o comentário." }); }
});

let muralTableReady;
async function ensureMuralTable(){
  if(!muralTableReady)muralTableReady=pool.query("CREATE TABLE IF NOT EXISTS mural_conteudo (pagina VARCHAR(20) PRIMARY KEY CHECK (pagina IN ('galeria','informacoes','grupo')), titulo VARCHAR(120) NOT NULL, descricao VARCHAR(1200) NOT NULL DEFAULT '', imagem_capa TEXT, blocos JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  return muralTableReady;
}
app.get("/api/content/:page", limiter, async (req,res)=>{
  const page=clean(req.params.page,20);
  if(!pages.has(page))return res.status(400).json({error:"Mural inválido."});
  if(!requireDatabase(res))return;
  try{
    await ensureMuralTable();
    const q=await pool.query("SELECT titulo,descricao,imagem_capa,blocos,updated_at FROM mural_conteudo WHERE pagina=$1",[page]);
    if(!q.rowCount)return res.json({content:null});
    const row=q.rows[0];
    res.json({content:{title:row.titulo,description:row.descricao,coverImage:row.imagem_capa||"",blocks:row.blocos||[],updatedAt:row.updated_at}});
  }catch(e){console.error("Erro ao carregar conteúdo do mural:",e.message);res.status(500).json({error:"Não foi possível carregar o conteúdo do mural."});}
});
app.put("/api/admin/content/:page",adminOnly,async(req,res)=>{
  const page=clean(req.params.page,20),body=req.body||{};
  if(!pages.has(page))return res.status(400).json({error:"Mural inválido."});
  const title=clean(body.title,120),description=clean(body.description,1200);
  const coverImage=typeof body.coverImage==="string"?body.coverImage:"";
  const blocks=Array.isArray(body.blocks)?body.blocks:[];
  if(!title)return res.status(400).json({error:"Informe o título da página."});
  if(blocks.length>40)return res.status(400).json({error:"Cada página pode ter até 40 blocos."});
  const validImage=value=>typeof value==="string"&&value.length<=4500000&&/^data:image\/(jpeg|png|webp);base64,/.test(value);
  for(const block of blocks){
    if(!block||!["text","image"].includes(block.type))return res.status(400).json({error:"Há um bloco inválido."});
    if(block.type==="text"&&(typeof block.text!=="string"||block.text.length>20000))return res.status(400).json({error:"Um texto ultrapassou o limite de 20 mil caracteres."});
    if(block.type==="image"&&!validImage(block.image))return res.status(400).json({error:"Uma imagem está inválida ou é grande demais. Tente uma imagem menor."});
    if(block.caption!==undefined&&String(block.caption).length>300)return res.status(400).json({error:"A legenda ultrapassou 300 caracteres."});
    if(block.alt!==undefined&&String(block.alt).length>200)return res.status(400).json({error:"A descrição da imagem ultrapassou 200 caracteres."});
  }
  if(coverImage&&!validImage(coverImage))return res.status(400).json({error:"A imagem da capa está inválida ou é grande demais."});
  if(Buffer.byteLength(JSON.stringify({title,description,coverImage,blocks}),"utf8")>9500000)return res.status(413).json({error:"O conteúdo total ficou grande demais. Reduza a quantidade ou o tamanho das imagens."});
  if(!requireDatabase(res))return;
  try{
    await ensureMuralTable();
    await pool.query("INSERT INTO mural_conteudo(pagina,titulo,descricao,imagem_capa,blocos,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,NOW()) ON CONFLICT(pagina) DO UPDATE SET titulo=EXCLUDED.titulo,descricao=EXCLUDED.descricao,imagem_capa=EXCLUDED.imagem_capa,blocos=EXCLUDED.blocos,updated_at=NOW()",[page,title,description,coverImage||null,JSON.stringify(blocks)]);
    res.json({ok:true});
  }catch(e){console.error("Erro ao salvar conteúdo do mural:",e.message);res.status(500).json({error:"Não foi possível salvar. Confira se o banco de dados está disponível."});}
});

app.use((req, res) => res.status(404).json({ error: "Rota não encontrada." }));
app.listen(process.env.PORT || 3000, () => console.log("API iniciada"));
