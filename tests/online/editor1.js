// Editor novo (/painel/editor) · Fase 1: modelo (formato antigo sem perda, redimensionar), gerenciador (criar, abrir, duplicar, renomear, excluir),
// visualização com toque (arrastar, pinça, zoom, ajustar), salvar no aparelho (cópias, recuperação), publicar sem sobrescrever em silêncio,
// e o jogo/servidor com mapas de outro tamanho (70×40), mantendo os 50×50 iguais.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
const ordena=o=>Array.isArray(o)?o.map(ordena):o&&typeof o==='object'?Object.keys(o).sort().reduce((r,k)=>(r[k]=ordena(o[k]),r),{}):o;
(async()=>{
 const Mo=require('../../server/editor/modelo.js'),MR=require('../../server/mapas_regras.js'),srv=path.join(__dirname,'..','paginas','server'),cat=JSON.parse(fs.readFileSync(srv+'/mapa_objetos.json','utf8'));
 // 1) modelo: mapas antigos abrem e saem idênticos
 for(const f of ['atual','vila_areia']){const d=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','src','ed','db','maps',f+'.json'),'utf8')),j=JSON.parse((d.data||d).json);j.name=f;
  const o=Mo.paraJogo(Mo.deJogo(j,f),true);ok(JSON.stringify(ordena(o))===JSON.stringify(ordena(j)),'modelo: mapa antigo '+f+' sai idêntico (sem perder nada)')}
 {const j={v:2,N:50,T:32,name:'x',ground:'0'.repeat(2500),objects:[['tb1',10.25,12.125,1,[[0,0]],'campo_futuro']],spawn:[20.5,20.5],algo_novo:{a:1}};
  const o=Mo.paraJogo(Mo.deJogo(j,'x'),true);ok(o.objects[0].length===6&&o.objects[0][1]===10.25&&o.algo_novo.a===1,'modelo: campos desconhecidos e coordenadas com fração são preservados')}
 // 2) redimensionar: ampliar não perde; reduzir conta o que sai; âncora central desloca em passo par
 {const m=Mo.novo({id:'r1',nome:'R',W:50,H:50,terreno:0});m.chao[30*50+30]=3;m.objetos.push({k:'tb1',x:40.5,y:41,f:[]},{k:'tb1',x:10.5,y:10,f:[]});m.areas.push({x:35,y:35,w:10,h:10,mobs:[]});m.col[45*50+45]=1;
  const a=Mo.redimensionar(m,70,60,0,0);ok(!a.erro&&a.mapa.objetos.length===2&&Mo.perdasTexto(a.perdas).length===0&&a.mapa.chao[30*70+30]===3,'ampliar 50×50 → 70×60 (canto): nada perdido');
  const b=Mo.redimensionar(m,30,30,0,0);ok(b.perdas.objetos===1&&b.perdas.areasRemovidas===1&&b.perdas.colisao===1&&Mo.perdasTexto(b.perdas).length>=3,'reduzir para 30×30 lista o que será removido ('+Mo.perdasTexto(b.perdas).join('; ')+')');
  const c=Mo.redimensionar(m,61,50,.5,0);ok(c.perdas.dx%2===0&&c.mapa.objetos[0].x===40.5+c.perdas.dx,'âncora no centro desloca em passo par ('+c.perdas.dx+' tiles)');
  ok(!!Mo.redimensionar(m,100,65,0,0).erro&&!!Mo.redimensionar(m,19,50,0,0).erro,'limites: mínimo 20, máximo 100 por lado e 6400 tiles');}
 // 3) servidor: mapa 70×40 é aceito, a colisão tem o tamanho certo; 50×50 sai igual a antes
 {const m=Mo.novo({id:'larg_'+suf,nome:'Largo',W:70,H:40,terreno:0}),j=Mo.paraJogo(m,true),v=MR.validar(m.id,m.nome,j,cat),c=MR.compilar(v,cat);
  ok(v&&v.W===70&&v.H===40&&c.M.length===2800&&c.M[0]==='1'&&c.M[40*70-1]==='1'&&c.M[20*70+35]==='0','servidor aceita 70×40 e monta a colisão 70×40 com a borda bloqueada');
  const v5=MR.validar('qq','Q',Mo.paraJogo(Mo.novo({id:'qq',W:50,H:50}),true),cat);ok(v5&&!('W' in v5)&&!('H' in v5),'mapa 50×50 continua sem W/H (igual aos antigos)')}
 const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const P=await (await b.newContext({viewport:{width:412,height:860},hasTouch:true,isMobile:true,deviceScaleFactor:2})).newPage();const erros=[];P.on('pageerror',e=>{erros.push(e.message);console.log('ERRO EDITOR',e.message)});P.on('console',m=>{if(m.type()==='error')console.log('console:',m.text())});
 await P.goto(GS+'/painel/editor');await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});
 ok(await P.evaluate(()=>!document.querySelector('#inicio').hidden&&document.querySelectorAll('#lsBase .item').length===2),'editor novo abre na lista de mapas, com os 2 mapas do jogo');
 await P.screenshot({path:path.join(__dirname,'ed1_lista.png')});
 const ev=(f,a)=>P.evaluate(f,a),D=t=>P.click('#dlgB button:has-text("'+t+'")'),aberto=()=>ev(()=>!document.querySelector('#dlg').hidden);
 const cdp=await P.context().newCDPSession(P);const toque=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:i}))});
 const tela=(tx,ty)=>ev(([x,y])=>{const r=document.querySelector('#cv').getBoundingClientRect();return[r.left+EDITOR.ox+x*32*EDITOR.s,r.top+EDITOR.oy+y*32*EDITOR.s]},[tx,ty]);
 // admin (no jogo e no editor)
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO JOGO',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const adm='Ed'+suf,A=await mk(adm,0);await mget('/__admin?nome='+adm);await A.evaluate(()=>ONL.ws.close());await A.waitForFunction(()=>ONL.adm&&ONL.joined,null,{timeout:20000});
 await P.fill('#lgU','naoexiste'+suf);await P.fill('#lgP','x');await P.click('#lgIn');await W(800);
 ok(/incorretos|não é admin|Erro/.test(await ev(()=>document.querySelector('#lgSt').textContent)),'login errado avisa');
 await P.fill('#lgU',adm);await P.fill('#lgP','12345678');await P.click('#lgIn');await W(1500);await P.waitForFunction(()=>!document.querySelector('#secSrv').hidden,null,{timeout:8000});
 ok(true,'admin entra e vê a lista do servidor');
 // criar 70×40
 const id='floresta_'+suf;
 await P.click('#novo');await P.fill('#nvNome','Floresta Larga');await W(150);await P.fill('#nvId',id);await P.fill('#nvW','101');await W(100);
 ok(/máximo/.test(await ev(()=>document.querySelector('#nvErr').textContent)),'tamanho acima do limite é recusado na hora');
 await P.click('.presets button:has-text("70×40")');await P.selectOption('#nvTerr','0');await P.screenshot({path:path.join(__dirname,'ed1_novo.png')});await D('Criar');
 await P.waitForFunction(()=>!document.querySelector('#editor').hidden&&EDITOR.m,null,{timeout:8000});await W(400);
 const c1=await ev(()=>({W:EDITOR.m.W,H:EDITOR.m.H,est:document.querySelector('#edEstado').textContent,info:document.querySelector('#edInfo').textContent,chao:EDITOR.cache.chao&&[EDITOR.cache.chao.width,EDITOR.cache.chao.height],sp:EDITOR.m.spawn}));
 ok(c1.W===70&&c1.H===40&&/Salvo/.test(c1.est)&&c1.chao&&c1.chao[0]===2240&&c1.chao[1]===1280,'mapa 70×40 criado, salvo no aparelho e desenhado (chão 2240×1280 px)');
 {const L=await ev(async()=>(await Persist.listar()).map(r=>r.id));ok(L.includes(id),'rascunho gravado no aparelho (IndexedDB) '+JSON.stringify(L))}
 await P.screenshot({path:path.join(__dirname,'ed1_mapa.png')});
 // toque: arrastar, pinça, botões de zoom, ajustar
 const v0=await ev(()=>({s:EDITOR.s,ox:EDITOR.ox,oy:EDITOR.oy}));
 await toque('touchStart',[[200,300]]);for(let i=1;i<=6;i++)await toque('touchMove',[[200-i*15,300-i*10]]);await toque('touchEnd',[]);await W(100);
 const v1=await ev(()=>({s:EDITOR.s,ox:EDITOR.ox,oy:EDITOR.oy}));
 ok(Math.abs(v1.ox-(v0.ox-90))<2&&Math.abs(v1.oy-(v0.oy-60))<2&&v1.s===v0.s,'um dedo arrasta a visão ('+Math.round(v1.ox-v0.ox)+', '+Math.round(v1.oy-v0.oy)+' px)');
 await toque('touchStart',[[150,300],[250,300]]);for(let i=1;i<=6;i++)await toque('touchMove',[[150-i*10,300],[250+i*10,300]]);await toque('touchEnd',[]);await W(100);
 const v2=await ev(()=>EDITOR.s);ok(Math.abs(v2/v1.s-2.2)<.05,'pinça com dois dedos aproxima (zoom ×'+(v2/v1.s).toFixed(2)+')');
 await P.click('#zMais');const v3=await ev(()=>EDITOR.s);await P.click('#zMenos');await P.click('#zMenos');const v4=await ev(()=>EDITOR.s);
 ok(Math.abs(v3/v2-1.25)<.01&&Math.abs(v4/v3-.64)<.01,'botões + e − mudam o zoom');
 await P.click('#zAjustar');const fit=await ev(()=>{const r=document.querySelector('#cv').getBoundingClientRect();return EDITOR.ox>=-1&&EDITOR.oy>=-1&&EDITOR.ox+70*32*EDITOR.s<=r.width+1&&EDITOR.oy+40*32*EDITOR.s<=r.height+1});
 ok(fit,'“ajustar” mostra o mapa inteiro na tela');
 // propriedades: tocar no mapa para pôr o nascimento; desfazer/refazer
 await P.click('[data-aba="prop"]');await P.click('#pSt');await W(100);const tp=await tela(10.5,12.5);await P.touchscreen.tap(tp[0],tp[1]);await W(200);
 const s1=await ev(()=>({sp:EDITOR.m.spawn.join(),sujo:EDITOR.sujo,est:document.querySelector('#edEstado').textContent}));
 ok(s1.sp==='10.5,12.5'&&s1.sujo&&/Não salvo/.test(s1.est),'tocar no mapa pôs o nascimento em (10, 12) e marcou “Não salvo”');
 await P.click('#desf');const u1=await ev(()=>EDITOR.m.spawn.join());await P.click('#ref');const u2=await ev(()=>EDITOR.m.spawn.join());
 ok(u1===c1.sp.join()&&u2==='10.5,12.5','desfazer e refazer');
 // borda bloqueada não aceita o nascimento
 await P.click('#pSt');const tb=await tela(.5,.5);await P.touchscreen.tap(tb[0]+2,tb[1]+2);await W(150);ok(await ev(()=>EDITOR.m.spawn.join())==='10.5,12.5','nascimento na borda bloqueada é recusado');
 await ev(()=>{document.querySelector('#modoAviso button')&&document.querySelector('#modoAviso button').click()});
 await P.click('#salvar');await W(400);ok(await ev(()=>!EDITOR.sujo&&/Salvo/.test(document.querySelector('#edEstado').textContent)),'Salvar grava e tira o aviso de “Não salvo”');
 // recuperação: muda, não salva, recarrega a página
 await ev(()=>EDITOR.api.mudar(m=>{m.spawn=[20.5,20.5]},'nada'));await W(2200);
 await P.reload();await P.waitForFunction(()=>window.EDITOR&&EDITOR.pronto,null,{timeout:15000});await W(300);
 await P.click('#lsLocal .item button');await D('Abrir');await W(300);
 ok(/Recuperar/.test(await ev(()=>document.querySelector('#dlgT').textContent)),'ao reabrir, oferece recuperar as alterações não salvas');
 await D('Recuperar');await W(300);ok(await ev(()=>EDITOR.m.spawn.join()==='20.5,20.5'&&EDITOR.sujo),'alterações recuperadas (continuam marcadas como não salvas)');
 await P.click('#salvar');await W(300);
 // redimensionar: reduzir avisa o que será removido; ampliar de volta
 await ev(()=>EDITOR.api.mudar(m=>{m.objetos.push({k:'tb1',x:65.5,y:20,f:[]})},'nada'));
 await P.click('[data-aba="prop"]');await P.screenshot({path:path.join(__dirname,'ed1_prop.png')});await P.click('#pRed');await P.fill('#rdW','60');await W(150);
 ok(/1 objeto/.test(await ev(()=>document.querySelector('#rdRes').textContent)),'reduzir mostra antes o que será removido (1 objeto)');
 await D('Aplicar');await W(150);ok(/Confirmar redução/.test(await ev(()=>document.querySelector('#dlgT').textContent)),'pede confirmação antes de remover');
 await D('Redimensionar mesmo assim');await W(300);ok(await ev(()=>EDITOR.m.W===60&&EDITOR.m.objetos.length===0&&EDITOR.cache.chao.width===1920),'mapa reduzido para 60×40 (objeto de fora removido)');
 await P.click('#desf');await W(200);ok(await ev(()=>EDITOR.m.W===70&&EDITOR.m.objetos.length===1),'desfazer volta para 70×40 com o objeto');
 await ev(()=>EDITOR.api.mudar(m=>{m.objetos=[]},'nada'));await P.click('#salvar');await W(300);
 // publicar
 await P.click('#publicar');await W(200);await D('Enviar e pôr no jogo');await W(1200);
 const row=(await mget('/__mapas'))[id];if(!row)console.log('DBG pub',await ev(()=>document.querySelector('#dlgT').textContent+' | '+document.querySelector('#dlgC').textContent+' | '+document.querySelector('#dlg').hidden));
 ok(row&&row.publicado&&row.mapa.W===70&&row.mapa.H===40&&row.mapa.ground.length===2800&&row.nome==='Floresta Larga','publicado no servidor (70×40, no jogo)');
 const regS=await ev(async id=>(await Persist.ler(id)).servidor,id);ok(regS&&regS.atualizado_em===row.atualizado_em,'rascunho ligado à versão do servidor');
 // conflito: alguém muda no servidor; publicar de novo avisa e não sobrescreve sem confirmar
 await fetch(MOCK+'/rest/v1/mapas?id=eq.'+id,{method:'PATCH',headers:{apikey:'svc-test','Content-Type':'application/json'},body:JSON.stringify({nome:'Mudado por outro'})});
 await ev(()=>EDITOR.api.mudar(m=>{m.spawn=[30.5,20.5]},'nada'));await P.click('#publicar');await W(200);await D('Enviar');await W(800);
 ok(/Alterado no servidor/.test(await ev(()=>document.querySelector('#dlgT').textContent)),'publicar por cima de mudança alheia avisa (conflito)');
 await D('Cancelar (salvar só no aparelho)');await W(300);ok((await mget('/__mapas'))[id].nome==='Mudado por outro','cancelado: o servidor não foi sobrescrito');
 await P.click('#publicar');await W(200);await D('Enviar');await W(800);await D('Sobrescrever mesmo assim');await W(1000);
 const row2=(await mget('/__mapas'))[id];ok(row2.nome==='Floresta Larga'&&row2.mapa.spawn.join()==='30.5,20.5','depois de confirmar, sobrescreve');
 // servidor do jogo: app novo recebe o 70×40; app antigo não
 await W(1500);const novoApp=await (await fetch(GS+'/mapas?dim=1')).json(),velho=await (await fetch(GS+'/mapas')).json();
 ok(novoApp.mapas[id]&&novoApp.mapas[id].W===70&&!velho.mapas[id],'servidor entrega o 70×40 só para o app atualizado (o antigo não recebe)');
 // jogo: entra no mapa 70×40
 await A.click('#mapbtn');await W(2500);await A.evaluate(n=>[...document.querySelectorAll('#mmList button')].find(x=>x.textContent.toLowerCase().includes(n)).click(),'floresta larga');await W(2000);
 const g=await A.evaluate(()=>({cur:CURMAP,N,NH,gc:GC&&[GC.width,GC.height],M:Array.from(M).join(''),p:[p.x/32,p.y/32],sol:[sol(69*32+5,20*32),sol(66*32+5,20*32),sol(30*32,39*32+5),sol(30*32,36*32+5)]}));
 const cm=MR.compilar(novoApp.mapas[id],cat);
 ok(g.cur===id&&g.N===70&&g.NH===40,'jogo entrou no mapa 70×40');
 ok(g.M===cm.M,'colisão do jogo igual à do servidor no 70×40');
 ok(g.p[0]===30.5&&g.p[1]===20.5,'nasceu no ponto do editor (30.5, 20.5)');
 ok(g.sol[0]&&!g.sol[1]&&g.sol[2]&&!g.sol[3],'bordas direita e de baixo bloqueadas; dentro livre');
 await A.waitForFunction(()=>GC,null,{timeout:5000});const gc=await A.evaluate(()=>[GC.width,GC.height]);ok(gc[0]===2240&&gc[1]===1280,'chão do jogo desenhado em 2240×1280');
 // anda até a borda direita: para na borda
 await A.evaluate(()=>{p.x=66*32;p.y=20.5*32});await A.keyboard.down('ArrowRight');await W(1500);await A.keyboard.up('ArrowRight');
 const px=await A.evaluate(()=>p.x/32);ok(px>66.2&&px<68,'andar para a direita para na borda do mapa (x='+px.toFixed(2)+')');
 await A.screenshot({path:path.join(__dirname,'ed1_jogo.png')});
 // voltar a um mapa 50×50 do jogo continua normal
 await A.evaluate(()=>switchMap('konoha'));await W(800);const k=await A.evaluate(()=>({N,NH,gc:GC?[GC.width,GC.height]:null,cur:CURMAP}));
 await A.waitForFunction(()=>GC,null,{timeout:5000});const kg=await A.evaluate(()=>[GC.width,GC.height]);
 ok(k.N===50&&k.NH===50&&kg[0]===1600&&kg[1]===1600,'voltando para Konoha: 50×50 como antes');
 // gerenciador: duplicar, renomear, excluir; mapa do jogo só para ver
 await P.click('#voltar');await W(400);
 ok(await ev(()=>!document.querySelector('#inicio').hidden&&[...document.querySelectorAll('#lsSrv .item')].some(x=>x.textContent.includes('No jogo'))),'lista mostra o mapa no servidor (No jogo)');
 const item=t=>ev(t=>{const it=[...document.querySelectorAll('#lsLocal .item')].find(x=>x.textContent.includes(t));it.querySelector('button').click()},t);
 await item(id);await D('Duplicar');await P.fill('#dpId',id);await D('Duplicar');await W(150);ok(/já existe/.test(await ev(()=>document.querySelector('#dpErr').textContent)),'duplicar com identificador repetido é recusado');
 await P.fill('#dpId','copia_'+suf);await D('Duplicar');await P.waitForFunction(()=>EDITOR.m&&EDITOR.m.id.startsWith('copia_'),null,{timeout:5000});
 ok(await ev(()=>EDITOR.m.W===70&&!EDITOR.reg.servidor&&EDITOR.m.spawn.join()==='30.5,20.5'),'cópia criada (mesmo conteúdo, ainda não está no servidor)');
 await P.click('#voltar');await W(300);await item('copia_'+suf);await D('Renomear');await P.fill('#rnNome','Cópia Nova');await W(100);await P.fill('#rnId','copia2_'+suf);await D('Salvar');await W(400);
 const ids=await ev(async()=>(await Persist.listar()).map(r=>r.id));ok(ids.includes('copia2_'+suf)&&!ids.includes('copia_'+suf),'renomear troca nome e identificador do rascunho');
 await item('copia2_'+suf);await D('Excluir rascunho');await W(150);ok(/Excluir rascunho\?/.test(await ev(()=>document.querySelector('#dlgT').textContent)),'excluir pede confirmação');
 await D('Excluir');await W(400);ok(!(await ev(async()=>(await Persist.listar()).map(r=>r.id))).includes('copia2_'+suf),'rascunho excluído');
 await ev(t=>{const it=[...document.querySelectorAll('#lsSrv .item')].find(x=>x.textContent.includes(t));it.querySelector('button').click()},id);await D('Excluir do servidor');await P.fill('#cfId','errado');await D('Excluir');await W(300);
 ok(await aberto()&&(await mget('/__mapas'))[id],'excluir do servidor exige escrever o identificador');
 await D('Cancelar');await W(200);
 await ev(()=>{const it=[...document.querySelectorAll('#lsBase .item')][0];it.querySelector('button').click()});await D('Só ver');await W(500);
 ok(await ev(()=>EDITOR.m.id==='konoha'&&document.querySelector('#salvar').disabled&&document.querySelector('#publicar').disabled&&EDITOR.m.objetos.length>400),'mapa do jogo abre só para ver (Salvar/Publicar desligados)');
 await P.click('#voltar');await W(200);await P.click('#novo');await P.fill('#nvNome','x');await W(150);await P.fill('#nvId',id);await W(100);
 {const t=await ev(()=>document.querySelector('#nvErr').textContent+' | '+document.querySelector('#nvId').value+' | '+EDITOR.srv.map(r=>r.id));ok(/já existe/.test(t),'criar com identificador que já está no servidor é recusado '+t)}
 await D('Cancelar');
 ok(!erros.length,'editor sem erros de página');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
