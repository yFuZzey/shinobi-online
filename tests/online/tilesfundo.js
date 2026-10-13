// Remoção de fundo por cor no importador de tilesets (Etapa A/B): fundo magenta sólido x transparência real.
// Confere: detecção, nada automático, tolerância, só o que toca as bordas, conta-gotas, voltar ao original, cópia com transparência no jogo e original intacto no Storage.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path'),fs=require('fs'),crypto=require('crypto'),LOG=path.join(__dirname,'..','servidor.log'),MOCK='http://127.0.0.1:54333',GS='http://127.0.0.1:8096';
const mget=p=>fetch(MOCK+p,{headers:{apikey:'x'}}).then(r=>r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const n0=fs.readFileSync(LOG,'utf8').length;
 const mk=async(n,clan)=>{const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',n,e.message);fails++});
  await pg.goto('file://'+path.join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu',n);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
  await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth='+clan);await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});return pg};
 const adm='Tf'+suf,A=await mk(adm,0);await mget('/__admin?nome='+adm);
 const P=await (await b.newContext({viewport:{width:412,height:860}})).newPage();P.on('pageerror',e=>{console.log('ERRO EDITOR',e.message);fails++});
 await P.goto(GS+'/painel/mapas');await P.waitForFunction(()=>typeof createMap==='function',null,{timeout:15000});await W(500);
 await P.click('#send');await P.fill('#pbU',adm);await P.fill('#pbP','12345678');await P.click('#pbIn');await W(1500);
 await P.evaluate(n=>{closeMenu();createMap(n,'folha')},'fundo_'+suf);
 const png=(w,h,fn)=>P.evaluate(([w,h,fn])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');(new Function('g',fn))(g);return c.toDataURL('image/png').split(',')[1]},[w,h,fn]).then(x=>Buffer.from(x,'base64'));
 // A) fundo magenta sólido: sprite vermelho com buraco magenta dentro, sprite rosa (hotpink) e um azul; 1 pixel de "quase magenta" colado no fundo
 const MG=await png(96,64,`g.fillStyle='rgb(255,0,255)';g.fillRect(0,0,96,64);g.fillStyle='rgb(220,30,30)';g.fillRect(4,4,24,24);g.fillStyle='rgb(255,0,255)';g.fillRect(14,14,4,4);
   g.fillStyle='rgb(255,105,180)';g.fillRect(40,10,16,16);g.fillStyle='rgb(0,0,220)';g.fillRect(70,40,16,16);g.fillStyle='rgb(250,5,250)';g.fillRect(90,5,1,1)`);
 // B) transparência real, com um detalhe magenta de verdade no meio do sprite
 const TR=await png(96,64,`g.fillStyle='rgb(0,160,0)';g.fillRect(8,8,40,40);g.fillStyle='rgb(255,0,255)';g.fillRect(20,20,16,16)`);
 await P.evaluate(()=>{tool='tile';ui()});
 const abre=async(buf,nome)=>{await P.click('#tsNew');await P.setInputFiles('#tsFile',{name:nome,mimeType:'image/png',buffer:buf});await P.waitForFunction(()=>TI&&TI.img&&TI.od,null,{timeout:8000})};
 const px=(x,y)=>P.evaluate(([x,y])=>{const d=TI.res?TI.res.data:TI.od.data,p=(y*TI.od.width+x)*4;return d[p+3]===0?'0,0,0,0':[...d.slice(p,p+4)].join()},[x,y]);
 const set=(id,v)=>P.evaluate(([id,v])=>{const e=document.querySelector(id);e.value=v;e.dispatchEvent(new Event('input'))},[id,v]);
 const proc=async()=>{await W(250)};
 await abre(MG,'sprites.png');
 const d1=await P.evaluate(()=>({solido:!!TI.solido,hex:TI.solido&&TI.solido.hex,rm:TI.rm,transp:TI.transp,info:document.querySelector('#tsFundoInfo').textContent,chk:document.querySelector('#tsRm').checked}));
 ok(d1.solido&&d1.hex==='#ff00ff'&&!d1.transp&&/magenta/i.test(d1.info),'fundo magenta sólido detectado ('+d1.hex+')');
 ok(!d1.rm&&!d1.chk,'a remoção não é aplicada sozinha');
 // salvar sem remover pede confirmação (a cor apareceria no jogo)
 await P.click('#tsSave');await W(300);
 ok(/fundo sólido/i.test(await P.evaluate(()=>document.querySelector('#tsSt').textContent))&&Object.keys(await mget('/__tilesets')).length===0,'salvar sem remover avisa e ainda não grava nada');
 // remover (borda, tolerância 24)
 await P.click('#tsRm');await proc();
 const r1=await P.evaluate(()=>({rm:TI.rm,n:TI.removed,key:TI.key.join(),mode:TI.mode,tol:TI.tol}));
 ok(r1.rm&&r1.key==='255,0,255'&&r1.mode==='borda','remoção marcada: cor magenta, só o que toca as bordas');
 ok(await px(0,0)==='0,0,0,0'&&await px(60,60)==='0,0,0,0','fundo ficou transparente na cópia');
 ok(await px(6,6)==='220,30,30,255'&&await px(41,11)==='255,105,180,255'&&await px(75,45)==='0,0,220,255','pixels dos sprites (vermelho, rosa, azul) intactos');
 ok(await px(15,15)==='255,0,255,255','magenta DENTRO do sprite (não toca a borda) foi preservado');
 ok(await px(90,5)==='0,0,0,0','pixel quase magenta (250,5,250) colado no fundo removido com tolerância 24');
 ok(r1.n===5056,'quantidade removida confere ('+r1.n+' px)');
 // tolerância 3: o pixel quase magenta fica
 await set('#tsTol',3);await proc();
 ok(await px(90,5)==='250,5,250,255'&&await px(0,0)==='0,0,0,0','tolerância baixa não remove cor parecida');
 await set('#tsTol',24);await proc();
 // toda a imagem: o buraco interno também sai
 await P.click('[data-tsm="tudo"]');await proc();
 ok(await px(15,15)==='0,0,0,0'&&await px(6,6)==='220,30,30,255','modo "toda a imagem" remove também o magenta interno (e só ele)');
 await P.click('[data-tsm="borda"]');await proc();
 // conta-gotas no sprite rosa: passa a usar a cor rosa
 await P.click('#tsDrop');
 const bb=await P.evaluate(()=>{const c=document.querySelector('#tsPv'),r=c.getBoundingClientRect(),z=c.width/TI.img.width;return[r.left+(41*z+z/2)*r.width/c.width,r.top+(11*z+z/2)*r.height/c.height]});await P.mouse.click(bb[0],bb[1]);await proc();
 ok(await P.evaluate(()=>TI.key.join())==='255,105,180','conta-gotas pegou a cor do pixel clicado (original)');
 await P.click('#tsMag');await proc();
 ok(await P.evaluate(()=>TI.key.join())==='255,0,255','botão Magenta volta à cor padrão');
 // voltar ao original
 await P.click('#tsRev');await proc();
 ok(await P.evaluate(()=>!TI.rm&&!TI.res&&!document.querySelector('#tsRm').checked)&&await px(0,0)==='255,0,255,255','"Voltar ao original" cancela a remoção');
 // aplicar e salvar
 await P.click('#tsRm');await proc();await P.click('#tsSave');await W(2200);
 const TS=await mget('/__tilesets'),ST=await mget('/__store'),r=Object.values(TS)[0],shaO=crypto.createHash('sha256').update(MG).digest('hex').slice(0,12);
 ok(r&&r.original==='originais/'+shaO+'.png'&&/^tilesets\/[a-f0-9]{12}\.png$/.test(r.arquivo)&&r.arquivo!==r.original.replace('originais','tilesets'),'gravou original e cópia separados ('+(r&&r.arquivo)+')');
 ok(ST[r.original]&&ST[r.original].n===MG.length,'o arquivo ORIGINAL foi guardado sem nenhuma alteração (mesmos bytes)');
 const baixa=await P.evaluate(async([a,b])=>{const ld=async u=>{const im=new Image();im.crossOrigin='anonymous';await new Promise(k=>{im.onload=k;im.src=u});const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return{w:im.width,h:im.height,p:(x,y)=>[...g.getImageData(x,y,1,1).data].join()}};
   const o=await ld(a),c=await ld(b);return{ow:o.w,oh:o.h,o00:o.p(0,0),cw:c.w,ch:c.h,c00:c.p(0,0),cred:c.p(6,6),chole:c.p(15,15),cpink:c.p(41,11)}},[MOCK+'/storage/v1/object/public/mapa-recursos/'+r.original,MOCK+'/storage/v1/object/public/mapa-recursos/'+r.arquivo]);
 ok(baixa.ow===96&&baixa.oh===64&&baixa.o00==='255,0,255,255','original continua 96×64 com o magenta ('+baixa.o00+')');
 ok(baixa.cw===96&&baixa.ch===64&&baixa.c00==='0,0,0,0'&&baixa.cred==='220,30,30,255'&&baixa.chole==='255,0,255,255'&&baixa.cpink==='255,105,180,255','cópia do jogo: mesma resolução, fundo transparente, sprites intactos');
 // o jogo usa a cópia: o servidor entrega o endereço de "arquivo", não do original
 // B) transparência real
 await abre(TR,'real.png');
 const d2=await P.evaluate(()=>({transp:TI.transp,solido:!!TI.solido,rm:TI.rm,info:document.querySelector('#tsFundoInfo').textContent}));
 ok(d2.transp&&!d2.solido&&!d2.rm&&/Transparência real/.test(d2.info),'transparência real detectada; nada removido automaticamente');
 await P.click('#tsRm');await proc();
 const r2=await P.evaluate(()=>({n:TI.removed,p:[...TI.res.data.slice((28*96+28)*4,(28*96+28)*4+4)].join()}));
 ok(r2.n===0&&r2.p==='255,0,255,255','mesmo ligando a ferramenta, o magenta do sprite (longe da borda) não é apagado');
 await P.click('#tsRev');await proc();
 await P.click('#tsSave');await W(2200);
 const TS2=Object.values(await mget('/__tilesets')),r3=TS2.find(x=>x.id!==r.id),shaT=crypto.createHash('sha256').update(TR).digest('hex').slice(0,12),ST2=await mget('/__store');
 ok(r3&&!r3.original&&r3.arquivo==='tilesets/'+shaT+'.png'&&ST2[r3.arquivo].n===TR.length,'imagem com transparência real: salva como está (mesmo arquivo, sem cópia nem original à parte)');
 // banco recusa (conta deixou de ser admin): o editor diz qual é o problema em vez de só "só admin pode publicar"
 await mget('/__admin?off=1&nome='+adm); await P.click('#send');await W(1500);
 const dg=await P.evaluate(()=>document.querySelector('#sendSt').textContent);
 ok(/só admin pode publicar/.test(dg)&&/NÃO reconhece esta conta como admin/.test(dg),'publicar recusado: o editor diagnostica (eh_admin = false) e indica o SQL');
 const lg=fs.readFileSync(LOG,'utf8').slice(n0);ok(!/erro ignorado|AVISO balanceamento|inválido ignorado/.test(lg),'servidor sem erros');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
