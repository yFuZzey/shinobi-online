// Editor novo: “Onde pintar” na aba Pintura, camadas com menu ⋯, e spritesheet usado como chão (por baixo do personagem, sem colisão).
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Ch'+suf;
 await A.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await A.click('#tabNew');await A.fill('#nu',adm);await A.fill('#np','12345678');await A.fill('#ne','t@t.com');await A.click('#goNew');
 await A.waitForFunction(()=>cur==='clan',null,{timeout:20000});await A.click('.card >> nth=0');await A.click('#go2');await A.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 await mget('/__admin?nome='+adm);await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
 const P=await (await b.newContext({viewport:{width:412,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2})).newPage();const erros=[];P.on('pageerror',e=>{erros.push(e.message);console.log('ERRO EDITOR',e.message)});
 await P.goto(GS+'/painel/editor');await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});
 const ev=(f,a)=>P.evaluate(f,a),D=t=>P.click('#dlgB button:has-text("'+t+'")');
 const cdp=await P.context().newCDPSession(P);const toque=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:i}))});
 const tap=async q=>{await toque('touchStart',[q]);await toque('touchEnd',[]);await W(100)};
 const tela=(x,y)=>ev(([x,y])=>{const r=document.querySelector('#cv').getBoundingClientRect();return[r.left+EDITOR.ox+x*EDITOR.s,r.top+EDITOR.oy+y*EDITOR.s]},[x,y]);
 await P.fill('#lgU',adm);await P.fill('#lgP','12345678');await P.click('#lgIn');await P.waitForFunction(()=>!document.querySelector('#secSrv').hidden,null,{timeout:8000});
 // spritesheet com 1 recorte (tapete 64×64) — sem “como usar” ainda
 const rid=await ev(async suf=>{const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');g.fillStyle='rgb(150,90,30)';g.fillRect(0,0,64,64);
   const bl=await new Promise(ok=>c.toBlob(ok,'image/png')),sha=await Recursos.sha12(await bl.arrayBuffer()),o='originais/'+sha+'.png';await Recursos.subir(o,bl,'image/png');
   return (await Recursos.criar({id:'r_piso_'+suf,nome:'Piso '+suf,tipo:'spritesheet',categoria:'',colecao:'',original:o,arquivo:o,w:64,h:64,fundo:null,grade:null,recortes:[{id:'c1',nome:'Tapete',cat:'',x:0,y:0,w:64,h:64}],meta:{}})).id},suf);
 await P.click('#abreBib');await W(800);await P.click('#bbLista .rec:has-text("Piso '+suf+'")');await D('Abrir');await P.waitForFunction(()=>BIB.RS.r&&BIB.RS.r.id,null,{timeout:10000});await W(300);
 await ev(()=>BIB.api.abaRc('recortes',true));await P.click('.lrec:has-text("Tapete")');await W(200);
 ok(await ev(()=>document.querySelectorAll('[data-uso]').length===3),'recorte: opções “Como usar no mapa” (Objeto / Chão / Por cima)');
 await P.click('[data-uso="chao"]');await W(150);let c1=await ev(()=>BIB.RS.r.recortes[0]);ok(c1.uso==='chao'&&c1.ns===true,'recorte marcado como Chão (e sem colisão)');
 await P.click('#rcSalvar');await P.waitForFunction(()=>/Salvo/.test(document.querySelector('#rcEstado').textContent),null,{timeout:10000});
 ok((await mget('/__recursos'))[rid].recortes[0].uso==='chao','“Chão” salvo no recurso');
 await P.click('#rcVoltar');await W(300);await P.click('#bbVoltar');await W(300);
 // mapa 16×12
 const id='piso_'+suf;await P.click('#novo');await P.fill('#nvNome','Piso');await W(150);await P.fill('#nvId',id);await P.click('.presets [data-p="16,12"]');await D('Criar');
 await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);await ev(()=>EDITOR.api.carregarLib());await W(1200);
 await P.click('[data-aba="pintura"]');await W(300);
 ok(await ev(()=>['terreno','chao','detalhes','objetos','acima','colisao'].every(k=>document.querySelector('.ondes [data-op="'+k+'"]'))),'Pintura: botões “Onde pintar” (terreno, piso, detalhes, objetos, por cima, colisão)');
 await P.click('.ondes [data-op="objetos"]');await W(200);ok(await ev(()=>EDITOR.E?true:true)&&/Objetos e spritesheets/.test(await ev(()=>document.querySelector('#fCamN').textContent)),'“Objetos e spritesheets” escolhido pelo botão');
 const k=rid+'.c1';await P.click('[data-ob="'+k+'"]');await P.click('#pnX');await W(150);await ev(()=>{EDITOR.s=1;EDITOR.ox=10;EDITOR.oy=40});await W(80);
 await tap(await tela(5*32+10,5*32+20));let ob=await ev(()=>EDITOR.m.objetos.map(o=>o.f));
 ok(ob.length===1&&JSON.stringify(ob[0])==='[1,null,{"z":"chao"}]','Automático: o recorte “Chão” entra por baixo do personagem e sem colisão: '+JSON.stringify(ob[0]));
 // “Colocar como: Por cima” vence o automático
 await P.click('[data-aba="pintura"]');await W(300);await P.click('[data-om="acima"]');await W(100);await P.click('#pnX');await W(150);
 await tap(await tela(10*32+10,8*32+20));ob=await ev(()=>EDITOR.m.objetos.map(o=>o.f));ok(ob.length===2&&ob[1][2]&&ob[1][2].z==='acima','Colocar como “Por cima”');
 await P.click('[data-aba="pintura"]');await W(300);await P.click('[data-om="auto"]');await P.click('#pnX');await W(100);
 // barra do objeto: Ordem Normal → Chão → Por cima → Normal
 await P.click('[data-f="sel"]');await tap(await tela(10*32+16,8*32-10));ok(await ev(()=>!document.querySelector('#objBar').hidden&&!!document.querySelector('#objBar [data-o="z"]')),'barra do objeto tem o botão de ordem');
 await P.click('#objBar [data-o="z"]');ok(await ev(()=>{const f=EDITOR.m.objetos[1].f;return f[0]===1&&!(f[2]&&f[2].z)}),"Por cima → Normal");
 await P.click('#objBar [data-o="z"]');ok(await ev(()=>{const f=EDITOR.m.objetos[1].f;return f[0]===1&&f[2].z==='chao'}),'Normal → Chão (sem colisão)');
 await P.click('#objBar [data-o="z"]');ok(await ev(()=>EDITOR.m.objetos[1].f[2].z==='acima'),'Chão → Por cima');await P.click('#objBar [data-o="x"]');
 // camadas: menu ⋯
 await P.click('[data-aba="camadas"]');await W(200);ok(await ev(()=>!document.querySelector('[data-up]')&&!!document.querySelector('[data-mais="chao"]')),'camadas: ▲▼✎🗑 ficam no menu ⋯');
 await P.click('[data-mais="detalhes"]');await W(100);ok(await ev(()=>document.querySelectorAll('#dlgB button').length===5),'menu ⋯ com subir, descer, renomear, excluir');await D('Fechar');
 // publica e confere no servidor
 await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(2500);
 const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pm=pub.mapas[id];const o0=pm&&pm.objects.find(o=>o[0]===k&&o[1]===5.5);
 ok(o0&&o0[5]&&o0[5].z==='chao','servidor recebe o objeto como chão');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
