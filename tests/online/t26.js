// Hyuga online: pose vista pelos outros, Kaiten reflete projéteis de jogador (corpo a corpo passa), 64 Palmas prende e empurra no PvP
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined&&ready,null,{timeout:20000});
  await pg.evaluate(()=>{const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)};autoOn=false});return pg};
 const A=await mk('Neji'+suf,1),B=await mk('Kiba'+suf,0);await W(600);
 const idA=await A.evaluate(()=>ONL.uid),idB=await B.evaluate(()=>ONL.uid);
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+60,y)&&!blk(x+30,y))return[x,y]}return null});
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+40;p.y=s[1];p.hp=p.max;E=[];gsPos(true)},spot);await W(700);
 ok(await B.evaluate(id=>ONL.peers[id]&&ONL.peers[id].clan==='hyuga',idA),'B vê A como Hyuga (roupa branca)');
 // Kaiten: B tenta bater enquanto A gira
 const hpA=await A.evaluate(()=>p.hp);await A.evaluate(()=>{cd[1]=0;p.mp=p.mpMax;cast(1)});await W(150);
 ok(await B.evaluate(id=>ONL.peers[id].act&&ONL.peers[id].act.a==='kaiten',idA),'B vê a pose do Kaiten de A');
 for(let i=0;i<3;i++){await B.evaluate(id=>gsSend({t:'pvp',to:id,d:30,pr:900,pj:1}),idA);await W(100)}
 await W(120);ok(await A.evaluate(()=>p.hp)===hpA&&/bloqueou com o Kaiten/.test(await B.evaluate(()=>ONL.reg.map(r=>r.t).join('|')))&&/Kaiten refletiu um projétil/.test(await A.evaluate(()=>ONL.reg.map(r=>r.t).join('|'))),'projéteis de B durante o giro: refletidos, A não perde vida');
 await B.evaluate(id=>gsSend({t:'pvp',to:id,d:30,pr:900}),idA);await W(350);const hpA2=await A.evaluate(()=>p.hp);ok(hpA2<hpA,'golpe corpo a corpo durante o giro passa (planilha: o Kaiten reflete só projéteis) ('+hpA+' → '+hpA2+')');
 await W(900);await B.evaluate(id=>gsSend({t:'pvp',to:id,d:30,pr:900,pj:1}),idA);await W(500);ok(await A.evaluate(()=>p.hp)<hpA2,'depois do giro, projétil volta a acertar A');
 // 64 Palmas em B colado
 await W(4000);const ap=await A.evaluate(()=>{p.hp=p.max;gsPos(true);return[p.x,p.y]});await B.evaluate(a=>{p.x=a[0]+24;p.y=a[1];p.hp=p.max;PST=0;gsPos(true)},ap);await W(600);
 const ax=await A.evaluate(()=>{const pe=Object.values(ONL.peers)[0];return[p.x,pe.x]});
 await B.evaluate(()=>{window._hu=0;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&m.by)_hu++;return g(m)}});
 const bx0=await B.evaluate(()=>p.x);await A.evaluate(()=>{cd[2]=0;p.mp=p.mpMax;cast(2)});await W(250);
 ok(await B.evaluate(id=>ONL.peers[id].act&&ONL.peers[id].act.a==='hakke',idA),'B vê a pose das 64 Palmas de A');await W(1100);
 const nh=await B.evaluate(()=>_hu),bx1=await B.evaluate(()=>p.x),hpB=await B.evaluate(()=>[p.hp,p.max]);
 ok(nh>=7,'B (a 1 tile) tomou '+nh+' golpes seguidos das 64 Palmas');ok(bx1-bx0>=30,'B foi empurrado '+Math.round(bx1-bx0)+' px durante a sequência');ok(hpB[0]<hpB[1],'B perdeu vida ('+Math.round(hpB[0])+'/'+hpB[1]+')');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
