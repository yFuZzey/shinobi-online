// (cabeçalho copiado do editor5) Editor novo: mapas pequenos (sala 12×10, centralizada no jogo) e tiles grandes que ocupam 1 quadrado no mapa (tamanho no mapa ≠ arquivo).
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;const MR=require('../../server/mapas_regras.js');
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Tr'+suf;
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
 // biblioteca: boneco com 2 quadros parado + 1 ao apanhar
 const rid=await ev(async suf=>{const c=document.createElement('canvas');c.width=96;c.height=48;const g=c.getContext('2d');g.fillStyle='rgb(150,100,50)';g.fillRect(8,0,16,48);g.fillRect(40,2,16,46);g.fillStyle='rgb(220,60,40)';g.fillRect(72,4,16,44);
   const bl=await new Promise(ok=>c.toBlob(ok,'image/png')),sha=await Recursos.sha12(await bl.arrayBuffer()),o='originais/'+sha+'.png';await Recursos.subir(o,bl,'image/png');
   return (await Recursos.criar({id:'r_boneco_'+suf,nome:'Boneco '+suf,tipo:'spritesheet',categoria:'',colecao:'',original:o,arquivo:o,w:96,h:48,fundo:null,grade:null,recortes:[{id:'c1',nome:'Parado 1',cat:'',x:0,y:0,w:32,h:48},{id:'c2',nome:'Parado 2',cat:'',x:32,y:0,w:32,h:48},{id:'c3',nome:'Apanhando',cat:'',x:64,y:0,w:32,h:48}],meta:{}})).id},suf);
 const id='treino_'+suf;await P.click('#novo');await P.fill('#nvNome','Treino');await W(150);await P.fill('#nvId',id);await P.click('.presets [data-p="16,12"]');await D('Criar');await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);
 await ev(()=>EDITOR.api.carregarLib());await W(1500);await ev(()=>{EDITOR.s=1.2;EDITOR.ox=10;EDITOR.oy=10});
 await ev(()=>{EDITOR.api.ativar('npcs');EDITOR.api.ferramenta('pincel')});await tap(await tela(6*32+10,5*32+10));await W(500);
 await P.fill('#npN','Boneco');await P.click('[data-npa="img"]');await ev(k=>{const s=document.querySelector('#npK');s.value=k;s.dispatchEvent(new Event('change'))},rid+'.c1');await W(200);
 await P.click('#npAn');await P.click('#npQAdd');await W(200);await P.click('#npQPick [data-qk="'+rid+'.c2"]');await P.click('[data-lq="qh"]');await W(100);
 ok(/acertado/.test(await ev(()=>document.querySelector('#npQDica').textContent)),'quadros “ao apanhar” explicados');await P.click('#npQPick [data-qk="'+rid+'.c3"]');
 await P.click('#npBo');await D('Salvar');await W(200);let bn=await ev(()=>EDITOR.m.npcs[0]);
 ok(bn.bo===1&&JSON.stringify(bn.a.q)===JSON.stringify([rid+'.c1',rid+'.c2'])&&JSON.stringify(bn.a.qh)===JSON.stringify([rid+'.c3']),'boneco de treino salvo (parado + ao apanhar): '+JSON.stringify(bn));
 await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(2500);
 const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pm=pub.mapas[id];ok(pm&&pm.npcs[0].bo===1&&pm.npcs[0].a.qh[0]===rid+'.c3'&&!!pub.imagens[rid+'.c3'],'servidor entrega o boneco e o quadro ao apanhar');
 // ---- jogo
 await A.click('#mapbtn');await W(1500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'treino');await W(2500);
 ok(await A.evaluate(()=>BON().length===1&&PVT().some(e=>e.boneco)),'jogo: o boneco entra na lista de alvos dos golpes');
 ok(await A.evaluate(()=>{p.x=6.5*32;p.y=7*32;return true})&&await W(500)===undefined&&await A.evaluate(()=>document.getElementById('npcBtn').style.display==='none'),'jogo: boneco sem falas não mostra “Falar”');
 const r1=await A.evaluate(()=>{CH.tr={};const o=BON()[0],n0=FT.length;HTP='ninjutsu';try{hitE(o,80,0,0,0)}finally{HTP=null}return{ft:FT.slice(n0).map(f=>f.t),tr:CH.tr.ninjutsu,hit:npcSt(o.boneco).hitT,vivo:!o.dead}});
 ok(r1.ft.length>=1&&typeof r1.ft[0]==='number'&&r1.tr===5&&r1.hit>0&&r1.vivo,'jogo: acertar o boneco mostra o dano, anima e treina Ninjutsu pela metade: '+JSON.stringify(r1));
 // golpe de verdade (botão 1, 2 e 3) perto do boneco
 const soma=()=>A.evaluate(()=>Object.values(CH.tr||{}).reduce((a,b)=>a+b,0));const t0=await soma();
 for(let i=0;i<3;i++){await A.evaluate(()=>{p.x=5*32;p.y=6*32-2;p.ax=1;p.ay=0;p.fl=0;p.mp=100;for(let j=0;j<cd.length;j++)cd[j]=0;useBtn(0)});await W(1400)}
 const t1=await soma();ok(t1>t0,'jogo: golpes de verdade acertam o boneco e treinam ('+t0+' → '+t1+')');
 const r2=await A.evaluate(()=>{const e={sid:999999,x:p.x,y:p.y,hp:100,max:100,rad:16};HTP='taijutsu';try{hitE(e,80,0,0,0)}finally{HTP=null}return CH.tr.taijutsu});ok(r2===10,'jogo: acertar monstro treina inteiro (Taijutsu +10): '+r2);
 const r3=await A.evaluate(()=>{CH.tr.genjutsu=trPasso(1)-1;const n0=ONL.reg.length;trGain('genjutsu',8,1);return{n:trNivel('genjutsu').n,msg:ONL.reg.slice(n0).map(r=>r.t).join('|')}});ok(r3.n===1&&/Treino de Genjutsu: nível 1 \(\+0,5% de dano\)/.test(r3.msg),'jogo: subir de nível avisa: '+r3.msg);
 const r4=await A.evaluate(()=>{let x=0;for(let n=1;n<=4;n++)x+=trPasso(n);CH.tr.ninjutsu=x;const a=trPct('ninjutsu'),b=trPct('ninjutsu',1),h1=hitRaw(100,'ninjutsu');CH.tr.ninjutsu=0;const h0=hitRaw(100,'ninjutsu');CH.tr.ninjutsu=1e9;const mx=trNivel('ninjutsu').n;return{a,b,k:+(h1/h0).toFixed(4),mx}});
 ok(r4.a===2&&r4.b===1&&r4.k===1.02&&r4.mx===20,'dano: nível 4 = +2% (PvP +1%), máximo nível 20: '+JSON.stringify(r4));
 ok(await A.evaluate(()=>/Treino por tipo de golpe/.test(trHtml())&&/Nv 20/.test(trHtml())),'aba Status mostra o treino de cada tipo');
 await A.evaluate(()=>onlSave());await W(1200);const rows=await mget('/__rows');const meu=Object.values(rows).find(r=>r.nome===adm);ok(meu&&meu.treino&&meu.treino.ninjutsu===1e9&&meu.treino.taijutsu===10,'treino salvo na conta (coluna treino): '+JSON.stringify(meu&&meu.treino));
 ok(MR.validar('xx','x',{...pm,npcs:[{id:'n1',x:1,y:1,bo:'sim',a:{t:'img',k:rid+'.c1',qh:['naoexiste']}}]},{tsz:[rid+'.c1'],fpt:{}}).npcs.map(c=>c.bo+'|'+(c.a.qh||'')).join()==='1|','regras: boneco e quadros inválidos');
 await A.screenshot({path:path.join(__dirname,'ed11_jogo.png')});
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
