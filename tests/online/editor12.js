// Música dos mapas: o editor escolhe a música (Propriedades → 🎵), o servidor entrega o mp3 (com Range) e o jogo toca em repetição só naquele mapa.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});const n0=fs.readFileSync(LOG,'utf8').length;const MR=require('../../server/mapas_regras.js');
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Mu'+suf;
 await A.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await A.click('#tabNew');await A.fill('#nu',adm);await A.fill('#np','12345678');await A.fill('#ne','t@t.com');await A.click('#goNew');
 await A.waitForFunction(()=>cur==='clan',null,{timeout:20000});await A.click('.card >> nth=0');await A.click('#go2');await A.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 await mget('/__admin?nome='+adm);await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
 ok(await A.evaluate(()=>!!document.querySelector('#cfgp #musVol')&&/50%/.test(document.querySelector('#musVolV').textContent)),'jogo: ⚙️ Configurações tem o volume da música (padrão 50%)');
 const P=await (await b.newContext({viewport:{width:412,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2})).newPage();const erros=[];P.on('pageerror',e=>{erros.push(e.message);console.log('ERRO EDITOR',e.message)});
 await P.goto(GS+'/painel/editor');await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});
 const ev=(f,a)=>P.evaluate(f,a),D=t=>P.click('#dlgB button:has-text("'+t+'")');
 await P.fill('#lgU',adm);await P.fill('#lgP','12345678');await P.click('#lgIn');await P.waitForFunction(()=>!document.querySelector('#secSrv').hidden,null,{timeout:8000});
 // ---- servidor: lista e arquivo
 const L=await (await fetch(GS+'/musicas.json')).json(),hk=L.find(x=>x.id==='hokage');ok(hk&&/Hokage/.test(hk.nome)&&hk.kb>1000&&hk.kb<2500&&/^[0-9a-f]{10}$/.test(hk.v),'servidor lista a música da sala do Hokage: '+JSON.stringify(hk));
 const r1=await fetch(GS+'/musica/hokage.mp3',{headers:{Range:'bytes=0-99'}}),b1=Buffer.from(await r1.arrayBuffer());
 ok(r1.status===206&&b1.length===100&&/^bytes 0-99\/\d+$/.test(r1.headers.get('content-range'))&&r1.headers.get('content-type')==='audio/mpeg','mp3 em partes (Range 206): '+r1.status+' '+r1.headers.get('content-range'));
 const r2=await fetch(GS+'/musica/hokage.mp3'),b2=Buffer.from(await r2.arrayBuffer());ok(r2.status===200&&b2.length===fs.statSync(path.join(__dirname,'..','..','server','musicas','hokage.mp3')).size&&b2.slice(0,100).equals(b1),'mp3 inteiro (200, '+b2.length+' bytes)');
 const r3=await fetch(GS+'/musica/hokage.mp3',{headers:{'If-None-Match':'"'+hk.v+'"'}});const r4=await fetch(GS+'/musica/nao_tem.mp3'),r5=await fetch(GS+'/musica/hokage.mp3',{headers:{Range:'bytes=99999999-'}});
 ok(r3.status===304&&r4.status===404&&r5.status===416,'cache (304), música que não existe (404) e parte fora do arquivo (416): '+[r3.status,r4.status,r5.status]);
 // ---- editor: Propriedades → música
 const id='musica_'+suf;await P.click('#novo');await P.fill('#nvNome','Sala Musica');await W(150);await P.fill('#nvId',id);await P.click('.presets [data-p="16,12"]');await D('Criar');await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);
 await P.click('[data-aba="prop"]');await P.waitForFunction(()=>[...document.querySelectorAll('#pMus option')].some(o=>o.value==='hokage'),null,{timeout:6000});
 ok(await ev(()=>/Hokage/.test(document.querySelector('#pMus option[value="hokage"]').textContent)&&document.querySelector('#pMus').value===''),'editor: a lista de músicas aparece (começa em Nenhuma)');
 await P.selectOption('#pMus','hokage');await W(300);ok(await ev(()=>EDITOR.m.mus==='hokage'&&document.querySelector('#pMus').value==='hokage'),'editor: música escolhida no mapa');
 await P.click('#pMusO');await W(1500);const ou=await ev(()=>({t:document.querySelector('#pMusO').textContent,src:EDITOR.musAudio&&EDITOR.musAudio.src,tocando:!!EDITOR.musAudio&&!EDITOR.musAudio.paused}));
 ok(ou.tocando&&/\/musica\/hokage\.mp3$/.test(ou.src)&&/Parar/.test(ou.t),'editor: ▶ Ouvir toca a música: '+JSON.stringify(ou));
 await P.click('#pMusO');await W(200);ok(await ev(()=>!EDITOR.musAudio&&/Ouvir/.test(document.querySelector('#pMusO').textContent)),'editor: ⏹ Parar');
 await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(2500);
 const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pm=pub.mapas[id];ok(pm&&pm.mus==='hokage'&&pub.musicas&&pub.musicas.hokage===hk.v,'servidor entrega o mapa com a música e a versão do arquivo');
 ok(MR.validar('xx','x',{...pm,mus:'Ruim!'},{tsz:[],fpt:{}}).mus===undefined&&MR.validar('xx','x',pm,{tsz:[],fpt:{}}).mus==='hokage','regras: id de música inválido sai do mapa');
 // ---- jogo
 const vai=async n=>{await A.click('#mapbtn');await W(1500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),n);await W(2500)};
 await vai('sala musica');const j1=await A.evaluate(()=>({id:MAPMUS.id,src:MAPMUS.a&&MAPMUS.a.src,loop:MAPMUS.a&&MAPMUS.a.loop,tocando:!!MAPMUS.a&&!MAPMUS.a.paused,vol:MAPMUS.a&&+MAPMUS.a.volume.toFixed(2),cm:CURMAP}));
 ok(j1.cm===id&&j1.id==='hokage'&&/\/musica\/hokage\.mp3\?v=/.test(j1.src)&&j1.loop&&j1.tocando&&j1.vol===.5,'jogo: entrar no mapa toca a música em repetição (volume 50%): '+JSON.stringify(j1));
 await A.evaluate(()=>{const r=document.querySelector('#musVol');r.value=0;r.dispatchEvent(new Event('input'))});await W(1500);
 const j2=await A.evaluate(()=>({p:MAPMUS.a&&MAPMUS.a.paused,t:document.querySelector('#musVolV').textContent,ls:localStorage.getItem('so-musica')}));ok(j2.p&&/Desligada/.test(j2.t)&&j2.ls==='0','jogo: volume 0 desliga e fica salvo: '+JSON.stringify(j2));
 await A.evaluate(()=>{const r=document.querySelector('#musVol');r.value=30;r.dispatchEvent(new Event('input'))});await W(1200);
 const j3=await A.evaluate(()=>({tocando:!!MAPMUS.a&&!MAPMUS.a.paused,vol:MAPMUS.a&&+MAPMUS.a.volume.toFixed(2)}));ok(j3.tocando&&j3.vol===.3,'jogo: volume 30% volta a tocar: '+JSON.stringify(j3));
 const velho=await A.evaluate(()=>{window._velho=MAPMUS.a;return true});await vai('konoha');
 const j4=await A.evaluate(()=>({id:MAPMUS.id,a:!!MAPMUS.a,velho:window._velho.paused,cm:CURMAP}));ok(j4.cm==='konoha'&&j4.id===''&&!j4.a&&j4.velho,'jogo: mapa sem música para a música antiga: '+JSON.stringify(j4));
 ok(await A.evaluate(()=>{const c=JSON.parse(localStorage.getItem(MPK)||'{}');return !!(c.musicas&&c.musicas.hokage)}),'jogo: versões das músicas guardadas junto dos mapas');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
