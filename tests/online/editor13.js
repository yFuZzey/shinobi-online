// Boneco de treino: o corpo todo recebe os golpes (não só a base), e todo tipo de golpe acerta (projétil, área, linha, cone, perto, puxão, agulhas, Kubishibari)
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
 const pub=await (await fetch(GS+'/mapas?dim=1')).json();ok(!!pub.mapas[id],'mapa com o boneco publicado');
 // ---- jogo: um personagem de cada clã; boneco com o dobro do tamanho (96 px de altura)
 const mk=async(n,ci)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO JOGO',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+ci);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
  await mget('/__admin?nome='+n);await pg.evaluate(()=>ONL.ws.close());await pg.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
  await pg.click('#mapbtn');await W(1500);await pg.evaluate(()=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes('treino')).click());await W(2500);
  await pg.evaluate(()=>{autoOn=false;let n=0;while(CH.lv<60&&n++<300)gainXp(xpNeed(CH.lv)-CH.xp);MAPEV.npcs[0].a.e=2;window._bh=0;window._ft=[];const h=bonecoHit;bonecoHit=function(e){window._bh++;const n0=FT.length,r=h.apply(this,arguments);window._ft.push(...FT.slice(n0).map(f=>f.y));return r}});return pg};
 const POS={lado:[-30,0],corpo:[-30,-.5],cabeca:[-30,-.85],baixo:[0,40],longe:[-30,-1.8]};
 const golpe=(G,id,pos,olho)=>G.evaluate(([id,dx,dy,olho])=>{const s=JU[clan][id],sl=s.papel==='ult'?2:0;if(EYE.on)eyeOff();if(!barSet(sl,id))return -1;const o=BON()[0],h=o.bPe-o.bTop;if(dy<0&&dy>-3)dy=dy*h;
   p.x=o.x+dx;p.y=o.bPe+dy;p.ax=dx<0?1:0;p.ay=dx<0?0:-1;p.mp=p.mpMax||100;p.hp=p.max;for(let j=0;j<cd.length;j++)cd[j]=0;for(const k in JCD)JCD[k]=0;TGT=null;window._bh=0;
   if(olho){CH.mgk='itachi';useBtn(1)}useBtn(sl);return 0},[id,POS[pos][0],POS[pos][1],olho]).then(async r=>{if(r<0)return 'sem barra';await W(1500);return G.evaluate(()=>window._bh)});
 const altura=async G=>G.evaluate(()=>{const o=BON()[0];return [o.bPe-o.bTop,o.rad]});
 const clas=[[0,['katon','goka','genj'],['amat']],[1,['palma','kaiten','hakke','kusho'],[]],[2,['shuri','sombra','nui','yose'],[]]];
 for(const [ci,L,LM] of clas){const G=await mk('Bo'+ci+suf,ci),cl=await G.evaluate(()=>clan);
  if(ci===0){const a=await altura(G);ok(a[0]===96&&a[1]===16,'boneco de 96 px de altura (corpo inteiro conta): '+JSON.stringify(a))}
  for(const id of L){const r={};for(const pos of ['lado','corpo','cabeca','baixo'])r[pos]=await golpe(G,id,pos);ok(Object.values(r).every(n=>n>0),cl+' · '+id+' acerta o boneco ao lado da base, do meio, da cabeça e de baixo: '+JSON.stringify(r))}
  for(const id of LM){const r={};for(const pos of ['lado','cabeca'])r[pos]=await golpe(G,id,pos,1);ok(Object.values(r).every(n=>n>0),cl+' · '+id+' (Mangekyō) acerta o boneco: '+JSON.stringify(r))}
  if(ci===1){const n=await golpe(G,'palma','longe');ok(n===0,'longe do corpo (bem acima da cabeça) a Palma não acerta: '+n)}
  if(ci===2){await golpe(G,'sombra','corpo');const n=await G.evaluate(()=>{barSet(0,'kubi');for(let j=0;j<cd.length;j++)cd[j]=0;for(const k in JCD)JCD[k]=0;p.mp=p.mpMax||100;window._bh=0;useBtn(0);return 0}).then(()=>W(1500)).then(()=>G.evaluate(()=>window._bh));
   ok(n>0,'Kubishibari pega o boneco preso no Kagemane: '+n)}
  if(ci===0){const f=await G.evaluate(()=>{const o=BON()[0];return {ft:window._ft.slice(-3),top:o.bTop}});ok(f.ft.length&&f.ft.every(y=>y<=f.top),'número do dano aparece em cima da cabeça do boneco: '+JSON.stringify(f))}
  await G.context().close()}
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
