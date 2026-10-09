# Etapa 3 do build: modo paisagem, refinamentos de interface e novo comportamento da raposa.
D='gerado/base.html'
s=open(D).read()
assert '//LAND' not in s
def rep(a,b,n=1):
    global s
    c=s.count(a)
    assert c==n,(c,a[:90])
    s=s.replace(a,b)

# ---------- zoom da câmera: em tela deitada a altura manda ----------
rep("z=Math.min(2,Math.max(1.3,innerWidth/300))}",
    "z=Math.min(2,Math.max(1,Math.min(innerWidth/300,innerHeight/265)));const lnd=innerWidth>innerHeight;document.body.classList.toggle('land',lnd);const ro=$('#rot');if(ro)ro.hidden=lnd||rotOk||cur!='game'||!coarse}")

# ---------- câmera com tremor ----------
rep("const cx=Math.max(0,Math.min(N*T-w,p.x-w/2))|0,cy=Math.max(0,Math.min(N*T-h,p.y-h/2))|0;",
    "let cx=Math.max(0,Math.min(N*T-w,p.x-w/2))|0,cy=Math.max(0,Math.min(N*T-h,p.y-h/2))|0;if(shk>0){cx+=(Math.random()-.5)*shk*14|0;cy+=(Math.random()-.5)*shk*14|0;shk=Math.max(0,shk-dt*2.2)}")

# ---------- raposa: pulo em direção ao jogador ----------
# estado reiniciado ao renascer
rep("place(e);e.ch=0;e.lunge=0;e.dmgp=0;e.hurt=0}","place(e);e.ch=0;e.lunge=0;e.dmgp=0;e.hurt=0;e.ja=0;e.jc=0;e.jz=0;e.jcd=3}")
# no ar ignora atordoamento; agachamento antes do salto
rep("  if(e.stun>0){e.stun-=dt;e.mv=0;return}\n  if(e.boss&&e.ch>0){",
    "  e.jcd=Math.max(0,(e.jcd||0)-dt);\n  if(e.boss&&e.ja>0){e.mv=0;foxAir(e,dt);return}\n  if(e.stun>0){e.stun-=dt;e.mv=0;e.jc=0;return}\n  if(e.boss&&e.jc>0){e.mv=0;foxCrouch(e,dt);return}\n  if(e.boss&&e.ch>0){")
# decisão: pular quando o jogador está a média distância
rep("if(dist<(e.boss?330:150)){if(e.boss&&dist>170&&dist<300&&e.bc<=0){e.ch=1.2;e.fired=0;e.bc=7}",
    "if(dist<(e.boss?330:150)){if(e.boss&&dist>110&&dist<320&&e.jcd<=0&&!(dist>170&&e.bc<=0&&Math.random()<.5)){foxJump(e)}else if(e.boss&&dist>170&&dist<300&&e.bc<=0){e.ch=1.2;e.fired=0;e.bc=5.5;e.jcd=Math.max(e.jcd,2)}")
# esfera: mais rápida e mais forte
rep("EP.push({x:ox,y:oy,vx:Math.cos(a)*190,vy:Math.sin(a)*190,life:2.2})",
    "EP.push({x:ox,y:oy,vx:Math.cos(a)*360,vy:Math.sin(a)*360,life:1.35});shk=Math.max(shk,.35)")
rep("if(Math.hypot(p.x-b.x,p.y-24-b.y)<20){hurt(18);return 0}",
    "if(Math.hypot(p.x-b.x,p.y-24-b.y)<22){hurt(30);shk=Math.max(shk,.6);fx.push({k:'boom',x:b.x,y:b.y,life:.35,max:.35});return 0}")
# rastro da esfera
rep("if(fxOK)EP.forEach(b=>{const z=FXS.ball,k=.5+.05*Math.sin(ts/60);ctx.save();",
    "if(fxOK)EP.forEach(b=>{const z=FXS.ball,k=.5+.05*Math.sin(ts/60);ctx.save();for(let i=1;i<=4;i++){ctx.globalAlpha=.3-i*.06;const q=k*(1-i*.13);ctx.drawImage(FXI.ball,b.x-b.vx*.022*i-z[0]*q/2,b.y-b.vy*.022*i-z[1]*q/2,z[0]*q,z[1]*q)}ctx.restore();ctx.save();")
