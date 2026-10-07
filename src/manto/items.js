//MANTO-BEGIN
const KY=__KY__;
__FXLIB__
const ITEMS={};__ITEMS__.forEach(i=>ITEMS[i.id]=i);
const ZERO=()=>{const z={};STAT_DEFS.forEach(d=>z[d[0]]=0);return z};
let INV=[],EQ={},invSel=null,invOpen=false,fxT=-1,dropTm=0,AG=ZERO();
const RG=()=>Math.max(.2,1+AG.regen_pct/100);
// ---- personagem: nível, experiência e atributos (estilo Ragnarok) ----
const AT=[['str','STR','Força','+3% de dano por ponto'],['agi','AGI','Agilidade','+1% de velocidade e +0,5% de esquiva por ponto'],['vit','VIT','Vitalidade','+8 de vida máxima e +0,5% de redução de dano por ponto'],['int','INT','Inteligência','+6 de chakra máximo e +2% de regeneração de chakra por ponto'],['dex','DEX','Destreza','−1% de recarga das habilidades por ponto (máx. 40%)'],['luk','LUK','Sorte','+0,7% de chance de golpe crítico (dano dobrado)']];
const LVMAX=99,PTS_LV=5,xpNeed=l=>Math.round(80*Math.pow(l,1.4));
const chNew=()=>({lv:1,xp:0,pts:0,st:{str:0,agi:0,vit:0,int:0,dex:0,luk:0}});
let CH=chNew(),panel='bag',lastCrit=false,hnBase='';
const chKey=()=>'shinobi-char-'+String(name).toLowerCase();
function chLoad(){CH=chNew();try{const j=JSON.parse(localStorage.getItem(chKey())||'null');if(j){CH.lv=Math.max(1,Math.min(LVMAX,+j.lv||1));CH.xp=Math.max(0,+j.xp||0);CH.pts=Math.max(0,+j.pts||0);for(const k in CH.st)CH.st[k]=Math.max(0,Math.min(99,+(j.st&&j.st[k])||0))}}catch(e){}}
function chSave(){try{localStorage.setItem(chKey(),JSON.stringify(CH))}catch(e){}}
function D(){const s=CH.st;return{hp:Math.max(20,100+AG.hp_max+s.vit*8),mp:Math.max(20,100+AG.mp_max+s.int*6),dmg:AG.dmg_pct+s.str*3,spd:AG.speed_pct+s.agi,dodge:Math.min(30,s.agi*.5),red:Math.min(40,s.vit*.5),crit:Math.min(50,s.luk*.7),cdr:Math.min(40,s.dex),mpr:AG.regen_pct+s.int*2}}
const MG=()=>Math.max(.2,1+D().mpr/100),SPD=()=>Math.max(.3,1+D().spd/100),CDM=()=>1-D().cdr/100;
function calcDmg(d){const x=(d+AG.dmg_flat)*(1+D().dmg/100);lastCrit=Math.random()*100<D().crit;return Math.max(1,Math.round(lastCrit?x*2:x))}
function gainXp(n){if(CH.lv>=LVMAX)return;CH.xp+=n;FT.push({x:p.x,y:p.y-74,t:'+'+n+' XP',txt:1,gold:1,life:1.1});let up=0;
 while(CH.lv<LVMAX&&CH.xp>=xpNeed(CH.lv)){CH.xp-=xpNeed(CH.lv);CH.lv++;CH.pts+=PTS_LV;up++}
 if(CH.lv>=LVMAX)CH.xp=0;chSave();if(up)levelUp()}
function levelUp(){stats();p.hp=p.max;p.mp=p.mpMax;flash={col:'#ffd23f',a:.4};
 FT.push({x:p.x,y:p.y-92,t:'NÍVEL '+CH.lv+'!',txt:1,gold:1,life:1.6});fx.push({k:'ring',x:p.x,y:p.y-8,r:80,col:'#ffd23f',life:.6,max:.6,sp:1});
 const d=$('#lvup');d.querySelector('span').textContent='Nível '+CH.lv;d.querySelector('em').textContent='+'+PTS_LV+' pontos de status · toque para distribuir';d.hidden=false;
 clearTimeout(d._t);d._t=setTimeout(()=>d.hidden=true,5000);stRefresh()}
