// (cabeçalho copiado do editor5) Editor novo: mapas pequenos (sala 12×10, centralizada no jogo) e tiles grandes que ocupam 1 quadrado no mapa (tamanho no mapa ≠ arquivo).
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;const MR=require('../../server/mapas_regras.js');
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Ms'+suf;
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
 // ---- missões no editor
 const id='mis_'+suf;await P.click('#novo');await P.fill('#nvNome','Sala Missao');await W(150);await P.fill('#nvId',id);await P.click('.presets [data-p="16,12"]');await D('Criar');await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);
 await ev(()=>{EDITOR.s=1.2;EDITOR.ox=10;EDITOR.oy=10});await P.click('[data-aba="pintura"]');await W(300);await P.click('.ondes [data-op="npcs"]');await W(150);
 await P.click('#npMisP');await P.waitForFunction(()=>document.querySelector('#missoesTela #msNova'),null,{timeout:8000});await P.click('#msNova');await P.fill('#msN','O livro perdido '+suf);await P.fill('#msP','Fale com o Kakashi\nAche o livro\nDevolva o livro');await P.click('#msS');await W(500);
 const MS=(await mget('/__missoes')).MISSOES,qid=Object.keys(MS).find(k=>MS[k].nome==='O livro perdido '+suf);ok(qid&&qid.startsWith('q_o_livro_perdido')&&MS[qid].passos.length===3,'missão criada no banco: '+qid);
 ok(await ev(n=>/O livro perdido/.test(document.querySelector('#msC').textContent),suf),'lista de missões mostra a nova');await P.click('#msX');await W(200);await P.click('#pnX');await W(150);
 // NPC com 3 páginas: começar → passo 2 → concluir
 await ev(()=>EDITOR.api.ferramenta('pincel'));await tap(await tela(5*32+10,5*32+10));await W(500);await P.fill('#npN','Kakashi');await P.fill('#npF','Olá, %player%!');
 await P.click('[data-rt="nenhum"]');
 for(let i=0;i<3;i++){await P.click('#npPgAdd');await W(80)}
 await P.waitForFunction(()=>EDITOR.missoes&&EDITOR.missoes.length>0,null,{timeout:5000}).catch(()=>{});
 const pgSet=async(pi,se,f,faz)=>ev(([pi,se,f,faz])=>{const box=document.querySelector('#npPgs');return{pi,se,f,faz,box:!!box}},[pi,se,f,faz]);
 // página 1: missão não começou → começar
 await P.click('[data-add="pg.0.se"]');await P.selectOption('.pgIn[data-p="pg.0.se.0"][data-k="q"]',qid);await P.selectOption('.pgIn[data-p="pg.0.se.0"][data-k="e"]','nao');
 await P.fill('.pgF[data-p="pg.0"]','Preciso da sua ajuda, %player%.\nAche meu livro!');await P.click('[data-add="pg.0.faz"]');await P.selectOption('.pgIn[data-p="pg.0.faz.0"][data-k="q"]',qid);
 // página 2: no passo 1 → ir para o passo 2
 await P.click('[data-add="pg.1.se"]');await P.selectOption('.pgIn[data-p="pg.1.se.0"][data-k="q"]',qid);await P.selectOption('.pgIn[data-p="pg.1.se.0"][data-k="e"]','passo');
 await P.fill('.pgF[data-p="pg.1"]','Procure na floresta.');await P.click('[data-add="pg.1.faz"]');await P.selectOption('.pgIn[data-p="pg.1.faz.0"][data-k="q"]',qid);await P.selectOption('.pgIn[data-p="pg.1.faz.0"][data-k="a"]','passo');await P.fill('.pgIn[data-p="pg.1.faz.0"][data-k="n"]','2');await P.press('.pgIn[data-p="pg.1.faz.0"][data-k="n"]','Tab');
 // página 3: no passo 2 e nível ≥ 1 → concluir
 await P.click('[data-add="pg.2.se"]');await P.selectOption('.pgIn[data-p="pg.2.se.0"][data-k="q"]',qid);await P.selectOption('.pgIn[data-p="pg.2.se.0"][data-k="e"]','passo');await P.fill('.pgIn[data-p="pg.2.se.0"][data-k="n"]','2');await P.press('.pgIn[data-p="pg.2.se.0"][data-k="n"]','Tab');
 await P.click('[data-add="pg.2.se"]');await P.selectOption('.pgIn[data-p="pg.2.se.1"][data-k="t"]','nivel');
 await P.fill('.pgF[data-p="pg.2"]','Obrigado, %player%!');await P.click('[data-add="pg.2.faz"]');await P.selectOption('.pgIn[data-p="pg.2.faz.0"][data-k="q"]',qid);await P.selectOption('.pgIn[data-p="pg.2.faz.0"][data-k="a"]','fim');
 await D('Salvar');await W(200);
 const npc=await ev(()=>EDITOR.m.npcs[0]);ok(npc.rt===0&&npc.pg.length===3&&npc.pg.map(g=>g.id).join()==='p1,p2,p3'&&JSON.stringify(npc.pg[0].se)===JSON.stringify([{t:'mis',q:qid,e:'nao'}])&&npc.pg[0].faz[0].a==='comecar'&&npc.pg[1].faz[0].n===2&&npc.pg[2].se[1].t==='nivel'&&npc.pg[2].faz[0].a==='fim','NPC com 3 páginas de missão: '+JSON.stringify(npc.pg));
 await tap(await tela(5*32+10,5*32+10));await W(500);ok(await ev(()=>document.querySelectorAll('#npPgs .pgF').length===3&&document.querySelector('[data-rt="nenhum"]').getAttribute('aria-pressed')==='true'),'reabrir mostra as páginas e o retrato');await D('Cancelar');await W(150);
 // NPC com escolhas: Sim = resposta + levar para (2, 2) + não repetir; Não = só fecha
 await ev(()=>EDITOR.api.ferramenta('pincel'));await tap(await tela(9*32+10,5*32+10));await W(500);await P.fill('#npN','Iruka');await P.fill('#npF','Olá, jovem ninja!\nDeseja ir para a academia ninja?');
 await P.click('[data-add="ch"]');await P.click('[data-add="ch"]');await P.fill('.pgIn[data-p="ch.0"][data-k="txt"]','Sim');await P.fill('.pgIn[data-p="ch.1"][data-k="txt"]','Não');
 await P.fill('.pgF[data-p="ch.0"]','Boa sorte, %player%!');
 await P.click('[data-add="ch.0.faz"]');await P.selectOption('.pgIn[data-p="ch.0.faz.0"][data-k="t"]','tp');await P.selectOption('.pgIn[data-p="ch.0.faz.0"][data-k="m"]',id);
 await ev(()=>{const b=document.querySelector('[data-tp="ch.0.faz.0"]');b.scrollIntoView({block:'center'})});await P.click('[data-tp="ch.0.faz.0"]');await P.waitForFunction(()=>document.querySelector('#escChegada')&&document.querySelector('#escChegada').vis.W>0,null,{timeout:8000});await W(300);
 const pc=await ev(()=>{const o=document.querySelector('#escChegada'),v=o.vis,r=o.querySelector('canvas').getBoundingClientRect();return[r.left+v.ox+(2*32+16)*v.s,r.top+v.oy+(2*32+16)*v.s]});await tap(pc);await W(150);await P.click('#ecOk');await W(200);
 await P.click('[data-add="ch.0.faz"]');await P.selectOption('.pgIn[data-p="ch.0.faz.1"][data-k="t"]','fim');await ev(()=>document.querySelector('#npCh').scrollIntoView({block:'start'}));await W(200);await P.screenshot({path:path.join(__dirname,'ed9_ed.png')});
 await D('Salvar');await W(200);const iru=await ev(()=>EDITOR.m.npcs.find(n=>n.n==='Iruka'));
 ok(JSON.stringify(iru.ch)===JSON.stringify([{txt:'Sim',f:['Boa sorte, %player%!'],faz:[{t:'tp',m:id,tx:2.5,ty:2.5},{t:'fim'}]},{txt:'Não',f:[],faz:[]}]),'escolhas salvas: '+JSON.stringify(iru.ch));
 await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(2500);
 const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pm=pub.mapas[id];ok(pm&&pm.npcs[0].pg.length===3&&pm.npcs[0].rt===0&&pub.missoes[qid]&&pub.missoes[qid].p.length===3,'servidor entrega páginas e missões');
 const vpg=MR.validar('xx','x',{...pm,npcs:[{id:'n1',x:1,y:1,pg:[{se:[{t:'mis',q:'bad',e:'nao'},{t:'item',i:'manto',n:500},{t:'zzz'}],f:['a'],faz:[{t:'mis',q:qid,a:'xx'},{t:'tp',m:'konoha',tx:3,ty:4}]}]}]},{tsz:[],fpt:{}}).npcs[0].pg[0];ok(vpg.se.map(k=>k.t+':'+k.n).join()==='item:1'&&vpg.faz.length===1&&vpg.faz[0].t==='tp'&&vpg.faz[0].tx===3,'regras: condições e ações inválidas descartadas: '+JSON.stringify(vpg));
 // ---- jogo
 await A.click('#mapbtn');await W(2500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'sala missao');await W(2500);
 ok(await A.evaluate(q=>MIS.ok&&!!MIS.def[q]&&npcMarca(MAPEV.npcs[0])==='!',qid),'jogo: “!” em cima do NPC com missão para começar');
 const fala=async()=>{await A.evaluate(()=>{p.x=5.5*32;p.y=7*32});await W(400);await A.click('#npcBtn');await W(200);const t=await A.evaluate(()=>document.getElementById('npcT').textContent);
   for(let i=0;i<5&&await A.evaluate(()=>document.getElementById('npcDlg').style.display==='block');i++){await A.click('#npcP');await W(150)}await W(800);return t};
 let t=await fala();ok(t==='Preciso da sua ajuda, '+adm+'.','jogo: fala da página 1 com %player% trocado pelo nome: '+t);
 ok(await A.evaluate(()=>document.getElementById('npcR').style.display==='none'),'jogo: retrato “nenhum” não aparece');
 ok(await A.evaluate(q=>MIS.d[q]===1,qid)&&(await mget('/__missoes')).PROG,'jogo: missão iniciada (passo 1)');
 ok(await A.evaluate(()=>{const h=document.getElementById('misHud');return h&&h.style.display==='block'&&/O livro perdido/.test(h.textContent)&&/Fale com o Kakashi/.test(h.textContent)}),'jogo: diário no alto mostra a missão e o passo');
 ok(await A.evaluate(()=>npcMarca(MAPEV.npcs[0])==='?'&&ONL.reg.some(r=>/Missão iniciada/.test(r.t))),'jogo: aviso “Missão iniciada” e o NPC passa a mostrar “?”');
 t=await fala();ok(t==='Procure na floresta.'&&await A.evaluate(q=>MIS.d[q]===2,qid),'jogo: página 2 leva ao passo 2');
 ok(await A.evaluate(()=>/Ache o livro/.test(document.getElementById('misHud').textContent)),'jogo: diário mostra o passo 2');
 t=await fala();ok(t==='Obrigado, '+adm+'!'&&await A.evaluate(q=>MIS.d[q]===999,qid),'jogo: página 3 conclui a missão');
 ok(await A.evaluate(()=>document.getElementById('misHud').style.display==='none'&&ONL.reg.some(r=>/Missão concluída/.test(r.t))),'jogo: diário some e avisa “Missão concluída”');
 const pr=(await mget('/__missoes')).PROG;ok(Object.values(pr).some(o=>o[qid]===999),'progresso salvo no banco (999 = concluída)');
 t=await fala();ok(t==='Olá, '+adm+'!','jogo: depois de concluída, volta às falas normais');
 // escolhas no jogo
 const fIru=async()=>{await A.evaluate(()=>{p.x=9.5*32;p.y=7*32});await W(400);await A.click('#npcBtn');await W(200);await A.click('#npcP');await W(150)};
 await fIru();ok(await A.evaluate(()=>document.querySelectorAll('#npcOps .npcOp').length===2&&document.getElementById('npcP').style.display==='none'&&/academia/.test(document.getElementById('npcT').textContent)),'jogo: na última fala aparecem as escolhas Sim/Não');await A.screenshot({path:path.join(__dirname,'ed9_escolhas.png')});
 await A.click('#npcOps .npcOp >> nth=1');await W(300);ok(await A.evaluate(()=>document.getElementById('npcDlg').style.display==='none'&&Math.abs(p.x-9.5*32)<2),'jogo: “Não” só fecha');
 await fIru();ok(await A.evaluate(()=>document.querySelectorAll('#npcOps .npcOp').length===2),'jogo: falando de novo, a mesma conversa se repete');
 await A.click('#npcOps .npcOp >> nth=0');await W(200);ok(await A.evaluate(n=>document.getElementById('npcT').textContent==='Boa sorte, '+n+'!',adm),'jogo: “Sim” mostra a resposta do NPC');
 await A.click('#npcP');await W(900);ok(await A.evaluate(()=>Math.floor(p.x/32)===2&&Math.floor(p.y/32)===2),'jogo: depois do “Sim” leva para (2, 2)');
 ok(await A.evaluate(()=>npcPg(MAPEV.npcs.find(c=>c.n==='Iruka'))===-2),'jogo: a conversa do Iruka não se repete mais');
 const PR2=(await mget('/__missoes')).PROG;ok(Object.values(PR2).some(o=>Object.keys(o).some(k=>/^q__[0-9a-f]{16}$/.test(k)&&o[k]===1)),'servidor grava o “não repetir” na conta');
 await A.evaluate(()=>{p.x=9.5*32;p.y=7*32});await W(400);ok(await A.evaluate(()=>document.getElementById('npcBtn').style.display==='none'),'jogo: perto do Iruka não aparece mais “Falar”');
 // servidor confere distância e página
 await A.evaluate(()=>{p.x=5.5*32;p.y=7*32});await W(700);await A.evaluate(q=>{MIS.d[q]=0;gsSend({t:'npcfim',id:'n1',pg:0})},qid);await W(800);ok(await A.evaluate(q=>MIS.d[q]===999,qid),'servidor não deixa recomeçar fora da regra (corrige o app)');
 // condições no app: item e nível
 ok(await A.evaluate(()=>{const s0=INV.slice();INV.length=0;const a=misCond([{t:'item',i:'manto',n:1}]);INV.push('manto');const b=misCond([{t:'item',i:'manto',n:1}]);INV.length=0;s0.forEach(x=>INV.push(x));return !a&&b&&misCond([{t:'nivel',n:1}])&&!misCond([{t:'nivel',n:99}])}),'app: condições de item e nível');
 // animação: alinhamento pelo pé e quadros por direção
 ok(await A.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=30;const g=c.getContext('2d');g.fillStyle='#f00';g.fillRect(4,2,8,20);const pe=npcPe(c);
   const n={a:{t:'img',k:'a',q:['a','b'],qc:['c1','c2']}};return pe&&pe.cx===8&&pe.by===22&&pe.ty===2&&npcQuadros(n,{dir:'c'}).L[0]==='c1'&&npcQuadros(n,{dir:'b'}).L[0]==='a'&&npcQuadros(n,{dir:'l'}).lado}),'animação: pé do quadro (base e centro do desenho) e quadros para cima/baixo');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 await A.screenshot({path:path.join(__dirname,'ed9_jogo.png')});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
