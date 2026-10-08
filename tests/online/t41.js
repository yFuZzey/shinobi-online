// Painel de itens (/painel no servidor): admin entra, cria item do zero (ícone, nome, nível, raridade, parte do corpo, tipo, atributos
// com valor automático), salva rascunho (só admin vê), publica; o servidor relê os itens; o jogo carrega os publicados, exige o nível
// para equipar e aplica os atributos; quem não é admin não grava; item desconhecido na mochila não some
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
const darItens=(uid,it)=>fetch(MOCK+'/rest/v1/rpc/dar_itens',{method:'POST',headers:{apikey:'svc-test','Content-Type':'application/json'},body:JSON.stringify({p_personagem:uid,p_itens:it})});
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth='+clan);await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const adm='Adm'+suf,J=await mk('Jog'+suf,1);await mk(adm,0);await mget('/__admin?nome='+adm);
 // ---- painel ----
 const P=await (await b.newContext({viewport:{width:412,height:860}})).newPage();P.on('pageerror',e=>{console.log('ERRO PAINEL',e.message);fails++});
 await P.goto(GS+'/painel');await P.fill('#u','Jog'+suf);await P.fill('#p','12345678');await P.click('#entrar');await W(500);
 ok(/não é admin/.test(await P.textContent('#lErr')),'conta que não é admin não entra no painel');
 await P.fill('#u',adm);await P.fill('#p','12345678');await P.click('#entrar');await P.waitForSelector('#vApp:not(.hide)',{timeout:8000});
 ok(/Nenhum item/.test(await P.textContent('#lista')),'admin entra e vê a lista vazia');
 await P.click('#novo');await P.fill('#nome','Espada do Zabuza');await P.fill('#desc','A espada que se regenera.\nPassiva: Drenar cura 5%');
 await P.evaluate(()=>{const d=document.querySelector('#desc');d.setSelectionRange(26,41)});await P.click('#cores [data-cor=vermelho]');
 ok(await P.inputValue('#desc')==='A espada que se regenera.\n(vermelho)Passiva: Drenar(vermelho) cura 5%'&&/<br>/.test(await P.innerHTML('#prev'))&&/color:#c0301a/.test(await P.innerHTML('#prev')),'descrição: botão de cor envolve o texto escolhido e a prévia mostra cor e quebra de linha');
 await P.click('#salvar');await W(200);
 ok(/envie o ícone/.test(await P.textContent('#eErr'))&&/pelo menos 1 atributo/.test(await P.textContent('#eErr')),'sem ícone e sem atributo não grava e explica');
 await P.setInputFiles('#icone',path.join(__dirname,'..','..','arte','ui','icone_app.png'));await W(500);
 ok(await P.evaluate(()=>ED.icone.startsWith('data:image/')&&(()=>{const i=new Image();i.src=ED.icone;return true})()),'ícone enviado e reduzido');
 await P.fill('#nivelN','10');await P.dispatchEvent('#nivelN','change');await P.click('#rar [data-k=epico]');await P.click('#slot [data-k=arma]');
 for(const k of ['str','dmg_pct','speed_pct'])await P.click('#atr [data-k='+k+']');
 ok(await P.evaluate(()=>document.querySelector('#atr [data-k=vit]').disabled),'épico: no máximo 3 atributos (o 4º fica travado)');
 const pv=await P.textContent('#prev');ok(/\+7 de força/.test(pv)&&/\+5% de poder/.test(pv)&&/precisa do Nv 10/.test(pv),'prévia com os valores automáticos ('+pv.replace(/\s+/g,' ').slice(0,140)+')');
 await P.click('#salvar');await W(600);let I=await mget('/__itens');const z=I.p_espada_do_zabuza;
 ok(z&&z.publicado===false&&z.nivel===10&&z.raridade==='epico'&&z.slot==='arma'&&z.atributos.join()==='str,dmg_pct,speed_pct'&&/Rascunho/.test(await P.textContent('#eMsg')),'rascunho gravado no banco');
 ok(await J.evaluate(async()=>{await itensLoad();return !ITEMS.p_espada_do_zabuza}),'rascunho não aparece para os jogadores');
 // publicar
 await P.click('#publicar');await W(2200);I=await mget('/__itens');
 const h=await (await fetch(GS+'/health')).json();ok(I.p_espada_do_zabuza.publicado===true&&h.itensPainel===1,'publicado: o servidor relê e já conhece o item (itensPainel '+h.itensPainel+')');
 // item com habilidade que já existe e item com habilidade nova
 await P.click('#novo');await P.fill('#nome','Lâmina Raio');await P.setInputFiles('#icone',path.join(__dirname,'..','..','arte','ui','icone_app.png'));await W(400);
 await P.click('#rar [data-k=lendario]');await P.click('#slot [data-k=mao]');await P.click('#tipo [data-k=habilidade]');await P.click('#atr [data-k=agi]');await P.click('#publicar');await W(900);
 await P.click('#novo');await P.fill('#nome','Kubikiribōchō');await P.setInputFiles('#icone',path.join(__dirname,'..','..','arte','ui','icone_app.png'));await W(400);
 await P.click('#tipo [data-k=nova]');await P.click('#atr [data-k=str]');await P.click('#publicar');await W(300);
 ok(/descreva a habilidade nova/.test(await P.textContent('#eErr')),'habilidade nova pede a descrição para o Claude');
 await P.fill('#pedido','Corta em linha reta 4 tiles à frente');await P.click('#publicar');await W(900);I=await mget('/__itens');
 ok(I.p_lamina_raio&&I.p_lamina_raio.tipo==='habilidade'&&I.p_lamina_raio.habilidade==='raio'&&I.p_kubikiribocho&&I.p_kubikiribocho.tipo==='nova'&&/4 tiles/.test(I.p_kubikiribocho.pedido),'itens com habilidade existente e com habilidade nova gravados (códigos p_lamina_raio e p_kubikiribocho)');
 // quem não é admin não grava direto no banco
 const neg=await J.evaluate(async()=>{try{await onlFetch('/rest/v1/itens',{method:'POST',body:JSON.stringify({id:'p_hack',nome:'Hack',icone:'data:image/png;base64,AA',raridade:'lendario',slot:'arma',atributos:['str']})});return 'gravou'}catch(e){return e.status}});
 ok(neg===403,'jogador comum não consegue criar item pelo banco ('+neg+')');
 // ---- jogo: o jogador recebe os itens ----
 const uid=await J.evaluate(()=>ONL.uid);await darItens(uid,['p_espada_do_zabuza','p_lamina_raio','p_kubikiribocho','p_fantasma']);
 const r=await J.evaluate(async()=>{await invReload();const z=ITEMS.p_espada_do_zabuza,l=ITEMS.p_lamina_raio,k=ITEMS.p_kubikiribocho;
  return{has:['p_espada_do_zabuza','p_lamina_raio','p_kubikiribocho'].every(i=>INV.includes(i)),st:z&&z.stats,nv:z&&z.nivel,atk:l&&l.atk,fx:l&&l.fx,ag:k&&k.aguardando,desc:k&&k.desc,unk:(ONL.unk||[]).map(x=>x.item),inv:onlInv().map(x=>x.item)}});
 ok(r.has&&r.st&&r.st.str===7&&r.st.dmg_pct===5&&r.st.speed_pct===8&&r.nv===10,'o jogo carrega os itens publicados com os atributos calculados '+JSON.stringify(r.st));
 ok(r.atk&&r.atk.kind==='raio'&&r.atk.dmg===19&&r.fx&&r.fx.hand,'item com a investida de raio: dano 19 (lendário Nv 1) e efeito na mão');
 ok(r.ag===1&&/Habilidade em preparo/.test(r.desc),'item com habilidade nova: funciona só com atributos e avisa que a habilidade está em preparo');
 ok(r.unk.includes('p_fantasma')&&r.inv.includes('p_fantasma'),'item desconhecido continua guardado (não some da mochila no banco)');
 const e1=await J.evaluate(()=>{const s0=D().pf;equipItem('p_espada_do_zabuza');return{eq:EQ.arma,toast:$('#toast').textContent,s0}});
 ok(!e1.eq&&/precisa do Nv 10/.test(e1.toast),'Nv 1 não equipa item de Nv 10 e explica');
 const e2=await J.evaluate(()=>{let g=0;while(CH.lv<10&&g++<50)gainXp(xpNeed(CH.lv)-CH.xp);stats();const a=calcChar(1,1).at.pf.fin;equipItem('p_espada_do_zabuza');stats();return{eq:EQ.arma,a,b:calcChar(1,1).at.pf.fin}});
 ok(e2.eq==='p_espada_do_zabuza'&&e2.b>e2.a,'Nv 10 equipa e a Força do item entra no poder físico ('+e2.a+' → '+e2.b+')');
 await J.evaluate(()=>{toggleBag(true,'bag');invSel='p_espada_do_zabuza';bagRefresh()});await W(200);
 ok(await J.evaluate(()=>{const h=$('#ivDet .dd').innerHTML;return /<br>/.test(h)&&/color:#c0301a/.test(h)&&/Passiva: Drenar/.test(h)}),'no jogo a descrição mostra a cor e a quebra de linha');await J.screenshot({path:path.join(__dirname,'painel_jogo.png')});
 // tirar do jogo
 await P.click('#lista [data-id=p_lamina_raio]');await W(200);P.once('dialog',d=>d.accept());await P.click('#despub');await W(2200);
 ok((await (await fetch(GS+'/health')).json()).itensPainel===2,'tirar do jogo: o servidor para de usar o item');
 await P.screenshot({path:path.join(__dirname,'painel.png'),fullPage:true});
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
