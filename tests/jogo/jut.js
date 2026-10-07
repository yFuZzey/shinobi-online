// aba Jutsus: árvore por clã, travas por nível, Sharingan liga/desliga (olhar em cone, gasto por segundo), evolução para a Mangekyō, Susanoo só com ela ligada
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const open=async(ci,nome)=>{const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg._e=[];pg.on('pageerror',e=>{pg._e.push(e.message);console.log('ERRO',e.message)});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u',nome);await pg.fill('#p','x');await pg.click('#go1');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth='+ci);await pg.waitForFunction(()=>cur==='game'&&ready&&SFX_OK,null,{timeout:10000});
  await pg.evaluate(()=>{switchMap('vila_areia')});await W(400);return pg};
 const btn=(pg,i)=>pg.evaluate(i=>({t:$('#b'+i).textContent.trim(),lock:$('#b'+i).classList.contains('lock'),on:$('#b'+i).classList.contains('eyeon'),off:$('#b'+i).classList.contains('off')}),i);
 const lvTo=(pg,v)=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp)},v);
 const mobs=(pg,L)=>pg.evaluate(L=>{autoOn=false;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.ax=1;p.ay=0;p.fl=false;p.hp=p.max;p.mp=p.mpMax;
  const mk=(dx,dy,id,esq)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y+dy,dead:0,dt:0,rt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id,esq});
  E=L.map((o,i)=>mk(o[0],o[1],i+1,o[2]||0))},L);
 // ================= UCHIHA =================
 const U=await open(0,'Itachi');
 let b0=await btn(U,0),b1=await btn(U,1),b2=await btn(U,2);
 ok(!b0.lock&&/Bola de Fogo/.test(b0.t),'Nv 1: só a Bola de Fogo liberada');ok(b1.lock&&/Nv 5/.test(b1.t)&&b2.lock&&/Nv 60/.test(b2.t),'Sharingan travado (🔒 Nv 5) e Susanoo travado (🔒 Nv 60)');
 await U.evaluate(()=>useBtn(1));await W(150);ok(await U.evaluate(()=>/libera no Nv 5/.test($('#toast').textContent)),'tocar no travado explica: "libera no Nv 5"');
 await U.screenshot({path:__dirname+'/ju_btn1.png'});
 await U.evaluate(()=>toggleBag(true,'ju'));await W(250);
 const tab=await U.evaluate(()=>({n:document.querySelectorAll('#paneJu .jn').length,lock:document.querySelectorAll('#paneJu .jn.lock').length,ok:document.querySelectorAll('#paneJu .jn.ok').length,txt:$('#paneJu').textContent}));
 ok(tab.n===8&&tab.ok===1&&/Katon/.test(tab.txt)&&/Sharingan → Mangekyō/.test(tab.txt)&&/Técnicas da Mangekyō/.test(tab.txt),'aba Jutsus: 3 ramos e 8 jutsus (1 liberado)');
 await U.screenshot({path:__dirname+'/ju_tab1.png'});await U.evaluate(()=>toggleBag(false));
 // Nv 5: Sharingan 1 tomoe
 await lvTo(U,5);await W(200);b1=await btn(U,1);ok(!b1.lock&&/Sharingan/.test(b1.t)&&await U.evaluate(()=>/Novo jutsu: Sharingan/.test($('#toast').textContent)),'Nv 5: Sharingan libera e aparece o aviso');
 // olhar em cone: na frente (esquiva 0 e 50), atrás e longe
 await mobs(U,[[60,0,0],[50,20,50],[-60,0,0],[260,0,0]]);const mp0=await U.evaluate(()=>p.mp);
 const r0=await U.evaluate(()=>({raw:hitRaw(16,'ninjutsu'),it:hitRaw(16,'@ninjutsu'),esq:D().esq,prec:D().prec}));
 await U.evaluate(()=>useBtn(1));await W(120);
 const s1=await U.evaluate(()=>({on:EYE.on,st:E.map(e=>+e.stun.toFixed(2)),raw:hitRaw(16,'ninjutsu'),it:hitRaw(16,'@ninjutsu'),esq:D().esq,prec:D().prec,mp:p.mp,cone:fx.some(f=>f.k==='cone'),chip:$('#bufs').textContent}));
 ok(s1.on==='shar'&&s1.cone,'liga o Sharingan e o olhar sai em cone');
 ok(s1.st[0]>.8&&s1.st[1]>.3&&s1.st[1]<.5&&s1.st[2]===0&&s1.st[3]===0,'paralisa só quem está na frente: 1 s (esquiva 0) e 0,5 s (esquiva 50); atrás e longe, nada ('+s1.st.join(', ')+')');
 ok(Math.abs(s1.prec-r0.prec-10)<.01&&Math.abs(s1.esq-r0.esq-8)<.01,'ligado: +10 de precisão e +8 de esquiva');
 ok(Math.abs(s1.raw/r0.raw-1.1)<.001&&Math.abs(s1.it/r0.it-1)<.001,'+10% de dano nos jutsus do clã (o item da mão não ganha)');
 ok(Math.abs(mp0-s1.mp-10)<1.5&&/Sharingan ligado/.test(s1.chip),'gasta 10 de chakra para ligar; chip "Sharingan ligado"');
 await U.screenshot({path:__dirname+'/ju_shar.png'});
 const m1=await U.evaluate(()=>p.mp);await W(1000);const m2=await U.evaluate(()=>p.mp);ok(m1-m2>4.5&&m1-m2<7.5,'ligado gasta ~6 de chakra por segundo e o chakra não volta ('+(m1-m2).toFixed(1)+'/s)');
 b1=await btn(U,1);ok(b1.on,'botão do meio fica aceso enquanto o olho está ligado');
 await U.evaluate(()=>useBtn(1));const off=await U.evaluate(()=>({on:EYE.on,cd:cd[1],prec:D().prec}));ok(!off.on&&off.cd>5&&Math.abs(off.prec-r0.prec)<.01,'tocar de novo desliga: reforço sai e a recarga começa ('+off.cd.toFixed(1)+' s)');
 const m3=await U.evaluate(()=>p.mp);await W(600);ok(await U.evaluate(()=>p.mp)>m3,'desligado, o chakra volta a encher');
 await U.evaluate(()=>{cd[1]=0;p.mp=12;useBtn(1)});await W(700);ok(await U.evaluate(()=>!EYE.on&&/sem chakra/.test(ONL.reg.map(r=>r.t).join('|'))),'sem chakra: o Sharingan desliga sozinho');
 // 2 e 3 tomoe
 await lvTo(U,15);await U.evaluate(()=>{cd[1]=0;p.mp=p.mpMax});await mobs(U,[[60,0,0]]);await U.evaluate(()=>useBtn(1));await W(100);
 ok(await U.evaluate(()=>EYE.lv===2&&Math.abs(E[0].stun-1.25)<.25&&bufSum().prec===15),'Nv 15: 2 tomoe (paralisa 1,25 s, +15 de precisão)');await U.evaluate(()=>useBtn(1));
 await lvTo(U,25);await U.evaluate(()=>{cd[1]=0;p.mp=p.mpMax});await U.evaluate(()=>useBtn(1));await W(100);ok(await U.evaluate(()=>EYE.lv===3&&bufSum().cdmg===20),'Nv 25: 3 tomoe (+20% de dano do clã)');await U.evaluate(()=>useBtn(1));
 // Nv 40 sem escolher o olho: o Susanoo só libera no Nv 60 (planilha)
 await lvTo(U,40);await W(200);b1=await btn(U,1);b2=await btn(U,2);
 ok(/Sharingan/.test(b1.t)&&b2.lock&&/Nv 60/.test(b2.t),'Nv 40 sem olho: meio continua Sharingan e o grande fica 🔒 Nv 60');
 await U.evaluate(()=>useBtn(2));await W(150);ok(await U.evaluate(()=>/libera no Nv 60/.test($('#toast').textContent)),'tocar no grande explica que o Susanoo libera no Nv 60');
 await U.evaluate(()=>{toggleBag(true,'ju');juSel='mgk';juDraw()});await W(250);
 await U.screenshot({path:__dirname+'/ju_tab40.png'});
 await U.evaluate(()=>{const b=document.querySelector('#paneJu [data-eye=itachi]');b.click()});await W(200);
 ok(await U.evaluate(()=>CH.mgk==='itachi'&&JSON.parse(localStorage.getItem(chKey())).mgk==='itachi'),'Nv 40: escolheu a Mangekyō de Itachi na aba Jutsus (salva)');
 await U.screenshot({path:__dirname+'/ju_tab40b.png'});await U.evaluate(()=>toggleBag(false));await W(150);
 b1=await btn(U,1);b2=await btn(U,2);ok(/Mangekyō/.test(b1.t)&&b2.lock&&/Nv 60/.test(b2.t),'Mangekyō toma o lugar do Sharingan; o grande continua 🔒 Nv 60');
 await mobs(U,[[70,0,0],[0,70,0]]);await U.evaluate(()=>{cd[1]=0;p.mp=p.mpMax;useBtn(1)});await W(200);
 const mg=await U.evaluate(()=>({on:EYE.on,prec:bufSum().prec,cdmg:bufSum().cdmg,st:E.map(e=>+e.stun.toFixed(2))}));
 ok(mg.on==='mgk'&&mg.prec===25&&mg.cdmg===30&&mg.st[0]>1.6,'Mangekyō ligada: olhar mais forte (2 s) e +25 de precisão, +30% de dano');
 await U.screenshot({path:__dirname+'/ju_mgk.png'});
 await U.evaluate(()=>{cd[2]=0;p.mp=p.mpMax;useBtn(2)});await W(300);ok(await U.evaluate(()=>!SUS&&!susOn()),'Nv 40 com a Mangekyō ligada: Susanoo ainda não sai');
 await U.evaluate(()=>useBtn(1));await W(100);
 // Nv 60: Susanoo libera (só com a Mangekyō ligada)
 await lvTo(U,60);await W(250);b2=await btn(U,2);const rg60=await U.evaluate(()=>ONL.reg.map(r=>r.t).join('|'));console.log('   b2:',JSON.stringify(b2),'| registro:',rg60.slice(-160));ok(!b2.lock&&/Susanoo/.test(b2.t)&&b2.off&&/Jutsu liberado no Nv 60: Susanoo/.test(rg60),'Nv 60: Susanoo libera (apagado até ligar a Mangekyō) e avisa');
 await U.evaluate(()=>{cd[1]=0;cd[2]=0;p.mp=p.mpMax;useBtn(2)});await W(150);ok(await U.evaluate(()=>!SUS&&/Mangekyō ligada/.test($('#toast').textContent)),'Susanoo sem a Mangekyō ligada: não sai e explica');
 await mobs(U,[[70,0,0],[0,70,0]]);await U.evaluate(()=>{cd[1]=0;p.mp=p.mpMax;useBtn(1)});await W(200);
 await U.evaluate(()=>{p.mp=p.mpMax;useBtn(2)});await W(800);
 const su=await U.evaluate(()=>({on:susOn(),red:D().red,au:fx.some(f=>f.sus&&f.bh),hp:E[0].hp,b2:$('#b2').classList.contains('eyeon')}));
 ok(su.on&&su.au&&su.red>=50&&su.hp<5000&&su.b2,'Susanoo de Itachi invocado: ataca, fica de pé e −50% de dano recebido');
 await U.screenshot({path:__dirname+'/ju_sus.png'});
 const d1=await U.evaluate(()=>p.mp);await W(1000);const d2=await U.evaluate(()=>p.mp);ok(d1-d2>10&&d1-d2<14,'Mangekyō + Susanoo gastam ~12 de chakra por segundo ('+(d1-d2).toFixed(1)+')');
 await U.evaluate(()=>useBtn(1));await W(100);const of2=await U.evaluate(()=>({sus:susOn(),fx:fx.some(f=>f.sus),red:BUFS.sus,cd:cd[1]}));
 ok(!of2.sus&&!of2.fx&&!of2.red&&of2.cd>8,'desligar a Mangekyō desfaz o Susanoo; recarga maior ('+of2.cd.toFixed(1)+' s)');
 // trocar de olho pede confirmação
 await U.evaluate(()=>toggleBag(true,'ju'));await W(150);await U.evaluate(()=>{juSel='mgk';juDraw();document.querySelector('#paneJu [data-eye=madara]').click()});await W(100);
 const c1=await U.evaluate(()=>({m:CH.mgk,b:document.querySelector('#paneJu [data-eye=madara]').textContent}));
 await U.evaluate(()=>document.querySelector('#paneJu [data-eye=madara]').click());await W(100);
 ok(c1.m==='itachi'&&/Confirmar/.test(c1.b)&&await U.evaluate(()=>CH.mgk==='madara'),'trocar de olho pede confirmação (Itachi → Madara)');
 await U.evaluate(()=>toggleBag(false));
 // derrotado com o olho ligado
 await U.evaluate(()=>{cd[1]=0;p.mp=p.mpMax;useBtn(1)});await W(100);await U.evaluate(()=>{HPREC=-999;const r=Math.random;Math.random=()=>.99;p.hp=1;hurt(999);Math.random=r});
 ok(await U.evaluate(()=>!EYE.on&&!bufOn()),'derrotado: o olho desliga');
 const U2=await open(0,'Sasuke');await lvTo(U2,60);await W(200);const x2=await btn(U2,2);ok(x2.lock&&/escolha/.test(x2.t),'Nv 60 sem olho escolhido: o grande pede para escolher');
 await U2.evaluate(()=>useBtn(2));await W(300);ok(await U2.evaluate(()=>!$('#inv').hidden&&!$('#paneJu').hidden),'tocar nele abre a aba Jutsus para escolher');
 // ================= HYUGA / NARA =================
 const H=await open(1,'Neji');let h1=await btn(H,1),h2=await btn(H,2);ok(h1.lock&&/Nv 10/.test(h1.t)&&h2.lock&&/Nv 25/.test(h2.t),'Hyuga Nv 1: Kaiten 🔒 Nv 10 e 64 Palmas 🔒 Nv 25');
 await lvTo(H,10);await W(200);h1=await btn(H,1);ok(!h1.lock,'Hyuga Nv 10: Kaiten libera');await H.evaluate(()=>{cd[1]=0;p.mp=p.mpMax;useBtn(1)});await W(200);ok(await H.evaluate(()=>cd[1]>0),'Kaiten funciona');
 await H.evaluate(()=>toggleBag(true,'ju'));await W(200);await H.screenshot({path:__dirname+'/ju_hyuga.png'});
 const N=await open(2,'Shika');const n1=await btn(N,1);ok(n1.lock&&/Nv 10/.test(n1.t),'Nara Nv 1: Sombra 🔒 Nv 10');
 ok(!U._e.length&&!U2._e.length&&!H._e.length&&!N._e.length,'sem erros na página');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
