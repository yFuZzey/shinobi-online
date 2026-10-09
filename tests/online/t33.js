// Entrega 7b (online): jutsus novos do Nara contra outro jogador e em monstro, passando pelo servidor:
// Kage Nui (dano + lento), Kagemane + Kubishibari (silêncio + apertos), Domínio das Sombras (preso E silenciado no mesmo golpe),
// Kageyose (puxa), lentidão em monstro (o servidor deixa o monstro lento e conta para todo mundo)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const n0=fs.readFileSync(LOG,'utf8').length;
 const A=await mk('Shika'+suf,2),B=await mk('Itachi'+suf,0);await W(800);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;window._hb=0;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;if(m.t==='hurt'&&m.by&&!m.miss&&!m.blk)_hb++;return g(m)}});
 await A.evaluate(()=>{let g=0;while(CH.lv<60&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);barSet(3,'nui');barSet(0,'kubi');barSet(2,'dominio')});
 await B.evaluate(()=>{let g=0;while(CH.lv<10&&g++<50)gainXp(xpNeed(CH.lv)-CH.xp)});
 ok(await A.evaluate(()=>JSON.stringify(BAR)===JSON.stringify(['kubi','sombra','dominio','nui'])),'Nara Nv 60 com Kubishibari, Kagemane, Domínio e Kage Nui na barra');
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+200,y)&&!blk(x+100,y)&&!blk(x+60,y))return[x,y]}return null});
 const lugar=async dx=>{await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(([s,dx])=>{p.x=s[0]+dx;p.y=s[1];p.hp=p.max;PRT=0;PSI=0;delete BUFS.lento;E=[];gsPos(true)},[spot,dx]);await W(700)};
 const solta=(i,ax)=>A.evaluate(([i,ax])=>{E=[];cd[i]=0;p.mp=p.mpMax;if(ax){p.ax=1;p.ay=0}cast(i)},[i,ax]);
 const reg=pg=>pg.evaluate(()=>ONL.reg.map(r=>r.t).join('|'));
 // Kage Nui: dano + lento (tenta de novo se B esquivar de todas)
 await lugar(110);let r=null;
 for(let k=0;k<4;k++){const h0=await B.evaluate(()=>_hb);await solta(3);await W(1500);r=await B.evaluate(h0=>({n:_hb-h0,lento:!!BUFS.lento,spd:D().spd}),h0);if(r.n)break}
 ok(r.n>=1&&r.lento,'Kage Nui acerta B pelo servidor e deixa lento ('+r.n+' agulha(s), velocidade '+r.spd+'%)');
 ok(/deixou você lento \(25%/.test(await reg(B)),'B vê no registro: "deixou você lento (25%, 1,5 s)"');
 // Kagemane prende; Kubishibari silencia e aperta
 await lugar(110);let presa=false;for(let k=0;k<4&&!presa;k++){await solta(1,1);await W(900);presa=await B.evaluate(()=>PRT>0)}
 ok(presa,'Kagemane prende B (preso pela sombra)');
 const hk=await B.evaluate(()=>_hb);await solta(0);await W(2800);
 r=await B.evaluate(hk=>({n:_hb-hk,psi:PSI,sil:ONL.reg.some(x=>/silenciou você/.test(x.t))}),hk);
 ok(r.sil&&r.n>=3,'Kubishibari: B fica silenciado e leva os apertos ('+r.n+' golpes)');
 // Domínio das Sombras: preso e silenciado no mesmo golpe
 await W(1500);await lugar(70);let dom=null;
 for(let k=0;k<4;k++){await B.evaluate(()=>{PRT=0;PSI=0});await solta(2);await W(1300);dom=await B.evaluate(()=>({prt:PRT,psi:PSI}));if(dom.prt>0&&dom.psi>0)break}
 ok(dom.prt>0&&dom.psi>0,'Domínio das Sombras: B preso ('+dom.prt.toFixed(1)+' s) e silenciado ('+dom.psi.toFixed(1)+' s) ao mesmo tempo');
 const bs=await B.evaluate(()=>{cd=[0,0,0,0];p.mp=p.mpMax;useBtn(1);const c1=cd[1];cast(0);return{c1,c0:cd[0]}});
 ok(bs.c1===0&&bs.c0>0,'B silenciado: Sharingan não liga, o golpe básico sai');
 // Kageyose: puxa B
 await W(2200);await A.evaluate(()=>barSet(0,'yose'));await lugar(200);let pux=0;
 for(let k=0;k<4&&pux<50;k++){const x0=await B.evaluate(()=>p.x);await solta(0,1);await W(1300);pux=x0-await B.evaluate(()=>p.x);if(pux<50)await lugar(200)}
 ok(pux>=50,'Kageyose puxa B na direção do Nara ('+Math.round(pux)+' px)');
 // monstro: o servidor deixa lento e conta para todo mundo
 await B.evaluate(()=>{p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;gsPos(true)}); // B longe: o jutsu tem que ir no monstro
 for(const pg of [A,B])await pg.evaluate(()=>gsJoin());await A.waitForFunction(()=>ONL.joined&&E.some(e=>!e.dead&&!e.boss),null,{timeout:10000}).catch(()=>{});await W(600);
 const alvo=await A.evaluate(()=>{const e=E.filter(e=>!e.dead&&!e.boss).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(!e)return null;p.x=e.x-90;p.y=e.y;gsPos(true);return e.sid});
 let lm=0;if(alvo!=null){for(let k=0;k<4&&!(lm>0);k++){await A.evaluate(id=>{const e=E.find(x=>x.sid===id&&!x.dead);E=e?[e]:[];if(e){p.x=e.x-80;p.y=e.y;gsPos(true)}cd[3]=0;p.mp=p.mpMax;cast(3)},alvo);await W(1100);lm=await B.evaluate(id=>{const e=E.find(x=>x.sid===id);return e?e.lento||0:-1},alvo);if(process.env.DBG)console.log('dbg',lm,JSON.stringify(await A.evaluate(id=>{const e=E.find(x=>x.sid===id);return e&&{sn:e.sn,hp:e.hp,max:e.max,d:Math.hypot(e.x-p.x,e.y-p.y)}},alvo)))}}
 ok(lm>0,'Kage Nui num monstro: o servidor deixa ele lento e os outros jogadores veem ('+(+lm).toFixed(1)+' s)');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
