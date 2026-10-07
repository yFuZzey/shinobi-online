// esquiva x precisão, nível dos monstros, raposa chefe, ranks dos golpes
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));const suf=String(Date.now()%100000);
let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await (await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:2})).newPage();pg.on('pageerror',e=>{console.log('ERRO PÁGINA',e.message);fails++});
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','online.html'));await pg.click('#tabNew');await pg.fill('#nu','Esq'+suf);await pg.fill('#np','12345678');await pg.fill('#ne','e@e.com');await pg.click('#goNew');
 await pg.waitForFunction(()=>cur==='cust',null,{timeout:20000});await pg.click('#go2');await pg.click('.card');await pg.waitForFunction(()=>ONL.joined,null,{timeout:20000});await W(800);
 const m0=await pg.evaluate(()=>{const fox=E.find(e=>e.boss),w=E.find(e=>e.t==='lobo_cinzento');return{fox:fox&&[fox.lv,fox.max,mobName(fox),lvColor(fox,'x')],wolf:w&&[w.lv,mobName(w),lvColor(w,'x')],sk:CLANS.uchiha.sk.map(s=>[s.n,s.rk,s.dmg,s.mp,s.cd])}});
 ok(m0.fox&&m0.fox[0]===90&&m0.fox[1]===120000&&/☠/.test(m0.fox[2])&&m0.fox[3]==='#ff5a4a','Raposa: Nv 90, 120.000 de vida, nome vermelho com caveira ('+(m0.fox&&m0.fox[2])+')');
 ok(m0.wolf&&m0.wolf[0]===3&&/Nv 3/.test(m0.wolf[1]),'Lobo: Nv 3 no nome ('+(m0.wolf&&m0.wolf[1])+')');
 ok(JSON.stringify(m0.sk)===JSON.stringify([['Bola de Fogo','D',16,5,1.1],['Sharingan','B',0,10,20],['Susanoo','S',40,40,90]]),'golpes Uchiha pelo rank: '+JSON.stringify(m0.sk));
 // esquiva do jogador (sorteio local contra a precisão que vem do servidor)
 const dj=await pg.evaluate(()=>{const r={};const run=(agi)=>{CH.st.agi=agi;stats();p.max=1e9;p.hp=1e9;let n=0;const N=600;for(let i=0;i<N;i++){const f0=FT.length;HPREC=8;hurt(10);HPREC=0;if(FT.length>f0&&FT[FT.length-1].t==='esquivou')n++}FT.length=0;return{esq:D().esq,ch:dodgeChance(8),taxa:n/N,max:BAL.combate.esquivaMax}};r.a0=run(0);r.a60=run(60);CH.st.agi=0;stats();p.hp=p.max;return r});
 ok(dj.a0.ch===0&&dj.a0.taxa===0,'AGI 0 (Esquiva '+dj.a0.esq+') contra Lobo (Precisão 8): 0% de esquiva');
 const esp=Math.min(dj.a60.max,58);ok(Math.abs(dj.a60.ch-esp)<.01&&Math.abs(dj.a60.taxa-esp/100)<.07,'AGI 60 → Velocidade 160% → Esquiva '+dj.a60.esq+': 5 + 61 − 8 = 58%, teto '+dj.a60.max+'% → chance '+esp+'%, sorteado '+Math.round(dj.a60.taxa*100)+'%');
 // monstro esquiva (servidor decide): Precisão 1 contra Esquiva 12 do lobo = 16%
 await pg.evaluate(()=>{window._mh=[];window._ft=[];window._sent=0;const o=gsMsg;gsMsg=function(m){if(m.t==='mh'&&m.by===ONL.uid)_mh.push(m);const r=o(m);if(m.t==='mh'&&m.miss&&FT.length)_ft.push(FT[FT.length-1].t);return r};const os=gsSend;gsSend=function(m){if(m.t==='hit')_sent++;return os(m)}});
 const hitMany=async(n)=>{for(let k=0;k<n;k++){await pg.evaluate(()=>{let e=E.find(x=>x.sid===window._tg&&!x.dead&&x.hp>3);if(!e){e=E.filter(e=>e.t==='lobo_cinzento'&&!e.dead&&e.hp>3)[0];window._tg=e&&e.sid}if(!e)return;p.x=e.x-60;p.y=e.y;p.hp=p.max;p.mp=p.mpMax;gsHit(e,1,0,0,0)});await W(90)}await W(800)};
 await hitMany(80);let mh=await pg.evaluate(()=>_mh.splice(0));const miss=mh.filter(m=>m.miss).length;
 ok(mh.length>=60&&miss/mh.length>.04&&miss/mh.length<.32,'Precisão 1 contra Esquiva 12: lobo esquivou '+miss+' de '+mh.length+' (esperado ~16%)');
 const ft=await pg.evaluate(()=>_ft.includes('esquivou'));ok(ft,'aparece "esquivou" em cima do lobo');
 await pg.evaluate(()=>{CH.st.dex=30;stats()});await hitMany(40);mh=await pg.evaluate(()=>_mh.splice(0));console.log('  enviados',await pg.evaluate(()=>_sent));
 ok(mh.length>=20&&mh.every(m=>!m.miss),'Destreza 30 (Precisão '+(await pg.evaluate(()=>D().prec))+'): nenhum erro em '+mh.length+' golpes');
 // aba Personagem
 await pg.evaluate(()=>toggleBag(true,'ch'));await W(300);const ch=await pg.textContent('#paneCh');
 ok(/Precisão/.test(ch)&&/Esquiva/.test(ch)&&/rank S/.test(ch)&&/5% \+ sua Esquiva/.test(ch),'aba Personagem: Esquiva, Precisão, regra da chance e rank dos golpes');
 await pg.evaluate(()=>{const t=[...document.querySelectorAll('#paneCh .ivt')][2];t&&t.scrollIntoView()});await W(100);await pg.screenshot({path:__dirname+'/e1.png'});
 await pg.evaluate(()=>{toggleBag(false);const f=E.find(e=>e.boss);p.x=f.x-150;p.y=f.y});await W(1200);await pg.screenshot({path:__dirname+'/e2.png'});
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
