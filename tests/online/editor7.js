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
 // mapa B (12×10), publicado primeiro
 const mB='ev_b_'+suf,mA='ev_a_'+suf;
 const criar=async(id,nome,p)=>{await P.click('#novo');await P.fill('#nvNome',nome);await W(150);await P.fill('#nvId',id);await P.click('.presets [data-p="'+p+'"]');await D('Criar');await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);await ev(()=>{EDITOR.s=1.2;EDITOR.ox=10;EDITOR.oy=10});};
 const publicar=async()=>{await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(2500);};
 const sair=async()=>{await ev(()=>EDITOR.api.sairEditor&&EDITOR.api.sairEditor());await W(400);};
 await criar(mB,'Sala B','12,10');
 // evento em (2,2) → mapa A, chegando no nascimento
 await ev(()=>{EDITOR.api.ativar('eventos');EDITOR.api.ferramenta('pincel')});await W(100);
 ok(await ev(()=>/Eventos/.test(document.querySelector('#fCamN').textContent)),'camada Eventos');
 await ev(()=>{EDITOR.srv=null});
 await tap(await tela(2*32+10,2*32+10));await W(500);ok(await ev(()=>!document.querySelector('#dlg').hidden&&!!document.querySelector('#evM')),'tocar no tile abre o evento');
 await ev(id=>{const s=document.querySelector('#evM');if(![...s.options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;s.appendChild(o)}s.value=id},mA);await D('Salvar');await W(200);
 let evs=await ev(()=>EDITOR.m.eventos);ok(evs.length===1&&evs[0].x===2&&evs[0].y===2&&evs[0].m===mA&&evs[0].tx==null,'evento salvo (nascimento do destino): '+JSON.stringify(evs));
 await publicar();await sair();
 // mapa A (16×12): sem PvP e evento em (3,3) → B (5.5, 5)
 await criar(mA,'Sala A','16,12');
 await P.click('[data-aba="prop"]');await W(200);await P.click('#pPvp');await W(100);ok(await ev(()=>EDITOR.m.pvp===false),'Propriedades: PvP desligado');await P.click('#pnX').catch(()=>{});await W(150);
 await ev(()=>{EDITOR.api.ativar('eventos');EDITOR.api.ferramenta('pincel')});await ev(()=>{EDITOR.srv=null});
 await tap(await tela(3*32+10,3*32+10));await W(500);
 await ev(id=>{document.querySelector('#evM').value=id},mB);await P.click('#evN');await P.fill('#evX','5.5');await P.fill('#evY','5');await D('Salvar');await W(200);
 evs=await ev(()=>EDITOR.m.eventos);ok(evs.length===1&&evs[0].m===mB&&evs[0].tx===5.5&&evs[0].ty===5,'evento com destino X/Y: '+JSON.stringify(evs));
 await ev(()=>EDITOR.api.ferramenta('borracha'));await tap(await tela(3*32+10,3*32+10));ok(await ev(()=>EDITOR.m.eventos.length===0),'borracha apaga o evento');await P.click('#desf');ok(await ev(()=>EDITOR.m.eventos.length===1),'desfazer volta o evento');
 await publicar();
 const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pa=pub.mapas[mA],pb=pub.mapas[mB];
 ok(pa&&pa.pvp===0&&pa.ev&&pa.ev[0].m===mB&&pa.ev[0].tx===5.5,'servidor: mapa A sem PvP e com o evento');ok(pb&&pb.pvp===undefined&&pb.ev&&pb.ev[0].tx===undefined,'servidor: mapa B com PvP (padrão) e evento para o nascimento');
 ok(MR.compilar(pa,{tsz:[],fpt:{}}).pvp===0&&MR.compilar(pb,{tsz:[],fpt:{}}).pvp===1,'regras: compilar leva o PvP do mapa');
 ok(MR.validar('xx','x',{...pb,ev:[{x:99,y:1,t:'tp',m:'konoha'},{x:1,y:1,t:'xx',m:'konoha'},{x:1,y:1,t:'tp',m:'Bad!'}]},{tsz:[],fpt:{}}).ev===undefined,'regras: eventos inválidos são descartados');
 // jogo
 await A.click('#mapbtn');await W(2500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'sala a');await W(2500);
 ok(await A.evaluate(()=>MAPEV.nopvp===1&&pvpSafeAt(p.x+500,p.y+500)&&PVT().length===0),'jogo: mapa sem PvP é todo zona segura');
 await A.evaluate(()=>{p.x=3*32+16;p.y=3*32+20});await W(600);
 let g=await A.evaluate(()=>({m:CURMAP,x:p.x/32,y:p.y/32,np:MAPEV.nopvp}));ok(g.m.includes('ev_b')&&g.x===5.5&&g.y===5&&g.np===0,'jogo: pisar no evento leva para B em (5.5, 5): '+JSON.stringify(g));
 await W(1500);ok(await A.evaluate(()=>ONL.joined&&CURMAP.includes('ev_b')),'jogo: entrou na sala B no servidor');
 await A.evaluate(()=>{p.x=2*32+16;p.y=2*32+20});await W(600);
 g=await A.evaluate(()=>({m:CURMAP,x:p.x/32,y:p.y/32,s:SPAWN}));ok(g.m.includes('ev_a')&&g.x===g.s[0]&&g.y===g.s[1],'jogo: evento sem destino leva ao nascimento de A: '+JSON.stringify(g));
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
