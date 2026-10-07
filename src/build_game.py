import json,re,glob,os
D='gerado/base.html'
s=open(D).read()
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:70],s.count(a))
    s=s.replace(a,b)
# 1) assets
if 'splant1' not in s:
    lines=s.split('\n')
    i=[n for n,l in enumerate(lines) if l.startswith('const TS={')][0]
    assert lines[i+1].startswith('const TSZ=')
    new=open('assets_all.js').read().strip().split('\n')
    lines[i:i+2]=new
    s='\n'.join(lines)
# 2) mapas embutidos
maps={}
for f in sorted(glob.glob('ed/db/maps/*.json')):
    d=json.load(open(f));d=d.get('data',d);m=json.loads(d['json'])
    slug=os.path.basename(f)[:-5]
    if slug=='atual':slug='konoha'
    m['name']=slug;maps[slug]=m
extra=glob.glob('ed/extra_maps/*.json')
for f in extra:
    m=json.load(open(f));maps[m['name']]=m
cat=json.load(open('ed/catalog.json'))
fpt={c[0]:[c[3],c[4],c[5]] for c in cat if (c[3],c[4],c[5])!=(1,1,0)}
block='''//MAPS-BEGIN
const MAPS=%s;
const SWC=new Uint8Array(625),BRD=[],FPT=%s;
let SPAWN=[25.5,25.5],BOSSP=null,DOOR=null,THEME='folha',CURMAP='konoha';
function applyMap(m){
 M.fill(0);OB.length=0;WC.fill(0);RD.fill(0);SWC.fill(0);BRD.length=0;DOOR=null;THEME=m.theme||'folha';GC=null;
 const g=m.ground,gt=(x,y)=>g.charCodeAt(y*N+x)-48,ring=(x,y)=>x<2||y<2||x>=N-2||y>=N-2;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(gt(x,y)==1){RD[y*N+x]=1;M[y*N+x]=3}
 for(let cy=0;cy<25;cy++)for(let cx=0;cx<25;cx++){const t=gt(cx*2,cy*2);if(t<2)continue;
  if(t==2)SWC[cy*25+cx]=1;
  else{WC[cy*25+cx]=t==3?2:1;for(let j=0;j<2;j++)for(let i=0;i<2;i++)M[(cy*2+j)*N+cx*2+i]=t==5?3:2;if(t==5)BRD.push([cx,cy])}}
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(ring(x,y))M[y*N+x]=1;
 for(const r of m.objects){const k=r[0];if(!TSZ[k])continue;const o={k,x:r[1]*T,y:r[2]*T};OB.push(o);
  const f=FPT[k]||[1,1,0],base=Math.floor((o.y-1)/T),x0=Math.round(r[1]-f[0]/2),y1=base-f[2];
  if(Array.isArray(r[4])){const bx=Math.floor(r[1]);for(const a of r[4])setM(bx+a[0],base+a[1],1)}
  else if(!r[3])for(let y=y1-f[1]+1;y<=y1;y++)for(let x=x0;x<x0+f[0];x++)setM(x,y,1);
  if(k=='tower'){for(let x=x0+1;x<=x0+2;x++)setM(x,y1,3);DOOR={x:r[1]*T,yIn:(y1+.55)*T,yOut:(y1+1.7)*T}}}
 if(m.k)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const v=m.k.charCodeAt(y*N+x)-48;if(v==1)setM(x,y,1);else if(v==2&&!ring(x,y))setM(x,y,3)}
 SPAWN=m.spawn;BOSSP=m.boss}
{const h=(location.hash||'').slice(1);CURMAP=MAPS[h]?h:(MAPS.konoha?'konoha':Object.keys(MAPS)[0]);applyMap(MAPS[CURMAP])}
//MAPS-END''' % (json.dumps(maps,separators=(',',':'),ensure_ascii=False),json.dumps(fpt,separators=(',',':')))
if '//MAPS-BEGIN' in s:
    a=s.index('//MAPS-BEGIN');b=s.index('//MAPS-END')+len('//MAPS-END');s=s[:a]+block+s[b:]
else:
    a=s.index('// ---------- mapa carregado do editor ----------');b=s.index('const sol=(x,y)=>{')
    s=s[:a]+block+'\n'+s[b:]
