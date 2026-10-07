// /ban e /unban no chat
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const MOCK='http://127.0.0.1:54333';
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const page=async n=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));return pg};
 const mk=async(n,clan)=>{const pg=await page(n);await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const login=async(pg,n)=>{await pg.fill('#u',n);await pg.fill('#p','12345678');await pg.click('#go1')};
 const nA='Hokage'+suf,nB='Zabuza'+suf,nC='Haku'+suf,nD='Kabuto'+suf;
 const A=await mk(nA,0);let B=await mk(nB,1);const C=await mk(nC,2);const D=await mk(nD,0);
 const reg=pg=>pg.evaluate(()=>ONL.reg.map(r=>r.t).join('|'));
 const say=async(pg,t)=>{await pg.evaluate(()=>chatOpen(true,'c'));await pg.fill('#chatin',t);await pg.click('#chatgo');await W(800)};
 for(const n of [nA,nD])await fetch(MOCK+'/__admin?nome='+n,{headers:{apikey:'x'}});
 for(const pg of [A,D]){await pg.evaluate(()=>ONL.ws.close());await pg.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:15000})}
 // 1) banir por 2 horas com motivo
 await say(A,'/ban '+nB+' 2h xingou no chat');
 await B.waitForFunction(()=>!$('#netblock').hidden,null,{timeout:6000}).catch(()=>{});
 const bt=await B.evaluate(()=>$('#netblock').textContent);ok(/Conta banida/.test(bt)&&/até \d\d\/\d\d\/\d{4} às \d\d:\d\d/.test(bt)&&/xingou no chat/.test(bt),'B é tirado do jogo na hora: "Conta banida até … Motivo: xingou no chat"');
 await B.screenshot({path:__dirname+'/ban_b.png'});
 ok(new RegExp('⛔ '+nB+' foi banido por 2h \\(motivo: xingou no chat\\) e saiu do jogo').test(await reg(A)),'A recebe a confirmação (só ele)');
 ok(!(await C.evaluate(()=>ONL.chat.some(r=>/ban/.test(r.text))))&&!/ban/i.test(await reg(C)),'C não vê o comando nem o motivo');
 await W(500);ok(!(await C.evaluate(n=>Object.values(ONL.peers).some(p=>p.nome===n),nB)),'B some do mapa para os outros');
 // 2) B tenta entrar de novo
 await B.close();B=await page(nB);await login(B,nB);await B.waitForFunction(()=>!$('#netblock').hidden,null,{timeout:20000}).catch(()=>{});
 ok(/Conta banida/.test(await B.evaluate(()=>$('#netblock').textContent))&&!(await B.evaluate(()=>ONL.joined)),'banido não consegue entrar de novo');
 // 3) lista e regras
 await say(A,'/banidos');ok(new RegExp('Banidos: '+nB+' \\(até').test(await reg(A)),'/banidos mostra quem está banido e até quando');
 await say(A,'/ban '+nA);ok(/não pode banir a si mesmo/.test(await reg(A)),'não dá para banir a si mesmo');
 await say(A,'/ban '+nD);ok(/é admin: tire o admin antes/.test(await reg(A))&&await D.evaluate(()=>ONL.joined),'não dá para banir outro admin sem tirar o admin antes');
 await say(C,'/ban '+nA);ok(/Comando desconhecido/.test(await reg(C))&&await A.evaluate(()=>ONL.joined),'quem não é admin: "Comando desconhecido"');
 await say(A,'/ban '+nC+' spam');await W(300);
 const ct=await C.evaluate(()=>{const b=$('#netblock');return b.hidden?'':b.textContent});ok(/tempo indeterminado/.test(ct)&&/Motivo: spam/.test(ct),'ban sem tempo: "por tempo indeterminado" (motivo: spam)');
 // 4) desbanir
 await say(A,'/unban '+nB);ok(new RegExp('✅ '+nB+' foi desbanido').test(await reg(A)),'/unban confirma');
 await B.close();B=await page(nB);await login(B,nB);await B.waitForFunction(()=>ONL.joined,null,{timeout:20000}).catch(()=>{});ok(await B.evaluate(()=>ONL.joined),'desbanido entra normalmente');
 await say(A,'/unban '+nB);ok(new RegExp(nB+' não estava banido').test(await reg(A)),'desbanir quem não está banido avisa');
 const gl=require('fs').readFileSync(require('path').join(__dirname,'..','servidor.log'),'utf8');ok(new RegExp('ADM: '+nA+' baniu '+nB+' por 2h').test(gl)&&/desbaniu/.test(gl),'servidor registra quem baniu e desbaniu');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
