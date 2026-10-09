// T-03 (adaptado ao jogo): o multiplicador da especialidade no dano fica entre 0,70 e 1,30 em qualquer caso
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Prof');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='clan');await pg.click('.card >> nth=0');await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready);
 const r=await pg.evaluate(()=>{const o={};CH.prof={k:null,xp:0};o.sem=profTypeMul('ninjutsu');
  CH.st.int=20;CH.prof={k:'ninjutsu',xp:0};o.E=profTypeMul('ninjutsu');CH.prof.xp=1e6;o.S=profTypeMul('ninjutsu');o.outro=profTypeMul('taijutsu');
  // penalidade exagerada (teste): não passa de 0,70
  const old=PROF.ninjutsu.oth.taijutsu.dmg;PROF.ninjutsu.oth.taijutsu.dmg=-80;o.piso=profTypeMul('taijutsu');PROF.ninjutsu.oth.taijutsu.dmg=old;
  const oldS=PRK[5][2];PRK[5][2]=90;o.teto=profTypeMul('ninjutsu');PRK[5][2]=oldS;o.min=BAL.proficiencia.multMin;o.max=BAL.proficiencia.multMax;return o});
 ok(r.sem===1,'sem especialidade: ×1,00');
 ok(Math.abs(r.E-1.05)<1e-9&&Math.abs(r.S-1.30)<1e-9,'especialidade rank E ×'+r.E+' → rank S ×'+r.S+' (máx. da planilha 1,30)');
 ok(Math.abs(r.outro-.85)<1e-9,'golpe de outro tipo com penalidade: ×'+r.outro);
 ok(r.piso===r.min&&r.teto===r.max,'nunca sai de '+r.min+'–'+r.max+' (testado com valores exagerados: '+r.piso+' e '+r.teto+')');
 ok(!errs.length,'sem erros');console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