function agg(){AG=ZERO();for(const s in EQ){const it=ITEMS[EQ[s]];if(it&&it.stats)for(const k in AG)AG[k]+=+it.stats[k]||0}}
function eqFx(){const l=[];for(const s in EQ){const it=ITEMS[EQ[s]];if(it&&it.fx&&(it.fx.tails||it.fx.orbit||it.fx.glow||it.fx.hand))l.push(it.fx)}return l}
let fxK='fogo',b0orig='';
function atkItem(){for(const s in EQ){const it=ITEMS[EQ[s]];if(it&&it.atk&&it.atk.kind=='raio')return it}return null}
const mpOf=(i,s)=>{const a=i==0?atkItem():null;return a?(+a.atk.mp||0):s.mp};
const cdOf=(i,s)=>{const a=i==0?atkItem():null;return Math.max(.2,(a?+a.atk.cd||s.cd:s.cd)*CDM())};
function refreshAtk(){const it=atkItem(),b=$('#b0');if(!b)return;b.innerHTML=it?'<span>⚡</span>'+it.name+'<div class="cd"></div>':b0orig;b.dataset.atk=it?'1':''}
function castAtk(ax,ay){p.th=-1;const it=atkItem(),A=it.atk,reach=+A.reach||260,dmg=+A.dmg||16,area=+A.area||64;
 let tg=null,best=reach;E.forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;tg=e}});
 let tx,ty;if(tg){const d=best||1,ux=(tg.x-p.x)/d,uy=(tg.y-p.y)/d,stop=Math.min(d,(tg.rad||0)*.55+26);tx=tg.x-ux*stop;ty=tg.y-uy*stop;p.ax=ux;p.ay=uy;p.fl=ux<0}
 else{tx=p.x+ax*90;ty=p.y+ay*90}
 const dist=Math.hypot(tx-p.x,ty-p.y);
 p.dash={sx:p.x,sy:p.y,tx,ty,t:0,dur:Math.max(.1,Math.min(.28,dist/650)),dmg,area};flash={col:'#8fd8ff',a:.15}}
function dashStep(dt){const d=p.dash;d.t+=dt;p.mv=1;p.run=1;const k=Math.min(1,d.t/d.dur),e=1-(1-k)*(1-k),nx=d.sx+(d.tx-d.sx)*e,ny=d.sy+(d.ty-d.sy)*e;
 const ox=p.x,oy=p.y;let stop=false;if(!blk(nx,p.y))p.x=nx;else stop=true;if(!blk(p.x,ny))p.y=ny;else stop=true;
 fx.push({k:'bolt',x:ox,y:oy-22,x2:p.x,y2:p.y-22,life:.16,max:.16,hit:0});
 if(k>=1||stop){p.dash=null;p.mv=0;const hx=p.x,hy=p.y;
  E.forEach(e=>{if(e.dead)return;const dx=e.x-hx,dy=e.y-hy,dd=Math.hypot(dx,dy);if(dd<d.area+(e.rad||0)*.65){const u=dd||1;hitE(e,d.dmg,.7,dx/u*9,dy/u*9)}});
  fx.push({k:'ring',x:hx,y:hy-8,r:d.area,col:'#6fd0ff',life:.4,max:.4,sp:1});fx.push({k:'rimp',x:hx,y:hy,life:.45,max:.45});flash={col:'#8fd8ff',a:.3}}}
const invKey=()=>'shinobi-inv-'+String(name).toLowerCase();
function invLoad(){INV=[];EQ={};invSel=null;try{const j=JSON.parse(localStorage.getItem(invKey())||'null');if(j){
 const e=j.eq&&typeof j.eq=='object'?j.eq:{};for(const s in e){const it=ITEMS[e[s]];if(it&&it.slot==s)EQ[s]=e[s]}
 (Array.isArray(j.inv)?j.inv:[]).forEach(i=>{if(ITEMS[i]&&!INV.includes(i)&&!Object.values(EQ).includes(i))INV.push(i)})}}catch(e){}}
