// item que saiu do jogo (ex.: os Susanoo de teste) continuando no banco: a mochila abre sem erro e o resto funciona
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const MOCK='http://127.0.0.1:54333';const svc=(fn,body)=>fetch(MOCK+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:'svc-test','Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.status===204?null:r.json());
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const errs=[];
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{errs.push(e.message);console.log('ERRO PÁGINA',e.message)});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu','Velho'+suf);await pg.fill('#np','12345678');await pg.fill('#ne','t@t.com');await pg.click('#goNew');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card >> nth=0');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 const id=await pg.evaluate(()=>ONL.uid);
 await svc('dar_itens',{p_personagem:id,p_itens:['susanoo_itachi','susanoo_madara','chidori']});await pg.evaluate(()=>invReload());await W(800);
 await pg.evaluate(()=>toggleBag(true,'bag'));await W(400);
 const r=await pg.evaluate(()=>({inv:INV.slice(),cells:document.querySelectorAll('#paneBag .cell, #paneBag [data-i]').length,txt:$('#paneBag').textContent}));
 ok(r.inv.includes('chidori'),'o Chidori chega na mochila mesmo com itens antigos junto');
 ok(!errs.length,'a mochila abre sem erro com itens que não existem mais ('+r.inv.join(', ')+')');
 await pg.evaluate(()=>{equipItem('chidori');toggleBag(false)});await W(300);
 ok(await pg.evaluate(()=>/Chidori/.test($('#b3').textContent)),'o Chidori equipa normalmente');
 await pg.evaluate(()=>{toggleBag(true,'ju')});await W(300);ok(!errs.length&&await pg.evaluate(()=>!$('#paneJu').hidden),'aba Jutsus abre');
 await pg.screenshot({path:__dirname+'/item_velho.png'});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
