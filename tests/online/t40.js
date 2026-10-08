// Porteiro de versão: ao abrir o jogo (APK), Entrar/Criar conta ficam travados até confirmar que a versão é a mais nova.
// "Verificando atualização…" → se tiver versão nova: "Jogo atualizando… N%" → reinicia sozinho; só libera o botão quando está atualizado.
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();
 pg.on('pageerror',e=>{console.log('ERRO PÁGINA',e.message);fails++});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.waitForSelector('#go1');await W(500);
 ok(await pg.evaluate(()=>!OTA.app&&!OTA.gate&&!$('#go1').disabled),'no navegador/teste (fora do APK) o botão Entrar não é travado');
 // finge que é o APK na versão 100, com um GitHub de mentira
 const prep=(cfg)=>pg.evaluate(async cfg=>{OTA.app=true;OTA.v=100;OTA.ready=0;OTA.busy=0;OTA.gate=0;OTA.loader=1;window._rl=0;otaReload=()=>{window._rl++};
  window._log=[];const er=$('#err');new MutationObserver(()=>_log.push(er.textContent)).observe(er,{childList:true,characterData:true,subtree:true});
  const html="<html>x '200000000001'||0,base: y</html>";const sha=await otaSha(html);
  window.fetch=async(u,o)=>{u=String(u);if(cfg.net)throw new TypeError('sem rede');
   if(u===OTA.api)return new Response('a'.repeat(40));
   if(/version\.json/.test(u))return new Response(JSON.stringify({v:cfg.v,sha256:sha,size:new TextEncoder().encode(html).length,loader:cfg.loader||1}));
   if(/game\.html/.test(u)){await new Promise(r=>setTimeout(r,150));return new Response(html)}return new Response('',{status:404})};
  window._r=otaGate();},cfg);
 const st=()=>pg.evaluate(()=>({go:$('#go1').disabled,nw:$('#goNew').disabled,t:$('#err').textContent,rl:_rl,gate:OTA.gate,retry:!!$('#otaretry')&&!$('#otaretry').hidden,log:_log.slice()}));
 // 1) já está na versão mais nova: libera
 await prep({v:100});await W(700);let s=await st();
 ok(s.log[0]&&/Verificando atualização/.test(s.log[0])&&!s.go&&!s.nw&&s.t===''&&s.gate===0&&s.rl===0,'versão igual: mostra "Verificando atualização…" e depois libera Entrar e Criar conta ('+JSON.stringify(s.log)+')');
 // 2) sem internet: continua travado, avisa e oferece tentar de novo; Entrar não faz nada
 await prep({net:1,v:100});await W(700);s=await st();
 ok(s.go&&s.nw&&/Não consegui verificar/.test(s.t)&&s.retry,'sem internet: Entrar e Criar conta ficam travados e aparece "Tentar de novo"');
 await pg.evaluate(()=>{$('#u').value='abc';$('#p').value='12345678';onlEnter()});await W(200);s=await st();
 ok(/Não consegui verificar/.test(s.t)&&!(await pg.evaluate(()=>ONL.on)),'tentar entrar mesmo assim não faz nada');
 // 3) voltou a internet e tem versão nova: baixa com porcentagem, guarda, reinicia; botão continua travado
 await pg.evaluate(()=>{clearTimeout(otaRetryTk)});
 await prep({v:200000000001});await W(1200);s=await st();
 ok(/Verificando atualização/.test(s.log[0])&&s.log.some(x=>/Jogo atualizando… \d+%/.test(x)),'versão nova: mostra "Verificando atualização…" e depois "Jogo atualizando… N%" ('+s.log.join(' | ')+')');
 ok(s.go&&s.nw&&s.rl===1&&/Reiniciando/.test(s.t),'depois de baixar reinicia sozinho (1 vez) e os botões continuam travados até a versão nova abrir');
 ok(await pg.evaluate(async()=>{const db=await otaDb();return new Promise(r=>{const q=db.transaction('f').objectStore('f').get('game');q.onsuccess=()=>r(!!q.result&&q.result.v===200000000001&&q.result.html.length>10)})}),'a versão nova ficou guardada para o carregador abrir');
 // 4) versão marcada como ruim (não abriu 2 vezes): não prende o jogador num ciclo
 await pg.evaluate(()=>{localStorage.setItem('so-ota-bad','200000000001')});
 await prep({v:200000000001});await W(700);s=await st();ok(!s.go&&s.rl===0&&s.t==='','versão que não abre no aparelho (marcada como ruim) não prende em loop: libera');
 await pg.evaluate(()=>{localStorage.removeItem('so-ota-bad')});
 // 5) versão que exige APK novo: não dá para atualizar sozinho, continua travado e explica
 await prep({v:200000000001,loader:2});await W(700);s=await st();ok(s.go&&s.nw&&/versão mais nova/.test(s.t)&&!s.retry,'versão que precisa do APK novo: continua travado e explica onde baixar');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
