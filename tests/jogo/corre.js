// Sempre correndo (todos os clãs) e jutsus com pose: o Katon (selo de mãos) e a Palma param o boneco durante a pose e depois ele volta a andar
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const abre=async(nome,card)=>{const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO',e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','off.html'));await pg.fill('#u',nome);await pg.fill('#p','x');await pg.click('#go1');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await pg.click('.card >> nth='+card);await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
  await pg.evaluate(()=>{switchMap('vila_areia')});await W(400);
  await pg.evaluate(()=>{autoOn=false;E=[];p.x=SPAWN[0]*T-200;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];ACT=null;$('#lvup').hidden=true});return pg};
 // velocidade com o joystick só um pouco empurrado (antes: andava devagar) e com ele todo empurrado
 const vel=async(pg,f)=>{await pg.evaluate(f=>{jx=f;jy=0;p.x=SPAWN[0]*T-200;window._x0=p.x;window._t0=performance.now()},f);await W(600);
  return pg.evaluate(()=>{const v=(p.x-_x0)/((performance.now()-_t0)/1000);jx=0;return{v:Math.round(v),run:p.run,esp:Math.round(150*SPD())}})};
 // usa o jutsu andando e acompanha: o boneco para durante a pose e depois volta a andar sozinho (joystick continua empurrado)
 const pose=async(pg,bota)=>{await pg.evaluate(()=>{E=[];p.mp=p.mpMax;cd=[0,0,0,0];ACT=null;p.x=SPAWN[0]*T-200;jx=1;jy=0});await W(300);
  const a=await pg.evaluate(bota=>{const m0=p.mv;eval(bota);const x=p.x;return new Promise(r=>{let n=0,mv=0,fr=0;const f=()=>{if(p.mv)mv++;if(ACT&&actFrame(ACT))fr++;if(++n<10)requestAnimationFrame(f);else r({m0,a:ACT&&ACT.a,mv,fr,para:ACT?+ACT.para.toFixed(2):0,trava:actRoot(),dx:Math.round(p.x-x)})};requestAnimationFrame(f)})},bota);
  await W(500);const d=await pg.evaluate(()=>{const x=p.x;return new Promise(r=>setTimeout(()=>{const v={mv:p.mv,dx:Math.round(p.x-x)};jx=0;r(v)},300))});return{a,d}};
 // Uchiha: Katon
 const U=await abre('Corre1',0);
 for(const f of [.35,1]){const r=await vel(U,f);ok(r.run===1&&Math.abs(r.v-r.esp)<r.esp*.2,'Uchiha, joystick '+(f<1?'pouco':'todo')+' empurrado: corre ('+r.v+' px/s, esperado ~'+r.esp+')')}
 const k=await pose(U,"barSet(0,'katon');useBtn(0)");
 ok(k.a.m0&&k.a.a==='fogo'&&k.a.para>0&&!k.a.trava&&k.a.mv===0&&k.a.fr>=8&&Math.abs(k.a.dx)<2,'Katon andando: o boneco para e faz o selo de mãos, sem travar os outros golpes (pose '+JSON.stringify(k.a)+')');
 ok(k.d.mv&&k.d.dx>20,'depois do selo ele volta a correr sozinho ('+JSON.stringify(k.d)+')');
 const vis=await U.evaluate(()=>new Promise(r=>{E=[];p.mp=p.mpMax;cd=[0,0,0,0];ACT=null;jx=1;const di=ctx.drawImage,U8=HERO.uca[8],U12=HERO.uca[12];let n=0;
  ctx.drawImage=function(im){if(im===U8||im===U12)n++;return di.apply(this,arguments)};useBtn(0);setTimeout(()=>{ctx.drawImage=di;jx=0;r(n)},350)}));
 ok(vis>3,'a tela mostra os quadros do selo (Uchiha) enquanto ele está parado ('+vis+' quadros)');
 // Hyuga: Palma (e a animação de corrida do Hyuga em vez da de caminhada)
 const H=await abre('Corre2',1);
 const rh=await vel(H,.35);ok(rh.run===1&&Math.abs(rh.v-rh.esp)<rh.esp*.2,'Hyuga, joystick pouco empurrado: corre ('+rh.v+' px/s)');
 const hw=await H.evaluate(()=>new Promise(r=>{jx=.35;const di=ctx.drawImage,W=new Set(HERO.hyw),R=new Set(HERO.hyr);let w=0,c=0;ctx.drawImage=function(im){if(W.has(im))w++;if(R.has(im))c++;return di.apply(this,arguments)};
  setTimeout(()=>{ctx.drawImage=di;jx=0;r({w,c})},500)}));
 ok(hw.w===0&&hw.c>5,'Hyuga usa só a animação de corrida (caminhada '+hw.w+', corrida '+hw.c+')');
 const h=await pose(H,"useBtn(0)");
 ok(h.a.m0&&h.a.a==='palma'&&h.a.para>0&&!h.a.trava&&h.a.mv===0&&Math.abs(h.a.dx)<2,'Palma andando: o boneco para e faz a palma (pose '+JSON.stringify(h.a)+')');
 ok(h.d.mv&&h.d.dx>20,'depois da palma ele volta a correr sozinho ('+JSON.stringify(h.d)+')');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
