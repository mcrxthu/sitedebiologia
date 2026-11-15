const API_BASE=(window.API_BASE||"").replace(/\/$/,"");
async function api(path,options={}){if(!API_BASE)throw new Error("A API ainda não foi configurada.");const response=await fetch(API_BASE+path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Falha na comunicação com o servidor.");return data;}
const areas=["galeria","informacoes","grupo"];
function isAdmin(){return !!sessionStorage.getItem("mural_admin_token");}
function canModerate(){return isAdmin()&&!!document.getElementById("admin-toggle");}
function loadTheme(){const dark=localStorage.getItem("tema-site")==="escuro";document.body.classList.toggle("dark-theme",dark);const button=document.getElementById("theme-toggle");if(button){button.textContent=dark?"Tema claro":"Tema escuro";button.setAttribute("aria-pressed",String(dark));}}
const themeButton=document.createElement("button");themeButton.type="button";themeButton.id="theme-toggle";themeButton.className="theme-toggle";themeButton.addEventListener("click",()=>{const dark=!document.body.classList.contains("dark-theme");localStorage.setItem("tema-site",dark?"escuro":"claro");loadTheme();});document.querySelector(".top-links")?.append(themeButton);const zoomControls=document.createElement("div");zoomControls.className="zoom-controls";zoomControls.setAttribute("aria-label","Controles de zoom");const zoomOut=document.createElement("button");zoomOut.type="button";zoomOut.className="zoom-button";zoomOut.textContent="−";zoomOut.setAttribute("aria-label","Diminuir zoom");const zoomIn=document.createElement("button");zoomIn.type="button";zoomIn.className="zoom-button";zoomIn.textContent="+";zoomIn.setAttribute("aria-label","Aumentar zoom");let pageZoom=Number(localStorage.getItem("zoom-site"))||100;function applyZoom(){pageZoom=Math.min(150,Math.max(70,pageZoom));document.documentElement.style.zoom=pageZoom+"%";localStorage.setItem("zoom-site",String(pageZoom));zoomOut.disabled=pageZoom<=70;zoomIn.disabled=pageZoom>=150;}zoomOut.addEventListener("click",()=>{pageZoom-=10;applyZoom();});zoomIn.addEventListener("click",()=>{pageZoom+=10;applyZoom();});zoomControls.append(zoomOut,zoomIn);document.querySelector(".top-links")?.append(zoomControls);applyZoom();loadTheme();
async function loadComments(area,admin=false){const list=document.getElementById((admin?"comentarios-admin-":"comentarios-")+area);if(!list)return;try{const {comments=[]}=await api("/api/comments?pagina="+encodeURIComponent(area));list.replaceChildren();if(!comments.length){list.textContent="Ainda não há comentários.";return;}comments.forEach(c=>{const article=document.createElement("article");article.className="comment";const name=document.createElement("strong");name.textContent=c.nome;const course=document.createElement("small");course.textContent=c.serie_curso;const message=document.createElement("p");message.textContent=c.mensagem;article.append(name,course,message);if(canModerate()){const remove=document.createElement("button");remove.className="comment-delete";remove.textContent="Excluir comentário";remove.type="button";remove.addEventListener("click",async()=>{if(!confirm("Deseja realmente excluir este comentário?"))return;try{await api("/api/admin/comments/"+c.id,{method:"DELETE",headers:{Authorization:"Bearer "+sessionStorage.getItem("mural_admin_token")}});loadComments(area,admin);}catch(e){alert(e.message);}});article.append(remove);}list.append(article);});}catch(e){list.textContent="Não foi possível carregar os comentários: "+e.message;}}
function refreshComments(){areas.forEach(a=>{loadComments(a,false);loadComments(a,true);});}
document.querySelectorAll("[data-comments-form]").forEach(form=>form.addEventListener("submit",async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));const status=form.querySelector(".form-status");try{await api("/api/comments",{method:"POST",body:JSON.stringify({pagina:form.dataset.commentsForm,...values})});form.reset();status.textContent="Comentário enviado!";loadComments(form.dataset.commentsForm);}catch(e){status.textContent=e.message;}}));
refreshComments();if(document.querySelector("[data-comments-form]"))setInterval(refreshComments,30000);
const toggle=document.getElementById("admin-toggle");if(toggle){const popup=document.getElementById("admin-popup"),panel=document.getElementById("admin-content"),form=document.getElementById("admin-login-form"),auth=document.getElementById("admin-authenticated"),status=document.getElementById("admin-login-status");toggle.addEventListener("click",()=>popup.hidden=!popup.hidden);form.addEventListener("submit",async event=>{event.preventDefault();try{const result=await api("/api/admin/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(form)))});sessionStorage.setItem("mural_admin_token",result.token);form.hidden=true;auth.hidden=false;status.textContent="Acesso autorizado.";refreshComments();initMuralAdmin();}catch(e){status.textContent=e.message;}});document.getElementById("admin-logout-button").addEventListener("click",()=>{sessionStorage.removeItem("mural_admin_token");location.reload();});if(isAdmin()){form.hidden=true;auth.hidden=false;refreshComments();}}

const muralDefaults={
  galeria:{title:"Galeria da maquete",description:"Veja os registros da nossa maquete da Célula de Purkinje, construída pelo grupo com materiais recicláveis.",blocks:[]},
  informacoes:{title:"Conheça a Célula de Purkinje",description:"Informações e curiosidades sobre a célula escolhida pelo nosso grupo.",blocks:[{type:"text",text:"A Célula de Purkinje é um neurônio multipolar encontrado no cerebelo. Ela se destaca por seu corpo celular e por sua extensa árvore dendrítica, que recebe muitos sinais de outros neurônios."},{type:"text",text:"Essas células participam do controle e da coordenação dos movimentos, contribuindo para o equilíbrio e para a precisão motora."}]},
  grupo:{title:"Conheça nosso grupo",description:"Um pouco sobre Arthur, Matheus Filipe e Miguel.",blocks:[{type:"text",text:"Somos Arthur Camargo, Matheus Filipe Saraiva e Miguel dos Santos. Desenvolvemos este trabalho para apresentar a Célula de Purkinje e compartilhar o que aprendemos durante a construção da maquete."}]}
};
const pageContent={};
const currentMuralArea=location.pathname.endsWith("galeria.html")?"galeria":location.pathname.endsWith("informacoes.html")?"informacoes":location.pathname.endsWith("grupo.html")?"grupo":"";
if(currentMuralArea){const muralMain=document.querySelector(".mural-page");if(muralMain)muralMain.dataset.muralPage=currentMuralArea;}
function tokenHeaders(){return {Authorization:"Bearer "+sessionStorage.getItem("mural_admin_token")};}
function createElement(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function renderMuralContent(area,data){
  pageContent[area]=data;
  const main=document.querySelector(".mural-page");
  if(main&&main.dataset.muralPage===area){
    const model=main.querySelector(".model3d-section"),comments=main.querySelector(".comment-area");
    main.querySelectorAll(":scope > .mural-posts").forEach(el=>el.remove());
    const wrap=createElement("section","mural-posts");
    if(data.coverImage){const cover=createElement("img","mural-cover");cover.src=data.coverImage;cover.alt=data.title||"Capa do mural";wrap.append(cover);}
    wrap.append(createElement("h3","section-title",data.title||muralDefaults[area].title),createElement("p","mural-description",data.description||""));
    (data.blocks||[]).forEach(block=>{if(block.type==="image"&&block.image){const figure=createElement("figure","mural-post-image");const img=createElement("img");img.src=block.image;img.alt=block.alt||"Imagem do mural";figure.append(img);if(block.caption)figure.append(createElement("figcaption","",block.caption));wrap.append(figure);}else if(block.type==="text"&&block.text){const p=createElement("p","mural-post-text");p.textContent=block.text;wrap.append(p);}});
    main.querySelectorAll(":scope > :not(.model3d-section):not(.comment-area):not(.mural-posts)").forEach(el=>el.remove());
    main.insertBefore(wrap,model||comments||main.firstChild);
  }
  if(document.querySelector(".news-grid")){
    const card=document.querySelectorAll(".news-card")[areas.indexOf(area)];
    if(card){const title=card.querySelector("h4"),desc=card.querySelector(".news-body p"),placeholder=card.querySelector(".news-img-placeholder");if(title)title.textContent=data.title||muralDefaults[area].title;if(desc)desc.textContent=data.description||"";if(data.coverImage){const existing=card.querySelector(".news-cover");if(existing)existing.src=data.coverImage;else if(placeholder){const img=createElement("img","news-cover");img.src=data.coverImage;img.alt="Capa: "+(data.title||area);placeholder.replaceWith(img);}}else{const existing=card.querySelector(".news-cover");if(existing){const replacement=createElement("div","news-img-placeholder","(adicione uma imagem de capa pela administração)");existing.replaceWith(replacement);}}}
  }
}
async function loadMuralContent(area){
  try{const result=await api("/api/content/"+area);if(result.content)renderMuralContent(area,result.content);}
  catch(e){console.warn("Conteúdo do mural indisponível:",e.message);}
}
areas.forEach(loadMuralContent);
function compressImage(file){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("Não foi possível ler a imagem."));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("Arquivo de imagem inválido."));image.onload=()=>{const scale=Math.min(1,1800/image.width,1800/image.height),canvas=document.createElement("canvas");canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.82));};image.src=reader.result;};reader.readAsDataURL(file);});
}
function initMuralAdmin(){
  const auth=document.getElementById("admin-authenticated");
  if(!auth||!isAdmin()||document.getElementById("mural-editor"))return;
  const editor=createElement("section","mural-editor");editor.id="mural-editor";
  editor.append(createElement("h3","section-title","Editor dos murais"));
  editor.append(createElement("p","admin-note","Escolha uma página para editar sua capa e montar postagens com textos e imagens na ordem que quiser."));
  const selector=createElement("div","mural-editor-tabs");
  const workspace=createElement("div","mural-editor-workspace");
  const status=createElement("p","form-status");status.setAttribute("aria-live","polite");
  editor.append(selector,workspace,status);
  const moderation=auth.querySelector(".section-title");
  auth.insertBefore(editor,moderation||auth.firstChild);
  let current="galeria",draft=null;
  const fields={};
  function makeField(labelText,element){const label=createElement("label","mural-editor-label",labelText);label.append(element);return label;}
  const title=createElement("input");title.maxLength=120;title.placeholder="Título da página";
  const description=createElement("textarea");description.maxLength=1200;description.rows=3;description.placeholder="Descrição da capa";
  const coverFile=createElement("input");coverFile.type="file";coverFile.accept="image/*";
  const coverPreview=createElement("img","mural-editor-cover-preview");coverPreview.hidden=true;
  const blocksArea=createElement("div","mural-editor-blocks");
  const addText=createElement("button","mural-editor-action","Adicionar texto");addText.type="button";
  const addImage=createElement("button","mural-editor-action","Adicionar imagem");addImage.type="button";
  const save=createElement("button","mural-editor-save","Salvar alterações");save.type="button";
  const coverRemove=createElement("button","mural-editor-action","Remover capa");coverRemove.type="button";
  workspace.append(makeField("Título da página",title),makeField("Descrição da capa",description),makeField("Imagem da capa",coverFile),coverPreview,coverRemove,createElement("h4","","Postagens da página"),blocksArea,addText,addImage,save);
  let coverData="";
  async function loadDraft(area){
    current=area;status.textContent="Carregando conteúdo...";
    try{const result=await api("/api/content/"+area);const saved=result.content;draft=saved?JSON.parse(JSON.stringify(saved)):JSON.parse(JSON.stringify(muralDefaults[area]));draft.coverImage=draft.coverImage||"";draft.blocks=draft.blocks||[];title.value=draft.title||"";description.value=draft.description||"";coverData=draft.coverImage;coverPreview.src=coverData;coverPreview.hidden=!coverData;coverFile.value="";renderBlocks();status.textContent=saved?"Conteúdo carregado.":"Você está editando o conteúdo inicial.";selector.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.area===area));}
    catch(e){status.textContent=e.message;}
  }
  function renderBlocks(){
    blocksArea.replaceChildren();
    draft.blocks.forEach((block,index)=>{
      const item=createElement("div","mural-editor-block");
      const heading=createElement("strong","",block.type==="image"?"Imagem "+(index+1):"Texto "+(index+1));
      item.append(heading);
      if(block.type==="image"){
        const preview=createElement("img","mural-editor-block-preview");preview.src=block.image;preview.alt=block.alt||"Prévia da imagem";item.append(preview);
        const caption=createElement("input");caption.placeholder="Legenda (opcional)";caption.value=block.caption||"";caption.maxLength=300;caption.addEventListener("input",()=>block.caption=caption.value);item.append(makeField("Legenda",caption));
        const alt=createElement("input");alt.placeholder="Descrição da imagem";alt.value=block.alt||"";alt.maxLength=200;alt.addEventListener("input",()=>block.alt=alt.value);item.append(makeField("Descrição acessível",alt));
        const replace=createElement("input");replace.type="file";replace.accept="image/*";replace.addEventListener("change",async()=>{if(replace.files[0])try{block.image=await compressImage(replace.files[0]);renderBlocks();}catch(e){status.textContent=e.message;}});item.append(makeField("Trocar imagem",replace));
      }else{
        const textArea=createElement("textarea");textArea.rows=5;textArea.maxLength=20000;textArea.value=block.text||"";textArea.placeholder="Escreva seu texto...";textArea.addEventListener("input",()=>block.text=textArea.value);item.append(textArea);
      }
      const actions=createElement("div","mural-editor-block-actions");
      const up=createElement("button","mural-editor-action","↑");up.type="button";up.disabled=index===0;up.setAttribute("aria-label","Mover para cima");up.addEventListener("click",()=>{[draft.blocks[index-1],draft.blocks[index]]=[draft.blocks[index],draft.blocks[index-1]];renderBlocks();});
      const down=createElement("button","mural-editor-action","↓");down.type="button";down.disabled=index===draft.blocks.length-1;down.setAttribute("aria-label","Mover para baixo");down.addEventListener("click",()=>{[draft.blocks[index+1],draft.blocks[index]]=[draft.blocks[index],draft.blocks[index+1]];renderBlocks();});
      const remove=createElement("button","mural-editor-delete","Excluir");remove.type="button";remove.addEventListener("click",()=>{draft.blocks.splice(index,1);renderBlocks();});
      actions.append(up,down,remove);item.append(actions);blocksArea.append(item);
    });
  }
  areas.forEach(area=>{const button=createElement("button","mural-editor-tab",({galeria:"Galeria",informacoes:"Informações",grupo:"Grupo"})[area]);button.type="button";button.dataset.area=area;button.addEventListener("click",()=>loadDraft(area));selector.append(button);});
  addText.addEventListener("click",()=>{draft.blocks.push({type:"text",text:""});renderBlocks();});
  addImage.addEventListener("click",()=>{const input=createElement("input");input.type="file";input.accept="image/*";input.addEventListener("change",async()=>{if(!input.files[0])return;try{draft.blocks.push({type:"image",image:await compressImage(input.files[0]),alt:"",caption:""});renderBlocks();}catch(e){status.textContent=e.message;}});input.click();});
  coverFile.addEventListener("change",async()=>{if(!coverFile.files[0])return;try{coverData=await compressImage(coverFile.files[0]);coverPreview.src=coverData;coverPreview.hidden=false;}catch(e){status.textContent=e.message;}});
  coverRemove.addEventListener("click",()=>{coverData="";coverPreview.removeAttribute("src");coverPreview.hidden=true;coverFile.value="";});
  save.addEventListener("click",async()=>{if(!draft)return;draft.title=title.value.trim();draft.description=description.value.trim();draft.coverImage=coverData;status.textContent="Salvando...";save.disabled=true;try{await api("/api/admin/content/"+current,{method:"PUT",headers:tokenHeaders(),body:JSON.stringify(draft)});renderMuralContent(current,draft);status.textContent="Alterações salvas e publicadas!";}catch(e){status.textContent=e.message;}finally{save.disabled=false;}});
  loadDraft(current);
}

if(isAdmin())initMuralAdmin();
