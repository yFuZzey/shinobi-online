// Visual no corpo (itens em camadas): o painel recebe o desenho do item vestido (capa parada + ao vento), ajusta tamanho/posição/giro
// com prévia no molde do boneco; o jogo desenha a capa atrás do boneco em todas as poses, e quem está vendo também vê
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const adm='Vis'+suf,A=await mk(adm,0),B=await mk('Olha'+suf,1);await mget('/__admin?nome='+adm);
 const P=await (await b.newContext({viewport:{width:412,height:900}})).newPage();P.on('pageerror',e=>{console.log('ERRO PAINEL',e.message);fails++});
 ok((await fetch(GS+'/painel/molde/parado_ia.png')).status===200&&(await fetch(GS+'/painel/molde/correndo.png')).status===200&&(await fetch(GS+'/painel/molde/correndo_4.png')).status===200,'servidor entrega o molde do boneco (parado e correndo, e os 4 quadros da prévia animada)');
 await P.goto(GS+'/painel');await P.fill('#u',adm);await P.fill('#p','12345678');await P.click('#entrar');await P.waitForSelector('#vApp:not(.hide)',{timeout:8000});
 // desenhos de teste (capa vermelha parada e ao vento) feitos no próprio navegador, com fundo magenta
 const png=async(k)=>Buffer.from((await P.evaluate(k=>{const c=document.createElement('canvas');c.width=120;c.height=160;const g=c.getContext('2d');g.fillStyle='#ff00ff';g.fillRect(0,0,120,160);g.fillStyle='#a01818';g.strokeStyle='#300';g.lineWidth=4;g.beginPath();
   if(k)g.moveTo(30,10),g.lineTo(70,10),g.lineTo(115,120),g.lineTo(60,150);else g.moveTo(40,8),g.lineTo(80,8),g.lineTo(100,150),g.lineTo(20,150);g.closePath();g.fill();g.stroke();return c.toDataURL('image/png')},k)).split(',')[1],'base64');
 const ic=await png(0);await P.click('#novo');await P.fill('#nome','Capa Akatsuki');await P.setInputFiles('#icone',{name:'i.png',mimeType:'image/png',buffer:ic});
 await P.click('#slot [data-k=capa]');await P.click('#atr [data-k=vit]');await W(300);
 ok(await P.evaluate(()=>!document.querySelector('#visW').classList.contains('hide')&&!document.querySelector('#vis2W').classList.contains('hide')),'capa: mostra "Visual no corpo" e o campo da capa ao vento');
 const px=async()=>P.evaluate(()=>{const g=document.querySelector('#vPar').getContext('2d').getImageData(0,0,150,190).data;let n=0;for(let i=0;i<g.length;i+=4)if(g[i]>120&&g[i+1]<60&&g[i+2]<60&&g[i+3]>0)n++;return n});
 const r0=await px();await P.setInputFiles('#vis1',{name:'c.png',mimeType:'image/png',buffer:await png(0)});await P.setInputFiles('#vis2',{name:'c2.png',mimeType:'image/png',buffer:await png(1)});await W(500);
 const r1=await px();ok(r0<20&&r1>200,'prévia: a capa aparece no molde do boneco ('+r0+' → '+r1+' pixels vermelhos)');
 await P.fill('#vEsc','130');await P.dispatchEvent('#vEsc','input');await W(200);const r2=await px();ok(r2>r1,'tamanho maior: a capa cresce na prévia ('+r1+' → '+r2+')');
 // ajuste separado por pose: correndo na frente do corpo e girada; o parado continua igual
 const rp=await px();await P.click('#vPose [data-p=correndo]');await P.click('#vLado [data-f="1"]');await P.fill('#vG','40');await P.dispatchEvent('#vG','input');await P.click('.sl [data-d="vX:1"]');await P.click('.sl [data-d="vX:1"]');await W(300);
 const ui=await P.evaluate(()=>({esc:+document.querySelector('#vEsc').value,x:+document.querySelector('#vX').value,cor:document.querySelector('#vCor').classList.contains('on'),cp:document.querySelector('#vCopia').textContent}));
 ok(ui.esc===100&&ui.x===2&&ui.cor&&ui.cp==='Copiar do Parado','pose Correndo com ajuste próprio (tamanho '+ui.esc+', direita '+ui.x+'; botões − + funcionam)');
 const par=await P.evaluate(()=>JSON.stringify(ED.vis.parado));ok(par==='{"esc":130,"x":0,"y":0,"giro":0,"frente":0,"corte":35}','mexer no correndo não muda o parado ('+par+')');
 await P.click('#vPar');await W(100);ok(await P.evaluate(()=>+document.querySelector('#vEsc').value===130&&document.querySelector('#vLado [data-f="0"]').classList.contains('on')),'tocar no boneco parado volta para o ajuste dele (130%, atrás do corpo)');
 // dividido: a parte de cima do desenho na frente do corpo, o resto atrás (ex.: a ponta da espada por cima do ombro)
 const dv0=await P.evaluate(()=>document.querySelector('#vCorteW').classList.contains('hide'));await P.click('#vLado [data-f="2"]');await P.click('.sl [data-d="vC:2"]');await P.click('.sl [data-d="vC:2"]');await W(300);
 const dv=await P.evaluate(()=>({w:!document.querySelector('#vCorteW').classList.contains('hide'),c:+document.querySelector('#vC').value,p:ED.vis.parado.frente}));
 ok(dv0&&dv.w&&dv.c===39&&dv.p===2,'Dividido: aparece o corte (parte de cima na frente: '+dv.c+'%)');
 await P.click('#publicar');await W(2200);const I=(await mget('/__itens')).p_capa_akatsuki;
 ok(I&&/^data:image/.test(I.visual)&&/^data:image/.test(I.visual2)&&I.vis&&I.vis.esc===130,'gravou o visual, a capa ao vento e o ajuste de tamanho');
 ok(I&&I.vis.parado&&I.vis.correndo&&I.vis.parado.esc===130&&I.vis.parado.frente===2&&I.vis.parado.corte===39&&I.vis.correndo.giro===40&&I.vis.correndo.frente===1&&I.vis.correndo.x===2,'gravou um ajuste para cada pose ('+JSON.stringify(I&&I.vis)+')');
 await P.screenshot({path:path.join(__dirname,'visual_painel.png'),fullPage:true});
 // jogo
 const aid=await A.evaluate(()=>ONL.uid);await fetch(MOCK+'/rest/v1/rpc/dar_itens',{method:'POST',headers:{apikey:'svc-test','Content-Type':'application/json'},body:JSON.stringify({p_personagem:aid,p_itens:['p_capa_akatsuki']})});
 const g=await A.evaluate(async()=>{await invReload();equipItem('p_capa_akatsuki');stats();gsSend(Object.assign({t:'meta'},onlMeta()));const it=ITEMS.p_capa_akatsuki;return{eq:EQ.capa,vis:!!(it&&it.vis&&it.vis.img&&it.vis.img2),n:eqVis().length}});
 ok(g.eq==='p_capa_akatsuki'&&g.vis&&g.n===1,'o jogo carrega o visual do item e equipa');
 const lado=await A.evaluate(()=>{const v=ITEMS.p_capa_akatsuki.vis,a=ancDe(HERO.idle[0]);const P0=ITR.itCamada('capa',a,v,10,10,0,0,true),P1=ITR.itCamada('capa',a,v,10,10,1,0,true);return[P0.div,P1.tras,Math.round(P1.rot*180/Math.PI),P1.div]});
 ok(lado[0]===1&&lado[1]===0&&lado[3]===0&&Math.abs(lado[2]-40)<=2,'no jogo: parado dividido, correndo na frente e girado ('+lado+')');
 const cut=await A.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=200;const g=c.getContext('2d'),im=document.createElement('canvas');im.width=40;im.height=100;const q=im.getContext('2d');q.fillStyle='#f00';q.fillRect(0,0,40,100);
  const P={x:100,y:100,w:40,h:100,rot:.5,px:.5,py:.5,corte:.39},n=()=>{const d=g.getImageData(0,0,200,200).data;let k=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)k++;return k};
  ITR.itDesenha(g,im,P);const t=n();g.clearRect(0,0,200,200);ITR.itDesenha(g,im,P,'cima');const a=n();g.clearRect(0,0,200,200);ITR.itDesenha(g,im,P,'baixo');const b=n();return[t,a,b]});
 ok(Math.abs(cut[1]/cut[0]-.4)<.05&&Math.abs((cut[1]+cut[2])/cut[0]-1)<.04,'dividido: a parte de cima (~39%) e a de baixo somam o desenho inteiro ('+cut+')');
 const est=await A.evaluate(()=>{const R=ancDe(HERO.idle[0]);const h=HERO.run.map(im=>ITR.itCamada('arma',ITR.itAncoraRef(ancDe(im),R),{},10,40,1,0).h);return Math.max(...h)-Math.min(...h)});
 ok(est<.01,'correndo: a peça não muda de tamanho entre os quadros (variação '+est.toFixed(3)+')');
 const spot=await B.evaluate(()=>[SPAWN[0]*T+5*T,SPAWN[1]*T]);
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];gsPos(true);$('#lvup').hidden=true;$('#toast').hidden=true},spot);await B.evaluate(s=>{p.x=s[0]+70;p.y=s[1];gsPos(true);$('#lvup').hidden=true},spot);await W(1500);
 const verm=pg=>pg.evaluate(()=>{const c=document.querySelector('#cv'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>130&&d[i]<190&&d[i+1]<40&&d[i+2]<40)n++;return n});
 const vA=await verm(A),vB=await verm(B);ok(vA>100,'A vê a capa no próprio boneco ('+vA+' pixels)');ok(vB>100,'B também vê a capa no boneco de A ('+vB+' pixels)');
 await A.screenshot({path:path.join(__dirname,'visual_a.png'),clip:{x:330,y:110,width:240,height:170}});
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
