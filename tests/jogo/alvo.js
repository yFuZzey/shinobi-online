// Alvo selecionado: tocar no monstro mostra o painel (foto, nome, nível, vida) e os golpes miram nele em vez do mais próximo; tocar no vazio solta
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
const path=require('path');
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg.on('pageerror',e=>{console.log('ERRO',e.message);fails++});
 await pg.goto('file://'+path.join(__dirname,'..','paginas','off.html'));await pg.fill('#u','Alvo1');await pg.fill('#p','x');await pg.click('#go1');
 await pg.waitForFunction(()=>cur==='clan',null,{timeout:10000});await pg.click('.card >> nth=0');await pg.click('#go2');await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
 await pg.evaluate(()=>{autoOn=false;scene=0;const base={...E[0],boss:0,rad:18,dead:0,stun:0,root:0,hurt:0,lunge:0,mv:0,sn:null,atk:0,wt:99999,t:''};
  E.length=0;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];
  E.push({...base,id:1,nome:'Lobo Perto',lv:3,max:100,hp:100,x:p.x+70,y:p.y+4});E.push({...base,id:2,nome:'Lobo Longe',lv:7,max:200,hp:150,x:p.x-160,y:p.y+50,stun:3})});
 await W(400);
 const pos=i=>pg.evaluate(i=>{const r=cv.getBoundingClientRect(),e=E[i];return{x:r.left+(e.x-CAM.x)*z,y:r.top+(e.y-22-CAM.y)*z}},i);
 const tg=()=>pg.evaluate(()=>({id:TGT&&TGT.mob?TGT.mob.id:null,vis:!$('#tgt').hidden,nm:$('#tgNm b').textContent,lv:$('#tgNm span').textContent,hp:$('#tgHpT').textContent,fx:$('#tgFx').textContent,px:(()=>{const c=$('#tgFaceCv').getContext('2d').getImageData(0,0,68,68).data;let n=0;for(let i=3;i<c.length;i+=4)if(c[i])n++;return n})()}));
 let s=await tg();ok(!s.vis,'sem alvo o painel fica escondido');
 let q=await pos(1);await pg.mouse.click(q.x,q.y);await W(300);s=await tg();
 ok(s.id===2&&s.vis&&s.nm==='Lobo Longe'&&s.lv==='Nv 7'&&s.hp==='150 / 200'&&/Atordoado/.test(s.fx)&&s.px>50,'tocar no monstro longe seleciona: painel com foto, nome, nível, vida e efeito ('+JSON.stringify(s)+')');
 // golpe vai em direção ao alvo escolhido (esquerda), não ao mais perto (direita)
 const pr=await pg.evaluate(()=>{P.length=0;cast(0);return{vx:p.ax*100}});
 ok(pr&&pr.vx<-50,'o ataque sai na direção do alvo escolhido, mesmo havendo um monstro mais perto (vx='+(pr&&Math.round(pr.vx))+')');
 const pr2=await pg.evaluate(()=>{cd=[0,0,0,0];ACT=null;TGT=null;P.length=0;cast(0);return{vx:p.ax*100}});
 ok(pr2&&pr2.vx>50,'sem alvo escolhido continua mirando o mais próximo (vx='+(pr2&&Math.round(pr2.vx))+')');
 await pg.evaluate(()=>{E[1].hp=40});q=await pos(1);await pg.mouse.click(q.x,q.y);await W(300);
 await pg.evaluate(()=>{E[1].hp=40});await W(300);s=await tg();ok(s.hp==='40 / 200','a barra de vida acompanha o monstro ('+s.hp+')');
 await pg.evaluate(()=>{E[1].dead=1});await W(300);s=await tg();ok(!s.vis,'alvo morto limpa o painel');
 await pg.evaluate(()=>{E[1].dead=0});q=await pos(0);await pg.mouse.click(q.x,q.y);await W(200);s=await tg();ok(s.id===1,'tocar em outro monstro troca o alvo');
 await pg.mouse.click(620,330);await W(200);s=await tg();ok(!s.vis&&s.id===null,'tocar no vazio solta o alvo');
 await pg.mouse.click(q.x,q.y);await W(200);await pg.click('#tgX');s=await tg();ok(!s.vis,'botão × solta o alvo');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close();process.exit(fails?1:0)})();
