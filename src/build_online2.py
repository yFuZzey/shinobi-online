# Etapa 4: modo online com servidor de jogo. Uso: python3 build_online2.py ENTRADA SAIDA [SUPA_URL SUPA_KEY SERVIDOR_URL]
import sys,json,os
src,dst=sys.argv[1],sys.argv[2]
url=sys.argv[3] if len(sys.argv)>3 else '__SUPA_URL__'
key=sys.argv[4] if len(sys.argv)>4 else '__SUPA_KEY__'
gs=sys.argv[5] if len(sys.argv)>5 else '__GS_URL__'
s=open(src).read()
assert '//ONLINE-BEGIN' not in s
# ---- números de balanceamento: server/balanceamento.json (o servidor lê o mesmo arquivo)
BALF=os.environ.get('BALANCEAMENTO',os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','server','balanceamento.json'))
BAL=json.load(open(BALF))
def _need(path,kind=(int,float)):
    v=BAL
    for k in path.split('.'):
        assert isinstance(v,dict) and k in v,'balanceamento.json: falta '+path
        v=v[k]
    ok=isinstance(v,kind) if kind in (dict,list) else (isinstance(v,(int,float)) and not isinstance(v,bool))
    assert ok,'balanceamento.json: '+path+' com tipo errado'
    return v
for _p in ['combate.esquivaBase','combate.esquivaMin','combate.esquivaMax','combate.critMult','combate.reducaoMax','combate.olharMinimo','combate.olharChefe',
  'personagem.nivelMax','personagem.pontosPorNivel','personagem.xpBase','personagem.xpExpoente','personagem.atributoMax','personagem.statusMax','personagem.regenChakra','personagem.regenVida',
  'golpes.kaitenAtordoa','golpes.hakkeTotal','olhos.susanooDreno','olhos.mangekyoRecarga']:_need(_p)
for _p in ['personagem.atributos','proficiencia.tipos','golpes.ranks','golpes.clas','golpes.tipos','olhos.susanoo','jutsus']:_need(_p,dict)
for _p in ['proficiencia.ranks','olhos.tomoe']:_need(_p,list)
assert len(BAL['olhos']['tomoe'])==4,'balanceamento.json: olhos.tomoe precisa de 4 estágios'
for _c in ('uchiha','hyuga','nara'):assert len(BAL['golpes']['clas'][_c])==3 and len(BAL['golpes']['tipos'][_c])==3,'balanceamento.json: golpes de '+_c
for _k in ('itachi','sasuke','madara'):assert _k in BAL['olhos']['susanoo'],'balanceamento.json: Susanoo '+_k
for _k in ('hp','mp','pf','pc','spd','mpr','crit','esq','prec','red','cdr'):assert _k in BAL['personagem']['atributos'],'balanceamento.json: atributo '+_k
def rep(a,b,n=1):
    global s
    c=s.count(a)
    assert c==n,(c,a[:90])
    s=s.replace(a,b)
rep("<script>\nconst $=s=>document.querySelector(s);","<script>\nconst BAL="+json.dumps(BAL,ensure_ascii=False,separators=(',',':'))+"; // server/balanceamento.json\nconst SAVE_V=1; // versão do formato do personagem salvo (sobe junto com uma migração em chMigra)\nconst $=s=>document.querySelector(s);")
rep("const LVMAX=99,PTS_LV=5,xpNeed=l=>Math.round(80*Math.pow(l,1.4));","const LVMAX=BAL.personagem.nivelMax,PTS_LV=BAL.personagem.pontosPorNivel,xpNeed=l=>Math.round(BAL.personagem.xpBase*Math.pow(l,BAL.personagem.xpExpoente));")
rep("b.disabled=CH.pts<1||CH.st[k]>=99;","b.disabled=CH.pts<1||CH.st[k]>=BAL.personagem.atributoMax;")
rep("b.onclick=()=>{if(CH.pts<1||CH.st[k]>=99)return;","b.onclick=()=>{if(CH.pts<1||CH.st[k]>=BAL.personagem.atributoMax)return;")
# save antigo passa pelas migrações (chMigra, em online2.js) antes de ser lido
rep("function chLoad(){CH=chNew();try{const j=JSON.parse(localStorage.getItem(chKey())||'null');if(j){","function chLoad(){CH=chNew();try{let j=JSON.parse(localStorage.getItem(chKey())||'null');if(j){j=chMigra(j);")

LOGIN='''<div id="s-login" class="scr on">
<svg class="lgdune" viewBox="0 0 800 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 C120 70 230 80 330 115 S560 150 800 95 V200 H0Z" fill="#7a4a2c"/><path d="M0 155 C150 115 300 125 420 150 S650 170 800 140 V200 H0Z" fill="#a8693a"/><path d="M0 185 C200 160 380 168 520 182 S700 192 800 178 V200 H0Z" fill="#c98b4f"/></svg>
<div class="lgwrap">
 <div class="lgbrand"><div class="lgseal">忍</div><h1>Shinobi Online</h1><p>Mundo ninja online · comece na Vila da Areia</p></div>
 <div class="lgcard">
  <div class="lgtabs" role="tablist"><button id="tabIn" class="on" role="tab">Entrar</button><button id="tabNew" role="tab">Criar conta</button></div>
  <form id="fIn" class="lgf" autocomplete="on" novalidate onsubmit="return false">
   <label class="fl"><input id="u" placeholder="Nome de usuário" maxlength="14" autocomplete="username" autocapitalize="off" spellcheck="false"></label>
   <label class="fl pw"><input id="p" type="password" placeholder="Senha" autocomplete="current-password"><button type="button" class="eye" data-for="p" aria-label="Mostrar senha">mostrar</button></label>
   <label class="ck"><input type="checkbox" id="keep"><span>Manter conectado</span></label>
   <button id="go1" type="submit">Entrar</button>
  </form>
  <form id="fNew" class="lgf" autocomplete="off" novalidate onsubmit="return false" hidden>
   <label class="fl"><input id="nu" placeholder="Nome de usuário" maxlength="14" autocapitalize="off" spellcheck="false"><small id="lgHu">3 a 14 letras, números ou _</small></label>
   <label class="fl pw"><input id="np" type="password" placeholder="Senha" autocomplete="new-password"><button type="button" class="eye" data-for="np" aria-label="Mostrar senha">mostrar</button><small id="lgHp">Mínimo de 8 caracteres</small></label>
   <label class="fl"><input id="ne" type="email" placeholder="E-mail de recuperação" autocapitalize="off" spellcheck="false" inputmode="email"></label>
   <button id="goNew" type="submit">Criar conta</button>
  </form>
  <p id="err" class="m" role="status"></p>
  <button id="goOff" class="lnk" type="button">Jogar offline</button>
  <p id="lgVer" class="lgver"></p>
 </div>
</div>
<div id="maps" class="m" style="display:none"></div>
</div>'''
# tela de login
rep('''<div id="s-login" class="scr on">
<h1>忍 Shinobi Online</h1><p class="m">Protótipo jogável. O servidor online vem depois, então qualquer login funciona.</p>
<div id="maps" class="m"></div>
<input id="u" placeholder="Usuário" maxlength="14" autocomplete="off">
<input id="p" type="password" placeholder="Senha">
<button id="go1">Entrar</button><p id="err" class="m"></p>
</div>''',LOGIN)
# HUD: contador online + chat
rep('<div class="bar xpb"><i id="xp"></i><b id="xpt">XP</b></div>','<div class="bar xpb"><i id="xp"></i><b id="xpt">XP</b></div><div id="onl" hidden></div><div id="phud"></div><div id="chatrow"><button id="chatbtn" aria-label="Chat" hidden>💬</button><div id="chatlog" hidden></div></div>')
rep('<div id="rot" hidden>','''<div id="chatp" hidden><div class="cph"><button id="tabC" class="on">💬 Conversa</button><button id="tabR">📜 Registro<i id="regB" hidden></i></button><button id="chatX" aria-label="Fechar">✕</button></div><div id="cpList"></div><div id="cpIn"><div class="chs"><button data-ch="l" class="on">Local</button><button data-ch="g">Grupo</button><button data-ch="m">Mapa</button></div><div class="cpr"><input id="chatin" maxlength="80" placeholder="Mensagem…" autocomplete="off" enterkeyhint="send"><button id="chatgo">Enviar</button></div></div></div>
<div id="toast" hidden></div>
<button id="grpbtn" aria-label="Grupo" hidden>👥 Grupo</button>
<div id="grp" hidden><div class="gp"><div class="gph"><b>Grupo</b><button id="grpX">Fechar</button></div>
<p class="gpd">Convide quem está perto de você. Em grupo, o dano de todos soma na luta contra a raposa, e cada membro ganha a recompensa.</p><p class="gpd admo">[ADM] Lista: até 10 tiles · recompensa por maior dano somado · XP e chance de item para cada membro no mapa · chat Local: 15 tiles.</p>
<div class="gpt">Seu grupo</div><p id="grpNone" class="gpe">Você ainda não está em um grupo. Convide alguém da lista abaixo.</p><div id="grpMem"></div><button id="grpLeave" class="sec" hidden>Sair do grupo</button>
<div class="gpt">Jogadores próximos</div><p id="grpMapNone" class="gpe">Ninguém por perto. Chegue perto de alguém para convidar.</p><div id="grpMap"></div></div></div>
<div id="pinv" hidden><span></span><div><button id="pinvOk">Aceitar</button><button id="pinvNo" class="sec">Recusar</button></div></div>
<div id="netbar" hidden>Reconectando ao servidor…</div>
<div id="otabar" hidden><span></span><button>Atualizar agora</button></div>
<div id="netblock" hidden><div><b></b><span></span><button>Voltar ao início</button></div></div>
<div id="rot" hidden>''')
rep('<button id="stZero">Zerar personagem (teste)</button>','<button id="stZero">Zerar personagem (teste)</button><button id="stOut">Sair da conta</button>')

# sprite personalizado por jogador (cores de pele/cabelo/roupa de cada um)
rep("function tint(){const sk=look.skin","function tint(){HERO=tintSet(look)}\nfunction tintSet(look){const sk=look.skin")
rep("SREF=[232,160,116];HERO={};","SREF=[232,160,116];const HERO={};")
rep("g.putImageData(d,0,0);return c})}","g.putImageData(d,0,0);return c});return HERO}")
rep(" if(!HERO)return;let k,f;"," const HS=o.set||HERO;if(!HS)return;let k,f;")
rep(" const im=HERO[k][f],sc=SPR.sc;"," const im=HS[k][f],sc=SPR.sc;")
# monstros controlados pelo servidor
rep("drawChar(ctx,e.x,e.y,{skin:'#d9a97f',hair:'#222',cloth:'#6a3030',band:'#8b1e1e',dir:e.dir,t:ts+e.id*300,mv:e.mv,run:0})","drawMob(e,ts)")
rep("E.forEach(e=>{if(scene||(e.dead&&!(e.boss&&fxOK)))return;L.push(","E.forEach(e=>{if(scene||(e.dead&&!(e.boss&&fxOK)&&!(e.kind==='mob'&&e.dt<1.4)))return;L.push(")
rep("   else if(e.hp<e.max){ctx.fillStyle='#000a';ctx.fillRect(e.x-13,e.y-46,26,4);ctx.fillStyle='#e0483a';ctx.fillRect(e.x-12,e.y-45,24*e.hp/e.max,2)}","   else mobLabel(e)")
rep("if(!scene)E.forEach(e=>{\n  if(e.dead){e.dt=","if(!scene&&ONL.on)gsMobFollow(dt);\n if(!scene&&!ONL.on)E.forEach(e=>{\n  if(e.dead){e.dt=")
rep("function hitE(e,d,st,kx,ky){\n d=calcDmg(d);","function hitE(e,d,st,kx,ky){\n if(gsHit(e,d,st,kx,ky))return;d=calcDmg(d);")
rep("if(Math.hypot(p.x-b.x,p.y-24-b.y)<22){hurt(30)","if(!b.sv&&Math.hypot(p.x-b.x,p.y-24-b.y)<22){hurt(30)")
# ---- fluidez ----
# câmera anda em pixels reais da tela (antes pulava de 1 em 1 pixel do mundo = ~3 pixels da tela, dando tranco)
rep("let cx=Math.max(0,Math.min(N*T-w,p.x-w/2))|0,cy=Math.max(0,Math.min(N*T-h,p.y-h/2))|0;if(shk>0){cx+=(Math.random()-.5)*shk*14|0;cy+=(Math.random()-.5)*shk*14|0;",
    "const _q=dpr*z;let cx=Math.round(Math.max(0,Math.min(N*T-w,p.x-w/2))*_q)/_q,cy=Math.round(Math.max(0,Math.min(N*T-h,p.y-h/2))*_q)/_q;if(shk>0){cx+=Math.round((Math.random()-.5)*shk*14*_q)/_q;cy+=Math.round((Math.random()-.5)*shk*14*_q)/_q;")
# resolução máxima ajustável (o modo online baixa sozinho se o aparelho não aguentar)
rep("function rs(){if(!cv.clientWidth)return;dpr=Math.min(2,devicePixelRatio||1);","function rs(){if(!cv.clientWidth)return;dpr=Math.min(window.DPRMAX||2,devicePixelRatio||1);")
# laço do jogo
rep('function step(dt,ts){','function step(dt,ts){onlStep(dt);')
rep("ctx.strokeText(name,p.x,p.y-62);ctx.fillText(name,p.x,p.y-62)}});","{const lb=(ONL.adm?'[ADM] ':'')+name;if(ONL.adm)ctx.fillStyle='#ffd23f';ctx.strokeText(lb,p.x,p.y-62);ctx.fillText(lb,p.x,p.y-62)}}});onlDraw(L,ts);susL(L);")
# botões de teste só para admin
rep('<button id="ivGive">','<button id="ivGive" class="admo">')
rep('<button id="ivReset">','<button id="ivReset" class="admo">')
rep('<button id="stXpB">','<button id="stXpB" class="admo">')
rep('<button id="stLvB">','<button id="stLvB" class="admo">')
rep('<button id="stRed">','<button id="stRed" class="admo">')
rep('<button id="stZero">','<button id="stZero" class="admo">')
# projéteis de outros jogadores são só visuais
rep("for(const e of E)if(!e.dead&&Math.hypot(e.x-b.x,e.y-(e.boss?44:16)-b.y)<(e.rad||18)){hitE","for(const e of (b.rm?E:E.concat(PVT())))if(!b.rm&&!e.dead&&Math.hypot(e.x-b.x,e.y-(e.boss?44:16)-b.y)<(e.rad||18)){hitE")
# ---- proficiência ----
rep("const chNew=()=>({lv:1,xp:0,pts:0,st:{str:0,agi:0,vit:0,int:0,dex:0,luk:0}});","const chNew=()=>({lv:1,xp:0,pts:0,st:{str:0,agi:0,vit:0,int:0,dex:0,luk:0},prof:{k:null,xp:0},mgk:null,v:SAVE_V});")
rep("for(const k in CH.st)CH.st[k]=Math.max(0,Math.min(99,+(j.st&&j.st[k])||0))}}catch(e){}}","for(const k in CH.st)CH.st[k]=Math.max(0,Math.min(BAL.personagem.atributoMax,+(j.st&&j.st[k])||0));CH.prof=profNorm(j.prof);CH.mgk=EYES[j.mgk]?j.mgk:null;CH.v=Math.max(SAVE_V,+j.v||1)}}catch(e){}}")
rep("const mpOf=(i,s)=>{const a=i==0?atkItem():null;return a?(+a.atk.mp||0):s.mp};","const mpOf=(i,s)=>{const a=i==3?atkItem():null;return Math.round((a?(+a.atk.mp||0):s.mp)*profMp(i))};")
rep("const cdOf=(i,s)=>{const a=i==0?atkItem():null;return Math.max(.2,(a?+a.atk.cd||s.cd:s.cd)*CDM())};","const cdOf=(i,s)=>{const a=i==3?atkItem():null;return Math.max(.2,(a?+a.atk.cd||s.cd:s.cd)*CDM()*profCd(i))};")
rep("col:s.col,dmg:s.dmg,life:1,big:s.dmg>10,spin:s.spin})","col:s.col,dmg:s.dmg,life:1,big:s.dmg>10,spin:s.spin,tp:HTP})")
rep("{hitE(e,b.dmg,0,b.vx*.03,b.vy*.03);return 0}","{HTP=b.tp||null;hitE(e,b.dmg,0,b.vx*.03,b.vy*.03);HTP=null;if(b.fire)fireBoom(b);return 0}")
rep("p.dash={sx:p.x,sy:p.y,tx,ty,t:0,dur:Math.max(.1,Math.min(.28,dist/650)),dmg,area};","p.dash={sx:p.x,sy:p.y,tx,ty,t:0,dur:Math.max(.1,Math.min(.28,dist/650)),dmg,area,tp:HTP||'@ninjutsu'};")
rep("if(dd<d.area+(e.rad||0)*.65){const u=dd||1;hitE(e,d.dmg,.7,dx/u*9,dy/u*9)}","if(dd<d.area+(e.rad||0)*.65){const u=dd||1;HTP=d.tp;hitE(e,d.dmg,.7,dx/u*9,dy/u*9);HTP=null}")
rep('<div class="ivt">Atributos derivados</div><div id="stDer"></div>','<div class="ivt">Atributos derivados</div><div id="stDer"></div><div class="ivt">Proficiência</div><div id="stProf"></div>')
rep("const bd=$('#stBadge');bd.hidden=CH.pts<1;bd.textContent=CH.pts;$('#statbtn').classList.toggle('new',CH.pts>0)}","const bd=$('#stBadge');bd.hidden=CH.pts<1;bd.textContent=CH.pts;$('#statbtn').classList.toggle('new',CH.pts>0);profDraw()}")
# ---- proficiência com vantagens/desvantagens, aba Personagem e mochila nova ----
rep("function D(){const s=CH.st;return{hp:Math.max(20,100+AG.hp_max+s.vit*8),mp:Math.max(20,100+AG.mp_max+s.int*6),dmg:AG.dmg_pct+s.str*3,spd:AG.speed_pct+s.agi,dodge:Math.min(30,s.agi*.5),red:Math.min(40,s.vit*.5),crit:Math.min(50,s.luk*.7),cdr:Math.min(40,s.dex),mpr:AG.regen_pct+s.int*2}}","function D(){return DX(1,1)}")
rep('<div class="tabs"><button id="tbBag" class="on">🎒 Mochila</button><button id="tbSt">📊 Status</button></div>','<div class="tabs"><button id="tbBag" class="on">🎒 Mochila</button><button id="tbCh">🥷 Personagem</button><button id="tbSt">📊 Status</button></div>')
rep('<div id="paneBag"><div class="ivb"><div class="ivl"><div class="ivt">Equipado</div><div id="ivEq"></div><div class="ivt">Itens</div><div id="ivGrid"></div></div><div class="ivr" id="ivDet"></div></div>',
    '<div id="paneBag"><div class="bg3"><div class="bgdoll"><div class="ivt">Equipado</div><div class="doll"><div class="dcol" id="dollL"></div><canvas id="dollCv" width="240" height="392"></canvas><div class="dcol" id="dollR"></div></div><div id="eqSum" class="eqsum"></div><div id="ivEq" hidden></div></div>'
    '<div class="bgbag"><div class="bgh"><div class="ivt">Mochila <span id="bagCnt"></span></div><button id="bagSort" type="button">Organizar</button></div><div id="ivGrid"></div></div><div class="ivr" id="ivDet"></div></div>')
rep('<div id="paneSt" hidden>','<div id="paneCh" hidden></div><div id="paneSt" hidden>')
rep("function setPanel(w){panel=w;$('#paneBag').hidden=w!=='bag';$('#paneSt').hidden=w!=='st';$('#tbBag').classList.toggle('on',w==='bag');$('#tbSt').classList.toggle('on',w==='st');if(w==='st')stRefresh()}",
    "function setPanel(w){panel=w;$('#paneBag').hidden=w!=='bag';$('#paneSt').hidden=w!=='st';$('#paneCh').hidden=w!=='ch';$('#tbBag').classList.toggle('on',w==='bag');$('#tbSt').classList.toggle('on',w==='st');$('#tbCh').classList.toggle('on',w==='ch');if(w==='st')stRefresh();if(w==='ch')chDraw();portraitStart()}")
# Status: mostra o valor final ao lado dos pontos quando itens/especialidade mudam
rep("<span class=\"sv\">'+CH.st[k]+'</span>","<span class=\"sv\">'+CH.st[k]+stFinTxt(k)+'</span>")
# golpe = (dano da habilidade + Poder do tipo) × especialidade × crítico (o jogo online calcula em gsHit; aqui fica igual)
rep("function calcDmg(d){const x=(d+AG.dmg_flat)*(1+D().dmg/100);lastCrit=Math.random()*100<D().crit;return Math.max(1,Math.round(lastCrit?x*2:x))}",
    "function calcDmg(d){const x=hitRaw(d,HTP);lastCrit=Math.random()*100<D().crit;return Math.max(1,Math.round(lastCrit?x*BAL.combate.critMult:x))}")
rep("['Dano',(d.dmg>=0?'+':'')+f(d.dmg)+'%']","['Poder físico',f(d.pf)],['Poder de chakra',f(d.pc)]")
rep("['str','STR','Força','+3% de dano por ponto']","['str','STR','Força','+1 de poder físico por ponto (golpes de Taijutsu e Bukijutsu)']")
rep("['int','INT','Inteligência','+6 de chakra máximo e +2% de regeneração de chakra por ponto']","['int','INT','Inteligência','+1 de poder de chakra (Ninjutsu e Genjutsu), +6 de chakra máximo e +2% de regeneração por ponto']")
# esquiva: chance contra a precisão de quem bateu (vem na mensagem "hurt")
rep("function hurt(n){if(Math.random()*100<D().dodge)","function hurt(n){if(Math.random()*100<dodgeChance(HPREC))")
rep("['Esquiva',f(d.dodge)+'%']","['Esquiva',f(d.esq)],['Precisão',f(d.prec)]")
# PvP: o golpe recebido conta o resultado (esquivou / dano / derrotado) para devolver ao servidor
rep("function hurt(n){if(Math.random()*100<dodgeChance(HPREC)){FT.push({x:p.x,y:p.y-56,t:'esquivou',txt:1,life:.8});return}n=Math.max(1,Math.round(n*(1-D().red/100)));p.hp-=n;",
    "function hurt(n){HRES={miss:0,d:0,dead:0};if(kaitenGuard()){HRES.miss=1;FT.push({x:p.x,y:p.y-62,t:'defendeu',txt:1,life:.8});return}if(Math.random()*100<dodgeChance(HPREC)){HRES.miss=1;FT.push({x:p.x,y:p.y-56,t:'esquivou',txt:1,life:.8});return}n=Math.max(1,Math.round(n*(1-D().red/100)));p.hp-=n;HRES.d=n;")
rep(" if(p.hp<=0){p.hp=p.max;scene=0;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;flash={col:'#000',a:.6}}}"," if(p.hp<=0){HRES.dead=1;p.hp=p.max;scene=0;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;flash={col:'#000',a:.6}}}")
# PvP: jogadores fora do grupo entram nas mesmas contas de mira e acerto dos golpes
rep(" E.forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;tg=e}});\n if(tg){const d=best||1;ax="," E.concat(PVT()).forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;tg=e}});\n if(tg){const d=best||1;ax=")
rep("let tg=null,best=reach;E.forEach(","let tg=null,best=reach;E.concat(PVT()).forEach(")
rep("  E.forEach(e=>{if(!e.dead&&Math.hypot(e.x-cx,e.y-cy)<s.r+(e.rad||0)*.6)hitE(","  E.concat(PVT()).forEach(e=>{if(!e.dead&&Math.hypot(e.x-cx,e.y-cy)<s.r+(e.rad||0)*.6)hitE(")
rep("  E.forEach(e=>{if(e.dead)return;const dx=e.x-p.x,dy=e.y-p.y,pr=","  E.concat(PVT()).forEach(e=>{if(e.dead)return;const dx=e.x-p.x,dy=e.y-p.y,pr=")
rep("  E.forEach(e=>{if(e.dead)return;const dx=e.x-hx,dy=e.y-hy,dd=","  E.concat(PVT()).forEach(e=>{if(e.dead)return;const dx=e.x-hx,dy=e.y-hy,dd=")
# atordoado (PvP): não anda
rep("if(p.dash){dashStep(dt)}else if(m>.15){","if(p.dash){dashStep(dt)}else if(PST>0){PST-=dt;p.mv=0}else if(actRoot()){p.mv=0}else if(m>.15){if(ACT&&!ACT.root)ACT=null;")
# golpes em área passam por castAoe (os Hyuga usam a folha de efeitos do Kaiten)
rep(" if(s.t=='aoe'){const cx=p.x+ax*(s.off||0),cy=p.y+ay*(s.off||0);\n  fx.push({k:'ring',x:cx,y:cy-8,r:s.r,col:s.col,life:.45,max:.45,sp:s.fx});\n  E.concat(PVT()).forEach(e=>{if(!e.dead&&Math.hypot(e.x-cx,e.y-cy)<s.r+(e.rad||0)*.6)hitE(e,s.dmg,s.stun,ax*(s.kb||0),ay*(s.kb||0))});\n  if(s.fx)flash={col:s.col,a:.3}}",
    " if(s.t=='aoe')castAoe(s,ax,ay);")
# desenho dos efeitos da folha
rep(" fx.forEach(f=>{const k=1-f.life/f.max,a=f.life/f.max;\n  if(f.k=='ring'){"," fx.forEach(f=>{const k=1-f.life/f.max,a=f.life/f.max;\n  if(f.k=='kfx'){kfxDraw(f);return}if(f.k=='cone'){coneDraw(f);return}if(f.k=='act')return;\n  if(f.k=='ring'){")
# Hyuga de branco: quadros novos entram no sprite (o jogo carrega e pinta pele/cabelo igual aos outros; a roupa branca não recebe cor)
HYS=json.load(open('hyuga/spr_hyuga.json'));UCS=json.load(open('hyuga/spr_uchiha.json'))
J=lambda o:json.dumps(o,separators=(',',':'))
# Uchiha: poses da Bola de Fogo (folha "uca"), com corte do cabelo e ponto do pé de cada quadro
rep('const SPR={"f":{','const SPR={"hyc":'+J(HYS['hyc'])+',"hyx":'+J(HYS['hyx'])+',"hyh":'+J(HYS['hyh'])+',"ucc":'+J(UCS['ucc'])+',"ucx":'+J(UCS['ucx'])+',"f":{'+','.join('"'+k+'":'+json.dumps(v) for k,v in list(HYS['f'].items())+list(UCS['f'].items()))+',')
rep("const cut=k=='arun'?SPR.hy2:(k=='run'&&x<53)?31:SPR.hy;","const cut=SPR.hyc&&SPR.hyc[k]?SPR.hyc[k][i]:SPR.ucc&&SPR.ucc[k]?SPR.ucc[k][i]:k=='arun'?SPR.hy2:(k=='run'&&x<53)?31:SPR.hy;")
rep("let t=m==1?sk:m==2?hr:cl,rf=m==1?SREF:REF;","let t=m==1?sk:m==2?hr:(SPR.hyc&&SPR.hyc[k]?0:cl),rf=m==1?SREF:REF;")
# Chidori na mão: no Hyuga segue a mão da frente de cada quadro (no personagem preto fica no lugar de sempre)
rep("hx=x+fl*13,hy=y-24,","hx=HHAND?x+HHAND[0]:x+fl*13,hy=HHAND?y+HHAND[1]:y-24,")
# ---- golpes: 1 inicial + 1 do meio + ultimate (botão grande) + 1 do item da mão (Chidori, Rasengan…) ----
rep('<div class="sb" id="b2"></div>','<div class="sb" id="b2"></div><div class="sb empty" id="b3"></div>')
rep("[0,1,2].forEach(i=>$('#b'+i).onpointerdown=","[0,1,2,3].forEach(i=>$('#b'+i).onpointerdown=")
rep("{'1':0,'2':1,'3':2,j:0,k:1,l:2}","{'1':0,'2':1,'3':2,'4':3,j:0,k:1,l:2,u:3}")
rep(" P=[];EP=[];fx=[];FT=[];cd=[0,0,0];"," P=[];EP=[];fx=[];FT=[];cd=[0,0,0,0];")
rep("for(let i=0;i<3;i++)cd[i]=Math.max(0,cd[i]-dt);","for(let i=0;i<4;i++)cd[i]=Math.max(0,cd[i]-dt);")
rep("b.classList.toggle('off',p.mp<mpOf(i,s))});","b.classList.toggle('off',p.mp<mpOf(i,s))});itemBtnTick();jtBtnTick();")
rep("function useBtn(i){if(CLANS[clan].sk[i].auto)","function useBtn(i){if(i===3)return castItem();if(CLANS[clan].sk[i].auto)")
# o item não ocupa mais o golpe inicial: tem botão próprio
rep("if(cd[i]>0||p.mp<mpOf(i,s)){if(i==0&&atkItem()&&cd[0]<=0&&p.mp<mpOf(0,s))FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}",
    "if(cd[i]>0||p.mp<mpOf(i,s)){if(cd[i]<=0&&!(performance.now()-(window._smp||0)<700)){window._smp=performance.now();FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1})}return}")
rep(" if(i==0&&atkItem()){castAtk(ax,ay);return}\n","")
rep("function refreshAtk(){const it=atkItem(),b=$('#b0');if(!b)return;b.innerHTML=it?'<span>⚡</span>'+it.name+'<div class=\"cd\"></div>':b0orig;b.dataset.atk=it?'1':''}","function refreshAtk(){itemBtn()}")
# Bola de Fogo: pose de selo, bola com rastro de chamas e explosão
rep("  if(s.t=='proj'){const n=s.fan||1;","  if(s.t=='proj'&&s.fire)castFire(s,ax,ay);else if(s.t=='proj'){const n=s.fan||1;")
rep(" P=P.filter(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||sol(b.x,b.y+16))return 0;",
    " P=P.filter(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||sol(b.x,b.y+16)||(b.rm&&b.fire&&fireRmHit(b))){if(b.fire)fireBoom(b);return 0}")
rep("P.forEach(b=>{if(b.spin){","P.forEach(b=>{if(b.fire){fireDraw(b,ts);return}if(b.spin){")
# reforços ativos (Sharingan, Mangekyō, Susanoo) aparecem embaixo das barras
rep('<div id="phud"></div>','<div id="phud"></div><div id="bufs"></div>')
# ---- aba Jutsus (árvore do clã) + olho liga/desliga ----
rep('<button id="tbSt">📊 Status</button></div>','<button id="tbSt">📊 Status</button><button id="tbJu">🌀 Jutsus</button></div>')
rep('<div id="paneCh" hidden></div>','<div id="paneCh" hidden></div><div id="paneJu" hidden></div>')
rep("if(w==='ch')chDraw();","if(w==='ch')chDraw();$('#paneJu').hidden=w!=='ju';$('#tbJu').classList.toggle('on',w==='ju');if(w==='ju')juDraw();")
# com o Sharingan/Mangekyō ligado o chakra não se recupera (o olho consome)
rep("p.mp=Math.min(p.mpMax,p.mp+5*dt*MG())","p.mp=Math.min(p.mpMax,p.mp+(eyeOnAny()?0:BAL.personagem.regenChakra*dt*MG()))")
rep("p.hp=Math.min(p.max,p.hp+1.2*dt*RG())","p.hp=Math.min(p.max,p.hp+BAL.personagem.regenVida*dt*RG())")
# começo da partida: botões conforme o nível
rep("autoOn=true;C.sk.forEach((s,i)=>$('#b'+i).classList.toggle('ao',!!s.auto));","autoOn=true;C.sk.forEach((s,i)=>$('#b'+i).classList.toggle('ao',!!s.auto));jtStart();")
# vários do mesmo item (cada drop é uma unidade nova; a mochila mostra pilhas)
rep("function giveItems(ids){const got=ids.filter(i=>ITEMS[i]&&!hasItem(i));","function giveItems(ids){const got=ids.filter(i=>ITEMS[i]);")
rep("(Array.isArray(j.inv)?j.inv:[]).forEach(i=>{if(ITEMS[i]&&!INV.includes(i)&&!Object.values(EQ).includes(i))INV.push(i)})","(Array.isArray(j.inv)?j.inv:[]).slice(0,600).forEach(i=>{if(ITEMS[i])INV.push(i)})")
rep("['agi','AGI','Agilidade','+1% de velocidade e +0,5% de esquiva por ponto']","['agi','AGI','Agilidade','+1% de velocidade por ponto; a velocidade acima de 100% vira Esquiva']")
rep("['dex','DEX','Destreza','−1% de recarga das habilidades por ponto (máx. 40%)']","['dex','DEX','Destreza','+1 de Precisão e −1% de recarga por ponto (máx. 40%)']")
# chefe com nível e cor de perigo no nome
rep("ctx.fillStyle='#ffe9a8';ctx.strokeText(e.nome,e.x,e.y-130-bz);ctx.fillText(e.nome,e.x,e.y-130-bz)","{const lb=mobName(e);ctx.fillStyle=lvColor(e,'#ffe9a8');ctx.strokeText(lb,e.x,e.y-130-bz);ctx.fillText(lb,e.x,e.y-130-bz)}")
# janela de troca e convite de troca
rep('<div id="pinv" hidden>','''<div id="trd" hidden><div class="td">
<div class="tdh"><b>🤝 Troca com <span id="tdNome"></span></b><button id="tdX" class="sec">Cancelar</button></div>
<div class="tdc"><div class="tdp"><div class="tdt">Você oferece <i id="tdSt0"></i></div><div class="tdg" id="tdMine"></div></div>
<div class="tdp"><div class="tdt"><span id="tdNome2"></span> oferece <i id="tdSt1"></i></div><div class="tdg" id="tdTheirs"></div></div></div>
<div id="tdInfo" class="tdi"></div>
<div class="tdt">Sua mochila <small>(itens equipados não entram: desequipe antes)</small></div><div class="tdg tdb" id="tdBag"></div>
<div class="tdf"><span id="tdMsg"></span><button id="tdOk">Pronto</button></div></div></div>
<div id="tinvp" hidden><span></span><div><button id="tinvOk">Aceitar</button><button id="tinvNo" class="sec">Recusar</button></div></div>
<div id="pinv" hidden>''')
# atualização automática: versão desta montagem e de onde baixar as próximas (dá para trocar nos testes)
GV=os.environ.get('GAME_VER','0');OTA_BASE=os.environ.get('OTA_BASE','https://raw.githubusercontent.com/yFuZzey/shinobi-online/');OTA_API=os.environ.get('OTA_API','https://api.github.com/repos/yFuZzey/shinobi-online/commits/main')
js=open('online/online2.js').read().replace('__GAME_VER__',GV).replace('__OTA_BASE__',OTA_BASE).replace('__OTA_API__',OTA_API).replace('__SUPA_URL__',url).replace('__SUPA_KEY__',key).replace('__GS_URL__',gs).replace('__MOBS__',open('mobs/mobs_client.json').read()).replace('__SFX__',open('sus/sfx.json').read()).replace('__SFXIC__',open('sus/icons.json').read()).replace('__KFX__',open('kaiten/kfx.json').read()).replace('__SPRITES__',open('mobs/sprites_used.json').read())
rep("document.addEventListener('contextmenu',e=>e.preventDefault());\n</script>","document.addEventListener('contextmenu',e=>e.preventDefault());\n"+js+"\n</script>")
CSS="""
/* ---- online ---- */
button.sec{background:transparent;color:var(--ink);border:2px solid var(--line)}
button:disabled{opacity:.55}
/* tela de login */
#s-login{--lg-ink:#f6efe2;--lg-mute:#bfb2a8;--lg-field:#120e1f;--lg-edge:#40364f;--lg-sand:#e8b56a;padding:12px calc(16px + env(safe-area-inset-right,0px)) 12px calc(16px + env(safe-area-inset-left,0px));overflow:hidden;color:var(--lg-ink);font-family:system-ui,Roboto,"Segoe UI",sans-serif;
 background:radial-gradient(circle at 47% 17%,#fff1cf 0 18px,rgba(255,236,190,.14) 19px 46px,transparent 47px),radial-gradient(1.5px 1.5px at 12% 12%,#fff8 99%,transparent),radial-gradient(1.5px 1.5px at 28% 30%,#fff6 99%,transparent),radial-gradient(1.5px 1.5px at 62% 8%,#fff7 99%,transparent),radial-gradient(1.5px 1.5px at 90% 26%,#fff5 99%,transparent),radial-gradient(1.5px 1.5px at 74% 40%,#fff4 99%,transparent),radial-gradient(1.5px 1.5px at 36% 6%,#fff6 99%,transparent),linear-gradient(180deg,#110d22 0%,#261a3a 46%,#5a3436 74%,#b5763f 100%)}
.lgdune{position:absolute;left:0;right:0;bottom:0;width:100%;height:34%;pointer-events:none}
.lgwrap{position:relative;display:flex;align-items:center;justify-content:center;gap:clamp(18px,5vw,56px);width:100%;max-width:860px}
.lgbrand{flex:1 1 0;min-width:0;max-width:330px;text-align:left}
.lgseal{width:58px;height:58px;border-radius:14px;display:grid;place-items:center;background:var(--acc);color:#fff;font-size:34px;font-weight:800;box-shadow:0 6px 20px rgba(217,72,43,.45);transform:rotate(-4deg)}
#s-login .lgbrand h1{margin:14px 0 6px;font-size:clamp(28px,4.6vw,40px);line-height:1.05;letter-spacing:.02em;text-wrap:balance;color:var(--lg-ink);text-shadow:0 2px 12px rgba(0,0,0,.45)}
.lgbrand p{margin:0;color:var(--lg-mute);font-size:14px;line-height:1.4}
.lgcard{flex:0 1 330px;min-width:0;background:rgba(18,14,30,.86);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px 14px 8px;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.lgtabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;border-radius:11px;background:#0b0816;margin-bottom:10px}
.lgtabs button{margin:0;padding:8px 6px;border-radius:8px;background:transparent;color:var(--lg-mute);font-size:14px;font-weight:700;border:0}
.lgtabs button.on{background:#2c2440;color:var(--lg-ink)}
.lgf{display:flex;flex-direction:column;gap:8px}
.fl{position:relative;display:block}
.fl small{display:block;margin:3px 2px 0;font-size:11px;color:var(--lg-mute);text-align:left}.fl small.ok{color:#7fdc95}.fl small.bad{color:#ff9b86}
#s-login .lgf input:not([type=checkbox]){width:100%;margin:0;padding:10px 12px;font-size:16px;border-radius:10px;border:1.5px solid var(--lg-edge);background:var(--lg-field);color:var(--lg-ink);font-family:inherit}
#s-login .lgf input::placeholder{color:#8d8299}
#s-login .lgf input:focus{outline:none;border-color:var(--lg-sand);box-shadow:0 0 0 3px rgba(232,181,106,.18)}
.fl.pw input{padding-right:78px!important}
.eye{position:absolute;right:6px;top:7px;margin:0;padding:4px 8px;border:0;border-radius:7px;background:#2c2440;color:var(--lg-mute);font-size:12px;font-weight:600}
.ck{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--lg-ink);cursor:pointer;user-select:none;padding:2px 0;text-align:left}
.ck input{width:18px;height:18px;margin:0;accent-color:var(--acc)}
.lgf button[type=submit]{margin:2px 0 0;padding:11px;font-size:16px;border-radius:10px;width:100%}
#err{margin:8px 0 0;min-height:1.2em;font-size:13px;color:#ffcf9e;text-align:center;line-height:1.35}
button.lnk{display:block;margin:0 auto;background:none;color:var(--lg-mute);text-decoration:underline;font-size:13px;font-weight:400;padding:2px 8px}
@media (orientation:portrait){.lgwrap{flex-direction:column;gap:16px}.lgbrand{text-align:center;max-width:none}.lgseal{margin:0 auto}.lgcard{flex-basis:auto;width:min(340px,100%)}}
@media (max-height:380px){.lgcard{padding:9px 12px 6px}.lgtabs{margin-bottom:7px}.lgf{gap:6px}#s-login .lgf input:not([type=checkbox]){padding:8px 11px}.lgf button[type=submit]{padding:9px}.lgseal{width:48px;height:48px;font-size:28px}.eye{top:5px}}
#onl{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:2px 9px 2px 8px;border-radius:10px;background:rgba(0,0,0,.45);font-size:11px;font-weight:600}
#onl::before{content:"";width:7px;height:7px;border-radius:50%;background:#e8b13a}
#onl.ok::before{background:#4fd06a;box-shadow:0 0 6px #4fd06a}
#phud{display:flex;flex-direction:column;gap:3px;margin-top:6px}
#phud .pm{font-size:11px;font-weight:600;width:170px}#phud .pm span{display:block;color:#7dff9a}#phud .pm i{display:block;height:4px;margin-top:2px;border-radius:2px;background:#0008;overflow:hidden}#phud .pm i b{display:block;height:100%;background:#4fd06a}
#phud .offm{opacity:.55}
#chatrow{display:flex;gap:8px;align-items:flex-start;margin-top:8px;width:min(380px,52vw)}
#chatbtn{flex:0 0 auto;margin:0;width:40px;height:36px;padding:0;font-size:18px;border-radius:12px;background:rgba(12,10,20,.5);border:1px solid rgba(255,255,255,.28)}
#chatlog{flex:1;min-width:0;pointer-events:none;font:12px/1.35 system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000,0 0 4px #000;text-align:left}
#chatlog div{padding:1px 0;word-break:break-word}#chatlog .sys{color:#c9f3d4;font-size:11px}#chatlog .gp{color:#7dff9a}
#chatlog .cl b{color:#fff}#chatlog .cg,#chatlog .cg b{color:#7dff9a}#chatlog .cm b{color:#9fd8ff}
#chatp{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:12;display:flex;flex-direction:column;width:min(560px,76vw);max-height:calc(100% - 16px);height:min(330px,calc(100% - 16px));border-radius:14px;background:rgba(12,10,20,.9);border:1px solid rgba(255,255,255,.22);font-family:system-ui,sans-serif;color:#fff;overflow:hidden}
#chatp[hidden]{display:none}
.cph{display:flex;gap:4px;padding:6px 6px 0;border-bottom:1px solid rgba(255,255,255,.15)}
.cph button{margin:0;padding:7px 12px;font-size:13px;border-radius:9px 9px 0 0;background:transparent;color:#ffffffa0;font-family:inherit;position:relative}
.cph button.on{background:rgba(255,255,255,.12);color:#fff}
#chatX{margin-left:auto!important;border-radius:9px!important;color:#fff!important}
#regB{display:inline-block;min-width:16px;height:16px;line-height:16px;margin-left:5px;padding:0 4px;border-radius:8px;background:#e8b13a;color:#2a1600;font-style:normal;font-size:10px;font-weight:800}#regB[hidden]{display:none}
#cpList{flex:1;min-height:50px;overflow-y:auto;padding:6px 10px;font-size:13px;line-height:1.4;text-align:left;-webkit-user-select:text;user-select:text}
#cpList div{padding:2px 0;word-break:break-word}#cpList .rg{color:#e6e2f0}#cpList small{color:#ffffff70;font-variant-numeric:tabular-nums;font-size:11px}
#cpList .cl b{color:#fff}#cpList .cg{color:#b8ffc8}#cpList .cg b{color:#7dff9a}#cpList .cm b{color:#9fd8ff}#cpList .cpe{color:#ffffff80;font-size:12px}
#cpIn{display:flex;flex-direction:column;gap:6px;padding:6px;border-top:1px solid rgba(255,255,255,.15)}#cpIn[hidden]{display:none}
.chs{display:flex;gap:4px}.chs button{margin:0;padding:5px 12px;font-size:12px;border-radius:12px;background:rgba(255,255,255,.1);color:#fff;font-family:inherit}
.chs button.on[data-ch=l]{background:#e9e4f5;color:#1d1a2b}.chs button.on[data-ch=g]{background:#2f8a4a}.chs button.on[data-ch=m]{background:#2f6aa8}.chs button:disabled{opacity:.35}
.cpr{display:flex;gap:6px}
#toast{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:13;max-width:min(520px,80vw);padding:8px 14px;border-radius:12px;background:rgba(12,10,20,.85);border:1px solid rgba(255,255,255,.25);color:#fff;font:600 13px/1.35 system-ui,sans-serif;text-align:center;pointer-events:none}#toast[hidden]{display:none}
#stOut{background:transparent!important;color:var(--acc)!important;border:2px solid var(--acc)!important}
#grpbtn{position:absolute;right:calc(10px + env(safe-area-inset-right,0px));top:116px;z-index:6;margin:0;padding:7px 12px;font-size:13px;border-radius:16px;background:rgba(12,10,20,.5);border:1px solid rgba(255,255,255,.28);color:#fff;font-weight:600;min-width:104px;text-align:left;font-family:system-ui,sans-serif}
#grp{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}#grp[hidden]{display:none}
#grp .gp{background:var(--panel);color:var(--ink);border:2px solid var(--line);border-radius:14px;padding:12px 14px;width:min(480px,94vw);max-height:94%;overflow:auto;text-align:left;font-family:system-ui,sans-serif}
.gph{display:flex;justify-content:space-between;align-items:center}.gph b{font-size:18px}.gph button{margin:0;padding:7px 14px;font-size:14px}
.gpd{font-size:12px;color:var(--mute);margin:6px 0 4px;line-height:1.4}.gpt{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mute);margin:12px 0 4px}
.gpe{font-size:13px;color:var(--mute);margin:4px 0}
.gr{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)}.gr .gn{font-weight:700;font-size:14px}.gr .gi{flex:1;font-size:12px;color:var(--mute)}
.gr button{margin:0;padding:6px 12px;font-size:13px}
body:not(.adm) .admo{display:none!important}body:not(.adm) #paneBag .ivf{display:none}
#grpLeave{margin-top:8px;padding:7px 14px;font-size:13px}
#pinv{position:absolute;left:50%;top:56px;transform:translateX(-50%);z-index:15;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 16px;border-radius:14px;background:rgba(12,10,20,.9);border:2px solid #4fd06a;color:#fff;font:600 14px system-ui,sans-serif;text-align:center;max-width:90vw}
#pinv[hidden]{display:none}#pinv div{display:flex;gap:8px}#pinv button{margin:0;padding:8px 16px;font-size:14px}#pinv .sec{color:#fff;border-color:#ffffff66}
#otabar{position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:45;display:flex;align-items:center;gap:10px;padding:7px 8px 7px 14px;border-radius:14px;background:rgba(18,40,24,.94);border:1.5px solid #4fd06a;color:#fff;font:600 13px/1.3 system-ui,sans-serif;max-width:92vw}#otabar[hidden]{display:none}#otabar button{margin:0;padding:7px 14px;font-size:13px;border-radius:10px;background:#2f8a4a;flex:0 0 auto}
.lgver{margin:4px 0 0;text-align:center;font-size:11px;color:#8d8299;font-variant-numeric:tabular-nums}
#netbar{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:14;padding:6px 14px;border-radius:12px;background:rgba(160,60,20,.9);color:#fff;font:600 13px system-ui,sans-serif}#netbar[hidden]{display:none}
#netblock{position:absolute;inset:0;z-index:40;background:rgba(10,8,18,.92);display:flex;align-items:center;justify-content:center;color:#fff;text-align:center;font-family:system-ui,sans-serif;padding:24px}#netblock[hidden]{display:none}
#netblock>div{display:flex;flex-direction:column;gap:10px;align-items:center;max-width:340px}#netblock b{font-size:20px}#netblock span{color:#ffffffc0;line-height:1.4}
/* proficiência (aba Status) */
#stProf{display:flex;flex-direction:column;gap:8px;margin-bottom:6px}
.pfd{margin:2px 0;font-size:13px;line-height:1.4;color:var(--ink)}.pfd b{color:#ffc94a}
.pfc{border:1.5px solid #ffc94a66;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.pfh{display:flex;align-items:center;gap:10px}.pfh>div{flex:1;min-width:0}.pfh b{font-size:16px}.pfh small{display:block;font-size:11px;color:var(--mute);line-height:1.3}
.pfi{font-size:24px;width:34px;text-align:center}
.pfr{font-size:26px;font-weight:900;color:#ffc94a;min-width:34px;text-align:center;font-variant-numeric:tabular-nums}
.pfg{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:560px){.pfg{grid-template-columns:1fr}}
.pfo{border:1px solid var(--line);border-radius:12px;padding:9px 10px;display:flex;flex-direction:column;gap:5px}
.pfo.lock{opacity:.62}.pfo.cur{border-color:#ffc94a}
.pfq{font-size:12px;color:var(--mute);line-height:1.35}.pfq span{opacity:.8}
.pfo button{margin:2px 0 0;padding:8px;font-size:14px;border-radius:9px}.pfo button.conf{background:#c0392b}
.pfx{align-self:flex-start;margin:2px 0 0;padding:7px 14px;font-size:13px;border-radius:9px;background:transparent!important;color:var(--ink)!important;border:1.5px solid var(--line)!important}
/* proficiência: vantagens e desvantagens */
.pfud{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:560px){.pfud{grid-template-columns:1fr}}
.pft{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-top:2px}.pft.pup{color:#3aa35a}.pft.pdn{color:#e0533b}.pft span{font-weight:400;text-transform:none;letter-spacing:0;color:var(--mute)}
.pfl{margin:2px 0 0;padding-left:16px;font-size:12.5px;line-height:1.45}.pfl.pup li::marker{content:"▲ ";color:#3aa35a}.pfl.pdn li::marker{content:"▼ ";color:#e0533b}
.g{color:#3aa35a}.r{color:#e0533b}.z{color:var(--mute)}
/* janela: um pouco mais larga para caber a mochila nova */
#inv .iv{width:min(800px,96vw)}
.tabs button{white-space:nowrap}
/* mochila */
.bg3{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:16px;align-items:start}
@media(max-width:720px){.bg3{grid-template-columns:auto minmax(0,1fr)}.bg3>.ivr{grid-column:1/-1}}
.doll{display:flex;align-items:center;gap:6px}.dcol{display:flex;flex-direction:column;gap:6px}
#dollCv{width:120px;height:196px;border-radius:12px;background:linear-gradient(180deg,#1d1530,#2b1d14);border:1px solid var(--line)}
.sl .ph{font-size:20px;opacity:.35;filter:grayscale(1)}
.eqsum{margin-top:8px;font-size:12px;display:flex;flex-direction:column;gap:1px;max-width:260px}.eqsum b{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);margin-bottom:2px}.eqsum span{color:#3aa35a}.eqsum span.z{color:var(--mute)}
.bgh{display:flex;justify-content:space-between;align-items:center;gap:8px}.bgh .ivt{margin:6px 0 4px}#bagCnt{letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums}
#bagSort{padding:3px 10px!important;font-size:12px!important;border-radius:8px;background:transparent;color:var(--ink);border:1.5px solid var(--line)}
#ivGrid{grid-template-columns:repeat(5,46px)!important;gap:5px!important}#ivGrid .sl{width:46px;height:46px}
.dt{display:flex;flex-direction:column;gap:7px}.dth{display:flex;gap:10px;align-items:center}
.dti{width:58px;height:58px;border-radius:12px;border:2px solid var(--rc);background:#150a08;display:grid;place-items:center;flex:0 0 auto;box-shadow:0 0 14px -4px var(--rc)}.dti img{width:80%;height:80%;object-fit:contain}
.dt .dn{font-size:17px;font-weight:800;line-height:1.15}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.chip{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--mute)}
.chip.rc{border-color:var(--rc);color:var(--rc);font-weight:700}.chip.on{background:#2f8a4a;border-color:#2f8a4a;color:#fff}
.dd{font-size:13px;line-height:1.4;margin:0}.dcmp{font-size:12px;color:var(--mute)}
.dst{margin:0;padding-left:18px;font-size:13px;line-height:1.55}
.dsp{font-size:12.5px;line-height:1.4;padding:7px 9px;border-radius:9px;background:rgba(111,208,255,.12);border:1px solid rgba(111,208,255,.4)}
.dbt button{width:100%;padding:10px!important;font-size:15px!important}.dbt button.sec{background:transparent;color:var(--ink);border:2px solid var(--line)}
.dempty{text-align:center;color:var(--mute);padding:20px 6px;font-size:13px;line-height:1.45}.dei{font-size:34px;opacity:.5}
/* aba Personagem */
.chh{display:flex;gap:14px;align-items:center;margin-bottom:4px}
#chCv{width:110px;height:130px;border-radius:12px;background:linear-gradient(180deg,#1d1530,#2b1d14);border:1px solid var(--line);flex:0 0 auto}
.chi{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.chn{font-size:20px;line-height:1.1}
.chc{font-size:13px;color:var(--mute)}.chc::before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--c);margin-right:6px}
.chp{font-size:14px}.chp b{color:#ffc94a}.chp.z{font-size:13px}
.chbar{position:relative;height:16px;border-radius:8px;background:rgba(0,0,0,.45);overflow:hidden;max-width:340px}.chbar i{position:absolute;left:0;top:0;bottom:0;display:block}.chbar.cbh i{background:#d9482b}.chbar.cbm i{background:#3a7be0}
.chbar b{position:relative;display:block;text-align:center;font-size:11px;line-height:16px;color:#fff;text-shadow:0 1px 2px #000}
.chnote{font-size:11.5px;color:var(--mute);margin:2px 0 4px;line-height:1.35}
.tw{overflow-x:auto;margin-bottom:2px}
.cht{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
.cht th{font-size:11px;font-weight:600;color:var(--mute);text-align:right;padding:4px 7px;border-bottom:1px solid var(--line);white-space:nowrap}
.cht td{text-align:right;padding:4px 7px;border-bottom:1px dotted var(--line);white-space:nowrap}
.cht th:first-child,.cht td:first-child{text-align:left}.cht .ab{display:inline-block;min-width:34px;color:#ffc94a}.cht small{font-size:10.5px}
.chord{font-size:12px;line-height:1.4;padding:8px 10px;border:1px dashed var(--line);border-radius:10px;margin:6px 0 2px}.chord b{color:var(--ink)}.chord ol{margin:4px 0 0;padding-left:18px;color:var(--mute)}.chord li b{color:#ffc94a}
.cht small.cbk{display:block;font-size:10px;color:var(--mute);line-height:1.1}
.strow .sv small.svf{display:block;font-size:11px;font-weight:600;color:#3aa35a;line-height:1}
.cht small.rkb{display:inline-block;margin-left:4px;padding:0 6px;border-radius:999px;border:1px solid #ffc94a88;color:#ffc94a;font-weight:700}
/* trocas */
#trd{position:absolute;inset:0;z-index:22;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center}#trd[hidden]{display:none}
#trd .td{background:var(--panel);color:var(--ink);border:2px solid var(--line);border-radius:14px;padding:10px 12px;width:min(640px,96vw);max-height:96%;overflow:auto;text-align:left;font-family:system-ui,sans-serif;display:flex;flex-direction:column;gap:7px}
.tdh{display:flex;justify-content:space-between;align-items:center;gap:8px}.tdh b{font-size:17px}.tdh button{margin:0;padding:6px 14px;font-size:13px}
.tdc{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tdp{border:1px solid var(--line);border-radius:12px;padding:7px 8px}
.tdt{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mute);margin-bottom:5px}.tdt small{font-weight:400;text-transform:none;letter-spacing:0}
.tdt i{font-style:normal;font-weight:600;text-transform:none;letter-spacing:0;margin-left:4px;color:var(--mute)}.tdt i.on{color:#3aa35a}
.tdg{display:grid;grid-template-columns:repeat(6,40px);gap:4px}.tdg .sl{width:40px;height:40px}.tdb{grid-template-columns:repeat(auto-fill,40px)}
.tdi{font-size:12.5px;line-height:1.4;min-height:1.4em;padding:5px 8px;border-radius:8px;background:rgba(0,0,0,.06)}
.tdf{display:flex;align-items:center;gap:10px;border-top:1px solid var(--line);padding-top:7px}.tdf span{flex:1;min-width:0;font-size:12px;color:var(--mute);line-height:1.35}
#tdOk{margin:0;padding:9px 18px;font-size:15px;flex:0 0 auto}#tdOk.go{background:#2f8a4a}
.sl{position:relative}.sl .qt{position:absolute;right:2px;bottom:1px;font:800 10px/1 system-ui,sans-serif;font-style:normal;color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;pointer-events:none}
.tdq{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px}.tdq button{margin:0;padding:5px 11px;font-size:14px;border-radius:8px;min-width:34px}.tdq b{min-width:24px;text-align:center;font-size:15px;font-variant-numeric:tabular-nums}.tdq span{font-size:12px}
.tdg .sl.sel{outline:2px solid #ffc94a;outline-offset:1px}
#tinvp{position:absolute;left:50%;top:56px;transform:translateX(-50%);z-index:15;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 16px;border-radius:14px;background:rgba(12,10,20,.9);border:2px solid #ffc94a;color:#fff;font:600 14px system-ui,sans-serif;text-align:center;max-width:90vw}
#tinvp[hidden]{display:none}#tinvp div{display:flex;gap:8px}#tinvp button{margin:0;padding:8px 16px;font-size:14px}#tinvp .sec{color:#fff;border-color:#ffffff66}
.gr button+button{margin-left:6px}
/* fluidez: desfoque de fundo por cima do jogo é caro no celular (refaz a cada quadro) */
/* aba Jutsus */
#paneJu{display:flex;flex-direction:column;gap:8px}
.jbr{display:flex;flex-direction:column;gap:3px}.jbt{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)}
.jrow{display:flex;align-items:center;gap:4px;overflow-x:auto;padding:2px 2px 6px}
.jar{font-style:normal;color:var(--mute);font-size:20px;flex:0 0 auto;line-height:1}
.jgrid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px;align-items:start}.jtree{display:flex;flex-direction:column;gap:6px;min-width:0}@media(max-width:640px){.jgrid{grid-template-columns:minmax(0,1fr)}}
.jn{flex:0 0 auto;width:80px;margin:0;padding:5px 3px 4px;border-radius:12px;border:1.5px solid var(--line);background:rgba(0,0,0,.14);color:var(--ink);display:flex;flex-direction:column;align-items:center;gap:2px;font:700 11.5px/1.15 system-ui,sans-serif}
.jdh .ji{width:44px;height:44px}
.ji{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:#150a08;overflow:hidden;flex:0 0 auto}.ji img{width:82%;height:82%;object-fit:contain}.ji span{font-size:22px}
.jn small{font-size:10.5px;font-weight:600;color:var(--mute);text-align:center}
.jn.ok small{color:#3aa35a}.jn.lock{opacity:.55}.jn.lock .ji{filter:grayscale(1)}.jn.soon{opacity:.42;border-style:dashed}.jn.pick{border-color:#e0533b}.jn.pick small{color:#e0533b}
.jn.cur{border-color:#ffc94a;background:rgba(255,201,74,.1)}.jn.sel{outline:2px solid #e0533b;outline-offset:1px}
.jdet{border:1.5px solid var(--line);border-radius:12px;padding:9px 11px;display:flex;flex-direction:column;gap:6px}
.jdh{display:flex;gap:10px;align-items:center}.jdh>div{flex:1;min-width:0}.jdh b{font-size:16px}.jdh small{display:block;font-size:11.5px;color:var(--mute);line-height:1.3}
.jst{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}.jst.ok{color:#3aa35a;border-color:#3aa35a}.jst.pick{color:#e0533b;border-color:#e0533b}
.pfi.jey{width:46px;height:46px}.pfi.jey img{width:100%;height:100%;object-fit:contain}
.jadm{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--mute)}.jadm button{margin:0;padding:5px 11px;font-size:12px}
#inv .tabs button{padding-left:10px;padding-right:10px}
/* botões de golpe: travado, olho ligado */
.sb.lock img,.sb.lock>span{filter:grayscale(1);opacity:.6}.sb .lk{position:absolute;top:3px;left:0;right:0;text-align:center;font:800 9px/1 system-ui,sans-serif;color:#ffd27a;text-shadow:0 1px 2px #000,0 0 3px #000;pointer-events:none}
.sb.eyeon{border-color:#ff3a4a!important;box-shadow:0 0 14px #ff2a3acc,inset 0 0 12px #ff2a3a77!important}
#bufs span.on{border-color:#ff6a6a;background:rgba(90,0,12,.8)}
/* reforços ativos */\n#bufs{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;max-width:230px}#bufs:empty{display:none}#bufs span{padding:2px 8px;border-radius:10px;background:rgba(40,8,14,.72);border:1px solid rgba(255,120,120,.45);color:#ffe2c4;font:600 11px/1.35 system-ui,sans-serif}#bufs b{color:#ffd27a;font-variant-numeric:tabular-nums}\n/* golpes: ultimate no botão grande; inicial, do meio e item em arco em volta dele */
#b1{right:calc(87px + env(safe-area-inset-right,0px))!important;bottom:89px!important}
#b3{right:calc(24px + env(safe-area-inset-right,0px));bottom:112px;width:62px;height:62px}
.sb.empty{opacity:.6;border-style:dashed;background:#0007}.sb .ph{opacity:.55;filter:grayscale(1)}
@media (orientation:landscape) and (max-height:560px){#b1{right:calc(80px + env(safe-area-inset-right,0px))!important;bottom:76px!important}#b3{width:56px;height:56px;bottom:98px}}
#mapbtn,#bagbtn,#statbtn,#grpbtn{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:rgba(12,10,20,.66)!important}
@media (orientation:landscape) and (max-height:560px){#grpbtn{top:104px;padding:6px 11px;font-size:12px;min-width:96px}#phud .pm{width:150px}#chatrow{margin-top:5px}#chatp{height:calc(100% - 16px)}#toast{bottom:110px}}
"""
i=s.rindex("</style></head>");s=s[:i]+CSS+s[i:]
open(dst,'w').write(s)
print('online ok',len(s),'configurado' if url.startswith('http') else 'sem servidor')
