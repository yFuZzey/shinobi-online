// comando /admin no chat: só admin usa, ninguém mais vê, grava no banco pelo servidor
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const MOCK='http://127.0.0.1:54333';const rows=async()=>(await (await fetch(MOCK+'/__rows',{headers:{apikey:'x'}})).json());
const adminOf=async nome=>{const r=Object.values(await rows()).find(r=>r.nome===nome);return r?!!r.admin:null};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
  await pg.evaluate(()=>{window.__all=[];const g=gsMsg;gsMsg=function(m){__all.push(JSON.stringify(m));return g(m)}});return pg};
 const nA='Tsunade'+suf,nB='Jiraiya'+suf,nC='Orochi'+suf,nD='Kakuzu'+suf;
 const A=await mk(nA,0),B=await mk(nB,1),C=await mk(nC,2);
 const reg=pg=>pg.evaluate(()=>ONL.reg.map(r=>r.t).join('|'));
 const say=async(pg,t)=>{await pg.evaluate(()=>chatOpen(true,'c'));await pg.fill('#chatin',t);await pg.click('#chatgo');await W(700)};
 // A vira admin pelo painel (como você faz no Supabase) e reconecta
 await fetch(MOCK+'/__admin?nome='+nA,{headers:{apikey:'x'}});await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:15000});
 ok(true,'A é admin');ok(!(await B.evaluate(()=>ONL.adm))&&!(await C.evaluate(()=>ONL.adm)),'B e C não são admin');
 // 1) A dá admin para B pelo chat
 await say(A,'/admin '+nB);await B.waitForFunction(()=>ONL.adm,null,{timeout:6000}).catch(()=>{});
 ok(await B.evaluate(()=>ONL.adm&&document.body.classList.contains('adm')),'B virou admin na hora (botões de admin aparecem)');
 ok(await adminOf(nB)===true,'gravado no banco (coluna admin de B = true)');
 ok(new RegExp('✅ '+nB+' agora é admin').test(await reg(A)),'A recebe a confirmação só para ele');
 const cAll=await C.evaluate(()=>__all.join('\n')),bAll=await B.evaluate(()=>__all.join('\n'));
 ok(!/\/admin/.test(cAll)&&!/\/admin/.test(bAll)&&!(await C.evaluate(()=>ONL.chat.length))&&!(await B.evaluate(()=>ONL.chat.length)),'o comando NÃO aparece para ninguém (nem no chat, nem no balão)');
 ok(!(await A.evaluate(()=>ONL.chat.some(r=>/\/admin/.test(r.text))))&&!(await A.evaluate(()=>myT>0)),'nem no chat/balão do próprio A (fica só no Registro dele)');
 await W(300);ok(await C.evaluate(id=>ONL.peers[id]&&ONL.peers[id].adm===1,await B.evaluate(()=>ONL.uid)),'a tag [ADM] de B atualiza para quem está no mapa');
 // 2) quem não é admin não consegue
 await say(C,'/admin '+nC);ok(/Comando desconhecido/.test(await reg(C))&&await adminOf(nC)===false&&!(await C.evaluate(()=>ONL.adm)),'C (sem admin) tenta /admin: "Comando desconhecido" e nada muda');
 await C.evaluate(()=>gsSend({t:'cmd',text:'/admin '+name}));await W(500);ok(await adminOf(nC)===false,'nem mandando a mensagem direto pro servidor');
 // 3) erros
 await say(A,'/admin NinguemAqui1');ok(/não encontrado/.test(await reg(A)),'nome que não existe: "não encontrado"');
 await say(A,'/desadmin '+nA);ok(/não pode tirar o seu próprio/.test(await reg(A))&&await adminOf(nA)===true,'não dá para tirar o próprio admin');
 await say(A,'/admin');ok(/Use assim/.test(await reg(A)),'sem nome: mostra como usar');
 await say(A,'/ajuda');ok(/\/admin nome/.test(await reg(A)),'/ajuda lista os comandos');
 // 4) nome em minúsculas também vale
 await say(A,'/desadmin '+nB.toLowerCase());await B.waitForFunction(()=>!ONL.adm,null,{timeout:6000}).catch(()=>{});
 ok(!(await B.evaluate(()=>ONL.adm))&&await adminOf(nB)===false,'/desadmin (nome em minúsculas): B deixa de ser admin');
 // 5) jogador fora do jogo
 const D=await mk(nD,0);await D.close();await W(600);
 await say(A,'/admin '+nD);ok(await adminOf(nD)===true&&/vale quando ele entrar/.test(await reg(A)),'jogador offline: gravado no banco, vale quando ele entrar');
 // B (agora admin de novo) também pode dar admin
 await say(A,'/admin '+nB);await B.waitForFunction(()=>ONL.adm,null,{timeout:6000});await say(B,'/admin '+nC);await C.waitForFunction(()=>ONL.adm,null,{timeout:6000}).catch(()=>{});
 ok(await C.evaluate(()=>ONL.adm),'um admin novo também consegue dar admin');
 const gl=require('fs').readFileSync(require('path').join(__dirname,'..','servidor.log'),'utf8');ok(new RegExp('ADM: '+nA+' deu admin para '+nB).test(gl),'servidor registra quem deu admin para quem');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
