// [ADM] trocar de clã para testar: só admin vê o botão; pede confirmação; zera tudo (nível, XP, pontos, atributos, especialidade,
// Mangekyō, barra e mochila) no aparelho e no banco; os outros jogadores veem o clã novo; ao entrar de novo continua no clã novo
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const MOCK='http://127.0.0.1:54333',PAG='file://'+require('path').join(__dirname,'..','paginas','online.html');
const st=async()=>(await fetch(MOCK+'/__state',{headers:{apikey:'x'}})).json();
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const page=async n=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});await pg.goto(PAG);return pg};
 const mk=async(n,clan)=>{const pg=await page(n);await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const nA='Sasori'+suf,nB='Deidara'+suf;const A=await mk(nA,0),B=await mk(nB,2);await W(600);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)}});
 const uA=await A.evaluate(()=>ONL.uid);
 // quem não é admin não vê o botão
 await B.evaluate(()=>toggleBag(true,'ch'));await W(250);ok(await B.evaluate(()=>!document.querySelector('#paneCh .acla')),'jogador comum não vê a troca de clã');await B.evaluate(()=>toggleBag(false));
 // A vira admin e junta progresso de verdade: nível 45, pontos, especialidade, Mangekyō, barra trocada, itens
 await fetch(MOCK+'/__admin?nome='+nA,{headers:{apikey:'x'}});await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:15000});
 await A.evaluate(()=>{let g=0;while(CH.lv<45&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);CH.st.str=20;CH.st.dex=15;CH.pts-=35;CH.prof={k:'ninjutsu',xp:900};CH.mgk='itachi';chSave();stats();barSet(0,'olho')});
 await A.evaluate(()=>gsSend({t:'admitem'}));await A.waitForFunction(()=>INV.length>0,null,{timeout:8000}).catch(()=>{});
 await A.evaluate(()=>{const id=INV.find(i=>ITEMS[i]&&ITEMS[i].slot==='arma');if(id)equipItem(id)});await W(400);
 await A.evaluate(()=>onlSave());await W(800);
 let s=await st(),r=s.rows[uA];
 ok(r&&r.cla==='uchiha'&&r.nivel>=45&&r.forca===20&&r.proficiencia==='ninjutsu'&&r.mangekyo==='itachi'&&(s.inv[uA]||[]).length>0,'antes: Uchiha Nv '+(r&&r.nivel)+' com pontos, especialidade, Mangekyō e '+(s.inv[uA]||[]).length+' itens no banco');
 // o botão aparece na aba Personagem, com o clã atual desligado
 await A.evaluate(()=>toggleBag(true,'ch'));await W(250);
 ok(await A.evaluate(()=>{const r=document.querySelector('#paneCh .acla');if(!r||!r.offsetParent)return false;const bs=[...r.querySelectorAll('button')];return bs.length===3&&bs.find(x=>x.dataset.acla==='uchiha').disabled&&!bs.find(x=>x.dataset.acla==='hyuga').disabled}),'admin vê "Trocar de clã" na aba Personagem (o clã atual fica desligado)');
 await A.screenshot({path:__dirname+'/acla_1.png'});
 // pede confirmação; cancelar não muda nada
 await A.click('#paneCh [data-acla="hyuga"]');await W(150);
 ok(await A.evaluate(()=>/Virar\s+Hyuga\?/.test($('#paneCh .acla').textContent)&&!!$('#paneCh [data-acla="ok"]')),'tocar em Hyuga pede confirmação dizendo que zera tudo');
 await A.screenshot({path:__dirname+'/acla_2.png'});
 await A.click('#paneCh [data-acla="no"]');await W(150);ok(await A.evaluate(()=>clan==='uchiha'&&CH.lv>=45&&!!$('#paneCh [data-acla="hyuga"]')),'Cancelar: nada muda');
 // confirma
 await A.click('#paneCh [data-acla="hyuga"]');await W(100);await A.click('#paneCh [data-acla="ok"]');
 await A.waitForFunction(()=>clan==='hyuga'&&!ONL.claBusy,null,{timeout:10000}).catch(()=>{});await W(1200);
 const c=await A.evaluate(()=>({clan,lv:CH.lv,xp:CH.xp,pts:CH.pts,st:Object.values(CH.st).every(v=>v===0),prof:CH.prof&&CH.prof.k,mgk:CH.mgk,bar:BAR,inv:INV.length,eq:Object.keys(EQ).length,b0:$('#b0').textContent,joined:ONL.joined,bag:invOpen}));
 ok(c.clan==='hyuga'&&c.lv===1&&c.xp===0&&c.pts===0&&c.st&&!c.prof&&!c.mgk,'virou Hyuga no Nv 1: XP, pontos, atributos, especialidade e Mangekyō zerados ('+JSON.stringify({lv:c.lv,xp:c.xp,pts:c.pts,prof:c.prof,mgk:c.mgk})+')');
 ok(JSON.stringify(c.bar)===JSON.stringify(['palma','kaiten','hakke','item'])&&/Palma/.test(c.b0),'barra volta à padrão do Hyuga ('+(c.bar||[]).join(', ')+')');
 ok(c.inv===0&&c.eq===0,'mochila e equipamentos vazios');ok(c.joined,'continua no mapa, conectado');
 s=await st();r=s.rows[uA];
 ok(r.cla==='hyuga'&&r.nivel===1&&r.xp===0&&r.pontos===0&&r.forca===0&&r.destreza===0&&r.proficiencia==null&&r.mangekyo==null&&!(s.inv[uA]||[]).length,'banco: clã hyuga, Nv 1, tudo zerado, sem itens');
 ok(await A.evaluate(()=>ONL.reg.some(x=>/Clã trocado: Uchiha → Hyuga/.test(x.t))),'registro avisa a troca');
 ok(await B.evaluate(id=>ONL.peers[id]&&ONL.peers[id].clan==='hyuga'&&(ONL.peers[id].lv|0)===1,uA),'os outros veem A como Hyuga Nv 1');
 // o Hyuga novo funciona
 await A.evaluate(()=>{toggleBag(false);p.mp=p.mpMax;cd[0]=0;cast(0)});await W(400);ok(await A.evaluate(()=>cd[0]>0),'a Palma do Hyuga sai normalmente');
 // entrar de novo: continua Hyuga Nv 1
 await A.evaluate(()=>onlSave());await W(500);await A.context().close();
 const A2=await page(nA);await A2.fill('#u',nA);await A2.fill('#p','12345678');await A2.click('#go1');await A2.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 ok(await A2.evaluate(()=>clan==='hyuga'&&CH.lv===1&&!CH.mgk&&!(CH.prof&&CH.prof.k)&&JSON.stringify(BAR)===JSON.stringify(['palma','kaiten','hakke','item'])),'ao entrar de novo continua Hyuga Nv 1, do zero');
 // dá para trocar de novo (Nara)
 await A2.evaluate(()=>toggleBag(true,'ch'));await W(250);await A2.click('#paneCh [data-acla="nara"]');await W(100);await A2.click('#paneCh [data-acla="ok"]');
 await A2.waitForFunction(()=>clan==='nara'&&!ONL.claBusy,null,{timeout:10000}).catch(()=>{});await W(900);
 s=await st();ok(await A2.evaluate(()=>clan==='nara'&&CH.lv===1)&&s.rows[uA].cla==='nara','troca de novo: Hyuga → Nara');
 // o botão também está na aba Jutsus (junto do "ir para o nível")
 await A2.evaluate(()=>toggleBag(true,'ju'));await W(250);ok(await A2.evaluate(()=>!!document.querySelector('#paneJu .acla [data-acla="uchiha"]')),'o botão também aparece na aba Jutsus');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