open(D,'w').write(s)
print('mapas:',list(maps),len(s)//1024,'KB')
# --- 3) chao tematico + seletor de mapa (idempotente)
s=open(D).read()
if "THEME=='areia'" not in s:
    a=s.index('function buildGround(){');b=s.index('function go(o,vx,vy,sp,dt)')
    new='''function buildGround(){
 GC=document.createElement('canvas');GC.width=GC.height=N*T;const g=GC.getContext('2d'),A=THEME=='areia';
 const G=['g1','g2','g3','g4','g1','g2','g3','g4','g1','g2','g3','g4','g1','g2','g3','g4','g1','g2','g3','g4','g1','g2','g3','gd'];
 if(A){for(let cy=0;cy<25;cy++)for(let cx=0;cx<25;cx++){const h=((cx*73856093)^(cy*19349663))>>>0;g.drawImage(TX['sg'+(h%5+1)],cx*64,cy*64)}}
 else for(let y=0;y<N;y++)for(let x=0;x<N;x++){const h=((x*73856093)^(y*19349663))>>>0;g.drawImage(TX[G[h%G.length]],x*T,y*T)}
 for(let cy=0;cy<25;cy++)for(let cx=0;cx<25;cx++){
  if(SWC[cy*25+cx])g.drawImage(TX[A?((cx+cy)%2?'sd1':'sd2'):((cx+cy)%2?'sw1':'sw2')],cx*64,cy*64)}
 for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(RD[y*N+x]){const h=((x*83492791)^(y*29765729))>>>0;g.drawImage(TX[A?(h%3?'sp1':'sp2'):(h%3?'p1':'p2')],x*T,y*T)}
 for(let cy=0;cy<25;cy++)for(let cx=0;cx<25;cx++){const v=WC[cy*25+cx];if(!v)continue;
  g.drawImage(TX[v==1?(A?'sriver':'river'):(A?'swater':'water')],cx*64,cy*64);
  if(v==2){const land=(a,b)=>a<0||b<0||a>=25||b>=25||WC[b*25+a]==0,B=TX[A?'sbank':'bank'],X=cx*64,Y=cy*64;
   if(land(cx,cy-1))g.drawImage(B,X,Y,64,10);
   if(land(cx,cy+1)){g.save();g.translate(X,Y+64);g.scale(1,-1);g.drawImage(B,0,0,64,10);g.restore()}
   if(land(cx-1,cy)){g.save();g.translate(X,Y+64);g.rotate(-Math.PI/2);g.drawImage(B,0,0,64,10);g.restore()}
   if(land(cx+1,cy)){g.save();g.translate(X+64,Y);g.rotate(Math.PI/2);g.drawImage(B,0,0,64,10);g.restore()}}}
 BRD.forEach(b=>{g.drawImage(TX.plank1,b[0]*64-13,b[1]*64,90,T);g.drawImage(TX.plank2,b[0]*64-13,b[1]*64+T,90,T)})}
'''
    s=s[:a]+new+s[b:]
if 'id="maps"' not in s:
    s=s.replace('<input id="u" placeholder="Usuário"','<div id="maps" class="m"></div>\n<input id="u" placeholder="Usuário"',1)
    s=s.replace("</style></head>",".mp{padding:8px 14px;margin:3px;font-size:14px;background:var(--panel);border:2px solid var(--line);color:var(--ink)}.mp.on{border-color:var(--acc)}\n</style></head>",1)
    s=s.replace("$('#go2').onclick=()=>show('clan');","$('#go2').onclick=()=>show('clan');\n(function(){const ks=Object.keys(MAPS),el=$('#maps');if(ks.length<2){el.style.display='none';return}\n const draw=()=>{el.innerHTML='Mapa: ';ks.forEach(k=>{const b=document.createElement('button');b.className='mp'+(k==CURMAP?' on':'');b.textContent=k;b.onclick=()=>{CURMAP=k;applyMap(MAPS[k]);draw()};el.appendChild(b)})};draw()})();",1)
open(D,'w').write(s)
# --- 4) botao de mapa dentro do jogo (idempotente)
s=open(D).read()
if 'id="mapbtn"' not in s:
    s=s.replace('<div id="jb"><div id="jk"></div></div>','<button id="mapbtn" aria-label="Escolher mapa"></button>\n<div id="mapmenu" hidden><div class="mm"><h3>Escolher mapa</h3><div id="mmList"></div><button id="mmX">Fechar</button></div></div>\n<div id="jb"><div id="jk"></div></div>',1)
    s=s.replace("</style></head>","""#mapbtn{position:absolute;right:10px;top:8px;z-index:6;margin:0;padding:7px 12px;font-size:13px;border-radius:16px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:600}
#mapmenu{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
#mapmenu[hidden]{display:none}
#mapmenu .mm{background:var(--panel);color:var(--ink);border:2px solid var(--line);border-radius:14px;padding:16px;width:min(320px,88vw);text-align:center}
#mapmenu h3{margin:0 0 8px;font-size:18px}
#mmList button{display:block;width:100%;margin:6px 0 0;padding:12px;font-size:16px;background:var(--panel);color:var(--ink);border:2px solid var(--line)}
#mmList button.on{border-color:var(--acc)}
#mmX{margin-top:12px;padding:10px 22px;font-size:15px}
</style></head>""",1)
    s=s.replace("$('#go2').onclick=()=>show('clan');","""function switchMap(k){
 CURMAP=k;applyMap(MAPS[k]);scene=0;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;p.ax=0;p.ay=1;p.dir=0;EP=[];P=[];fx=[];FT=[];
 E.forEach(e=>{place(e);e.ch=0;e.lunge=0;e.dmgp=0;e.hurt=0;e.stun=0;e.hit=0;e.dt=0;e.rt=0});
 flash={col:'#000',a:1};$('#mapbtn').textContent='Mapa: '+k;
 const h=$('#hint');h.textContent='Mapa: '+k;h.style.opacity=1;clearTimeout(window.__ht);window.__ht=setTimeout(()=>h.style.opacity=0,2500)}
function mmDraw(){const L=$('#mmList');L.innerHTML='';Object.keys(MAPS).forEach(k=>{const b=document.createElement('button');b.textContent=k;b.className=k==CURMAP?'on':'';b.onclick=()=>{$('#mapmenu').hidden=true;if(k!=CURMAP)switchMap(k)};L.appendChild(b)})}
$('#mapbtn').onclick=()=>{mmDraw();$('#mapmenu').hidden=false};$('#mmX').onclick=()=>{$('#mapmenu').hidden=true};
$('#go2').onclick=()=>show('clan');""",1)
    s=s.replace("$('#hn').textContent=name+' · '+C.n;","$('#hn').textContent=name+' · '+C.n;$('#mapbtn').textContent='Mapa: '+CURMAP;",1)
open(D,'w').write(s)
