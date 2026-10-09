// regras novas: vantagens/desvantagens, aba Personagem e mochila
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',e.message);fails++});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu','Ita'+suf);await pg.fill('#np','12345678');await pg.fill('#ne','i@i.com');await pg.click('#goNew');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:20000});await pg.click('.card');await pg.click('#go2');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});
 const before=await pg.evaluate(()=>{CH.st.str=10;CH.st.int=10;stats();return{mp:p.mpMax,spd:D().spd,dmg:D().pf,cdS:cdOf(0,CLANS.uchiha.sk[0]),mpS:mpOf(0,CLANS.uchiha.sk[0])}});
 await pg.evaluate(()=>{toggleBag(true,'st')});await W(200);await pg.click('#stProf [data-prof=taijutsu]');await W(150);
 const tai=await pg.evaluate(()=>({mp:p.mpMax,spd:D().spd,dmg:D().pf,int:effSt(1).int,str:effSt(1).str,cdS:cdOf(0,CLANS.uchiha.sk[0]),mul:profTypeMul('ninjutsu'),mpr:D().mpr}));
 ok(tai.str===11.5&&tai.int===8,'Taijutsu: Força 10 → 11,5 (+15%) e Inteligência 10 → 8 (−20%)');
 ok(tai.mp===Math.round((100+8*6)*.8)&&tai.mp<before.mp,'chakra máximo cai 20%: '+before.mp+' → '+tai.mp);
 ok(Math.abs(tai.spd-(before.spd+6))<.01,'velocidade +6');ok(tai.dmg>before.dmg,'poder físico sobe com a Força ('+before.dmg+' → '+tai.dmg+')');
 ok(Math.abs(tai.cdS-before.cdS*1.25)<1e-6&&tai.mul===.85,'Bola de Fogo (Ninjutsu) fica com +25% de recarga e −15% de dano');
 ok(Math.abs(tai.mpr-((100+8*2)*.85-100))<.01,'regeneração de chakra: (100 + 8×2) × (1 − 15%)');
 // vantagens crescem com o rank, desvantagens não
 const rS=await pg.evaluate(()=>{CH.prof.xp=7000;stats();return{str:effSt(1).str,int:effSt(1).int,spd:D().spd}});
 ok(rS.str===13&&rS.int===8,'rank S: Força +30% (13) e Inteligência continua −20% (8)');
 // dano da Bola de Fogo com penalidade vai para o servidor (janela fechada: o jogo fica pausado com ela aberta)
 await pg.evaluate(()=>{toggleBag(false);CH.prof.xp=0;stats();window._hits=[];const o=gsSend;gsSend=function(m){if(m.t==='hit')_hits.push(m.d);return o(m)}});
 for(let k=0;k<12;k++){await pg.evaluate(()=>{const e=E.filter(e=>e.kind==='mob'&&!e.dead).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];p.x=e.x-40;p.y=e.y;p.hp=p.max;p.mp=p.mpMax;cd[0]=0;useBtn(0)});await W(250);if((await pg.evaluate(()=>_hits.length))>=1)break}
 const sh=await pg.evaluate(()=>({h:_hits.slice(),exp:Math.round((CLANS.uchiha.sk[0].dmg+D().pc)*.85),xp:CH.prof.xp}));
 ok(sh.h.length&&sh.h[0]===sh.exp,'Bola de Fogo com penalidade: '+sh.h[0]+' (esperado '+sh.exp+') e não treina Taijutsu (xp '+sh.xp+')');ok(sh.xp===0,'golpe de outro tipo não dá treino');
 // aba Personagem
 await pg.evaluate(()=>toggleBag(true,'ch'));await W(200);const ch=await pg.textContent('#paneCh');
 ok(/Força/.test(ch)&&/\+15%/.test(ch)&&/−20%/.test(ch)&&/11,5/.test(ch),'Personagem mostra Força +15% → 11,5 e Inteligência −20%');
 ok(/Dos status/.test(ch)&&/\+ Fixos/.test(ch)&&/% total/.test(ch)&&/Chakra máximo/.test(ch),'tabela de atributos: dos status / + fixos / % total / final');
 ok(/Bola de Fogo/.test(ch)&&/penalidade/.test(ch),'golpes mostram a penalidade da Bola de Fogo');
 const portrait=await pg.evaluate(()=>{const c=$('#chCv'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n});ok(portrait>2000,'retrato desenhado ('+portrait+' pixels)');
 // mochila: equipar sem fechar, organizar
 await pg.evaluate(()=>{giveItems(['manto','chidori']);$('#drop').hidden=true;toggleBag(true,'bag')});await W(200);
 ok(await pg.evaluate(()=>document.querySelectorAll('#ivGrid .sl').length)===20,'mochila com 20 espaços');
 await pg.evaluate(()=>{invSel='chidori';bagRefresh()});await pg.click('#ivAct');await W(200);
 ok(await pg.evaluate(()=>EQ.mao==='chidori'&&!$('#inv').hidden&&$('#ivAct').textContent==='Desequipar'),'equipar mantém a mochila aberta');
 ok(/\+10% de velocidade/.test(await pg.textContent('#eqSum')),'resumo dos bônus dos equipamentos');
 await pg.click('#ivAct');await W(150);ok(await pg.evaluate(()=>!EQ.mao&&INV.includes('chidori')),'desequipar volta para a mochila');
 await pg.evaluate(()=>{INV=['chidori','manto'];bagRefresh()});await pg.click('#bagSort');ok(await pg.evaluate(()=>INV[0]==='manto'),'organizar põe o lendário primeiro');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
