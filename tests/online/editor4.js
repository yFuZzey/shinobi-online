// Editor novo · Fase 4: ajustar a grade arrastando (desenho fora da grade), propriedades do recorte (tamanho no mapa, âncora,
// parte da frente, colisão separada), objetos no mapa (colocar, escolher, mover, escala, ordem, colisão, bloquear, lista de
// sobrepostos, duplicar, excluir, copiar/colar) e o jogo/servidor desenhando e colidindo igual.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;const MR=require('../../server/mapas_regras.js');
 const A=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();A.on('pageerror',e=>{console.log('ERRO JOGO',e.message);fails++});const adm='Ob'+suf;
 await A.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await A.click('#tabNew');await A.fill('#nu',adm);await A.fill('#np','12345678');await A.fill('#ne','t@t.com');await A.click('#goNew');
 await A.waitForFunction(()=>cur==='clan',null,{timeout:20000});await A.click('.card >> nth=0');await A.click('#go2');await A.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 await mget('/__admin?nome='+adm);await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
 const P=await (await b.newContext({viewport:{width:412,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2})).newPage();const erros=[];P.on('pageerror',e=>{erros.push(e.message);console.log('ERRO EDITOR',e.message)});
 await P.goto(GS+'/painel/editor');await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});
 const ev=(f,a)=>P.evaluate(f,a),D=t=>P.click('#dlgB button:has-text("'+t+'")');
 const cdp=await P.context().newCDPSession(P);const toque=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:i}))});
 const arrasta=async(a,c,n=8)=>{await toque('touchStart',[a]);for(let i=1;i<=n;i++)await toque('touchMove',[[a[0]+(c[0]-a[0])*i/n,a[1]+(c[1]-a[1])*i/n]]);await toque('touchEnd',[]);await W(80)};
 const tap=async q=>{await toque('touchStart',[q]);await toque('touchEnd',[]);await W(100)};
 const tela=(x,y)=>ev(([x,y])=>{const r=document.querySelector('#cv').getBoundingClientRect();return[r.left+EDITOR.ox+x*EDITOR.s,r.top+EDITOR.oy+y*EDITOR.s]},[x,y]);
 await P.fill('#lgU',adm);await P.fill('#lgP','12345678');await P.click('#lgIn');await P.waitForFunction(()=>!document.querySelector('#secSrv').hidden,null,{timeout:8000});
 // recursos: tileset com o desenho fora da grade (tiles começam em 6,4) e spritesheet com uma árvore (copa verde, tronco marrom) e uma casa azul
 const ids=await ev(async suf=>{const mk=async(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'));return new Promise(ok=>c.toBlob(ok,'image/png'))};
   const sobe=async(b,o)=>{const sha=await Recursos.sha12(await b.arrayBuffer()),orig='originais/'+sha+'.png';await Recursos.subir(orig,b,'image/png');const im=await createImageBitmap(b);
     return (await Recursos.criar(Object.assign({categoria:'',colecao:'',original:orig,arquivo:orig,w:im.width,h:im.height,fundo:null,grade:null,recortes:[],meta:{}},o))).id};
   const t=await sobe(await mk(76,40,g=>{g.fillStyle='rgb(200,0,0)';g.fillRect(6,4,32,32);g.fillStyle='rgb(0,0,200)';g.fillRect(38,4,32,32)}),{id:'r_torto_'+suf,nome:'Torto',tipo:'tileset',grade:{tw:32,th:32,mg:0,sp:0}});
   const s=await sobe(await mk(128,96,g=>{g.fillStyle='rgb(0,160,0)';g.fillRect(0,0,40,40);g.fillStyle='rgb(120,70,20)';g.fillRect(14,40,12,24);g.fillStyle='rgb(40,80,220)';g.fillRect(60,10,64,48)}),
     {id:'r_arvores_'+suf,nome:'Árvores',tipo:'spritesheet',recortes:[{id:'c1',nome:'Árvore',cat:'Natureza',x:0,y:0,w:40,h:64},{id:'c2',nome:'Casa',cat:'Estruturas',x:60,y:10,w:64,h:48}]});
   return[t,s]},suf);
 // ---- A) arrastar a grade até encaixar no desenho
 await P.click('#abreBib');await W(800);await P.click('#bbLista .rec:has-text("Torto")');await D('Abrir');await P.waitForFunction(()=>BIB.RS.r&&BIB.RS.r.id,null,{timeout:10000});await W(400);
 await ev(()=>BIB.api.abaRc('grade',true));await W(200);await P.click('#rgArr');ok(await ev(()=>BIB.api.vis.modo==='grade'),'modo “Arrastar a grade” ligado');
 await ev(()=>{const v=BIB.api.vis;v.focar({x:0,y:0,w:76,h:40},4)});await W(80);
 const g0=await ev(()=>{const v=BIB.api.vis,r=v.cv.getBoundingClientRect();return[r.left+v.ox+20*v.s,r.top+v.oy+20*v.s,v.s]});
 await arrasta([g0[0],g0[1]],[g0[0]+6*g0[2],g0[1]+4*g0[2]],6);let gr=await ev(()=>BIB.RS.r.grade);
 ok(gr.mg===6&&gr.my===4,'arrastar a grade com o dedo: começa em X 6, Y 4 (encaixou no desenho)');
 ok(await ev(()=>{const d=BIB.RS.od.data,p=(4*76+6)*4;return d[p]===200&&d[p+3]===255}),'a imagem não mudou (só a grade)');
 await P.click('[data-gn="x,-1"]');await P.click('[data-gn="y,1"]');gr=await ev(()=>BIB.RS.r.grade);ok(gr.mg===5&&gr.my===5,'ajuste fino de 1 px');
 await P.click('#rcDesf');await P.click('#rcDesf');gr=await ev(()=>BIB.RS.r.grade);ok(gr.mg===6&&gr.my===4,'desfazer o ajuste fino');
 await P.click('#rgArr');await P.click('#rcSalvar');await P.waitForFunction(()=>/Salvo/.test(document.querySelector('#rcEstado').textContent),null,{timeout:10000});
 ok((await mget('/__recursos'))[ids[0]].grade.my===4,'grade salva com início X/Y separados');
 // ---- B) propriedades do recorte: tamanho no mapa, âncora, parte da frente e colisão
 await P.click('#rcVoltar');await W(500);await P.click('#bbLista .rec:has-text("Árvores")');await D('Abrir');await P.waitForFunction(()=>BIB.RS.r&&BIB.RS.r.nome==='Árvores',null,{timeout:10000});await W(400);
 await ev(()=>BIB.api.abaRc('recortes',true));await P.click('.lrec:has-text("Árvore")');await W(200);
 ok(await ev(()=>!!document.querySelector('#rrMapa')&&document.querySelector('#rrMapa').width>0&&/Arquivo original: 128×96/.test(document.querySelector('#rcPnC').textContent)),'mostra as dimensões (original, recorte, no mapa, colisão) e a prévia no mapa');
 await P.fill('#rdW2','80');await P.press('#rdW2','Tab');await W(150);let c1=await ev(()=>BIB.RS.r.recortes.find(c=>c.id==='c1'));
 ok(c1.dw===80&&c1.dh===128&&c1.x===0&&c1.w===40,'tamanho no mapa 80×128 com proporção travada; o recorte continua 40×64');
 await P.click('[data-anc="c"]');await P.fill('#rdCt','80');await P.press('#rdCt','Tab');await W(150);
 // colisão: liga a célula à direita da âncora tocando na prévia
 await ev(()=>document.querySelector('#rrMapa').scrollIntoView({block:'center'}));await W(150);
 const pm=await ev(()=>{const c=document.querySelector('#rrMapa'),b=c.getBoundingClientRect(),d=BIB.RS.r.recortes.find(x=>x.id==='c1'),dw=d.dw,ax=d.ax,ay=d.ay,T=32,esq=Math.ceil(ax/T)+1,dir=Math.ceil((dw-ax)/T)+1,cima=Math.ceil(ay/T)+1,cols=esq+dir,rows=cima+2,z=c.width/(cols*T);
   return[b.left+((esq)*T+16)*z*b.width/c.width,b.top+((cima-1)*T+16)*z*b.height/c.height]});
 await P.mouse.click(pm[0],pm[1]);await W(200);c1=await ev(()=>BIB.RS.r.recortes.find(c=>c.id==='c1'));
 ok(c1.ax===40&&c1.ay===128&&c1.corte===80&&JSON.stringify(c1.col)==='[[0,0],[1,0]]','âncora na base, parte da frente até 80 px e colisão de 2 tiles (independente do tamanho): '+JSON.stringify(c1.col));
 await P.click('#rcSalvar');await P.waitForFunction(()=>/Salvo/.test(document.querySelector('#rcEstado').textContent),null,{timeout:10000});
 ok((await mget('/__recursos'))[ids[1]].recortes[0].corte===80,'recorte salvo com tamanho, âncora, parte da frente e colisão');
 await P.click('#rcVoltar');await W(300);await P.click('#bbVoltar');await W(300);
 // ---- C) mapa: objetos
 const id='objs_'+suf;await P.click('#novo');await P.fill('#nvNome','Objetos');await W(150);await P.fill('#nvId',id);await P.fill('#nvW','30');await P.fill('#nvH','20');await D('Criar');
 await P.waitForFunction(()=>EDITOR.m&&!document.querySelector('#editor').hidden,null,{timeout:8000});await W(400);
 await ev(()=>EDITOR.api.carregarLib());await W(1200);
 await ev(()=>EDITOR.api.ativar('objetos'));await P.click('[data-aba="pintura"]');await W(500);
 ok(await ev(()=>document.querySelectorAll('[data-ob]').length===2&&/Árvore/.test(document.querySelector('.grade-obj').textContent)),'catálogo da biblioteca na aba Pintura (2 recortes com miniatura)');
 const kA=ids[1]+'.c1',kC=ids[1]+'.c2';await P.click('[data-ob="'+kA+'"]');await P.click('#pnX');await W(200);
 await ev(()=>{EDITOR.s=.6;EDITOR.ox=10;EDITOR.oy=40});await W(80);
 await tap(await tela(10*32+10,10*32+20));let ob=await ev(()=>EDITOR.m.objetos.map(o=>({k:o.k,x:o.x,y:o.y,f:o.f})));
 ok(ob.length===1&&ob[0].k===kA&&ob[0].x===10.5&&ob[0].y===11&&JSON.stringify(ob[0].f)==='[0,[[0,0],[1,0]]]','pincel coloca a árvore encaixada no tile (10.5, 11) com a colisão do recorte');
 // objeto do jogo
 await P.click('[data-aba="pintura"]');await W(300);await P.click('[data-ca="jogo"]');await W(200);await P.click('[data-ob="tb1"]');await P.click('#pnX');await W(150);await ev(()=>{EDITOR.s=.6;EDITOR.ox=10;EDITOR.oy=40});
 await tap(await tela(18*32+16,10*32+16));ok(await ev(()=>EDITOR.m.objetos.length===2&&EDITOR.m.objetos[1].k==='tb1'),'colocou também um objeto do catálogo do jogo');
 // escolher e mover (arrastar) com a Seleção; desfazer
 await P.click('[data-f="sel"]');const o1=await tela(10.5*32,11*32-20);await arrasta(o1,await tela(12.5*32,11*32-20),6);
 ob=await ev(()=>EDITOR.m.objetos[0]);ok(ob.x===12.5&&ob.y===11&&await ev(()=>!document.querySelector('#objBar').hidden),'seleção: arrastar o objeto move (encaixado) e mostra a barra do objeto');
 await P.click('#desf');ok(await ev(()=>EDITOR.m.objetos[0].x===10.5),'desfazer volta a posição');
 // propriedades do objeto: escala, ordem, ajuste fino
 await tap(await tela(10.5*32,11*32-20));await P.click('#objBar [data-o="prop"]');await W(200);
 await P.fill('#obE','150');await P.press('#obE','Tab');await W(100);await P.selectOption('#obZ','acima');await W(100);await P.fill('#obB','-8');await P.press('#obB','Tab');await W(100);
 ob=await ev(()=>EDITOR.m.objetos[0]);ok(JSON.stringify(ob.f[2])==='{"e":1.5,"z":"acima","b":-8}'&&JSON.stringify(ob.f[1])==='[[0,0],[1,0]]','escala 150%, sempre por cima e ajuste fino — colisão continua a mesma');
 await P.selectOption('#obZ','');await W(100);
 // colisão editada no mapa
 await P.click('#obCol');await W(100);await tap(await tela(10*32+16,9*32+16));ob=await ev(()=>EDITOR.m.objetos[0]);
 ok(JSON.stringify(ob.f[1])==='[[0,0],[1,0],[0,-1]]','editar colisão no mapa: tocar liga o tile de cima');await P.click('#modoAviso button');
 // bloquear: não move nem apaga
 await P.click('#objBar [data-o="tv"]');const bl=await tela(10.5*32,11*32-20);await arrasta(bl,await tela(14.5*32,11*32-20),5);
 ok(await ev(()=>EDITOR.m.objetos[0].x===10.5),'objeto bloqueado não sai do lugar');
 await P.click('[data-f="borracha"]');await tap(bl);ok(await ev(()=>EDITOR.m.objetos.length===2),'borracha não apaga objeto bloqueado');
 await P.click('[data-f="sel"]');await tap(bl);await P.click('#objBar [data-o="tv"]');
 // sobrepostos: casa no mesmo lugar -> lista
 await ev(k=>{EDITOR.tinta.obj=k},kC);await P.click('[data-f="pincel"]');await tap(await tela(10*32+10,10*32+20));await P.click('[data-f="sel"]');await tap(await tela(10.5*32,11*32-8));
 ok(/Aqui: 2/.test(await ev(()=>document.querySelector('#objBar').textContent)),'objetos sobrepostos: botão “Aqui: 2”');
 await P.click('#objBar [data-o="aqui"]');await W(150);const nl=await ev(()=>document.querySelectorAll('#dlgB button').length);ok(nl===3,'lista os dois objetos para escolher');await P.click('#dlgB button >> nth=1');
 // duplicar e excluir
 await P.click('#objBar [data-o="dup"]');ok(await ev(()=>EDITOR.m.objetos.length===4),'duplicar objeto');await P.click('#objBar [data-o="del"]');ok(await ev(()=>EDITOR.m.objetos.length===3),'excluir objeto');
 // girar e mudar o tamanho (botões e alças no mapa) — no objeto do jogo (tb1)
 await ev(()=>{EDITOR.api.selObj(EDITOR.m.objetos.find(o=>o.k==='tb1'))});await W(150);
 await ev(()=>{const r=document.querySelector('#cv').getBoundingClientRect(),o=EDITOR.m.objetos.find(o=>o.k==='tb1');EDITOR.s=.8;EDITOR.ox=r.width/2-o.x*32*.8;EDITOR.oy=r.height/2-(o.y*32-40)*.8});await W(100);
 await P.click('#objBar [data-o="r+"]');await P.click('#objBar [data-o="r+"]');await P.click('#objBar [data-o="s+"]');
 let tb=await ev(()=>EDITOR.m.objetos.find(o=>o.k==='tb1').f);ok(tb[2]&&tb[2].r===30&&tb[2].e===1.1,'botões: girar 2×15° e aumentar 10% ('+JSON.stringify(tb[2])+')');
 const al=await ev(()=>{const o=EDITOR.m.objetos.find(o=>o.k==='tb1'),r=document.querySelector('#cv').getBoundingClientRect(),P=Render.cantos(JOGO,o),q=o.f[2],a=q.r*Math.PI/180,mt=[(P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2],d=30/EDITOR.s;
   return{esc:[r.left+EDITOR.ox+P[1][0]*EDITOR.s,r.top+EDITOR.oy+P[1][1]*EDITOR.s],gira:[r.left+EDITOR.ox+(mt[0]+Math.sin(a)*d)*EDITOR.s,r.top+EDITOR.oy+(mt[1]-Math.cos(a)*d)*EDITOR.s],anc:[r.left+EDITOR.ox+o.x*32*EDITOR.s,r.top+EDITOR.oy+o.y*32*EDITOR.s]}});
 // alça de tamanho: afastar do ponto da âncora até o dobro da distância
 await arrasta(al.esc,[al.anc[0]+(al.esc[0]-al.anc[0])*2,al.anc[1]+(al.esc[1]-al.anc[1])*2],6);tb=await ev(()=>EDITOR.m.objetos.find(o=>o.k==='tb1').f);
 ok(Math.abs(tb[2].e-2.2)<.03,'alça ⤡ no mapa: arrastar para fora dobra o tamanho ('+tb[2].e+')');
 // alça de giro: girar 90° em volta da âncora
 const al2=await ev(()=>{const o=EDITOR.m.objetos.find(o=>o.k==='tb1'),r=document.querySelector('#cv').getBoundingClientRect(),P=Render.cantos(JOGO,o),q=o.f[2],a=q.r*Math.PI/180,mt=[(P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2],d=30/EDITOR.s;
   return{gira:[r.left+EDITOR.ox+(mt[0]+Math.sin(a)*d)*EDITOR.s,r.top+EDITOR.oy+(mt[1]-Math.cos(a)*d)*EDITOR.s],anc:[r.left+EDITOR.ox+o.x*32*EDITOR.s,r.top+EDITOR.oy+o.y*32*EDITOR.s]}});
 const vx=al2.gira[0]-al2.anc[0],vy=al2.gira[1]-al2.anc[1];await arrasta(al2.gira,[al2.anc[0]-vy,al2.anc[1]+vx],10);tb=await ev(()=>EDITOR.m.objetos.find(o=>o.k==='tb1').f);
 ok(tb[2].r===120,'alça ⟳ no mapa: girar 90° (30° → '+tb[2].r+'°)');
 await P.click('#desf');ok(await ev(()=>EDITOR.m.objetos.find(o=>o.k==='tb1').f[2].r===30),'desfazer o giro');await P.click('#ref');
 ok(await ev(()=>JSON.stringify(EDITOR.m.objetos.find(o=>o.k==='tb1').f[1]||null))==='null','a colisão não muda com o tamanho nem com o giro');
 await ev(()=>EDITOR.api.selObj(null));await ev(()=>{EDITOR.s=.6;EDITOR.ox=10;EDITOR.oy=40});await W(100);
 // copiar/colar uma área com objeto
 await ev(()=>EDITOR.api.selObj(null));await arrasta(await tela(8*32+16,9*32+16),await tela(11*32+16,11*32+16),5);await P.click('#selBar [data-s="copiar"]');await P.click('[data-f="colar"]');await tap(await tela(3*32+16,3*32+16));
 ok(await ev(()=>EDITOR.m.objetos.some(o=>o.k.endsWith('.c1')&&o.x===5.5&&o.y===5)),'copiar/colar uma área leva os objetos junto');
 await P.click('#selBar [data-s="parar"]');
 // ---- D) publicar; servidor; jogo
 await P.click('#salvar');await W(300);await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(1500);
 await W(1500);const pub=await (await fetch(GS+'/mapas?dim=1')).json(),pm2=pub.mapas[id],im=pub.imagens[kA];
 ok(im&&im.sx===0&&im.w===40&&im.h===64&&im.dw===80&&im.dh===128&&im.ax===40&&im.ay===128&&im.corte===80,'servidor entrega o recorte (pedaço, tamanho, âncora, parte da frente)');
 const tbS=pm2.objects.find(o=>o[0]==='tb1');ok(tbS&&tbS[5]&&tbS[5].r===120&&Math.abs(tbS[5].e-2.2)<.03,'servidor recebe giro e tamanho do objeto');
 const arv=pm2.objects.find(o=>o[0]===kA&&o[1]===10.5);ok(arv&&JSON.stringify(arv[4])==='[[0,0],[1,0],[0,-1]]'&&arv[5]&&arv[5].e===1.5&&arv[5].b===-8,'objeto chega ao servidor com colisão própria e escala');
 await A.click('#mapbtn');await W(2500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'objetos');await W(2500);
 await A.waitForFunction(k=>TX[k]&&TX[k].rc,kA,{timeout:8000});
 const g=await A.evaluate(()=>({M:Array.from(M).join(''),cur:CURMAP}));
 ok(g.cur===id,'jogo entrou no mapa');
 ok(await A.evaluate(()=>{const o=OB.find(o=>o.k==='tb1');return o&&o.r===120&&Math.abs(o.e-2.2)<.03}),'jogo carrega o objeto girado e maior');
 const srvM=await (async()=>{const cat=JSON.parse(require('fs').readFileSync(path.join(__dirname,'..','paginas','server','mapa_objetos.json'),'utf8'));for(const k of Object.keys(pub.imagens)){cat.tsz.push(k);cat.fpt[k]=[pub.imagens[k].fw||1,pub.imagens[k].fh||1,pub.imagens[k].off|0]}return MR.compilar(MR.validar(id,'x',pm2,cat),cat).M})();
 ok(g.M===srvM,'colisão do jogo igual à do servidor (células próprias dos objetos)');
 ok(g.M[10*30+10]==='1'&&g.M[10*30+11]==='1'&&g.M[9*30+10]==='1','tiles de colisão da árvore bloqueados no jogo');
 // personagem logo atrás da árvore (acima da base): a copa (parte da frente) cobre o personagem
 await A.evaluate(()=>{p.x=10.5*32;p.y=11*32-40;gsPos&&gsPos(true)});await W(1200);
 const hid=await A.evaluate(()=>{const cvs=document.querySelector('#cv'),g=cvs.getContext('2d'),k=dpr*z,w=cvs.width/k,h=cvs.height/k,cx=Math.max(0,Math.min(N*T-w,p.x-w/2))|0,cy=Math.max(0,Math.min(NH*T-h,p.y-h/2))|0;
   let n=0,tot=0;for(let dy=-56;dy<=-44;dy+=2)for(let dx=-6;dx<=6;dx+=2){const d=g.getImageData(Math.round((p.x+dx-cx)*k),Math.round((p.y+dy-cy)*k),1,1).data;tot++;if(d[0]===0&&d[1]===160&&d[2]===0)n++}return{n,tot}});
 ok(hid.n===hid.tot,'jogo: a copa (acima da linha de 80 px, escala 150%) fica na frente do personagem ('+hid.n+'/'+hid.tot+')');
 // ---- E) editor antigo recusa mapa do editor novo
 const Q=await (await b.newContext()).newPage();await Q.goto(GS+'/painel/mapas');await Q.waitForFunction(()=>typeof parseMap==='function',null,{timeout:15000});
 ok(await Q.evaluate(()=>{try{parseMap({v:2,N:50,ed:{v:1},ground:'0'.repeat(2500),objects:[]});return false}catch(e){return /editor novo/.test(e.message)}}),'editor antigo recusa abrir mapa salvo pelo editor novo (evita perder dados)');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 await P.screenshot({path:path.join(__dirname,'ed4.png')});await A.screenshot({path:path.join(__dirname,'ed4_jogo.png')});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