# desenho: altura do salto e agachamento
rep("drawFoxSpr(ctx,e.x,e.y,{t:ts,mv:e.mv,fl:e.fl,lunge:e.lunge,ch:e.ch,hurt:e.hurt,stun:e.stun,dead:e.dead,dt:e.dt})",
    "drawFoxSpr(ctx,e.x,e.y,{t:ts,mv:e.mv,fl:e.fl,lunge:e.lunge,ch:e.ch,hurt:e.hurt,stun:e.stun,dead:e.dead,dt:e.dt,jz:e.dead?0:e.jz||0,jc:e.jc||0,ja:e.ja||0})")
rep(" else if(o.lunge>0)k='claw'+Math.min(4,(1-o.lunge/.5)*5|0);",
    " else if(o.ja>0)k=o.jz>40?'run2':'run4';\n else if(o.jc>0)k='idle0';\n else if(o.lunge>0)k='claw'+Math.min(4,(1-o.lunge/.5)*5|0);")
rep(" c.save();c.translate(x,y);c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(0,0,52,11,0,0,7);c.fill();\n if(o.fl)c.scale(-1,1);\n c.drawImage(im,-z[0]/2,-z[1]+2);c.restore()}",
    " const jz=o.jz||0,sh=Math.max(.35,1-jz/170);\n c.save();c.translate(x,y);c.fillStyle='rgba(0,0,0,'+(.28*sh)+')';c.beginPath();c.ellipse(0,0,52*sh,11*sh,0,0,7);c.fill();\n c.translate(0,-jz);if(o.fl)c.scale(-1,1);\n if(o.jc>0){const q=Math.min(1,(.55-o.jc)/.3);c.scale(1+.1*q,1-.16*q);c.translate((Math.random()-.5)*2*q,0)}else if(o.ja>0)c.rotate((o.fl?1:-1)*(jz>40?-.12:.08));\n c.drawImage(im,-z[0]/2,-z[1]+2);c.restore()}")
# alvo do salto no chão (por baixo de tudo)
rep("  const L=[];\n  if(tsOK&&!scene){",
    "  const L=[];\n  if(!scene)E.forEach(e=>{if(e.boss&&!e.dead&&(e.jc>0||e.ja>0))foxMark(ctx,e,ts)});\n  if(tsOK&&!scene){")
# barra/nome da raposa acompanham o salto
rep("ctx.fillRect(e.x-45,e.y-124,90,7);ctx.fillStyle='#e0483a';ctx.fillRect(e.x-44,e.y-123,88*e.hp/e.max,5);",
    "const bz=e.jz||0;ctx.fillRect(e.x-45,e.y-124-bz,90,7);ctx.fillStyle='#e0483a';ctx.fillRect(e.x-44,e.y-123-bz,88*e.hp/e.max,5);")
rep("ctx.strokeText(e.nome,e.x,e.y-130);ctx.fillText(e.nome,e.x,e.y-130)}",
    "ctx.strokeText(e.nome,e.x,e.y-130-bz);ctx.fillText(e.nome,e.x,e.y-130-bz)}")
# efeitos novos: onda de choque e explosão da esfera
rep("  else if(f.k=='rimp'){",
    "  else if(f.k=='shock'){ctx.save();ctx.translate(f.x,f.y);ctx.scale(1,.42);const r=f.r*(.25+.75*Math.min(1,k*1.5));ctx.globalAlpha=a*.4;ctx.fillStyle='#ff8a2a';ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.globalAlpha=a;ctx.lineWidth=7;ctx.strokeStyle='#ffd27a';ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#fff3d0';ctx.beginPath();ctx.arc(0,0,r*.7,0,7);ctx.stroke();ctx.restore();\n   ctx.fillStyle='#8a6a48';for(let i=0;i<10;i++){const t=i*.628+f.x*.01,d=f.r*(.4+k*.9);ctx.globalAlpha=a*.8;ctx.beginPath();ctx.arc(f.x+Math.cos(t)*d,f.y+Math.sin(t)*d*.42-Math.sin(k*3.1)*16,4.5*(1-k)+1,0,7);ctx.fill()}}\n  else if(f.k=='boom'){ctx.save();ctx.globalCompositeOperation='lighter';const r=14+k*34;const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);g.addColorStop(0,'rgba(255,240,200,'+a+')');g.addColorStop(.4,'rgba(255,140,40,'+a*.8+')');g.addColorStop(1,'rgba(255,60,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(f.x,f.y,r,0,7);ctx.fill();ctx.restore()}\n  else if(f.k=='rimp'){")

