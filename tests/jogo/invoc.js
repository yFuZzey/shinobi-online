// Entrega 11 (planilha 11): contrato de invocação (modo offline) — ramo na árvore de todos os clãs (Nv 11); um contrato por vez;
// passivas (sapo +5% de vida, lesma +5% de cura, cobra +4% de dano contínuo); a invocação entra na barra como jutsu;
// Gamabunta: escudo de 15% da vida (segura antes da vida e quebra); Katsuyu: cura 12% em 6 s; Manda: precisa de alvo, o selo avisa,
// quem sai do selo escapa, morde e envenena (monstro: mais 6 toques); trocar de contrato pede 24 h e põe a invocação em recarga
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const SHOT=process.env.SHOT||'';
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:844,height:390}});const pg=await ctx.newPage();
 const errs=[];pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO',e.message)});pg.on('console',m=>{if(m.type()==='error'){errs.push(m.text());console.log('ERRO (console)',m.text())}});
 const PAG='file://'+require('path').join(__dirname,'..','paginas','off.html');
 await pg.goto(PAG);await pg.fill('#u','Kuchi');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth=0');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{switchMap('vila_areia')});await W(400);
 const lvTo=v=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp)},v);
 const alvos=L=>pg.evaluate(L=>{autoOn=false;INVA=null;SHT=null;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];KDEL=[];
  const mk=(dx,dy,id)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y+dy,dead:0,dt:0,rt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id});
  E=L.map((q,i)=>mk(q[0],q[1],i+1));window._hits=E.map(()=>0);window._last=E.map(e=>e.hp);window._watch=1;
  const f=()=>{E.forEach((e,i)=>{if(e.hp<_last[i])_hits[i]++;_last[i]=e.hp});if(window._watch)requestAnimationFrame(f)};requestAnimationFrame(f)},L);
 // árvore e barra
 const tr=await pg.evaluate(()=>Object.keys(JT).map(c=>c+':'+JT[c].some(B=>B.b==='Contrato de invocação'&&B.n.some(n=>n.id==='kuchi'&&n.lv===11))).join(' '));
 ok(tr==='uchiha:true hyuga:true nara:true','ramo "Contrato de invocação" (Nv 11) nos 3 clãs ('+tr+')');
 ok(await pg.evaluate(()=>JSON.stringify(BAR)===JSON.stringify(['katon','olho','sus','item'])),'barra padrão continua a de antes');
 ok(await pg.evaluate(()=>!barSet(0,'kuchi')),'Nv 1: invocação travada (não entra na barra)');
 const hp10=await pg.evaluate(()=>{let g=0;while(CH.lv<10&&g++<50)gainXp(xpNeed(CH.lv)-CH.xp);return p.max});
 await lvTo(11);await W(2300);
 ok(await pg.evaluate(()=>ONL.reg.some(r=>/Contrato de invocação liberado/.test(r.t))),'Nv 11: avisa que o contrato liberou');
 ok(await pg.evaluate(()=>barSet(0,'kuchi')&&/contrato/.test($('#b0').textContent)&&$('#b0').classList.contains('lock')),'invocação na barra sem contrato: botão pede o contrato');
 await pg.evaluate(()=>useBtn(0));await W(300);
 ok(await pg.evaluate(()=>!$('#paneJu').hidden&&juSel==='kuchi'),'tocar no botão sem contrato abre a aba Jutsus no contrato');
 let tx=await pg.evaluate(()=>$('#paneJu').textContent);
 ok(/Escolha o seu contrato/.test(tx)&&/Sapos/.test(tx)&&/Lesmas/.test(tx)&&/Cobras/.test(tx)&&/Corvos/.test(tx),'aba Jutsus lista as famílias');
 ok(await pg.evaluate(()=>['corvo','falcao','cao','cervo'].every(k=>$('[data-ct='+k+']').disabled&&/Em breve/.test($('[data-ct='+k+']').textContent))&&['sapo','lesma','cobra'].every(k=>!$('[data-ct='+k+']').disabled)),'sapo, lesma e cobra liberados; corvos, falcões, cães e cervos "em breve"');
 if(SHOT)await pg.screenshot({path:SHOT+'_aba.png'});
 // Sapo
 const hp0=await pg.evaluate(()=>{CH.st.vit=30;CH.st.int=20;stats();p.hp=p.max;p.mp=p.mpMax;juDraw();return p.max});await pg.click('[data-ct=sapo]');await W(200);
 let r=await pg.evaluate(()=>({k:CH.ct.k,t:CH.ct.t,max:p.max,nm:$('#b0').textContent,lk:$('#b0').classList.contains('lock'),sv:JSON.parse(localStorage.getItem(chKey())).ct}));
 ok(r.k==='sapo'&&r.sv&&r.sv.k==='sapo'&&Date.now()-r.t<60000,'escolheu Sapos (salvo no personagem)');
 ok(Math.abs(r.max-hp0*1.05)<=1.5,'passiva dos sapos: +5% de vida ('+hp0+' → '+r.max+')');
 ok(/Gamabunta/.test(r.nm)&&!r.lk,'botão vira "Gamabunta"');
 tx=await pg.evaluate(()=>{juDraw();return $('#paneJu .jdet').textContent});ok(/15% da sua vida/.test(tx)&&/Atual/.test(tx),'aba Jutsus mostra o escudo do Gamabunta e o contrato atual');
 await pg.evaluate(()=>toggleBag(false));await alvos([]);
 r=await pg.evaluate(()=>{const m=p.mp;cast(0);return{gasto:m-p.mp,mx:p.mpMax,cd:cd[0],k:INVA&&INVA.k,sh:SHT&&SHT.v,max:p.max}});
 ok(r.k==='sapo'&&r.sh===Math.round(r.max*.15),'Gamabunta em campo com escudo de '+r.sh+' (15% de '+r.max+')');
 ok(Math.abs(r.gasto-Math.round(r.mx*.12))<=1&&r.cd>60,'custa 12% do chakra ('+r.gasto+') e recarga de '+r.cd.toFixed(0)+' s');
 await W(700);if(SHOT)await pg.screenshot({path:SHOT+'_sapo.png'});
 r=await pg.evaluate(()=>{const h=p.hp;hurtFix(20,0,0);return{d:h-p.hp,sh:SHT&&SHT.v,pa:!!INVA.f.pa}});
 ok(r.d===0&&r.sh===Math.round((await pg.evaluate(()=>p.max))*.15)-20&&r.pa,'golpe de 20: o escudo segura tudo (sobra '+r.sh+') e o Gamabunta defende');
 r=await pg.evaluate(()=>{const h=p.hp,s=SHT.v;hurtFix(100,0,0);return{d:h-p.hp,s}});await W(100);
 ok(r.d===100-r.s&&await pg.evaluate(()=>!INVA&&!SHT),'golpe maior que o escudo: passa só o resto ('+r.d+') e o Gamabunta vai embora');
 ok(await pg.evaluate(()=>ONL.reg.some(r=>/escudo do Gamabunta quebrou/.test(r.t))),'registro avisa que o escudo quebrou');
 // não acumula com o Susanoo além do teto (40%)
 r=await pg.evaluate(()=>{cd[0]=0;SHD={v:Math.round(p.max*.35),max:1,until:performance.now()+9000};cast(0);const v=SHT.v;invEnd();SHD=null;return{v,max:p.max}});
 ok(r.v===Math.round(r.max*.4)-Math.round(r.max*.35),'com o escudo do Susanoo (35%), o do sapo completa só até 40% ('+r.v+')');
 // troca: 24 h e recarga
 r=await pg.evaluate(()=>{cd[0]=0;ctChoose('lesma');return CH.ct.k});ok(r==='sapo','trocar logo depois de escolher: não deixa (24 h)');
 r=await pg.evaluate(()=>{CH.ct.t-=25*3600e3;ctChoose('lesma');const a=CH.ct.k;ctChoose('lesma');return{a,b:CH.ct.k,cd:cd[0],max:p.max}});
 ok(r.a==='sapo'&&r.b==='lesma','depois de 24 h: pede confirmação e troca para Lesmas');
 ok(r.cd>60&&Math.abs(r.max-hp0)<=1,'trocar põe a invocação em recarga ('+r.cd.toFixed(0)+' s) e tira a passiva do sapo (vida '+r.max+')');
 // Lesma: cura 12% em 6 s (+5% da passiva)
 await alvos([]);r=await pg.evaluate(async()=>{const rv=BAL.personagem.regenVida;BAL.personagem.regenVida=0;p.hp=Math.round(p.max*.4);const h=p.hp;cd[0]=0;cast(0);const k=INVA&&INVA.k;
  await new Promise(r=>setTimeout(r,900));window._sl=1;await new Promise(r=>setTimeout(r,6400));BAL.personagem.regenVida=rv;return{k,cura:p.hp-h,max:p.max}});
 ok(r.k==='lesma'&&Math.abs(r.cura-r.max*.12*1.05)<=2,'Katsuyu cura '+r.cura.toFixed(1)+' em 6 s (12% × 1,05 de '+r.max+' = '+(r.max*.12*1.05).toFixed(1)+')');
 // Cobra: alvo no alcance, selo, mordida e veneno
 await pg.evaluate(()=>{CH.ct.t-=25*3600e3;ctChoose('cobra');ctChoose('cobra')});ok(await pg.evaluate(()=>CH.ct.k==='cobra'&&/Manda/.test($('#b0').textContent)),'trocou para Cobras: botão vira "Manda"');
 await alvos([[400,0]]);r=await pg.evaluate(()=>{const m=p.mp;cast(0);return{cd:cd[0],gasto:m-p.mp,inv:!!INVA}});
 ok(r.cd===0&&r.gasto===0&&!r.inv,'Manda sem ninguém a 5 tiles: não sai e não gasta nada');
 await alvos([[110,10]]);await pg.evaluate(()=>{E[0].stun=99;cast(0)});await W(560);if(SHOT)await pg.screenshot({path:SHOT+'_cobra.png'});await W(500);
 r=await pg.evaluate(()=>({n:_hits[0],hp:E[0].hp,cd:cd[0]}));ok(r.n===1&&r.cd>40,'selo avisa e a Manda morde o alvo (1 acerto, '+(5000-r.hp)+' de dano)');
 await W(6300);r=await pg.evaluate(()=>({n:_hits[0],hp:E[0].hp}));ok(r.n===7,'veneno em monstro: mais 6 toques ('+r.n+' acertos no total, '+(5000-r.hp)+' de dano)');
 await alvos([[110,10]]);await pg.evaluate(()=>{E[0].stun=99;cast(0)});await W(250);await pg.evaluate(()=>{E[0].x+=50});await W(900);
 r=await pg.evaluate(()=>({n:_hits[0]}));ok(r.n===1,'monstro que anda um pouco (50 px) ainda é mordido (monstro não desvia)');
 await alvos([[110,10]]);await pg.evaluate(()=>{E[0].stun=99;cast(0)});await W(250);await pg.evaluate(()=>{E[0].x+=120});await W(900);
 r=await pg.evaluate(()=>({n:_hits[0],esc:ONL.reg.some(r=>/alvo saiu do selo/.test(r.t))}));ok(r.n===0&&r.esc,'quem sai para longe do selo antes do bote escapa');
 // passiva da cobra no dano contínuo (Amaterasu é Uchiha: +4% nos toques)
 ok(await pg.evaluate(()=>Math.abs(dotMul()-1.04)<1e-9&&ctPas('hp')===0),'passiva das cobras: +4% de dano contínuo (e nada de vida)');
 // salvo e barra no aparelho
 r=await pg.evaluate(()=>({ct:JSON.parse(localStorage.getItem(chKey())).ct,bar:JSON.parse(localStorage.getItem(barKey()))}));
 ok(r.ct&&r.ct.k==='cobra'&&r.bar&&r.bar[0]==='kuchi','contrato e barra ficam salvos no aparelho');
 // personagem salvo antes das invocações (sem "ct") carrega sem contrato
 await pg.evaluate(()=>{const o=JSON.parse(localStorage.getItem(chKey()));delete o.ct;localStorage.setItem(chKey(),JSON.stringify(o));chLoad()});
 ok(await pg.evaluate(()=>CH.ct&&CH.ct.k===null&&CH.lv>=11),'save sem contrato (de antes da entrega) carrega normal, sem contrato');
 ok(!errs.length,'sem erros na página');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
