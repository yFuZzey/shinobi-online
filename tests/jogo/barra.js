// Entrega 7a: barra de jutsus — 3 botões pequenos escolhidos pelo jogador (o 3º no lugar do item), o grande só para ultimate,
// olho/Susanoo funcionam em qualquer botão, a recarga acompanha o jutsu, a escolha fica salva
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const errs=[];
 const open=async(ci,nome)=>{const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO',e.message)});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u',nome);await pg.fill('#p','x');await pg.click('#go1');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await pg.click('.card >> nth='+ci);await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
  await pg.evaluate(()=>{switchMap('vila_areia')});await W(300);return pg};
 const btn=(pg,i)=>pg.evaluate(i=>$('#b'+i).textContent.trim(),i);
 const lvTo=(pg,v)=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp)},v);
 const U=await open(0,'Barra');
 ok(JSON.stringify(await U.evaluate(()=>BAR))===JSON.stringify(['katon','olho','sus','item']),'barra padrão = a de antes (Bola de Fogo · Sharingan · Susanoo · item)');
 await U.evaluate(()=>{toggleBag(true,'ju')});await W(250);
 ok(await U.evaluate(()=>document.querySelectorAll('#paneJu .jbar .jbs').length===4),'aba Jutsus mostra a barra com os 4 botões');
 await U.screenshot({path:__dirname+'/barra_tab.png'});await U.evaluate(()=>toggleBag(false));
 // troca: Sharingan no botão 1 e Bola de Fogo no 2
 await lvTo(U,5);const sw=await U.evaluate(()=>barSet(0,'olho'));await W(150);
 ok(sw&&JSON.stringify(await U.evaluate(()=>BAR))===JSON.stringify(['olho','katon','sus','item'])&&/Sharingan/.test(await btn(U,0))&&/Bola de Fogo/.test(await btn(U,1)),'pôr o Sharingan no botão 1: troca de lugar com a Bola de Fogo');
 await U.evaluate(()=>{p.mp=p.mpMax;cd[0]=0;useBtn(0)});await W(150);ok(await U.evaluate(()=>EYE.on==='shar'&&EYE.slot===0),'o Sharingan liga pelo botão 1');
 await U.evaluate(()=>useBtn(0));await W(100);ok(await U.evaluate(()=>!EYE.on&&cd[0]>0&&cd[1]===0),'desligou: a recarga fica no botão onde ele está');
 await U.evaluate(()=>{window._fb=P.length;cd[1]=0;p.mp=p.mpMax;useBtn(1)});await W(500);ok(await U.evaluate(()=>P.some(b=>b.fire)||fx.some(f=>f.k==='boom')),'a Bola de Fogo sai pelo botão 2');
 // a recarga acompanha o jutsu quando troca de botão
 const c0=await U.evaluate(()=>cd[0]);await U.evaluate(()=>barSet(1,'olho'));const c1=await U.evaluate(()=>({olho:cd[1],katon:cd[0]}));
 ok(c1.olho>c0-1&&c1.olho<=c0&&c1.katon<1.2,'trocar de botão não zera a recarga (Sharingan '+c0.toFixed(1)+' s → '+c1.olho.toFixed(1)+' s no novo botão)');
 // regras: ultimate só no grande; o grande não aceita jutsu comum; item volta no 3
 ok(await U.evaluate(()=>!barSet(2,'katon')&&!barSet(0,'sus')),'jutsu comum não vai no botão grande e ultimate não vai num pequeno');
 ok(await U.evaluate(()=>!barSet(3,'katon')&&BAR[3]==='item'),'Bola de Fogo que já está na barra não deixa o item sem lugar (o 3 continua com o item)');
 // fica salvo
 await U.evaluate(()=>{BAR=null;barLoad()});ok(JSON.stringify(await U.evaluate(()=>BAR))===JSON.stringify(['katon','olho','sus','item']),'a barra fica salva no aparelho (recarregou igual)');
 await U.evaluate(()=>{barSet(0,'olho');BAR=null;barLoad()});ok(JSON.stringify(await U.evaluate(()=>BAR))===JSON.stringify(['olho','katon','sus','item']),'… e depois de trocar também');
 // Susanoo no grande funciona igual (Nv 60, Mangekyō ligada, olho no botão 1)
 await lvTo(U,60);await U.evaluate(()=>{CH.mgk='itachi';skBtns();E=[];cd[0]=0;cd[2]=0;p.mp=p.mpMax;useBtn(0)});await W(150);await U.evaluate(()=>{p.mp=p.mpMax;useBtn(2)});await W(400);
 ok(await U.evaluate(()=>EYE.on==='mgk'&&susOn()),'Mangekyō no botão 1 + Susanoo no botão grande: funciona');
 // Hyuga: Kaiten no botão 1
 const H=await open(1,'BarraH');await lvTo(H,10);await H.evaluate(()=>barSet(0,'kaiten'));await W(100);
 ok(/Kaiten/.test(await btn(H,0))&&/Palma/.test(await btn(H,1)),'Hyuga: Kaiten no botão 1 e Palma no 2');
 await H.evaluate(()=>{p.mp=p.mpMax;cd[0]=0;useBtn(0)});await W(120);ok(await H.evaluate(()=>ACT&&ACT.a==='kaiten'&&cd[0]>0),'o Kaiten gira pelo botão 1');
 ok(!errs.length,'sem erros na página');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