# ---------- funções da raposa ----------
FOX=r"""//LAND
let shk=0,rotOk=false;const coarse=matchMedia('(pointer:coarse)').matches;
const JC=.55,JA=.62,JH=85,JR=92,JD=26;
function foxJump(e){e.jc=JC;e.jcd=5+Math.random()*1.5;e.bc=Math.max(e.bc,1.6);e.jx=p.x;e.jy=p.y;e.fl=p.x<e.x}
function foxCrouch(e,dt){e.jc-=dt;if(e.jc>.15){e.jx=p.x;e.jy=p.y;e.fl=p.x<e.x}
 if(e.jc<=0){e.jc=0;let tx=e.jx,ty=e.jy;const d=Math.hypot(tx-e.x,ty-e.y),mx=330;if(d>mx){tx=e.x+(tx-e.x)/d*mx;ty=e.y+(ty-e.y)/d*mx}
  for(let i=0;i<12&&sol(tx,ty);i++){tx+=(e.x-tx)*.2;ty+=(e.y-ty)*.2}
  e.sx=e.x;e.sy=e.y;e.jx=tx;e.jy=ty;e.ja=JA;e.jz=0}}
function foxAir(e,dt){e.ja-=dt;const q=Math.min(1,1-e.ja/JA),qq=q*q*(3-2*q);
 e.x=e.sx+(e.jx-e.sx)*qq;e.y=e.sy+(e.jy-e.sy)*qq;e.jz=Math.sin(Math.PI*q)*JH;
 if(e.ja<=0){e.ja=0;e.jz=0;e.x=e.jx;e.y=e.jy;shk=1;
  fx.push({k:'shock',x:e.x,y:e.y,r:JR+10,life:.55,max:.55});
  if(Math.hypot(p.x-e.x,(p.y-e.y)*1.25)<JR){hurt(JD);const a=Math.atan2(p.y-e.y,p.x-e.x);for(let i=0;i<8;i++){const nx=p.x+Math.cos(a)*5,ny=p.y+Math.sin(a)*5;if(!sol(nx,ny)){p.x=nx;p.y=ny}}}
  e.atk=.9}}
function foxMark(c,e,ts){const x=e.ja>0?e.jx:e.jx,y=e.ja>0?e.jy:e.jy,q=e.ja>0?1-e.ja/JA:1-e.jc/JC,pul=.5+.5*Math.sin(ts/70);
 c.save();c.translate(x,y);c.scale(1,.42);c.globalAlpha=.18+.22*q;c.fillStyle='#ff3b1f';c.beginPath();c.arc(0,0,JR,0,7);c.fill();
 c.globalAlpha=.55+.4*pul;c.lineWidth=4;c.strokeStyle='#ff5a2a';c.stroke();
 c.globalAlpha=.6;c.lineWidth=3;c.strokeStyle='#ffd27a';c.beginPath();c.arc(0,0,JR*Math.min(1,q),0,7);c.stroke();c.restore()}
function mapNm(k){const m=MAPS[k]||{};return (m.title||k).replace(/_/g,' ').replace(/(^|\s)\S/g,t=>t.toUpperCase())}
function goFull(){if(!coarse)return;try{const el=document.documentElement,r=el.requestFullscreen||el.webkitRequestFullscreen;if(r&&!document.fullscreenElement){const pr=r.call(el);if(pr&&pr.then)pr.then(()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(_){}}).catch(()=>{})}}catch(_){}}
"""
rep("//MANTO-BEGIN",FOX+"//MANTO-BEGIN")

