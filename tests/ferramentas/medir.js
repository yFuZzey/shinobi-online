// Mede os números reais de cada clã no jogo montado (tests/paginas/off.html). Uso: node tests/ferramentas/medir.js saida.json
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=process.argv[2]||__dirname+'/audit_dump.json';
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const res={};
 const open=async(ci,nome)=>{const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>console.log('ERRO',e.message));
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u',nome);await pg.fill('#p','x');await pg.click('#go1');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth='+ci);await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
  await W(300);return pg};
 const dump=pg=>pg.evaluate(()=>{autoOn=false;const C=CLANS[clan];
  const sk=C.sk.map((s,i)=>({slot:i,n:s.n,t:s.t,rk:s.rk||null,tipo:skType(i),dmgBase:s.dmg||0,mp:mpOf(i,s),cd:+cdOf(i,s).toFixed(2),stun:s.stun||0,r:s.r||0,len:s.len||0,kb:s.kb||0,raw:s.dmg?+hitRaw(s.dmg,skType(i)).toFixed(1):0}));
  const d=D();return{lv:CH.lv,st:CH.st,hp:p.max,mp:p.mpMax,regenMp_s:+(5*MG()).toFixed(2),regenHp_s:+(1.2*RG()).toFixed(2),D:d,sk,
   item:(()=>{const it=atkItem&&atkItem();return it?{n:it.name,mp:mpOf(3),cd:+cdOf(3).toFixed(2)}:null})()}});
 // build "médio" Nv 60: 5 pts/nível = 295 pontos; distribuição típica por clã
 const BUILD={uchiha:{int:110,dex:60,agi:50,vit:50,luk:25,str:0},hyuga:{str:110,agi:70,vit:70,dex:45,int:0,luk:0},nara:{int:100,dex:70,vit:70,agi:40,luk:15,str:0}};
 const setLv=(pg,lv,st)=>pg.evaluate(([lv,st])=>{CH.lv=lv;CH.xp=0;CH.pts=0;for(const k in CH.st)CH.st[k]=st[k]||0;stats();p.hp=p.max;p.mp=p.mpMax},[lv,st]);
 for(const [ci,cl,nm] of [[0,'uchiha','Itachi'],[1,'hyuga','Neji'],[2,'nara','Shikamaru']]){const pg=await open(ci,nm);
  const r={lv1:await dump(pg)};await setLv(pg,60,BUILD[cl]);r.lv60=await dump(pg);r.lv60.build=BUILD[cl];
  if(cl==='uchiha'){r.TOM=await pg.evaluate(()=>TOM);r.EYES=await pg.evaluate(()=>Object.fromEntries(Object.entries(EYES).map(([k,v])=>[k,v.sus])));r.SUSDR=await pg.evaluate(()=>SUSDR)}
  r.JT=await pg.evaluate(()=>JT[clan]);r.ACTS=await pg.evaluate(()=>ACTS);
  r.misc=await pg.evaluate(()=>({LVMAX,PTS_LV,xp10:xpNeed(10),xp40:xpNeed(40),xp60:xpNeed(60),STMAX,PRK,PVP:typeof PVP!=='undefined'?PVP:null}));
  res[cl]=r;await pg.context().close()}
 require('fs').writeFileSync(OUT,JSON.stringify(res,null,1));console.log('ok',OUT);await b.close()})();
