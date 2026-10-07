// Entrega 3 (parte segura): o servidor registra a luta PvP (golpes, maior dano em 2 s, tempo preso, derrota) e confere a recarga
// dos golpes em modo sombra (só anota suspeitas); /lutas mostra as últimas lutas para o admin. Nada disso muda o resultado da luta.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const MOCK='http://127.0.0.1:54333',LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
const logDesde=n=>fs.readFileSync(LOG,'utf8').slice(n);
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const nA='Kakuzu'+suf,nB='Hidan'+suf;const A=await mk(nA,1),B=await mk(nB,2);await W(800);
 const reg=pg=>pg.evaluate(()=>ONL.reg.map(r=>r.t).join('|'));
 const say=async(pg,t)=>{await pg.evaluate(()=>chatOpen(true,'c'));await pg.fill('#chatin',t);await pg.click('#chatgo');await W(700)};
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)}}); // monstros não atrapalham o teste
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+50,y)&&!blk(x+25,y))return[x,y]}return null});
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+40;p.y=s[1];p.hp=p.max;E=[];gsPos(true)},spot);await W(900);
 let n0=fs.readFileSync(LOG,'utf8').length;
 // golpes de verdade no ritmo normal: Palma do Hyuga (recarga 0,8 s) — o servidor não deve achar nada estranho
 for(let i=0;i<4;i++){await A.evaluate(()=>{E=[];cd[0]=0;p.mp=p.mpMax;cast(0)});await W(900)}
 ok(!/RECARGA\?/.test(logDesde(n0)),'golpes no ritmo normal: o servidor não anota suspeita');
 // alguém mandando o mesmo golpe rápido demais (cliente adulterado): o servidor anota, mas não bloqueia nada (modo sombra)
 await A.evaluate(()=>{for(let i=0;i<4;i++)gsSend({t:'cast',sl:0})});await W(600);
 ok(new RegExp('RECARGA\\? '+nA+' \\(hyuga\\) usou o botão 0 de novo').test(logDesde(n0)),'golpe mais rápido que a recarga: o servidor anota a suspeita no log');
 // derrota: a luta fecha e vai para o registro
 let dead=false;for(let i=0;i<12&&!dead;i++){await A.evaluate(id=>gsSend({t:'pvp',to:id,d:400,pr:999,st:1}),await B.evaluate(()=>ONL.uid));await W(500);dead=/derrotou você/.test(await reg(B))}
 if(!dead)console.log('   B:',JSON.stringify(await B.evaluate(()=>({hp:p.hp,max:p.max,x:p.x,y:p.y,reg:ONL.reg.slice(-4).map(r=>r.t)}))),'A:',JSON.stringify(await A.evaluate(()=>({x:p.x,y:p.y,reg:ONL.reg.slice(-3).map(r=>r.t)}))));
 ok(dead,'A derrota B');await W(600);
 const lg=logDesde(n0),m=lg.match(new RegExp('LUTA: '+nA+' x '+nB+' · ([\\d.]+) s · (\\d+) golpes · (\\d+) de dano · maior em 2 s: (\\d+)% da vida · preso ([\\d.]+) s \\(seguido ([\\d.]+) s\\) · derrotado'));
 ok(!!m,'servidor registra a luta: duração, golpes, dano, maior dano em 2 s, tempo preso e derrota'+(m?' ('+m[0].slice(6)+')':''));
 if(m)ok(+m[2]>=2&&+m[4]>0&&+m[4]<=300&&+m[5]>0,'números da luta fazem sentido ('+m[2]+' golpes, '+m[4]+'% em 2 s, preso '+m[5]+' s)');
 // /lutas: só admin
 await say(B,'/lutas');ok(/Comando desconhecido/.test(await reg(B)),'/lutas sem admin: comando desconhecido');
 await fetch(MOCK+'/__admin?nome='+nA,{headers:{apikey:'x'}});await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:15000});
 await say(A,'/lutas');const ra=await reg(A);ok(new RegExp('Últimas lutas PvP.*'+nA+' x '+nB+'.*maior dano em 2 s \\d+% da vida.*derrotado').test(ra),'admin vê as últimas lutas com /lutas');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
