// Entrega 9 (planilha 07): naturezas no PvP, decididas pelo servidor a partir do catálogo (o app só diz qual jutsu acertou)
// Fūton fraco contra Katon (×0,85); Katon (jutsu, não o básico) queima 3% da vida em 3 s; Raiton (Chidori) paralisa 0,3 s;
// Yin faz o controle durar 10% a mais; efeito no máximo 1 vez a cada 4 s; jutsu que não é do clã de quem bate não tem natureza
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const n0=fs.readFileSync(LOG,'utf8').length;
 const B=await mk('Alvo'+suf,0),U=await mk('Fogo'+suf,0),H=await mk('Vento'+suf,1),N=await mk('Sombra'+suf,2);await W(900);
 for(const pg of [B,U,H,N])await pg.evaluate(()=>{autoOn=false;window._in=[];const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;if(m.t==='hurt'&&m.by){m._t=performance.now()/1000;_in.push(m)}return g(m)}});
 await B.evaluate(()=>{let g=0;while(CH.lv<40&&g++<100)gainXp(xpNeed(CH.lv)-CH.xp);stats();p.hp=p.max});
 const bid=await B.evaluate(()=>ONL.uid);
 const spot=await B.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+50,y)&&!blk(x-50,y)&&!blk(x,y+40))return[x,y]}return null});
 await B.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);
 for(const [pg,dx,dy] of [[U,50,0],[H,-50,0],[N,0,40]])await pg.evaluate(([s,dx,dy])=>{p.x=s[0]+dx;p.y=s[1]+dy;E=[];gsPos(true)},[spot,dx,dy]);await W(900);
 const golpe=async(A,o)=>{for(let k=0;k<6;k++){const n=await B.evaluate(()=>{p.hp=p.max;return _in.length});await A.evaluate(([id,o])=>gsSend(Object.assign({t:'pvp',to:id,d:100,c:0,pr:999},o)),[bid,o]);
   for(let j=0;j<20;j++){await W(50);const r=await B.evaluate(n=>_in.slice(n).filter(m=>!m.qm),n);if(r.length){const m=r[r.length-1];if(!m.miss)return m;break}}await W(200)}return null};
 // Fūton (Kūshō) contra Katon (Uchiha): fraco
 const neu=await golpe(H,{j:'palma'}),fra=await golpe(H,{j:'kusho'});
 ok(neu&&fra&&neu.d===60&&fra.d===51&&fra.nm===.85,'Fūton contra Katon: '+(neu&&neu.d)+' (Yang, neutro) → '+(fra&&fra.d)+' de dano (×0,85)');
 // Katon: o básico não queima; o jutsu queima 3% da vida em 3 s
 const bas=await golpe(U,{j:'katon'});ok(bas&&!bas.ef,'Bola de Fogo (golpe básico Katon): sem queimadura');
 const q0=await B.evaluate(()=>_in.length),max=await B.evaluate(()=>p.max);const gk=await golpe(U,{j:'goka'});await W(3400);
 const qs=await B.evaluate(n=>_in.slice(n).filter(m=>m.qm).map(m=>m.d),q0);
 ok(gk&&gk.ef==='queima'&&qs.length===3&&qs.every(d=>d===Math.max(1,Math.round(max*.01))),'Gōkakyū forte queima: 3 toques de '+qs.join(', ')+' (1% de '+max+' de vida)');
 const gk2=await golpe(U,{j:'goka'});ok(gk2&&!gk2.ef,'… e não queima de novo antes de 4 s');
 // jutsu que não é do clã: sem natureza (o servidor não acredita no app)
 const fal=await golpe(H,{j:'goka'});ok(fal&&!fal.ef&&!fal.nm,'Hyuga dizendo "Gōkakyū": o servidor não acha no catálogo do Hyuga e não dá natureza');
 // Raiton (Chidori, item da mão): paralisa 0,3 s
 await U.evaluate(()=>{EQ.mao='chidori';gsMeta()});await W(500);const ch=await golpe(U,{j:'item'});ok(ch&&ch.ef==='para'&&ch.st>=.29,'Chidori (Raiton) paralisa '+(ch&&ch.st)+' s');
 // Yin: Possessão (prende 1,5 s) dura 10% a mais
 const yn=await golpe(N,{j:'poss',cc:{k:'root',t:1.5}});ok(yn&&yn.cc&&Math.abs(yn.cc.t-1.65)<.02,'Yin: Possessão prende '+(yn&&yn.cc&&yn.cc.t)+' s (1,5 × 1,1)');
 // o registro de B conta a queimadura
 ok(await B.evaluate(()=>ONL.reg.some(r=>/pôs fogo em você/.test(r.t))),'B vê no registro que está queimando');
 // aba Jutsus mostra a natureza
 await U.evaluate(()=>{let g=0;while(CH.lv<20&&g++<50)gainXp(xpNeed(CH.lv)-CH.xp);toggleBag(true,'ju');juSel='goka';juDraw()});await W(250);
 ok(/Natureza Katon \(forte contra Fūton, fraco contra Suiton\)/.test(await U.evaluate(()=>$('#paneJu .jdet').textContent)),'aba Jutsus mostra a natureza do jutsu e contra quem é forte/fraco');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
