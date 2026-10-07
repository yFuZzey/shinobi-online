import json,glob,os
D='gerado/base.html'
s=open(D).read()
assert '//MANTO-BEGIN' not in s,'rode build_all.sh (parte da base sem manto)'
def rep(a,b,cnt=1):
    global s
    assert s.count(a)==cnt,(a[:80],s.count(a))
    s=s.replace(a,b)
ky=json.load(open('manto/kyuubi_lv.json'));ky.update(json.load(open('manto/kb_rgba.json')));ky.update(json.load(open('manto/raio.json')))
docs=[json.load(open(f)) for f in sorted(glob.glob('ed/db/items/*.json'))]
items=[]
for d in docs:
    d=d.get('data',d)
    if d.get('id'):items.append({k:d[k] for k in ('id','name','rarity','slot','desc','icon','stats','fx','drop','atk') if k in d})
if not items:items=json.load(open('manto/items_default.json'))
print('itens:',[i['id'] for i in items])
js=open('manto/items.js').read().replace('__KY__',json.dumps(ky,separators=(',',':'))).replace('__FXLIB__',open('manto/fxlib.js').read()).replace('__ITEMS__',json.dumps(items,separators=(',',':'),ensure_ascii=False))
rep('function start(k){',js+'\nfunction start(k){')
rep("e.hp-=d;e.hit=.15;","d=calcDmg(d);e.hp-=d;e.hit=.15;")
rep("FT.push({x:e.x,y:e.y-(e.boss?130:50),t:d,life:.8});","FT.push({x:e.x,y:e.y-(e.boss?130:50),t:lastCrit?d+'!':d,crit:lastCrit,life:.8});")
rep("function hurt(n){p.hp-=n;","function hurt(n){if(Math.random()*100<D().dodge){FT.push({x:p.x,y:p.y-56,t:'esquivou',txt:1,life:.8});return}n=Math.max(1,Math.round(n*(1-D().red/100)));p.hp-=n;")
rep("ctx.fillStyle=f.r?'#ff6b5a':'#fff'","ctx.fillStyle=f.crit||f.gold?'#ffd23f':f.r?'#ff6b5a':'#fff'")
rep("$('#hint').style.opacity=1;setTimeout(()=>$('#hint').style.opacity=0,7000);","")
rep('<div id="hint">Empurre o joystick até o fim para correr. Toque em Ataque para jogar shuriken. A aura só aparece no Sharingan.</div>','<div id="hint" style="opacity:0"></div>')
rep("$('#hn').textContent=name+' · '+C.n;","hnBase=name+' · '+C.n;")
rep(";$('#hk').textContent='Derrotados: 0';",";")
rep('<div id="hk">Derrotados: 0</div>','<div class="bar xpb"><i id="xp"></i><b id="xpt">XP</b></div>')
rep("kills++;$('#hk').textContent='Derrotados: '+kills}}","kills++;if(e.boss)dropItems('boss');gainXp(e.boss?60:10)}}")
rep("p.t=ts;p.run=0;","p.t=ts;p.run=0;if(fxT>=0&&(fxT+=dt)>.9)fxT=-1;")
rep("p.mp=Math.min(100,p.mp+5*dt);p.hp=Math.min(p.max,p.hp+1.2*dt)","p.mp=Math.min(p.mpMax,p.mp+5*dt*MG());p.hp=Math.min(p.max,p.hp+1.2*dt*RG())")
rep("go(p,p.ax,p.ay,run?150:85,dt)","go(p,p.ax,p.ay,(run?150:85)*SPD(),dt)")
rep("L.push({y:p.y,d:()=>{HERO?drawHero(ctx,p.x,p.y,{fl:p.fl,t:ts,mv:p.mv,run:p.run,aura:p.au,th:p.th}):drawChar(ctx,p.x,p.y,{...look,clan,dir:p.dir,t:ts,mv:p.mv,run:p.run});",
    "L.push({y:p.y,d:()=>{const FL=eqFx();fxImpact(ctx,p.x,p.y,fxT,fxK);fxDraw(ctx,p.x,p.y,ts,FL,0);HERO?drawHero(ctx,p.x,p.y,{fl:p.fl,t:ts,mv:p.mv,run:p.run,aura:p.au,th:p.th}):drawChar(ctx,p.x,p.y,{...look,clan,dir:p.dir,t:ts,mv:p.mv,run:p.run});fxDraw(ctx,p.x,p.y,ts,FL,1,{fl:p.fl});")
