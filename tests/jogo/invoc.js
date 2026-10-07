// Entrega 11 (planilha 11): contrato de invocação — 1 por personagem (Nv 10), passiva pequena (× afinidade do clã), invocação num botão
// da barra; troca com espera; cada família faz a sua coisa (clone, dash, prende, escudo, cura, zona lenta, veneno)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const errs=[];
 const open=async(ci,nome)=>{const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO',e.message)});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u',nome);await pg.fill('#p','x');await pg.click('#go1');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth='+ci);await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
  await pg.evaluate(()=>{switchMap('vila_areia')});await W(300);return pg};
 const lvTo=(pg,v)=>pg.evaluate(v=>{let g=0;while(CH.lv<v&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp)},v);
 const alvos=(pg,L)=>pg.evaluate(L=>{autoOn=false;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];KDEL=[];P=[];SHD=null;
  const mk=(dx,dy,id)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y+dy,dead:0,dt:0,rt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id});
  E=L.map((q,i)=>mk(q[0],q[1],i+1));window._hits=E.map(()=>0);window._last=E.map(e=>e.hp);window._watch=1;
  const f=()=>{E.forEach((e,i)=>{if(e.hp<_last[i])_hits[i]++;_last[i]=e.hp});if(window._watch)requestAnimationFrame(f)};requestAnimationFrame(f)},L);
 const U=await open(0,'Kuchiyose');
 ok(await U.evaluate(()=>JT.uchiha.some(B=>B.n.some(n=>n.id==='invoc'&&n.lv===10))),'árvore: ramo "Invocação (contrato)" no Nv 10');
 ok(await U.evaluate(()=>{ctEscolhe('sapos');return !CH.ct}),'antes do Nv 10 não assina contrato');
 await lvTo(U,10);ok(await U.evaluate(()=>barSet(3,'invoc')&&/Invocação/.test($('#b3').textContent)),'Nv 10: a Invocação vai para o botão 3');
 let r=await U.evaluate(()=>{const m=p.mp;cast(3);return{cd:cd[3],g:m-p.mp}});ok(r.cd===0&&r.g===0,'sem contrato a invocação não sai e não gasta nada');
 // Corvos (Uchiha tem afinidade: passiva ×1,5)
 await U.evaluate(()=>{toggleBag(true,'ju');juSel='invoc';juDraw()});await W(200);
 ok(await U.evaluate(()=>document.querySelectorAll('#paneJu [data-ct]').length===7),'aba Jutsus mostra as 7 famílias para escolher');
 await U.screenshot({path:__dirname+'/invoc_tab.png'});
 await U.click('#paneJu [data-ct="corvos"]');await W(150);r=await U.evaluate(()=>({ct:CH.ct,b:$('#b3').textContent,g:ctPass('genj')}));
 ok(r.ct==='corvos'&&/Corvos/.test(r.b)&&r.g===7.5,'assinou Corvos: botão vira "Invocação: Corvos", passiva +7,5% de genjutsu (5% × 1,5 de afinidade)');
 await U.evaluate(()=>toggleBag(false));await alvos(U,[]);const e0=await U.evaluate(()=>D().esq);await U.evaluate(()=>cast(3));await W(150);
 r=await U.evaluate(()=>({esq:D().esq,fx:fx.some(f=>f.k==='invoc'),cd:cd[3]}));ok(r.esq-e0===15&&r.fx&&r.cd>50,'Corvos: clone aparece e dá +15 de esquiva; recarga de 60 s');
 // troca com espera
 r=await U.evaluate(()=>{ctEscolhe('sapos');ctEscolhe('sapos');return CH.ct});ok(r==='corvos','trocar logo em seguida: precisa esperar (continua Corvos)');
 r=await U.evaluate(()=>{CH.ctT=Date.now()-11*60*1000;ctEscolhe('sapos');const a=CH.ct;ctEscolhe('sapos');return[a,CH.ct]});ok(r[0]==='corvos'&&r[1]==='sapos','depois da espera: pede confirmação e troca para Sapos');
 r=await U.evaluate(()=>({hp:p.max,base:calcChar(1,1).at.hp.fin}));ok(Math.abs(r.hp-Math.round(r.base*1.05))<=1,'Sapos: +5% de vida máxima ('+Math.round(r.base)+' → '+r.hp+')');
 await alvos(U,[]);await U.evaluate(()=>cast(3));await W(100);r=await U.evaluate(()=>SHD&&SHD.v);ok(r>0,'Sapos: escudo do sapo ('+r+' de vida)');
 // fica salvo
 ok(await U.evaluate(()=>{const j=JSON.parse(localStorage.getItem(chKey()));return j.ct==='sapos'&&j.ctT>0}),'contrato fica salvo no aparelho');
 // Falcões (dash)
 await U.evaluate(()=>{CH.ctT=0;CH.ct=null;ctEscolhe('falcoes')});await alvos(U,[]);await U.evaluate(()=>{p.ax=1;p.ay=0;cd[3]=0;cast(3)});
 r=await U.evaluate(()=>p.x-SPAWN[0]*T);ok(r>=96,'Falcões: o falcão leva você uns 4 tiles para a frente ('+Math.round(r)+' px)');
 // Cães (prende) e Cobras (veneno) no Hyuga
 const H=await open(1,'Inuzuka');await lvTo(H,10);await H.evaluate(()=>{barSet(3,'invoc');ctEscolhe('caes')});
 r=await H.evaluate(()=>({pr:ctPass('prec')}));ok(r.pr===12,'Cães no Hyuga (afinidade): +12 de precisão');
 await alvos(H,[[100,0]]);await H.evaluate(()=>cast(3));await W(150);r=await H.evaluate(()=>({st:E[0].stun,n:_hits[0]}));ok(r.st>.5&&r.n===1,'Cães: prende o alvo mais perto ('+r.st.toFixed(1)+' s)');
 await H.evaluate(()=>{CH.ctT=0;CH.ct=null;ctEscolhe('cobras')});await alvos(H,[[100,0]]);await H.evaluate(()=>cast(3));await W(3200);r=await H.evaluate(()=>_hits[0]);
 ok(r>=3,'Cobras: mordida + veneno ('+r+' toques em 3 s)');
 // Lesmas (cura) e Cervos (zona lenta) no Nara
 const N=await open(2,'Katsuyu');await lvTo(N,10);await N.evaluate(()=>{barSet(3,'invoc');ctEscolhe('lesmas')});await alvos(N,[]);
 await N.evaluate(()=>{p.hp=Math.round(p.max*.5);cast(3)});const h0=await N.evaluate(()=>p.hp);await W(3200);const h1=await N.evaluate(()=>p.hp);ok(h1>h0,'Lesmas: cura aos poucos ('+h0+' → '+h1+')');
 await N.evaluate(()=>{CH.ctT=0;CH.ct=null;ctEscolhe('cervos')});ok(await N.evaluate(()=>ctPass('ccPve')===7.5),'Cervos no Nara (afinidade): controle +7,5% em monstros');
 await alvos(N,[[60,0],[300,0]]);await N.evaluate(()=>cast(3));await W(1500);r=await N.evaluate(()=>({a:E[0].slw||0,b:E[1].slw||0}));ok(r.a>0&&r.b===0,'Cervos: zona deixa lento quem está dentro');
 ok(!errs.length,'sem erros na página');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
