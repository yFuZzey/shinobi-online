// layout dos golpes: inicial + meio + ultimate (grande) + item da mão; Bola de Fogo; botão do item (Chidori). Sharingan/Mangekyō/Susanoo: ver jut.js
const {chromium}=require(process.env.PLAYWRIGHT||'/opt/npm-tools/node_modules/playwright');const W=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)fails++};
(async()=>{const b=await chromium.launch({args:['--no-sandbox']});
 const open=async(clanIdx,nome)=>{const pg=await (await b.newContext({viewport:{width:844,height:390}})).newPage();pg._errs=[];pg.on('pageerror',e=>{pg._errs.push(e.message);console.log('ERRO',e.message)});
  await pg.goto('file://'+require('path').join(__dirname,'..','paginas','off.html'));await pg.fill('#u',nome);await pg.fill('#p','x');await pg.click('#go1');
  await pg.waitForFunction(()=>cur==='cust',null,{timeout:10000});await pg.click('#go2');await pg.click('.card >> nth='+clanIdx);await pg.waitForFunction(()=>cur==='game'&&ready,null,{timeout:10000});
  await pg.evaluate(()=>{switchMap('vila_areia')});await W(500);return pg};
 const setup=(pg,dx)=>pg.evaluate(dx=>{autoOn=false;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T+40;p.hp=p.max;p.mp=p.mpMax;cd=[0,0,0,0];
  const mk=(dx,id)=>({id,max:5000,hp:5000,x:p.x+dx,y:p.y,dead:0,dt:0,rt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,stun:0,hurt:0,hit:0,rad:18,boss:0,t:'',kind:'mob',dir:0,wt:9,atk:9,wm:0,wa:0,bc:9,jcd:9,nome:'alvo'+id});
  E=[mk(dx,1)]},dx);
 const boxes=pg=>pg.evaluate(()=>[0,1,2,3].map(i=>{const r=$('#b'+i).getBoundingClientRect();return{i,x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,t:$('#b'+i).textContent.trim()}}));

 // ================= UCHIHA =================
 const U=await open(0,'Itachi');
 let bx=await boxes(U);console.log('   botões:',bx.map(b=>b.i+':'+b.t+' ('+Math.round(b.x)+','+Math.round(b.y)+' ⌀'+Math.round(b.w)+')').join(' · '));
 ok(/Bola de Fogo/.test(bx[0].t)&&/Sharingan/.test(bx[1].t)&&/Susanoo/.test(bx[2].t),'Uchiha: inicial = Bola de Fogo, meio = Sharingan, ultimate = Susanoo');
 ok(bx[2].w>bx[0].w&&bx[2].w>bx[1].w&&bx[2].w>bx[3].w,'a ultimate é o botão grande');
 let ov=0;for(let a=0;a<4;a++)for(let c=a+1;c<4;c++)if(Math.hypot(bx[a].x-bx[c].x,bx[a].y-bx[c].y)<(bx[a].w+bx[c].w)/2-1)ov++;ok(!ov,'nenhum botão encosta no outro');
 const big=bx[2],ang=[0,1,3].map(i=>Math.atan2(big.y-bx[i].y,big.x-bx[i].x)*180/Math.PI);
 ok(ang[0]<ang[1]&&ang[1]<ang[2],'os 3 pequenos ficam em arco em volta do grande, em sequência (ângulos '+ang.map(a=>Math.round(a)+'°').join(', ')+')');
 ok(await U.evaluate(()=>$('#b3').classList.contains('empty')&&/Item/.test($('#b3').textContent)),'sem item na mão: 4º botão aparece vazio ("Item")');
 await U.screenshot({path:__dirname+'/lay_uchiha.png'});
 await U.evaluate(()=>useBtn(3));await W(200);ok(await U.evaluate(()=>!$('#toast').hidden&&/Equipe um item/.test($('#toast').textContent)),'tocar no botão vazio explica que precisa de um item');
 // Bola de Fogo
 await setup(U,110);await U.evaluate(()=>{window._fb=0;const f0=fireBoom;fireBoom=function(b){_fb++;return f0(b)};cast(0)});await W(60);
 ok(await U.evaluate(()=>ACT&&ACT.a==='fogo'),'Bola de Fogo: o ninja faz a pose do selo');
 await U.waitForFunction(()=>P.some(b=>b.fire)||fx.some(f=>f.k==='boom'),null,{timeout:1500}).catch(()=>{});const fl=await U.evaluate(()=>P.filter(b=>b.fire).length+(P.some(b=>b.fire)?0:fx.filter(f=>f.k==='boom').length?1:0));ok(fl===1,'a bola de fogo sai depois do selo ('+await U.evaluate(()=>CLANS.uchiha.sk[0].tel)+' s)');
 await U.screenshot({path:__dirname+'/lay_fogo1.png'});
 await W(350);const fr=await U.evaluate(()=>({hp:E[0].hp,boom:_fb===1,left:P.filter(b=>b.fire).length}));
 ok(fr.hp<5000&&fr.boom&&!fr.left,'acertou o alvo e explodiu ('+(5000-fr.hp)+' de dano)');
 await U.screenshot({path:__dirname+'/lay_fogo2.png'});
 // anda durante a pose: a pose é cortada (sem travar o ninja)
 await setup(U,400);const x0=await U.evaluate(()=>{cast(0);return p.x});await U.keyboard.down('ArrowLeft');await W(250);await U.keyboard.up('ArrowLeft');const mv=await U.evaluate(()=>({dx:p.x,a:ACT&&ACT.a}));ok(x0-mv.dx>15,'pode andar logo depois de soltar: a pose não prende o ninja (andou '+Math.round(x0-mv.dx)+' px)');
 // item da mão
 await U.evaluate(()=>{giveItems(['chidori']);equipItem('chidori')});await W(200);
 ok(await U.evaluate(()=>!$('#b3').classList.contains('empty')&&/Chidori/.test($('#b3').textContent)&&/Bola de Fogo/.test($('#b0').textContent)),'com o Chidori equipado: o 4º botão vira Chidori e a Bola de Fogo continua no 1º');
 await setup(U,90);const mp0=await U.evaluate(()=>p.mp);await U.dispatchEvent('#b3','pointerdown');await W(500);
 const it=await U.evaluate(()=>({hp:E[0].hp,cd:cd[3],mp:p.mp}));ok(it.hp<5000&&it.cd>0&&it.mp<mp0,'tocar no botão do item solta o Chidori (dano '+(5000-it.hp)+', recarga '+it.cd.toFixed(1)+' s, chakra '+mp0+' → '+it.mp+')');
 await W(80);await U.screenshot({path:__dirname+'/lay_item.png'});
 await setup(U,90);await U.keyboard.press('4');await W(400);ok(await U.evaluate(()=>cd[3]>0&&E[0].hp<5000),'tecla 4 também usa o item');
 await U.evaluate(()=>{p.mp=0;cd[3]=0});await U.evaluate(()=>useBtn(3));ok(await U.evaluate(()=>FT.some(f=>f.t==='sem chakra')),'sem chakra: avisa');
 ok(await U.evaluate(()=>profSkills('ninjutsu').includes('Chidori')),'o Chidori conta como Ninjutsu na especialidade');
 await U.evaluate(()=>{unequipItem?unequipItem('chidori'):0});
 // ================= HYUGA =================
 const H=await open(1,'Neji');bx=await boxes(H);
 ok(/Palma/.test(bx[0].t)&&/Kaiten/.test(bx[1].t)&&/64/.test(bx[2].t),'Hyuga: inicial = Palma, meio = Kaiten, ultimate = 64 Palmas ('+bx.map(b=>b.t).join(' | ')+')');
 await H.screenshot({path:__dirname+'/lay_hyuga.png'});
 const hcd=await H.evaluate(()=>CLANS.hyuga.sk.map((s,i)=>[s.n,+cdOf(i,s).toFixed(1),mpOf(i,s)]));console.log('   Hyuga (nome, recarga, chakra):',JSON.stringify(hcd));
 const ucd=await U.evaluate(()=>CLANS.uchiha.sk.map((s,i)=>[s.n,+cdOf(i,s).toFixed(1),mpOf(i,s)]));console.log('   Uchiha:',JSON.stringify(ucd));
 ok(!U._errs.length&&!H._errs.length,'sem erros na página');
 console.log(fails?fails+' FALHA(S)':'TUDO OK');await b.close()})();
