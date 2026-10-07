// T-01: saves antigos carregam sem perda (formato do jogo base, da época online sem número de versão, e de versão mais nova)
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const PAG='file://'+require('path').join(__dirname,'..','paginas','off.html');
const CASOS=[
 {nome:'Antigo',desc:'save do jogo base (sem especialidade, sem olho, sem versão)',save:{lv:12,xp:345,pts:4,st:{str:3,agi:5,vit:7,int:9,dex:2,luk:1}}},
 {nome:'Online',desc:'save da época online (especialidade e Mangekyō, sem versão)',save:{lv:41,xp:1200,pts:2,st:{str:1,agi:20,vit:30,int:60,dex:40,luk:10},prof:{k:'ninjutsu',xp:500},mgk:'madara'}},
 {nome:'Futuro',desc:'save de versão mais nova que o app (voltou de atualização)',save:{lv:30,xp:10,pts:0,st:{str:0,agi:0,vit:0,int:0,dex:0,luk:0},prof:{k:null,xp:0},mgk:null,v:9}}];
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const errs=[];
 for(const C of CASOS){const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO',e.message)});
  await pg.goto(PAG);await pg.evaluate(([n,s])=>localStorage.setItem('shinobi-char-'+n.toLowerCase(),JSON.stringify(s)),[C.nome,C.save]);
  await pg.fill('#u',C.nome);await pg.fill('#p','x');await pg.click('#go1');await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});
  await pg.click('#go2');await pg.click('.card >> nth=0');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});await W(300);
  const r=await pg.evaluate(()=>({lv:CH.lv,xp:CH.xp,pts:CH.pts,st:CH.st,prof:CH.prof,mgk:CH.mgk,v:CH.v,saved:JSON.parse(localStorage.getItem(chKey()))}));
  const S=C.save,same=r.lv===S.lv&&r.xp===S.xp&&r.pts===S.pts&&JSON.stringify(r.st)===JSON.stringify(S.st);
  ok(same,C.desc+': nível, XP, pontos e atributos iguais (Nv '+r.lv+', '+r.pts+' pontos)');
  if(S.prof&&S.prof.k)ok(r.prof.k===S.prof.k&&r.prof.xp===S.prof.xp,C.desc+': especialidade mantida ('+r.prof.k+')');
  if(S.mgk)ok(r.mgk===S.mgk,C.desc+': Mangekyō mantida ('+r.mgk+')');
  ok(r.v===Math.max(1,S.v||1),C.desc+': versão '+r.v);
  await pg.evaluate(()=>{gainXp(1)});await W(100);const sv=await pg.evaluate(()=>JSON.parse(localStorage.getItem(chKey())));
  ok(sv.v===r.v&&sv.lv>=S.lv,C.desc+': ao salvar de novo, grava a versão junto (v '+sv.v+')');
  await pg.context().close()}
 ok(!errs.length,'sem erros na página');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
