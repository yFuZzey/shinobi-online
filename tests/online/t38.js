// Entrega 10 (planilha 12): PvP × PvE — crítico ×1,5 em monstro e ×1,3 em jogador; no PvP o bônus de % de dano dos itens vale no
// máximo 20% (Manto da Raposa: +100% no PvE); no PvP aberto quem tem nível maior bate no máximo 10% a mais do que alguém do nível do alvo
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const n0=fs.readFileSync(LOG,'utf8').length;
 const A=await mk('Alto'+suf,0),B=await mk('Baixo'+suf,1);await W(900);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;window._in=[];const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;if(m.t==='hurt'&&m.by)_in.push(m);return g(m)}});
 const lv=(pg,v)=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);stats();p.hp=p.max;gsMeta()},v);
 await lv(B,20);await lv(A,20);await W(500);const bid=await B.evaluate(()=>ONL.uid);
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+50,y))return[x,y]}return null});
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+50;p.y=s[1];E=[];gsPos(true)},spot);await W(800);
 const golpe=async o=>{for(let k=0;k<6;k++){const n=await B.evaluate(()=>{p.hp=p.max;return _in.length});await A.evaluate(([id,o])=>gsSend(Object.assign({t:'pvp',to:id,d:100,c:0,pr:999},o)),[bid,o]);
   for(let j=0;j<20;j++){await W(50);const r=await B.evaluate(n=>_in.slice(n),n);if(r.length){const m=r[r.length-1];if(!m.miss)return m;break}}await W(200)}return null};
 // diferença de nível
 const igual=await golpe({j:'katon'});await lv(A,22);await W(400);const pouco=await golpe({j:'katon'});await lv(A,60);await W(400);const muito=await golpe({j:'katon'});
 const esp=Math.round(100*.6*Math.min(1,1.1*(1+.075*20)/(1+.075*60)));
 ok(igual&&igual.d===60,'Nv 20 contra Nv 20: dano normal do PvP ('+(igual&&igual.d)+')');
 ok(pouco&&pouco.d===60,'Nv 22 contra Nv 20: até 10% a mais não muda nada ('+(pouco&&pouco.d)+')');
 ok(muito&&muito.d===esp,'Nv 60 contra Nv 20: o servidor segura o dano ('+(muito&&muito.d)+'; esperado '+esp+')');
 // crítico por modo (mesmo golpe, crítico forçado); A com INT e SOR para ter poder e chance de crítico
 await A.evaluate(()=>{CH.st.int=60;CH.st.luk=20;stats()});
 const cr=await A.evaluate(id=>{const L=[];const s0=gsSend,r0=Math.random;gsSend=m=>{L.push(m);return true};Math.random=()=>0;
  try{HTP='ninjutsu#katon';const e={sid:'x',dead:0,x:p.x+40,y:p.y,rad:18};gsHit(e,16,0,0,0);pvpHit(ONL.peers[id]._pv||PVT().find(o=>o.pvp===id),16,0,0,0)}finally{HTP=null;gsSend=s0;Math.random=r0}
  return{mob:L.find(m=>m.t==='hit'),pvp:L.find(m=>m.t==='pvp'),raw:hitRaw(16,'ninjutsu#katon'),rawp:hitRawPvp(16,'ninjutsu#katon'),pve:critPve(),pv:critPvp()}},bid);
 ok(cr.pve===1.5&&cr.pv===1.3,'crítico: ×1,5 em monstro e ×1,3 em jogador');
 ok(cr.mob&&cr.mob.d===Math.round(cr.raw*1.5)&&cr.mob.c===1,'golpe crítico em monstro: '+(cr.mob&&cr.mob.d)+' (= '+cr.raw.toFixed(1)+' × 1,5)');
 ok(cr.pvp&&cr.pvp.d===Math.round(cr.rawp*1.3)&&cr.pvp.c===1,'golpe crítico em jogador: '+(cr.pvp&&cr.pvp.d)+' (= '+cr.rawp.toFixed(1)+' × 1,3)');
 // Manto da Raposa: +100% de dano no PvE; no PvP no máximo +20%
 const mt=await A.evaluate(()=>{AG.dmg_pct=100;const pve=hitRaw(16,'ninjutsu#katon'),pvp=hitRawPvp(16,'ninjutsu#katon');AG.dmg_pct=20;const ref=hitRaw(16,'ninjutsu#katon');AG.dmg_pct=0;const zero=hitRaw(16,'ninjutsu#katon');agg&&agg();return{pve,pvp,ref,zero}});
 ok(mt.pve>mt.pvp&&Math.abs(mt.pvp-mt.ref)<.01,'item de +100% de dano: PvE '+mt.pve.toFixed(1)+' · PvP '+mt.pvp.toFixed(1)+' (= com +20%) · sem item '+mt.zero.toFixed(1));
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
