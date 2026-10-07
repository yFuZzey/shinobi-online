//FXLIB-BEGIN
// [chave, nome, unidade, grupo]  grupo: st = pontos de status (somam antes das %), stp = % em cima do status final, at = atributos
const STAT_DEFS=[['str','Força','','st'],['agi','Agilidade','','st'],['vit','Vitalidade','','st'],['int','Inteligência','','st'],['dex','Destreza','','st'],['luk','Sorte','','st'],
 ['str_pct','Força','%','stp'],['agi_pct','Agilidade','%','stp'],['vit_pct','Vitalidade','%','stp'],['int_pct','Inteligência','%','stp'],['dex_pct','Destreza','%','stp'],['luk_pct','Sorte','%','stp'],
 ['dmg_pct','Poder','%','at'],['dmg_flat','Poder fixo','','at'],['hp_max','Vida máxima','','at'],['hp_pct','Vida máxima','%','at'],['mp_max','Chakra máximo','','at'],['mp_pct','Chakra máximo','%','at'],['regen_pct','Regeneração de vida e chakra','%','at'],['speed_pct','Velocidade','%','at']];
const SLOT_DEFS=[['capa','Capa'],['arma','Arma'],['mao','Mão'],['cabeca','Cabeça'],['acessorio','Acessório']];
const ATK_DEFS={raio:'Investida de raio'};
const RAR_DEFS={comum:['Comum','#b8c0cc'],raro:['Raro','#5aa9ff'],epico:['Épico','#b774ff'],lendario:['Lendário','#ffb35c']};
function statLines(st){const o=[];st=st||{};STAT_DEFS.forEach(([k,n,u])=>{const v=+st[k]||0;if(v)o.push((v>0?'+':'')+v+u+' de '+n.toLowerCase())});return o}
const KIM={};(()=>{for(const k in KY){const i=new Image();i.src=KY[k][2];KIM[k]=i}})();
function kimg(c,k,x,y,w,h,flip){const im=KIM[k];if(!im||!im.complete||!im.naturalWidth)return;
 if(flip){c.save();c.translate(x,0);c.scale(-1,1);c.drawImage(im,-w/2,y-h,w,h);c.restore()}else c.drawImage(im,x-w/2,y-h,w,h)}
function hexA(h,a){h=/^#[0-9a-f]{6}$/i.test(h||'')?h:'#ff7a1a';return 'rgba('+parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16)+','+a+')'}
function fxRing(c,x,y,ts,front,raio){const im=KIM[(raio?'rb':'kb')+((ts/100|0)%9)];if(!im||!im.complete||!im.naturalWidth)return;
 c.save();if(front){c.beginPath();c.rect(x-90,y-22,180,90);c.clip()}
 c.translate(x,y-22);c.scale(1,.5);c.rotate(ts/2400*(raio?-1.6:1));if(raio){c.globalCompositeOperation='lighter';c.drawImage(im,-46,-46,92,92)}else c.drawImage(im,-48,-44,96,88);c.restore()}
function fxDraw(c,x,y,ts,list,front,o){
 if(!list||!list.length)return;
 const rr=list.filter(f=>f.orbit),rz=f=>f.kind=='raio';
 if(front){
  if(rr.length){c.save();c.globalAlpha=.95;rr.forEach(f=>fxRing(c,x,y,ts,1,rz(f)));c.restore()}
  list.forEach(f=>{if(!f.hand||!rz(f))return;const fl=o&&o.fl?-1:1,k=(ts/70|0)%10,hx=x+fl*13,hy=y-24,s=.5+.05*Math.sin(ts/90);
   c.save();c.globalCompositeOperation='lighter';
   const g=c.createRadialGradient(hx,hy,1,hx,hy,26);g.addColorStop(0,'rgba(190,240,255,.55)');g.addColorStop(1,'rgba(40,140,255,0)');c.fillStyle=g;c.beginPath();c.arc(hx,hy,26,0,7);c.fill();
   kimg(c,'rh'+k,hx,hy+27*s*2,88*s*.95,108*s*.95);c.restore()});
  return}
 c.save();c.globalCompositeOperation='lighter';
 list.forEach(f=>{if(!f.glow)return;const pu=.85+.15*Math.sin(ts/260);
  let g=c.createRadialGradient(x,y,2,x,y,34);g.addColorStop(0,hexA(f.glow,.38*pu));g.addColorStop(1,hexA(f.glow,0));
  c.fillStyle=g;c.beginPath();c.ellipse(x,y,34,14,0,0,7);c.fill();
  if(!f.tails&&!f.orbit&&!f.hand){g=c.createRadialGradient(x,y-26,4,x,y-26,38);g.addColorStop(0,hexA(f.glow,.22*pu));g.addColorStop(1,hexA(f.glow,0));
   c.fillStyle=g;c.beginPath();c.ellipse(x,y-26,30,40,0,0,7);c.fill()}});
 if(list.some(f=>f.tails&&f.kind!='raio')){const f1=(ts/85|0)%10,f2=(f1+5)%10,sw=Math.sin(ts/300)*2;
  c.globalAlpha=.7;kimg(c,'kc'+f2,x+sw,y+2,104,134,1);
  c.globalAlpha=.95;kimg(c,'kc'+f1,x-sw,y+3,80,102)}
 c.restore();
 if(rr.length){c.save();c.globalAlpha=.95;rr.forEach(f=>fxRing(c,x,y,ts,0,rz(f)));c.restore()}}
function fxBolt(c,x1,y1,x2,y2,ts,a){
 const dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L,n=Math.max(4,L/13|0);
 let seed=((ts/45|0)*9301+49297)%233280;const rnd=()=>(seed=(seed*9301+49297)%233280)/233280-.5;
 const pts=[[x1,y1]];for(let i=1;i<n;i++){const t=i/n,o=rnd()*18*Math.sin(Math.PI*t);pts.push([x1+dx*t+nx*o,y1+dy*t+ny*o])}pts.push([x2,y2]);
 c.save();c.globalAlpha=Math.max(0,Math.min(1,a));c.lineCap='round';c.lineJoin='round';c.globalCompositeOperation='lighter';
 [[11,'rgba(40,130,255,.28)'],[5,'rgba(110,205,255,.65)'],[2,'#ffffff']].forEach(([w,s])=>{c.lineWidth=w;c.strokeStyle=s;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke()});
 for(let k=0;k<3;k++){const i=1+((rnd()+.5)*(pts.length-3)|0),p=pts[i],bx=p[0]+dx/L*16+rnd()*44,by=p[1]+dy/L*16+rnd()*44;
  c.lineWidth=1.6;c.strokeStyle='rgba(160,225,255,.9)';c.beginPath();c.moveTo(p[0],p[1]);c.lineTo((p[0]+bx)/2+rnd()*9,(p[1]+by)/2+rnd()*9);c.lineTo(bx,by);c.stroke()}
 c.restore()}
function fxImpact(c,x,y,t,kind,sc){if(t<0)return;const f=Math.min(2,t/.3|0),a=1-Math.max(0,(t-.55)/.35);
 c.save();c.globalCompositeOperation='lighter';c.globalAlpha=Math.max(0,a);
 if(kind=='raio')kimg(c,'ri'+f,x,y+8,150*(sc||1.3),110*(sc||1.3));else kimg(c,'ki'+f,x,y+16,210,188);c.restore()}
//FXLIB-END
