// Entrega 7b: jutsus novos do Nara (modo offline) — árvore e barra; Kage Nui (persegue, 3 agulhas, deixa lento); Kubishibari (só em quem
// está preso na sombra; aperta várias vezes); Kageyose (puxa ~3 tiles); Campo de Sombras (área: lento + menos dano recebido);
// Intelecto Nara (passiva: −10% de recarga nas sombras, não vai para a barra); Domínio das Sombras (ultimate do Nv 60, prende a área);
// silêncio e lentidão recebidos (PvP) bloqueiam/atrasam do jeito certo
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();
 const errs=[];pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO',e.message)});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Shikamaru');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await pg.click('.card >> nth=2');await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{switchMap('vila_areia')});await W(400);
 const lvTo=v=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp)},v);
 // alvos de teste: parados (wt/atk altos) ou correndo atrás de você (anda)
 const alvos=L=>pg.evaluate(L=>{autoOn=false;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];PRT=0;PSI=0;SOMBRA_PRESOS.clear();KDEL=[];
  const mk=(dx,dy,id)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y+dy,dead:0,dt:0,rt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id});
  E=L.map((q,i)=>mk(q[0],q[1],i+1));window._hits=E.map(()=>0);window._last=E.map(e=>e.hp);window._watch=1;
  const f=()=>{E.forEach((e,i)=>{if(e.hp<_last[i])_hits[i]++;_last[i]=e.hp});if(window._watch)requestAnimationFrame(f)};requestAnimationFrame(f)},L);
 // árvore
 const tr=await pg.evaluate(()=>JT.nara.flatMap(B=>B.n).map(n=>n.id+':'+n.lv).join(' '));
 ok(/nui:15/.test(tr)&&/kubi:20/.test(tr)&&/yose:40/.test(tr)&&/campo:45/.test(tr)&&/intelecto:50/.test(tr)&&/dominio:60/.test(tr)&&/sombra:1/.test(tr)&&/poss:30/.test(tr),'árvore do Nara com os jutsus novos e os níveis da planilha ('+tr+')');
 ok(await pg.evaluate(()=>JSON.stringify(BAR)===JSON.stringify(['shuri','sombra','poss','item'])),'barra padrão continua a de antes');
 ok(await pg.evaluate(()=>!barSet(3,'nui')),'Kage Nui travado no Nv 1 (não entra na barra)');
 // Kage Nui
 await lvTo(15);ok(await pg.evaluate(()=>barSet(3,'nui')&&/Kage Nui/.test($('#b3').textContent)),'Nv 15: Kage Nui no botão 3 (no lugar do item)');
 await pg.evaluate(()=>toggleBag(true,'ju'));await W(200);await pg.evaluate(()=>{juSel='nui';juDraw()});await W(150);
 const tx=await pg.evaluate(()=>$('#paneJu .jdet').textContent);ok(/Deixa lento 25% por 1,5 s/.test(tx)&&/Força 130%/.test(tx),'aba Jutsus mostra força, lentidão e o resto do Kage Nui');
 await pg.screenshot({path:__dirname+'/nara_tab.png'});await pg.evaluate(()=>toggleBag(false));
 await alvos([[150,50]]);const gasto=await pg.evaluate(()=>{const m=p.mp;cast(3);return m-p.mp});await W(520);
 await pg.evaluate(()=>{E[0].y-=46});await W(900); // o alvo "desvia" um pouco depois do lançamento: as agulhas viram atrás dele
 let r=await pg.evaluate(()=>({n:_hits[0],hp:E[0].hp,slw:E[0].slw||0,slp:E[0].slp,mp:p.mp,mx:p.mpMax,cd:cd[3]}));
 ok(r.n===3,'as 3 agulhas acertam (mesmo com o alvo mudando de lugar): '+r.n+' acertos, '+(5000-r.hp)+' de dano');
 ok(r.slw>0&&r.slp===25,'alvo fica 25% mais lento ('+r.slw.toFixed(1)+' s restantes)');
 ok(Math.abs(gasto-Math.round(r.mx*.12))<=1&&r.cd>7,'custa 12% do chakra ('+gasto+' de '+r.mx+') e entra em recarga ('+r.cd.toFixed(1)+' s)');
 // o lento funciona de verdade: o monstro anda menos
 const anda=async slw=>{await alvos([[110,0]]);return pg.evaluate(async slw=>{const e=E[0];e.wt=0;e.atk=0;e.slw=slw;e.slp=25;const x0=e.x;await new Promise(r=>setTimeout(r,500));return x0-e.x},slw)};
 const a0=await anda(0),a1=await anda(5);ok(a0>10&&a1/a0>.6&&a1/a0<.9,'monstro lento anda ~25% menos ('+a0.toFixed(0)+' px → '+a1.toFixed(0)+' px em 0,5 s)');
 // Kubishibari
 await lvTo(20);await pg.evaluate(()=>{barSet(0,'kubi')});ok(await pg.evaluate(()=>BAR[0]==='kubi'&&BAR[1]==='sombra'),'Nv 20: Kubishibari no botão 1');
 await alvos([[120,0],[-150,0]]);r=await pg.evaluate(()=>{const m=p.mp;cast(0);return{cd:cd[0],gasto:m-p.mp}});
 ok(r.cd===0&&r.gasto===0,'Kubishibari sem ninguém preso na sombra: não sai e não gasta nada');
 await pg.evaluate(()=>{p.ax=1;p.ay=0;cast(1)});await W(700);ok(await pg.evaluate(()=>sombraPresos().length===1&&sombraPresos()[0]===E[0]),'Kagemane prendeu o alvo da frente');
 await pg.evaluate(()=>{window._h0=_hits.slice();cast(0)});await W(2900);
 r=await pg.evaluate(()=>({a:_hits[0]-_h0[0],b:_hits[1]-_h0[1],cd:cd[0]}));
 ok(r.a===5&&r.b===0,'Kubishibari aperta só quem está preso: 1 + 4 apertos no alvo preso, 0 no outro ('+r.a+'/'+r.b+')');
 // Kageyose
 await lvTo(40);await pg.evaluate(()=>{barSet(3,'yose')});await alvos([[210,0]]);
 const d0=await pg.evaluate(()=>E[0].x-p.x);await pg.evaluate(()=>{p.ax=1;p.ay=0;cast(3)});await W(1100);
 r=await pg.evaluate(()=>({d:E[0].x-p.x,n:_hits[0]}));ok(d0-r.d>=80&&r.d>=26&&r.n===4,'Kageyose puxa o alvo ~3 tiles ('+Math.round(d0)+' → '+Math.round(r.d)+' px, 4 puxões)');
 // Campo de Sombras
 await lvTo(45);await pg.evaluate(()=>{barSet(3,'campo')});await alvos([[70,0],[300,0]]);await pg.evaluate(()=>{cast(3)});await W(2900);
 r=await pg.evaluate(()=>({buf:BUFS.campo&&BUFS.campo.red,red:D().red,a:_hits[0],b:_hits[1],slw:E[0].slw||0}));
 ok(r.buf===10,'Campo de Sombras: você recebe −10% de dano enquanto ele dura');ok(r.a>=2&&r.b===0&&r.slw>0,'quem está dentro fica lento a cada segundo ('+r.a+' toques); quem está fora, nada');
 // Intelecto Nara (passiva)
 const c49=await pg.evaluate(()=>{CH.lv=49;return cdOf(1,JU.nara.sombra)});await pg.evaluate(()=>{CH.lv=45});await lvTo(50);const c50=await pg.evaluate(()=>cdOf(1,JU.nara.sombra));
 ok(Math.abs(c50/c49-.9)<.01,'Nv 50, Intelecto Nara: Kagemane recarrega 10% mais rápido ('+c49.toFixed(2)+' → '+c50.toFixed(2)+' s)');
 ok(await pg.evaluate(()=>Math.abs(cdOf(0,JU.nara.shuri)-cdOf(0,{cd:JU.nara.shuri.cd}))<.001),'… e não mexe em quem não é de sombra (Shuriken)');
 ok(await pg.evaluate(()=>!barSet(0,'intelecto')&&!barSet(2,'intelecto')),'passiva não entra na barra');
 // Domínio das Sombras
 await lvTo(60);ok(await pg.evaluate(()=>!barSet(1,'dominio')&&barSet(2,'dominio')&&/Domínio/.test($('#b2').textContent)),'Nv 60: Domínio das Sombras só no botão grande');
 await alvos([[60,0],[-70,30],[0,-80],[260,0]]);await pg.evaluate(()=>{cast(2)});await W(1200);
 r=await pg.evaluate(()=>({h:_hits.slice(),st:E.map(e=>+(e.stun||0).toFixed(1)),pres:sombraPresos().length}));
 ok(r.h[0]===1&&r.h[1]===1&&r.h[2]===1&&r.h[3]===0,'pega todo mundo dentro da área e ninguém fora ('+r.h.join(',')+')');ok(r.st[0]>.5&&r.st[3]===0&&r.pres===3,'os da área ficam presos (e contam para o Kubishibari)');
 // efeitos recebidos (PvP): silêncio + preso juntos; lento
 await pg.evaluate(()=>{barSet(0,'shuri');cd=[0,0,0,0];p.mp=p.mpMax;ccRecebe([{k:'root',t:1},{k:'silencio',t:1.5}],'Teste')});
 r=await pg.evaluate(()=>{useBtn(1);const c1=cd[1];cast(0);return{prt:PRT,psi:PSI,c1,c0:cd[0],chip:ccChips()}});
 ok(r.prt>0&&r.psi>0&&/Silenciado/.test(r.chip),'preso + silenciado no mesmo golpe (lista de 2 efeitos)');ok(r.c1===0&&r.c0>0,'silenciado: jutsu não sai, o golpe básico sai');
 const s0=await pg.evaluate(()=>D().spd);await pg.evaluate(()=>ccRecebe({k:'lento',t:1.5,v:25},'Teste'));const s1=await pg.evaluate(()=>D().spd);
 ok(Math.abs(s0-s1-25)<.01,'lento recebido: −25% de velocidade ('+s0+' → '+s1+')');await W(1700);ok(await pg.evaluate(()=>!BUFS.lento&&PSI===0),'… e passa sozinho');
 ok(!errs.length,'sem erros na página');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
