// Entrega 8 (planilha 09/10): controle no PvP com retorno decrescente, imunidade, tenacidade, teto de cadeia de 4 s, teto de redução
// de 60% e penetração (Jūken). Mensagens de golpe mandadas direto para o servidor (o que se testa é a regra do servidor).
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const LOG=require('path').join(__dirname,'..','servidor.log'),fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const n0=fs.readFileSync(LOG,'utf8').length;
 const A=await mk('Kisame'+suf,1),B=await mk('Zetsu'+suf,2);await W(800);
 // B anota cada golpe que chega (já com a regra do servidor)
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;window._in=[];const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&!m.by)return;if(m.t==='hurt'&&m.by){m._t=performance.now()/1000;_in.push(m)}return g(m)}});
 const bid=await B.evaluate(()=>ONL.uid);
 const spot=await A.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+60,y))return[x,y]}return null});
 await B.evaluate(()=>{let g=0;while(CH.lv<40&&g++<100)gainXp(xpNeed(CH.lv)-CH.xp)});
 await A.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await B.evaluate(s=>{p.x=s[0]+60;p.y=s[1];CH.st.vit=0;stats();p.hp=p.max;E=[];gsMeta();gsPos(true)},spot);await W(800);
 // manda um golpe e espera a resposta (repete se B esquivar)
 const golpe=async(o)=>{for(let k=0;k<6;k++){const n=await B.evaluate(()=>{p.hp=p.max;return _in.length});await A.evaluate(([id,o])=>gsSend(Object.assign({t:'pvp',to:id,d:5,pr:999},o)),[bid,o]);
   for(let j=0;j<20;j++){await W(50);const r=await B.evaluate(n=>_in.slice(n),n);if(r.length){const m=r[r.length-1];if(!m.miss)return m;break}}await W(150)}return null};
 // 1) Kagemane repetido: 2 s → 1,5 → 1 → 0,5 → imune
 const rt=[];let imu=null;for(let i=0;i<5;i++){const m=await golpe({cc:{k:'root',t:2}});const c=m&&m.cc;rt.push(c&&c.k==='root'?c.t:0);if(m&&m.imu)imu=m.imu;await W(1250)}
 ok(rt[0]===2&&rt[1]===1.5&&rt[2]===1&&rt[3]===.5&&rt[4]===0,'prender repetido perde força: '+rt.join(' → ')+' s');ok(imu&&imu.includes('root'),'… e depois do 4º B fica imune a prender');
 ok(await B.evaluate(()=>ONL.reg.some(r=>/imune a prender/.test(r.t))),'B vê no registro que ficou imune');
 // 2) vários toques do mesmo golpe contam uma vez (64 Palmas: selo em cada toque)
 const sl=[];for(let i=0;i<4;i++){const m=await golpe({cc:{k:'selo',t:3}});sl.push(m&&m.cc?m.cc.t:0)}
 ok(sl.every(x=>x===3),'toques seguidos do mesmo golpe (menos de 1,1 s entre eles) não perdem força: '+sl.join(', '));
 // 3) teto de 4 s de atordoamento seguido (atordoar e genjutsu se alternando)
 await W(3500);const st=[],tt=[];for(let i=0;i<4;i++){const m=await golpe(i%2?{st:1.5,g:1}:{st:1.5});st.push(m?m.st:-1);tt.push(m?m._t:0);await W(1100)}
 const fim=Math.max(...st.map((x,i)=>tt[i]+Math.max(0,x)))-tt[0],semTeto=Math.max(tt[3]+1.125,tt[2]+1.125)-tt[0];
 ok(st[0]===1.5&&st[1]===1.5&&fim<=4.15&&semTeto>4.2,'atordoar + genjutsu seguidos param no teto: '+st.join(' + ')+' s, preso '+fim.toFixed(2)+' s seguidos (sem o teto seriam '+semTeto.toFixed(2)+' s)');
 // 4) tenacidade: VIT 80 → 16% a menos
 await W(16000);await B.evaluate(()=>{CH.st.vit=80;stats();gsMeta()});await W(600);const ten=await B.evaluate(()=>tenac());
 let m=await golpe({cc:{k:'root',t:2}});ok(m&&m.cc&&Math.abs(m.cc.t-2*(1-ten/100))<.02,'tenacidade '+ten.toFixed(1)+'%: prender de 2 s vira '+(m&&m.cc&&m.cc.t)+' s');
 // resistência a genjutsu (Byakugan ligado manda rg=15): confusão = 1,5 × (1 − tenacidade) × 0,85
 await B.evaluate(()=>gsSend({t:'meta',rg:15}));await W(400);m=await golpe({cc:{k:'confusao',t:1.5}});const esp=Math.round(1.5*(1-ten/100)*.85*100)/100;
 ok(m&&m.cc&&Math.abs(m.cc.t-esp)<.02,'genjutsu com Byakugan: confusão de 1,5 s vira '+(m&&m.cc&&m.cc.t)+' s (esperado '+esp+')');
 // 5) redução de dano: teto de 60% somando tudo
 const red=await B.evaluate(()=>{BUFS.teste={red:50,until:performance.now()+60000,nm:'teste'};stats();gsMeta();return D().red});ok(red===60,'redução no máximo 60% somando tudo (com +50% de reforço: '+red+'%)');
 // 6) penetração do Jūken: ignora 15% da redução
 await W(600);const sem=await golpe({d:100,c:0}),com=await golpe({d:100,c:0,pen:15});
 ok(sem&&com&&sem.d===Math.round(60*(1-.6))&&com.d===Math.round(60*(1-.6*.85)),'Jūken atravessa 15% da redução: '+(sem&&sem.d)+' → '+(com&&com.d)+' de dano');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
