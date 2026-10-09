// Samehada (item do painel com "habilidade nova" programada): passiva Drenar chakra — em jogador o servidor confere o item equipado
// e avisa os dois lados (alvo perde 3% do chakra máximo, quem bate recupera 3% do seu), no máximo 1 vez a cada 0,5 s; em monstro
// recupera 1,5%; sem o item equipado o servidor ignora; arma nas costas com aura laranja (os outros também veem)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const svc=(p,o={})=>fetch(MOCK+p,{...o,headers:{apikey:'svc-test','Content-Type':'application/json'}});
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const icone='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'..','..','arte','ui','icone_app.png')).toString('base64');
 await svc('/rest/v1/itens',{method:'POST',body:JSON.stringify({id:'p_samehada',nome:'Samehada',icone,nivel:32,raridade:'epico',slot:'arma',tipo:'nova',pedido:'aura laranja e drena chakra',atributos:['str','mp_pct','regen_pct'],descricao:'Espada viva.\n(laranja)Passiva: Drenar chakra(laranja)',publicado:true})});
 await fetch(GS+'/painel/recarregar',{method:'POST'});await W(1300);
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const B=await mk('Alvo'+suf,1),A=await mk('Same'+suf,0);await W(900);
 const aid=await A.evaluate(()=>ONL.uid),bid=await B.evaluate(()=>ONL.uid);
 await svc('/rest/v1/rpc/dar_itens',{method:'POST',body:JSON.stringify({p_personagem:aid,p_itens:['p_samehada']})});
 const it=await A.evaluate(async()=>{await invReload();let g=0;while(CH.lv<32&&g++<100)gainXp(xpNeed(CH.lv)-CH.xp);$('#lvup').hidden=true;equipItem('p_samehada');stats();const s=ITEMS.p_samehada;return{eq:EQ.arma,pas:s&&s.passiva,ag:s&&s.aguardando,fx:s&&s.fx&&s.fx.arma}});
 ok(it.eq==='p_samehada'&&it.pas&&it.pas.k==='drena'&&it.ag===0&&it.fx,'Samehada vem com a passiva pronta (não fica "aguardando") e equipa no Nv 32');
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;window._in=[];window._ph=[];const g=gsMsg;gsMsg=function(m){if(m.t==='hurt'&&m.by)_in.push(m);if(m.t==='ph')_ph.push(m);return g(m)};CH.st.int=30;stats();p.mp=p.mpMax;p.hp=p.max});
 const spot=await B.evaluate(()=>{for(let r=7;r<14;r++)for(let a=0;a<12;a++){const x=SPAWN[0]*T+Math.cos(a/12*6.283)*r*T,y=SPAWN[1]*T+Math.sin(a/12*6.283)*r*T;if(!blk(x,y)&&!blk(x+60,y)&&!blk(x-60,y))return[x,y]}return null});
 await B.evaluate(s=>{p.x=s[0];p.y=s[1];E=[];gsPos(true)},spot);await A.evaluate(s=>{p.x=s[0]-60;p.y=s[1];E=[];gsPos(true);onlMeta&&gsSend(Object.assign({t:'meta'},onlMeta()))},spot);await W(1200);
 // golpe que acerta (o servidor sorteia esquiva: tenta até acertar)
 const golpe=async()=>{for(let k=0;k<8;k++){const n=await B.evaluate(()=>{p.hp=p.max;return _in.length});await A.evaluate(id=>gsSend({t:'pvp',to:id,d:10,c:0,pr:999,dr:drenoOn()?1:undefined}),bid);
   for(let j=0;j<20;j++){await W(50);const r=await B.evaluate(n=>_in.slice(n),n);if(r.length){const m=r[r.length-1];if(!m.miss)return m;break}}await W(600)}return null};
 const mpB=await B.evaluate(()=>p.mpMax);await A.evaluate(()=>{p.mp=p.mpMax*.5});
 const h1=await golpe();await W(300);const ftB=await B.evaluate(()=>FT.filter(f=>/chakra/.test(String(f.t))).map(f=>f.t)),mA=await A.evaluate(()=>({max:p.mpMax,ft:FT.filter(f=>/chakra/.test(String(f.t))).map(f=>f.t)}));
 const tira=Math.round(mpB*.03),ganha=Math.round(mA.max*.03);
 ok(h1&&h1.dr===3&&ftB.includes('−'+tira+' chakra'),'alvo perde 3% do chakra máximo ('+ftB.join(', ')+' de '+mpB+')');
 ok(mA.ft.includes('+'+ganha+' chakra'),'quem bate recupera 3% do seu chakra ('+mA.ft.join(', ')+' de '+mA.max+')');
 ok(await B.evaluate(()=>ONL.reg.some(r=>/drenou/.test(r.t))),'o alvo vê no registro que foi drenado');
 const h2=await golpe();ok(h2&&!h2.dr,'outro golpe logo em seguida (menos de 0,5 s) não drena de novo');
 await W(700);const h3=await golpe();ok(h3&&h3.dr===3,'depois de 0,5 s drena de novo');
 // fingir que tem: sem o item equipado o servidor ignora o pedido de drenar
 await A.evaluate(()=>{unequipItem('p_samehada');stats();gsSend(Object.assign({t:'meta'},onlMeta()))});await W(900);
 const h4=await A.evaluate(id=>new Promise(r=>{gsSend({t:'pvp',to:id,d:10,c:0,pr:999,dr:1});setTimeout(r,400)}),bid);const last=await B.evaluate(()=>_in[_in.length-1]);
 ok(last&&!last.dr,'sem a Samehada equipada o servidor ignora o "drenar" do app');
 // monstro: recupera 1,5%
 const pve=await A.evaluate(()=>{equipItem('p_samehada');stats();p.mp=p.mpMax*.5;const m0=p.mp,e={id:999,max:500,hp:500,x:p.x+30,y:p.y,dead:0,rad:18,kind:'mob'};hitE(e,5,0,0,0);return{g:Math.round(p.mp-m0),esp:Math.round(p.mpMax*.015)}});
 ok(pve.g===pve.esp,'golpe em monstro recupera 1,5% do chakra ('+pve.g+')');
 // visual: Samehada nas costas com aura (A) e o outro jogador também vê
 await A.evaluate(()=>gsSend(Object.assign({t:'meta'},onlMeta())));await W(1000);
 ok(await B.evaluate(id=>{const pe=ONL.peers[id];return !!pe&&(pe.eq||[]).includes('p_samehada')&&!!ITEMS.p_samehada},aid),'o outro jogador recebe que a Samehada está equipada');
 await A.evaluate(()=>{$('#lvup').hidden=true;$('#toast').hidden=true});await A.screenshot({path:path.join(__dirname,'samehada.png'),clip:{x:300,y:110,width:240,height:170}});
 await B.screenshot({path:path.join(__dirname,'samehada_b.png'),clip:{x:240,y:110,width:240,height:170}});
 await A.evaluate(()=>{toggleBag(true,'bag');invSel='p_samehada';bagRefresh()});await W(200);
 ok(await A.evaluate(()=>/Passiva: Drenar chakra/.test($('#ivDet').textContent)&&/recupera 3%/.test($('#ivDet').textContent)),'mochila explica a passiva com os números');
 await A.screenshot({path:path.join(__dirname,'samehada_bag.png')});
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
