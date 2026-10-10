// Mapas criados no editor do painel: publicar pelo /painel/mapas, o servidor passa a conhecer o mapa (/mapas, /health),
// o jogo mostra na lista de mapas e entra nele; tirar do jogo remove. Também confere a colisão do servidor contra a do jogo.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{
 // 1) colisão do servidor = colisão do jogo (mesmas regras, conferidas nos mapas que já vêm no jogo)
 const R=require('../../server/mapas_regras.js'),srv=path.join(__dirname,'..','paginas','server'),cat=JSON.parse(fs.readFileSync(srv+'/mapa_objetos.json','utf8')),mp=JSON.parse(fs.readFileSync(srv+'/maps.json','utf8'));
 for(const [f,id] of [['atual','konoha'],['vila_areia','vila_areia']]){const d=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','src','ed','db','maps',f+'.json'),'utf8')),m=JSON.parse((d.data||d).json);
  const a=R.compilar(m,cat),v=R.validar(id==='konoha'?'konoha':id,id,m,cat),b=v&&R.compilar(v,cat);
  ok(a.M===mp[id].M,'colisão do servidor igual à do jogo: '+id+' ('+(a.M.match(/[12]/g)||[]).length+' células bloqueadas)');
  if(v)ok(b.M===mp[id].M,'depois da conferência do servidor continua igual: '+id)}
 ok(R.validar('x','x',{ground:'0'.repeat(10),objects:[]},cat)===null&&R.validar('ok_1','Ok',{ground:'0'.repeat(2500),objects:[['nao_existe',3,3]],spawn:[999,-5]},cat).spawn[0]===48,'mapa estragado é recusado; objeto desconhecido some; ponto de início fica dentro do mapa');
 const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const adm='Map'+suf,A=await mk(adm,0),B=await mk('Joga'+suf,1);await mget('/__admin?nome='+adm);
 // (no jogo só admin abre as outras vilas por enquanto: o botão Mapa dos demais avisa "em breve")
 await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
 // 2) editor no painel
 const P=await (await b.newContext({viewport:{width:412,height:860}})).newPage();P.on('pageerror',e=>{console.log('ERRO EDITOR',e.message);fails++});
 await P.goto(GS+'/painel/mapas');await P.waitForFunction(()=>typeof createMap==='function'&&typeof serialize==='function',null,{timeout:15000});await W(500);
 ok(await P.evaluate(()=>!document.querySelector('#goItems').offsetParent&&document.querySelector('#send').textContent.startsWith('Publicar')),'editor abre no servidor; botão Publicar; sem os envios para o Claude');
 await P.click('#send');await W(300);ok(await P.evaluate(()=>!document.querySelector('#pubLogin').hidden&&document.querySelector('#sendSt').textContent.includes('admin')),'Publicar sem entrar pede o login de admin');
 await P.fill('#pbU','Joga'+suf);await P.fill('#pbP','12345678');await P.click('#pbIn');await W(1200);
 ok(await P.evaluate(()=>document.querySelector('#sendSt').textContent.includes('não é admin')),'conta que não é admin não entra');
 await P.fill('#pbU',adm);await P.fill('#pbP','12345678');await P.click('#pbIn');await W(1500);
 ok(await P.evaluate(()=>!document.querySelector('#pubBox').hidden&&!document.querySelector('#srvSec').hidden),'admin entra e vê "Publicar este mapa" e a lista do servidor');
 // importar PNG: fundo magenta é removido, a imagem é cortada e vira objeto "Meus"
 const png0=await P.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=80;const g=c.getContext('2d');g.fillStyle='#ff00ff';g.fillRect(0,0,100,80);g.fillStyle='#d01010';g.fillRect(30,15,40,50);g.fillStyle='#ff00ff';g.fillRect(45,30,10,10);return c.toDataURL('image/png')});
 await P.evaluate(()=>{closeMenu();tool='object';ui()});await P.click('#imgNew');await P.setInputFiles('#imgFile',{name:'barraca.png',mimeType:'image/png',buffer:Buffer.from(png0.split(',')[1],'base64')});
 await P.waitForFunction(()=>IM&&IM.out,null,{timeout:8000});
 const im=await P.evaluate(()=>{const o=IM.out,d=o.getContext('2d').getImageData(0,0,o.width,o.height).data,al=(x,y)=>d[(y*o.width+x)*4+3];return{w:o.width,h:o.height,mode:IM.mode,canto:al(0,0),centro:al(5,5),furo:al(o.width/2|0,o.height/2|0),nome:document.querySelector('#imgNome').value}});
 ok(im.w===40&&im.h===50&&im.canto===255&&im.furo===255,'importar: fundo some e a imagem é cortada ('+im.w+'×'+im.h+', modo '+im.mode+')');
 // o fundo magenta que ficou DENTRO do desenho (ilha) só sai tocando nele
 const al0=await P.evaluate(()=>{const o=IM.out,d=o.getContext('2d').getImageData(0,0,o.width,o.height).data;return d[(20*o.width+20)*4+3]});
 await P.evaluate(()=>{const pv=document.querySelector('#imgPv'),r=pv.getBoundingClientRect(),k=r.width/pv.width;IM._t=[r.left+(IM.ox+20.5*IM.pv)*k,r.top+(IM.oy+20.5*IM.pv)*k]});
 const tp=await P.evaluate(()=>IM._t);await P.mouse.click(tp[0],tp[1]);await W(300);
 const im2=await P.evaluate(()=>{const o=IM.out,d=o.getContext('2d').getImageData(0,0,o.width,o.height).data,al=(x,y)=>d[(y*o.width+x)*4+3];return{furo:al(20,20),corpo:al(5,5),modo:IM.mode}});
 ok(al0===255&&im2.furo===0&&im2.corpo===255&&im2.modo==='tudo','tocar na cor que sobrou dentro do desenho tira só aquela cor ('+JSON.stringify(im2)+')');
 await P.fill('#imgNome','Barraca Teste');await P.click('#imgSave');await W(1500);
 const IMG=await mget('/__imagens'),iid=Object.keys(IMG)[0];
 ok(iid&&/^c_barraca_teste/.test(iid)&&IMG[iid].w===40&&IMG[iid].h===50&&/^data:image\/png;base64,/.test(IMG[iid].png)&&IMG[iid].fw>=1,'imagem salva no banco ('+iid+')');
 ok(await P.evaluate(i=>cat==='cus'&&kindSel===i&&!!CAT[i]&&CATS.some(c=>c[0]==='cus')&&!!document.querySelector('.tile[data-k="'+i+'"]'),iid),'aparece na aba "Meus" dos objetos e já vem selecionada');
 // redimensionar depois de salva: tamanho no mapa muda, os pixels do arquivo não
 await P.click('#imgNew');await P.click('#imgList button[data-ed="1"][data-id="'+iid+'"]');await P.waitForFunction(()=>IM&&IM.edit,null,{timeout:5000});
 const e0=await P.evaluate(()=>({dw:IM.dw,dh:IM.dh,bg:document.querySelector('#imgBgSec').hidden,btn:document.querySelector('#imgSave').textContent}));
 await P.fill('#imgDwIn','80');await W(300);
 const e1=await P.evaluate(()=>({dw:IM.dw,dh:IM.dh,sc:document.querySelector('#imgScV').textContent,info:document.querySelector('#imgFileInfo').textContent}));
 ok(e0.dw===40&&e0.bg&&/Salvar altera/.test(e0.btn)&&e1.dw===80&&e1.dh===100&&e1.sc==='200%'&&/40×50/.test(e1.info),'editar imagem salva: largura 40 → 80 px mostra 200% e o arquivo continua 40×50 ('+JSON.stringify(e1)+')');
 await P.click('#imgSave');await W(1500);
 const IME=(await mget('/__imagens'))[iid];
 ok(IME.dw===80&&IME.dh===100&&IME.w===40&&IME.h===50&&IME.png.length>100,'gravou o novo tamanho sem mexer na imagem (arquivo '+IME.w+'×'+IME.h+', mapa '+IME.dw+'×'+IME.dh+')');
 ok(await P.evaluate(i=>TX[i].width===80&&TX[i].height===100&&CAT[i].fw>=1,iid),'no editor o objeto passa a aparecer com o tamanho novo');
 // imagem pesada (ruído 700×700, PNG passa de 1,4 MB): em vez de pedir para diminuir, vira WebP com transparência e mantém os pixels
 await P.click('#imgNew');
 const big=await P.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=700;const g=c.getContext('2d'),d=g.createImageData(700,700);for(let i=0;i<d.data.length;i+=4){d.data[i]=Math.random()*255;d.data[i+1]=Math.random()*255;d.data[i+2]=Math.random()*255;d.data[i+3]=255}g.putImageData(d,0,0);return c.toDataURL('image/png')});
 await P.setInputFiles('#imgFile',{name:'ruido.png',mimeType:'image/png',buffer:Buffer.from(big.split(',')[1],'base64')});await P.waitForFunction(()=>IM&&IM.src&&IM.src.width>=700,null,{timeout:15000});
 await P.evaluate(()=>{IM.mode='nao';IM.sc=100;document.querySelector('#imgSc').value=100;imgProc()});await P.fill('#imgNome','Ruido Grande');await P.click('#imgSave');await W(2500);
 const IM2=await mget('/__imagens'),gr=Object.values(IM2).find(r=>/ruido/.test(r.id));
 ok(gr&&gr.w===700&&gr.h===700&&/^data:image\/webp/.test(gr.png)&&gr.png.length<=1400000,'imagem pesada não é encolhida: vira WebP e fica com 700×700 ('+(gr&&Math.round(gr.png.length/1024))+' KB)');
 // mapa novo com um objeto de colisão e uma área de mobs
 const nome='prova_'+suf;
 const info=await P.evaluate(([nome,fpt])=>{createMap(nome,'folha');const k=Object.keys(CAT).find(c=>catOK(CAT[c].c)&&fpt[c]&&fpt[c][0]>=2&&fpt[c][1]>=2);OBJ.push({k,x:20.5,y:20.5});OBJ.push({k:Object.keys(CAT).find(c=>CAT[c].c==='cus'),x:26.5,y:26.5});AREAS.push({x:30,y:30,w:8,h:8,mobs:[{m:'lobo_cinzento',n:3}]});rev++;autosave();return{k,mapName,n:OBJ.length}},[nome,cat.fpt]);
 ok(info.k&&info.mapName===nome,'mapa novo criado no editor com um objeto ('+info.k+')');
 await P.evaluate(()=>closeMenu());await P.click('#send');await W(1800);
 const row=(await mget('/__mapas'))[nome];
 ok(row&&row.publicado===true&&row.nome&&row.mapa&&row.mapa.objects.length===2&&row.mapa.areas&&row.mapa.areas[0].mobs[0].n===3,'gravou no banco já publicado, com o objeto e a área de mobs');
 await W(1500);
 const pub=await (await fetch(GS+'/mapas')).json();
 ok(pub.mapas[nome]&&pub.mapas[nome].title&&pub.mapas[nome].objects.length===2&&pub.imagens[iid]&&pub.imagens[iid].w===40&&pub.imagens[iid].dw===80,'servidor entrega o mapa e a imagem própria em /mapas ('+(pub.mapas[nome]&&pub.mapas[nome].title)+')');
 const ig=await (await fetch(GS+'/mapas?v='+pub.v)).json();ok(ig.igual===1&&!ig.mapas,'com a mesma versão o servidor não manda tudo de novo');
 const h=await (await fetch(GS+'/health')).json();ok(h.mapasPainel>=1,'/health conta o mapa do painel ('+h.mapasPainel+')');
 // base não é trocada pelo painel
 await P.evaluate(()=>{createMap('konoha','folha')});
 // 3) jogo: o mapa aparece na lista e dá para entrar
 await A.click('#mapbtn');await W(2500);
 const lst=await A.evaluate(()=>[...document.querySelectorAll('#mmList button')].map(x=>x.textContent));
 ok(lst.some(t=>/^Prova /i.test(t)),'jogo: o mapa novo aparece na lista de mapas ('+lst.join(' | ')+')');
 await A.evaluate(()=>[...document.querySelectorAll('#mmList button')].find(x=>/^Prova /i.test(x.textContent)).click());await W(1500);
 const g=await A.evaluate(()=>({cur:CURMAP,joined:ONL.joined,ob:OB.length,sp:SPAWN}));
 ok(g.cur===nome&&g.joined&&g.ob===2,'jogo: entrou no mapa publicado ('+g.cur+', '+g.ob+' objetos, online)');
 const gi=await A.evaluate(i=>({tsz:TSZ[i],fpt:FPT[i],tx:!!TX[i],nat:TX[i]&&TX[i].width,dw:TX[i]&&TX[i].dw,ob:OB.some(o=>o.k===i)}),iid);ok(gi.tsz&&gi.tsz[0]===80&&gi.tsz[1]===100&&gi.nat===40&&gi.dw===80&&gi.tx&&gi.ob,'jogo: imagem própria com 40×50 pixels aparece com 80×100 no mapa ('+JSON.stringify(gi.tsz)+', base '+JSON.stringify(gi.fpt)+')');
 await W(800);const vm=await A.evaluate(()=>{const c=document.querySelector('#cv'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>170&&d[i]<235&&d[i+1]<45&&d[i+2]<45)n++;return n});
 ok(vm>1500,'jogo desenha a imagem própria reduzida/ampliada no tamanho do mapa ('+vm+' pixels vermelhos na tela)');
 const mobs=await A.evaluate(()=>E.length);ok(mobs>=3,'servidor criou os mobs da área do mapa novo ('+mobs+' mobs)');
 // 4) tirar do jogo
 await P.evaluate(()=>{openMenu()});await P.click('#srvRef');await W(800);
 await P.evaluate(n=>{[...document.querySelectorAll('#srvList button')].find(b=>b.dataset.id===n&&b.dataset.k==='tog').click()},nome);await W(1200);
 ok((await mget('/__mapas'))[nome].publicado===false,'"Tirar do jogo" despublica no banco');
 await W(1500);await A.evaluate(()=>switchMap('vila_areia'));await W(1500);await fetch(GS+'/painel/recarregar',{method:'POST'});await W(1500); // enquanto alguém está dentro o mapa continua; ao esvaziar, some
 const pub2=await (await fetch(GS+'/mapas')).json();ok(!pub2.mapas[nome],'servidor para de entregar o mapa (saiu todo mundo dele)');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
