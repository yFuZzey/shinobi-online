// online: Bola de Fogo vista pelo outro jogador (pose + bola + explosão), PvP com a bola, botão do item
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const A=await mk('Itachi'+suf,0),B=await mk('Neji'+suf,1);await W(800);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)}});
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+130,y)&&!blk(x+65,y))return[x,y]}return null});
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+130;p.y=s[1];p.hp=p.max;E=[];gsPos(true)},spot);await W(800);
 await B.evaluate(()=>{window._fb=0;const f0=fireBoom;fireBoom=function(b){_fb++;return f0(b)};window._seen={act:0,ball:0};const f=()=>{for(const id in ONL.peers){const q=ONL.peers[id];if(q.act&&q.act.a==='fogo')_seen.act=1}if(P.some(b=>b.rm&&b.fire))_seen.ball=1;if(!window._stop)requestAnimationFrame(f)};requestAnimationFrame(f)});
 const hp0=await B.evaluate(()=>p.hp);await A.evaluate(()=>{E=[];cd[0]=0;p.mp=p.mpMax;cast(0)});await W(250);await B.screenshot({path:__dirname+'/fogo_b.png'});await W(900);
 let r=await B.evaluate(()=>({...window._seen,fb:_fb,hp:p.hp,left:P.filter(b=>b.rm&&b.fire).length}));
 // esquiva base de 5%: se B esquivou, tenta de novo (até 4x) — o que se testa é o dano chegar, não a sorte
 for(let k=0;k<4&&r.hp>=hp0&&await B.evaluate(()=>ONL.reg.some(x=>/Você esquivou/.test(x.t)));k++){await A.evaluate(()=>{cd[0]=0;p.mp=p.mpMax;cast(0)});await W(1200);r={...r,hp:await B.evaluate(()=>p.hp)}}
 ok(r.act,'B vê A fazendo a pose do selo');ok(r.ball,'B vê a bola de fogo voando');ok(r.fb>=1&&!r.left,'a bola explode na tela de B quando chega nele');
 ok(r.hp<hp0&&/Você recebeu \d+ de dano \(Itachi/.test(await B.evaluate(()=>ONL.reg.map(x=>x.t).join('|'))),'PvP: a Bola de Fogo tira vida de B ('+hp0+' → '+r.hp+')');
 // item da mão online: equipa Chidori e usa pelo 4º botão
 await A.evaluate(()=>{giveItems(['chidori']);equipItem('chidori')});await W(300);
 ok(await A.evaluate(()=>/Chidori/.test($('#b3').textContent)&&/Bola de Fogo/.test($('#b0').textContent)),'A: Chidori no 4º botão, Bola de Fogo continua no 1º');
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+70;p.y=s[1];p.hp=p.max;gsPos(true)},spot);await W(600);
 const hp1=await B.evaluate(()=>p.hp);let hit=false;for(let i=0;i<5&&!hit;i++){await A.evaluate(()=>{E=[];cd[3]=0;p.mp=p.mpMax;useBtn(3)});await W(700);hit=(await B.evaluate(()=>p.hp))<hp1}
 ok(hit,'Chidori pelo botão do item acerta B');
 await A.screenshot({path:__dirname+'/fogo_a.png'});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
