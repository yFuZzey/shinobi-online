// Entrega 6b: efeitos novos no PvP e no PvE — Kagemane prende no lugar (não anda, mas usa golpes), Kagemane múltiplo divide o tempo,
// Palma queima chakra, 64 Palmas selam o chakra (sem jutsu caro), monstro preso pela sombra não anda
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const A=await mk('Shika'+suf,2),B=await mk('Neji'+suf,1),C=await mk('Hina'+suf,1);await W(800);
 const idB=await B.evaluate(()=>ONL.uid);
 for(const pg of [A,B,C])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)}});
 const reg=pg=>pg.evaluate(()=>ONL.reg.map(r=>r.t).join('|'));
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+90,y)&&!blk(x+45,y)&&!blk(x+60,y+40))return[x,y]}return null});
 const put=(pg,dx,dy)=>pg.evaluate(([s,dx,dy])=>{p.x=s[0]+dx;p.y=s[1]+dy;E=[];gsPos(true)},[spot,dx,dy]);
 await put(A,0,0);await put(B,90,0);await put(C,60,400);await W(900);
 // 1) Kagemane: a sombra cresce (aviso) e prende B no lugar
 await A.evaluate(()=>{p.ax=1;p.ay=0;p.fl=false;cd[1]=0;p.mp=p.mpMax;cast(1)});
 await W(120);const seenTel=await B.evaluate(()=>fx.some(f=>f.k==='sline'));ok(seenTel,'B vê a sombra crescendo no chão antes de ser preso (aviso)');
 await W(650);const r1=await B.evaluate(()=>({prt:PRT,reg:ONL.reg.map(r=>r.t).join('|')}));
 ok(r1.prt>1&&r1.prt<=2&&/prendeu você no lugar/.test(r1.reg),'Kagemane prende B no lugar ('+r1.prt.toFixed(2)+' s)');
 ok(await A.evaluate(()=>PRT>0),'canal: o Nara também fica parado enquanto prende');
 const x0=await B.evaluate(()=>p.x);await B.keyboard.down('ArrowRight');await W(400);await B.keyboard.up('ArrowRight');const x1=await B.evaluate(()=>p.x);
 ok(Math.abs(x1-x0)<1,'preso: B não anda ('+Math.round(x1-x0)+' px)');
 ok(await B.evaluate(()=>{cd[0]=0;p.mp=p.mpMax;cast(0);return cd[0]>0}),'preso: B ainda consegue usar golpe');
 await W(1700);ok(await B.evaluate(()=>PRT===0),'depois de 2 s B anda de novo');
 // 2) Palma queima chakra
 await put(C,95,0);await put(B,130,0);await W(700);
 await B.evaluate(()=>{window._q=[];const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&m.cc&&m.cc.k==='queima'){const a=p.mp;const r=g(m);window._q.push(a-p.mp);return r}return g(m)}});
 for(let i=0;i<4&&!(await B.evaluate(()=>_q.length));i++){await C.evaluate(()=>{E=[];p.ax=1;p.ay=0;p.fl=false;cd[0]=0;p.mp=p.mpMax;cast(0)});await W(700)}
 const q=await B.evaluate(()=>({q:_q[0],max:p.mpMax}));ok(q.q>0&&Math.abs(q.q-q.max*.02)<.5,'Palma queima 2% do chakra máximo de B ('+(q.q||0).toFixed(1)+' de '+q.max+')');
 // 3) 64 Palmas selam o chakra: sem jutsu caro (Kaiten custa 14%), golpe barato funciona
 await C.evaluate(()=>{let g=0;while(CH.lv<20&&g++<99)gainXp(xpNeed(CH.lv)-CH.xp)});await B.evaluate(()=>{let g=0;while(CH.lv<10&&g++<99)gainXp(xpNeed(CH.lv)-CH.xp)});
 await put(C,100,0);await put(B,124,0);await W(700);
 let sel=0;for(let i=0;i<3&&!sel;i++){await C.evaluate(()=>{E=[];cd[2]=0;p.mp=p.mpMax;cast(2)});await W(1600);sel=await B.evaluate(()=>PSL)}
 ok(sel>1.5&&sel<=3,'64 Palmas selam o chakra de B ('+sel.toFixed(2)+' s) em vez de atordoar');
 const r3=await B.evaluate(()=>{cd[1]=0;p.mp=p.mpMax;cast(1);const k=cd[1];cd[0]=0;cast(0);return{kaiten:k,palma:cd[0]>0,ft:FT.some(f=>f.t==='chakra selado')}});
 ok(r3.kaiten===0&&r3.ft,'selado: Kaiten (14% do chakra) não sai e aparece "chakra selado"');ok(r3.palma,'selado: golpe barato (Palma) funciona');
 // 4) Kagemane múltiplo (Nv 30): prende B; com 1 jogador preso o tempo é inteiro
 await A.evaluate(()=>{let g=0;while(CH.lv<30&&g++<99)gainXp(xpNeed(CH.lv)-CH.xp)});await put(C,0,400);await put(A,0,0);await put(B,70,0);await W(2500);
 await B.evaluate(()=>{PRT=0});await A.evaluate(()=>{PRT=0;cd[2]=0;p.mp=p.mpMax;cast(2)});await W(150);
 ok(await B.evaluate(()=>fx.some(f=>f.k==='sarea')),'B vê a sombra se espalhando no chão (aviso)');await W(800);
 const r4=await B.evaluate(()=>PRT);ok(r4>.4&&r4<=1.5,'Kagemane múltiplo prende B ('+r4.toFixed(2)+' s restantes; é o 2º prender em 15 s: vale 75% pelo retorno decrescente)');
 // 5) PvE: monstro preso pela sombra não anda (o servidor segura)
 for(const pg of [A,B,C])await pg.evaluate(()=>{p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;gsPos(true)}); // os outros vão para a zona segura
 const Dn=await mk('Temari'+suf,2);await W(1500);await Dn.evaluate(()=>{autoOn=false;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)}});const A2=Dn;await A2.evaluate(()=>{let g=0;while(CH.lv<30&&g++<99)gainXp(xpNeed(CH.lv)-CH.xp)}); // precisão alta: o monstro não esquiva
 const mob=await A2.evaluate(()=>{const e=E.filter(e=>!e.dead&&e.kind==='mob').sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(!e)return null;p.x=e.x-80;p.y=e.y;p.ax=1;p.ay=0;p.fl=false;gsPos(true);return e.sid});
 if(mob!=null){let m1=null,m2=null;
  for(let k=0;k<3&&!(m1&&m1.root>0);k++){await A2.evaluate(id=>{const e=E.find(e=>e.sid===id);if(e){p.x=e.x-70;p.y=e.y;gsPos(true)}},mob);await W(250);
   await A2.evaluate(id=>{const e=E.find(e=>e.sid===id);if(e){const d=Math.hypot(e.x-p.x,e.y-p.y)||1;p.ax=(e.x-p.x)/d;p.ay=(e.y-p.y)/d}PRT=0;cd[1]=0;p.mp=p.mpMax;cast(1)},mob);await W(900);
   m1=await A2.evaluate(id=>{const e=E.find(e=>e.sid===id);return e&&{root:e.root,x:e.x,y:e.y}},mob)}
  await W(600);m2=await A2.evaluate(id=>{const e=E.find(e=>e.sid===id);return e&&{root:e.root,x:e.x,y:e.y}},mob);
  ok(m1&&m1.root>0&&m2&&Math.hypot(m2.x-m1.x,m2.y-m1.y)<3,'monstro preso pela sombra (servidor): não anda ('+(m1&&m1.root.toFixed(2))+' s)')}
 else ok(false,'achar um monstro na Vila da Areia para o teste');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
