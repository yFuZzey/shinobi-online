// Tilesets e camadas (Etapa A+B do editor): importar um tileset (original guardado sem alteração), pintar nas camadas Chão/Detalhes/Acima
// com pincel, retângulo, balde e borracha, salvar/recarregar, publicar, e o jogo desenhar (sem suavizar, sem esticar, "Acima" por cima do jogador).
// Também confere que mapas antigos continuam abrindo igual.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),crypto=require('crypto'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const adm='Tl'+suf,A=await mk(adm,0);await mget('/__admin?nome='+adm);await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
 const P=await (await b.newContext({viewport:{width:412,height:860}})).newPage();P.on('pageerror',e=>{console.log('ERRO EDITOR',e.message);fails++});
 await P.goto(GS+'/painel/mapas');await P.waitForFunction(()=>typeof createMap==='function',null,{timeout:15000});await W(500);
 // mapa antigo (Konoha, o que o editor traz) continua igual: sem campos novos, mesmo terreno do arquivo original
 const kon=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','src','ed','db','maps','atual.json'),'utf8')),konJ=JSON.parse((kon.data||kon).json);
 const ant=await P.evaluate(()=>{const j=JSON.parse(serialize());return{g:j.ground,n:j.objects.length,tem:('camadas' in j)||('tilesets' in j)}});
 ok(ant.g===konJ.ground&&ant.n===konJ.objects.length&&!ant.tem,'mapa antigo abre igual no editor e salva sem campos novos ('+ant.n+' objetos)');
 // login admin
 await P.click('#send');await P.fill('#pbU',adm);await P.fill('#pbP','12345678');await P.click('#pbIn');await W(1500);
 await P.evaluate(n=>{closeMenu();createMap(n,'folha')},'tiles_'+suf);
 // tileset de teste: 96×64, tiles 32×32, o primeiro tem um buraco transparente
 const COR=[[220,30,30],[0,200,0],[0,0,220],[230,230,0],[230,0,230],[0,220,230]];
 const tsB64=await P.evaluate(COR=>{const c=document.createElement('canvas');c.width=96;c.height=64;const g=c.getContext('2d');COR.forEach((k,i)=>{g.fillStyle='rgb('+k+')';g.fillRect((i%3)*32,(i>>1>>0)*0+Math.floor(i/3)*32,32,32)});g.clearRect(0,0,8,8);return c.toDataURL('image/png').split(',')[1]},COR);
 const tsBuf=Buffer.from(tsB64,'base64');
 await P.evaluate(()=>{tool='tile';ui()});await P.click('#tsNew');await P.setInputFiles('#tsFile',{name:'terreno.png',mimeType:'image/png',buffer:tsBuf});await P.waitForFunction(()=>TI&&TI.img,null,{timeout:8000});
 const pv=await P.evaluate(()=>({tw:+document.querySelector('#tsTw').value,th:+document.querySelector('#tsTh').value,info:document.querySelector('#tsInfo').textContent}));
 ok(pv.tw===32&&pv.th===32&&/96×64 px · 3×2 tiles de 32×32/.test(pv.info),'prévia: tamanho do tile detectado e grade 3×2 ('+pv.info.slice(0,60)+')');
 await P.click('#tsSave');await W(1800);
 const TS=await mget('/__tilesets'),tid=Object.keys(TS)[0],ST=await mget('/__store'),sha=crypto.createHash('sha256').update(tsBuf).digest('hex').slice(0,12);
 ok(tid&&TS[tid].w===96&&TS[tid].h===64&&TS[tid].tw===32&&TS[tid].arquivo==='tilesets/'+sha+'.png','tileset gravado (96×64, tile 32×32) com o arquivo no Storage pelo hash do original ('+TS[tid].arquivo+')');
 ok(ST[TS[tid].arquivo]&&ST[TS[tid].arquivo].n===tsBuf.length&&ST[TS[tid].arquivo].tipo==='image/png','arquivo original guardado sem alteração (mesmo tamanho em bytes, PNG)');
 const orig=await P.evaluate(async([url,esp])=>{const r=await fetch(url),buf=new Uint8Array(await r.arrayBuffer()),im=new Image();im.crossOrigin='anonymous';await new Promise(ok=>{im.onload=ok;im.src=url});const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
   const px=(x,y)=>[...g.getImageData(x,y,1,1).data];return{n:buf.length,w:im.width,h:im.height,furo:px(2,2),verde:px(48,16),amarelo:px(16,48)}},[MOCK+'/storage/v1/object/public/mapa-recursos/'+TS[tid].arquivo]);
 ok(orig.n===tsBuf.length&&orig.w===96&&orig.h===64&&orig.furo[3]===0&&orig.verde.join()==='0,200,0,255'&&orig.amarelo.join()==='230,230,0,255','ao baixar de volta: resolução, transparência e cores idênticas ('+orig.w+'×'+orig.h+', buraco alpha '+orig.furo[3]+')');
 ok(await P.evaluate(()=>tool==='tile'&&!!tlCur()&&!!document.querySelector('#tpk')),'depois de importar, o tileset já vem selecionado com o seletor de tiles na grade');
 // visão no editor: mundo em escala 1:1 para clicar nas células
 await P.evaluate(()=>{s=1;ox=-300;oy=-200;dirty()});
 const pos=(tx,ty)=>P.evaluate(([x,y])=>{const r=cv.getBoundingClientRect();return[r.left+ox+(x+.5)*32*s,r.top+oy+(y+.5)*32*s]},[tx,ty]);
 const tile=async(c,r)=>{const o=await P.evaluate(()=>{const k=document.querySelector('#tpk'),b=k.getBoundingClientRect();return[b.left,b.top,b.width/k.width*tpkZ]});await P.mouse.click(o[0]+(c*32+16)*o[2],o[1]+(r*32+16)*o[2])};
 const clickCell=async(tx,ty)=>{const p=await pos(tx,ty);await P.mouse.click(p[0],p[1])};
 const layer=n=>P.click('[data-tly="'+n+'"]'),sub=n=>P.click('[data-tsub="'+n+'"]');
 const count=n=>P.evaluate(n=>TLY[n].size,n);
 // Chão: pincel com arrastar (verde)
 await layer('chao');await sub('pincel');await tile(1,0);
 ok(await P.evaluate(()=>tlSel.c0===1&&tlSel.r0===0),'seleção do tile pela grade (coluna 1, linha 0)');
 const a=await pos(10,10),c=await pos(12,10);await P.mouse.move(a[0],a[1]);await P.mouse.down();await P.mouse.move((a[0]+c[0])/2,a[1],{steps:3});await P.mouse.move(c[0],c[1],{steps:3});await P.mouse.up();
 ok(await count('chao')===3&&await P.evaluate(()=>TLY.chao.get(tlSet+'|11|10').join()==='1,0'),'pincel pintou 3 tiles seguidos no Chão (arrastando)');
 // Retângulo (azul)
 await sub('ret');await tile(2,0);const r0=await pos(12,12),r1=await pos(14,13);await P.mouse.move(r0[0],r0[1]);await P.mouse.down();await P.mouse.move(r1[0],r1[1],{steps:4});await P.mouse.up();
 ok(await count('chao')===9,'retângulo 3×2 preencheu 6 tiles (total no Chão: '+await count('chao')+')');
 // Borracha
 await sub('borracha');await clickCell(11,10);
 ok(await count('chao')===8&&await P.evaluate(()=>!TLY.chao.has(tlSet+'|11|10')),'borracha tirou um tile');
 // Detalhes (amarelo) e Acima (magenta)
 await layer('detalhes');await sub('pincel');await tile(0,1);await clickCell(16,10);
 await layer('acima');await tile(1,1);await P.evaluate(()=>{s=1;ox=-700;oy=-683;dirty()});
 const m=await P.evaluate(()=>{const r=cv.getBoundingClientRect();return[r.left+ox+(25.5*32)*s,r.top+oy+(25.5*32)*s]});await P.mouse.click(m[0],m[1]);
 ok(await count('detalhes')===1&&await count('acima')===1&&await count('chao')===8,'cada tile foi para a camada certa (Chão 8, Detalhes 1, Acima 1)');
 // Balde + desfazer/refazer
 await P.evaluate(()=>{s=1;ox=-300;oy=-200;dirty()});await layer('detalhes');await sub('balde');await tile(2,1);const bc=await pos(18,12);await P.mouse.click(bc[0],bc[1]);
 const cheio=await count('detalhes');await P.evaluate(()=>undo());const aposU=await count('detalhes');await P.evaluate(()=>redo());const aposR=await count('detalhes');await P.evaluate(()=>undo());
 ok(cheio===2500&&aposU===1&&aposR===2500&&await count('detalhes')===1,'balde preencheu a camada vazia ('+cheio+' tiles); desfazer volta e refazer repete');
 // Tile de outro tamanho (16×16) não é esticado: a grade segue o tamanho do tile
 const TS16=await P.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=16;const g=c.getContext('2d');g.fillStyle='#0f0';g.fillRect(0,0,16,16);g.fillStyle='#f0f';g.fillRect(16,0,16,16);return c.toDataURL('image/png').split(',')[1]});
 await P.evaluate(()=>{tool='tile';ui()});await P.click('#tsNew');await P.setInputFiles('#tsFile',{name:'pequeno.png',mimeType:'image/png',buffer:Buffer.from(TS16,'base64')});await P.waitForFunction(()=>TI&&TI.img.width===32,null,{timeout:8000});
 const g16=await P.evaluate(()=>[+document.querySelector('#tsTw').value,+document.querySelector('#tsTh').value]);ok(g16[0]===16&&g16[1]===16,'imagem 32×16: o tile detectado é 16×16 (não força 32)');
 await P.click('#tsSave');await W(1500);
 const t16=Object.values(await mget('/__tilesets')).find(r=>r.tw===16);
 // pinta na camada Chão com o de 16 px: célula (tx,ty) na grade de 16 px
 await layer('chao');await sub('pincel');await P.click('[data-tset="'+t16.id+'"]');await tile(1,0);
 const p16=await P.evaluate(()=>{const r=cv.getBoundingClientRect();return[r.left+ox+(30*16+8)*s,r.top+oy+(30*16+8)*s]});await P.mouse.click(p16[0]+0,p16[1]);
 ok(await P.evaluate(i=>TLY.chao.has(i+'|'+Math.floor((30*16+8+0)/16)+'|30')||[...TLY.chao.keys()].some(k=>k.startsWith(i+'|')),t16.id),'tile de 16 px entrou numa grade própria de 16 px (sem esticar para 32)');
 await P.evaluate(i=>{begin();for(const k of [...TLY.chao.keys()])if(k.startsWith(i+'|'))TLY.chao.delete(k);tlDirtyAll();touch();finish()},t16.id);
 // salvar → recarregar o editor → tudo igual
 const antes=await P.evaluate(()=>JSON.stringify(JSON.parse(serialize()).camadas));
 await P.reload();await P.waitForFunction(()=>typeof createMap==='function'&&typeof TLY==='object',null,{timeout:15000});await W(1200);
 const depois=await P.evaluate(()=>({c:JSON.stringify(JSON.parse(serialize()).camadas),n:mapName,t:JSON.parse(serialize()).tilesets}));
 ok(depois.n==='tiles_'+suf&&depois.c===antes&&depois.t.length===1,'salvar e recarregar: camadas idênticas ('+JSON.parse(antes).map(x=>x.n+':'+x.d.length).join(' ')+')');
 // publicar → servidor entrega → jogo desenha
 await P.click('#send');await W(2000);
 const row=(await mget('/__mapas'))['tiles_'+suf];
 ok(row&&row.mapa.tilesets[0]===tid&&row.mapa.camadas.map(x=>x.n).join()==='chao,detalhes,acima'&&row.mapa.camadas[0].d.length===8,'publicado com tilesets e camadas no formato novo (v2 compatível)');
 await W(1500);const pub=await (await fetch(GS+'/mapas')).json();
 ok(pub.mapas['tiles_'+suf].camadas.length===3&&pub.tilesets[tid]&&pub.tilesets[tid].tw===32&&/\/mapa-recursos\/tilesets\//.test(pub.tilesets[tid].url),'servidor entrega o mapa com os tiles e os dados do tileset em /mapas');
 await A.click('#mapbtn');await W(3000);
 await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'tiles '+suf);await W(2000);
 const gm=await A.evaluate(()=>{const g=GC.getContext('2d'),px=(x,y)=>[...g.getImageData(x,y,1,1).data].join(),c=(tx,ty)=>[px(tx*32+1,ty*32+1),px(tx*32+30,ty*32+30),px(tx*32+16,ty*32+16)];
   return{cur:CURMAP,tlm:!!TLM,verde:c(10,10),azul:c(13,12),amarelo:c(16,10),apagado:px(11*32+16,10*32+16)}});
 ok(gm.cur==='tiles_'+suf&&gm.tlm,'jogo: entrou no mapa com camadas');
 ok(gm.verde.every(v=>v==='0,200,0,255')&&gm.azul.every(v=>v==='0,0,220,255')&&gm.amarelo.every(v=>v==='230,230,0,255'),'jogo: Chão e Detalhes desenhados com as cores exatas do original (sem suavizar, sem esticar)');
 ok(gm.apagado!=='0,200,0,255','jogo: o tile apagado no editor não aparece');
 await A.evaluate(()=>{p.x=25.5*32;p.y=25.5*32;gsPos&&gsPos(true)});await W(1200);
 const ac=await A.evaluate(()=>{ctx.save();const m=ctx.getTransform();ctx.restore();return{a:GA?[...GA.getContext('2d').getImageData(25*32+16,25*32+16,1,1).data].join():null,fora:GA?[...GA.getContext('2d').getImageData(5,5,1,1).data].join():null,m:[m.a,m.e,m.f],dpr:window.devicePixelRatio}});
 ok(ac.a==='230,0,230,255'&&ac.fora==='0,0,0,0','jogo: a camada Acima fica num canvas à parte (magenta no lugar certo, transparente no resto)');
 const hid=await A.evaluate(()=>{const cvs=document.querySelector('#cv'),g=cvs.getContext('2d'),k=dpr*z,w=cvs.width/k,h=cvs.height/k,cx=Math.max(0,Math.min(N*T-w,p.x-w/2))|0,cy=Math.max(0,Math.min(N*T-h,p.y-h/2))|0,sx=Math.round((p.x-cx)*k),sy=Math.round((p.y-6-cy)*k);let n=0,tot=0;for(let dx=-5;dx<=5;dx++)for(let dy=-5;dy<=5;dy++){const d=g.getImageData(sx+dx,sy+dy,1,1).data;tot++;if(d[0]===230&&d[1]===0&&d[2]===230)n++}return{n,tot}});
 ok(hid.n===hid.tot,'jogo: o personagem passa POR BAIXO da camada Acima ('+hid.n+'/'+hid.tot+' pixels do tile por cima dele)');
 // mapa antigo no jogo
 await A.evaluate(()=>switchMap('vila_areia'));await W(1500);
 const vil=await A.evaluate(()=>({cur:CURMAP,tlm:TLM,ob:OB.length,gc:!!GC}));
 ok(vil.cur==='vila_areia'&&vil.tlm===null&&vil.ob>0,'jogo: mapa antigo (Vila da Areia) abre normalmente, sem camadas ('+vil.ob+' objetos)');
 // validação de referência ausente: apagar o tileset da biblioteca e tentar publicar
 await P.evaluate(i=>{TSETS=TSETS.filter(t=>t.id!==i);ui()},tid);
 await P.click('#send');await W(800);
 ok(await P.evaluate(()=>/não está na biblioteca/.test(document.querySelector('#sendSt').textContent)),'publicar com tileset ausente é bloqueado com aviso');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
