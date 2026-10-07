// Entrega 11 (online): o contrato vai para o banco (coluna "contrato", sql/08) e volta ao entrar de novo; os outros veem a invocação;
// Cães prendem outro jogador pelo servidor (com a regra de controle do PvP)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const MOCK='http://127.0.0.1:54333',PAG='file://'+require('path').join(__dirname,'..','paginas','online.html');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const page=async n=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});await pg.goto(PAG);return pg};
 const mk=async(n,clan)=>{const pg=await page(n);await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const nA='Kiba'+suf,A=await mk(nA,1),B=await mk('Shino'+suf,2);await W(800);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)}});
 const uA=await A.evaluate(()=>ONL.uid);
 await A.evaluate(()=>{let g=0;while(CH.lv<10&&g++<50)gainXp(xpNeed(CH.lv)-CH.xp);barSet(3,'invoc');ctEscolhe('caes')});await A.evaluate(()=>onlSave());await W(700);
 const st=await (await fetch(MOCK+'/__state',{headers:{apikey:'x'}})).json();ok(st.rows[uA]&&st.rows[uA].contrato==='caes','contrato salvo no banco (coluna contrato = caes)');
 // B vê a invocação; Cães prendem B (servidor)
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+90,y))return[x,y]}return null});
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+90;p.y=s[1];p.hp=p.max;E=[];gsPos(true)},spot);await W(800);
 let prt=0,viu=false;for(let k=0;k<4&&!(prt>0);k++){await A.evaluate(()=>{E=[];cd[3]=0;p.mp=p.mpMax;cast(3)});await W(150);viu=viu||await B.evaluate(()=>fx.some(f=>f.k==='invoc'&&f.rm));await W(500);prt=await B.evaluate(()=>PRT)}
 ok(viu,'B vê o cão aparecer');ok(prt>0,'Cães prendem B pelo servidor ('+(+prt).toFixed(1)+' s)');
 // entra de novo: o contrato volta do banco
 await A.context().close();const A2=await page(nA);await A2.fill('#u',nA);await A2.fill('#p','12345678');await A2.click('#go1');await A2.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 ok(await A2.evaluate(()=>CH.ct==='caes'&&/Cães/.test(JU.hyuga.invoc.n)&&ctPass('prec')>0),'ao entrar de novo: contrato com os Cães, passiva ligada');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
