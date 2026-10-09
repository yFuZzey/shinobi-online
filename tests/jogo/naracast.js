// Nara: corre com os quadros da folha, para ao lançar habilidade e usa a pose própria de cada uma
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path');let ACT_;
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO',e.message);fails++});
 await pg.goto('file://'+path.join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Shika');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await pg.click('.card >> nth='+await pg.evaluate(()=>Object.keys(CLANS).indexOf('nara')));await pg.click('#go2');
 await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 const fr=await pg.evaluate(()=>{const cv=document.createElement('canvas');cv.width=cv.height=200;const g=cv.getContext('2d');const seen=new Set();const di=g.drawImage;g.drawImage=function(im){const k=HERO.nra.indexOf(im);if(k>=0)seen.add(k);return di.apply(this,arguments)};
  const one=(o)=>{seen.clear();drawHero(g,100,150,Object.assign({fl:0,t:0,mv:0,run:0,aura:-1,th:-1,clan:'nara'},o));return [...seen][0]};
  const out={parado:one({}),corre:[0,90,180,270].map(t=>one({t,mv:1,run:1}))};
  for(const a of ['nsom','nkubi','ndom','nyose','nnui','nshu']){ACT=null;actStart(a);out[a]=one({act:ACT,mv:1,run:1,t:50});out[a+'_para']=actPara()}
  return out});
 ok(fr.parado===0,'parado: quadro 0 ('+fr.parado+')');
 ok(fr.corre.every(x=>[13,14,15,17].includes(x))&&new Set(fr.corre).size===4,'correndo: os 4 quadros de corrida ('+fr.corre+')');
 ok(fr.nsom===6&&fr.nkubi===7&&fr.ndom===10&&fr.nyose===12&&fr.nnui===9&&fr.nshu===11,'cada habilidade com a sua pose, mesmo em movimento ('+[fr.nsom,fr.nkubi,fr.ndom,fr.nyose,fr.nnui,fr.nshu]+')');
 ok(['nsom','nkubi','ndom','nyose','nnui','nshu'].every(a=>fr[a+'_para']),'o boneco para de andar durante o lançamento');
 ACT_=await pg.evaluate(()=>{ACT=null;useBtn(0);return ACT&&ACT.a});ok(ACT_==='nshu','o botão da Shuriken faz a pose de lançar ('+ACT_+')');
 await W(300);ok(await pg.evaluate(()=>{const f={k:'sline',x:p.x,y:p.y-4,ax:1,ay:0,len:120,col:'#120a22',life:2,max:2,tel:.1};ctx.save();const r=sombraLinha(f,100,.5,1);ctx.restore();return r}),'a linha de sombra usa os sprites da folha de efeitos');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
