// Música da tela de login: toca enquanto o jogador está na tela de login e para ao sair dela
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path');
(async()=>{const b=await chromium.launch({args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO',e.message);fails++});
 await pg.goto('file://'+path.join(__dirname,'..','paginas','off.html'));await W(1200);
 const a=await pg.evaluate(()=>({tem:!!(LGMUS.a),src:LGMUS.a&&LGMUS.a.src.slice(0,22),loop:LGMUS.a&&LGMUS.a.loop,pausado:LGMUS.a&&LGMUS.a.paused,tela:cur}));
 ok(a.tem&&/^data:audio\/mpeg/.test(a.src)&&a.loop,'a música do login existe e repete ('+JSON.stringify(a)+')');
 ok(a.pausado===false&&a.tela==='login','toca na tela de login');
 await pg.fill('#u','Shika');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await W(1500);
 ok(await pg.evaluate(()=>!LGMUS.a.paused),'continua tocando na escolha do clã');
 
 await pg.evaluate(()=>show('clan'));await pg.click('.card >> nth=2');await pg.waitForFunction(()=>cur==='cust');await W(300);ok(await pg.evaluate(()=>!LGMUS.a.paused),'continua tocando na criação do personagem');await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});await W(1500);
 ok(await pg.evaluate(()=>LGMUS.a.paused),'não toca no jogo');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
