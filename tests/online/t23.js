// trocas com quantidade (escolher quais e quantos, presente) + PvP fora do grupo
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const MOCK='http://127.0.0.1:54333';const svc=(fn,body)=>fetch(MOCK+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:'svc-test','Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.status===204?null:r.json());
const invDb=async()=>(await (await fetch(MOCK+'/__inv',{headers:{apikey:'x'}})).json()).inv;
const cnt=(L,it)=>(L||[]).filter(r=>(r.item||r)===it).length;
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const A=await mk('Kiba'+suf,0),B=await mk('Shino'+suf,1);await W(800);
 const ida=await A.evaluate(()=>ONL.uid),idb=await B.evaluate(()=>ONL.uid);
 const reg=pg=>pg.evaluate(()=>ONL.reg.map(r=>r.t).join('|'));

 // ================= TROCA COM QUANTIDADE =================
 await svc('dar_itens',{p_personagem:ida,p_itens:['manto','manto','manto','chidori']});await svc('dar_itens',{p_personagem:idb,p_itens:['chidori']});
 await A.evaluate(()=>invReload());await B.evaluate(()=>invReload());await W(300);
 ok(cnt(await A.evaluate(()=>INV),'manto')===3,'A tem 3 Mantos repetidos (o banco aceita várias unidades)');
 await A.evaluate(()=>{toggleBag(true,'bag')});await W(300);
 const badge=await A.evaluate(()=>[...document.querySelectorAll('#ivGrid .qt')].map(x=>x.textContent));ok(badge.includes('×3'),'mochila mostra a pilha "×3" ('+badge+')');
 await A.screenshot({path:__dirname+'/q_bag.png'});await A.evaluate(()=>toggleBag(false));
 // A equipa 1 manto: só 1 unidade fica equipada no banco, as outras 2 continuam livres
 await A.evaluate(()=>{equipItem('manto')});await W(200);await A.evaluate(()=>onlSave());await W(400);
 let db=await invDb();ok(db[ida].filter(r=>r.item==='manto'&&r.equipado).length===1&&cnt(await A.evaluate(()=>INV),'manto')===2,'equipar 1 Manto: 1 equipado, 2 livres na mochila');
 // convite
 await A.evaluate(id=>gsSend({t:'tinv',to:id}),idb);await B.waitForFunction(()=>!$('#tinvp').hidden,null,{timeout:5000});await B.click('#tinvOk');
 await A.waitForFunction(()=>ONL.trade&&!$('#trd').hidden,null,{timeout:5000});
 // A toca 1x no Manto: entra 1; toca de novo: 2
 const tapManto=()=>A.evaluate(()=>{const i=[...document.querySelectorAll('#tdBag .sl.has')].findIndex(b=>/Manto/i.test(b.innerHTML));document.querySelectorAll('#tdBag .sl.has')[i].click()});
 await tapManto();await W(450);ok(JSON.stringify(await B.evaluate(()=>ONL.trade.theirs))==='[{"i":"manto","n":1}]','toque no item: entra 1 unidade (B vê 1 Manto)');
 await tapManto();await W(450);ok(JSON.stringify(await B.evaluate(()=>ONL.trade.theirs))==='[{"i":"manto","n":2}]','tocar de novo: 2 unidades');
 ok(await A.evaluate(()=>!document.querySelectorAll('#tdBag .sl.has').length||![...document.querySelectorAll('#tdBag .sl.has')].some(b=>/Manto/i.test(b.innerHTML))),'o Manto equipado não aparece para trocar (só os 2 livres)');
 // botão − tira 1 ; Todos coloca tudo
 await A.click('#tdInfo [data-q="-1"]');await W(450);ok(JSON.stringify(await B.evaluate(()=>ONL.trade.theirs))==='[{"i":"manto","n":1}]','botão − tira 1');
 await A.click('#tdInfo [data-q="all"]');await W(450);ok(JSON.stringify(await B.evaluate(()=>ONL.trade.theirs))==='[{"i":"manto","n":2}]','botão Todos coloca todas as unidades livres');
 // hack: pedir mais do que tem
 await A.evaluate(()=>gsSend({t:'toff',items:[{i:'manto',n:50},{i:'chidori',n:9}]}));await W(500);
 ok(JSON.stringify(await B.evaluate(()=>ONL.trade.theirs))==='[{"i":"manto","n":2},{"i":"chidori","n":1}]','pedir 50 Mantos e 9 Chidoris: o servidor limita ao que A tem livre (2 e 1)');
 await A.evaluate(()=>tradeQty('chidori',0));await W(450);
 await A.screenshot({path:__dirname+'/q_trade.png'});
 // presente: B não coloca nada
 await A.click('#tdOk');await B.click('#tdOk');await W(400);await A.click('#tdOk');await B.click('#tdOk');
 await A.waitForFunction(()=>!ONL.trade,null,{timeout:6000});await W(900);
 db=await invDb();ok(cnt(db[ida],'manto')===1&&cnt(db[idb],'manto')===2&&cnt(db[ida],'chidori')===1&&cnt(db[idb],'chidori')===1,'presente feito: A ficou com 1 Manto (equipado), B ganhou 2; Chidoris intactos');
 ok(cnt(await B.evaluate(()=>INV),'manto')===2&&/recebeu: 2× Manto/.test(await reg(B)),'B vê "recebeu: 2× Manto" e a mochila atualizada');

 // ================= PvP =================
 // no teste os monstros não atrapalham (só golpes de jogador chegam)
 for(const pg of [A,B])await pg.evaluate(()=>{const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;return g(m)}});
 // 1) na zona segura (os dois nasceram no ponto de início)
 await B.evaluate(()=>{p.x=SPAWN[0]*T+60;p.y=SPAWN[1]*T;gsPos(true)});await A.evaluate(()=>{p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;E=[];gsPos(true)});await W(600);const hp0=await B.evaluate(()=>p.hp);
 await A.evaluate(()=>{cd[0]=0;cast(0)});await W(900);
 ok(await B.evaluate(()=>p.hp)===hp0&&/Zona segura/.test(await reg(A)),'na zona segura do início ninguém apanha (aviso "zona segura")');
 // 2) fora da zona segura
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+60,y)&&!blk(x+30,y))return[x,y]}return null});
 ok(!!spot,'achou um lugar fora da zona segura');
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+60;p.y=s[1];p.hp=p.max;gsPos(true)},spot);await W(700);
 const hpB=await B.evaluate(()=>p.hp);let hit=false;
 for(let i=0;i<6&&!hit;i++){await A.evaluate(()=>{E=[];cd[0]=0;p.mp=p.mpMax;cast(0)});await W(700);hit=(await B.evaluate(()=>p.hp))<hpB}
 ok(hit,'A acertou B fora da zona: a vida de B caiu ('+hpB+' → '+(await B.evaluate(()=>p.hp))+')');
 ok(/Você causou \d+ de dano em Shino/.test(await reg(A))&&/Você recebeu \d+ de dano \(Kiba/.test(await reg(B)),'registro dos dois: "Você causou X de dano em Shino" / "Você recebeu X (Kiba)"');
 // B revida
 const hpA=await A.evaluate(()=>p.hp);let hit2=false;
 for(let i=0;i<6&&!hit2;i++){await B.evaluate(()=>{E=[];cd[0]=0;p.mp=p.mpMax;cast(0)});await W(700);hit2=(await A.evaluate(()=>p.hp))<hpA}
 ok(hit2,'B também consegue bater em A');
 // 3) atordoamento: B fica parado
 await A.evaluate(id=>gsSend({t:'pvp',to:id,d:3,st:5,pr:500}),idb);await W(500);
 const st=await B.evaluate(()=>PST);ok(st>0&&st<=1.5,'atordoar jogador: B fica parado no máximo 1,5 s ('+st.toFixed(2)+' s)');
 await B.screenshot({path:__dirname+'/pvp_b.png'});await A.screenshot({path:__dirname+'/pvp_a.png'});
 // 4) em grupo não se batem
 await A.evaluate(id=>gsSend({t:'pinv',to:id}),idb);await B.waitForFunction(()=>!$('#pinv').hidden,null,{timeout:5000});await B.click('#pinvOk');await A.waitForFunction(()=>ONL.party,null,{timeout:5000});await W(300);
 await B.evaluate(()=>{p.hp=p.max;gsPos(true)});await W(300);const hpG=await B.evaluate(()=>p.hp);
 for(let i=0;i<3;i++){await A.evaluate(()=>{E=[];cd[0]=0;p.mp=p.mpMax;cast(0)});await W(500)}
 await A.evaluate(id=>gsSend({t:'pvp',to:id,d:50,pr:900}),idb);await W(500);
 ok(await B.evaluate(()=>p.hp)===hpG,'no mesmo grupo: golpes (e até mensagem forjada) não machucam');
 await B.evaluate(()=>gsSend({t:'pleave'}));await A.waitForFunction(()=>!ONL.party,null,{timeout:5000});
 // 5) derrotar
 await B.evaluate(()=>{p.hp=2;gsPos(true)});await W(400);let dead=false;
 for(let i=0;i<8&&!dead;i++){await A.evaluate(()=>{E=[];cd[0]=0;p.mp=p.mpMax;cast(0)});await W(700);dead=/Você derrotou Shino/.test(await reg(A))}
 ok(dead,'A derrotou B: aviso "Você derrotou Shino"');
 ok(/Kiba\d+ derrotou você/.test(await reg(B))&&await B.evaluate(()=>Math.hypot(p.x-SPAWN[0]*T,p.y-SPAWN[1]*T)<10&&p.hp===p.max),'B volta para o início com a vida cheia e vê quem o derrotou');
 // 6) mensagem forjada de resultado não vale
 await A.evaluate(id=>gsSend({t:'phr',by:id,d:999,dead:1}),idb);await W(400);ok(!/Shino\d+ derrotou você/.test(await reg(A)),'B não consegue "fingir" que derrotou A');
 const gl=require('fs').readFileSync(require('path').join(__dirname,'..','servidor.log'),'utf8');ok(/PvP: Kiba\d+ derrotou Shino/.test(gl),'servidor registra a derrota no log');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