function invSave(){try{localStorage.setItem(invKey(),JSON.stringify({inv:INV,eq:EQ}))}catch(e){}}
function stats(){agg();const d=D(),dm=d.hp-p.max,dn=d.mp-(p.mpMax||100);p.max=d.hp;p.mpMax=d.mp;if(dm>0)p.hp+=dm;if(dn>0)p.mp+=dn;p.hp=Math.min(p.hp,p.max);p.mp=Math.min(p.mp,p.mpMax);refreshAtk();stRefresh()}
const hasItem=id=>INV.includes(id)||Object.values(EQ).includes(id);
function giveItems(ids){const got=ids.filter(i=>ITEMS[i]&&!hasItem(i));if(!got.length)return;
 got.forEach(i=>INV.push(i));invSave();invSel=got[0];flash={col:'#ff9a2a',a:.45};
 const d=$('#drop');d.querySelector('span').textContent=got.map(i=>ITEMS[i].n||ITEMS[i].name).join(', ');d.hidden=false;
 clearTimeout(dropTm);dropTm=setTimeout(()=>d.hidden=true,7000);$('#bagbtn').classList.add('new');bagRefresh()}
function dropItems(src){giveItems(Object.keys(ITEMS).filter(i=>{const d=ITEMS[i].drop;return d&&d.src==src&&Math.random()*100<(d.chance==null?100:+d.chance)}))}
function equipItem(id){const it=ITEMS[id],i=INV.indexOf(id);if(i<0)return;INV.splice(i,1);const old=EQ[it.slot];if(old)INV.push(old);EQ[it.slot]=id;
 invSave();stats();toggleBag(false);if(it.fx&&it.fx.impact){fxT=0;fxK=it.fx.kind||'fogo';flash={col:it.fx.glow||'#ff7a1a',a:.5}}
 const h=$('#hint');h.textContent=it.name+' equipado';h.style.opacity=1;clearTimeout(window.__ht);window.__ht=setTimeout(()=>h.style.opacity=0,2500)}
function unequipItem(id){const it=ITEMS[id];if(EQ[it.slot]!=id)return;delete EQ[it.slot];INV.push(id);invSave();stats();bagRefresh()}
function setPanel(w){panel=w;$('#paneBag').hidden=w!=='bag';$('#paneSt').hidden=w!=='st';$('#tbBag').classList.toggle('on',w==='bag');$('#tbSt').classList.toggle('on',w==='st');if(w==='st')stRefresh()}
function toggleBag(v,w){const was=invOpen;w=w||panel;if(v===undefined)v=!(invOpen&&panel===w);invOpen=v;$('#inv').hidden=!invOpen;
 if(invOpen){setPanel(w);$('#drop').hidden=true;$('#lvup').hidden=true;if(w==='bag'){$('#bagbtn').classList.remove('new');if(!invSel||!hasItem(invSel))invSel=Object.values(EQ)[0]||INV[0]||null;bagRefresh()}jx=0;jy=0}}
const slotBtn=(id,cls,on)=>{const b=document.createElement('button');b.className='sl'+cls+(id?' has':'')+(id&&id==invSel?' sel':'');
 if(id){const it=ITEMS[id];b.style.borderColor=(RAR_DEFS[it.rarity]||RAR_DEFS.comum)[1];b.innerHTML=it.icon?`<img src="${it.icon}" alt="${it.name}">`:'<small>?</small>';b.onclick=on}return b};
function bagRefresh(){
 const g=$('#ivGrid'),eq=$('#ivEq'),det=$('#ivDet');if(!g)return;g.innerHTML='';eq.innerHTML='';
 SLOT_DEFS.forEach(([s,n])=>{const w=document.createElement('div');w.className='es';const id=EQ[s];
  const b=slotBtn(id,' big',()=>{invSel=id;bagRefresh()});if(!id)b.innerHTML='';w.appendChild(b);const l=document.createElement('small');l.textContent=n;w.appendChild(l);eq.appendChild(w)});
 for(let i=0;i<12;i++){const id=INV[i];g.appendChild(slotBtn(id,'',()=>{invSel=id;bagRefresh()}))}
 const id=invSel&&hasItem(invSel)?invSel:null;
 if(!id){det.innerHTML='<p class="dm">Nada selecionado.<br>Derrote a <b>Raposa de Nove Caudas</b> para ganhar o primeiro item.</p>'}
 else{const it=ITEMS[id],on=EQ[it.slot]==id,r=RAR_DEFS[it.rarity]||RAR_DEFS.comum,sl=(SLOT_DEFS.find(x=>x[0]==it.slot)||[0,it.slot])[1];
  det.innerHTML=`<div class="dn" style="color:${r[1]}">${it.name}</div><div class="dr">${r[0]} · ${sl}${on?' · equipado':''}</div>${it.desc?`<p>${it.desc}</p>`:''}<ul>${statLines(it.stats).concat(it.atk&&it.atk.kind?['Ataque padrão vira investida de raio: avança no inimigo mais próximo e causa dano em área ('+(it.atk.dmg||16)+' de dano, área '+(it.atk.area||64)+(+it.atk.mp?', gasta '+it.atk.mp+' de chakra':'')+')']:[]).map(f=>'<li>'+f+'</li>').join('')}</ul><button id="ivAct">${on?'Desequipar':'Equipar'}</button>`;
  $('#ivAct').onclick=()=>on?unequipItem(id):equipItem(id)}}
