// Editor novo · Fase 2: biblioteca de recursos, importação (imagem grande, inteira antes de confirmar), navegação por toque até as bordas,
// seleção livre (pequena e grande, com alças, várias por imagem), detecção automática opcional, remoção de fundo em cópia,
// salvar/reabrir/editar seleções, pesquisar/duplicar/renomear/excluir, trazer recursos do editor antigo. O original nunca muda.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),crypto=require('crypto'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 // admin
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();const adm='Bb'+suf;
 await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',adm);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth=0');await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});await mget('/__admin?nome='+adm);await pg.close();
 const P=await (await b.newContext({viewport:{width:412,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2})).newPage();const erros=[];P.on('pageerror',e=>{erros.push(e.message);console.log('ERRO EDITOR',e.message)});
 await P.goto(GS+'/painel/editor');await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});
 const ev=(f,a)=>P.evaluate(f,a),D=t=>P.click('#dlgB button:has-text("'+t+'")');
 const cdp=await P.context().newCDPSession(P);const toque=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:i}))});
 const arrasta=async(a,c,n=8,segura=0)=>{await toque('touchStart',[a]);for(let i=1;i<=n;i++)await toque('touchMove',[[a[0]+(c[0]-a[0])*i/n,a[1]+(c[1]-a[1])*i/n]]);if(segura){for(let i=0;i<segura;i++){await W(16);await toque('touchMove',[c])}}await toque('touchEnd',[]);await W(80)};
 const tela=(x,y)=>ev(([x,y])=>{const v=BIB.api.vis,r=v.cv.getBoundingClientRect();return[r.left+v.ox+x*v.s,r.top+v.oy+y*v.s]},[x,y]);
 const V=()=>ev(()=>{const v=BIB.api.vis,r=v.cv.getBoundingClientRect();return{s:v.s,ox:v.ox,oy:v.oy,cw:r.width,ch:r.height,top:r.top,pend:v.pend,sel:v.sel}});
 await P.fill('#lgU',adm);await P.fill('#lgP','12345678');await P.click('#lgIn');await P.waitForFunction(()=>!document.querySelector('#secSrv').hidden,null,{timeout:8000});
 await P.click('#abreBib');await W(600);ok(await ev(()=>!document.querySelector('#biblio').hidden&&/Nenhum recurso/.test(document.querySelector('#bbLista').textContent)),'biblioteca abre (vazia)');
 // imagem grande 4096×2048, fundo magenta, peças de tamanhos variados (uma colada no canto de baixo/direita) e um detalhe magenta DENTRO de uma peça
 const PEC=[[0,0,40,30,'200,40,40'],[300,200,96,140,'40,160,60'],[1000,900,250,180,'60,90,220'],[2000,120,12,9,'230,230,0'],[4060,2020,36,28,'0,200,200']];
 const big=await P.evaluate(PEC=>{const c=document.createElement('canvas');c.width=4096;c.height=2048;const g=c.getContext('2d');g.fillStyle='rgb(255,0,255)';g.fillRect(0,0,4096,2048);
   for(const p of PEC){g.fillStyle='rgb('+p[4]+')';g.fillRect(p[0],p[1],p[2],p[3])}g.fillStyle='rgb(255,0,255)';g.fillRect(1100,950,20,20);return c.toDataURL('image/png').split(',')[1]},PEC);
 const bigBuf=Buffer.from(big,'base64');
 await P.setInputFiles('#bbFile',{name:'grande.png',mimeType:'image/png',buffer:bigBuf});await P.waitForFunction(()=>!document.querySelector('#recurso').hidden&&BIB.RS.img,null,{timeout:15000});await W(400);
 let v=await V();const r0=await ev(()=>({w:BIB.RS.r.w,h:BIB.RS.r.h,est:document.querySelector('#rcEstado').textContent,an:BIB.RS.an,stored:Object.keys(window.__x||{})}));
 ok(r0.w===4096&&r0.h===2048&&/Não salvo/.test(r0.est),'imagem 4096×2048 aberta inteira, ainda não enviada (pré-visualização antes de confirmar)');
 ok(Object.keys(await mget('/__recursos')).length===0,'nada vai para o banco antes de salvar');
 await P.click('#rcPnX');await W(200);v=await V();
 ok(v.ox>=-1&&v.ox+4096*v.s<=v.cw+1&&v.oy>=-1&&v.oy+2048*v.s<=v.ch+1,'a imagem inteira cabe na tela ao abrir (zoom '+(v.s*100).toFixed(1)+'%)');
 ok(r0.an&&!r0.an.transp&&r0.an.solido&&r0.an.solido.magenta,'fundo magenta sólido detectado');
 // pinça para aproximar e arrasto até o canto de baixo/direita
 await toque('touchStart',[[150,400],[250,400]]);for(let i=1;i<=8;i++)await toque('touchMove',[[150-i*14,400],[250+i*14,400]]);await toque('touchEnd',[]);await W(80);
 const v1=await V();ok(v1.s/v.s>2,'pinça aproxima (×'+(v1.s/v.s).toFixed(2)+')');
 await P.click('#rcZp');await P.click('#rcZp');await P.click('#rcZp');const v2=await V();ok(Math.abs(v2.s/v1.s-1.953)<.01,'botão + aproxima mais');
 for(let i=0;i<40;i++){const q=await V();if(q.ox+4096*q.s<=q.cw-20&&q.oy+2048*q.s<=q.ch-20)break;await arrasta([350,600],[60,300],5)}
 v=await V();ok(v.ox+4096*v.s<=v.cw&&v.oy+2048*v.s<=v.ch,'arrastando, chega até o canto de baixo/direita da imagem com zoom');
 // seleção pequena e precisa: no modo Selecionar, arrastar de dentro da peça do canto até FORA da imagem: o recorte para na borda
 await ev(()=>{const v=BIB.api.vis;v.focar({x:4060,y:2020,w:36,h:28},v.s)});await W(80);
 await P.click('#rcSel');const a=await tela(4060.2,2020.2),c=await tela(4100,2060);await arrasta(a,c,10);
 v=await V();ok(v.pend&&v.pend.x===4060&&v.pend.y===2020&&v.pend.w===36&&v.pend.h===28,'recorte junto da borda: '+JSON.stringify(v.pend)+' (para no limite da imagem)');
 ok(await ev(()=>!document.querySelector('#rcPend').hidden),'aparece “Confirmar / Cancelar” para o recorte novo');
 await P.click('#rcOk');await W(200);let rs=await ev(()=>BIB.RS.r.recortes);ok(rs.length===1&&rs[0].x===4060&&rs[0].w===36,'recorte confirmado');
 // alça: arrastar o canto de cima/esquerda para dentro (fica 30×20)
 await ev(()=>{const v=BIB.api.vis;v.focar({x:4060,y:2020,w:36,h:28},6)});await W(80);
 const al=await tela(4060,2020),al2=await tela(4066,2028);await arrasta(al,al2,6);rs=await ev(()=>BIB.RS.r.recortes);
 ok(rs[0].x===4066&&rs[0].y===2028&&rs[0].w===30&&rs[0].h===20,'alça do canto ajusta o recorte com precisão de pixel: '+[rs[0].x,rs[0].y,rs[0].w,rs[0].h]);
 await P.click('#rcDesf');rs=await ev(()=>BIB.RS.r.recortes);ok(rs[0].x===4060&&rs[0].w===36,'desfazer volta o tamanho do recorte');
 // recorte bem pequeno (peça 12×9) com zoom alto
 await ev(()=>{const v=BIB.api.vis;v.focar({x:2000,y:120,w:12,h:9},20)});await W(100);const s1=await tela(2000.3,120.3),s2=await tela(2011.7,128.7);await arrasta(s1,s2,8);
 v=await V();ok(v.pend&&v.pend.x===2000&&v.pend.y===120&&v.pend.w===12&&v.pend.h===9,'recorte pequeno 12×9 exato com zoom alto');await P.click('#rcOk');
 // cancelar um recorte
 await ev(()=>BIB.api.vis.focar({x:2000,y:120,w:12,h:9},8));await W(60);const q1=await tela(1990,122),q2=await tela(1997,128);await arrasta(q1,q2,5);await P.click('#rcNo');ok((await ev(()=>BIB.RS.r.recortes.length))===2&&!(await V()).pend,'cancelar descarta o recorte novo');
 // seleção grande, com a visão andando sozinha perto da borda da tela
 await ev(()=>BIB.api.vis.focar({x:300,y:200,w:2,h:2},2));await W(80);const g1=await tela(300,200);const vb=await V();
 await arrasta(g1,[vb.cw-5,vb.top+vb.ch-5],8,45);v=await V();
 ok(v.pend&&v.pend.x===300&&v.pend.y===200&&v.pend.x+v.pend.w>(vb.cw-vb.ox)/vb.s+5&&v.ox<vb.ox,'arrastando até a borda da tela a visão anda sozinha e o recorte passa da parte visível ('+v.pend.w+'×'+v.pend.h+')');
 await P.click('#rcNo');
 // várias seleções: detecção automática (opcional) e revisão
 await ev(()=>BIB.api.abaRc('detectar',true));await W(80);await P.click('#rdGo');await W(300);let cand=await ev(()=>BIB.api.vis.cand.map(c=>[c.x,c.y,c.w,c.h]));
 ok(cand.length===5&&cand.some(c=>c.join()==='1000,900,250,180')&&cand.some(c=>c.join()==='0,0,40,30'),'detecção acha as 5 peças (o buraco magenta dentro de uma peça não vira peça separada): '+cand.length);
 await ev(()=>BIB.api.vis.focar({x:300,y:200,w:96,h:140},1));await W(80);const cp=await tela(320,240);await P.click('#rcMover');await P.touchscreen.tap(cp[0],cp[1]);await W(100);
 ok(await ev(()=>BIB.api.vis.cand.filter(c=>c.ok===false).length===1),'tocar num resultado marca para ignorar');
 await P.click('#rdOk');await W(200);rs=await ev(()=>BIB.RS.r.recortes);ok(rs.length===4,'aceitar adiciona só os marcados e não repete os que já existem ('+rs.length+' recortes)');
 // fundo: remover magenta numa cópia; voltar ao original; refazer
 await ev(()=>BIB.api.abaRc('fundo',true));await W(80);await W(100);await P.click('#rfOn');await W(400);
 const px=(x,y)=>ev(([x,y])=>{const d=BIB.RS.fundoDados||BIB.RS.od,p=(y*d.width+x)*4;return d.data[p+3]===0?'0':[...d.data.slice(p,p+4)].join()},[x,y]);
 ok(await px(500,500)==='0'&&await px(10,10)==='200,40,40,255'&&await px(1105,955)==='255,0,255,255','fundo magenta removido na cópia; o magenta dentro da peça fica');
 ok(await ev(()=>{const d=BIB.RS.od,p=(500*d.width+500)*4;return d.data[p+3]===255&&d.data[p]===255}),'o original continua com o fundo');
 await P.click('#rfVolta');await W(200);ok(await ev(()=>!BIB.RS.r.fundo&&!BIB.RS.fundoCv),'“Voltar ao original” desfaz a remoção');await P.click('#rcDesf');await W(300);ok(await ev(()=>!!BIB.RS.r.fundo&&!!BIB.RS.fundoCv),'desfazer traz a remoção de volta');
 // info e salvar
 await ev(()=>BIB.api.abaRc('info',true));await W(80);await P.fill('#riNome','Peças grandes');await P.press('#riNome','Tab');await P.fill('#riCol','Teste '+suf);await P.press('#riCol','Tab');await W(100);
 await P.click('#rcSalvar');await P.waitForFunction(()=>/Salvo/.test(document.querySelector('#rcEstado').textContent),null,{timeout:15000});
 const RR=await mget('/__recursos'),rec=Object.values(RR)[0],ST=await mget('/__store'),sha=crypto.createHash('sha256').update(bigBuf).digest('hex').slice(0,12);
 ok(rec&&rec.nome==='Peças grandes'&&rec.colecao==='Teste '+suf&&rec.w===4096&&rec.h===2048&&rec.recortes.length===4,'recurso gravado com nome, coleção e 4 recortes');
 ok(rec.original==='originais/'+sha+'.png'&&ST[rec.original]&&ST[rec.original].n===bigBuf.length,'original gravado sem alteração (mesmos bytes, caminho pelo hash)');
 ok(/^derivados\/[a-f0-9]{12}\.png$/.test(rec.arquivo)&&ST[rec.arquivo],'cópia sem fundo gravada à parte ('+rec.arquivo+')');
 const dl=await ev(async([o,d])=>{const ld=async u=>{const i=new Image();i.crossOrigin='anonymous';await new Promise(k=>{i.onload=k;i.src=u});const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);return{w:i.width,h:i.height,p:(x,y)=>[...g.getImageData(x,y,1,1).data].join()}};
   const a=await ld(o),b=await ld(d);return{aw:a.w,ah:a.h,a:a.p(500,500),bw:b.w,bh:b.h,b:b.p(500,500),bc:b.p(4070,2030)}},[MOCK+'/storage/v1/object/public/mapa-recursos/'+rec.original,MOCK+'/storage/v1/object/public/mapa-recursos/'+rec.arquivo]);
 ok(dl.aw===4096&&dl.ah===2048&&dl.a==='255,0,255,255'&&dl.bw===4096&&dl.bh===2048&&dl.b.endsWith(',0')&&dl.bc==='0,200,200,255','baixando de volta: mesma resolução, cores preservadas, transparência só na cópia');
 // reabrir e editar uma seleção já salva
 await P.click('#rcVoltar');await W(500);ok(await ev(()=>!document.querySelector('#biblio').hidden&&document.querySelectorAll('#bbLista .rec').length===1),'volta para a biblioteca com o recurso na lista');
 await P.click('#bbLista .rec');await D('Abrir');await P.waitForFunction(()=>!document.querySelector('#recurso').hidden&&BIB.RS.r&&BIB.RS.r.id,null,{timeout:15000});await W(300);
 const ro=await ev(()=>({n:BIB.RS.r.recortes.length,f:!!BIB.RS.fundoCv,est:document.querySelector('#rcEstado').textContent}));ok(ro.n===4&&ro.f&&/Salvo/.test(ro.est),'reabre com os recortes e a remoção de fundo');
 await ev(()=>BIB.api.abaRc('recortes',true));await W(80);await P.click('.lrec >> nth=0');await W(150);const c0=await ev(()=>BIB.RS.r.recortes.find(x=>x.id===BIB.api.vis.sel));
 ok(await ev(()=>{const c=document.querySelector('#rrPrev');return c&&c.width>0}),'mostra o recorte ampliado');
 await P.fill('#rrX',String(c0.x-1));await P.press('#rrX','Tab');await P.fill('#rrNome','Editado');await P.press('#rrNome','Tab');await W(100);
 await P.fill('#rrW','99999');await P.press('#rrW','Tab');await W(100);ok(await ev(id=>BIB.RS.r.recortes.find(x=>x.id===id).w,c0.id)===c0.w,'tamanho fora da imagem é recusado');
 await P.click('#rcSalvar');await P.waitForFunction(()=>/Salvo/.test(document.querySelector('#rcEstado').textContent),null,{timeout:15000});
 const rec2=(await mget('/__recursos'))[rec.id],e2=rec2.recortes.find(x=>x.id===c0.id);
 ok(e2.x===c0.x-1&&e2.nome==='Editado'&&rec2.original===rec.original&&rec2.arquivo===rec.arquivo,'seleção editada depois de salvar; arquivos não mudam');
 // conflito: outra tela muda o recurso
 await fetch(MOCK+'/rest/v1/mapa_recursos?id=eq.'+rec.id,{method:'PATCH',headers:{apikey:'svc-test','Content-Type':'application/json'},body:JSON.stringify({nome:'Outro'})});
 await ev(()=>BIB.api.abaRc('info',true));await W(80);await P.fill('#riNome','Minha versão');await P.press('#riNome','Tab');await P.click('#rcSalvar');await W(600);
 ok(/Alterado em outro lugar/.test(await ev(()=>document.querySelector('#dlgT').textContent)),'salvar por cima de mudança de outra tela avisa');await D('Cancelar');await W(200);
 ok((await mget('/__recursos'))[rec.id].nome==='Outro','cancelado: não sobrescreveu');
 await P.click('#rcVoltar');await D('Descartar alterações');await W(400);
 // imagem com transparência real: preservada, sem cópia
 const tr=await P.evaluate(()=>{const c=document.createElement('canvas');c.width=128;c.height=96;const g=c.getContext('2d');g.fillStyle='rgba(0,150,0,1)';g.fillRect(8,8,40,40);g.fillStyle='rgba(255,0,255,1)';g.fillRect(20,20,8,8);g.fillStyle='rgba(0,0,200,.5)';g.fillRect(70,30,30,30);return c.toDataURL('image/png').split(',')[1]});
 const trBuf=Buffer.from(tr,'base64');await P.setInputFiles('#bbFile',{name:'transparente.png',mimeType:'image/png',buffer:trBuf});await P.waitForFunction(()=>!document.querySelector('#recurso').hidden&&BIB.RS.img&&!BIB.RS.r.id,null,{timeout:8000});
 ok(await ev(()=>BIB.RS.an.transp&&!BIB.RS.r.fundo),'transparência real detectada; nenhuma remoção automática');
 await ev(()=>BIB.api.abaRc('info',true));await W(80);await P.fill('#riCat','Objetos');await P.press('#riCat','Tab');await P.click('#rcSalvar');await P.waitForFunction(()=>/Salvo/.test(document.querySelector('#rcEstado').textContent),null,{timeout:15000});
 const rt=Object.values(await mget('/__recursos')).find(x=>x.nome==='transparente'),st2=await mget('/__store');
 ok(rt&&rt.arquivo===rt.original&&st2[rt.original].n===trBuf.length,'imagem transparente salva como está (o jogo usa o próprio original)');
 await P.click('#rcVoltar');await W(500);
 // pesquisa, categorias, duplicar, renomear, excluir
 await P.fill('#bbBusca','teste '+suf);await W(100);ok(await ev(()=>document.querySelectorAll('#bbLista .rec').length===1),'pesquisa pela coleção');
 await P.fill('#bbBusca','');await P.click('#bbCats [data-cat="Objetos"]');ok(await ev(()=>document.querySelectorAll('#bbLista .rec').length===1&&/transparente/.test(document.querySelector('#bbLista').textContent)),'filtro por categoria');
 await P.click('#bbCats [data-cat="Todas"]');await P.click('#bbLista .rec:has-text("transparente")');await D('Duplicar');await P.fill('#pnNome','Transp 2');await D('OK');await W(500);
 let RR3=Object.values(await mget('/__recursos'));const dup=RR3.find(x=>x.nome==='Transp 2');ok(dup&&dup.original===rt.original&&dup.id!==rt.id,'duplicar cria outro recurso com o mesmo arquivo');
 await P.click('#bbLista .rec:has-text("Transp 2")');await D('Renomear');await P.fill('#pnNome','Transp renomeado');await D('OK');await W(500);
 ok((await mget('/__recursos'))[dup.id].nome==='Transp renomeado','renomear');
 await P.click('#bbLista .rec:has-text("Transp renomeado")');await D('Excluir');await W(150);ok(/Excluir recurso\?/.test(await ev(()=>document.querySelector('#dlgT').textContent)),'excluir pede confirmação');
 await D('Excluir');await W(500);ok(!(await mget('/__recursos'))[dup.id]&&(await mget('/__store'))[rt.original],'recurso excluído (o arquivo continua guardado para quem usa)');
 // editor antigo: tileset já existente aparece e pode ser trazido sem reenviar
 const tsb=Buffer.from(tr,'base64'),tsha=crypto.createHash('sha256').update(tsb).digest('hex').slice(0,12);
 await fetch(MOCK+'/storage/v1/object/mapa-recursos/tilesets/'+tsha+'.png',{method:'POST',headers:{apikey:'x',Authorization:'Bearer tok-'+(await ev(()=>Persist.sessao().uid)),'Content-Type':'image/png'},body:tsb});
 await fetch(MOCK+'/rest/v1/mapa_tilesets',{method:'POST',headers:{apikey:'svc-test','Content-Type':'application/json'},body:JSON.stringify({id:'t_velho_'+suf,nome:'Velho '+suf,arquivo:'tilesets/'+tsha+'.png',w:128,h:96,tw:32,th:32,mg:0,sp:0,px:true})});
 await P.click('#bbVoltar');await W(300);await P.click('#abreBib');await W(800);ok(await ev(s=>!document.querySelector('#bbAnt').hidden&&document.querySelector('#bbAntL').textContent.includes('Velho '+s),suf),'tileset do editor antigo aparece na biblioteca');
 await P.click('#bbAntL .rec:has-text("Velho")');await D('Trazer');await W(600);const vel=Object.values(await mget('/__recursos')).find(x=>x.meta&&x.meta.de==='tileset:t_velho_'+suf);
 ok(vel&&vel.arquivo==='tilesets/'+tsha+'.png'&&vel.grade&&vel.grade.tw===32&&vel.tipo==='tileset','trazido para a biblioteca com a mesma grade e o mesmo arquivo');
 ok(await ev(s=>!document.querySelector('#bbAntL').textContent.includes('Velho '+s),suf),'depois de trazido, sai da lista do editor antigo');
 await P.screenshot({path:path.join(__dirname,'ed2_biblio.png')});
 await P.click('#bbLista .rec:has-text("Outro")');await D('Abrir');await P.waitForFunction(()=>BIB.RS.r&&BIB.RS.r.id,null,{timeout:15000});await W(400);await ev(()=>BIB.api.abaRc('recortes',true));await W(80);await P.click('.lrec >> nth=1');await W(300);
 await P.screenshot({path:path.join(__dirname,'ed2_recurso.png')});
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
