// fluxo da tela de login nova: criar conta, nome repetido, senha curta, manter conectado, vila inicial
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:844,height:390}});
 const open=async()=>{const pg=await ctx.newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',e.message);fails++});await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await W(300);return pg};
 let pg=await open();const err=()=>pg.textContent('#err');const nome='Kaka'+suf;
 ok(await pg.isHidden('#fNew')&&await pg.isVisible('#fIn'),'abre na aba Entrar, criar conta escondido');
 ok(!(await pg.isVisible('#maps')),'sem escolha de vila no login');
 await pg.click('#tabNew');ok(await pg.isVisible('#nu')&&await pg.isVisible('#np')&&await pg.isVisible('#ne'),'Criar conta mostra usuário, senha e e-mail');
 await pg.fill('#nu',nome);await pg.fill('#np','1234567');await pg.fill('#ne','x@y.com');await pg.click('#goNew');await W(150);ok(/8 caracteres/.test(await err()),'senha com 7 caracteres recusada: '+await err());
 await pg.fill('#np','12345678');await pg.fill('#ne','semarroba');await pg.click('#goNew');await W(150);ok(/e-mail/.test(await err()),'e-mail inválido recusado');
 await pg.fill('#ne','kakashi@exemplo.com');await pg.click('#goNew');await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});ok(true,'conta criada → personalização');
 ok(await pg.evaluate(()=>CURMAP)==='vila_areia','personagem novo começa na Vila da Areia');
 await pg.click('.card');await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 ok(await pg.evaluate(()=>CURMAP)==='vila_areia','entrou no jogo na Vila da Areia');
 const sp=await pg.evaluate(()=>[p.x/32,p.y/32,SPAWN]);ok(Math.abs(sp[0]-sp[2][0])<1&&Math.abs(sp[1]-sp[2][1])<1,'nasceu no ponto de início '+JSON.stringify(sp));
 await pg.click('#mapbtn');await W(200);ok(await pg.isHidden('#mapmenu')&&/outras vilas/.test(await pg.textContent('#toast')),'jogador comum não troca de vila');
 const meta=await pg.evaluate(()=>onlFetch('/auth/v1/user'));
 ok(await pg.evaluate(()=>localStorage.getItem('shinobi-lembrar'))===null,'sem marcar: nada salvo');
 await pg.evaluate(()=>onlLogout());await W(1500);
 // nome repetido (mesmo com maiúsculas diferentes)
 await pg.click('#tabNew');await pg.fill('#nu',nome.toUpperCase());await pg.fill('#np','abcdefgh');await pg.fill('#ne','a@b.com');await pg.click('#goNew');await pg.waitForFunction(()=>/já existe/.test(document.querySelector('#err').textContent),null,{timeout:8000}).then(()=>ok(true,'nome já existente recusado: '+'"'+nome.toUpperCase()+'"'),()=>ok(false,'nome repetido: '+'?'));
 // entrar SEM manter conectado
 await pg.click('#tabIn');await pg.fill('#u',nome);await pg.fill('#p','12345678');await pg.click('#go1');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 ok(await pg.evaluate(()=>localStorage.getItem('shinobi-lembrar'))===null,'entrou sem marcar: nada salvo');
 await pg.evaluate(()=>{switchMap('konoha')});await W(500);await pg.evaluate(()=>onSave&&0).catch(()=>{});await pg.evaluate(()=>onlSave());
 await pg.evaluate(()=>onlLogout());await W(1500);
 ok((await pg.inputValue('#u'))===''&&(await pg.inputValue('#p'))==='','tela vazia na volta (não marcou)');
 // entrar COM manter conectado
 await pg.fill('#u',nome);await pg.fill('#p','12345678');await pg.check('#keep');await pg.click('#go1');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 ok(await pg.evaluate(()=>CURMAP)==='vila_areia','salvo em Konoha, mas volta na Vila da Areia');
 const sv=await pg.evaluate(()=>localStorage.getItem('shinobi-lembrar'));ok(!!sv&&!sv.includes('12345678'),'marcou: salvo (senha não fica em texto puro) '+sv);
 await pg.evaluate(()=>onlLogout());await W(1500);
 ok((await pg.inputValue('#u'))===nome&&(await pg.inputValue('#p'))==='12345678'&&await pg.isChecked('#keep'),'volta com usuário e senha preenchidos');
 await pg.uncheck('#keep');ok(await pg.evaluate(()=>localStorage.getItem('shinobi-lembrar'))===null,'desmarcar apaga o que estava salvo');
 await pg.screenshot({path:__dirname+'/t14.png'});
 console.log(meta&&meta.user_metadata?'metadata: '+JSON.stringify(meta.user_metadata):'metadata: '+JSON.stringify(meta));
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
