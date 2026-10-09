// Byakugan: o Hyuga continua o mesmo boneco (sem virar o boneco genérico com aura) e ganha o brilho azul nos olhos,
// visto por ele e pelos outros jogadores (como o brilho vermelho do Sharingan)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const H=await mk('Byak'+suf,1),U=await mk('Olha'+suf,0);
 const spot=await U.evaluate(()=>[SPAWN[0]*T+5*T,SPAWN[1]*T]);
 await H.evaluate(s=>{let g=0;while(CH.lv<5&&g++<50)gainXp(xpNeed(CH.lv)-CH.xp);p.x=s[0];p.y=s[1];gsPos(true);$('#lvup').hidden=true;$('#toast').hidden=true},spot);
 await U.evaluate(s=>{p.x=s[0]+70;p.y=s[1];gsPos(true);$('#lvup').hidden=true},spot);await W(800);
 // espiona: quais quadros do boneco vão para a tela e quais brilhos de olho são desenhados
 const spy=pg=>pg.evaluate(()=>{window._ey=[];const e0=eyeDraw;eyeDraw=function(o,lv){_ey.push(lv);return e0(o,lv)};window._fr={aura:0,hy:0};const AU=new Set(HERO.aura.concat(HERO.arun)),HY=new Set(HERO.hya.concat(HERO.hyr));
  const di=ctx.drawImage;ctx.drawImage=function(im){if(AU.has(im))_fr.aura++;if(HY.has(im))_fr.hy++;return di.apply(this,arguments)}});
 await spy(H);await spy(U);
 const on=await H.evaluate(()=>{barSet(3,'byak');p.mp=p.mpMax;cd=[0,0,0,0];useBtn(3);return{on:BYK.on,au:p.au,ey:onlMeta().ey}});
 await W(900);
 const h=await H.evaluate(()=>({au:p.au,fr:_fr,ey:_ey.filter(l=>l===3).length,red:_ey.filter(l=>l!==3).length}));
 ok(on.on&&on.au<0&&on.ey===3,'Byakugan ligado sem pose de aura (au '+on.au+', olho '+on.ey+')');
 ok(h.fr.aura===0&&h.fr.hy>10,'o Hyuga continua o mesmo boneco (quadros do Hyuga '+h.fr.hy+', do boneco genérico com aura '+h.fr.aura+')');
 ok(h.ey>10&&h.red===0,'brilho azul nos olhos na própria tela ('+h.ey+' quadros)');
 const hid=await H.evaluate(()=>ONL.uid);
 const u=await U.evaluate(id=>({ey:ONL.peers[id]&&ONL.peers[id].ey,fr:_fr,az:_ey.filter(l=>l===3).length}),hid);
 ok(u.ey===3&&u.az>10&&u.fr.aura===0,'o outro jogador vê o brilho azul nos olhos do Hyuga (olho '+u.ey+', '+u.az+' quadros) e o mesmo boneco');
 // cor: os pixels em volta da cabeça ficam azulados
 const px=await H.evaluate(()=>{const cs=[],ac=CanvasGradient.prototype.addColorStop;CanvasGradient.prototype.addColorStop=function(o,c){cs.push(c);return ac.call(this,o,c)};
  try{eyeDraw({x:p.x,y:p.y,fl:0,mv:0},3)}finally{CanvasGradient.prototype.addColorStop=ac}const m=/rgba\((\d+),(\d+),(\d+)/.exec(cs[1]||'');return m?[+m[1],+m[2],+m[3]]:[0,0,0]});
 ok(px[2]>200&&px[2]>px[0],'a cor do brilho é azul (rgb '+px+')');
 await H.screenshot({path:path.join(__dirname,'byakugan.png'),clip:{x:330,y:110,width:240,height:170}});
 await H.evaluate(()=>{jx=1;jy=0});await W(230);await H.screenshot({path:path.join(__dirname,'byakugan_corre.png'),clip:{x:330,y:110,width:240,height:170}});await H.evaluate(()=>{jx=0});await W(200);
 // desligar apaga o brilho nos dois lados
 await H.evaluate(()=>useBtn(3));await W(900);
 const off=await U.evaluate(id=>ONL.peers[id].ey,hid);const offH=await H.evaluate(()=>{_ey=[];const L=[];eyeL(L);return{on:BYK.on,n:L.length}});
 ok(off===0&&!offH.on&&offH.n===0,'desligando, o brilho some (olho '+off+')');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
