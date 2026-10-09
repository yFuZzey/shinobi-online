// Entrega 7c (online): jutsus novos do Uchiha contra outro jogador e em monstro, passando pelo servidor:
// Genjutsu: Sharingan (controles invertidos até levar dano), Tsukuyomi (atordoa de frente; de costas não), Amaterasu (queima por segundo),
// Gōryūka (área avisada), confusão em monstro (o servidor faz ele esquecer o alvo e todo mundo vê)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const n0=fs.readFileSync(LOG,'utf8').length;
 const A=await mk('Sasu'+suf,0),B=await mk('Hina'+suf,1);await W(800);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;window._hb=0;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;if(m.t==='hurt'&&m.by&&!m.miss&&!m.blk)_hb++;return g(m)}});
 await A.evaluate(()=>{let g=0;while(CH.lv<60&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);CH.mgk='itachi';chSave();barSet(0,'genj');barSet(3,'tsuku')});
 ok(await A.evaluate(()=>JSON.stringify(BAR)===JSON.stringify(['genj','olho','sus','tsuku'])),'Uchiha Nv 60 com Genjutsu, Mangekyō, Susanoo e Tsukuyomi na barra');
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+200,y)&&!blk(x+100,y)&&!blk(x+60,y)&&!blk(x+40,y))return[x,y]}return null});
 // B fica a "dx" à direita de A; costas=1: B olhando para a direita (de costas para A)
 const lugar=async(dx,costas)=>{await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(([s,dx,c])=>{p.x=s[0]+dx;p.y=s[1];p.hp=p.max;PCF=0;PST=0;E=[];p.fl=!c;p.ax=c?1:-1;gsPos(true)},[spot,dx,costas]);await W(700)};
 const solta=i=>A.evaluate(i=>{E=[];cd[i]=0;p.mp=p.mpMax;if(EYE.on!=='mgk'&&CLANS[clan].sk[i].mgk){cd[1]=0;useBtn(1)}cast(i)},i);
 // Genjutsu: Sharingan
 await lugar(100,0);let cf=0;for(let k=0;k<4&&!(cf>0);k++){await solta(0);await W(700);cf=await B.evaluate(()=>PCF)}
 ok(cf>0,'Genjutsu: B fica confuso ('+(+cf).toFixed(1)+' s)');ok(/prendeu você num genjutsu/.test(await B.evaluate(()=>ONL.reg.map(r=>r.t).join('|'))),'B vê no registro que caiu num genjutsu');
 const mv=await B.evaluate(async()=>{const x0=p.x;jx=1;await new Promise(r=>setTimeout(r,250));jx=0;return p.x-x0});ok(mv<-5,'confuso: empurra o controle para a direita e anda para a esquerda ('+Math.round(mv)+' px)');
 await A.evaluate(()=>{E=[];cd[0]=0;CLANS[clan].sk[0]=JU.uchiha.katon;cast(0)});await W(900);await A.evaluate(()=>barApply());
 ok(await B.evaluate(()=>PCF===0),'levou dano: a confusão passa');
 // Tsukuyomi: de frente atordoa; de costas não
 await W(400);await lugar(100,0);let st=0;for(let k=0;k<4&&!(st>0);k++){await solta(3);await W(1150);st=await B.evaluate(()=>PST)}
 ok(st>0,'Tsukuyomi em B virado para A: atordoa ('+(+st).toFixed(1)+' s; no PvP o servidor limita em 1,5 s)');
 await W(1200);await lugar(150,1);const h1=await B.evaluate(()=>_hb);let st2=null;for(let k=0;k<3;k++){await solta(3);await W(1150);st2=await B.evaluate(()=>PST);if(await B.evaluate(h=>_hb>h,h1))break}
 ok(await B.evaluate(h=>_hb>h,h1)&&st2===0,'B de costas: leva o dano mas não é atordoado');ok(/estava de costas/.test(await A.evaluate(()=>ONL.reg.map(r=>r.t).join('|'))),'A vê: "estava de costas e não foi pego"');
 // Amaterasu: golpe + queimas por segundo
 await A.evaluate(()=>barSet(3,'amat'));await lugar(100,0);const h2=await B.evaluate(()=>_hb);await solta(3);await W(4200);
 const nA=await B.evaluate(h=>_hb-h,h2);ok(nA>=3,'Amaterasu: B leva o golpe e as queimas ('+nA+' em 4 s)');
 // Gōryūka: área avisada
 await A.evaluate(()=>barSet(3,'goryuka'));await lugar(110,0);const h3=await B.evaluate(()=>_hb);let av=false;
 for(let k=0;k<3;k++){await solta(3);await W(250);av=av||await B.evaluate(()=>fx.some(f=>f.k==='aviso'&&f.rm));await W(700);if(await B.evaluate(h=>_hb>h,h3))break}
 ok(av,'B vê o aviso no chão antes do Gōryūka cair');ok(await B.evaluate(h=>_hb>h,h3),'Gōryūka acerta B');
 // monstro: confusão pelo servidor
 await B.evaluate(()=>{p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;gsPos(true)}); // B longe: o jutsu tem que ir no monstro
 for(const pg of [A,B])await pg.evaluate(()=>gsJoin());await A.waitForFunction(()=>ONL.joined&&E.some(e=>!e.dead&&!e.boss),null,{timeout:10000}).catch(()=>{});await W(600);
 await A.evaluate(()=>barSet(0,'genj'));
 const alvo=await A.evaluate(()=>{const e=E.filter(e=>!e.dead&&!e.boss).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(!e)return null;p.x=e.x-90;p.y=e.y;gsPos(true);return e.sid});
 let cm=0;if(alvo!=null){for(let k=0;k<6&&!(cm>0);k++){await A.evaluate(id=>{const e=E.find(x=>x.sid===id&&!x.dead);E=e?[e]:[];if(e){p.x=e.x-80;p.y=e.y;gsPos(true)}cd[0]=0;p.mp=p.mpMax;cast(0)},alvo);await W(900);cm=await B.evaluate(id=>{const e=E.find(x=>x.sid===id);return e?e.conf||0:-1},alvo);if(process.env.DBG)console.log('dbg',cm,JSON.stringify(await A.evaluate(id=>{const e=E.find(x=>x.sid===id);return e&&{sn:e.sn,d:Math.hypot(e.x-p.x,e.y-p.y),cd:cd[0],bar:BAR,reg:ONL.reg.slice(-3).map(r=>r.t)}},alvo)))}}
 ok(cm>0,'Genjutsu num monstro: o servidor deixa ele confuso e os outros veem ('+(+cm).toFixed(1)+' s)');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
