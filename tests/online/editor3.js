// Editor novo · Fase 3: pintura com tilesets da biblioteca (pincel, borracha, balde, retângulo/contorno), terreno e colisão,
// seleção (copiar, colar, duplicar, mover, apagar), conjuntos reutilizáveis (carimbo), camadas (criar, ordem, renomear, bloquear,
// esconder, excluir), desfazer/refazer, salvar/recarregar e o jogo desenhando as camadas na ordem certa.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Pt'+suf;
 await A.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await A.click('#tabNew');await A.fill('#nu',adm);await A.fill('#np','12345678');await A.fill('#ne','t@t.com');await A.click('#goNew');
 await A.waitForFunction(()=>cur==='clan',null,{timeout:20000});await A.click('.card >> nth=0');await A.click('#go2');await A.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 await mget('/__admin?nome='+adm);await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
 const P=await (await b.newContext({viewport:{width:412,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2})).newPage();const erros=[];P.on('pageerror',e=>{erros.push(e.message);console.log('ERRO EDITOR',e.message)});
 await P.goto(GS+'/painel/editor');await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});
 const ev=(f,a)=>P.evaluate(f,a),D=t=>P.click('#dlgB button:has-text("'+t+'")');
 const cdp=await P.context().newCDPSession(P);const toque=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:i}))});
 const arrasta=async(a,c,n=8)=>{await toque('touchStart',[a]);for(let i=1;i<=n;i++)await toque('touchMove',[[a[0]+(c[0]-a[0])*i/n,a[1]+(c[1]-a[1])*i/n]]);await toque('touchEnd',[]);await W(80)};
 const tap=async q=>{await toque('touchStart',[q]);await toque('touchEnd',[]);await W(80)};
 const tela=(x,y)=>ev(([x,y])=>{const r=document.querySelector('#cv').getBoundingClientRect();return[r.left+EDITOR.ox+x*EDITOR.s,r.top+EDITOR.oy+y*EDITOR.s]},[x,y]); // pixels do mapa -> tela
 const cel=(tx,ty)=>tela(tx*32+16,ty*32+16);
 const camd=n=>ev(n=>{const c=EDITOR.m.camadas.find(c=>c.t==='tiles'&&c.n===n);return c?c.d.map(e=>[EDITOR.m.tilesets[e[0]],e[1],e[2],e[3],e[4]]):null},n);
 await P.fill('#lgU',adm);await P.fill('#lgP','12345678');await P.click('#lgIn');await P.waitForFunction(()=>!document.querySelector('#secSrv').hidden,null,{timeout:8000});
 // dois tilesets na biblioteca: 96×64 com tiles de 32 (6 cores) e 32×16 com tiles de 16
 const COR=['220,30,30','0,200,0','0,0,220','230,230,0','230,0,230','0,220,230'];
 const ids=await ev(async([COR,suf])=>{const mk=async(w,h,t,cores)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');cores.forEach((k,i)=>{g.fillStyle='rgb('+k+')';g.fillRect((i%(w/t))*t,Math.floor(i/(w/t))*t,t,t)});return new Promise(ok=>c.toBlob(ok,'image/png'))};
   const sobe=async(b,nome,tw)=>{const sha=await Recursos.sha12(await b.arrayBuffer()),orig='originais/'+sha+'.png';await Recursos.subir(orig,b,'image/png');const im=await createImageBitmap(b);
     return (await Recursos.criar({id:'r_'+nome+'_'+suf,nome,tipo:'tileset',categoria:'Tilesets',colecao:'',original:orig,arquivo:orig,w:im.width,h:im.height,fundo:null,grade:{tw,th:tw,mg:0,sp:0},recortes:[],meta:{}})).id};
   const a=await sobe(await mk(96,64,32,COR),'cores',32),b=await sobe(await mk(32,16,16,['10,10,10','250,250,250']),'mini',16);await EDITOR.api.carregarLib();return[a,b]},[COR,suf]);
 await W(800);ok(await ev(()=>EDITOR.api.libTs().length)>=2,'tilesets da biblioteca disponíveis para pintar');
 // mapa 40×30
 const id='pint_'+suf;await P.click('#novo');await P.fill('#nvNome','Pintura');await W(150);await P.fill('#nvId',id);await P.fill('#nvW','40');await P.fill('#nvH','30');await D('Criar');
 await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(300);
 await ev(()=>{EDITOR.s=1;EDITOR.ox=-100;EDITOR.oy=-100;EDITOR.api.ajustar&&0});
 const vis=async(s,ox,oy)=>{await ev(([s,ox,oy])=>{EDITOR.s=s;EDITOR.ox=ox;EDITOR.oy=oy},[s,ox,oy]);await W(60)};
 // aba Pintura: escolher o tile verde (coluna 1, linha 0) tocando no seletor
 await P.click('[data-aba="pintura"]');await W(500);await vis(.3,12,12);
 ok(await ev(()=>!document.querySelector('#pick').hidden&&EDITOR.ativa==='chao'),'aba Pintura mostra o seletor de tiles (camada Chão)');
 await ev(id=>{EDITOR.pkId=id;document.querySelector('#pkTs').value=id;document.querySelector('#pkTs').dispatchEvent(new Event('change'))},ids[0]);await W(500);
 const pkPt=(c,r)=>ev(([c,r])=>{const cv=document.querySelector('#pkCv'),R=cv.getBoundingClientRect(),v=window.__pk||null;return null},[c,r]);
 const pick=await ev(()=>{const cv=document.querySelector('#pkCv'),R=cv.getBoundingClientRect();return{l:R.left,t:R.top,w:R.width,h:R.height}});
 // o seletor ajusta a imagem 96×64 na área: calcula o ponto do tile pela escala
 const pkTile=async(c,r)=>{const q=await ev(([c,r])=>{const cv=document.querySelector('#pkCv'),R=cv.getBoundingClientRect(),s=Math.min(R.width/96,R.height/64)*.94,ox=(R.width-96*s)/2,oy=(R.height-64*s)/2;return[R.left+ox+(c*32+16)*s,R.top+oy+(r*32+16)*s]},[c,r]);await tap(q)};
 await pkTile(1,0);let tt=await ev(()=>EDITOR.tinta.tile);
 ok(tt&&tt.c0===1&&tt.r0===0&&tt.sw===1&&await ev(()=>EDITOR.ferr==='pincel'),'tocar no seletor escolhe o tile (coluna 1, linha 0) e liga o pincel');
 await P.click('#pnX');await W(200);await vis(.3,12,12);
 // pincel: arrastar de (5,5) até (8,5)
 const a5=await cel(5,5),a8=await cel(8,5);await arrasta(a5,a8,10);let L=await camd('chao');
 ok(L.length===4&&[5,6,7,8].every(x=>L.some(e=>e[1]===x&&e[2]===5&&e[3]===1&&e[4]===0&&e[0]===ids[0])),'pincel pintou 4 tiles seguidos na camada Chão');
 // borracha
 await P.click('[data-f="borracha"]');await tap(await cel(6,5));L=await camd('chao');ok(L.length===3&&!L.some(e=>e[1]===6),'borracha tira o tile');
 // retângulo preenchido 3×2 e contorno 4×4 (tile azul: coluna 2)
 await ev(id=>EDITOR.api.escolheTile(id,2,0),ids[0]);await P.click('[data-f="ret"]');await arrasta(await cel(10,10),await cel(12,11),6);L=await camd('chao');
 ok(L.filter(e=>e[3]===2).length===6,'retângulo preenchido 3×2');
 await ev(()=>{EDITOR.contorno=true});await arrasta(await cel(20,10),await cel(23,13),6);L=await camd('chao');ok(L.filter(e=>e[3]===2&&e[1]>=20).length===12,'retângulo só contorno 4×4 (12 tiles)');
 await ev(()=>{EDITOR.contorno=false});
 // balde na camada Detalhes (vazia): enche o mapa inteiro rapidinho; desfazer/refazer
 await ev(()=>EDITOR.api.ativar('detalhes'));await ev(id=>EDITOR.api.escolheTile(id,3,0),ids[0]);await P.click('[data-f="balde"]');const t0=Date.now();await tap(await cel(3,3));const dt=Date.now()-t0;
 L=await camd('detalhes');ok(L.length===1200,'balde preencheu a camada Detalhes (40×30 = '+L.length+' tiles, '+dt+' ms)');
 await P.click('#desf');ok((await camd('detalhes')||[]).length===0,'desfazer tira o balde');await P.click('#ref');ok((await camd('detalhes')).length===1200,'refazer volta');
 await P.click('#desf');
 // tileset de 16 px numa camada nova: balde 80×60 e a grade de 16 respeitada
 await P.click('[data-aba="camadas"]');await W(200);await P.click('#cNova');await P.fill('#ncN','Telhados');await P.click('[data-nz="acima"]');await D('Criar');await W(200);
 const nova=await ev(()=>EDITOR.ativa);ok(/^c\d+$/.test(nova)&&await ev(n=>{const c=EDITOR.m.camadas.find(c=>c.n===n);return c.z==='acima'&&c.nome==='Telhados'},nova),'camada nova “Telhados” por cima do personagem, já ativa');
 await P.click('#pnX');await vis(.3,12,12);await ev(id=>EDITOR.api.escolheTile(id,1,0),ids[1]);await P.click('[data-f="pincel"]');await tap(await tela(5*32+20,7*32+4));
 L=await camd(nova);ok(L.length===1&&L[0][0]===ids[1]&&L[0][1]===Math.floor((5*32+20)/16)&&L[0][2]===Math.floor((7*32+4)/16),'tile de 16 px entra na grade de 16 (sem esticar): '+JSON.stringify(L[0]));
 // terreno: lagoa vira bloco 2×2; balde de rua
 await ev(()=>EDITOR.api.ativar('terreno'));await ev(()=>{EDITOR.tinta.terreno=3});await P.click('[data-f="pincel"]');await tap(await cel(15,15));
 ok(await ev(()=>{const m=EDITOR.m,g=(x,y)=>m.chao[y*m.W+x];return g(14,14)===3&&g(15,14)===3&&g(14,15)===3&&g(15,15)===3&&g(16,15)===0}),'terreno: lagoa pinta o bloco 2×2 (regra do jogo)');
 // colisão pintada
 await ev(()=>EDITOR.api.ativar('colisao'));await ev(()=>{EDITOR.tinta.col=1});await tap(await cel(30,20));
 ok(await ev(()=>EDITOR.m.col[20*40+30]===1&&window.MR.compilar(Modelo.paraJogo(EDITOR.m,true),Render.cat(JOGO)).M[20*40+30]==='1'),'colisão pintada à mão bloqueia a célula (mesma regra do servidor)');
 // camada bloqueada não aceita pintura; escondida também não
 await ev(()=>EDITOR.api.ativar('chao'));await P.click('[data-aba="camadas"]');await W(150);await P.click('[data-tv="chao"]');await P.click('#pnX');
 await ev(id=>EDITOR.api.escolheTile(id,0,0),ids[0]);await P.click('[data-f="pincel"]');const c0=(await camd('chao')).length;await tap(await cel(2,20));
 ok((await camd('chao')).length===c0&&/bloqueada/.test(await ev(()=>document.querySelector('#toast').textContent)),'camada bloqueada não é pintada (aviso)');
 await P.click('[data-aba="camadas"]');await W(150);await P.click('[data-tv="chao"]');await P.click('#pnX');
 // seleção: copiar e colar
 await P.click('[data-f="sel"]');await arrasta(await cel(10,10),await cel(12,11),5);
 ok(await ev(()=>JSON.stringify(EDITOR.sel))==='{"x":10,"y":10,"w":3,"h":2}'&&await ev(()=>!document.querySelector('#selBar').hidden),'seleção de área 3×2 com a barra de ações');
 await P.click('#selBar [data-s="copiar"]');await P.click('[data-f="colar"]');await tap(await cel(25,22));L=await camd('chao');
 ok(L.filter(e=>e[1]>=25&&e[1]<=27&&e[2]>=22&&e[2]<=23&&e[3]===2).length===6,'colar repete os 6 tiles no lugar tocado');
 await P.click('#selBar [data-s="parar"]');
 // duplicar
 await arrasta(await cel(10,10),await cel(12,11),5);await P.click('#selBar [data-s="dup"]');L=await camd('chao');
 ok(L.filter(e=>e[1]>=13&&e[1]<=15&&e[2]>=10&&e[2]<=11&&e[3]===2).length===6&&await ev(()=>EDITOR.sel.x===13),'duplicar põe a cópia ao lado e seleciona');
 // mover: arrastar de dentro da seleção 2 tiles para baixo
 await arrasta(await cel(14,10),await cel(14,12),6);L=await camd('chao');
 ok(L.filter(e=>e[1]>=13&&e[1]<=15&&e[2]>=12&&e[2]<=13).length===6&&!L.some(e=>e[1]>=13&&e[1]<=15&&e[2]===10),'mover: arrastar a seleção leva o conteúdo junto');
 // apagar
 await P.click('#selBar [data-s="apagar"]');L=await camd('chao');ok(!L.some(e=>e[1]>=13&&e[1]<=15&&e[2]>=12&&e[2]<=13),'apagar limpa a seleção');
 // conjunto: salvar e usar como carimbo
 await arrasta(await cel(10,10),await cel(12,11),5);await P.click('#selBar [data-s="conj"]');await P.fill('#cjNome','Bloco azul');await D('Salvar');await W(600);
 const CJ=Object.values(await mget('/__conjuntos'));ok(CJ.length===1&&CJ[0].w===3&&CJ[0].h===2&&CJ[0].dados.tiles.chao.d.length===6,'conjunto salvo no servidor (3×2, 6 tiles)');
 await P.click('#selBar [data-s="x"]');await P.click('[data-aba="pintura"]');await W(300);await P.click('[data-cj]');await P.click('#pnX');await W(100);await tap(await cel(30,5));L=await camd('chao');
 ok(L.filter(e=>e[1]>=30&&e[1]<=32&&e[2]>=5&&e[2]<=6&&e[3]===2).length===6,'carimbo do conjunto aplicado em outro lugar');
 await P.click('#selBar [data-s="parar"]');
 // ordem e nomes das camadas
 await P.click('[data-aba="camadas"]');await W(150);await P.click('[data-dn="'+nova+'"]');await W(100);await P.click('[data-dn="'+nova+'"]');await W(100);
 ok(await ev(n=>EDITOR.m.camadas.find(c=>c.n===n).z==='baixo',nova),'descer a camada de cima passa para baixo dos objetos');
 await P.click('[data-up="'+nova+'"]');await W(100);ok(await ev(n=>EDITOR.m.camadas.find(c=>c.n===n).z==='acima',nova),'subir volta para cima do personagem');
 await P.click('[data-rn="detalhes"]');await P.fill('#rcN','Flores');await D('OK');await W(100);ok(await ev(()=>EDITOR.m.camadas.find(c=>c.n==='detalhes').nome==='Flores'),'renomear camada');
 await P.click('[data-vi="'+nova+'"]');await W(100);ok(await ev(n=>EDITOR.m.ed.vis[n]===false,nova),'esconder camada');await P.click('[data-vi="'+nova+'"]');
 // salvar, recarregar a página e conferir tudo
 await P.click('#pnX');await P.click('#salvar');await W(500);const antes=await ev(()=>JSON.stringify(Modelo.paraJogo(EDITOR.m)));
 await P.reload();await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});await W(400);
 await ev(i=>{const it=[...document.querySelectorAll('#lsLocal .item')].find(x=>x.textContent.includes(i));it.querySelector('button').click()},id);await D('Abrir');await P.waitForFunction(()=>EDITOR.m,null,{timeout:8000});await W(300);
 const depois=await ev(()=>JSON.stringify(Modelo.paraJogo(EDITOR.m)));const ja=JSON.parse(antes),jd=JSON.parse(depois);
 ok(JSON.stringify(jd.camadas)===JSON.stringify(ja.camadas)&&jd.ground===ja.ground&&jd.k===ja.k&&JSON.stringify(jd.tilesets)===JSON.stringify(ja.tilesets),'salvar e recarregar: camadas, terreno, colisão e tilesets idênticos');
 // publicar e o jogo desenhar
 await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(1500);
 const row=(await mget('/__mapas'))[id];ok(row&&row.mapa.tilesets.includes(ids[0])&&row.mapa.camadas.some(c=>c.n===nova&&c.z==='acima'&&c.nome==='Telhados'),'publicado com os tilesets da biblioteca e a camada Telhados');
 await W(1500);const pub=await (await fetch(GS+'/mapas?dim=1')).json();const pm=pub.mapas[id];
 ok(pm&&pub.tilesets[ids[0]]&&pub.tilesets[ids[0]].tw===32&&pub.tilesets[ids[1]].tw===16&&pm.camadas.find(c=>c.n===nova).z==='acima','servidor entrega os tilesets da biblioteca (32 e 16 px) e a ordem das camadas');
 await A.click('#mapbtn');await W(2500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'pintura');await W(2500);
 await A.waitForFunction(()=>GC&&tlReady(),null,{timeout:8000});
 const gm=await A.evaluate(()=>{const g=GC.getContext('2d'),px=(x,y)=>[...g.getImageData(x,y,1,1).data].join();return{cur:CURMAP,verde:px(5*32+16,5*32+16),azul:px(11*32+16,10*32+16),apagado:px(6*32+16,5*32+16)}});
 ok(gm.verde==='0,200,0,255'&&gm.azul==='0,0,220,255'&&gm.apagado!=='0,200,0,255','jogo: camada Chão desenhada com as cores exatas do tileset da biblioteca');
 await A.evaluate(()=>{p.x=5*32+20;p.y=7*32+10;gsPos&&gsPos(true)});await W(1200);
 const ga=await A.evaluate(()=>GA?[...GA.getContext('2d').getImageData(5*32+20,7*32+4,1,1).data].join():null);ok(ga==='250,250,250,255','jogo: camada “Telhados” (16 px) vai para a camada de cima do personagem');
 // mudar a grade de um tileset usado avisa quais mapas são afetados
 await P.click('#abaBib');await W(1000);await P.click('#bbLista .rec:has-text("cores")');await D('Abrir');await P.waitForFunction(()=>BIB.RS.r&&BIB.RS.r.id,null,{timeout:10000});await W(300);
 await ev(()=>BIB.api.abaRc('grade',true));await P.fill('#rgTw','16');await P.press('#rgTw','Tab');await W(100);await P.click('#rcSalvar');await W(800);
 const dg=await ev(()=>document.querySelector('#dlgT').textContent+' | '+document.querySelector('#dlgC').textContent);
 ok(/Grade alterada/.test(dg)&&dg.includes(id),'mudar a grade de um tileset usado lista os mapas afetados antes de salvar');
 await D('Cancelar');await W(200);ok((await mget('/__recursos'))[ids[0]].grade.tw===32,'cancelado: a grade continua 32');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 await P.screenshot({path:path.join(__dirname,'ed3.png')});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
