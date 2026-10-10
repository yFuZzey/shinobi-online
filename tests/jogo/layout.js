// Configurações > Layout: tamanho dos botões/HUD/chat, arrastar para outro lugar, restaurar, e o toque não lança golpe no modo mover
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO',e.message);fails++});
 await pg.goto('file://'+path.join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Lay1');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await pg.click('.card >> nth=0');await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{autoOn=false;E.length=0;cd=[0,0,0,0]});await W(300);
 const R=id=>pg.evaluate(id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}},id);
 const b0=await R('b0'),hud0=await R('hud');
 await pg.click('#hudFace');await pg.click('#pfCfg');await W(100);
 ok(await pg.evaluate(()=>!$('#cfgp').hidden),'Configurações abre pelo menu do personagem');
 await pg.evaluate(()=>{const r=$('#laySk');r.value=140;r.dispatchEvent(new Event('input'))});let b1=await R('b0');
 ok(Math.abs(b1.w/b0.w-1.4)<.03,'slider aumenta os botões de golpe ('+(b1.w/b0.w).toFixed(2)+'x)');
 await pg.evaluate(()=>{const r=$('#layHud');r.value=130;r.dispatchEvent(new Event('input'))});let h1=await R('hud');
 ok(Math.abs(h1.w/hud0.w-1.3)<.03&&Math.abs(h1.x-hud0.x)<2,'slider aumenta o HUD ancorado no canto ('+(h1.w/hud0.w).toFixed(2)+'x)');
 // modo mover
 await pg.click('#layMove');await W(100);ok(await pg.evaluate(()=>LAYED===1&&$('#cfgp').hidden&&!$('#layBar').hidden),'modo mover: painel some e aparece a barra Concluir');
 let c=await R('b1');const cx=c.x+c.w/2,cy=c.y+c.h/2;await pg.mouse.move(cx,cy);await pg.mouse.down();await pg.mouse.move(cx-150,cy-60,{steps:5});await pg.mouse.up();await W(100);
 let c2=await R('b1');ok(Math.abs((c2.x-c.x)+150)<3&&Math.abs((c2.y-c.y)+60)<3,'arrastar move o botão de golpe ('+Math.round(c2.x-c.x)+','+Math.round(c2.y-c.y)+')');
 await pg.mouse.click(c2.x+c2.w/2,c2.y+c2.h/2);await W(150);ok(await pg.evaluate(()=>cd[1]===0),'no modo mover tocar no botão não lança o golpe');
 // não deixa sair da tela
 await pg.mouse.move(c2.x+c2.w/2,c2.y+c2.h/2);await pg.mouse.down();await pg.mouse.move(-300,-300,{steps:5});await pg.mouse.up();let c3=await R('b1');ok(c3.x>=-2&&c3.y>=-2,'não sai da tela ('+c3.x+','+c3.y+') '+JSON.stringify(await pg.evaluate(()=>LAY)));
 await pg.mouse.move(c3.x+c3.w/2,c3.y+c3.h/2);await pg.mouse.down();await pg.mouse.move(520,250,{steps:5});await pg.mouse.up();
 // arrastar o HUD
 let h2=await R('hud');await pg.mouse.move(h2.x+20,h2.y+20);await pg.mouse.down();await pg.mouse.move(h2.x+120,h2.y+80,{steps:4});await pg.mouse.up();let h3=await R('hud');ok(Math.abs((h3.x-h2.x)-100)<3&&Math.abs((h3.y-h2.y)-60)<3,'arrastar move o HUD');
 await pg.click('#layOk');await W(100);
 ok(await pg.evaluate(()=>LAYED===0&&!$('#layBar').hidden===false),'Concluir sai do modo mover');
 const sv=await pg.evaluate(()=>JSON.parse(localStorage.getItem('so-layout')));ok(sv&&sv.sk===1.4&&sv.hud===1.3&&sv.pos.b1&&sv.pos.hud,'layout salvo no aparelho');
 // depois de concluir, o botão volta a funcionar
 await pg.evaluate(()=>{cfgOpen(0)});const c6=await R('b0');await pg.mouse.click(c6.x+c6.w/2,c6.y+c6.h/2);await W(300);ok(await pg.evaluate(()=>cd[0]>0),'fora do modo mover o botão volta a lançar o golpe');
 // restaurar
 await pg.evaluate(()=>{cfgOpen(1)});await pg.click('#layRst');await W(100);const b4=await R('b0'),h4=await R('hud');ok(Math.abs(b4.w-b0.w)<1&&Math.abs(h4.x-hud0.x)<1&&Math.abs(h4.w-hud0.w)<1,'Restaurar padrão volta tudo');
 // carregar do salvo
 await pg.evaluate(()=>{localStorage.setItem('so-layout',JSON.stringify({sk:1.2,hud:1,chat:1,pos:{b0:[-40,-20]}}));layLoad();layApply(1)});const b5=await R('b0');ok(Math.abs(b5.w/b0.w-1.2)<.03&&Math.abs((b5.x+b5.w/2)-(b0.x+b0.w/2)+40)<3,'lê o layout salvo');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close();process.exit(fails?1:0)})();
