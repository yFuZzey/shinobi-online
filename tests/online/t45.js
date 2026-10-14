// Outros jogadores andam com animação (não deslizam) e viram para o lado em que andam: o servidor repassa mv/fl/run de cada jogador.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const A=await mk('Anda'+suf,0),B=await mk('Olha'+suf,1);await W(800);const ida=await A.evaluate(()=>ONL.uid);
 for(const pg of [A,B])await pg.evaluate(()=>{autoOn=false;E=[]});
 // B anota o que vê de A enquanto A anda (para a direita, depois para a esquerda) e quando para
 await B.evaluate(id=>{window._vi=[];setInterval(()=>{const pe=ONL.peers[id];if(pe&&pe.x!==null)window._vi.push([pe.mv,pe.fl?1:0,pe.run])},50)},ida);
 const anda=async(k,ms)=>{await A.keyboard.down(k);await W(ms);await A.keyboard.up(k)};
 await B.evaluate(()=>{window._vi=[]});await anda('d',900);await W(400);const v1=await B.evaluate(()=>window._vi.splice(0));
 await anda('a',900);await W(400);const v2=await B.evaluate(()=>window._vi.splice(0));await W(800);const v3=await B.evaluate(()=>window._vi.splice(0));
 const meA=await A.evaluate(()=>({mv:p.mv,fl:p.fl}));
 ok(v1.some(x=>x[0]===1),'B vê A andando (animação de andar) quando A anda: '+v1.filter(x=>x[0]).length+'/'+v1.length);
 const lado=v=>{const L=v.filter(x=>x[0]===1).map(x=>x[1]);return L.length?L[L.length-1]:null},l1=lado(v1),l2=lado(v2);ok(l1!==null&&l2!==null&&l1!==l2,'B vê A virar de lado ao trocar de direção: '+l1+' → '+l2);
 ok(v3.length&&v3.every(x=>x[0]===0)&&meA.mv===0,'B vê A parado quando A para');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
