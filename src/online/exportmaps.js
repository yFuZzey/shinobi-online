const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});const pg=await b.newPage();
 await pg.goto('file://'+process.cwd()+'/gerado/base.html');await pg.waitForTimeout(300);
 const out=await pg.evaluate(()=>{const o={};const cur=CURMAP;for(const k of Object.keys(MAPS)){applyMap(MAPS[k]);o[k]={N,T,spawn:SPAWN,boss:BOSSP,areas:MAPS[k].areas||[],M:Array.from(M).join('')}}applyMap(MAPS[cur]);return o});
 fs.writeFileSync(process.argv[2],JSON.stringify(out));
 // o servidor refaz a colisão dos mapas publicados no painel com as mesmas regras: tamanho no chão (FPT) e objetos que existem (TSZ)
 fs.writeFileSync(require('path').join(require('path').dirname(process.argv[2]),'mapa_objetos.json'),JSON.stringify(await pg.evaluate(()=>({fpt:FPT,tsz:Object.keys(TSZ)}))));console.log(Object.keys(out),Object.values(out).map(m=>[m.boss,m.M.length,(m.M.match(/[12]/g)||[]).length]));await b.close()})();