# ---------- nome bonito dos mapas ----------
s=s.replace("$('#mapbtn').textContent='Mapa: '+CURMAP;","$('#mapbtn').textContent='🗺️ '+mapNm(CURMAP);")
rep("$('#mapbtn').textContent='Mapa: '+k;","$('#mapbtn').textContent='🗺️ '+mapNm(k);")
rep("b.textContent=k;b.className=k==CURMAP?'on':'';","b.textContent=mapNm(k);b.className=k==CURMAP?'on':'';")
rep("b.className='mp'+(k==CURMAP?' on':'');b.textContent=k;","b.className='mp'+(k==CURMAP?' on':'');b.textContent=mapNm(k);")

# ---------- tela cheia/rotação ao começar a partida ----------
rep("d.onclick=()=>start(k);","d.onclick=()=>{goFull();start(k);setTimeout(rs,350)};")

# ---------- personalização em duas colunas ----------
rep('<canvas id="pv" width="200" height="240"></canvas>\n<div class="row">','<div class="cw"><canvas id="pv" width="200" height="240"></canvas><div class="cc">\n<div class="row">')
rep('<button id="go2">Escolher clã</button></div>','<button id="go2">Escolher clã</button></div></div></div>')

# ---------- aviso para girar o celular ----------
rep('<div id="jb"><div id="jk"></div></div>','<div id="rot" hidden><div><div class="ph">📱</div><b>Gire o celular</b><span>O jogo foi feito para jogar com o celular deitado.</span><button id="rotOk">Jogar assim mesmo</button></div></div>\n<div id="jb"><div id="jk"></div></div>')
rep("addEventListener('resize',rs);","addEventListener('resize',rs);$('#rotOk').onclick=()=>{rotOk=true;$('#rot').hidden=true};addEventListener('orientationchange',()=>setTimeout(rs,250));")

