// mecânica: 64 Palmas (preso, dano contínuo, empurrado ~2 tiles), Kaiten (dano em área, empurra, bloqueia)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();
 const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Neji');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth=1');await pg.waitForFunction(()=>cur==='game'&&KFX_OK&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{switchMap('vila_areia')});await W(500);
 // dois "inimigos" de teste parados (um perto, um longe)
 const setup=()=>pg.evaluate(()=>{autoOn=false;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];
  const mk=(dx,id)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y,dead:0,dt:0,rt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id});
  E=[mk(28,1),mk(150,2)];window._hits=0;let last=E[0].hp;const f=()=>{if(E[0]&&E[0].hp<last)_hits++;last=E[0]?E[0].hp:last;if(window._watch)requestAnimationFrame(f)};window._watch=1;requestAnimationFrame(f)});
 await setup();const x0=await pg.evaluate(()=>[E[0].x-p.x,E[1].x-p.x]);
 await pg.evaluate(()=>{cast(2)});await W(1300);
 const r=await pg.evaluate(()=>{window._watch=0;return{d0:E[0].x-p.x,d1:E[1].x-p.x,hp0:E[0].hp,hp1:E[1].hp,st0:E[0].stun,n:_hits}});
 ok(r.hp0<5000&&r.n>=8,'64 Palmas: o alvo a 1 tile tomou '+r.n+' golpes seguidos ('+(5000-r.hp0)+' de dano no total)');
 ok(r.d0-x0[0]>=45&&r.d0-x0[0]<=80,'foi empurrado durante a sequência: de '+Math.round(x0[0])+' px para '+Math.round(r.d0)+' px (≈2 tiles a mais)');
 ok(r.hp1===5000&&r.d1===x0[1],'o alvo longe (≈5 tiles) não foi atingido');
 ok(r.st0>1,'alvo preso fica atordoado ('+r.st0.toFixed(1)+' s restantes)');
 const dmg64=5000-r.hp0;
 // Palma normal para comparar o dano
 await setup();await pg.evaluate(()=>{E=[E[0]];cast(0)});await W(400);const palma=await pg.evaluate(()=>5000-E[0].hp);
 console.log('   dano: 64 Palmas (9 toques) =',dmg64,'· 1 Palma =',palma);
 // Kaiten: dano em área + atordoa + empurra; e bloqueia golpe recebido enquanto gira
 await setup();const k=await pg.evaluate(()=>new Promise(res=>{E[1].x=p.x+70;cast(1);const t0=performance.now();let pre=null;const f=()=>{const t=performance.now()-t0;
  if(t<320)pre=E.map(e=>Math.round(Math.hypot(e.x-p.x,e.y-p.y+10)));else{const d=E.map(e=>Math.round(Math.hypot(e.x-p.x,e.y-p.y+10)));window._kmax=window._kmax?window._kmax.map((v,i)=>Math.max(v,d[i])):d}if(t<480)requestAnimationFrame(f);else{const d=window._kmax;window._kmax=null;res({pre,hp:E.map(e=>e.hp),st:E.map(e=>+e.stun.toFixed(2)),d,ks:BAL.golpes.kaitenAtordoa})}};requestAnimationFrame(f)}));
 ok(k.hp.every(h=>h<5000),'Kaiten: dano nos dois alvos em volta '+JSON.stringify(k.hp));
 ok(k.ks>0?k.st.every(s=>s>k.ks-.5&&s<=k.ks):k.st.every(s=>s===0),k.ks>0?'Kaiten: atordoa (até '+k.ks+' s) '+JSON.stringify(k.st):'Kaiten: não atordoa (planilha) '+JSON.stringify(k.st));
 ok(k.d[0]>k.pre[0]+10&&k.d[1]>=k.pre[1]+10,'Kaiten: empurra para fora (distância antes '+JSON.stringify(k.pre)+' → depois '+JSON.stringify(k.d)+')');
 const g=await pg.evaluate(()=>{const h0=p.hp;hurt(30);return{perdeu:h0-p.hp,txt:FT[FT.length-1].t}});
 ok(g.perdeu===0&&g.txt==='defendeu','girando o Kaiten: golpe recebido é bloqueado ("defendeu")');
 await W(800);const g2=await pg.evaluate(()=>{const h0=p.hp;HPREC=999;hurt(30);HPREC=0;return h0-p.hp});ok(g2>0,'depois do giro volta a tomar dano normal ('+g2+')');
 console.log('erros',errs);console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
