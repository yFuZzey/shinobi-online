// Entrega 7c: jutsus novos do Uchiha (modo offline) — árvore; Gōkakyū forte (bola grande que explode em área); Hōsenka (5 bolinhas em leque);
// Gōryūka (o chão avisa, depois explode em área); Genjutsu: Sharingan (confunde, passa ao levar dano); Amaterasu e Tsukuyomi (só com a
// Mangekyō ligada; Tsukuyomi não pega quem está de costas); sem alvo no alcance não gasta nada
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();
 const errs=[];pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO',e.message)});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Sasuke');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth=0');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{switchMap('vila_areia')});await W(400);
 const lvTo=v=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp)},v);
 const alvos=L=>pg.evaluate(L=>{autoOn=false;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];KDEL=[];P=[];
  const mk=(dx,dy,id,fl)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y+dy,dead:0,dt:0,rt:0,mv:0,fl:fl||0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id});
  E=L.map((q,i)=>mk(q[0],q[1],i+1,q[2]));window._hits=E.map(()=>0);window._last=E.map(e=>e.hp);window._watch=1;
  const f=()=>{E.forEach((e,i)=>{if(e.hp<_last[i])_hits[i]++;_last[i]=e.hp});if(window._watch)requestAnimationFrame(f)};requestAnimationFrame(f)},L);
 const tr=await pg.evaluate(()=>JT.uchiha.flatMap(B=>B.n).map(n=>n.id+':'+n.lv).join(' '));
 ok(/katon:1/.test(tr)&&/goka:1/.test(tr)&&/hosenka:20/.test(tr)&&/goryuka:30/.test(tr)&&/genj:15/.test(tr)&&/amat:45/.test(tr)&&/tsuku:50/.test(tr)&&/sus:60/.test(tr)&&!/soon/.test(tr),'árvore do Uchiha com os jutsus novos e os níveis da planilha ('+tr+')');
 ok(await pg.evaluate(()=>JT.uchiha.flatMap(B=>B.n).every(n=>!n.soon)),'Amaterasu e Tsukuyomi não estão mais "em breve"');
 // Gōkakyū forte: explode em área
 ok(await pg.evaluate(()=>barSet(3,'goka')&&/Gōkakyū/.test($('#b3').textContent)),'Nv 1: Gōkakyū forte no botão 3 (a Bola de Fogo rápida continua no 1)');
 await alvos([[150,0],[180,20],[320,0]]);await pg.evaluate(()=>{cast(3)});await W(1100);
 let r=await pg.evaluate(()=>_hits.slice());ok(r[0]===1&&r[1]===1&&r[2]===0,'a bola grande explode e pega quem está perto do alvo, não quem está longe ('+r.join(',')+')');
 // Hōsenka
 await lvTo(20);await pg.evaluate(()=>barSet(3,'hosenka'));await alvos([[110,0]]);await pg.evaluate(()=>{cast(3)});await W(900);
 r=await pg.evaluate(()=>({n:_hits[0],d:5000-E[0].hp}));ok(r.n>=3&&r.n<=5,'Hōsenka: várias bolinhas acertam o alvo ('+r.n+' de 5, '+r.d+' de dano)');
 // Gōryūka: aviso no chão e explosão em área
 await lvTo(30);await pg.evaluate(()=>barSet(3,'goryuka'));await alvos([[120,0],[150,30],[300,-60]]);await pg.evaluate(()=>{cast(3)});await W(300);
 const av=await pg.evaluate(()=>fx.some(f=>f.k==='aviso'));await W(600);r=await pg.evaluate(()=>_hits.slice());
 ok(av,'Gōryūka: o chão avisa antes de cair');ok(r[0]===1&&r[1]===1&&r[2]===0,'explode em área no alvo ('+r.join(',')+')');
 // Genjutsu: Sharingan
 await pg.evaluate(()=>barSet(3,'genj'));await alvos([[400,0]]);r=await pg.evaluate(()=>{const m=p.mp;cast(3);return{cd:cd[3],g:m-p.mp}});
 ok(r.cd===0&&r.g===0,'Genjutsu sem ninguém no alcance: não sai e não gasta nada');
 await alvos([[100,0]]);await pg.evaluate(()=>{cast(3)});await W(600);r=await pg.evaluate(()=>({conf:E[0].conf||0,n:_hits[0]}));
 ok(r.conf>.5&&r.n===1,'Genjutsu confunde o alvo ('+r.conf.toFixed(1)+' s)');
 await pg.evaluate(()=>{cd[0]=0;cast(0)});await W(700);ok(await pg.evaluate(()=>!(E[0].conf>0)),'… e passa quando ele leva dano');
 // Amaterasu (Mangekyō)
 await lvTo(45);await pg.evaluate(()=>{CH.mgk='itachi';chSave();barSet(3,'amat')});await alvos([[110,0]]);await W(150);
 r=await pg.evaluate(()=>{const m=p.mp;cast(3);return{cd:cd[3],g:m-p.mp,off:$('#b3').classList.contains('off')}});ok(r.cd===0&&r.g===0&&r.off,'Amaterasu sem a Mangekyō ligada: botão apagado, não sai, não gasta '+JSON.stringify(r));
 await pg.evaluate(()=>{p.mp=p.mpMax;cd[1]=0;useBtn(1)});await W(200);ok(await pg.evaluate(()=>EYE.on==='mgk'),'liga a Mangekyō');
 await pg.evaluate(()=>{p.mp=p.mpMax;cast(3)});await W(3300);r=await pg.evaluate(()=>_hits[0]);ok(r>=3,'Amaterasu: golpe + queimas por segundo ('+r+' acertos em 3,3 s)');
 // Tsukuyomi: de frente atordoa, de costas não
 await lvTo(50);await pg.evaluate(()=>{barSet(0,'tsuku');p.mp=p.mpMax;if(EYE.on!=='mgk'){cd[1]=0;useBtn(1)}});await W(200);ok(await pg.evaluate(()=>BAR[0]==='tsuku'&&EYE.on==='mgk'),'Nv 50: Tsukuyomi no botão 1');
 await alvos([[100,0,1]]);await pg.evaluate(()=>{p.mp=p.mpMax;if(EYE.on!=='mgk'){cd[1]=0;useBtn(1)}cast(0)});await W(1000);r=await pg.evaluate(()=>({st:E[0].stun,n:_hits[0]}));
 ok(r.st>.8&&r.n===1,'Tsukuyomi no alvo virado para você: atordoa ('+r.st.toFixed(1)+' s)');
 await alvos([[155,0,0]]);await pg.evaluate(()=>{p.mp=p.mpMax;if(EYE.on!=='mgk'){cd[1]=0;useBtn(1)}cast(0)});await W(1000);r=await pg.evaluate(()=>({st:E[0].stun,n:_hits[0]}));
 ok(r.st===0&&r.n===1,'… virado de costas: leva o dano mas não fica atordoado');
 await pg.screenshot({path:__dirname+'/uchiha_tsuku.png'});
 // aba Jutsus
 await pg.evaluate(()=>{toggleBag(true,'ju');juSel='amat';juDraw()});await W(200);const tx=await pg.evaluate(()=>$('#paneJu .jdet').textContent);
 ok(/Só com a Mangekyō ativada/.test(tx)&&/queimas/.test(tx),'aba Jutsus explica a Amaterasu (só com a Mangekyō, queimas por segundo)');
 await pg.screenshot({path:__dirname+'/uchiha_tab.png'});
 ok(!errs.length,'sem erros na página');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
