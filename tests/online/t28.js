// online: Mangekyō (botão do meio) e Susanoo (Nv 60) vistos pelo outro jogador; olhar prende no PvP; Susanoo reduz dano no PvP;
// desligar a Mangekyō desfaz o Susanoo também na tela dos outros
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const A=await mk('Obito'+suf,0),B=await mk('Shisui'+suf,0);await W(800);
 const ida=await A.evaluate(()=>ONL.uid),idb=await B.evaluate(()=>ONL.uid);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)};let n=0;while(CH.lv<60&&n++<200)gainXp(xpNeed(CH.lv)-CH.xp)});
 await A.evaluate(()=>{CH.mgk='sasuke';chSave();skBtns()});await B.evaluate(()=>{CH.mgk='itachi';chSave();skBtns()});await W(300);
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+70,y)&&!blk(x+35,y))return[x,y]}return null});
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+60;p.y=s[1];p.fl=true;p.ax=-1;p.ay=0;p.hp=p.max;E=[];gsPos(true)},spot);await W(900);
 // dano de referência (sem Susanoo)
 const hit=async()=>{await A.evaluate(id=>gsSend({t:'pvp',to:id,d:40,pr:999}),idb);const m=await B.waitForFunction(()=>window._lh,null,{timeout:4000}).then(h=>h.jsonValue()).catch(()=>null);await B.evaluate(()=>{window._lh=null;p.hp=p.max});return m};
 await B.evaluate(()=>{const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&m.by)window._lh={d:m.d,miss:m.miss};return g(m)}});
 let d0=null;for(let i=0;i<6&&!(d0&&!d0.miss);i++)d0=await hit();
 // B liga a Mangekyō de frente para A: olhar em cone prende A; A vê o olho de B aceso
 await A.evaluate(()=>{PST=0;window._pst=0;const g=gsMsg;gsMsg=function(m){if(m.t==='pstun')window._pst=m.st;return g(m)}});
 await B.evaluate(()=>{cd[1]=0;p.mp=p.mpMax;useBtn(1)});await W(900);
 const eb=await B.evaluate(()=>EYE.on);const ea=await A.evaluate(id=>({ey:ONL.peers[id]&&ONL.peers[id].ey,pst:window._pst,reg:ONL.reg.map(r=>r.t).join('|')}),idb);
 ok(eb==='mgk'&&ea.ey===2,'A vê a Mangekyō de B ligada (olho aceso)');
 ok(ea.pst>0&&ea.pst<=1.5&&/prendeu você com o olhar/.test(ea.reg),'o olhar da Mangekyō prende A no PvP ('+ea.pst+' s, no máx. 1,5 s)');
 await A.screenshot({path:__dirname+'/mgk_peer.png'});
 // Susanoo de Itachi (Nv 60, Mangekyō ligada)
 await W(1600);await B.evaluate(()=>{cd[2]=0;p.mp=p.mpMax;useBtn(2)});await W(900);
 const seen=await A.evaluate(id=>{const f=fx.find(f=>f.sus&&f.pid===id);const L=[];susL(L);return{f:!!f,q:f&&f.q,L:L.length}},idb);
 ok(await B.evaluate(()=>susOn()),'B invoca o Susanoo (Nv 60 com a Mangekyō ligada)');
 ok(seen.f&&seen.q==='sus_itachi'&&seen.L>=1,'A vê o Susanoo de Itachi de B');
 await A.screenshot({path:__dirname+'/sus_peer.png'});
 let d1=null;for(let i=0;i<6&&!(d1&&!d1.miss);i++)d1=await hit();
 ok(d0&&d1&&d1.d<=Math.ceil(d0.d*.5)+1,'PvP: com o Susanoo de Itachi o golpe de A tira bem menos de B ('+(d0&&d0.d)+' → '+(d1&&d1.d)+')');
 // B desliga a Mangekyō: o Susanoo some também na tela de A
 await B.evaluate(()=>useBtn(1));await W(900);
 const gone=await A.evaluate(id=>{const L=[];susL(L);return{ey:ONL.peers[id].ey,L:L.length,f:fx.some(f=>f.sus&&f.pid===id&&!f.dead)}},idb);
 ok(gone.ey===0&&gone.L===0,'B desliga a Mangekyō: olho apaga e o Susanoo some na tela de A');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
