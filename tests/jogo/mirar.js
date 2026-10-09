// Mirar arrastando a habilidade: arrastar mostra a área e o golpe sai na direção/ponto mostrado; tocar = como antes; voltar ao centro cancela; segurar só mostra as informações
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO',e.message);fails++});
 await pg.goto('file://'+path.join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Mira1');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await pg.click('.card >> nth=0');await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{autoOn=false;scene=0;E.length=0;E.push({...E[0]||{},id:1,nome:'Alvo',lv:1,max:999,hp:999,boss:0,rad:18,dead:0,x:p.x+90,y:p.y,t:'',stun:0,hurt:0,lunge:0,mv:0,wt:99999});CH.lv=60;stats();barSet(0,'katon');barSet(1,'goryuka');p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];ACT=null});
 await W(300);
 const ctr=async i=>{const r=await pg.evaluate(i=>{const r=$('#b'+i).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}},i);return r};
 const st=()=>pg.evaluate(()=>({aim:!!AIMS.a,on:AIMS.on,cd0:cd[0],cd1:cd[1],ax:p.ax,ay:p.ay,tip:!!($('#sbTip')&&!$('#sbTip').hidden),av:fx.filter(f=>f.k==='aviso').map(f=>({x:Math.round(f.x-p.x),y:Math.round(f.y-p.y)}))}));
 // 1) arrasta para a esquerda: mostra a área e, ao soltar, a bola de fogo sai para a esquerda (o monstro mais perto está à direita)
 let c=await ctr(0);await pg.mouse.move(c.x,c.y);await pg.mouse.down();await pg.mouse.move(c.x-40,c.y-4,{steps:3});await pg.mouse.move(c.x-90,c.y-10,{steps:3});await W(150);
 let s=await st();ok(s.aim&&s.on,'arrastando: a área de mira aparece ('+JSON.stringify({aim:s.aim,on:s.on})+')');
 const dr=await pg.evaluate(()=>{const o=ctx.drawImage;let n=0;return new Promise(r=>{const f=ctx.fillRect;ctx.fillRect=function(){n++;return f.apply(this,arguments)};setTimeout(()=>{ctx.fillRect=f;r(n)},200)})});ok(dr>0,'a área é desenhada no chão enquanto arrasta ('+dr+' desenhos)');
 await pg.mouse.up();await W(700);s=await st();const pj=await pg.evaluate(()=>({fogo:P.filter(q=>q.fire).map(q=>Math.round(q.vx))}));
 ok(s.cd0>0&&s.ax<-.8,'soltar lança a habilidade na direção arrastada (ax='+(s.ax&&s.ax.toFixed(2))+')');
 ok(!s.on&&!s.aim,'a mira some ao soltar');
 // 2) arrasta e volta ao centro: cancela, não gasta nada
 await pg.evaluate(()=>{cd=[0,0,0,0];ACT=null;p.mp=p.mpMax});c=await ctr(0);await pg.mouse.move(c.x,c.y);await pg.mouse.down();await pg.mouse.move(c.x-80,c.y,{steps:3});await pg.mouse.move(c.x+2,c.y+1,{steps:3});await pg.mouse.up();await W(300);s=await st();
 ok(s.cd0===0,'arrastar e voltar ao centro cancela (sem gastar recarga)');
 // 3) só tocar: sai como antes, em direção ao monstro (direita)
 await pg.evaluate(()=>{cd=[0,0,0,0];ACT=null});c=await ctr(0);await pg.mouse.click(c.x,c.y);await W(200);s=await st();ok(s.cd0>0&&s.ax>.8,'só tocar: golpe sai mirando o monstro (ax='+(s.ax&&s.ax.toFixed(2))+')');
 // 4) segurar sem arrastar: só mostra as informações, não lança
 await pg.evaluate(()=>{cd=[0,0,0,0];ACT=null});c=await ctr(0);await pg.mouse.move(c.x,c.y);await pg.mouse.down();await W(700);s=await st();await pg.mouse.up();await W(200);const s2=await st();
 ok(s.tip&&s2.cd0===0,'segurar mostra as informações e não lança ('+JSON.stringify({tip:s.tip,cd0:s2.cd0})+')');
 // 5) Gōryūka: o círculo cai onde foi mirado (distância pelo tamanho do arrasto)
 await pg.evaluate(()=>{cd=[0,0,0,0];ACT=null;p.mp=p.mpMax;fx=fx.filter(f=>f.k!=='aviso')});c=await ctr(1);await pg.mouse.move(c.x,c.y);await pg.mouse.down();await pg.mouse.move(c.x-120,c.y,{steps:4});await W(100);await pg.mouse.up();await W(200);s=await st();
 ok(s.av.length===1&&s.av[0].x<-100&&Math.abs(s.av[0].y)<30,'Gōryūka cai no ponto mirado, longe do ninja ('+JSON.stringify(s.av)+')');
 await pg.evaluate(()=>{cd=[0,0,0,0];ACT=null;p.mp=p.mpMax;fx=fx.filter(f=>f.k!=='aviso')});c=await ctr(1);await pg.mouse.move(c.x,c.y);await pg.mouse.down();await pg.mouse.move(c.x-30,c.y,{steps:3});await W(100);await pg.mouse.up();await W(200);s=await st();
 ok(s.av.length===1&&s.av[0].x<0&&s.av[0].x>-90,'arrasto curto = área mais perto ('+JSON.stringify(s.av)+')');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close();process.exit(fails?1:0)})();
