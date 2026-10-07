// hierarquia: status (pontos + itens) × (1 + soma das %) → atributos (dos status + fixos) × (1 + soma das %) → golpe
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};const near=(a,b)=>Math.abs(a-b)<1e-6;
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',e.message);fails++});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu','Gai'+suf);await pg.fill('#np','12345678');await pg.fill('#ne','g@g.com');await pg.click('#goNew');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth=1');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 const R=await pg.evaluate(()=>{
  ITEMS.faixa={id:'faixa',name:'Faixa de Treino',rarity:'raro',slot:'cabeca',desc:'teste',icon:ITEMS.manto.icon,stats:{str:10,str_pct:20,vit:5,hp_max:40,hp_pct:10}};
  CH.st.str=20;CH.st.vit=10;CH.st.agi=0;stats();const o={};
  o.s0=calcChar(1,1).st.str.fin;                                   // só pontos: 20
  giveItems(['faixa','manto']);equipItem('faixa');equipItem('manto');$('#drop').hidden=true;
  o.s1=calcChar(1,1).st.str;                                       // (20+10)×1,20 = 36
  CH.prof={k:'taijutsu',xp:0};stats();
  o.s2=calcChar(1,1).st.str;                                       // (20+10)×(1+0,20+0,15) = 40,5
  o.v2=calcChar(1,1).st.vit.fin;                                   // (10+5)×1,10 = 16,5
  o.at=calcChar(1,1).at;o.D=D();
  CH.st.str=99;ITEMS.faixa.stats.str=200;ITEMS.faixa.stats.str_pct=200;stats();o.cap=calcChar(1,1).st.str.fin;ITEMS.faixa.stats.str=10;ITEMS.faixa.stats.str_pct=20;CH.st.str=20;stats();
  return o});
 ok(R.s0===20,'só pontos: Força 20');
 ok(R.s1.base===30&&near(R.s1.pct,20)&&near(R.s1.fin,36),'itens: (20 pontos + 10) × (1 + 20%) = 36');
 ok(near(R.s2.pct,35)&&near(R.s2.fin,40.5),'itens + especialidade: (20 + 10) × (1 + 20% + 15%) = 40,5 (soma as % e aplica uma vez)');
 ok(near(R.v2,16.5),'Vitalidade: (10 + 5) × (1 + 10% do Taijutsu) = 16,5');
 ok(R.cap===300,'limite de 300 no status final');
 const pfv=R.at.pf;ok(near(pfv.fromSt,40.5)&&near(pfv.pct,100)&&near(pfv.fin,81),'Poder físico: Força final 40,5 × (1 + 100% do Manto) = '+pfv.fin);
 const hp=R.at.hp;ok(near(hp.fromSt,100+16.5*8)&&hp.fl===80&&near(hp.pct,10)&&near(hp.fin,(100+16.5*8+80)*1.1),'Vida: (100 + 16,5×8 + 80 fixos) × (1 + 10%) = '+hp.fin.toFixed(1));
 const mp=R.at.mp;ok(near(mp.fin,(100+0)*0.8),'Chakra: 100 × (1 − 20% do Taijutsu) = '+mp.fin);
 ok(R.D.hp===Math.round(hp.fin)&&near(R.D.pf,81),'o jogo usa esses finais (vida '+R.D.hp+', poder físico '+R.D.pf+')');
 // golpe: (dano + fixo) × Dano final × tipo
 await pg.evaluate(()=>{window._hits=[];const o=gsSend;gsSend=function(m){if(m.t==='hit')_hits.push(m.d);return o(m)}});
 for(let k=0;k<12;k++){await pg.evaluate(()=>{const e=E.filter(e=>e.kind==='mob'&&!e.dead).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];p.x=e.x-28;p.y=e.y;p.hp=p.max;p.mp=p.mpMax;cd[0]=0;useBtn(0)});await W(260);if((await pg.evaluate(()=>_hits.length))>=1)break}
 const H=await pg.evaluate(()=>({h:_hits[0],exp:Math.round((16+D().pf)*1.05),crit:D().crit}));
 ok(H.h===H.exp||H.h===H.exp*2,'Palma: (16 + poder físico 81) × 1,05 (Taijutsu E) = '+H.exp+' → enviado '+H.h);
 // telas
 await pg.evaluate(()=>toggleBag(true,'ch'));await W(300);const ch=await pg.textContent('#paneCh');
 ok(/Como é calculado/.test(ch)&&/40,5/.test(ch)&&/\+35%/.test(ch),'aba Personagem mostra a ordem do cálculo e Força 40,5 com +35%');
 await pg.screenshot({path:__dirname+'/h1.png'});await pg.evaluate(()=>document.querySelector('#paneCh .ivt:nth-of-type(2)')?.scrollIntoView());await pg.evaluate(()=>{const t=[...document.querySelectorAll('#paneCh .ivt')][1];t&&t.scrollIntoView()});await W(100);await pg.screenshot({path:__dirname+'/h2.png'});
 await pg.evaluate(()=>{toggleBag(true,'bag');invSel='faixa';bagRefresh()});await W(300);const bg=await pg.textContent('#ivDet');ok(/\+10 de força/.test(bg)&&/\+20% de força/.test(bg),'mochila mostra +10 de força e +20% de força');
 await pg.screenshot({path:__dirname+'/h3.png'});
 await pg.evaluate(()=>toggleBag(true,'st'));await W(200);ok(/→ 40,5/.test(await pg.textContent('#stRows')),'aba Status mostra 20 → 40,5 na Força');await pg.screenshot({path:__dirname+'/h4.png'});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
