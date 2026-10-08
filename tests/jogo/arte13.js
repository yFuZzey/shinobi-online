// Pacotes 12 e 13: ícones dos jutsus do Nara; ícones nos estados (lento, preso…); números de dano com a fonte nova
// (branco/amarelo/vermelho/cinza); círculo rúnico nos avisos de área; faixa no aviso de subir de nível
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2})).newPage();pg.on('pageerror',e=>{console.log('ERRO',e.message);fails++});
 await pg.goto('file://'+path.join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Shika');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth=2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{switchMap('vila_areia')});await W(400);
 // Nara: todos os jutsus da árvore com ícone desenhado
 const nr=await pg.evaluate(()=>{let g=0;while(CH.lv<60&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);$('#lvup').hidden=true;
  const ids=JT.nara.flatMap(B=>B.n.map(n=>n.id)).filter(id=>id!=='kuchi');return ids.map(id=>id+':'+(uiJuIc({id,t:(JU.nara[id]||{}).t})?1:0))});
 ok(nr.length===9&&nr.every(x=>/:1$/.test(x)),'Nara: os 9 jutsus com ícone ('+nr.join(' ')+')');
 const bar=await pg.evaluate(()=>[...document.querySelectorAll('#skb .uij, .sk .uij, img.uij')].length);ok(bar>0,'ícones do Nara aparecem nos botões ('+bar+')');
 // estados com ícone
 const st=await pg.evaluate(()=>{bufStart('lento',{spd:-30,t:5,nm:'Lento: 30% mais devagar'});PRT=3;PCF=2;bufHud(1);const el=document.getElementById('bufs');
  return{n:el.querySelectorAll('.sti').length,txt:el.textContent}});
 ok(st.n>=3&&/Lento/.test(st.txt)&&/Preso/.test(st.txt)&&/Confuso/.test(st.txt),'estados com ícone: lento, preso, confuso ('+st.n+' ícones)');
 await pg.evaluate(()=>{PRT=0;PCF=0;delete BUFS.lento;bufHud(1)});
 // números de dano: desenhados com a fonte nova, cada tipo na sua cor
 const dg=await pg.evaluate(()=>new Promise(r=>{E=[];const vis={};const di=ctx.drawImage;ctx.drawImage=function(im){for(const k in DGI)if(DGI[k].im===im)vis[k]=(vis[k]||0)+1;return di.apply(this,arguments)};
  FT.push({x:p.x,y:p.y-60,t:123,life:.8},{x:p.x+30,y:p.y-60,t:'88!',crit:1,life:.8},{x:p.x-30,y:p.y-60,t:7,r:1,life:.8},{x:p.x,y:p.y-80,t:45,oth:1,life:.8},{x:p.x,y:p.y-90,t:'esquivou',txt:1,life:.8});
  setTimeout(()=>{ctx.drawImage=di;r(vis)},300)}));
 ok(dg.dg_branco>0&&dg.dg_amarelo>0&&dg.dg_vermelho>0&&dg.dg_cinza>0,'números de dano com a fonte nova: seu dano, crítico, dano levado e de outros ('+JSON.stringify(dg)+')');
 await pg.evaluate(()=>FT.push({x:p.x,y:p.y-60,t:123,life:2},{x:p.x+34,y:p.y-62,t:'456!',crit:1,life:2},{x:p.x-34,y:p.y-58,t:9,r:1,life:2}));await W(150);
 await pg.screenshot({path:path.join(__dirname,'arte13_numeros.png'),clip:{x:300,y:80,width:260,height:180}});
 // aviso de área com círculo rúnico (vermelho no fogo, azul no Hyuga)
 const rn=await pg.evaluate(()=>new Promise(r=>{const vis={};const di=ctx.drawImage;ctx.drawImage=function(im){for(const k in RNI)if(RNI[k]===im)vis[k]=(vis[k]||0)+1;return di.apply(this,arguments)};
  fx.push({k:'aviso',x:p.x+60,y:p.y,r:70,col:'#ff5a1a',life:1.2,max:1.2},{k:'aviso',x:p.x-60,y:p.y,r:60,col:'#9db7ff',life:1.2,max:1.2});setTimeout(()=>{ctx.drawImage=di;r(vis)},1100)}));
 ok(rn.runa_vermelha>0&&rn.runa_azul>0&&rn.runa_some>0,'avisos de área com círculo rúnico (vermelho, azul e sumindo no fim) ('+JSON.stringify(rn)+')');
 await pg.evaluate(()=>fx.push({k:'aviso',x:p.x+60,y:p.y,r:70,col:'#ff5a1a',life:2,max:2},{k:'aviso',x:p.x-60,y:p.y,r:60,col:'#9db7ff',life:2,max:2}));await W(500);
 await pg.screenshot({path:path.join(__dirname,'arte13_runas.png'),clip:{x:250,y:90,width:360,height:200}});
 // faixa no aviso de nível
 const lv=await pg.evaluate(()=>{gainXp(xpNeed(CH.lv)-CH.xp);const el=$('#lvup');return{vis:!el.hidden,bg:getComputedStyle(el,'::before').backgroundImage.slice(0,30)}});
 ok(lv.vis&&/url\(/.test(lv.bg),'aviso de subir de nível com a faixa dourada ('+lv.bg+')');
 await W(200);await pg.screenshot({path:path.join(__dirname,'arte13_nivel.png'),clip:{x:220,y:20,width:400,height:160}});
 await pg.evaluate(()=>{$('#lvup').hidden=true;bufStart('lento',{spd:-30,t:9,nm:'Lento: 30% mais devagar'});bufStart('campo',{red:20,t:9,nm:'Campo de Sombras: −20% de dano recebido'});PRT=4;bufHud(1)});await W(200);
 await pg.screenshot({path:path.join(__dirname,'arte13_estados.png'),clip:{x:0,y:0,width:420,height:200}});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