CSS="""
/* ---- refinamento + paisagem ---- */
#mapbtn,#bagbtn,#statbtn,#mmList button,#mmX,#mapmenu h3,.ivh button,#inv button{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
#mapbtn,#bagbtn,#statbtn{backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);background:rgba(12,10,20,.5);border-color:rgba(255,255,255,.28);letter-spacing:.01em;min-width:104px;text-align:left}
#mapbtn{right:calc(10px + env(safe-area-inset-right,0px))}#bagbtn{right:calc(10px + env(safe-area-inset-right,0px))}#statbtn{right:calc(10px + env(safe-area-inset-right,0px))}
#hud{left:calc(12px + env(safe-area-inset-left,0px))}
#jb{left:calc(18px + env(safe-area-inset-left,0px));bottom:calc(22px + env(safe-area-inset-bottom,0px))}
#b0{right:calc(112px + env(safe-area-inset-right,0px))}#b1{right:calc(24px + env(safe-area-inset-right,0px))}#b2{right:calc(20px + env(safe-area-inset-right,0px))}
.sb{box-shadow:0 2px 8px #0008,inset 0 0 12px #0006}.sb:active{transform:scale(.94)}
#s-game::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 62%,rgba(0,0,0,.35) 100%);z-index:1}
#hud,#jb,.sb,#mapbtn,#bagbtn,#statbtn{z-index:6}
.cw{display:flex;flex-direction:column;align-items:center}.cc{display:flex;flex-direction:column;align-items:center}
#rot{position:absolute;inset:0;z-index:30;background:rgba(10,8,18,.88);display:flex;align-items:center;justify-content:center;color:#fff;text-align:center;font-family:system-ui,sans-serif;padding:24px}
#rot[hidden]{display:none}
#rot>div{display:flex;flex-direction:column;align-items:center;gap:8px;max-width:300px}
#rot .ph{font-size:54px;animation:rotph 2.2s ease-in-out infinite}
@keyframes rotph{0%,25%{transform:rotate(0)}55%,100%{transform:rotate(-90deg)}}
#rot b{font-size:20px}#rot span{color:#ffffffb0;font-size:14px;line-height:1.4}#rot button{font-size:14px;padding:10px 20px;background:transparent;border:1.5px solid #ffffff80}
@media (orientation:landscape) and (max-height:560px){
 .scr{padding:10px calc(16px + env(safe-area-inset-right,0px)) 10px calc(16px + env(safe-area-inset-left,0px))}
 #s-login h1{font-size:30px}#s-login .m{margin:0 0 8px;font-size:13px}
 #s-login input{padding:9px 12px;margin:3px 0}
 #s-login button#go1{margin-top:8px;padding:10px 32px}
 #s-cust h2,#s-clan h2{margin:0 0 6px;font-size:20px}
 .cw{flex-direction:row;gap:28px}
 #pv{height:min(240px,62vh);width:auto}
 #go2{margin-top:10px}
 #cards{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
 .card{flex-direction:column;text-align:center;width:min(220px,30vw);margin:0;padding:8px 10px;gap:4px}
 .card canvas{height:min(120px,30vh);width:auto}
 .card small{font-size:12px}
 #jb{width:112px;height:112px;bottom:calc(14px + env(safe-area-inset-bottom,0px))}
 #jk{width:46px;height:46px;margin:-23px}
 #b0,#b1{width:56px;height:56px}#b2{width:72px;height:72px;bottom:16px}#b0{bottom:16px;right:calc(100px + env(safe-area-inset-right,0px))}#b1{bottom:98px}
 #mapbtn,#bagbtn,#statbtn{padding:6px 11px;font-size:12px;min-width:96px}
 #bagbtn{top:40px}#statbtn{top:72px}
 #lvup{top:12%}
 #inv .iv{max-height:96%;padding:10px 14px}
}
"""
# criação do personagem: primeiro o clã, depois a aparência (com as informações do clã)
rep('<button id="go2">Escolher clã</button></div></div></div>','</div><div class="cbt"><button id="cback" class="sec" type="button">‹ Trocar de clã</button><button id="go2">Começar</button></div></div></div></div>')
rep('<div class="cw"><canvas id="pv" width="200" height="240"></canvas><div class="cc">','<div class="cw"><div class="cpv"><canvas id="pv" width="200" height="240"></canvas><i class="cped"></i></div><div class="cc"><div id="cinfo"></div><div id="capa"><b>Aparência</b>')
rep('<div class="cw"><canvas id="pv"','<div class="cw"><canvas id="pv"',0) if 0 else None
rep('drawHero(g,25,c.height/s-6,{fl:0,t:ts,mv:k?0:(ts/2500|0)%2,run:0,aura:-1})','drawHero(g,25,c.height/s-6,{fl:0,t:ts,mv:k?0:(ts/2500|0)%2,run:0,aura:-1,clan:k||clan})')
rep(" if(cur=='cust')pv(ts,$('#pv'));"," if(cur=='cust')pv(ts,$('#pv'),pickK);")
rep(" show('cust')};\nfunction sw("," show('clan')};\nfunction sw(")
rep("$('#go2').onclick=()=>show('clan');","""let pickK='';
function skIc(s){return s.imk?`<img src="${SPR[s.imk]}">`:s.im?`<img src="${s.im}">`:s.ic!=null?`<img src="${SPR.ic[s.ic]}">`:`<span>${s.i}</span>`}
function custInfo(k){const C=CLANS[k];$('#cinfo').style.setProperty('--c',C.col);$('#cinfo').innerHTML=`<b>${C.n}</b><small>${C.d}</small><div class="csk">${C.sk.map(s=>`<span class="ski">${skIc(s)}<em>${s.n}</em></span>`).join('')}</div>`}
$('#go2').onclick=()=>{if(!pickK)return show('clan');goFull();start(pickK);setTimeout(rs,350)};
$('#cback').onclick=()=>show('clan');""")
rep("d.onclick=()=>{goFull();start(k);setTimeout(rs,350)};","d.onclick=()=>{pickK=k;custInfo(k);show('cust')};")
i=s.rindex("</style></head>");s=s[:i]+CSS+s[i:]
open(D,'w').write(s)
print('land ok',len(s))
