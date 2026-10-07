// Entrega 7d (online): jutsus novos do Hyuga contra outro jogador, passando pelo servidor:
// Hakke Kūshō (empurra), Sōjishi (lento), 128 Palmas (sela o chakra por 4 s), Kaiten Perfeito (sela e bloqueia projéteis enquanto gira)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const n0=fs.readFileSync(LOG,'utf8').length;
 const A=await mk('Neji'+suf,1),B=await mk('Shika'+suf,2);await W(800);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;window._hb=0;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;if(m.t==='hurt'&&m.by&&!m.miss&&!m.blk)_hb++;return g(m)}});
 await A.evaluate(()=>{let g=0;while(CH.lv<60&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);barSet(0,'kusho');barSet(1,'sojishi')});await B.evaluate(()=>{let g=0;while(CH.lv<40&&g++<100)gainXp(xpNeed(CH.lv)-CH.xp);CH.st.vit=60;stats();p.hp=p.max});await W(1500);
 ok(await A.evaluate(()=>JSON.stringify(BAR)===JSON.stringify(['kusho','sojishi','h128','item'])),'Hyuga Nv 60: Kūshō, Sōjishi e as 64 Palmas já evoluídas para 128 no botão grande');
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+240,y)&&!blk(x+120,y)&&!blk(x+60,y)&&!blk(x-60,y))return[x,y]}return null});
 const lugar=async dx=>{await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(([s,dx])=>{p.x=s[0]+dx;p.y=s[1];p.hp=p.max;PSL=0;PST=0;delete BUFS.lento;E=[];gsPos(true)},[spot,dx]);await W(700)};
 const solta=i=>A.evaluate(i=>{E=[];cd[i]=0;p.mp=p.mpMax;p.ax=1;p.ay=0;cast(i)},i);
 // Kūshō: empurra
 let pux=0;for(let k=0;k<4&&pux<50;k++){await lugar(100);const x0=await B.evaluate(()=>p.x);await solta(0);await W(1000);pux=await B.evaluate(()=>p.x)-x0}
 ok(pux>=50,'Kūshō empurra B para longe ('+Math.round(pux)+' px)');
 // Sōjishi: lento
 let le=false;for(let k=0;k<4&&!le;k++){await lugar(60);await solta(1);await W(900);le=await B.evaluate(()=>!!BUFS.lento)}
 ok(le,'Sōjishi deixa B lento');
 // 128 Palmas: sela o chakra (até 4 s no PvP)
 let sl=0;for(let k=0;k<4&&!(sl>2);k++){await lugar(28);const h=await B.evaluate(()=>_hb);await solta(2);await W(1500);sl=await B.evaluate(()=>PSL);if(k===0)ok(await B.evaluate(h=>_hb-h>=6,h),'128 Palmas: B leva a sequência de golpes')}
 ok(sl>2,'128 Palmas sela o chakra de B ('+(+sl).toFixed(1)+' s)');
 // Kaiten Perfeito: bloqueia projétil enquanto gira, depois sela
 await W(400);await A.evaluate(()=>barSet(2,'kperf'));await lugar(60);await B.evaluate(()=>{PSL=0});const hA=await A.evaluate(()=>_hb);await solta(2);await W(250);
 await B.evaluate(()=>{E=[];cd[0]=0;p.mp=p.mpMax;p.ax=-1;p.ay=0;cast(0)});await W(1300);
 const ref=await A.evaluate(h=>({n:_hb-h,reg:ONL.reg.map(r=>r.t).join('|')}),hA);ok(ref.n===0&&/refletiu/.test(ref.reg),'Kaiten Perfeito girando: a shuriken de B não entra');
 let psl=await B.evaluate(()=>PSL);if(process.env.DBG)console.log('dbg',JSON.stringify(await B.evaluate(()=>({hb:_hb,reg:ONL.reg.slice(-4).map(r=>r.t),x:p.x}))),JSON.stringify(await A.evaluate(()=>({x:p.x,reg:ONL.reg.slice(-4).map(r=>r.t)}))));
 for(let k=0;k<3&&!(psl>1);k++){await lugar(60);await B.evaluate(()=>{PSL=0});await solta(2);await W(1400);psl=await B.evaluate(()=>PSL)}
 ok(psl>1,'… e no fim sela o chakra de B ('+(+psl).toFixed(1)+' s)');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