rep('<div class="bar"><i id="hp"></i></div><div class="bar"><i id="mp"></i></div>','<div class="bar hpb"><i class="gh" id="hpg"></i><i id="hp"></i><b id="hpt">HP</b></div><div class="bar mpb"><i id="mp"></i><b id="mpt">Chakra</b></div>')
rep("$('#hp').style.width=p.hp/p.max*100+'%';$('#mp').style.width=p.mp+'%';","hudUpd(dt)")
rep("function start(k){","""let _hn='',_xt='',_ht='',_mt='',_gv=100,_gt=0,_lp=100;
function hudUpd(dt){const hp=Math.max(0,Math.ceil(p.hp)),pc=Math.max(0,Math.min(100,p.hp/p.max*100)),mp=Math.max(0,Math.floor(p.mp));
 $('#hp').style.width=pc+'%';if(pc<_lp-.4)_gt=.4;_lp=pc;if(pc>=_gv)_gv=pc;else if(_gt>0)_gt-=dt;else _gv=Math.max(pc,_gv-45*dt);$('#hpg').style.width=_gv+'%';$('#mp').style.width=Math.min(100,p.mp/p.mpMax*100)+'%';const need=xpNeed(CH.lv),hn=hnBase+' · Nv '+CH.lv;if(hn!==_hn){_hn=hn;$('#hn').textContent=hn}$('#xp').style.width=(CH.lv>=LVMAX?100:CH.xp/need*100)+'%';const xt=CH.lv>=LVMAX?'XP máx.':'XP  '+CH.xp+' / '+need;if(xt!==_xt){_xt=xt;$('#xpt').textContent=xt}
 const a='HP  '+hp+' / '+p.max,m='Chakra  '+mp+' / '+p.mpMax;if(a!==_ht){_ht=a;$('#hpt').textContent=a}if(m!==_mt){_mt=m;$('#mpt').textContent=m}
 $('.hpb').classList.toggle('low',pc<25)}
function start(k){""")
rep("if(m>.15){const run=m>.8||keys.shift;","if(p.dash){dashStep(dt)}else if(m>.15){const run=m>.8||keys.shift;")
rep("const s=CLANS[clan].sk[i];if(cd[i]>0||p.mp<s.mp)return;","const s=CLANS[clan].sk[i];if(cd[i]>0||p.mp<mpOf(i,s)){if(i==0&&atkItem()&&cd[0]<=0&&p.mp<mpOf(0,s))FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}")
rep("cd[i]=s.cd;p.mp-=s.mp;","cd[i]=cdOf(i,s);p.mp-=mpOf(i,s);")
rep("cd[i]/s.cd*100+'%';b.classList.toggle('off',p.mp<s.mp)","cd[i]/cdOf(i,s)*100+'%';b.classList.toggle('off',p.mp<mpOf(i,s))")
rep("ctx.strokeText('-'+f.t,f.x,f.y);ctx.fillText('-'+f.t,f.x,f.y)","ctx.strokeText((f.txt?'':'-')+f.t,f.x,f.y);ctx.fillText((f.txt?'':'-')+f.t,f.x,f.y)")
rep("if(s.t=='proj'){const n=s.fan||1;","if(i==0&&atkItem()){castAtk(ax,ay);return}\n  if(s.t=='proj'){const n=s.fan||1;")
rep("else{ctx.globalAlpha=a;ctx.strokeStyle=f.col;ctx.lineWidth=9;","else if(f.k=='rimp'){fxImpact(ctx,f.x,f.y+4,Math.min(.85,k*.95),'raio',.95)}\nelse if(f.k=='bolt'){fxBolt(ctx,f.x,f.y,f.x2,f.y2,ts,a*1.2);if(f.hit)fxImpact(ctx,f.x2,f.y2+6,Math.min(.85,k*.9),'raio',.6)}\nelse{ctx.globalAlpha=a;ctx.strokeStyle=f.col;ctx.lineWidth=9;")
rep("else if(cur=='game')step(dt,ts);","else if(cur=='game'&&!invOpen)step(dt,ts);")
rep("autoOn=true;C.sk.forEach","b0orig=$('#b0').innerHTML;invLoad();chLoad();stats();stRefresh();toggleBag(false);$('#drop').hidden=true;$('#bagbtn').classList.remove('new');bagRefresh();fxT=-1;autoOn=true;C.sk.forEach")
rep('<button id="mapbtn" aria-label="Escolher mapa"></button>','<button id="mapbtn" aria-label="Escolher mapa"></button>\n<button id="bagbtn" aria-label="Mochila">🎒 Mochila</button>\n<button id="statbtn" aria-label="Status">📊 Status<i id="stBadge" hidden>0</i></button>\n<div id="drop" hidden><small>Item obtido!</small><span></span><em>toque para abrir a mochila</em></div>\n<div id="lvup" hidden><small>Você subiu de nível!</small><span></span><em></em></div>\n<div id="inv" hidden><div class="iv"><div class="ivh"><div class="tabs"><button id="tbBag" class="on">🎒 Mochila</button><button id="tbSt">📊 Status</button></div><button id="ivX">Fechar</button></div><div id="paneBag"><div class="ivb"><div class="ivl"><div class="ivt">Equipado</div><div id="ivEq"></div><div class="ivt">Itens</div><div id="ivGrid"></div></div><div class="ivr" id="ivDet"></div></div><div class="ivf"><button id="ivGive">Dar todos os itens (teste)</button><button id="ivReset">Zerar mochila (teste)</button></div></div><div id="paneSt" hidden><div class="stTop"><b id="stLv">Nível 1</b><span id="stPts">Pontos disponíveis: 0</span></div><div class="bar xpb big"><i id="stXp"></i><b id="stXpT">XP</b></div><div id="stRows"></div><div class="ivt">Atributos derivados</div><div id="stDer"></div><div class="ivf"><button id="stXpB">+100 XP (teste)</button><button id="stLvB">+1 nível (teste)</button><button id="stRed">Redistribuir pontos</button><button id="stZero">Zerar personagem (teste)</button></div></div></div></div>')
CSS="""#hud{width:210px}
.bar{position:relative;height:18px;margin-top:5px;border-radius:9px;background:linear-gradient(#000a,#000d);border:1.5px solid rgba(255,255,255,.4);box-shadow:0 1px 3px #000a,inset 0 1px 3px #000}
.bar i{position:absolute;left:0;top:0;bottom:0;height:auto;border-radius:9px;transition:width .12s}
#hp{background:linear-gradient(#ff8a7a,#e0483a 55%,#9c2219)}
#mp{background:linear-gradient(#8ccaff,#3a8be0 55%,#1f4f9f)}
.bar i::after{content:'';position:absolute;left:5px;right:5px;top:2px;height:4px;border-radius:3px;background:rgba(255,255,255,.32)}
.bar .gh{background:#ffe9b0;opacity:.75;transition:none}.bar .gh::after{display:none}
.bar b{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;font:700 11px/1 system-ui,sans-serif;letter-spacing:.03em;text-shadow:0 1px 2px #000,0 0 3px #000;font-variant-numeric:tabular-nums;white-space:pre}
.hpb.low{animation:lowhp .7s infinite alternate}
@keyframes lowhp{to{border-color:#ff5a4a;box-shadow:0 0 8px #ff3b2a}}
#hint{padding-left:220px!important}
#bagbtn{position:absolute;right:10px;top:44px;z-index:6;margin:0;padding:7px 12px;font-size:13px;border-radius:16px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:600}
#bagbtn.new{border-color:#ff9a2a;box-shadow:0 0 12px #ff7a1a;animation:bagp 1s infinite alternate}
@keyframes bagp{to{box-shadow:0 0 2px #ff7a1a}}
#statbtn{position:absolute;right:10px;top:80px;z-index:6;margin:0;padding:7px 12px;font-size:13px;border-radius:16px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:600}
#statbtn i{display:inline-block;min-width:18px;height:18px;line-height:18px;margin-left:6px;border-radius:9px;background:#ffc94a;color:#2a1600;font-style:normal;font-size:11px;font-weight:800;text-align:center}
#statbtn i[hidden]{display:none}
#statbtn.new{border-color:#ffc94a;box-shadow:0 0 12px #ffb62a;animation:stp 1s infinite alternate}
@keyframes stp{to{box-shadow:0 0 2px #ffb62a}}
#lvup{position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:7;text-align:center;padding:12px 26px;border-radius:14px;background:rgba(30,20,2,.9);border:2px solid #ffc94a;box-shadow:0 0 24px #ffc94a99;color:#fff;font-family:system-ui,sans-serif;cursor:pointer;max-width:86vw;animation:lvin .5s}
@keyframes lvin{from{transform:translateX(-50%) scale(.6);opacity:0}}
#lvup[hidden]{display:none}
#lvup small{display:block;color:#ffd978;letter-spacing:.12em;text-transform:uppercase;font-size:11px}
#lvup span{display:block;font-size:26px;font-weight:800;color:#ffe49a;margin:2px 0}
#lvup em{display:block;font-size:12px;color:#ffffffbb;font-style:normal}
.xpb{height:11px;margin-top:4px}
.xpb i{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:9px;background:linear-gradient(#ffe38a,#e9a21c 60%,#b8760a);box-shadow:0 0 6px #ffc94a88;transition:width .4s}
.xpb b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:8px;line-height:1;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;letter-spacing:.04em;font-weight:700}
.xpb.big{height:20px;margin:6px 0 12px}.xpb.big b{font-size:12px}
.tabs{display:flex;gap:6px}.tabs button{padding:7px 14px;opacity:.65}.tabs button.on{opacity:1;border-color:#ffc94a;box-shadow:0 0 0 1px #ffc94a inset}
.stTop{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px}.stTop b{font-size:20px}
#stPts{font-size:13px;color:var(--mute)}#stPts.has{color:#ffc94a;font-weight:700}
.strow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}
.strow .sn{flex:1;min-width:0;font-size:14px}.strow .sn b{display:inline-block;min-width:34px;color:#ffc94a}
.strow .sn small{display:block;font-size:11px;color:var(--mute);line-height:1.3}
.strow .sv{font-size:20px;font-weight:800;min-width:30px;text-align:right;font-variant-numeric:tabular-nums}
#inv .strow .sp{width:38px;height:38px;padding:0;font-size:20px;font-weight:800;border-radius:10px;flex:0 0 auto}
.strow .sp:not(:disabled){border-color:#ffc94a;color:#ffc94a}.strow .sp:disabled{opacity:.3}
#stRows{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}
@media(max-width:560px){#stRows{grid-template-columns:1fr}}
.ivh{position:sticky;top:-12px;background:var(--panel);z-index:2;padding:4px 0;margin-top:-4px}
.strow{padding:5px 0}
#stDer{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 14px}
#stDer div{display:flex;justify-content:space-between;font-size:13px;border-bottom:1px dotted var(--line);padding:2px 0}#stDer span{color:var(--mute)}
#drop{position:absolute;left:50%;top:26%;transform:translateX(-50%);z-index:7;text-align:center;padding:12px 22px;border-radius:14px;background:rgba(20,8,4,.88);border:2px solid #ff9a2a;box-shadow:0 0 22px #ff7a1a99;color:#fff;font-family:system-ui,sans-serif;cursor:pointer;max-width:86vw}
#drop[hidden]{display:none}
#drop small{display:block;color:#ffb35c;letter-spacing:.12em;text-transform:uppercase;font-size:11px}
#drop span{display:block;font-size:20px;font-weight:700;margin:2px 0}
#drop em{display:block;font-size:11px;color:#ffffffaa;font-style:normal}
#inv{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}
#inv[hidden]{display:none}
#inv .iv{background:var(--panel);color:var(--ink);border:2px solid var(--line);border-radius:14px;padding:12px;width:min(680px,94vw);max-height:94%;overflow:auto;text-align:left;font-family:system-ui,sans-serif}
.ivh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.ivh b{font-size:18px}
#inv button{margin:0;font-size:14px}
.ivh button,.ivf button{padding:7px 14px}
.ivb{display:flex;flex-wrap:wrap;gap:14px}.ivl{flex:0 0 auto}.ivr{flex:1 1 200px;min-width:0}
.ivt{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);margin:6px 0 4px}
#ivGrid{display:grid;grid-template-columns:repeat(4,52px);gap:6px}
#ivEq{display:grid;grid-template-columns:repeat(5,52px);gap:6px}
.es{display:flex;flex-direction:column;align-items:center;gap:2px}.es small{font-size:10px;color:var(--mute)}
.sl{width:52px;height:52px;padding:0;border-radius:8px;border:2px solid var(--line);background:#150a08;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sl img{width:84%;height:84%;object-fit:contain}
.sl small{font-size:10px;color:var(--mute)}.sl.big{border-style:dashed}.sl.has{border-style:solid}.sl.sel{box-shadow:0 0 0 2px #fff,0 0 10px #ff7a1a}
.dn{font-size:17px;font-weight:700}.dr{font-size:12px;color:var(--mute);margin:2px 0 8px}
.ivr p{margin:0 0 8px;font-size:13px;line-height:1.4}.ivr ul{margin:0 0 10px;padding-left:18px;font-size:13px;line-height:1.5}
.ivr .dm{color:var(--mute)}#ivAct{padding:10px 20px;font-size:15px;border-color:#ff9a2a}
.ivf{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.ivf button{font-size:12px;opacity:.75}
"""
i=s.rindex("</style></head>");s=s[:i]+CSS+s[i:]
open(D,'w').write(s)
print('ok',len(s))
