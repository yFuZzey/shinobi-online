// Entrega 7d: jutsus novos do Hyuga (modo offline) — árvore; Byakugan (liga/desliga, +precisão, gasta chakra por segundo, encurta genjutsu);
// Hakke Kūshō (acerta o primeiro da linha e empurra ~3 tiles); 128 Palmas (evolução: toma o lugar das 64 no Nv 45, mais golpes);
// Sōjishi (cones para a frente e para trás, deixa lento); Kaiten Perfeito (ultimate: área, força dividida, bloqueia enquanto gira)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();
 const errs=[];pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO',e.message)});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Hinata');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth=1');await pg.waitForFunction(()=>cur==='game'&&KFX_OK&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{switchMap('vila_areia')});await W(400);
 const lvTo=v=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp)},v);
 const alvos=L=>pg.evaluate(L=>{autoOn=false;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];KDEL=[];P=[];ACT=null;
  const mk=(dx,dy,id)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y+dy,dead:0,dt:0,rt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id});
  E=L.map((q,i)=>mk(q[0],q[1],i+1));window._hits=E.map(()=>0);window._last=E.map(e=>e.hp);window._watch=1;
  const f=()=>{E.forEach((e,i)=>{if(e.hp<_last[i])_hits[i]++;_last[i]=e.hp});if(window._watch)requestAnimationFrame(f)};requestAnimationFrame(f)},L);
 const tr=await pg.evaluate(()=>JT.hyuga.flatMap(B=>B.n).map(n=>n.id+':'+n.lv).join(' '));
 ok(/palma:1/.test(tr)&&/byak:5/.test(tr)&&/kaiten:10/.test(tr)&&/kusho:15/.test(tr)&&/hakke:20/.test(tr)&&/h128:45/.test(tr)&&/sojishi:55/.test(tr)&&/kperf:60/.test(tr),'árvore do Hyuga com os jutsus novos ('+tr+')');
 ok(await pg.evaluate(()=>JSON.stringify(BAR)===JSON.stringify(['palma','kaiten','hakke','item'])),'barra padrão continua a de antes');
 // Byakugan
 await lvTo(5);ok(await pg.evaluate(()=>barSet(3,'byak')),'Nv 5: Byakugan no botão 3');
 let r=await pg.evaluate(()=>{p.mp=p.mpMax;window._pr0=D().prec;useBtn(3);return 1});await W(150);r=await pg.evaluate(()=>({on:BYK.on,dp:D().prec-_pr0,cls:$('#b3').classList.contains('eyeon')}));
 ok(r.on&&r.dp===10&&r.cls,'liga: +10 de precisão e o botão acende');
 const m0=await pg.evaluate(()=>p.mp);await W(1000);const m1=await pg.evaluate(()=>p.mp);ok(m1<m0,'gasta chakra enquanto está ligado ('+Math.round(m0)+' → '+Math.round(m1)+')');
 r=await pg.evaluate(()=>onlMeta().rg);ok(r===15,'ligado, avisa o servidor: genjutsu em você dura 15% menos (resistência '+r+'%)');
 r=await pg.evaluate(()=>{PCF=0;useBtn(3);return{on:BYK.on,cd:cd[3],buf:!!BUFS.byak,rg:onlMeta().rg}});ok(!r.on&&r.cd>10&&!r.buf&&r.rg===0,'desliga: some o reforço e a resistência, e entra em recarga ('+r.cd.toFixed(1)+' s)');
 // Kūshō
 await lvTo(15);await pg.evaluate(()=>barSet(3,'kusho'));await alvos([[130,0],[300,0]]);const d0=await pg.evaluate(()=>E[0].x-p.x);
 await pg.evaluate(()=>{p.ax=1;p.ay=0;cast(3)});await W(800);r=await pg.evaluate(()=>({d:E[0].x-p.x,h:_hits.slice()}));
 ok(r.h[0]===4&&r.h[1]===0,'Kūshō acerta só o primeiro da linha ('+r.h.join(',')+')');ok(r.d-d0>=60,'… e empurra longe ('+Math.round(d0)+' → '+Math.round(r.d)+' px)');
 // 128 Palmas: evolução no Nv 45
 await lvTo(44);ok(await pg.evaluate(()=>BAR[2]==='hakke'),'Nv 44: 64 Palmas no botão grande');
 await lvTo(45);await W(300);ok(await pg.evaluate(()=>BAR[2]==='h128'&&/128 Palmas/.test($('#b2').textContent)),'Nv 45: as 64 Palmas evoluem para 128 Palmas no mesmo botão');
 await alvos([[28,0],[150,0]]);await pg.evaluate(()=>{cast(2)});await W(1400);r=await pg.evaluate(()=>_hits.slice());
 ok(r[0]>=11&&r[1]===0,'128 Palmas: '+r[0]+' golpes seguidos no alvo perto, nenhum no longe');
 ok(await pg.evaluate(()=>barSet(2,'hakke')&&BAR[2]==='hakke'),'dá para voltar para as 64 Palmas');
 // Sōjishi: frente e trás
 await lvTo(55);await pg.evaluate(()=>barSet(3,'sojishi'));await alvos([[70,0],[-70,0],[0,-80]]);await pg.evaluate(()=>{p.ax=1;p.ay=0;cast(3)});await W(800);
 r=await pg.evaluate(()=>({h:_hits.slice(),slw:E.map(e=>e.slw||0)}));
 ok(r.h[0]===1&&r.h[1]===1&&r.h[2]===0,'Sōjishi pega quem está na frente e atrás, não do lado ('+r.h.join(',')+')');ok(r.slw[0]>0&&r.slw[1]>0,'… e deixa lento');
 // Kaiten Perfeito: força dividida entre os alvos
 await lvTo(60);ok(await pg.evaluate(()=>barSet(2,'kperf')),'Nv 60: Kaiten Perfeito no botão grande');
 await alvos([[50,0]]);await pg.evaluate(()=>{cast(2)});await W(1200);const um=await pg.evaluate(()=>5000-E[0].hp);
 await alvos([[50,0],[-50,0]]);await pg.evaluate(()=>{cast(2)});await W(1200);const dois=await pg.evaluate(()=>E.map(e=>5000-e.hp));
 ok(um>0&&dois[0]>0&&dois[1]>0&&dois[0]<um*.75,'Kaiten Perfeito: com 2 alvos a força é dividida ('+um+' em 1 alvo; '+dois.join(' + ')+' em 2)');
 await pg.evaluate(()=>{toggleBag(true,'ju');juSel='kperf';juDraw()});await W(200);
 ok(/Força dividida entre os alvos/.test(await pg.evaluate(()=>$('#paneJu .jdet').textContent)),'aba Jutsus explica o Kaiten Perfeito');
 await pg.screenshot({path:__dirname+'/hyuga_tab.png'});
 ok(!errs.length,'sem erros na página');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
