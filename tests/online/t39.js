// Entrega 11 (planilha 11): invocações no online — o servidor só aceita contrato de família ativa; veneno da Manda no PvP
// (5% da vida em 6 s, +4% da passiva das cobras, só para quem tem o contrato e só pela invocação); a passiva das cobras também
// aumenta a queimadura do Katon; recarga da invocação conferida pelo servidor; quem está vendo vê a invocação; Katsuyu cura 60% no PvP
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();
  pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text())){console.log('ERRO (console)',n,m.text());fails++}});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const n0=fs.readFileSync(LOG,'utf8').length;
 const B=await mk('Presa'+suf,1),A=await mk('Cobra'+suf,0);await W(900);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;window._in=[];window._fx=[];const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&m.by){m._t=performance.now()/1000;_in.push(m)}if(m.t==='fx')(m.fx||[]).forEach(f=>_fx.push(f.k+':'+(f.f||'')));return g(m)};
  let k2=0;while(CH.lv<20&&k2++<100)gainXp(xpNeed(CH.lv)-CH.xp);CH.st.vit=40;stats();p.hp=p.max;p.mp=p.mpMax});
 await B.evaluate(()=>{CH.st.vit=54;stats();p.hp=p.max}); // 532 de vida: o arredondamento mostra os +4% da passiva das cobras
 const bid=await B.evaluate(()=>ONL.uid);
 const spot=await B.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+60,y)&&!blk(x-60,y)&&!blk(x,y+40))return[x,y]}return null});
 await B.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await A.evaluate(s=>{p.x=s[0]-60;p.y=s[1];E=[];gsPos(true)},spot);await W(900);
 const golpe=async o=>{for(let k=0;k<6;k++){const n=await B.evaluate(()=>{p.hp=p.max;return _in.length});await A.evaluate(([id,o])=>gsSend(Object.assign({t:'pvp',to:id,d:100,c:0,pr:999},o)),[bid,o]);
   for(let j=0;j<20;j++){await W(50);const r=await B.evaluate(n=>_in.slice(n).filter(m=>!m.qm&&!m.vn),n);if(r.length){const m=r[r.length-1];if(!m.miss)return m;break}}await W(200)}return null};
 const venenos=async(ms)=>{const n=await B.evaluate(()=>_in.length);await W(ms);return B.evaluate(n=>_in.slice(n).filter(m=>m.vn).map(m=>m.d),n)};
 const maxB=await B.evaluate(()=>p.max);
 // sem contrato: "vn" do app não vale nada
 await golpe({j:'kuchi',vn:1});let v=await venenos(2300);ok(v.length===0,'sem contrato das cobras: o servidor ignora o veneno ('+v.length+' toques)');
 // contrato que não existe / família ainda sem arte: o servidor não aceita
 await A.evaluate(()=>gsSend({t:'meta',ct:'corvo'}));await W(300);await golpe({j:'kuchi',vn:1});v=await venenos(2300);ok(v.length===0,'contrato "corvo" (ainda sem arte) não é aceito pelo servidor');
 // contrato das cobras de verdade (escolhido na aba Jutsus)
 await A.evaluate(()=>{CH.ct={k:'cobra',t:Date.now()};ctApply();chSave();stats()});await W(500);
 ok(await A.evaluate(()=>onlMeta().ct==='cobra'),'app informa o contrato ao servidor');
 const m1=await golpe({j:'katon',vn:1});v=await venenos(2300);ok(m1&&v.length===0,'"vn" num golpe que não é a invocação: sem veneno');
 const m2=await golpe({j:'kuchi',vn:1});v=v.concat(await venenos(6600));const each=Math.max(1,Math.round(maxB*5/6/100*1.04));
 ok(m2&&v.length===6&&v.every(d=>d===each),'Manda no PvP: veneno de 6 toques de '+v.join(', ')+' (5% de '+maxB+' em 6 s × 1,04 = '+each+' por toque)');
 ok(await B.evaluate(()=>ONL.reg.some(r=>/envenenou você/.test(r.t))),'quem apanha vê no registro que foi envenenado');
 // passiva das cobras na queimadura do Katon (Gōkakyū forte: 3% em 3 s → 1% × 1,04 por toque)
 await W(4100);const q0=await B.evaluate(()=>_in.length);const gk=await golpe({j:'goka'});await W(3400);
 const qs=await B.evaluate(n=>_in.slice(n).filter(m=>m.qm).map(m=>m.d),q0);
 ok(gk&&gk.ef==='queima'&&qs.length===3&&qs.every(d=>d===Math.max(1,Math.round(maxB*.01*1.04))),'queimadura do Katon com a passiva das cobras: '+qs.join(', ')+' (1% × 1,04 de '+maxB+')');
 // recarga da invocação conferida pelo servidor (modo sombra: só anota)
 await A.evaluate(()=>{gsSend({t:'cast',sl:0,id:'kuchi'});gsSend({t:'cast',sl:0,id:'kuchi'})});await W(500);
 let lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(/RECARGA\? Cobra\d+ \(uchiha\) usou o botão 0 \(kuchi\)/.test(lg),'servidor anota invocação usada de novo antes da recarga');
 // quem está vendo vê a invocação (sapo de A aparece para B) e o escudo segura golpe de jogador
 await A.evaluate(()=>{CH.ct={k:'sapo',t:0};ctApply();barSet(1,'kuchi');stats();p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];cast(1)});await W(800);
 ok(await B.evaluate(()=>_fx.includes('inv:sapo')&&fx.some(f=>f.k==='inv'&&f.f==='sapo'&&f.pid)),'B recebe e desenha o Gamabunta de A');
 const aid=await A.evaluate(()=>ONL.uid);const sh=await A.evaluate(()=>SHT&&SHT.v);
 await A.evaluate(()=>{window._h=p.hp});await B.evaluate(id=>gsSend({t:'pvp',to:id,d:20,c:0,pr:999}),aid);await W(700);
 const ra=await A.evaluate(()=>({d:_h-p.hp,sh:SHT&&SHT.v}));ok(sh>0&&ra.d===0&&ra.sh<sh,'escudo do Gamabunta segura golpe de jogador (escudo '+sh+' → '+ra.sh+', vida intacta)');
 await A.evaluate(()=>invEnd());await W(600);ok(await B.evaluate(()=>!fx.some(f=>f.k==='inv'&&f.f==='sapo'&&f.life>.45)),'acabou antes da hora: some para quem está vendo também');
 // Katsuyu: no PvP cura 60%
 await A.evaluate(()=>{CH.ct={k:'lesma',t:0};ctApply();stats();cd=[0,0,0,0];p.mp=p.mpMax});
 const cura=await A.evaluate(async()=>{const rv=BAL.personagem.regenVida;BAL.personagem.regenVida=0;ONL.pvpT=performance.now();p.hp=Math.round(p.max*.3);const h=p.hp;cast(1);
  await new Promise(r=>setTimeout(r,1300));const t=setInterval(()=>{ONL.pvpT=performance.now()},500);await new Promise(r=>setTimeout(r,6200));clearInterval(t);BAL.personagem.regenVida=rv;return{c:p.hp-h,max:p.max}});
 ok(Math.abs(cura.c-cura.max*.12*1.05*.6)<=2,'Katsuyu em luta PvP cura '+cura.c.toFixed(1)+' (12% × 1,05 × 0,6 de '+cura.max+')');
 lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento/.test(lg),'servidor sem erros nem avisos do balanceamento');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
