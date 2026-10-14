// (cabeçalho copiado do editor5) Editor novo: mapas pequenos (sala 12×10, centralizada no jogo) e tiles grandes que ocupam 1 quadrado no mapa (tamanho no mapa ≠ arquivo).
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;const MR=require('../../server/mapas_regras.js');
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Ev'+suf;
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
 // ---- mapa Academia: Kakashi + eventos
 const id='acad_'+suf;await P.click('#novo');await P.fill('#nvNome','Academia');await W(150);await P.fill('#nvId',id);await P.click('.presets [data-p="16,12"]');await D('Criar');await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);
 await ev(()=>{EDITOR.s=1.2;EDITOR.ox=10;EDITOR.oy=10});
 await ev(()=>{EDITOR.api.ativar('npcs');EDITOR.api.ferramenta('pincel')});await tap(await tela(10*32+10,4*32+10));await W(500);await P.fill('#npN','Kakashi');await P.fill('#npF','Bem-vindo à academia, %player%!');await D('Salvar');await W(200);
 // evento “ao entrar no mapa, 1 vez por conta”: mensagem do narrador + conversa com o Kakashi
 await ev(()=>{EDITOR.api.ativar('eventos');EDITOR.api.ferramenta('pincel')});await tap(await tela(1*32+10,1*32+10));await W(500);
 await P.click('[data-evg="entrar"]');await P.click('[data-evf="uma"]');ok(/1 vez por conta/.test(await ev(()=>document.querySelector('#evDica').textContent)),'evento: explica “ao entrar” e “1 vez por conta”');
 await P.selectOption('.pgIn[data-p="a.0"][data-k="t"]','msg');await P.selectOption('.pgIn[data-p="a.0"][data-k="npc"]','n1');await W(100);ok(await ev(()=>/Nome \(vazio = nome do NPC\)/.test(document.querySelector('.pgIn[data-p="a.0"][data-k="nome"]').placeholder)&&/Retrato: o do NPC/.test(document.querySelector('.pgIn[data-p="a.0"][data-k="rt"]').textContent)),'mensagem: escolher o NPC que fala (nome e retrato dele)');await P.fill('.pgF[data-p="a.0"]','Você chegou à Academia Ninja.');
 await P.click('#evA [data-add="a"]');await P.selectOption('.pgIn[data-p="a.1"][data-k="t"]','npc');
 await D('Salvar');await W(200);let e1=await ev(()=>EDITOR.m.eventos[0]);
 ok(JSON.stringify(e1)===JSON.stringify({id:'e1',x:1,y:1,g:'entrar',fr:'uma',a:[{t:'msg',nome:'',f:['Você chegou à Academia Ninja.'],npc:'n1'},{t:'npc',npc:'n1'}]}),'evento ao entrar salvo: '+JSON.stringify(e1));
 // outros dois por código: placa “1 vez por sessão” e um com condição que nunca vale
 await ev(()=>EDITOR.api.mudar(q=>{q.eventos.push({id:'e2',x:6,y:6,g:'pisar',fr:'sessao',a:[{t:'msg',nome:'',f:['Placa: cuidado com os kunais!']}]},{id:'e3',x:8,y:6,g:'pisar',fr:'sempre',se:[{t:'nivel',n:99}],a:[{t:'msg',nome:'',f:['nunca']}]})},'nada'));
 await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(2500);
 const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pm=pub.mapas[id];ok(pm&&pm.ev.length===3&&pm.ev[0].g==='entrar'&&pm.ev[0].fr==='uma'&&pm.ev[1].fr==='sessao'&&pm.ev[2].se[0].n===99&&!pm.ev[0].t,'servidor entrega os eventos (gatilho, frequência, condição)');
 // ---- jogo: entrar na Academia
 const entra=async n=>{await A.click('#mapbtn');await W(1500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),n);await W(2200)};
 await entra('academia');
 ok(await A.evaluate(()=>document.getElementById('npcDlg')&&document.getElementById('npcDlg').style.display==='block'&&document.getElementById('npcT').textContent==='Você chegou à Academia Ninja.'&&document.getElementById('npcN').textContent==='Kakashi'&&document.getElementById('npcR').style.display==='block'),'jogo: ao entrar abre a mensagem falada pelo Kakashi (nome e retrato dele)');
 await A.click('#npcP');await W(300);
 ok(await A.evaluate(n=>document.getElementById('npcDlg').style.display==='block'&&document.getElementById('npcN').textContent==='Kakashi'&&document.getElementById('npcT').textContent==='Bem-vindo à academia, '+n+'!',adm),'jogo: depois abre a conversa do Kakashi (de longe)');
 await A.click('#npcP');await W(900);ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='none'),'jogo: conversa fecha');
 const PR=(await mget('/__missoes')).PROG;ok(Object.values(PR).some(o=>Object.keys(o).some(k=>/^q__[0-9a-f]{16}$/.test(k)&&o[k]===1)),'servidor grava o “1 vez por conta”');
 await entra('konoha');await entra('academia');await W(800);ok(await A.evaluate(()=>!document.getElementById('npcDlg')||document.getElementById('npcDlg').style.display==='none'),'jogo: entrando de novo, o evento não acontece mais');
 // placa: 1 vez por sessão
 const pisa=async(x,y)=>{await A.evaluate(([x,y])=>{p.x=x*32+16;p.y=y*32+20},[x,y]);await W(500)};
 await pisa(6,6);ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='block'&&/Placa/.test(document.getElementById('npcT').textContent)),'jogo: pisar na placa mostra a mensagem');
 await A.click('#npcP');await W(200);await pisa(6,8);await pisa(6,6);ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='none'),'jogo: na mesma sessão não repete');
 await A.evaluate(()=>MAPEV.sess.clear());await pisa(6,8);await pisa(6,6);ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='block'),'jogo: em outra sessão volta a acontecer');await A.click('#npcP');await W(200);
 await pisa(8,6);ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='none'),'jogo: evento com condição que não vale não acontece');
 // servidor: evento “1 vez” não regrava; evento inexistente é ignorado
 const pk=JSON.stringify((await mget('/__missoes')).PROG);await A.evaluate(()=>{gsSend({t:'evfim',id:'e99'})});await W(500);ok(JSON.stringify((await mget('/__missoes')).PROG)===pk,'servidor ignora evento que não existe');
 ok(MR.validar('xx','x',{...pm,ev:[{x:1,y:1,g:'entrar',fr:'xx',a:[{t:'npc',npc:'zz'},{t:'msg',f:[]},{t:'fim'}]},{x:2,y:2,a:[{t:'msg',nome:'<b>A</b>',f:['oi'],npc:'n1',rt:'naoexiste'}]}]},{tsz:[],fpt:{}}).ev.map(e=>e.id+'|'+e.fr+'|'+e.a.map(a=>a.t+':'+(a.nome||'')+':'+(a.npc||'')+':'+(a.rt===undefined?'':a.rt)).join('+')).join()==='e2|sempre|msg:bA/b:n1:','regras: ações inválidas descartadas, frequência padrão “sempre”');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