$('#bagbtn').onclick=()=>toggleBag(undefined,'bag');$('#statbtn').onclick=()=>toggleBag(undefined,'st');$('#ivX').onclick=()=>toggleBag(false);$('#tbBag').onclick=()=>setPanel('bag');$('#tbSt').onclick=()=>setPanel('st');
$('#drop').onclick=()=>toggleBag(true,'bag');$('#lvup').onclick=()=>toggleBag(true,'st');
$('#ivReset').onclick=()=>{INV=[];EQ={};invSel=null;invSave();stats();fxT=-1;bagRefresh()};
$('#ivGive').onclick=()=>{Object.keys(ITEMS).forEach(i=>{if(!hasItem(i))INV.push(i)});invSel=INV[0]||null;invSave();bagRefresh()};
addEventListener('keydown',e=>{if(cur!='game')return;const k=e.key.toLowerCase();if(k=='i')toggleBag(undefined,'bag');else if(k=='c')toggleBag(undefined,'st');else if(e.key=='Escape'&&invOpen)toggleBag(false)});
// ---- aba de status ----
function stRefresh(){const R=$('#stRows');if(!R||typeof p==='undefined'||!p)return;const d=D();
 $('#stLv').textContent='Nível '+CH.lv;$('#stPts').textContent='Pontos disponíveis: '+CH.pts;$('#stPts').classList.toggle('has',CH.pts>0);
 const need=xpNeed(CH.lv),pc=CH.lv>=LVMAX?100:CH.xp/need*100;$('#stXp').style.width=pc+'%';$('#stXpT').textContent=CH.lv>=LVMAX?'Nível máximo':'XP '+CH.xp+' / '+need;
 R.innerHTML='';AT.forEach(([k,ab,nm,ds])=>{const r=document.createElement('div');r.className='strow';
  r.innerHTML='<div class="sn"><b>'+ab+'</b> '+nm+'<small>'+ds+'</small></div><span class="sv">'+CH.st[k]+'</span>';
  const b=document.createElement('button');b.className='sp';b.textContent='+';b.setAttribute('aria-label','Aumentar '+nm);b.disabled=CH.pts<1||CH.st[k]>=99;
  b.onclick=()=>{if(CH.pts<1||CH.st[k]>=99)return;CH.st[k]++;CH.pts--;chSave();stats()};r.appendChild(b);R.appendChild(r)});
 const f=n=>(Math.round(n*10)/10).toString().replace('.',',');
 $('#stDer').innerHTML=[['Vida máxima',d.hp],['Chakra máximo',d.mp],['Dano',(d.dmg>=0?'+':'')+f(d.dmg)+'%'],['Crítico',f(d.crit)+'%'],['Esquiva',f(d.dodge)+'%'],['Redução de dano',f(d.red)+'%'],['Velocidade',(d.spd>=0?'+':'')+f(d.spd)+'%'],['Recarga',f(-d.cdr)+'%']].map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('');
 const bd=$('#stBadge');bd.hidden=CH.pts<1;bd.textContent=CH.pts;$('#statbtn').classList.toggle('new',CH.pts>0)}
$('#stXpB').onclick=()=>gainXp(100);$('#stLvB').onclick=()=>gainXp(xpNeed(CH.lv)-CH.xp);
$('#stRed').onclick=()=>{let s=0;for(const k in CH.st){s+=CH.st[k];CH.st[k]=0}CH.pts+=s;chSave();stats()};
$('#stZero').onclick=()=>{CH=chNew();chSave();stats();p.hp=p.max;p.mp=p.mpMax}
//MANTO-END
