// proficiência de ponta a ponta: liberar pelos status, escolher, bônus, treino, rank, salvar, trocar
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
const file=process.argv[2]||'online.html',MOCK=process.argv[3]||'54333';let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const ctx=await b.newContext({viewport:{width:844,height:390}});
 const pg=await ctx.newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',e.message);fails++});
 const nome='Neji'+suf;await pg.goto('file://'+require('path').join(__dirname,'..','paginas',file));await pg.click('#tabNew');await pg.fill('#nu',nome);await pg.fill('#np','12345678');await pg.fill('#ne','n@n.com');await pg.click('#goNew');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card >> nth=1');await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 ok(await pg.evaluate(()=>clan)==='hyuga','personagem Hyuga');
 await pg.click('#hudFace');await pg.click('#pfMenu [data-pf=st]');await W(300);
 const st0=await pg.evaluate(()=>({btn:[...document.querySelectorAll('#stProf [data-prof]')].map(b=>[b.dataset.prof,b.disabled,b.textContent]),txt:document.querySelector('#stProf').textContent}));
 ok(st0.btn.length===4&&st0.btn.every(x=>x[1]),'4 especialidades, todas bloqueadas com status 0');
 ok(/Força 10/.test(st0.txt)&&/Inteligência 6/.test(st0.txt)&&/Destreza 10/.test(st0.txt),'mostra o que cada uma precisa');
 await pg.screenshot({path:__dirname+'/pf1.png'});
 await pg.evaluate(()=>{CH.st.str=10;stats()});await W(100);
 const st1=await pg.evaluate(()=>[...document.querySelectorAll('#stProf [data-prof]')].map(b=>[b.dataset.prof,b.disabled]));
 ok(st1.find(x=>x[0]==='taijutsu')[1]===false&&st1.filter(x=>x[1]).length===3,'Força 10 libera só o Taijutsu');
 await pg.click('#stProf [data-prof=taijutsu]');await W(100);
 ok(await pg.evaluate(()=>CH.prof.k==='taijutsu'&&CH.prof.xp===0&&profRank()===0),'escolheu Taijutsu, rank E');
 const card=await pg.textContent('#stProf');ok(/Palma, Kaiten, 64 Palmas/.test(card)&&/\+5% de dano/.test(card),'mostra golpes que treinam e o bônus do rank E');
 await pg.screenshot({path:__dirname+'/pf2.png'});
 await pg.click('#ivX');
 // recarga: Palma 0,8 s com −2%
 {const c=await pg.evaluate(()=>[CLANS.hyuga.sk[0].cd,cdOf(0,CLANS.hyuga.sk[0])]);ok(Math.abs(c[1]-c[0]*.98)<1e-6,'recarga da Palma '+c[0]+' → '+c[1]+' s (−2%)')}
 // dano + treino batendo num lobo
 await pg.evaluate(()=>{window._hits=[];const o=gsSend;gsSend=function(m){if(m.t==='hit')_hits.push(m.d);return o(m)}});
 const tryHit=async()=>{for(let k=0;k<12;k++){await pg.evaluate(()=>{const e=E.filter(e=>e.kind==='mob'&&!e.dead).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];p.x=e.x-28;p.y=e.y;p.hp=p.max;p.mp=p.mpMax;cd[0]=0;useBtn(0)});await W(260);if((await pg.evaluate(()=>_hits.length))>=3)break}};
 await tryHit();const H=await pg.evaluate(()=>({hits:_hits.slice(),xp:CH.prof.xp,exp:Math.round((16+D().pf)*1.05),base:Math.round(16+D().pf)}));
 ok(H.hits.length>=3,'acertou lobos '+H.hits.length+'x');ok(H.hits.every(d=>d===H.exp)&&H.exp>H.base,'dano com bônus: '+H.hits[0]+' (sem proficiência seria '+H.base+')');
 ok(H.xp===H.hits.length*2,'treino: +2 por acerto da Palma → '+H.xp);
 // subir de rank
 await pg.evaluate(()=>{CH.prof.xp=119;_hits=[]});await tryHit();
 const R=await pg.evaluate(()=>({r:profRank(),reg:ONL.reg.map(x=>x.t).join(' | '),cd:cdOf(0,CLANS.hyuga.sk[0])}));
 ok(R.r===1&&/Taijutsu subiu para o rank D/.test(R.reg),'sobe para o rank D e avisa no registro');ok(Math.abs(R.cd-(await pg.evaluate(()=>CLANS.hyuga.sk[0].cd))*.96)<1e-6,'rank D: recarga −4%');
 // salvar no banco
 await pg.evaluate(()=>onlSave());await W(400);
 const rows=await (await fetch('http://127.0.0.1:'+MOCK+'/__rows',{headers:{apikey:'x'}})).json();const row=Object.values(rows).find(r=>r.nome===nome);
 if(!file.includes('16b'))ok(row&&row.proficiencia==='taijutsu'&&row.prof_xp>=120,'gravado no banco: '+JSON.stringify(row&&{proficiencia:row.proficiencia,prof_xp:row.prof_xp}));
 else ok(row&&!('proficiencia' in row),'banco sem as colunas: o jogo salva o resto normalmente (nivel '+(row&&row.nivel)+')');
 const xpNow=await pg.evaluate(()=>CH.prof.xp);
 // sair e entrar de novo
 await pg.evaluate(()=>onlLogout());await W(1500);await pg.fill('#u',nome);await pg.fill('#p','12345678');await pg.click('#go1');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 ok(await pg.evaluate(x=>CH.prof.k==='taijutsu'&&CH.prof.xp===x,xpNow),'voltou com Taijutsu e o mesmo progresso ('+xpNow+')');
 // trocar especialidade (precisa confirmar e zera)
 await pg.evaluate(()=>{CH.st.int=10;stats()});await pg.click('#hudFace');await pg.click('#pfMenu [data-pf=st]');await W(200);await pg.click('#stProf [data-trocar]');await W(100);
 await pg.click('#stProf [data-prof=ninjutsu]');await W(100);ok(await pg.evaluate(()=>CH.prof.k==='taijutsu'),'1º toque em trocar só pede confirmação');
 ok(/Confirmar troca/.test(await pg.textContent('#stProf [data-prof=ninjutsu]')),'botão vira "Confirmar troca"');
 await pg.screenshot({path:__dirname+'/pf3.png'});
 await pg.click('#stProf [data-prof=ninjutsu]');await W(100);ok(await pg.evaluate(()=>CH.prof.k==='ninjutsu'&&CH.prof.xp===0),'trocou para Ninjutsu e zerou');
 ok(/Nenhum dos seus golpes atuais/.test(await pg.textContent('#stProf')),'avisa que nenhum golpe atual é de Ninjutsu');
 await pg.screenshot({path:__dirname+'/pf4.png'});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
