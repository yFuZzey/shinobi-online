// (cabeçalho copiado do editor5) Editor novo: mapas pequenos (sala 12×10, centralizada no jogo) e tiles grandes que ocupam 1 quadrado no mapa (tamanho no mapa ≠ arquivo).
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;const MR=require('../../server/mapas_regras.js');
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Np'+suf;
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
 // biblioteca: um recorte para NPC de imagem
 const rid=await ev(async suf=>{const c=document.createElement('canvas');c.width=232;c.height=300;const g=c.getContext('2d');g.fillStyle='rgb(30,120,200)';g.fillRect(4,0,24,48);g.fillStyle='rgb(200,120,30)';g.fillRect(32,0,200,300);
   const bl=await new Promise(ok=>c.toBlob(ok,'image/png')),sha=await Recursos.sha12(await bl.arrayBuffer()),o='originais/'+sha+'.png';await Recursos.subir(o,bl,'image/png');
   return (await Recursos.criar({id:'r_npc_'+suf,nome:'Npc '+suf,tipo:'spritesheet',categoria:'',colecao:'',original:o,arquivo:o,w:232,h:300,fundo:null,grade:null,recortes:[{id:'c1',nome:'Guarda',cat:'',x:0,y:0,w:32,h:48},{id:'c2',nome:'Kakashi',cat:'',x:32,y:0,w:200,h:300}],meta:{}})).id},suf);
 const k=rid+'.c1',id='npc_'+suf;
 await P.click('#novo');await P.fill('#nvNome','Sala NPC');await W(150);await P.fill('#nvId',id);await P.click('.presets [data-p="16,12"]');await D('Criar');await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);
 await ev(()=>EDITOR.api.carregarLib());await W(1500);await ev(()=>{EDITOR.s=1.2;EDITOR.ox=10;EDITOR.oy=10});
 await P.click('[data-aba="pintura"]');await W(300);ok(await ev(()=>!!document.querySelector('.ondes [data-op="npcs"]')),'“Onde pintar” tem 🧑 NPCs');await P.click('.ondes [data-op="npcs"]');await W(150);await P.click('#pnX');await W(150);
 await ev(()=>EDITOR.api.ferramenta('pincel'));
 // NPC ninja com duas falas
 await tap(await tela(5*32+10,5*32+10));await W(400);ok(await ev(()=>!document.querySelector('#dlg').hidden&&!!document.querySelector('#npN')),'tocar no tile abre o NPC');
 await P.fill('#npN','Hokage');await P.click('[data-sw="c"][data-v="3"]');await P.fill('#npF','Olá, ninja!\n\nVolte depois.');await D('Salvar');await W(200);
 let np=await ev(()=>EDITOR.m.npcs);ok(np.length===1&&np[0].id==='n1'&&np[0].n==='Hokage'&&np[0].a.t==='ninja'&&np[0].a.c===3&&JSON.stringify(np[0].f)==='["Olá, ninja!","Volte depois."]'&&np[0].b===undefined,'NPC ninja salvo: '+JSON.stringify(np[0]));
 // NPC de imagem, sem bloquear
 await tap(await tela(9*32+10,5*32+10));await W(400);await P.fill('#npN','Guarda');await P.click('[data-npa="img"]');await ev(k=>{const s=document.querySelector('#npK');s.value=k;s.dispatchEvent(new Event('change'))},k);
 await P.click('#npB');await D('Salvar');await W(200);np=await ev(()=>EDITOR.m.npcs);ok(np.length===2&&np[1].id==='n2'&&np[1].a.t==='img'&&np[1].a.k===k&&np[1].b===0,'NPC de imagem (não bloqueia): '+JSON.stringify(np[1]));
 // NPC de imagem grande: automático = altura de um personagem; dá para escolher outro tamanho
 const kk=rid+'.c2';await ev(()=>EDITOR.api.ferramenta('pincel'));await tap(await tela(3*32+10,8*32+10));await W(400);await P.fill('#npN','Kakashi');await P.click('[data-npa="img"]');await ev(k=>{const s=document.querySelector('#npK');s.value=k;s.dispatchEvent(new Event('change'))},kk);await W(300);
 ok(/60 px/.test(await ev(()=>document.querySelector('#npInfo').textContent))&&await ev(()=>document.querySelector('[data-npe="auto"]').getAttribute('aria-pressed')==='true'),'imagem grande: automático deixa com a altura de um personagem ('+await ev(()=>document.querySelector('#npInfo').textContent)+')');
 await D('Salvar');await W(200);np=await ev(()=>EDITOR.m.npcs);ok(np[2].n==='Kakashi'&&np[2].a.k===kk&&np[2].a.e===undefined,'salvo no automático (sem escala fixa)');
 await tap(await tela(3*32+10,8*32+10));await W(400);await P.click('[data-npe="m"]');await P.fill('#npE','30');await P.press('#npE','Tab');await W(150);
 ok(/90 px/.test(await ev(()=>document.querySelector('#npInfo').textContent)),'outro tamanho: 30% = 90 px de altura');await ev(()=>document.querySelector('#npPrev').scrollIntoView({block:'center'}));await P.screenshot({path:path.join(__dirname,'ed8_dlg.png')});await D('Salvar');await W(200);ok(await ev(()=>EDITOR.m.npcs[2].a.e===.3),'escala 30% salva');
 await tap(await tela(3*32+10,8*32+10));await W(400);await P.click('[data-npe="auto"]');await D('Salvar');await W(200);ok(await ev(()=>EDITOR.m.npcs[2].a.e===undefined),'voltar ao automático');
 // duplicar, mover e apagar
 await tap(await tela(5*32+10,5*32+10));await W(400);await D('Duplicar');await W(200);np=await ev(()=>EDITOR.m.npcs);ok(np.length===4&&np[3].id==='n4'&&np[3].x===6&&np[3].n==='Hokage','duplicar NPC (novo id, tile ao lado)');
 await ev(()=>EDITOR.api.ferramenta('mover'));const de=await tela(6*32+16,5*32+16),pa_=await tela(6*32+16,8*32+16);
 await toque('touchStart',[de]);for(let i=1;i<=8;i++){await toque('touchMove',[[de[0]+(pa_[0]-de[0])*i/8,de[1]+(pa_[1]-de[1])*i/8]]);await W(30)}await toque('touchEnd',[]);await W(150);
 ok(await ev(()=>EDITOR.m.npcs[3].x===6&&EDITOR.m.npcs[3].y===8),'✋ Mover arrasta o NPC');
 await ev(()=>EDITOR.api.ferramenta('borracha'));await tap(await tela(6*32+10,8*32+10));ok(await ev(()=>EDITOR.m.npcs.length===3),'borracha apaga o NPC');
 await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(2500);
 const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pm=pub.mapas[id];
 ok(pm&&pm.npcs&&pm.npcs.length===3&&pm.npcs[0].n==='Hokage'&&pm.npcs[0].f.length===2&&pm.npcs[1].a.k===k&&pm.npcs[1].b===0,'servidor entrega os NPCs');ok(!!pub.imagens[k],'servidor manda a imagem do NPC junto');
 ok(MR.validar('xx','x',{...pm,npcs:[{id:'zz',x:1,y:1},{id:'n9',x:99,y:1},{id:'n8',x:1,y:1,n:'<b>x</b>',a:{t:'img',k:'naoexiste'},f:['ok',5]}]},{tsz:[],fpt:{}}).npcs.map(c=>c.n+'|'+c.a.t+'|'+c.f.length).join()==='bx/b|ninja|1','regras: NPCs inválidos descartados e texto limpo');
 // jogo
 await A.click('#mapbtn');await W(2500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'sala npc');await W(2500);
 ok(await A.evaluate(k=>MAPEV.npcs.length===3&&M[5*N+5]===1&&M[5*N+9]!==1&&OB.some(o=>o.k===k),k),'jogo: NPCs no mapa (o ninja bloqueia o tile, o guarda não; imagem desenhada)');
 ok(await A.evaluate(k=>{const o=OB.find(o=>o.k===k);return o&&Math.abs(o.e-.2)<.001},rid+'.c2'),'jogo: NPC grande no automático fica com 60 px (escala 0.2)');
 await A.evaluate(()=>{p.x=5.5*32;p.y=7*32});await W(500);
 ok(await A.evaluate(()=>{const b=document.getElementById('npcBtn');return b&&b.style.display==='block'&&/Hokage/.test(b.textContent)}),'jogo: perto do NPC aparece “💬 Falar com Hokage”');
 await A.click('#npcBtn');await W(200);
 ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='block'&&document.getElementById('npcT').textContent==='Olá, ninja!'&&/Próximo/.test(document.getElementById('npcP').textContent)),'jogo: a janela mostra a primeira fala');
 await A.click('#npcP');await W(100);ok(await A.evaluate(()=>document.getElementById('npcT').textContent==='Volte depois.'&&/Fechar/.test(document.getElementById('npcP').textContent)),'jogo: “Próximo” mostra a segunda fala');
 await A.click('#npcP');await W(200);ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='none'),'jogo: “Fechar” fecha a janela');
 await A.evaluate(()=>{p.x=5.5*32;p.y=7*32});await W(500);await A.screenshot({path:path.join(__dirname,'ed8_perto.png')});
 await A.evaluate(()=>{p.x=12*32;p.y=10*32});await W(400);ok(await A.evaluate(()=>document.getElementById('npcBtn').style.display==='none'),'jogo: longe do NPC o botão some');
 await A.screenshot({path:path.join(__dirname,'ed8_npc.png')});
 // editor antigo removido: o endereço leva ao novo
 const rd=await fetch(GS+'/painel/mapas',{redirect:'manual'});ok(rd.status===302&&rd.headers.get('location')==='/painel/editor','/painel/mapas leva ao editor novo');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
