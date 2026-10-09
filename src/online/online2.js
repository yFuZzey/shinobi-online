//ONLINE-BEGIN
// ===== Shinobi Online: contas (Supabase) + servidor de jogo próprio (WebSocket) =====
const SUPA={url:'__SUPA_URL__'.replace(/\/+$/,''),key:'__SUPA_KEY__'};
const GS_URL='__GS_URL__'.replace(/\/+$/,''),GS_PROTO=3;
const ONL={ok:/^https?:\/\//.test(SUPA.url)&&SUPA.key.length>20&&/^https?:\/\//.test(GS_URL),on:false,tok:null,rtok:null,uid:null,nome:'',hasChar:false,dirty:false,
 ws:null,authed:false,joined:false,peers:{},lastPos:0,lastSig:'',chat:[],reg:[],regNew:0,tab:'c',invSent:{},saving:false,refT:0,closing:false,retryT:0,tries:0,party:null,chatCh:'l',ping:0,pingT:0,welcomeCb:null};
const ONL_DOM='@jogadores.shinobi-online.app',ONL_SESS='shinobi-sessao',ONL_KEEP='shinobi-lembrar',START_MAP='vila_areia';
// "Manter conectado": guarda usuário e senha só neste aparelho para preencher na próxima vez
function keepGet(){try{const j=JSON.parse(localStorage.getItem(ONL_KEEP)||'null');if(j&&j.u)return{u:String(j.u),p:j.p?decodeURIComponent(escape(atob(j.p))):''}}catch(_){}return null}
function keepSet(u,p){try{if(u)localStorage.setItem(ONL_KEEP,JSON.stringify({u,p:btoa(unescape(encodeURIComponent(p||'')))}));else localStorage.removeItem(ONL_KEEP)}catch(_){}}
const onlEmail=n=>n.toLowerCase()+ONL_DOM;
// acorda o servidor (o plano grátis dorme) assim que o app abre
if(ONL.ok){try{fetch(GS_URL+'/health',{cache:'no-store'}).catch(()=>{})}catch(_){}}

// ---------- Supabase: contas e personagem ----------
function onlHdr(json){const h={apikey:SUPA.key};if(ONL.tok)h.Authorization='Bearer '+ONL.tok;else if(SUPA.key.startsWith('eyJ'))h.Authorization='Bearer '+SUPA.key;if(json)h['Content-Type']='application/json';return h}
async function onlFetch(path,opt){opt=opt||{};let r;
 try{r=await fetch(SUPA.url+path,Object.assign({},opt,{headers:Object.assign(onlHdr(!!opt.body),opt.headers||{})}))}
 catch(e){const x=new Error('Sem conexão com o servidor.');x.net=1;throw x}
 let j=null;const t=await r.text();try{j=t?JSON.parse(t):null}catch(_){}
 if(!r.ok){const x=new Error((j&&(j.msg||j.message||j.error_description||j.error))||('Erro '+r.status));x.status=r.status;x.code=j&&(j.error_code||j.code);throw x}
 return j}
function onlErr(e){const m=String(e&&e.message||e),c=e&&e.code;
 if(e&&e.net)return 'Sem conexão com a internet ou com o servidor.';
 if(/invalid login|invalid_credentials/i.test(m+c))return 'Usuário ou senha incorretos.';
 if(/already registered|user_already_exists|already been registered/i.test(m+c))return 'Esse nome de usuário já existe. Escolha outro.';
 if(/at least \d|weak_password/i.test(m+c))return 'A senha precisa ter pelo menos 8 caracteres.';
 if(/not confirmed|email_not_confirmed/i.test(m+c))return 'Confirme a sua conta pelo link enviado ao seu e-mail.';
 if(/rate limit|over_email_send/i.test(m+c))return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
 if(/signups? (not allowed|disabled)/i.test(m+c))return 'A criação de contas está fechada no momento.';
 if(/personagens|inventario|salvar_inventario|column/.test(m)&&/does not exist|relation|schema cache|could not find/i.test(m))return 'O jogo está em manutenção. Tente de novo em instantes.';
 return 'Erro do servidor: '+m}
function onlSess(s){ONL.tok=s.access_token;ONL.rtok=s.refresh_token;ONL.uid=s.user&&s.user.id||ONL.uid;
 clearTimeout(ONL.refT);ONL.refT=setTimeout(onlRefresh,Math.max(30,(+s.expires_in||3600)-120)*1000)}
async function onlRefresh(){if(!ONL.rtok)return;try{const s=await onlFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:ONL.rtok})});onlSess(s)}
 catch(e){ONL.refT=setTimeout(onlRefresh,e.net?15000:60000)}}
async function onlLogin(nome,senha,novo,rec){const email=onlEmail(nome);let s;
 if(novo){s=await onlFetch('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password:senha,data:{nome,email_rec:rec||''}})});
  if(!s||!s.access_token){const x=new Error('Email not confirmed');x.code='email_not_confirmed';throw x}}
 else s=await onlFetch('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:senha})});
 ONL.nome=(s.user&&s.user.user_metadata&&s.user.user_metadata.nome)||nome;onlSess(s);return s}
const COLS='nome,cla,nivel,xp,pontos,forca,agilidade,vitalidade,inteligencia,destreza,sorte,mapa,pele,cabelo,roupa';
// ---------- versão do personagem salvo (no aparelho e na coluna "versao" do banco, sql/07) ----------
// Quando o formato mudar: SAVE_V sobe (build_online2.py) e entra aqui a função que converte do anterior, ex.: 2:j=>{...;return j}.
// Save sem número é da versão 1. Save de versão mais nova que este app (voltou de atualização) é lido como está.
const MIGRA={};
function chMigra(j){let v=Math.max(1,+j.v||1);while(v<SAVE_V){const f=MIGRA[v+1];if(f)j=f(j)||j;v++}j.v=Math.max(v,+j.v||1);return j}
async function onlLoadChar(){const q=c=>onlFetch('/rest/v1/personagens?select='+COLS+c+',inventario(item,equipado)&id=eq.'+ONL.uid);let r=null;ONL.profDb=true;ONL.mgkDb=true;ONL.verDb=true;ONL.ctDb=true;
 // colunas novas (proficiência: sql/03; Mangekyō: sql/06): se o banco ainda não tem, segue sem elas e guarda no aparelho
 for(let k=0;k<5;k++){try{r=await q((ONL.profDb?',proficiencia,prof_xp':'')+(ONL.mgkDb?',mangekyo':'')+(ONL.verDb?',versao':'')+(ONL.ctDb?',contrato,contrato_em':''));break}
  catch(e){const m=String(e.message);if(ONL.ctDb&&/contrato/.test(m))ONL.ctDb=false;else if(ONL.verDb&&/versao/.test(m))ONL.verDb=false;else if(ONL.mgkDb&&/mangekyo/.test(m))ONL.mgkDb=false;else if(ONL.profDb&&/proficiencia|prof_xp/.test(m))ONL.profDb=false;else throw e}}
 return r&&r[0]||null}
// uma informação por coluna (dá para editar cada uma no banco)
function onlCols(){const c={cla:clan,nivel:CH.lv,xp:CH.xp,pontos:CH.pts,forca:CH.st.str,agilidade:CH.st.agi,vitalidade:CH.st.vit,inteligencia:CH.st.int,destreza:CH.st.dex,sorte:CH.st.luk,mapa:CURMAP,pele:look.skin,cabelo:look.hair,roupa:look.cloth};
 if(ONL.profDb){const P=CH.prof||{};c.proficiencia=P.k||null;c.prof_xp=P.k?P.xp|0:0}if(ONL.mgkDb)c.mangekyo=EYES[CH.mgk]?CH.mgk:null;if(ONL.verDb)c.versao=Math.max(1,CH.v|0);if(ONL.ctDb){const t=CH.ct||{};c.contrato=t.k||null;c.contrato_em=t.k&&t.t?new Date(t.t).toISOString():null}return c}
function onlInv(){return INV.map(i=>({item:i,equipado:false})).concat(Object.values(EQ).map(i=>({item:i,equipado:true})),ONL.unk||[])}
async function onlSaveInv(rows){await onlFetch('/rest/v1/rpc/salvar_inventario',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({itens:rows})})}
async function onlCreateChar(){const c=onlCols(),inv=onlInv();
 await onlFetch('/rest/v1/personagens',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(Object.assign({id:ONL.uid,nome:ONL.nome},c))});
 if(inv.length)await onlSaveInv(inv);ONL.hasChar=true;ONL.dirty=false;ONL.last={cols:c,inv:JSON.stringify(inv)}}
// salva só o que mudou (assim uma edição feita no banco não é apagada à toa)
async function onlSave(keep){if(!ONL.on||!ONL.hasChar||ONL.saving||!clan)return;ONL.saving=true;ONL.dirty=false;
 const c=onlCols(),inv=onlInv(),invS=JSON.stringify(inv),L=ONL.last||{cols:{},inv:''},diff={};
 for(const k in c)if(c[k]!==L.cols[k])diff[k]=c[k];
 try{if(Object.keys(diff).length){diff.atualizado=new Date().toISOString();await onlFetch('/rest/v1/personagens?id=eq.'+ONL.uid,{method:'PATCH',keepalive:!!keep,headers:{Prefer:'return=minimal'},body:JSON.stringify(diff)});delete diff.atualizado;Object.assign(L.cols,diff)}
  if(invS!==L.inv){await onlSaveInv(inv);L.inv=invS}ONL.last=L}
 catch(e){ONL.dirty=true;if(e.status===401)onlRefresh()}ONL.saving=false}
setInterval(()=>{if(ONL.dirty)onlSave()},12000);
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&ONL.on)onlSave(true)});
addEventListener('pagehide',()=>{if(ONL.on)onlSave(true)});
{const a=chSave,b=invSave,c=stats;chSave=function(){a();ONL.dirty=true;gsMeta()};invSave=function(){b();ONL.dirty=true;setTimeout(gsMeta,50)};stats=function(){c();if(ONL.on)gsMeta()}}

// ---------- servidor de jogo ----------
function gsSend(o){const w=ONL.ws;if(!w||w.readyState!==1)return false;w.send(JSON.stringify(o));return true}
function gsConnect(){if(!ONL.on||ONL.ws||ONL.closing)return;
 let w;try{w=new WebSocket(GS_URL.replace(/^http/,'ws')+'/ws')}catch(e){gsRetry();return}
 ONL.ws=w;ONL.authed=false;ONL.joined=false;onlStatus();
 w.onopen=()=>{ONL.tries=0;gsSend({t:'auth',v:GS_PROTO,token:ONL.tok})};
 w.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch(_){return}try{gsMsg(m)}catch(e){console.error(e)}};
 w.onclose=()=>{ONL.ws=null;ONL.authed=false;ONL.joined=false;ONL.peers={};onlStatus();gsRetry()};
 w.onerror=()=>{}}
function gsRetry(){if(!ONL.on||ONL.closing)return;clearTimeout(ONL.retryT);ONL.tries++;ONL.retryT=setTimeout(gsConnect,Math.min(5000,800+ONL.tries*600));onlStatus()}
function gsJoin(){if(!ONL.authed||!clan)return;ONL.joined=false;ONL.peers={};E=[];EP=[];
 gsSend(Object.assign({t:'join',map:CURMAP,x:p.x|0,y:p.y|0,hp:Math.round(p.hp),max:p.max,sc:scene|0},onlMeta()))}
function onlMeta(){let d={esq:0,red:0};try{d=D()}catch(_){}return {clan,lv:CH.lv,eq:Object.values(EQ),look:{skin:look.skin,hair:look.hair,cloth:look.cloth},esq:Math.round(d.esq*10)/10,red:Math.round(d.red*10)/10,ey:EYE.on==='mgk'?2:EYE.on?1:BYK.on?3:0,
 ten:Math.round(tenac()*10)/10,rg:typeof BYK!=='undefined'&&BYK.on&&JU.hyuga&&JU.hyuga.byak?+JU.hyuga.byak.resGen||0:0,ct:ctFam()?CH.ct.k:null}}
let _gsmt=0;function gsMeta(){clearTimeout(_gsmt);_gsmt=setTimeout(()=>{if(ONL.joined)gsSend(Object.assign({t:'meta'},onlMeta()))},150)}
function onlPeer(id,o){if(id===ONL.uid)return null;let pe=ONL.peers[id];if(!pe){pe=ONL.peers[id]={id,nome:'?',clan:'uchiha',lv:1,eq:[],x:null,y:null,tx:0,ty:0,fl:0,mv:0,run:0,au:-1,th:-1,sc:0,hp:1,max:1,seen:performance.now(),say:'',sayT:0,g:0}}
 if(o){['nome','clan','lv','eq','look','g','adm','ey'].forEach(k=>{if(o[k]!==undefined)pe[k]=o[k]});if(o.x!=null){pe.tx=o.x;pe.ty=o.y;if(pe.x===null||!pe.buf){pe.x=o.x;pe.y=o.y;pe.buf=null}}['fl','mv','run','au','th','sc','hp','max'].forEach(k=>{if(o[k]!==undefined)pe[k]=o[k]})}
 return pe}
// ---------- Proficiência: uma especialidade principal, liberada pelos status e treinada usando os golpes daquele tipo.
// Cada uma tem vantagens (crescem com o rank) e desvantagens (fixas). Os textos ficam aqui para o NPC (futuro) usar os mesmos.
// st = % nos status · at = atributos (hp/mp em %, o resto em pontos de %; cdr positivo = recarga mais rápida) · oth = golpes dos outros tipos
const PROF={ // números (req, pv, st, at, oth) e ranks: server/balanceamento.json → proficiencia
 taijutsu:{n:'Taijutsu',ic:'👊',ds:'O corpo é a arma: forte, rápido e resistente, mas com pouco chakra.',perk:'recarga mais rápida'},
 ninjutsu:{n:'Ninjutsu',ic:'🌀',ds:'Mestre do chakra: muito chakra e técnicas fortes, mas o corpo é frágil.',perk:'gastam menos chakra'},
 genjutsu:{n:'Genjutsu',ic:'👁️',ds:'Ilusionista: prende e confunde o inimigo, mas apanha fácil e bate fraco de perto.',perk:'atordoam por mais tempo'},
 bukijutsu:{n:'Bukijutsu',ic:'✴️',ds:'Armas e precisão: críticos e golpes rápidos, mas pouca resistência.',perk:'mais chance de crítico'}};
for(const k in PROF)Object.assign(PROF[k],BAL.proficiencia.tipos[k]);
// ranks como os dos jutsus: XP mínima e bônus de dano (%) nos golpes do tipo
const PRK=BAL.proficiencia.ranks;
const STN={str:'Força',agi:'Agilidade',vit:'Vitalidade',int:'Inteligência',dex:'Destreza',luk:'Sorte'};
const ATN={hp:'Vida máxima',mp:'Chakra máximo',dmg:'Poder (físico e de chakra)',spd:'Velocidade',esq:'Esquiva',prec:'Precisão',red:'Redução de dano',crit:'Crítico',cdr:'Recarga',mpr:'Regeneração de chakra'};
// cada clã: golpe inicial · habilidade do meio · ultimate (botão grande). O item da mão tem um botão próprio.
{const U=CLANS.uchiha&&CLANS.uchiha.sk;if(U&&U.length===3&&U[0].n==='Ataque'){const sus=U[1],shar=U[2];
 U[0]={n:'Bola de Fogo',i:'🔥',cd:.9,mp:5,t:'proj',col:'#ff7a1a',dmg:16,sp:310,fire:1};
 // meio: o olho (Sharingan 1→2→3 tomoe; no Nv 40 evolui para a Mangekyō). Liga/desliga gastando chakra (aba Jutsus)
 U[1]={n:'Sharingan',ic:shar.ic,t:'eye',col:'#d01830',cd:6,mp:10};
 // grande: Susanoo — só com a Mangekyō ativada (cada olho tem o seu)
 U[2]={n:'Susanoo',ic:sus.ic,t:'sus',col:'#b3122e',cd:24,mp:40}}}
// ===== Equilíbrio dos golpes pelo rank do jutsu (E, D, C, B, A, S — como na obra) =====
// cada rank tem dano base, chakra e recarga; o papel ajusta o dano: f = 1 (dano), 0,8 (área), 0,3–0,4 (controle/atordoar)
const JRK=BAL.golpes.ranks; // balanceamento.json → golpes.ranks
// ===== Catálogo de jutsus de cada clã (balanceamento.json → golpes.jutsus) e a barra de botões (golpes.barra) =====
// JU[clã][id] = o jutsu (no formato que o jogo usa para soltar). Os 3 de hoje vêm de CLANS; os novos são definidos mais abaixo.
const JU={};
function juApply(s,b){const R=JRK[b.r]||{dmg:0,mp:0,cd:1};s.rk=b.r;s.dmg=Math.round((R.dmg||0)*(+b.f||0));s.mp=b.mp!=null?+b.mp:R.mp;s.cd=b.cd!=null?+b.cd:R.cd;s.mpPct=+b.mpPct||0;
 if(b.tel!=null)s.tel=+b.tel;if(b.stun!=null)s.stun=+b.stun;['queima','root','canal','alvos','ccPvp','tipo','papel','lv','pot','lento','silencio','dot','puxa','dur','red','exige','sombra','cdSombra','ccPve','raio','tiros','alcance','confusao','mgk','costas','prec','dreno','resGen','empurra','toques','total','evolui','divide','imune','nat'].forEach(k=>{if(b[k]!=null)s[k]=b[k]});
 if(b.raio!=null)s.r=+b.raio*T;return s}
for(const c in BAL.golpes.barra){JU[c]={};BAL.golpes.barra[c].forEach((id,i)=>{const s=CLANS[c]&&CLANS[c].sk[i];if(s){s.id=id;JU[c][id]=s}})}
function juLoad(c,id,def){const b=(BAL.golpes.jutsus[c]||{})[id];if(!b)return null;const s=JU[c][id]||(JU[c][id]=Object.assign({id},def||{}));return juApply(s,b)}
for(const c in BAL.golpes.jutsus)if(c[0]!=='_')for(const id in BAL.golpes.jutsus[c])if(id[0]!=='_'&&JU[c]&&JU[c][id])juLoad(c,id);
// Entrega 7b: jutsus novos (números no catálogo; aqui só o visual e o jeito de soltar)
juLoad('nara','nui',{n:'Kage Nui',i:'🪡',t:'nui',col:'#1a0f2e',sp:290});
juLoad('nara','kubi',{n:'Kubishibari',i:'🫳',t:'kubi',col:'#1a0f2e'});
juLoad('nara','yose',{n:'Kageyose',i:'🪝',t:'yose',col:'#1a0f2e',len:240});
juLoad('nara','campo',{n:'Campo de Sombras',i:'🌘',t:'campo',col:'#120a22'});
juLoad('nara','intelecto',{n:'Intelecto Nara',i:'♟️',t:'passiva'});
juLoad('nara','dominio',{n:'Domínio das Sombras',i:'🌑',t:'dominio',col:'#3a2060',fx:1});
juLoad('uchiha','goka',{n:'Gōkakyū (forte)',i:'☄️',t:'goka',col:'#ff7a1a',sp:250});
juLoad('uchiha','genj',{n:'Genjutsu: Sharingan',i:'🌀',t:'genj',col:'#c4143c'});
juLoad('uchiha','hosenka',{n:'Hōsenka',i:'🎇',t:'hosenka',col:'#ff7a1a',sp:330});
juLoad('uchiha','goryuka',{n:'Gōryūka',i:'🐉',t:'goryuka',col:'#ff5a1a',fx:1});
juLoad('uchiha','amat',{n:'Amaterasu',i:'🖤',t:'amat',col:'#1a0610'});
juLoad('uchiha','tsuku',{n:'Tsukuyomi',i:'🌕',t:'tsuku',col:'#c4143c'});
juLoad('hyuga','byak',{n:'Byakugan',i:'👁️',t:'byak',col:'#9db7ff'});
juLoad('hyuga','kusho',{n:'Hakke Kūshō',i:'💨',t:'kusho',col:'#cfe0ff'});
juLoad('hyuga','h128',{n:'128 Palmas',i:'☯️',t:'aoe',r:150,kq:'hakke',col:'#e3e9ff',fx:1,stun:3});
juLoad('hyuga','sojishi',{n:'Sōjishi',i:'🌬️',t:'sojishi',col:'#9db7ff'});
juLoad('hyuga','kperf',{n:'Kaiten Perfeito',i:'🌀',t:'kperf',col:'#cfe0ff'});
const juLv=s=>s&&s.lv?+s.lv:1;
// ===== Entrega 11: invocações (planilha 11) — números em balanceamento.json → invocacoes =====
// Um contrato por personagem (CH.ct = {k: família, t: quando escolheu}); a invocação (Kuchiyose) é um jutsu que entra na barra.
const INVB=BAL.invocacoes||{},INVF=INVB.familias||{},INV_ON=!!(BAL.flags&&BAL.flags.invocacoes!==false&&BAL.invocacoes&&INVB.familias);
const ctNorm=o=>{const k=o&&INVF[o.k]&&INVF[o.k].ativo?o.k:null;return{k,t:k?Math.max(0,+o.t||0):0}};
const ctLv=()=>+INVB.nivel||11;
function ctFam(){if(!INV_ON||!CH||!CH.ct||!CH.ct.k)return null;const f=INVF[CH.ct.k];return f&&f.ativo&&(CH.lv|0)>=ctLv()?f:null}
const ctPas=k=>{const f=ctFam();return f&&f.passiva?+f.passiva[k]||0:0};
const curaMul=()=>1+ctPas('cura')/100,dotMul=()=>1+ctPas('dot')/100; // contrato das lesmas: mais cura · das cobras: mais dano contínuo
if(INV_ON)for(const c in JU)JU[c].kuchi={id:'kuchi',n:'Kuchiyose',i:'📜',t:'kuchi',tipo:'ninjutsu',papel:'ativo',lv:ctLv(),col:'#b07cff',rk:'B',dmg:0,mp:0,mpPct:0,cd:60};
// números da invocação conforme o contrato escolhido (a cobra precisa de alguém no alcance)
function ctApply(){if(!INV_ON)return;const k=CH&&CH.ct&&CH.ct.k,f=k&&INVF[k];for(const c in JU){const s=JU[c].kuchi;if(!s)continue;
 for(const q of ['tel','alcance','dot','dur','stun'])delete s[q];
 if(f&&f.ativo){juApply(s,f);s.n=f.inv||'Kuchiyose';s.fam=k;s.alvo=k==='cobra'?1:0}else{s.n='Kuchiyose';s.fam=null;s.alvo=0}}}
// passiva do Nara (Intelecto): ligada a partir do nível dela
const naraInt=()=>{const s=clan==='nara'&&JU.nara&&JU.nara.intelecto;return s&&CH&&(CH.lv|0)>=juLv(s)?s:null};
function juCdMul(s){const n=s&&s.sombra?naraInt():null;return n?1-(+n.cdSombra||0)/100:1}
const ccPveMul=()=>{const n=naraInt();return n?1+(+n.ccPve||0)/100:1};
let HTP=null,profPick=null; // HTP = tipo do golpe que está acertando agora
const nf=x=>String(Math.round(x*10)/10).replace('.',','),sgn=x=>(x>0?'+':x<0?'−':'')+nf(Math.abs(x)),clv=(v,a,b)=>Math.max(a,Math.min(b,v));
function profNorm(o){const k=o&&PROF[o.k]?o.k:null;return{k,xp:k?Math.max(0,Math.min(1e7,o.xp|0)):0}}
function skType(i){const s=clan&&CLANS[clan]&&CLANS[clan].sk[i];if(s&&s.tipo)return s.tipo;return i===3?'ninjutsu':null} // botão 3 sem jutsu = item da mão (Chidori etc.)
function profRank(){const P=CH&&CH.prof;if(!P||!P.k)return -1;let r=0;PRK.forEach((x,i)=>{if(P.xp>=x[1])r=i});return r}
const profOn=tp=>!!(tp&&CH.prof&&CH.prof.k===tp),profDmg=()=>{const r=profRank();return r<0?0:PRK[r][2]},profPerk=()=>{const r=profRank();return r<0?0:PROF[CH.prof.k].pv*(r+1)};
// vantagens crescem com o rank: E 1x … S 2x; desvantagens não mudam
function profMods(){const P=CH&&CH.prof;if(!P||!P.k||!PROF[P.k])return null;const K=PROF[P.k],m=1+.2*profRank(),sc=o=>{const x={};for(const k in o)x[k]=o[k]>0?o[k]*m:o[k];return x};return{st:sc(K.st),at:sc(K.at)}}
function profOth(tp){const P=CH&&CH.prof;return P&&P.k&&tp&&PROF[P.k].oth[tp]||null}
// multiplicador da especialidade no dano de um tipo de golpe: sempre entre multMin e multMax (balanceamento.json → proficiencia; planilha 0,70–1,30)
function profTypeMul(tp){if(!tp)return 1;const B=BAL.proficiencia,o=profOth(tp),m=profOn(tp)?1+profDmg()/100:o&&o.dmg?1+o.dmg/100:1;return clv(m,B.multMin,B.multMax)}
function profMp(i){return profOn(skType(i))&&CH.prof.k==='ninjutsu'?1-profPerk()/100:1}
function profCd(i){const tp=skType(i);if(profOn(tp)&&CH.prof.k==='taijutsu')return 1-profPerk()/100;const o=profOth(tp);return o&&o.cd?1+o.cd/100:1}
// ===== Cálculo do personagem — sempre nesta ordem =====
// 1) STATUS:    base = pontos distribuídos + pontos dos itens  →  final = base × (1 + soma de TODAS as % daquele status)  (máx. 300)
// 2) ATRIBUTOS: valor vindo dos status finais + bônus fixos   →  final = isso × (1 + soma de TODAS as % daquele atributo)
// 3) GOLPE:     (dano da habilidade + Poder do tipo) × bônus da especialidade × 2 se crítico
//               Taijutsu e Bukijutsu usam o Poder físico (Força); Ninjutsu e Genjutsu, o Poder de chakra (Inteligência)
const STK=['str','agi','vit','int','dex','luk'],STMAX=BAL.personagem.statusMax;
// cada atributo (balanceamento.json → personagem.atributos): base + soma(status × por) (+ velocidade acima de 100% × velocidade) (+ nível × nivel)
// fx = chave fixa dos itens · pc = chave % dos itens · lo/hi = limites
const ATD={};for(const k in BAL.personagem.atributos){if(k[0]==='_')continue;const a=BAL.personagem.atributos[k];
 ATD[k]={f:(s,at)=>{let v=a.base||0;for(const q in a.por)v+=s[q]*a.por[q];if(a.velocidade)v+=(at.spd.fin-100)*a.velocidade;if(a.nivel)v+=CH.lv*a.nivel;return v},fx:a.fixo,pc:a.pct,lo:a.min,hi:a.max}}
// na especialidade, estes atributos são % (multiplicam o final); os outros são pontos fixos (somam antes das %)
const PROF_AT_PCT={hp:1,mp:1,dmg:1,spd:1,mpr:1};const CTAT={hp:'hp'};/* passiva do contrato que vira % de atributo (sapos: +% de vida) */const atSrc=k=>k==='pf'||k==='pc'?'dmg':k; // "dmg" da especialidade vale para os dois poderes
// retorno decrescente (balanceamento.json → personagem.retornoDecrescente): acima do início (80; VIT 90) cada ponto vale só a eficácia (50%)
function retDec(k,v){const R=BAL.personagem.retornoDecrescente,L=R&&R.inicio&&R.inicio[k];if(!(L>0)||v<=L)return v;return L+(v-L)*R.eficacia}
function calcChar(items,prof){const M=prof?profMods():null,A=items?AG:ZERO(),st={},S={},at={};
 for(const k of STK){const pts=CH.st[k],it=+A[k]||0,base=pts+it,pi=+A[k+'_pct']||0,pp=M?M.st[k]||0:0,pct=pi+pp;const bruto=clv(base*(1+pct/100),0,STMAX);S[k]=retDec(k,bruto);st[k]={pts,it,base,pi,pp,pct,bruto,fin:S[k],dr:S[k]<bruto}}
 for(const k in ATD){const d=ATD[k],q=atSrc(k),fromSt=d.f(S,at),fi=d.fx?+A[d.fx]||0:0,fp=M&&!PROF_AT_PCT[q]?M.at[q]||0:0,pi=d.pc?+A[d.pc]||0:0,pp=M&&PROF_AT_PCT[q]?M.at[q]||0:0,pk=CTAT[k]?ctPas(CTAT[k]):0,pct=pi+pp+pk;
  at[k]={fromSt,fi,fp,fl:fi+fp,pi,pp,pk,pct,fin:clv((fromSt+fi+fp)*(1+pct/100),d.lo==null?-1e9:d.lo,d.hi==null?1e9:d.hi)}}
 return{st,at}}
// formato usado pelo jogo: spd/mpr = bônus em % sobre o normal; pf/pc = poder somado aos golpes
const isChakra=tp=>tp==='ninjutsu'||tp==='genjutsu';
// esquiva: 5% + (minha Esquiva − Precisão de quem ataca), entre 0% e 35% (balanceamento.json → combate; o servidor usa a mesma conta)
let HPREC=0;const dodgeChance=prec=>clv(BAL.combate.esquivaBase+D().esq-(+prec||0),BAL.combate.esquivaMin,BAL.combate.esquivaMax);
function skPow(tp){const d=D();return isChakra(tp)?d.pc:d.pf}
// etapa 3: (dano da habilidade + poder do tipo) × bônus da especialidade, depois o crítico
let HMUL=1; // golpes contínuos (64 Palmas) dividem o dano entre os toques
// tipo do golpe: "@ninjutsu" = habilidade do item da mão (conta como Ninjutsu, mas não é jutsu do clã)
const tpN=t=>{if(typeof t!=='string')return t;const s=t[0]==='@'?t.slice(1):t,i=s.indexOf('#');return i<0?s:s.slice(0,i)}; // tipo do golpe (sem o @ do item e sem o #jutsu)
const tpJ=t=>typeof t==='string'&&t.indexOf('#')>=0?t.slice(t.indexOf('#')+1):undefined; // jutsu que está acertando (o servidor tira a natureza dele)
const htpDe=(tipo,id)=>tipo?(id?tipo+'#'+id:tipo):null;
// planilha 12: crítico ×1,5 em monstros e ×1,3 em jogadores; no PvP o bônus de % de dano dos itens vale no máximo pvp.itemDanoMax
const critPve=()=>+BAL.combate.critMultPve||BAL.combate.critMult,critPvp=()=>+BAL.combate.critMultPvp||BAL.combate.critMult;
function powPvp(t){const cap=+(BAL.pvp&&BAL.pvp.itemDanoMax),o=+AG.dmg_pct||0;if(!(cap>=0)||o<=cap)return skPow(t);AG.dmg_pct=cap;try{const a=calcChar(1,1).at;return isChakra(t)?a.pc.fin:a.pf.fin}finally{AG.dmg_pct=o}}
function hitRawPvp(base,tp){const it=typeof tp==='string'&&tp[0]==='@',t=tpN(tp),b=bufSum();return (base+powPvp(t))*profTypeMul(t)*HMUL*(1+b.dmg/100)*(it?1:1+b.cdmg/100)}
function hitRaw(base,tp){const it=typeof tp==='string'&&tp[0]==='@',t=tpN(tp),b=bufSum();return (base+skPow(t))*profTypeMul(t)*HMUL*(1+b.dmg/100)*(it?1:1+b.cdmg/100)}
// reforços temporários (Sharingan +esquiva, Mangekyō +dano, Susanoo −dano recebido…): cada um tem seu tempo e eles somam
let BUFS={};
function bufSum(){const n=performance.now(),o={red:0,esq:0,dmg:0,cdmg:0,prec:0,spd:0};for(const k in BUFS){const b=BUFS[k];if(b.until>n)for(const q in o)o[q]+=b[q]||0}return o}
function bufOn(k){const n=performance.now();if(k)return !!(BUFS[k]&&BUFS[k].until>n);for(const q in BUFS)if(BUFS[q].until>n)return true;return false}
function DX(items,prof){const a=calcChar(items,prof).at,b=bufSum();return{hp:Math.round(a.hp.fin),mp:Math.round(a.mp.fin),pf:a.pf.fin,pc:a.pc.fin,dmg:b.dmg,spd:a.spd.fin-100+b.spd,mpr:a.mpr.fin-100,esq:a.esq.fin+b.esq,prec:a.prec.fin+b.prec,red:Math.min(BAL.combate.reducaoMax,a.red.fin+b.red),crit:a.crit.fin,cdr:a.cdr.fin}}
function bufStart(key,B,aura){BUFS[key]={red:B.red||0,esq:B.esq||0,dmg:B.dmg||0,spd:B.spd||0,until:performance.now()+B.t*1000,t:B.t,nm:B.nm||key};if(aura){p.au=0;p.aud=B.t}stats();bufHud(1);
 FT.push({x:p.x,y:p.y-66-Object.keys(BUFS).length*14,t:String(B.nm||key).split(':')[0]+'!',txt:1,gold:1,life:1.2});onlReg('✨ '+B.nm+' por '+B.t+' s.')}
function bufTick(){const n=performance.now();let ch=0;for(const k in BUFS)if(BUFS[k].until<=n){delete BUFS[k];ch=1}if(ch)stats();bufHud(ch)}
function bufClear(){if(!Object.keys(BUFS).length)return;BUFS={};stats();bufHud(1)}
// chips no canto com os reforços ativos e quantos segundos faltam
function bufHud(force){const el=document.getElementById('bufs');if(!el)return;const n=performance.now();if(!force&&n-(bufHud.t||0)<250)return;bufHud.t=n;
 const h=Object.entries(BUFS).filter(([k,b])=>b.until>n).map(([k,b])=>'<span'+(b.until===Infinity?' class="on"':'')+'>'+stIc(stDeBuf(k,b))+String(b.nm).split(':')[0].replace(/[<>&]/g,'')+(k==='sus'&&SHD?' 🛡'+Math.ceil(SHD.v):'')+(k==='inv'&&SHT?' 🛡'+Math.ceil(SHT.v):'')+' <b>'+(b.until===Infinity?'ativado':Math.ceil((b.until-n)/1000)+'s')+'</b></span>').join('')+ccChips();if(el._h!==h){el._h=h;el.innerHTML=h}}
function effSt(prof){const c=calcChar(1,prof),o={};for(const k of STK)o[k]=c.st[k].fin;return o}
const profReqOk=k=>Object.entries(PROF[k].req).every(([s,v])=>CH.st[s]>=v);
function profSkills(k){if(!clan||!JU[clan])return[];return Object.values(JU[clan]).filter(s=>s.tipo===k&&s.t!=='kuchi').map(s=>s.n).concat(k==='ninjutsu'&&atkItem()?[atkItem().name]:[])}
function profPerkTxt(k,r){const v=PROF[k].pv*(r+1);return k==='taijutsu'?'−'+nf(v)+'% de recarga':k==='ninjutsu'?'−'+nf(v)+'% de chakra':k==='genjutsu'?'+'+nf(v)+'% de atordoamento':'+'+nf(v)+'% de crítico'}
// listas de vantagens/desvantagens no rank r (r<0 = como fica ao escolher, rank E)
function profLines(k,r){const K=PROF[k],rr=Math.max(0,r),m=1+.2*rr,up=[],dn=[];
 up.push('Golpes de '+K.n+': +'+PRK[rr][2]+'% de dano e '+profPerkTxt(k,rr));
 for(const s in K.st){const v=K.st[s]>0?K.st[s]*m:K.st[s];(v>0?up:dn).push(STN[s]+' '+sgn(v)+'%')}
 for(const a in K.at){const v=K.at[a]>0?K.at[a]*m:K.at[a],pc=PROF_AT_PCT[a];(v>0?up:dn).push(a==='cdr'?'Recarga '+sgn(-v)+' pontos':ATN[a]+' '+sgn(v)+(pc?'%':' pontos'))}
 for(const t in K.oth){const o=K.oth[t];dn.push('Golpes de '+PROF[t].n+': '+[o.dmg?sgn(o.dmg)+'% de dano':'',o.cd?'+'+o.cd+'% de recarga':''].filter(Boolean).join(' e '))}
 return{up,dn}}
const ulist=(L,c)=>'<ul class="pfl p'+c+'">'+L.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
function profSave(){try{localStorage.setItem(chKey(),JSON.stringify(CH))}catch(_){}ONL.dirty=true}
function profGain(base){const P=CH.prof;if(!P||!P.k)return;const r0=profRank();P.xp+=Math.max(1,Math.round(base/8));profSave();const r1=profRank();
 if(r1>r0){const t=PROF[P.k].n+' subiu para o rank '+PRK[r1][0]+'!';FT.push({x:p.x,y:p.y-92,t,txt:1,gold:1,life:1.8});fx.push({k:'ring',x:p.x,y:p.y-8,r:70,col:'#ffc94a',life:.6,max:.6,sp:1});toast('🎖️ '+t);onlReg('🎖️ '+t+' As vantagens ficaram mais fortes.');stats()}
 if(!$('#paneSt').hidden&&!$('#inv').hidden)profDraw()}
function profChoose(k){if(!PROF[k]||!profReqOk(k))return;const P=CH.prof||(CH.prof={k:null,xp:0});
 if(P.k&&P.k!==k&&profPick!==k){profPick=k;profDraw();return} // trocar pede confirmação: zera o progresso
 P.k=k;P.xp=0;profPick=null;profSave();stats();onlReg('🎖️ Especialidade escolhida: '+PROF[k].n+'.')}
function profDraw(){const el=$('#stProf');if(!el||!CH)return;CH.prof=profNorm(CH.prof);const P=CH.prof,r=profRank();let h='';
 const lib=Object.keys(PROF).filter(profReqOk);if(!P.k&&lib.length&&!profDraw.told&&cur==='game'){profDraw.told=1;setTimeout(()=>{toast('🎖️ Você já pode escolher uma especialidade: '+lib.map(k=>PROF[k].n).join(', ')+' (aba Status).');onlReg('🎖️ Especialidade liberada: '+lib.map(k=>PROF[k].n).join(', ')+'. Escolha na aba Status.')},600)}
 if(P.k&&!profPick){const K=PROF[P.k],nx=PRK[r+1],pc=nx?Math.min(100,(P.xp-PRK[r][1])/(nx[1]-PRK[r][1])*100):100,sk=profSkills(P.k),L=profLines(P.k,r);
  h+='<div class="pfc"><div class="pfh"><span class="pfi">'+K.ic+'</span><div><b>'+K.n+'</b><small>'+K.ds+'</small></div><span class="pfr">'+PRK[r][0]+'</span></div>'
   +'<div class="bar xpb big"><i style="width:'+pc+'%"></i><b>'+(nx?'Rank '+nx[0]+' em '+(nx[1]-P.xp)+' de treino':'Rank máximo')+'</b></div>'
   +'<div class="pfud"><div><div class="pft pup">Vantagens (rank '+PRK[r][0]+')</div>'+ulist(L.up,'up')+'</div><div><div class="pft pdn">Desvantagens</div>'+ulist(L.dn,'dn')+'</div></div>'
   +'<p class="pfd">'+(sk.length?'Treina acertando inimigos com: <b>'+sk.join(', ')+'</b>. As vantagens crescem a cada rank (no S ficam o dobro).':'⚠️ Nenhum dos seus golpes atuais é desse tipo: ela não sobe e só deixa as desvantagens.')+'</p>'
   +'<button class="pfx" data-trocar="1">Trocar especialidade</button></div>'}
 else{h+='<p class="pfd">'+(P.k?'Escolha a nova especialidade. <b>Trocar zera o progresso</b> (volta para o rank E).':'Escolha uma especialidade principal. Cada uma é liberada por um status, tem <b>vantagens e desvantagens</b> e sobe usando os golpes daquele tipo em combate.')+'</p><div class="pfg">';
  Object.entries(PROF).forEach(([k,K])=>{const ok=profReqOk(k),sk=profSkills(k),cur=P.k===k,conf=profPick===k,L=profLines(k,-1);
   h+='<div class="pfo'+(ok?'':' lock')+(cur?' cur':'')+'"><div class="pfh"><span class="pfi">'+K.ic+'</span><div><b>'+K.n+'</b><small>'+K.ds+'</small></div></div>'
    +'<div class="pfq">'+(ok?'✓ ':'🔒 ')+'Precisa: '+Object.entries(K.req).map(([s,v])=>STN[s]+' '+v+' <span>(você: '+CH.st[s]+')</span>').join(' · ')+'</div>'
    +'<div class="pft pup">Vantagens no rank E <span>(dobram até o S)</span></div>'+ulist(L.up,'up')+'<div class="pft pdn">Desvantagens</div>'+ulist(L.dn,'dn')
    +'<div class="pfq">Seus golpes desse tipo: '+(sk.length?sk.join(', '):'nenhum')+'</div>'
    +'<button data-prof="'+k+'"'+(ok&&!cur?'':' disabled')+(conf?' class="conf"':'')+'>'+(cur?'Atual':!ok?'Bloqueada':conf?'Confirmar troca':'Escolher')+'</button></div>'});
  h+='</div>'+(P.k?'<button class="pfx" data-voltar="1">Cancelar</button>':'')}
 el.innerHTML=h;
 el.querySelectorAll('[data-prof]').forEach(b=>b.onclick=()=>profChoose(b.dataset.prof));
 const tr=el.querySelector('[data-trocar]');if(tr)tr.onclick=()=>{profPick='?';profDraw()};
 const vt=el.querySelector('[data-voltar]');if(vt)vt.onclick=()=>{profPick=null;profDraw()}}
// golpes usados agora: marca o tipo para o bônus/treino
{const _c=cast;cast=function(i){if(actRoot())return;{const s=CLANS[clan]&&CLANS[clan].sk[i];if(s&&seloBloqueia(mpOf(i,s)))return seloAviso();if(s&&silBloqueia(s))return silAviso();
  if(s&&s.t==='kuchi'&&cd[i]<=0&&invAtiva()){if(!cast._v||performance.now()-cast._v>900){cast._v=performance.now();FT.push({x:p.x,y:p.y-70,t:'já tem uma invocação',txt:1,life:.9})}return}
  if(s&&(JALVO[s.t]||s.alvo)&&cd[i]<=0&&!alvoPerto(+s.alcance||5)&&!(s.mgk&&EYE.on!=='mgk')){if(!cast._a||performance.now()-cast._a>900){cast._a=performance.now();FT.push({x:p.x,y:p.y-70,t:'ninguém no alcance',txt:1,life:.9})}return}
  if(s&&s.mgk&&cd[i]<=0&&EYE.on!=='mgk'){if(!cast._m||performance.now()-cast._m>900){cast._m=performance.now();FT.push({x:p.x,y:p.y-70,t:'ligue a Mangekyō',txt:1,life:.9});toast('👁️ '+s.n+': só com a Mangekyō ativada.')}return}
  if(s&&s.exige==='sombra'&&cd[i]<=0&&!sombraPresos().length){if(!cast._k||performance.now()-cast._k>900){cast._k=performance.now();FT.push({x:p.x,y:p.y-70,t:'ninguém preso na sombra',txt:1,life:.9});toast('🫳 '+s.n+': prenda alguém com o Kagemane antes.')}return}}if(PST>0){if(!cast._t||performance.now()-cast._t>600){cast._t=performance.now();FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7})}return}
 const sk=CLANS[clan]&&CLANS[clan].sk[i],c0=cd[i];HTP=htpDe(skType(i),sk&&sk.id);try{_c(i)}finally{HTP=null}
 if(sk&&sk.buf&&cd[i]>c0)bufStart('sk'+i,sk.buf,sk.aura)}} // só se o golpe saiu de verdade (entrou em recarga)
const GMK=['x','y','hp','max','dead','dt','mv','fl','ch','lunge','ja','jz','jc','jx','jy','stun','hurt','rt','root','lento','conf'];
// ---------- interpolação: cada um é desenhado um pouquinho "no passado", entre duas fotos do servidor.
// Assim o movimento fica contínuo (sem o acelera-e-freia de correr atrás da última posição).
const IP={dm:110,dp:120,ext:120};
// converte a hora de quem mandou (servidor ou outro celular) para o relógio deste aparelho, sem o tremido da rede
function ipClock(o,key,remote){const now=performance.now();if(remote==null||!isFinite(remote))return now;const d=now-remote;
 if(o[key]==null||d<o[key]||d-o[key]>3000)o[key]=d;else o[key]+=(d-o[key])*.01;return remote+o[key]}
function ipPush(o,t,smp){const b=o.buf||(o.buf=[]),L=b[b.length-1];
 if(L){if(t<=L.t)t=L.t+1;if(t-L.t>180)b.push(Object.assign({},L,{t:t-70}))} // estava parado: segura até pouco antes de andar
 smp.t=t;b.push(smp);while(b.length>3&&b[1].t<t-1000)b.shift();if(b.length>24)b.shift()}
function ipAt(o,rt){const b=o.buf;if(!b||!b.length)return null;if(rt<=b[0].t)return{x:b[0].x,y:b[0].y,jz:b[0].jz||0,s:b[0]};
 for(let i=b.length-1;i>=0;i--){const a=b[i];if(a.t>rt)continue;const n=b[i+1];
  if(n){const k=(rt-a.t)/(n.t-a.t);return{x:a.x+(n.x-a.x)*k,y:a.y+(n.y-a.y)*k,jz:(a.jz||0)+((n.jz||0)-(a.jz||0))*k,s:a}}
  const pv=b[i-1],dt=Math.min(rt-a.t,IP.ext); // passou da última foto: continua um tiquinho na mesma direção e para
  if(pv&&a.mv&&a.t>pv.t){const q=dt/(a.t-pv.t);return{x:a.x+(a.x-pv.x)*q,y:a.y+(a.y-pv.y)*q,jz:a.jz||0,s:a}}
  return{x:a.x,y:a.y,jz:a.jz||0,s:a}}
 return null}
function gsMob(def){let e=E.find(x=>x.sid===def.id);if(e)e.lv=def.lv||e.lv;if(!e){e={sid:def.id,id:E.length,t:def.t||'',kind:def.kind,boss:def.boss,rad:def.rad,nome:def.nome,lv:def.lv||1,max:def.max,hp:def.max,x:0,y:0,dead:0,dt:0,mv:0,fl:0,ch:0,lunge:0,ja:0,jz:0,jc:0,jx:0,jy:0,stun:0,hurt:0,hit:0,rt:0,sn:null,dir:0,wt:0,atk:0,lunge0:0};E.push(e)}return e}
function gsMobState(e,a,t){const s={};GMK.forEach((k,j)=>s[k]=a[j]);const wasDead=!!e.dead;if(t==null)t=performance.now();
 if(e.sn){const dx=s.x-e.sn.x,dy=s.y-e.sn.y;if(Math.abs(dx)+Math.abs(dy)>.5)e.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?2:3):(dy<0?1:0)}
 if(!e.sn||Math.hypot(s.x-e.x,s.y-e.y)>260||wasDead!==!!s.dead){e.x=s.x;e.y=s.y;e.jz=s.jz;e.buf=null;e.fl=!!s.fl;e.mv=s.mv}
 ipPush(e,t,{x:s.x,y:s.y,jz:s.jz||0,fl:s.fl,mv:s.mv});
 e.sn=s;['hp','max','ch','lunge','ja','jc','jx','jy','stun','rt','root','lento','conf'].forEach(k=>e[k]=s[k]);if(s.hurt>(e.hurt||0))e.hurt=s.hurt;
 if(s.dead&&!wasDead){e.dead=1;e.dt=s.dt}else if(!s.dead&&wasDead){e.dead=0;e.dt=0}}
const MTIM=['lunge','ch','jc','ja','stun','hurt','root','lento','conf'];
function gsMobFollow(dt){const rt=performance.now()-IP.dm;
 for(const e of E){e.hit=Math.max(0,(e.hit||0)-dt);if(!e.sn)continue;if(e.dead){e.dt=(e.dt||0)+dt;continue}
  const r=ipAt(e,rt);if(r){e.x=r.x;e.y=r.y;e.jz=r.jz;e.fl=!!r.s.fl;e.mv=r.s.mv}
  for(const q of MTIM)if(e[q]>0)e[q]=Math.max(0,e[q]-dt)}}
// golpes do jogador vão para o servidor (ele decide a vida da raposa)
function gsHit(e,d,st,kx,ky){if(!ONL.on)return false;if(e.pvp)return pvpHit(e,d,st,kx,ky);if(!e.sid||e.dead||!ONL.joined)return true;
 const tp=tpN(HTP),pf=profOn(tp),base=d,x=hitRaw(d,HTP);if(pf&&st&&tp==='genjutsu')st*=1+profPerk()/100;
 lastCrit=Math.random()*100<D().crit||(pf&&tp==='bukijutsu'&&Math.random()*100<profPerk());d=Math.max(1,Math.round(lastCrit?x*critPve():x));if(pf)profGain(base*HMUL);
 const cm=ccPveMul(),H=HCC||{};if(H.lento&&+H.lento.t>0)FT.push({x:e.x,y:e.y-(e.boss?110:46),t:'lento',txt:1,life:.6});
 gsSend({t:'hit',m:e.sid,j:tpJ(HTP),d,st:(st||0)*cm,rt:(H.root||0)*cm,lt:H.lento?(+H.lento.t||0)*cm:0,lp:H.lento?+H.lento.v||0:0,cf:(+H.confusao||0)*cm,kx:+(kx||0).toFixed(1),ky:+(ky||0).toFixed(1),c:lastCrit?1:0,pr:Math.round(D().prec)});return true}
// ---------- PvP: quem não está no seu grupo pode ser atacado (menos na zona segura em volta do ponto de início) ----------
// quem bate calcula o golpe igual ao dos monstros; o servidor confere (mapa, distância, grupo, zona segura) e repassa;
// o alvo sorteia a esquiva (Esquiva dele x sua Precisão), aplica a redução e conta o resultado para todo mundo ver.
const PVP={on:1,safe:4};let PST=0,HRES={miss:0,d:0,dead:0},pvpTold=0;
// PRT = preso no lugar (não anda, mas usa golpes) · PSL = chakra selado (só jutsu que custa até seloLimite% do chakra) · SHD = escudo do Susanoo
// PSI = silenciado (Kubishibari, Domínio das Sombras): só o golpe básico funciona
let PRT=0,PSL=0,PSI=0,PCF=0,SHD=null,HCC=null; // PCF = confuso (Genjutsu: Sharingan): anda ao contrário até levar dano
 // HCC = efeito do golpe que está acertando agora (como HTP): {root, selo, queima, lento:{v,t}, silencio, pj (projétil), semStunPvp}
function ccTick(dt){if(PRT>0)PRT=Math.max(0,PRT-dt);if(PSL>0)PSL=Math.max(0,PSL-dt);if(PSI>0)PSI=Math.max(0,PSI-dt);if(PCF>0)PCF=Math.max(0,PCF-dt);if(SHD&&SHD.until<=performance.now())SHD=null}
function ccChips(){const L=[];if(PRT>0)L.push('<span class="cc">'+stIc('st_preso')+'Preso <b>'+Math.ceil(PRT)+'s</b></span>');if(PSL>0)L.push('<span class="cc">'+stIc('st_selo')+'Chakra selado <b>'+Math.ceil(PSL)+'s</b></span>');if(PSI>0)L.push('<span class="cc">Silenciado <b>'+Math.ceil(PSI)+'s</b></span>');if(PCF>0)L.push('<span class="cc">'+stIc('st_confuso')+'Confuso <b>'+Math.ceil(PCF)+'s</b></span>');return L.join('')}
const silBloqueia=s=>PSI>0&&!(s&&s.papel==='basico');
function silAviso(){if(!silAviso._t||performance.now()-silAviso._t>700){silAviso._t=performance.now();FT.push({x:p.x,y:p.y-70,t:'silenciado',txt:1,life:.8})}}
// efeitos do golpe que está acertando (HCC) no formato do servidor: um só ({k…}) ou até 2 juntos (lista)
function ccDeHCC(H){const L=[];if(!H)return undefined;if(H.root)L.push({k:'root',t:+H.root});if(H.silencio)L.push({k:'silencio',t:+H.silencio});if(H.selo)L.push({k:'selo',t:+H.selo});if(H.queima)L.push({k:'queima',v:+H.queima});if(H.lento&&+H.lento.t>0)L.push({k:'lento',t:+H.lento.t,v:+H.lento.v||0});if(H.confusao)L.push({k:'confusao',t:+H.confusao});
 return L.length>1?L.slice(0,2):L[0]}
function seloBloqueia(mp){return PSL>0&&mp>BAL.golpes.seloLimite/100*p.mpMax}
function seloAviso(){if(!seloAviso._t||performance.now()-seloAviso._t>700){seloAviso._t=performance.now();FT.push({x:p.x,y:p.y-70,t:'chakra selado',txt:1,life:.8})}}
// efeito recebido no PvP (o servidor confere e repassa)
// naturezas (planilha 07): nome e o que fazem; o servidor aplica forte/fraco e o efeito no PvP
const NATT=(BAL.naturezas&&BAL.naturezas.tipos)||{},natNome=k=>(NATT[k]||{}).n||k||'';
function natEfTxt(k){const e=(NATT[k]||{}).efeito||{};return e.k==='queima'?'queima '+e.pct+'% da vida em '+e.t+' s':e.k==='pen'?'atravessa '+e.v+'% da redução':e.k==='para'?'paralisa '+nf(e.t)+' s':e.k==='lento'?'deixa '+e.v+'% lento por '+e.t+' s':e.k==='controle'?'prender, silenciar e genjutsu duram '+e.pct+'% a mais':e.k==='escudo'?'escudo de '+e.pct+'% da vida':e.k==='cura'?'+'+e.pct+'% de cura recebida':''}
function natRel(k){const a=NATT[k]||{};return (a.forte?'forte contra '+natNome(a.forte):'')+(a.forte&&a.fraco?', ':'')+(a.fraco?'fraco contra '+natNome(a.fraco):'')||'neutro'}
const CCNM={stun:'atordoar',root:'prender',sil:'silêncio/selo',lento:'lentidão',gen:'genjutsu',desl:'empurrão'};
function ccImune(L){if(!Array.isArray(L)||!L.length)return;const t='imune a '+L.map(k=>CCNM[k]||k).join(', ');FT.push({x:p.x,y:p.y-92,t,txt:1,gold:1,life:1.2});
 if(!ccImune._t||performance.now()-ccImune._t>3000){ccImune._t=performance.now();onlReg('🛡️ Você ficou '+t+' por alguns segundos.')}}
// tenacidade: VIT final × tenacidadeVit %, até tenacidadeMax (encurta todo controle no PvP; o servidor aplica)
function tenac(){try{const c=calcChar(1,1);return Math.min(+BAL.cc.tenacidadeMax||30,(c.st.vit.fin||0)*(+BAL.cc.tenacidadeVit||0))}catch(_){return 0}}
function ccRecebe(cc,src){if(Array.isArray(cc)){cc.forEach(c=>ccRecebe(c,src));return}if(!cc||!cc.k)return;const t=+cc.t||0;
 if(cc.k==='lento'&&t>0){const v=Math.max(0,Math.min(60,+cc.v||0));bufStart('lento',{spd:-v,t,nm:'Lento: '+v+'% mais devagar'});FT.push({x:p.x,y:p.y-70,t:'lento',txt:1,life:.8});onlReg('🪡 '+(src||'?')+' deixou você lento ('+v+'%, '+nf(t)+' s).');return}
 if(cc.k==='confusao'&&t>0){const t2=t;PCF=Math.max(PCF,t2);FT.push({x:p.x,y:p.y-84,t:'confuso',txt:1,life:1});onlReg('🌀 '+(src||'?')+' prendeu você num genjutsu ('+nf(t2)+' s'+'), controles invertidos.');return}
 if(cc.k==='silencio'&&t>0){PSI=Math.max(PSI,t);FT.push({x:p.x,y:p.y-84,t:'silenciado',txt:1,life:1});onlReg('🤐 '+(src||'?')+' silenciou você ('+nf(t)+' s).');return}
 if(cc.k==='root'&&t>0){PRT=Math.max(PRT,t);FT.push({x:p.x,y:p.y-70,t:'preso pela sombra',txt:1,life:1});onlReg('🌑 '+(src||'?')+' prendeu você no lugar ('+nf(t)+' s).')}
 else if(cc.k==='selo'&&t>0){PSL=Math.max(PSL,t);FT.push({x:p.x,y:p.y-70,t:'chakra selado',txt:1,life:1});onlReg('✋ '+(src||'?')+' selou o seu chakra ('+nf(t)+' s).')}
 else if(cc.k==='queima'){const v=Math.min(p.mp,(+cc.v||0)/100*p.mpMax);if(v>0){p.mp-=v;FT.push({x:p.x+14,y:p.y-60,t:'−'+Math.round(v)+' chakra',txt:1,life:.8})}}}
// escudo: absorve dano antes da vida; quando quebra, o Susanoo se desfaz
function shieldAbsorb(n){n=sapoAbsorb(n);if(!SHD||SHD.until<=performance.now()||SHD.v<=0)return n;const a=Math.min(n,SHD.v);SHD.v-=a;
 if(a>0)FT.push({x:p.x-16,y:p.y-64,t:'🛡'+Math.round(a),txt:1,life:.7});
 if(SHD.v<=0){SHD=null;FT.push({x:p.x,y:p.y-84,t:'escudo quebrou',txt:1,life:1});onlReg('🛡️ O escudo do Susanoo quebrou.');setTimeout(()=>{if(typeof susEnd==='function')susEnd()},0)}
 bufHud(1);return n-a}
// dano já decidido pelo servidor (PvP): aplica direto, sem sortear de novo
function hurtFix(n,miss,crit){HRES={miss:0,d:0,dead:0};if(miss){HRES.miss=1;FT.push({x:p.x,y:p.y-56,t:'esquivou',txt:1,life:.8});return}
 n=Math.max(1,Math.round(n));n=shieldAbsorb(n);p.hp-=n;HRES.d=n;flash={col:'#e0483a',a:.25};if(n>0)FT.push({x:p.x,y:p.y-52,t:crit?n+'!':n,life:.8,r:1,crit:crit});
 if(p.hp<=0){HRES.dead=1;p.hp=p.max;scene=0;p.x=SPAWN[0]*T;p.y=SPAWN[1]*T;flash={col:'#000',a:.6}}}
const pvpSafeAt=(x,y)=>!!(PVP.safe>0&&SPAWN&&Math.hypot(x-SPAWN[0]*T,y-SPAWN[1]*T)<PVP.safe*T);
// jogadores que podem ser atingidos agora (entram nas mesmas contas de acerto dos monstros)
function PVT(){if(!ONL.on||!ONL.joined||!PVP.on||(scene|0))return [];const L=[];
 for(const id in ONL.peers){const pe=ONL.peers[id];if(pe.x===null||pe.sc!==(scene|0)||inGrp(id)||!(pe.hp>0))continue;
  const o=pe._pv||(pe._pv={pvp:id,rad:16,boss:0,dead:0,kind:'pvp'});o.x=pe.x;o.y=pe.y;o.nome=pe.nome;o.fl=pe.fl?1:0;L.push(o)}return L}
function pvpSafeMsg(pe){if(pe)FT.push({x:pe.x,y:pe.y-60,t:'zona segura',txt:1,life:.8});const now=performance.now();if(!pvpSafeMsg.t||now-pvpSafeMsg.t>6000){pvpSafeMsg.t=now;onlReg('🛡️ Zona segura: aqui ninguém ataca nem é atacado.')}}
function pvpHit(e,d,st,kx,ky){const pe=ONL.peers[e.pvp];if(!pe||!ONL.joined)return true;
 if(pvpSafeAt(pe.x,pe.y)||pvpSafeAt(p.x,p.y)){pvpSafeMsg(pe);return true}
 const tp=tpN(HTP),pf=profOn(tp),x=hitRawPvp(d,HTP);if(pf&&st&&tp==='genjutsu')st*=1+profPerk()/100;
 lastCrit=Math.random()*100<D().crit||(pf&&tp==='bukijutsu'&&Math.random()*100<profPerk());
 const H=HCC||{},cc=ccDeHCC(H);if(H.semStunPvp)st=0;
 const pen=tp==='taijutsu'&&clan==='hyuga'?+BAL.cc.jukenPen||0:tp==='genjutsu'&&EYE.on==='mgk'?+BAL.cc.mangekyoPen||0:0;
 gsSend({t:'pvp',to:e.pvp,j:tpJ(HTP),d:Math.max(1,Math.round(lastCrit?x*critPvp():x)),st:st||0,g:st&&tp==='genjutsu'?1:undefined,pen:pen||undefined,kx:+(kx||0).toFixed(1),ky:+(ky||0).toFixed(1),c:lastCrit?1:0,pr:Math.round(D().prec),pj:H.pj?1:0,cc:cc||undefined,vn:H.veneno?1:undefined,dr:drenoOn()?1:undefined});pe.hitT=.12;ONL.pvpT=performance.now();return true}
function pvpShow(m){const pe=ONL.peers[m.to];if(m.safe){pvpSafeMsg(pe);return}
 if(m.to===ONL.uid||!pe||pe.sc!==(scene|0))return; // quem apanhou já viu o próprio número
 const me=m.by===ONL.uid,y=pe.y-60;
 if(m.blk){FT.push({x:pe.x,y,t:'defendeu',txt:1,life:.8});if(me)onlReg('🌀 '+pe.nome+' bloqueou com o Kaiten');return}
 if(m.miss){FT.push({x:pe.x,y,t:'esquivou',txt:1,life:.8});if(me)regMiss(pe.nome);return}
 if(m.nm>1)FT.push({x:pe.x-18,y:y-14,t:'forte!',txt:1,gold:1,life:.9});else if(m.nm<1)FT.push({x:pe.x-18,y:y-14,t:'fraco',txt:1,life:.9});
 pe.hitT=.18;FT.push({x:pe.x+(me?0:Math.random()*20-10),y,t:m.c?m.d+'!':m.d,life:me?.8:.7,crit:m.c,oth:me?0:1});if(me)regDmg('pout',m.d,m.c,pe.nome)}
function gsMsg(m){
 switch(m.t){
 case 'welcome':ONL.authed=true;ONL.uid=m.id;ONL.adm=!!m.adm;ONL.inv=!!m.inv;if(m.cfg){PVP.on=!!m.cfg.pvp;PVP.safe=+m.cfg.pvpSafe||0;if(+m.cfg.pvpMul>0)ONL.pvpMul=+m.cfg.pvpMul}document.body.classList.toggle('adm',ONL.adm);if(ONL.adm&&!m.inv&&m.invWhy&&!ONL.invWarn){ONL.invWarn=1;onlReg('⚠️ [ADM] Trocas desligadas: '+m.invWhy+'.')}if(ONL.welcomeCb){const f=ONL.welcomeCb;ONL.welcomeCb=null;f()}else if(cur==='game')gsJoin();onlStatus();break;
 case 'authfail':onlReg('⚠️ Falha ao entrar no servidor: '+m.msg);if(ONL.rtok)onlRefresh();break;
 case 'old':ONL.closing=true;
  if(m.v&&m.v<GS_PROTO){gsWait();break} // o servidor é que ainda está atualizando
  if(OTA.app){gsBlock('Atualizando o jogo…','Baixando a versão nova…');otaCheck().then(ok=>{if(ok||OTA.ready)location.reload();else if(!m.v)gsWait();else gsBlock('Versão desatualizada','Não consegui baixar a versão nova agora. Verifique a internet e abra o jogo de novo.')})}
  else gsBlock('Versão desatualizada','Instale a versão mais nova do jogo para continuar.');break;
 case 'banned':{ONL.closing=true;const at=m.ate?new Date(m.ate):null;
  gsBlock('Conta banida','Sua conta foi banida '+(at?'até '+at.toLocaleDateString('pt-BR')+' às '+at.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'por tempo indeterminado')+'.'+(m.motivo?' Motivo: '+m.motivo+'.':''));break}
 case 'kicked':ONL.closing=true;gsBlock('Desconectado',m.msg||'Sua conta entrou em outro aparelho.');break;
 case 'room':if(m.map!==CURMAP)break;ONL.joined=true;if(PVP.on&&!pvpTold){pvpTold=1;setTimeout(()=>onlReg('⚔️ PvP ativo neste mapa. Perto do ponto de início é zona segura.'),800)}ONL.peers={};(m.players||[]).forEach(o=>onlPeer(o.id,o));E=[];(m.mobs||[]).forEach(x=>gsMobState(gsMob(x.def),x.s));ONL.mo=null;onlStatus();gsPos(true);break;
 case 'pj':{const pe=onlPeer(m.p.id,m.p);if(pe)onlReg('🟢 '+pe.nome+' entrou no mapa');onlStatus();break}
 case 'pl':{const pe=ONL.peers[m.id];if(pe){onlReg('⚪ '+pe.nome+' saiu do mapa');delete ONL.peers[m.id]}onlStatus();grpDraw();break}
 case 'pm':onlPeer(m.id,m);grpDraw();break;
 case 'ps':(m.p||[]).forEach(a=>{const pe=onlPeer(a[0]);if(!pe)return;const nx=a[1],ny=a[2];
  if(pe.x===null||Math.hypot(nx-pe.x,ny-pe.y)>400||(a[8]|0)!==pe.sc){pe.x=nx;pe.y=ny;pe.buf=null;pe.fl=a[3];pe.mv=a[4];pe.run=a[5]}
  ipPush(pe,a[11]!=null?ipClock(pe,'co',a[11]):ipClock(ONL,'po',m.st),{x:nx,y:ny,fl:a[3],mv:a[4],run:a[5]});
  pe.tx=nx;pe.ty=ny;pe.au=a[6];pe.th=a[7];pe.sc=a[8]|0;pe.hp=a[9];pe.max=a[10];pe.seen=performance.now()});break;
 case 'mobs':{const t=ipClock(ONL,'mo',m.st);(m.m||[]).forEach(a=>{const e=E.find(x=>x.sid===a[0]);if(e)gsMobState(e,a.slice(1),t)});break}
 case 'mh':{const e=E.find(x=>x.sid===m.m);if(!e||(scene|0))break;const me=m.by===ONL.uid,y=e.y-(e.boss?126:48)-(e.jz||0);
  if(m.miss){FT.push({x:e.x+(me?0:Math.random()*24-12),y,t:'esquivou',txt:1,life:.8});if(me)regMiss(e.nome);break}
  e.hit=me?.15:.12;if(me)e.hurt=.28;FT.push({x:e.x+(me?0:Math.random()*30-15),y,t:m.c?m.d+'!':m.d,life:me?.8:.7,crit:m.c,oth:me?0:1});if(me)regDmg('out',m.d,m.c,e.nome);break}
 case 'mev':gsMev(m);break;
 case 'hurt':{const pv=m.by||null;if(scene|0){if(pv)gsSend({t:'phr',by:pv,miss:1});break}
  if(m.blk||(!pv&&kaitenGuard())){FT.push({x:p.x,y:p.y-62,t:pv?'refletiu':'defendeu',txt:1,life:.8});onlReg('🌀 Kaiten '+(pv?'refletiu um projétil':'bloqueou um golpe')+(m.src?' ('+m.src+')':''));break}
  if(m.fin)hurtFix(m.d,m.miss,m.c);else{HPREC=m.pr||0;hurt(m.d);HPREC=0}const R=HRES,src=m.src?' ('+m.src+')':'';if(!R.miss&&R.d>0)PCF=0; // dano desfaz a confusão (o golpe que confunde aplica depois)
  if(pv&&R.dead)gsSend({t:'phr',by:pv,dead:1});
  if(R.dead){PST=0;onlReg('☠️ Você foi derrotado'+src+' e voltou para o início do mapa.');toast('☠️ Você foi derrotado'+(pv?' por '+m.src:'')+' e voltou para o início.');gsPos(true);break}
  if(R.miss)onlReg('💨 Você esquivou'+src);else regDmg('in',R.d,0,m.src);
  if(pv&&!R.miss&&m.st>0){PST=Math.max(PST,m.st);FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.9})}
  if(pv&&!R.miss&&m.cc)ccRecebe(m.cc,m.src);if(pv&&m.imu)ccImune(m.imu);
  if(pv&&!R.miss){if(m.nm>1)FT.push({x:p.x-18,y:p.y-74,t:'fraqueza!',txt:1,life:.9});else if(m.nm<1)FT.push({x:p.x-18,y:p.y-74,t:'resistiu',txt:1,life:.9});
   if(m.ef==='queima'){FT.push({x:p.x+16,y:p.y-80,t:'🔥 queimando',txt:1,life:1});onlReg('🔥 '+(m.src||'?')+' pôs fogo em você (Katon): '+natEfTxt('katon')+'.')}
   else if(m.ef==='para'&&m.st>0)onlReg('⚡ '+(m.src||'?')+' paralisou você (Raiton, '+nf(m.st)+' s).');if(m.qm)FT.push({x:p.x+12,y:p.y-46,t:'🔥',txt:1,life:.6})}
  if(!R.miss&&(m.kx||m.ky)){for(let i=0;i<8;i++){const nx=p.x+m.kx*5,ny=p.y+m.ky*5;if(!sol(nx,ny)){p.x=nx;p.y=ny}}}shk=Math.max(shk,pv?.4:.6);gsPos(true);break}
 case 'ph':pvpShow(m);break;
 case 'pk':{const me=m.by===ONL.uid,vt=m.to===ONL.uid,t=me?'⚔️ Você derrotou '+m.toN+'!':vt?'☠️ '+m.byN+' derrotou você.':'⚔️ '+m.byN+' derrotou '+m.toN+'.';
  onlReg(t+(me&&m.k?' ('+m.k+' jogador'+(m.k>1?'es derrotados':' derrotado')+' nesta sessão)':''));if(me)toast(t);break}
 case 'mkill':{const mine=(m.ids||[]).includes(ONL.uid);if(!m.boss){if(!mine)onlReg('☠️ '+m.nome+' derrotado — maior dano: '+m.quem+' ('+m.dmg+'), a recompensa foi para eles.');break}const t=(mine?'🏆 ':'☠️ ')+m.nome+' derrotada! Maior dano: '+m.quem+' ('+m.dmg+')'+(mine?'':' — a recompensa foi para eles.');onlReg(t);toast(t);
  if(m.rank&&m.rank.length)onlReg('📊 Dano na luta: '+m.rank.map((r,i)=>(i+1)+'º '+r.quem+' '+r.dmg).join(' · '));break}
 case 'reward':gainXp(m.xp);if(m.items&&m.items.length)giveItems(m.items);onlReg('🎁 '+(m.boss?'Recompensa':m.mob)+(m.grp?' (grupo)':'')+': +'+m.xp+' XP'+(m.items&&m.items.length?' e '+m.items.map(i=>ITEMS[i]?ITEMS[i].name:i).join(', '):'')+(m.boss?' (seu lado causou '+m.dmg+' de dano)':''));ONL.dirty=true;break;
 case 'chat':{const pe=ONL.peers[m.id];if(pe&&m.ch!=='g'){pe.say=m.text;pe.sayT=5}if(m.id===ONL.uid)break;onlChat(m.ch,m.nome,m.text);break}
 case 'sys':onlReg('ℹ️ '+m.msg);toast(m.msg);break;
 case 'cmdr':onlReg('🛠️ '+m.msg);toast(m.msg);break;
 case 'adm':ONL.adm=!!m.on;document.body.classList.toggle('adm',ONL.adm);{const t=m.on?'🛡️ Você agora é admin.':'Você não é mais admin.';onlReg(t);toast(t)}onlStatus();chatDraw();break;
 case 'fx':{const pe=ONL.peers[m.id];if(!pe||pe.sc!==(scene|0))break;(m.fx||[]).forEach(f=>{if(f.k==='act'){if(ACTS[f.a])pe.act={a:f.a,t0:performance.now(),root:ACTS[f.a].root||0,para:ACTS[f.a].para||0};return}f.rm=1;f._s=1;f.pid=m.id;f.life=f.max||f.life||.5;if(f.k!=='kfx'||KSEQ[f.q])fx.push(f)});(m.pr||[]).forEach(b=>{b.rm=1;b._s=1;b.dmg=0;b.pid=m.id;P.push(b)});break}
 case 'pinvite':grpInvite(m);break;
 case 'tinvite':tradeInvite(m);break;
 case 'trade':ONL.trade=m;tradeDraw();grpDraw();break;
 case 'tend':ONL.trade=null;tSel=null;tradeDraw();if(m.msg){toast(m.msg);onlReg('🤝 '+m.msg)}grpDraw();break;
 case 'tdone':ONL.trade=null;tSel=null;tradeDraw();invReload().then(()=>{const g=offTxt(m.ganhou),d=offTxt(m.deu);toast('🤝 Troca concluída! Você recebeu: '+g);onlReg('🤝 Troca com '+m.com+' concluída. Você deu: '+d+' · recebeu: '+g+'.')});grpDraw();break;
 case 'invreload':invReload();break;
 case 'party':ONL.party=m.none?null:m;grpDraw();break;
 case 'pong':ONL.ping=Math.round(performance.now()-m.c);onlStatus();break}}
function gsMev(m){if(scene|0)return;
 if(m.k==='ep'){EP.push({sid:m.id,sv:1,x:m.x,y:m.y,vx:m.vx,vy:m.vy,life:m.life||1.35});shk=Math.max(shk,.3)}
 else if(m.k==='epx'){EP=EP.filter(b=>b.sid!==m.id);fx.push({k:'boom',x:m.x,y:m.y,life:.35,max:.35,rm:1,_s:1})}
 else if(m.k==='shock'){fx.push({k:'shock',x:m.x,y:m.y,r:m.r||102,life:.55,max:.55,rm:1,_s:1});if(Math.hypot(p.x-m.x,p.y-m.y)<500)shk=1}
 else if(m.k==='reset'){const e=E.find(x=>x.sid===m.m);if(e){e.x=m.x;e.y=m.y;e.jz=0;e.buf=null}fx.push({k:'ring',x:m.x,y:m.y-20,r:70,col:'#ffd27a',life:.6,max:.6,rm:1,_s:1});onlReg('🦊 A Raposa de Nove Caudas voltou ao covil.')}
 else if(m.k==='spawn'){const e=E.find(x=>x.sid===m.m);if(e){e.x=m.x;e.y=m.y;e.dead=0;e.dt=0;e.buf=null}onlReg('🦊 A Raposa de Nove Caudas renasceu.')}}
function gsPos(force){const now=performance.now();if(!ONL.joined)return;
 const s=[p.x|0,p.y|0,p.fl?1:0,p.mv?1:0,p.run?1:0,scene|0,Math.round(p.hp),p.au>=0?1:0,p.th>=0?1:0].join(',');
 if(!force&&(now-ONL.lastPos<50||(s===ONL.lastSig&&now-ONL.lastPos<2000)))return;ONL.lastPos=now;ONL.lastSig=s;
 gsSend({t:'pos',c:Math.round(now),x:p.x|0,y:p.y|0,fl:p.fl?1:0,mv:p.mv?1:0,run:p.run?1:0,au:p.au>=0?+p.au.toFixed(2):-1,th:p.th>=0?+p.th.toFixed(2):-1,sc:scene|0,hp:Math.round(p.hp),max:p.max})}
const FXOK={inv:1,invx:1,ring:1,rimp:1,bolt:1,line:1,kfx:1,act:1,cone:1,sline:1,sarea:1,aviso:1,chama:1,genj:1,amat:1,tsuku:1,kusho:1};
// qualidade automática: se o aparelho não segura ~50 quadros por segundo, desenha com menos pixels (até 1,5x)
const PQ={acc:0,n:0,skip:2};
function perfTick(dt){if(document.hidden)return;PQ.acc+=dt;PQ.n++;if(PQ.acc<3)return;const avg=PQ.acc/PQ.n;PQ.acc=0;PQ.n=0;if(PQ.skip>0){PQ.skip--;return}
 const c=Math.min(window.DPRMAX||2,devicePixelRatio||1);if(avg>.021&&c>1.5){window.DPRMAX=Math.max(1.5,c-.25);rs()}}
function onlStep(dt){kfxStep(dt);if(!ONL.on)return;perfTick(dt);
 if(ONL.joined){const nf=[],np=[];
  for(const f of fx){if(f._s)continue;f._s=1;if(!f.rm&&FXOK[f.k||'line'])nf.push(Object.assign({},f,{_s:undefined}))}
  for(const b of P){if(b._s)continue;b._s=1;if(!b.rm)np.push({x:b.x|0,y:b.y|0,vx:b.vx|0,vy:b.vy|0,col:b.col,life:b.life,big:b.big,spin:b.spin,fire:b.fire,sh:b.sh,big2:b.big2,mini:b.mini,area:b.big2?b.area:undefined})}
  if(nf.length||np.length)gsSend({t:'fx',fx:nf.slice(0,8),pr:np.slice(0,8)})}
 gsPos(false);
 const now=performance.now();if(now-ONL.pingT>5000){ONL.pingT=now;gsSend({t:'ping',c:now})}
 const rtp=performance.now()-IP.dp;
 for(const id in ONL.peers){const pe=ONL.peers[id];if(pe.x===null)continue;const r=ipAt(pe,rtp);if(r){pe.x=r.x;pe.y=r.y;pe.fl=r.s.fl;pe.mv=r.s.mv;pe.run=r.s.run}
  if(pe.hitT>0)pe.hitT-=dt;if(pe.th>=0)pe.th+=dt;if(pe.th>.35)pe.th=-1;if(pe.au>=0)pe.au+=dt;if(pe.sayT>0)pe.sayT-=dt}
 if(myT>0)myT-=dt}
const inGrp=id=>!!(ONL.party&&ONL.party.members.some(x=>x.id===id));
function onlDraw(L,ts){if(!ONL.on)return;
 for(const id in ONL.peers){const pe=ONL.peers[id];if(pe.x===null||pe.sc!==(scene|0))continue;
  L.push({y:pe.y,d:()=>{const FL=(pe.eq||[]).map(i=>ITEMS[i]).filter(it=>it&&it.fx&&(it.fx.tails||it.fx.orbit||it.fx.glow||it.fx.hand)).map(it=>it.fx);
   fxDraw(ctx,pe.x,pe.y,ts,FL,0);
   if(pe.hitT>0)ctx.globalAlpha=.5;
   if(HERO)drawHero(ctx,pe.x,pe.y,{fl:pe.fl,t:ts+id.length*97,mv:pe.mv,run:pe.run,aura:pe.au,th:pe.th,set:heroFor(pe.look),clan:pe.clan,act:pe.act&&actFrame(pe.act)?pe.act:null,vis:eqVis(pe.eq||[])});else drawChar(ctx,pe.x,pe.y,{...(pe.look||look),clan:pe.clan,dir:0,t:ts,mv:pe.mv,run:pe.run});
   ctx.globalAlpha=1;
   fxDraw(ctx,pe.x,pe.y,ts,FL,1,{fl:pe.fl});
   const gp=inGrp(id);ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000a';ctx.fillStyle=gp?'#7dff9a':'#9fe8ff';
   if(pe.adm)ctx.fillStyle='#ffd23f';const lb=(gp?'👥 ':'')+(pe.adm?'[ADM] ':'')+pe.nome+' · Nv '+(pe.lv||1);ctx.strokeText(lb,pe.x,pe.y-62);ctx.fillText(lb,pe.x,pe.y-62);
   if(pe.max>0&&pe.hp<pe.max){ctx.fillStyle='#000a';ctx.fillRect(pe.x-13,pe.y-58,26,4);ctx.fillStyle='#4fd06a';ctx.fillRect(pe.x-12,pe.y-57,24*Math.max(0,pe.hp)/pe.max,2)}
   if(pe.sayT>0)onlBubble(pe.x,pe.y-74,pe.say,pe.sayT)}})}
 if(myT>0)L.push({y:p.y+.1,d:()=>onlBubble(p.x,p.y-74,mySay,myT)});
 const rootDraw=(x,y)=>{ctx.save();ctx.globalAlpha=.7;ctx.fillStyle='#120a22';ctx.beginPath();ctx.ellipse(x,y+1,15,6,0,0,7);ctx.fill();ctx.globalAlpha=.9;ctx.strokeStyle='#2b1a4a';ctx.lineWidth=2;
  for(let i=0;i<4;i++){const a=i*1.57+ts/900;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*14,y+Math.sin(a)*5);ctx.lineTo(x+Math.cos(a)*5,y-10-i%2*4);ctx.stroke()}ctx.restore()};
 if(PRT>0&&!(scene|0))L.push({y:p.y-.3,d:()=>rootDraw(p.x,p.y)});
 if(!(scene|0))for(const e of E)if(!e.dead&&e.root>0)L.push({y:e.y-.3,d:()=>rootDraw(e.x,e.y)});
 // lento (Kage Nui, Campo de Sombras): fiapos de sombra presos nos pés · silenciado: selo de sombra em cima da cabeça
 const slowDraw=(x,y)=>{ctx.save();ctx.strokeStyle='#120a22';ctx.lineCap='round';ctx.lineWidth=2;ctx.globalAlpha=.75;for(let i=0;i<3;i++){const a=i*2.09+ts/500,ox=Math.cos(a)*11;ctx.beginPath();ctx.moveTo(x+ox,y+2);ctx.quadraticCurveTo(x+ox*1.6,y+6+Math.sin(ts/220+i)*2,x+ox*2.1,y+3);ctx.stroke()}ctx.restore()};
 if(!(scene|0)){for(const e of E)if(!e.dead&&!(e.root>0)&&(e.lento>0||e.slw>0))L.push({y:e.y-.31,d:()=>slowDraw(e.x,e.y)});if(BUFS.lento&&!(PRT>0))L.push({y:p.y-.31,d:()=>slowDraw(p.x,p.y)})}
 const confDraw=(x,y)=>{ctx.save();ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.translate(x,y);ctx.rotate(Math.sin(ts/200)*.4);ctx.fillText('💫',0,0);ctx.restore()};
 if(!(scene|0))for(const e of E)if(!e.dead&&(e.conf>0))L.push({y:e.y+.22,d:()=>confDraw(e.x,e.y-(e.boss?110:56))});if(PCF>0)L.push({y:p.y+.22,d:()=>confDraw(p.x+12,p.y-66)});
 if(PSI>0)L.push({y:p.y+.21,d:()=>{ctx.save();ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.globalAlpha=.6+.4*Math.sin(ts/150);ctx.fillText('🤐',p.x,p.y-70);ctx.restore()}});
 if(PST>0)L.push({y:p.y+.2,d:()=>{ctx.fillStyle='#d9b3ff';for(let i=0;i<3;i++){const a=ts/200+i*2.1;ctx.beginPath();ctx.arc(p.x+Math.cos(a)*9,p.y-56+Math.sin(a)*3,2.4,0,7);ctx.fill()}}});
 if(!(scene|0)&&PVP.on&&PVP.safe>0&&SPAWN)L.push({y:-1e9,d:()=>{const x=SPAWN[0]*T,y=SPAWN[1]*T,r=PVP.safe*T;ctx.save();ctx.fillStyle='rgba(120,200,255,.07)';ctx.strokeStyle='rgba(150,220,255,.45)';ctx.lineWidth=2;ctx.setLineDash([8,6]);
  ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#000a';ctx.fillStyle='#bfe8ff';ctx.strokeText('🛡 Zona segura (sem PvP)',x,y-r-4);ctx.fillText('🛡 Zona segura (sem PvP)',x,y-r-4);ctx.restore()}})}
const MOBS=__MOBS__,MOBIMG={},SPRITES=__SPRITES__,SPRIMG={};
for(const k in SPRITES){SPRIMG[k]={};for(const an in SPRITES[k].anims)SPRIMG[k][an]=SPRITES[k].anims[an].f.map(u=>{const im=new Image();im.src=u;return im})}
// passada da corrida acompanha a distância andada (sem patinar): 1 ciclo a cada ~0,75 do comprimento do bicho
function runPh(e,ts,S,a){const lt=e._rt||ts,dt=Math.min(.1,Math.max(0,(ts-lt)/1000));e._rt=ts;
 const d=Math.hypot(e.x-(e._rx??e.x),e.y-(e._ry??e.y));e._rx=e.x;e._ry=e.y;
 const r0=SPRIMG[a.sprite].run,w=(r0&&r0[0]&&r0[0].naturalWidth||150)*S.scale*Math.max(.3,Math.min(4,(+(MOBS[e.t]||{}).escala||100)/100)),st=Math.max(30,w*.75);
 e._ph=((e._ph||0)+(d<st?Math.max(d/st,dt*.9):dt*.9))%1;return e._ph}
function sprFrame(e,a,ts){const S=SPRITES[a.sprite];if(!S)return null;const an=e.dead?'die':e.lunge>0&&S.anims.atk?'atk':e.hurt>.15&&S.anims.hurt?'hurt':e.mv?'run':'idle';
 const A=S.anims[an]||S.anims.idle,n=A.f.length;let fi;
 if(an==='atk')fi=Math.min(n-1,(1-e.lunge/.3)*n|0);else if(an==='die')fi=Math.min(n-1,e.dt*A.fps|0);else if(an==='run')fi=Math.min(n-1,runPh(e,ts,S,a)*n|0);else fi=((ts/1000*A.fps)+e.id*.37|0)%n;
 const im=(SPRIMG[a.sprite][an]||SPRIMG[a.sprite].idle)[Math.max(0,fi)];return im&&im.complete&&im.naturalWidth?{im,S}:null}
for(const k in MOBS){const a=MOBS[k].ap||{};if(a.tipo==='imagem'&&a.img){const im=new Image();im.src=a.img;MOBIMG[k]=im}}
function drawMob(e,ts){const d=MOBS[e.t]||{},a=d.ap||{tipo:'ninja'},sc=Math.max(.3,Math.min(4,(+d.escala||100)/100));
 const lu=e.lunge>0?Math.sin((1-e.lunge/.3)*Math.PI)*7*(e.fl?-1:1):0;
 ctx.save();ctx.translate(e.x+lu,e.y);ctx.scale(sc,sc);
 if(a.tipo==='imagem'&&MOBIMG[e.t]&&MOBIMG[e.t].complete&&MOBIMG[e.t].naturalWidth){const im=MOBIMG[e.t],k=52/Math.max(im.naturalWidth,im.naturalHeight),w=im.naturalWidth*k,h=im.naturalHeight*k,bob=e.mv?Math.abs(Math.sin(ts/110))*2:Math.sin(ts/500)*.8;
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,0,w*.32,4,0,0,7);ctx.fill();
  const flip=(a.olha==='esq')?!e.fl:!!e.fl;if(flip)ctx.scale(-1,1);ctx.drawImage(im,-w/2,-h-bob+2,w,h)}
 else if(a.tipo==='sprite'){const r=sprFrame(e,a,ts);if(r){const w=r.im.naturalWidth*r.S.scale,h=r.im.naturalHeight*r.S.scale;
  if(e.dead)ctx.globalAlpha*=Math.max(0,Math.min(1,1-(e.dt-.5)/.9));
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(0,0,(w-2*(r.S.pad||0)*r.S.scale)*.3,4,0,0,7);ctx.fill();
  if((a.olha==='esq')?!e.fl:!!e.fl)ctx.scale(-1,1);if(r.S.glow){ctx.shadowColor=r.S.glow;ctx.shadowBlur=8}
  ctx.drawImage(r.im,-w/2,-h+2+(r.S.pad||0)*r.S.scale,w,h)}}
 else if(a.tipo==='raposa'&&fxOK)drawFoxSpr(ctx,0,0,{t:ts,mv:e.mv,fl:e.fl,lunge:e.lunge>0?e.lunge/.3*.5:0,ch:0,hurt:e.hurt,stun:e.stun,dead:0,dt:0});
 else drawChar(ctx,0,0,{skin:a.skin||'#d9a97f',hair:a.hair||'#222',cloth:a.cloth||'#6a3030',band:a.band||'#8b1e1e',dir:e.dir|0,t:ts+e.id*300,mv:e.mv,run:0});
 ctx.restore()}
function mobLabel(e){const d=MOBS[e.t]||{},sc=Math.max(.3,Math.min(4,(+d.escala||100)/100)),ap=d.ap||{},a=ap.tipo,S=a==='sprite'&&SPRITES[ap.sprite],i0=S&&SPRIMG[ap.sprite].idle[0],hh=(S&&i0&&i0.naturalHeight?(i0.naturalHeight-2*(S.pad||0))*S.scale+4:a==='raposa'?120:a==='imagem'?54:46)*sc;
 if(e.hp<e.max){ctx.fillStyle='#000a';ctx.fillRect(e.x-14,e.y-hh-2,28,4);ctx.fillStyle='#e0483a';ctx.fillRect(e.x-13,e.y-hh-1,26*Math.max(0,e.hp)/e.max,2)}
 ctx.font='8px system-ui';ctx.textAlign='center';ctx.lineWidth=2.5;ctx.strokeStyle='#000a';const lb=mobName(e);ctx.fillStyle=lvColor(e,'#ffd9c9');ctx.strokeText(lb,e.x,e.y-hh-5);ctx.fillText(lb,e.x,e.y-hh-5)}
// cor pelo nível em relação ao seu: cinza = bem mais fraco · normal · laranja = mais forte · vermelho com caveira = perigo
function lvColor(e,def){const d=(e.lv||1)-(CH?CH.lv:1);return d>=10?'#ff5a4a':d>=4?'#ffab4a':d<=-6?'#a3a3a3':def}
function mobName(e){const d=(e.lv||1)-(CH?CH.lv:1);return (d>=10?'☠ ':'')+e.nome+' · Nv '+(e.lv||1)}
const HEROC={};
function heroFor(lk){if(!ready||!lk)return HERO;const ok=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
 const L={skin:ok(lk.skin)?lk.skin:SKIN[0],hair:ok(lk.hair)?lk.hair:HAIR[0],cloth:ok(lk.cloth)?lk.cloth:CLOTH[0]},key=L.skin+L.hair+L.cloth;
 if(!HEROC[key]){try{HEROC[key]=tintSet(L)}catch(e){HEROC[key]=HERO}}return HEROC[key]}
function onlBubble(x,y,t,life){ctx.save();ctx.globalAlpha=Math.min(1,life*2);ctx.font='10px system-ui';const w=Math.min(150,ctx.measureText(t).width)+12;
 ctx.fillStyle='rgba(255,255,255,.95)';ctx.strokeStyle='#0006';ctx.lineWidth=1;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x-w/2,y-16,w,16,6);else ctx.rect(x-w/2,y-16,w,16);ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.lineTo(x,y+5);ctx.fill();ctx.fillStyle='#1d1a2b';ctx.textAlign='center';ctx.fillText(t.length>26?t.slice(0,25)+'…':t,x,y-5);ctx.restore()}
let mySay='',myT=0;
function onlStatus(){const el=$('#onl');if(!el)return;el.hidden=!ONL.on;['#chatbtn','#grpbtn'].forEach(s=>$(s).hidden=!ONL.on);if(!ONL.on)return;
 const n=Object.keys(ONL.peers).length+1;el.className=ONL.joined?'ok':'off';
 el.textContent=ONL.joined?(n+' no mapa'+(ONL.adm&&ONL.ping?' · '+ONL.ping+' ms':'')):(ONL.ws&&ONL.ws.readyState===1?'entrando…':'reconectando…');
 const nb=$('#netbar');if(nb)nb.hidden=ONL.joined||cur!=='game'}
const CHN={l:'Local',g:'Grupo',m:'Mapa'};
function hms(){return new Date().toTimeString().slice(0,8)}
function onlChat(ch,nome,text){ONL.chat.push({ch,nome,text,at:performance.now(),h:hms()});if(ONL.chat.length>80)ONL.chat.shift();chatDraw()}
function onlReg(t,k){ONL.reg.push({t,k,at:performance.now(),h:hms()});if(ONL.reg.length>200)ONL.reg.shift();if(!($('#chatp')&&!$('#chatp').hidden&&ONL.tab==='r'))ONL.regNew++;chatDraw()}
// soma golpes seguidos numa linha só para o registro não virar spam
function regMiss(src){regDmg('miss',0,0,src)}
function regDmg(k,d,crit,src){const L=ONL.reg[ONL.reg.length-1],now=performance.now();
 if(L&&L.k===k&&now-L.at<2500){L.sum+=d;L.n++;if(crit)L.c++;if(src&&!L.src.includes(src))L.src.push(src);L.at=now;L.h=hms()}
 else{ONL.reg.push({k,sum:d,n:1,c:crit?1:0,src:src?[src]:[],at:now,h:hms()});if(ONL.reg.length>200)ONL.reg.shift();if(!($('#chatp')&&!$('#chatp').hidden&&ONL.tab==='r'))ONL.regNew++}
 const E2=ONL.reg[ONL.reg.length-1];
 E2.t=k==='miss'?'💨 '+(E2.src.join(', ')||'O alvo')+' esquivou de '+E2.n+' golpe'+(E2.n>1?'s':'')+' seu'+(E2.n>1?'s':''):k==='pout'?'⚔️ Você causou '+E2.sum+' de dano em '+(E2.src.join(', ')||'outro jogador')+(E2.n>1?' ('+E2.n+' golpes'+(E2.c?', '+E2.c+' crítico'+(E2.c>1?'s':''):'')+')':(E2.c?' (crítico)':''))
  :k==='out'?'⚔️ Você causou '+E2.sum+' de dano'+(E2.src[0]?' na '+E2.src[0].replace(/ de Nove Caudas/,''):'')+(E2.n>1?' ('+E2.n+' golpes'+(E2.c?', '+E2.c+' crítico'+(E2.c>1?'s':''):'')+')':(E2.c?' (crítico)':''))
  :'💥 Você recebeu '+E2.sum+' de dano'+(E2.src.length?' ('+E2.src.join(', ')+')':'');chatDraw()}
function chatRow(r,full){const d=document.createElement('div');
 if(r.ch){d.className='c'+r.ch;const tag=document.createElement('b');tag.textContent='['+CHN[r.ch]+'] ';d.appendChild(tag);d.appendChild(document.createTextNode((r.me?'Você':r.nome)+': '+r.text))}
 else{d.className='rg';if(full){const h=document.createElement('small');h.textContent=r.h+' ';d.appendChild(h)}d.appendChild(document.createTextNode(r.t))}return d}
function chatDraw(){const ov=$('#chatlog');if(!ov)return;const open=!$('#chatp').hidden,now=performance.now();
 ov.hidden=!ONL.on||open;ov.innerHTML='';if(!open)ONL.chat.filter(r=>now-r.at<9000).slice(-4).forEach(r=>ov.appendChild(chatRow(r)));
 const bd=$('#regB');bd.hidden=!ONL.regNew;bd.textContent=ONL.regNew>99?'99+':ONL.regNew;
 if(!open)return;
 $('#tabC').classList.toggle('on',ONL.tab==='c');$('#tabR').classList.toggle('on',ONL.tab==='r');$('#cpIn').hidden=ONL.tab!=='c';
 const L=$('#cpList'),stick=L.scrollHeight-L.scrollTop-L.clientHeight<30;L.innerHTML='';
 const rows=ONL.tab==='c'?ONL.chat:ONL.reg;
 if(!rows.length){const e=document.createElement('div');e.className='cpe';e.textContent=ONL.tab==='c'?'Nenhuma mensagem ainda. Escolha Local, Grupo ou Mapa e escreva abaixo.':'O registro mostra dano causado e recebido, a raposa e as recompensas.';L.appendChild(e)}
 rows.forEach(r=>L.appendChild(chatRow(r,1)));if(stick||L._first!==ONL.tab){L.scrollTop=L.scrollHeight;L._first=ONL.tab}
 document.querySelectorAll('#cpIn .chs button').forEach(b=>{const c=b.dataset.ch;b.classList.toggle('on',ONL.chatCh===c);b.disabled=c==='g'&&!ONL.party});
 $('#chatin').placeholder={l:ONL.adm?'Mensagem local (até 15 tiles)…':'Mensagem para quem está perto…',g:'Mensagem para o seu grupo…',m:'Mensagem para todo o mapa…'}[ONL.chatCh]}
setInterval(chatDraw,1000);
function chatOpen(v,tab){const P=$('#chatp');P.hidden=!v;if(tab)ONL.tab=tab;if(v&&ONL.tab==='r')ONL.regNew=0;$('#cpList')._first=null;chatDraw();if(v&&ONL.tab==='c')setTimeout(()=>$('#chatin').focus(),30)}
function onlChatSend(){const i=$('#chatin'),t=i.value.trim().slice(0,80);if(!t)return;i.value='';
 // comandos (/admin nome ...) vão só para o servidor: não aparecem no chat nem no balão
 if(t[0]==='/'){if(!gsSend({t:'cmd',text:t}))return toast('Sem conexão com o servidor.');onlReg('⌨️ '+t);return}
 let ch=ONL.chatCh;if(ch==='g'&&!ONL.party)ch='l';if(ch!=='g'){mySay=t;myT=5}ONL.chat.push({ch,nome:ONL.nome,text:t,me:1,at:performance.now(),h:hms()});chatDraw();gsSend({t:'chat',text:t,ch})}
let toastT=0;function toast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,3500)}
function onlLog(t){onlReg(t)}
// servidor ainda na versão anterior (acabou de sair uma atualização): espera e tenta de novo sozinho
function gsWait(){gsBlock('Servidor em manutenção','Voltamos em instantes. Tentando de novo em 20 segundos…');
 const b=$('#netblock');setTimeout(()=>{b.hidden=true;ONL.closing=false;ONL.tries=0;gsConnect()},20000)}
function gsBlock(tt,msg){const b=$('#netblock');b.querySelector('b').textContent=tt;b.querySelector('span').textContent=msg;b.hidden=false;try{ONL.ws&&ONL.ws.close()}catch(_){}}

// ---------- grupo ----------
function grpDraw(){const pt=ONL.party,h=$('#phud');
 h.innerHTML='';if(pt)pt.members.filter(x=>x.id!==ONL.uid).forEach(x=>{const d=document.createElement('div');d.className='pm'+(x.on?'':' offm');
  const pc=x.on&&x.max?Math.max(0,Math.min(100,x.hp/x.max*100)):0;const fora=x.on&&x.map!==CURMAP?' · outro mapa':'';
  d.innerHTML='<span></span><i><b style="width:'+pc+'%"></b></i>';d.querySelector('span').textContent=(pt.leader===x.id?'👑 ':'')+x.nome+' Nv '+x.lv+(x.on?fora:' · offline');h.appendChild(d)});
 if(!pt&&ONL.chatCh==='g')ONL.chatCh='l';
 if($('#grp').hidden)return;
 const L=$('#grpMem'),O=$('#grpMap');L.innerHTML='';O.innerHTML='';
 if(pt){$('#grpNone').hidden=true;$('#grpLeave').hidden=false;const lead=pt.leader===ONL.uid;
  pt.members.forEach(x=>{const r=document.createElement('div');r.className='gr';const me=x.id===ONL.uid;
   r.innerHTML='<span class="gn"></span><span class="gi"></span>';r.querySelector('.gn').textContent=(pt.leader===x.id?'👑 ':'')+x.nome+(me?' (você)':'');
   r.querySelector('.gi').textContent='Nv '+x.lv+' · '+(x.on?(x.map?mapNm(x.map):'—'):'offline');
   if(!me){const pe=ONL.peers[x.id];if(pe&&pe.x!==null&&Math.hypot(pe.x-p.x,pe.y-p.y)<=320)tradeBtn(r,x.id)}
   if(lead&&!me){const b=document.createElement('button');b.textContent='Remover';b.onclick=()=>gsSend({t:'pkick',id:x.id});r.appendChild(b)}L.appendChild(r)})}
 else{$('#grpNone').hidden=false;$('#grpLeave').hidden=true}
 const NEAR=10*32,now=performance.now();
 const others=Object.values(ONL.peers).filter(pe=>!inGrp(pe.id)&&pe.x!==null&&pe.sc===(scene|0)).map(pe=>({pe,d:Math.hypot(pe.x-p.x,pe.y-p.y)})).filter(o=>o.d<=NEAR).sort((a,b)=>a.d-b.d).slice(0,8);
 $('#grpMapNone').hidden=others.length>0;
 others.forEach(({pe,d})=>{const r=document.createElement('div');r.className='gr';r.innerHTML='<span class="gn"></span><span class="gi"></span>';
  r.querySelector('.gn').textContent=pe.nome;r.querySelector('.gi').textContent='Nv '+(pe.lv||1)+(ONL.adm?' · '+Math.max(1,Math.round(d/32))+' tiles':'')+(pe.g?' · já tem grupo':'');
  const sent=ONL.invSent[pe.id]&&now-ONL.invSent[pe.id]<30000;
  const b=document.createElement('button');b.textContent=sent?'Enviado':'Convidar';b.disabled=sent||!!pe.g||(pt&&pt.members.length>=6);b.onclick=()=>{gsSend({t:'pinv',to:pe.id});ONL.invSent[pe.id]=performance.now();b.disabled=true;b.textContent='Enviado'};r.appendChild(b);tradeBtn(r,pe.id);O.appendChild(r)})}
function tradeBtn(r,id){if(!ONL.inv)return;const tb=document.createElement('button');tb.className='sec';const sent=ONL.tSent&&ONL.tSent[id]&&performance.now()-ONL.tSent[id]<30000;tb.textContent=sent?'Pedido enviado':'🤝 Trocar';tb.disabled=sent||!!ONL.trade;tb.onclick=()=>{gsSend({t:'tinv',to:id});(ONL.tSent=ONL.tSent||{})[id]=performance.now();tb.disabled=true;tb.textContent='Pedido enviado'};r.appendChild(tb)}
setInterval(()=>{if(ONL.on&&!$('#grp').hidden)grpDraw()},1000);
// ---------- mochila vinda do banco (o servidor é quem cria/move itens; o app só lê) ----------
async function invReload(){if(!ONL.on||!ONL.uid)return;try{await itensLoad();const rows=await onlFetch('/rest/v1/inventario?select=item,equipado&personagem_id=eq.'+ONL.uid);
 INV=[];EQ={};ONL.unk=[];(rows||[]).forEach(r=>{const it=ITEMS[r.item];if(!it){ONL.unk.push({item:r.item,equipado:!!r.equipado});return}if(r.equipado&&!EQ[it.slot])EQ[it.slot]=r.item;else INV.push(r.item)});
 if(invSel&&!hasItem(invSel))invSel=null;invSave();stats();if(ONL.last)ONL.last.inv=JSON.stringify(onlInv());if(!$('#inv').hidden)bagRefresh();tradeDraw()}
 catch(e){onlReg('⚠️ Não consegui recarregar a mochila: '+onlErr(e))}}
// ---------- Trocas: cada um escolhe quais itens e quantas unidades manda (pode ser só de um lado, como presente).
// O servidor confere no banco e, ao confirmar, as unidades escolhidas mudam de dono todas juntas (nunca fica metade).
let tInvQ=null,tInvT=0,tSel=null;
const TMAX=6; // tipos de item por pessoa em uma troca
function stacks(list){const m=new Map();for(const id of list)m.set(id,(m.get(id)||0)+1);return [...m].map(([i,n])=>({i,n}))}
const iNm=x=>(ITEMS[x]&&ITEMS[x].name)||x;
function offTxt(L){L=(L||[]).map(x=>typeof x==='string'?{i:x,n:1}:x);return L.length?L.map(x=>(x.n>1?x.n+'× ':'')+iNm(x.i)).join(', '):'nada'}
const offN=(L,id)=>{const o=(L||[]).find(x=>x.i===id);return o?o.n:0};
const freeN=id=>INV.reduce((a,x)=>a+(x===id),0); // só o que está na mochila (equipado não entra)
function tradeInvite(m){tInvQ=m;const b=$('#tinvp');b.querySelector('span').textContent='🤝 '+m.nome+' quer trocar itens com você';b.hidden=false;clearTimeout(tInvT);tInvT=setTimeout(()=>{b.hidden=true;tInvQ=null},(m.ttl||30)*1000)}
function tradeSet(list){const T=ONL.trade;if(!T||T.busy)return;list=list.filter(x=>x.n>0);T.mine=list;T.ok=[false,false];T.conf=[false,false];tradeDraw();gsSend({t:'toff',items:list})}
// muda a quantidade de um item na sua oferta (n = nova quantidade, já limitada ao que você tem)
function tradeQty(id,n){const T=ONL.trade;if(!T||T.busy)return;n=Math.max(0,Math.min(freeN(id),n|0));const L=T.mine.map(x=>({i:x.i,n:x.n})),o=L.find(x=>x.i===id);
 if(o)o.n=n;else if(n>0){if(L.length>=TMAX)return toast('Máximo de '+TMAX+' tipos de item por troca.');L.push({i:id,n})}tSel=id;tradeSet(L)}
function tradeInfo(id,mine){const it=ITEMS[id],el=$('#tdInfo');if(!it){el.textContent='';return}const rc=rarOf(it),L=Object.keys(STX).filter(k=>+(it.stats||{})[k]).map(k=>stLine(k,+it.stats[k]));
 let h='<b style="color:'+rc[1]+'">'+esc(it.name)+'</b> <span class="z">'+rc[0]+'</span>'+(L.length?' · '+L.join(' · '):'')+(it.atk&&it.atk.kind?' · ⚡ ataque especial':'');
 const T=ONL.trade;if(mine&&T&&!T.busy){const have=freeN(id),n=offN(T.mine,id);
  h+='<div class="tdq"><span>Na troca:</span><button data-q="-1" class="sec"'+(n<1?' disabled':'')+'>−</button><b>'+n+'</b><button data-q="1" class="sec"'+(n>=have?' disabled':'')+'>+</button><span class="z">de '+have+' na mochila</span>'
   +'<button data-q="all"'+(n>=have?' disabled':'')+'>Todos</button><button data-q="0" class="sec"'+(n<1?' disabled':'')+'>Tirar</button></div>'}
 el.innerHTML=h;el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const q=b.dataset.q,n=offN(ONL.trade.mine,id);tradeQty(id,q==='all'?freeN(id):q==='0'?0:n+(+q))})}
function tSlot(id,n,on,sel){const b=bagSlot(id,'',on);if(!id){b.innerHTML='';return b}if(n>1){const q=document.createElement('i');q.className='qt';q.textContent='×'+n;b.appendChild(q)}if(sel)b.classList.add('sel');return b}
function tradeDraw(){const w=$('#trd'),T=ONL.trade;if(!w)return;w.hidden=!T;if(!T)return;
 T.mine=(T.mine||[]).map(x=>typeof x==='string'?{i:x,n:1}:x);T.theirs=(T.theirs||[]).map(x=>typeof x==='string'?{i:x,n:1}:x);
 $('#tdNome').textContent=T.other.nome;$('#tdNome2').textContent=T.other.nome;
 const st=i=>T.busy?'trocando…':T.conf[i]?'✔✔ confirmou':T.ok[i]?'✔ pronto':'escolhendo…';
 $('#tdSt0').textContent=st(0);$('#tdSt1').textContent=st(1);$('#tdSt0').className=T.ok[0]?'on':'';$('#tdSt1').className=T.ok[1]?'on':'';
 const fill=(el,list,pre,on)=>{el.innerHTML='';for(let i=0;i<TMAX;i++){const o=list[i];el.appendChild(tSlot(o&&o.i,o&&o.n,o?()=>on(o.i):null,o&&tSel===pre+o.i))}};
 fill($('#tdMine'),T.mine,'',id=>{tSel=id;tradeDraw()});
 fill($('#tdTheirs'),T.theirs,'o:',id=>{tSel='o:'+id;tradeDraw()});
 const bag=$('#tdBag');bag.innerHTML='';const SK=stacks(INV).map(x=>({i:x.i,n:x.n-offN(T.mine,x.i)})).filter(x=>x.n>0);
 if(!SK.length)bag.innerHTML='<p class="z">'+(INV.length?'Tudo o que está livre na mochila já está na troca.':'Nenhum item livre na mochila.')+'</p>';
 SK.forEach(x=>bag.appendChild(tSlot(x.i,x.n,()=>tradeQty(x.i,offN(T.mine,x.i)+1),false)));
 if(tSel&&tSel.startsWith('o:'))tradeInfo(tSel.slice(2),false);else if(tSel&&(freeN(tSel)||offN(T.mine,tSel)))tradeInfo(tSel,true);
 else $('#tdInfo').innerHTML='Toque num item da sua mochila para colocar 1 na troca (toque de novo para mais, ou use <b>Todos</b>). Pode ser só de um lado, como presente. Qualquer mudança desfaz o "Pronto" dos dois.';
 const b=$('#tdOk'),both=T.ok[0]&&T.ok[1];
 b.disabled=!!T.busy||(T.ok[0]&&!T.ok[1])||(T.conf[0]&&!T.conf[1]);
 b.textContent=T.busy?'Trocando…':!T.ok[0]?'Pronto':!T.ok[1]?'Esperando '+T.other.nome+'…':!T.conf[0]?'Confirmar troca':'Esperando confirmação…';
 b.className=both&&!T.conf[0]?'go':'';
 const gift=!T.mine.length&&T.theirs.length?' (presente para você)':T.mine.length&&!T.theirs.length?' (presente)':'';
 $('#tdMsg').textContent='Você dá: '+offTxt(T.mine)+' · Você recebe: '+offTxt(T.theirs)+gift}
let gsInvQ=null,gsInvT=0;
function grpInvite(m){gsInvQ=m;const b=$('#pinv');b.querySelector('span').textContent=m.nome+' te convidou para o grupo';b.hidden=false;clearTimeout(gsInvT);gsInvT=setTimeout(()=>{b.hidden=true;gsInvQ=null},(m.ttl||30)*1000)}

// ---------- Efeitos Hyuga (folha de VFX do Kaiten): quadros num atlas, tocados em sequência ----------
// cada quadro: [x, y, largura, altura, chãoX, chãoY] — "chão" é o ponto que fica nos pés do personagem
const KFX=__KFX__,KIMG=new Image();let KFX_OK=false;KIMG.onload=()=>{KFX_OK=true};KIMG.src=KFX.img;
// folha dos Susanoo (Sasuke roxo, Itachi vermelho, Madara armadura) + faíscas e explosão usadas pela Mangekyō
const SFX=__SFX__,SIMG=new Image();let SFX_OK=false;SIMG.onload=()=>{SFX_OK=true};SIMG.src=SFX.img;
const PHF=ph=>KFX.f[ph]||SFX.f[ph]||[];
// botões Hyuga com os ícones da folha
{const H=JU.hyuga;if(H){['palma','kaiten','hakke'].forEach(q=>{if(H[q]){H[q].kq=q;H[q].im=KFX.ic[q]}});if(H.kaiten)H.kaiten.stun=BAL.golpes.kaitenAtordoa;if(H.h128)H.h128.im=KFX.ic.hakke;if(H.kperf)H.kperf.im=KFX.ic.kaiten}}
// linha do tempo de cada efeito: [fase, segundos por quadro, (quais quadros)]
const KSEQ={
 kaiten:f=>[['p1',.025],['p2',.03],['p3',.05],[f.hit?'p4':'p3',.05],['p5',.05],['frag',.14]], // acúmulo → domo → giro → (impacto) → dissipa
 palma:()=>[['rastro',.08],['frag',.12,[0]]],
 hakke:()=>[['p1',.04],['p5',.09,[3,4,5,6]]],
 icon:f=>[['icon',f.d||.6,[f.i|0]]]};
// Susanoo: surge → forma → fica de pé (repete n vezes, o tempo do reforço) → desfaz. Ataques: esferas / escudo / descarga
Object.assign(KSEQ,{
 sus_sasuke:f=>[['s_on',.07],['s_form',.08],['s_aura',.11,null,f.n||1],['s_orbx',.4]],
 sus_itachi:f=>[['x_exp',.06],['i_def',.09],['i_aura',.1,null,f.n||1],['i_off',.45]],
 sus_madara:f=>[['m_on',.11],['m_arm',.09],['m_aura',.12,null,f.n||1],['m_off',.45]],
 sk_sasuke:()=>[['s_orb',.07,null,2],['s_orbx',.22]],
 sk_itachi:()=>[['i_shield',.2],['i_orb',.08,null,2]],
 sk_madara:()=>[['m_ring',.08,null,3]],
 mgk:()=>[['x_exp',.06],['pt1',.08]],
 mgk_pt:f=>[['pt1',.12,null,f.n||1],['pt2',.1]]});
const kfxLen=(q,f)=>KSEQ[q](f||{}).reduce((t,[ph,dt,idx,rep])=>t+dt*(idx?idx.length:PHF(ph).length)*(rep||1),0);
function kfxAdd(o){const T=kfxLen(o.q,o);const f=Object.assign({k:'kfx',life:T,max:T},o);fx.push(f);return f}
function kfxDraw(f,fromL){if(f.bh&&!fromL)return; // aura atrás do ninja: desenhada junto com os personagens (susL)
 const t=f.max-f.life,S=KSEQ[f.q]?KSEQ[f.q](f):[];let acc=0,fr=null,seg=0,segT=0,segD=1,ph0=null;
 for(let j=0;j<S.length;j++){const [ph,dt,idx,rep]=S[j],F=PHF(ph),L=idx||F.map((_,i)=>i),d=dt*L.length*(rep||1);
  if(t<acc+d||j===S.length-1){let k=Math.max(0,(t-acc)/dt|0);k=rep?k%L.length:Math.min(L.length-1,k);fr=F[L[k]];ph0=ph;seg=j;segT=t-acc;segD=d;break}acc+=d}
 const isS=!KFX.f[ph0];if(!fr||!(isS?SFX_OK:KFX_OK))return;let x=f.x,y=f.y;
 if(f.fol){const o=f.pid?ONL.peers[f.pid]:p;if(o&&o.x!=null){x=o.x;y=o.y}}
 let sc=(f.sc||1)*(isS?SFX.s[ph0]||1:1),al=f.al||1;
 if(f.q==='icon'){sc*=.6+.4*Math.min(1,t/.12);al*=Math.min(1,(f.max-t)/(f.max*.4))}
 else if(seg===S.length-1&&S.length>1)al*=Math.max(0,1-segT/segD); // última parte some aos poucos
 const [sx,sy,w,h,gx,gy]=fr;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,al));
 ctx.drawImage(isS?SIMG:KIMG,sx,sy,w,h,x-gx*sc,y+(f.dy||0)-gy*sc,w*sc,h*sc);ctx.restore()}
// auras de Susanoo ficam atrás do ninja (dele e dos outros jogadores) e acompanham cada passo
function susL(L){eyeL(L);for(const f of fx){if(f.k!=='kfx'||!f.bh)continue;const o=f.pid?(ONL.peers||{})[f.pid]:p;if(!o||o.x==null)continue;if(f.pid&&o.ey!==2){f.life=0;continue}L.push({y:o.y-.5,d:()=>kfxDraw(f,1)})}}
// golpe em área em volta de um ponto (empurra para fora)
function aoeHit(cx,cy,r,dmg,st,kb){let n=0;E.concat(PVT()).forEach(e=>{if(e.dead)return;const dx=e.x-cx,dy=e.y-cy,d=Math.hypot(dx,dy);if(d>=r+(e.rad||0)*.6)return;n++;const u=d||1;hitE(e,dmg,st,dx/u*kb,dy/u*kb)});return n}
// texto da habilidade de cada item (mochila e aba Personagem)
function itemSkTxt(it){const A=it.atk||{},mp=+A.mp?', gasta '+A.mp+' de chakra':'';
 return 'investida de raio: avança no inimigo mais próximo e causa '+(A.dmg||16)+' de dano em área ('+(A.area||64)+')'+mp+'.'}
// ===================== Jutsus: árvore de cada clã (liberam com o nível e evoluem) =====================
const SFXIC=__SFXIC__;
// Sharingan por estágio (tomoe) e a evolução para a Mangekyō no Nv 40. cone em tiles; ang = meia abertura (graus)
// mp = chakra para ligar · dr = chakra por segundo ligado · st = paralisia do olhar (s) · prec/esq/cdmg = reforço enquanto ligado
const TOM=[null].concat(BAL.olhos.tomoe); // balanceamento.json → olhos.tomoe
const SUSDR=BAL.olhos.susanooDreno; // chakra por segundo a mais enquanto o Susanoo está de pé
// cada Mangekyō tem o seu Susanoo (depois: Amaterasu, Tsukuyomi… também só com a Mangekyō ativada)
const EYES={
 itachi:{n:'Itachi',d:'Susanoo vermelho com escudo: o mais resistente. Empurra e atordoa quem está perto.',sus:BAL.olhos.susanoo.itachi},
 sasuke:{n:'Sasuke',d:'Susanoo roxo: as esferas giram em volta e cortam duas vezes. O mais ofensivo.',sus:BAL.olhos.susanoo.sasuke},
 madara:{n:'Madara',d:'Susanoo com armadura: descarga de chakra na maior área e empurra mais longe.',sus:BAL.olhos.susanoo.madara}};
// árvore: ramos com nós (sl = botão: 0 inicial, 1 meio, 2 grande). tm = estágio do olho
// árvore de cada clã: cada nó aponta para um jutsu do catálogo (j); os do olho do Uchiha são estágios do mesmo jutsu ("olho")
const JT={
 uchiha:[{b:'Katon (fogo)',n:[{id:'katon',j:'katon'},{id:'goka',j:'goka'},{id:'hosenka',j:'hosenka'},{id:'goryuka',j:'goryuka'}]},
  {b:'Sharingan → Mangekyō',n:[{id:'tm1',j:'olho',tm:1},{id:'tm2',j:'olho',tm:2},{id:'genj',j:'genj'},{id:'tm3',j:'olho',tm:3},{id:'mgk',j:'olho',tm:4}]},
  {b:'Técnicas da Mangekyō (só com ela ativada)',n:[{id:'amat',j:'amat'},{id:'tsuku',j:'tsuku'},{id:'sus',j:'sus'}]}],
 hyuga:[{b:'Punho Gentil (Jūken)',n:[{id:'palma',j:'palma'},{id:'hakke',j:'hakke'},{id:'h128',j:'h128'}]},
  {b:'Defesa (Kaiten)',n:[{id:'kaiten',j:'kaiten'},{id:'kperf',j:'kperf'}]},
  {b:'Byakugan e Kūshō',n:[{id:'byak',j:'byak'},{id:'kusho',j:'kusho'},{id:'sojishi',j:'sojishi'}]}],
 nara:[{b:'Ferramentas ninja',n:[{id:'shuri',j:'shuri'}]},
  {b:'Kagemane (prender)',n:[{id:'sombra',j:'sombra'},{id:'kubi',j:'kubi'},{id:'poss',j:'poss'},{id:'dominio',j:'dominio'}]},
  {b:'Kage Nui (atacar com a sombra)',n:[{id:'nui',j:'nui'},{id:'yose',j:'yose'}]},
  {b:'Estratégia',n:[{id:'campo',j:'campo'},{id:'intelecto',j:'intelecto'}]}]};
// nível de cada nó: olhos do Uchiha em olhos.tomoe, o resto no catálogo (balanceamento.json → golpes.jutsus)
for(const c in JT)JT[c].forEach(B=>B.n.forEach(n=>{if(n.soon)return;n.lv=n.tm?TOM[n.tm].lv:juLv(JU[c]&&JU[c][n.j])}));
const JTD={
 katon:'Katon: Gōkakyū no Jutsu. Faz os selos e solta uma grande bola de fogo pela boca, que explode ao acertar.',
 tm1:'O Sharingan desperta com 1 tomoe: enxerga o chakra e acompanha movimentos rápidos.',
 tm2:'2 tomoe: lê o corpo do oponente e prevê melhor os golpes.',
 tm3:'3 tomoe: o Sharingan completo. Prevê qualquer movimento e prende com o olhar.',
 mgk:'O Sharingan evolui para a Mangekyō e toma o lugar dele no botão. Mais forte e mais cara de manter. Ativada, libera as técnicas da Mangekyō (Amaterasu, Tsukuyomi e Susanoo).',
 sus:'O guerreiro espectral do seu Mangekyō. Libera no Nv '+juLv(JU.uchiha.sus)+' e só pode ser invocado com a Mangekyō ativada; se ela for desativada, ele se desfaz.',
 amat:'Amaterasu: chamas negras que não se apagam. Queimam o alvo por vários segundos. Só com a Mangekyō ativada.',
 tsuku:'Tsukuyomi: a ilusão que prende o oponente num mundo onde o tempo para (atordoa). Precisa do olhar: quem está de costas para você não é pego. Só com a Mangekyō ativada.',
 goka:'Katon: Gōkakyū no Jutsu (forte): a bola de fogo grande, mais lenta, que explode em área. A Bola de Fogo do botão 1 continua a rápida.',
 hosenka:'Katon: Hōsenka no Jutsu: várias bolinhas de fogo em leque. Cada uma vale um pedaço do golpe; dá para desviar de algumas.',
 goryuka:'Katon: Gōryūka no Jutsu: o dragão de fogo cai onde está o alvo. O chão avisa antes (todo mundo vê): dá tempo de sair.',
 genj:'Genjutsu: Sharingan: o olho prende o alvo numa ilusão. Jogador: os controles ficam invertidos; monstro: fica perdido. Passa quando ele leva dano.',
 palma:'Jūken: golpe de palma que atinge os pontos de chakra.',
 kaiten:'Hakkeshō Kaiten: gira soltando chakra pelo corpo todo; empurra quem está perto e bloqueia golpes enquanto gira.',
 hakke:'Hakke Rokujūyon Shō: 64 golpes seguidos nos pontos de chakra; quem está perto fica preso, toma dano contínuo e é empurrado.',
 byak:'Byakugan: ativa e desativa. Ativado, enxerga os pontos de chakra: mais precisão e o genjutsu dura menos em você. Gasta um pouco do chakra por segundo.',
 kusho:'Hakke Kūshō: palma de vácuo à distância. Acerta o primeiro inimigo na linha e empurra longe.',
 h128:'Hakke Hyakunijūhachi Shō: a evolução das 64 Palmas, com mais golpes e o chakra selado por mais tempo. No nível dela toma o lugar das 64 no botão (dá para voltar).',
 sojishi:'Hakke Kūshō: Sōjishi: duas palmas de vácuo ao mesmo tempo, para a frente e para trás. Quem está dentro é empurrado e fica lento.',
 kperf:'Kaiten Perfeito: o Kaiten maior. Bloqueia projéteis enquanto gira e no fim solta o golpe em toda a volta (a força é dividida entre os alvos) e sela o chakra.',
 shuri:'Arremesso de shuriken.',
 sombra:'Kagemane no Jutsu: a sombra estica em linha e prende quem tocar.',
 poss:'A sombra se espalha em área e prende vários inimigos ao mesmo tempo.',
 nui:'Kage Nui: a sombra vira agulhas que perseguem o alvo, ferem e deixam lento. Elas viram devagar: dá para desviar correndo.',
 kubi:'Kage Kubishibari: a sombra sobe pelo corpo de quem já está preso no seu Kagemane e aperta o pescoço: silencia (só o golpe básico funciona) e machuca aos poucos. Só pega quem está preso na sua sombra.',
 yose:'Kageyose: a sombra estica em linha, agarra o primeiro inimigo e puxa ele até você.',
 campo:'Campo de Sombras: a sombra cobre o chão em volta por alguns segundos. Inimigos dentro ficam lentos; você recebe menos dano enquanto ele dura.',
 intelecto:'Intelecto Nara (passiva): pensar dez jogadas à frente. Não ocupa botão: os jutsus de sombra recarregam mais rápido e prender/atordoar/deixar lento duram mais nos monstros.',
 dominio:'Domínio das Sombras: a sombra toma toda a área em volta, prende e silencia todo mundo dentro.'};
// contrato de invocação: um ramo a mais em todos os clãs (Entrega 11)
if(INV_ON)for(const c in JT)JT[c].push({b:'Contrato de invocação',n:[{id:'kuchi',j:'kuchi',lv:ctLv()}]});
JTD.kuchi='Kuchiyose no Jutsu: um contrato de sangue com uma família de animais. O contrato dá uma vantagem pequena que vale sempre, e o jutsu invoca o animal na fumaça (entra na barra como qualquer jutsu). Só um contrato por vez.';
const SLN=['1','2','grande','3'],TPN={ninjutsu:'Ninjutsu',genjutsu:'Genjutsu',taijutsu:'Taijutsu',bukijutsu:'Bukijutsu'};
// ícone da Mangekyō: o Sharingan sobre a explosão vermelha da folha dos Susanoo
let MGKIC=null;{const U=[null,JU.uchiha&&JU.uchiha.olho];if(U[1]&&SPR.ic&&SPR.ic[U[1].ic]){const a=new Image(),b=new Image();let n=0;
 const go=()=>{if(++n<2)return;try{const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.drawImage(b,0,0,96,96);g.drawImage(a,18,18,60,60);MGKIC=c.toDataURL();jtBtnTick.l=null}catch(_){}};
 a.onload=go;b.onload=go;a.src=SPR.ic[U[1].ic];b.src=SFXIC.exp}}
/* ícones novos dos jutsus (arte/ui → src/ui/icones.json). Sem ícone novo, fica o de antes */
const UIJ=__UIJ__;
function uiJuIc(s){if(!s||!clan||!CH)return '';let k=s.id;if(s.t==='eye'){const l=eyeLv();k=l===4&&CH.mgk?'mgk_'+CH.mgk:'olho'+Math.max(1,l)}return UIJ[k]?'<img class="uij" src="'+UIJ[k]+'" style="image-rendering:auto">':''}
/* ---------- pacote 13: ícones de estado, números de dano, faixa do nível e círculos de aviso ---------- */
const stIc=n=>n&&UIJ[n]?'<i class="sti" style="background-image:url('+UIJ[n]+')"></i>':'';
function stDeBuf(k,b){if(k==='lento')return 'st_lento';if(k==='sus'||k==='campo')return 'st_escudo';if(k==='inv')return /cura/i.test(b.nm||'')?'st_regen':'st_escudo';
 if(k==='eye'||k==='byak')return '';if(+b.dmg>0)return 'st_forca';if(+b.spd>0)return 'st_veloc';if(+b.red>0)return 'st_escudo';return ''}
/* números: branco = seu dano, amarelo = crítico, vermelho = dano que você leva, cinza = dano de outros jogadores, verde = cura (reservado) */
const DGI={};function dgImg(n){let o=DGI[n];if(!o&&UIJ[n]){const im=new Image();o=DGI[n]={im,w:null};im.onload=()=>{try{const c=document.createElement('canvas'),cw=im.width/10;c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
  const d=g.getImageData(0,0,im.width,im.height).data;o.w=[];for(let k=0;k<10;k++){let a=-1,z=-1;for(let x=Math.floor(k*cw);x<Math.floor((k+1)*cw);x++){let on=0;for(let y=0;y<im.height;y++)if(d[(y*im.width+x)*4+3]>40){on=1;break}if(on){if(a<0)a=x;z=x}}o.w.push(a<0?[k*cw,cw]:[a,z-a+1])}}catch(_){o.w=null}};im.src=UIJ[n]}
 return o&&o.w&&o.im.complete?o:null}
function ftDig(f){if(f.txt||f.col)return false;const m=/^(\d+)(!?)$/.exec(String(f.t));if(!m)return false;const crit=!!(f.crit||m[2]||f.gold);
 const o=dgImg(crit&&!f.r?'dg_amarelo':f.r?'dg_vermelho':f.cura?'dg_verde':f.oth?'dg_cinza':'dg_branco');if(!o)return false;
 const ih=o.im.height,h=(crit?17:13)*(f.oth?.85:1),k=h/ih,s=m[1];let W=0;for(const c of s)W+=o.w[+c][1]*k-1;
 let x=f.x-W/2;ctx.globalAlpha=Math.min(1,f.life*2);for(const c of s){const [sx,sw]=o.w[+c];ctx.drawImage(o.im,sx,0,sw,ih,x,f.y-h+2,sw*k,h);x+=sw*k-1}return true}
/* círculo rúnico no chão nos avisos de área (vermelho no fogo, azul no Hyuga); no fim ele some aos poucos */
const RNI={};function rnImg(n){let i=RNI[n];if(!i&&UIJ[n]){i=new Image();i.src=UIJ[n];RNI[n]=i}return i&&i.complete&&i.naturalWidth?i:null}
function runaDraw(f,k,ts){const c=String(f.col||'#ff5a1a'),r=parseInt(c.slice(1,3),16)||0,b=parseInt(c.slice(5,7),16)||0,im=rnImg(b>r?'runa_azul':'runa_vermelha');if(!im)return false;
 const R=f.r,h=R*im.height/im.width,el=f.max-f.life,kt=f.tel?Math.min(1,el/f.tel):k,fim=f.tel?Math.max(0,(el-f.tel)/Math.max(.01,f.max-f.tel)):Math.max(0,(k-.78)/.22),so=rnImg('runa_some');ctx.save();ctx.translate(f.x,f.y);ctx.scale(1,.55);
 if(fim<=0){ctx.globalAlpha=.18+.22*kt;ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,R*kt,0,7);ctx.fill()} /* o miolo enche até a hora do golpe */
 ctx.rotate(ts/1800);ctx.globalAlpha=.92*(1-fim);ctx.drawImage(im,-R,-h,2*R,2*h);if(so&&fim>0){ctx.globalAlpha=.9*fim;ctx.drawImage(so,-R,-h,2*R,2*h)}ctx.restore();return true}
{try{if(UIJ.faixa)document.documentElement.style.setProperty('--ui-faixa','url('+UIJ.faixa+')')}catch(_){}}
/* avisos no meio da tela (toast): cartão de pergaminho com moldura de madeira; conquistas (novo jutsu, evolução, contrato, olho, especialidade)
   ganham a faixa dourada e o ícone do jutsu (ou o emblema do clã). "Título: texto" vira título pequeno em cima e texto grande embaixo. */
const tEsc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function tstIc(em,bd){const nm=String(bd).replace(/[!.]+$/,'').trim();let h='';
 if(/🌀|⬆/.test(em)&&clan&&JU[clan]){const e=Object.entries(JU[clan]).find(([id,j])=>j&&j.n===nm);if(e)h=uiJuIc(Object.assign({},e[1],{id:e[1].id||e[0]}))}
 if(!h&&/👁/.test(em)&&CH){const k=CH.mgk&&UIJ['mgk_'+CH.mgk]?'mgk_'+CH.mgk:'olho3';if(UIJ[k])h='<img src="'+UIJ[k]+'">'}
 if(!h&&clan&&UIJ['emb_'+clan])h='<img src="'+UIJ['emb_'+clan]+'">';return h}
toast=function(t){const el=$('#toast');if(!el)return;const s=String(t==null?'':t);let em='',r=s;
 const m=/^(\S+)\s+([\s\S]*)$/.exec(s);if(m&&m[1].length<=4&&!/[A-Za-z0-9À-ÿ\[\]]/.test(m[1])){em=m[1];r=m[2]}
 const cq=/^(🌀|⬆|📜|👁|🎖)/.test(em),i=r.indexOf(': ');let hd='',bd=r;if(i>0&&i<34){hd=r.slice(0,i);bd=r.slice(i+2)}
 const ic=cq?tstIc(em,bd):'';el.className=cq?'tt-conq':'tt-av';
 el.innerHTML=(ic?'<div class="tic">'+ic+'</div>':em?'<div class="tem">'+tEsc(em)+'</div>':'')+'<div class="ttx">'+(hd?'<small>'+tEsc(hd)+'</small>':'')+'<b>'+tEsc(bd)+'</b></div>';
 el.hidden=false;el.style.animation='none';void el.offsetWidth;el.style.animation='';clearTimeout(toastT);toastT=setTimeout(()=>el.hidden=true,cq?4500:3500)};
const skIcon=s=>uiJuIc(s)||(s.imk?'<img src="'+SPR[s.imk]+'" style="image-rendering:auto">':s.im?'<img src="'+s.im+'" style="image-rendering:auto">':s.ic!=null&&SPR.ic&&SPR.ic[s.ic]?'<img src="'+SPR.ic[s.ic]+'">':'<span>'+(s.i||'❔')+'</span>');
const imgIc=u=>'<img src="'+u+'" style="image-rendering:auto">';
function eyeLv(){if(clan!=='uchiha'||!CH)return 0;const l=CH.lv|0;return l>=TOM[4].lv&&EYES[CH.mgk]?4:l>=TOM[3].lv?3:l>=TOM[2].lv?2:l>=TOM[1].lv?1:0}
const jtNodes=()=>(JT[clan]||[]).flatMap(b=>b.n);
function jtSlotLv(i){const s=clan&&CLANS[clan].sk[i];return s?(s.t==='eye'?TOM[1].lv:juLv(s)):1} // nível que libera o jutsu que está no botão
// o que cada botão mostra agora (nome, ícone, trava)
function jtBtn(i){const s=CLANS[clan].sk[i];if(!s)return{nm:'',ic:'',lk:null,eye:0};let nm=s.n,ic=skIcon(s),lk=null,eye=0,ct=0;
 if(s.t==='eye'){const l=eyeLv();if(l===4){nm='Mangekyō';const u=UIJ['mgk_'+CH.mgk]||MGKIC;if(u)ic=imgIc(u)}else if(!l)lk=TOM[1].lv}
 else if(s.t==='sus'){const L2=juLv(s);if((CH.lv|0)<L2)lk=L2;else if(eyeLv()===4){if(SFXIC[CH.mgk])ic=imgIc(SFXIC[CH.mgk])}else eye=1}
 else if(s.t==='kuchi'){const L2=juLv(s);if((CH.lv|0)<L2)lk=L2;else if(!ctFam())ct=1;else if(INVIC[CH.ct.k])ic=imgIc(INVIC[CH.ct.k])}
 else if((CH.lv|0)<juLv(s))lk=juLv(s);
 return{nm,ic,lk,eye,ct}}
const barSlots=()=>clan&&CLANS[clan].sk[3]?[0,1,2,3]:[0,1,2]; // botão 3 só é de jutsu se tiver um nele (senão é o do item)
function skBtns(){if(!clan||!CH)return;for(const i of barSlots()){const b=$('#b'+i);if(!b)continue;const o=jtBtn(i);b.classList.remove('empty');
  b.innerHTML=o.ic+o.nm+(o.lk?'<small class="lk">🔒 Nv '+o.lk+'</small>':o.eye?'<small class="lk">👁️ escolha</small>':o.ct?'<small class="lk">📜 contrato</small>':'')+'<div class="cd"></div>';b.classList.toggle('lock',!!(o.lk||o.eye||o.ct))}}
// a cada quadro: travas, olho ligado, Susanoo só com a Mangekyō; e avisa quando um jutsu novo libera
function jtBtnTick(){if(!clan||!CH)return;const key=CH.lv+'|'+CH.mgk+'|'+eyeLv()+'|'+(MGKIC?1:0)+'|'+(CH.ct&&CH.ct.k);
 if(jtBtnTick.l!==key){if(jtBtnTick.lv!=null&&CH.lv>jtBtnTick.lv)jtLvUp(jtBtnTick.lv,CH.lv);jtBtnTick.l=key;jtBtnTick.lv=CH.lv;skBtns();const pj=$('#paneJu');if(pj&&!pj.hidden)juDraw()}
 for(const i of barSlots()){const b=$('#b'+i),s=CLANS[clan].sk[i];if(!b||!s)continue;if(b.classList.contains('lock'))b.classList.add('off');
  if(s.t==='eye'){b.classList.toggle('eyeon',!!EYE.on);if(EYE.on)b.classList.remove('off')}
  else if(s.t==='sus'){b.classList.toggle('eyeon',susOn());if(EYE.on!=='mgk')b.classList.add('off')}
  else if(s.t==='byak'){b.classList.toggle('eyeon',!!BYK.on);if(BYK.on)b.classList.remove('off')}
  else if(s.t==='kuchi')b.classList.toggle('eyeon',invAtiva());
  else if(s.mgk&&EYE.on!=='mgk')b.classList.add('off')}}
function jtLvUp(a,b){const L=jtNodes().filter(n=>!n.soon&&n.lv>a&&n.lv<=b);
 for(const id in JU[clan]||{}){const s=JU[clan][id];if(!s.evolui||!BAR)continue;const L2=juLv(s),k=BAR.indexOf(s.evolui);if(a<L2&&b>=L2&&k>=0&&barSet(k,id))setTimeout(()=>{toast('⬆️ '+JU[clan][s.evolui].n+' evoluiu: '+s.n+'!');onlReg('⬆️ '+JU[clan][s.evolui].n+' evoluiu para '+s.n+'!')},1200)}L.forEach(n=>{const nm=jtInfo(n).nm;toast('🌀 Novo jutsu: '+nm+'!');onlReg('🌀 Jutsu liberado no Nv '+n.lv+': '+nm+'. Veja na aba Jutsus.')});
 if(INV_ON&&a<ctLv()&&b>=ctLv()&&!(CH.ct&&CH.ct.k))setTimeout(()=>{if(CH.ct&&CH.ct.k)return;toast('📜 Contrato de invocação liberado: escolha a sua família na aba Jutsus.');onlReg('📜 Contrato de invocação liberado: Sapos, Lesmas ou Cobras. Escolha na aba Jutsus.')},L.length?2000:0);
 if(clan==='uchiha'&&a<TOM[4].lv&&b>=TOM[4].lv&&!CH.mgk)setTimeout(()=>{if(CH.mgk)return; // já escolheu nesse meio-tempo
 toast('👁️ A Mangekyō liberou: escolha o seu olho na aba Jutsus.');onlReg('👁️ Mangekyō liberada: escolha Itachi, Sasuke ou Madara na aba Jutsus.')},L.length?2600:0)}
// travado: explica; Uchiha: botão do meio liga/desliga o olho, botão grande invoca o Susanoo
{const _u=useBtn;useBtn=function(i){const s=clan&&CH&&CLANS[clan].sk[i];if(s){const o=jtBtn(i);
  if(o.eye){toast('👁️ Escolha o seu Mangekyō na aba Jutsus para liberar o Susanoo.');juSel='mgk';juPick=null;toggleBag(true,'ju');return}
  if(o.ct){toast('📜 Escolha o seu contrato de invocação na aba Jutsus.');juSel='kuchi';ctPick=null;toggleBag(true,'ju');return}
  if(o.lk){toast('🔒 '+o.nm+' libera no Nv '+o.lk+'. A árvore está na aba Jutsus.');return}
  if((s.t==='eye'&&!EYE.on||s.t==='sus')&&silBloqueia(s))return silAviso(); // silenciado: não liga o olho nem invoca (desligar pode)
  if(s.t==='byak'&&!BYK.on&&silBloqueia(s))return silAviso();if(s.t==='byak')return byakToggle(i);
  if(s.t==='eye')return eyeToggle(i);if(s.t==='sus')return susPress(i)}
 return _u(i)}}
// ---------- Sharingan / Mangekyō: liga e desliga, gasta chakra por segundo (o chakra não volta enquanto estiver ativado) ----------
const EYE={on:null,lv:0};
const eyeOnAny=()=>!!EYE.on||!!(typeof BYK!=='undefined'&&BYK.on); // olho ligado (Sharingan, Mangekyō ou Byakugan): o chakra não se recupera
const sevMul=esq=>Math.max(BAL.combate.olharMinimo,Math.min(1,1-(+esq||0)/100)); // quanto mais esquiva o alvo tem, menos tempo fica preso
function eyeToggle(i){i=i==null?barSlots().find(k=>CLANS[clan].sk[k]&&CLANS[clan].sk[k].t==='eye'):i;if(EYE.on)return eyeOff();const l=eyeLv();if(i==null||!l||cd[i]>0||actRoot())return;
 if(PST>0){FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7});return}
 const D=TOM[l],mp=Math.round(D.mp*profMp(i));if(seloBloqueia(mp))return seloAviso();if(p.mp<mp){FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}
 p.mp-=mp;EYE.on=D.k;EYE.lv=l;EYE.slot=i;EYE.t0=performance.now();const nm=D.k==='mgk'?'Mangekyō':'Sharingan';
 BUFS.eye={prec:D.prec,esq:D.esq,cdmg:D.cdmg,until:Infinity,nm};stats();bufHud(1);p.au=0;p.aud=.7;
 if(D.k==='mgk'){flash={col:'#4a000c',a:.45};shk=Math.max(shk,.4);kfxAdd({q:'mgk',x:p.x,y:p.y,fol:1,sc:1.2})}else flash={col:'#8a0010',a:.2};
 const n=gaze(D);FT.push({x:p.x,y:p.y-80,t:nm+'!',txt:1,gold:1,life:1.1});
 onlReg('👁️ '+D.n+' ativado'+(n?' (prendeu '+n+' com o olhar)':'')+'.');
 skBtns();gsMeta()}
function eyeOff(why){if(!EYE.on)return;const was=EYE.on;EYE.on=null;delete BUFS.eye;susEnd();
 const k=EYE.slot!=null&&CLANS[clan].sk[EYE.slot]&&CLANS[clan].sk[EYE.slot].t==='eye'?EYE.slot:barSlots().find(q=>CLANS[clan].sk[q]&&CLANS[clan].sk[q].t==='eye');
 if(k!=null){const c=cdOf(k,CLANS[clan].sk[k]);cd[k]=Math.max(cd[k],was==='mgk'?c*BAL.olhos.mangekyoRecarga:c)}stats();bufHud(1);skBtns();gsMeta();
 if(why){FT.push({x:p.x,y:p.y-70,t:why,txt:1,life:1});onlReg('👁️ '+(was==='mgk'?'Mangekyō':'Sharingan')+' desativado: '+why+'.')}}
function eyeTick(dt){if(SUS&&!susOn())SUS=null;if(!EYE.on)return;if(eyeLv()<EYE.lv&&!(EYE.on==='shar'&&eyeLv()>0))return eyeOff('olho trocado');
 const D=TOM[EYE.lv]||TOM[1];if(D.max&&(performance.now()-(EYE.t0||0))/1000>=D.max)return eyeOff('tempo máximo ('+D.max+' s)');
 p.mp-=(eyeDr(D)+(susOn()?SUSDR:0))*dt;if(p.mp<=0){p.mp=0;eyeOff('sem chakra')}}
// chakra por segundo do olho ligado: fixo (dr) + % do chakra máximo (drPct)
function eyeDr(D){return (+D.dr||0)+(+D.drPct||0)*(p&&p.mpMax||0)/100}
function eyeDrTxt(D){return D.drPct?nf(D.drPct)+'% do chakra máximo ('+Math.round(eyeDr(D))+')':nf(D.dr)}
// olhar: paralisa quem estiver no cone à frente (monstros e jogadores fora do grupo). O servidor confere e aplica a esquiva do alvo
function gaze(D){const R=D.cone*T,h=D.ang*Math.PI/180,all=E.concat(PVT()).filter(e=>!e.dead);let a=Math.atan2(p.ay||0,p.ax||(p.fl?-1:1)),best=R+24,tg=null;
 all.forEach(e=>{const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;tg=e}});
 if(tg){a=Math.atan2(tg.y-p.y,tg.x-p.x);p.ax=Math.cos(a);p.ay=Math.sin(a);p.fl=p.ax<0}
 const hit=all.filter(e=>{const dx=e.x-p.x,dy=e.y-p.y,d=Math.hypot(dx,dy);if(d>R+(e.rad||0)*.6)return false;if(d<16)return true;let da=Math.atan2(dy,dx)-a;da=Math.atan2(Math.sin(da),Math.cos(da));return Math.abs(da)<=h});
 fx.push({k:'cone',x:p.x,y:p.y-22,a,r:R,h,col:D.k==='mgk'?'#9a0018':'#e0102a',life:.5,max:.5});
 const st=+(D.st*(profOn('genjutsu')?1+profPerk()/100:1)).toFixed(2);if(hit.length&&profOn('genjutsu'))profGain(10*hit.length);
 if(ONL.on&&ONL.joined){const ms=hit.filter(e=>!e.pvp&&e.sid!=null).map(e=>e.sid),pl=hit.filter(e=>e.pvp).map(e=>e.pvp);if(ms.length||pl.length)gsSend({t:'gaze',st,m:ms,pl})}
 else hit.forEach(e=>{const s=st*sevMul(e.esq)*(e.boss?BAL.combate.olharChefe:1);e.stun=Math.max(e.stun||0,s);FT.push({x:e.x,y:e.y-(e.boss?120:52),t:'paralisado '+nf(s)+'s',txt:1,life:1})});
 return hit.length}
function coneDraw(f){const a=f.life/f.max,k=1-a;ctx.save();ctx.globalAlpha=.42*a;const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);g.addColorStop(0,f.col);g.addColorStop(1,'rgba(120,0,10,0)');
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.arc(f.x,f.y,f.r*(.55+.45*Math.min(1,k*3)),f.a-f.h,f.a+f.h);ctx.closePath();ctx.fill();ctx.restore()}
function gzMsg(m){(m.ms||[]).forEach(o=>{const e=E.find(x=>x.sid===o.m);if(e){e.stun=Math.max(e.stun||0,o.st);FT.push({x:e.x,y:e.y-(e.boss?120:52),t:'paralisado '+nf(o.st)+'s',txt:1,life:1})}});
 (m.pl||[]).forEach(o=>{const pe=ONL.peers[o.id];if(pe&&pe.x!=null)FT.push({x:pe.x,y:pe.y-62,t:'paralisado '+nf(o.st)+'s',txt:1,life:1})})}
function pstunMsg(m){const st=+m.st||0;if(m.imu)ccImune(m.imu);if(!(st>0))return;PST=Math.max(PST,st);FT.push({x:p.x,y:p.y-70,t:'paralisado '+nf(st)+'s',txt:1,life:1.1});flash={col:'#5a0010',a:.3};onlReg('👁️ '+(m.src||'?')+' prendeu você com o olhar ('+nf(st)+' s).')}
{const g=gsMsg;gsMsg=function(m){if(m&&m.t==='gz')return gzMsg(m);if(m&&m.t==='pstun')return pstunMsg(m);return g(m)}}
// brilho vermelho nos olhos (o seu e o dos outros jogadores); Mangekyō com faíscas da folha
function eyeL(L){if(scene|0)return;if(EYE.on&&clan==='uchiha')L.push({y:p.y+.3,d:()=>eyeDraw(p,EYE.on==='mgk'?2:1)});else if(BYK.on&&clan==='hyuga')L.push({y:p.y+.3,d:()=>eyeDraw(p,3)});
 if(ONL.on)for(const id in ONL.peers){const pe=ONL.peers[id];if(pe.ey&&pe.x!=null&&pe.sc===(scene|0))L.push({y:pe.y+.3,d:()=>eyeDraw(pe,pe.ey)})}}
/* lv: 1 Sharingan, 2 Mangekyō (vermelho), 3 Byakugan (azul; os olhos do Hyuga ficam mais à frente e, correndo, mais baixos) */
function eyeDraw(o,lv){const t=performance.now()/1000,by=lv===3,ex=by?(o.mv?13:7.5):3,hx=o.x+(o.fl?-ex:ex),hy=o.y-(by?(o.mv?37:40):43);ctx.save();ctx.globalCompositeOperation='lighter';
 const r=(lv===2?8:6)+Math.sin(t*6)*1.2,g=ctx.createRadialGradient(hx,hy,0,hx,hy,r);if(by){g.addColorStop(0,'rgba(200,228,255,.95)');g.addColorStop(.45,'rgba(90,150,255,.6)');g.addColorStop(1,'rgba(30,70,200,0)')}else{g.addColorStop(0,'rgba(255,50,50,.95)');g.addColorStop(.45,'rgba(220,20,30,.55)');g.addColorStop(1,'rgba(160,0,10,0)')}
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(hx,hy,r,0,7);ctx.fill();ctx.restore();
 if(lv===2&&SFX_OK){const F=SFX.f.pt1,fr=F[(t/.12|0)%F.length],sc=(SFX.s.pt1||1)*.85,[sx,sy,w,h,gx,gy]=fr;ctx.save();ctx.globalAlpha=.6;ctx.drawImage(SIMG,sx,sy,w,h,o.x-gx*sc,o.y-gy*sc,w*sc,h*sc);ctx.restore()}}
// ---------- Susanoo do seu Mangekyō: surge em volta do ninja, ataca em área e fica de pé dando o reforço ----------
let SUS=null;const susOn=()=>!!(SUS&&SUS.until>performance.now());
function susPress(i){i=i==null?barSlots().find(k=>CLANS[clan].sk[k]&&CLANS[clan].sk[k].t==='sus'):i;const sk=i!=null&&CLANS[clan].sk[i];if(!sk||eyeLv()<4||(CH.lv|0)<juLv(sk))return;if(EYE.on!=='mgk'){toast('O Susanoo só pode ser invocado com a Mangekyō ativada.');return}
 if(susOn()||cd[i]>0||actRoot())return;if(PST>0){FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7});return}
 const mp=mpOf(i,sk);if(seloBloqueia(mp))return seloAviso();if(p.mp<mp){FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}
 cd[i]=cdOf(i,sk);p.mp-=mp;HTP=htpDe(sk.tipo||'ninjutsu','sus');try{castSus(EYES[CH.mgk].sus)}finally{HTP=null}}
function susEnd(){if(!SUS&&!BUFS.sus)return;SUS=null;SHD=null;fx=fx.filter(f=>!(f.sus&&!f.rm));if(BUFS.sus){delete BUFS.sus;stats();bufHud(1)}}
const SUSS={sasuke:{q:'sus_sasuke',a:'sk_sasuke',at:.3,fl:'#2a1070'},itachi:{q:'sus_itachi',a:'sk_itachi',at:.26,fl:'#5a0010'},madara:{q:'sus_madara',a:'sk_madara',at:.34,fl:'#3a0008'}};
function susRing(q){const ph=KSEQ[q]({})[0][0],fr=SFX.f[ph]&&SFX.f[ph][0];return fr?fr[2]*(SFX.s[ph]||1)/2:50}
function castSus(A){const S=SUSS[A.sty]||SUSS.sasuke,T=+A.t||8,tp=HTP,r=+A.r||110,hits=Math.max(1,A.hits|0);
 fx=fx.filter(f=>!(f.sus&&!f.rm));SUS={until:performance.now()+T*1000};
 const a=kfxLen(S.q,{n:1}),L=kfxLen(S.q,{n:2})-a;kfxAdd({q:S.q,n:Math.max(1,Math.round((T-(a-L))/L)),x:p.x,y:p.y,fol:1,bh:1,sus:1});
 flash={col:S.fl,a:.35};shk=Math.max(shk,.4);
 KDEL.push({t:S.at,fn:()=>{if(SUS)kfxAdd({q:S.a,x:p.x,y:p.y,fol:1,sc:r*.72/susRing(S.a),al:.85,sus:1})}});
 const t0=Math.max(S.at+.05,+(JU.uchiha.sus.tel)||0); // aviso antes do Susanoo bater (balanceamento.json → golpes.jutsus.uchiha.sus.tel)
 for(let j=0;j<hits;j++)KDEL.push({t:t0+j*.24,fn:()=>{if(!SUS)return;HTP=tp;try{aoeHit(p.x,p.y-8,r,+A.dmg||30,+A.stun||0,+A.kb||0)}finally{HTP=null}}});
 SHD={v:Math.round((+A.escudo||0)/100*p.max),max:Math.round((+A.escudo||0)/100*p.max),until:performance.now()+T*1000};
 bufStart('sus',{red:+A.red||0,dmg:+A.dmgb||0,spd:-(+BAL.olhos.susanooLento||0),t:T,nm:'Susanoo: escudo de '+SHD.v+' ('+(+A.escudo||0)+'% da vida)'+(+A.dmgb?' e +'+A.dmgb+'% de dano':'')})}
// avisa o servidor de cada golpe usado (botão e id do jutsu; 'item' = golpe do item da mão): ele confere a recarga (por enquanto só anota)
function gsCast(sl){if(ONL.on&&ONL.joined){const s=CLANS[clan].sk[sl];gsSend({t:'cast',sl,id:s&&s.id||(sl===3?'item':'')})}}
{const _c=cast;cast=function(i){const b=cd[i];const r=_c(i);if(!(b>0)&&cd[i]>0)gsCast(i);return r}}
{const _ci=castItem;castItem=function(){const b=cd[3];const r=_ci();if(!(b>0)&&cd[3]>0)gsCast(3);return r}}
{const _sp=susPress;susPress=function(i){i=i==null?barSlots().find(k=>CLANS[clan].sk[k]&&CLANS[clan].sk[k].t==='sus'):i;if(i==null)return;const b=cd[i];const r=_sp(i);if(!(b>0)&&cd[i]>0)gsCast(i);return r}}
{const _et=eyeToggle;eyeToggle=function(i){const w=EYE.on;const r=_et(i);if(!w&&EYE.on)gsCast(EYE.slot);return r}}
// derrotado: olho, reforços e Susanoo acabam
{const _h=hurt;hurt=function(n){_h(n);if(HRES&&HRES.dead){eyeOff();susEnd();invEnd();bufClear()}}}
// começo de cada partida
function jtStart(){EYE.on=null;SUS=null;BUFS={};BYK.on=0;BYK.slot=null;INVA=null;SHT=null;jtBtnTick.l=null;jtBtnTick.lv=CH?CH.lv:null;ctApply();barLoad();skBtns();bufHud(1)}
// ---------- barra de jutsus: botões 0 e 1 e o 3 (no lugar do item) escolhidos pelo jogador; o grande (2) só para ultimate ----------
let BAR=null;const barKey=()=>'shinobi-barra-'+String(name).toLowerCase();
const barDefault=()=>(BAL.golpes.barra[clan]||[]).concat(['item']);
const barOkEm=(id,i)=>{const s=JU[clan]&&JU[clan][id];if(!s)return i===3&&id==='item';if(s.papel==='passiva')return false;return i===2?s.papel==='ult':s.papel!=='ult'};
function barLoad(){if(!clan||!JU[clan])return;let b=null;try{b=JSON.parse(localStorage.getItem(barKey())||'null')}catch(_){}const d=barDefault();
 BAR=d.map((x,i)=>Array.isArray(b)&&b[i]&&barOkEm(b[i],i)?b[i]:x);if(new Set(BAR).size<BAR.length)BAR=d;barApply()}
function barSave(){try{localStorage.setItem(barKey(),JSON.stringify(BAR))}catch(_){}}
function barApply(){const C=CLANS[clan];if(!C||!BAR)return;for(let i=0;i<3;i++)if(JU[clan][BAR[i]])C.sk[i]=JU[clan][BAR[i]];
 if(BAR[3]&&BAR[3]!=='item'&&JU[clan][BAR[3]])C.sk[3]=JU[clan][BAR[3]];else C.sk.length=3;
 const b3=$('#b3');if(b3&&C.sk.length===3){b3.classList.remove('lock','eyeon');itemBtn()}skBtns()}
// põe o jutsu "id" no botão i (se ele já estiver em outro botão, os dois trocam de lugar).
// A recarga acompanha o jutsu (JCD guarda quando cada um volta): trocar de botão nunca zera recarga.
const JCD={};
function barSet(i,id){if(!BAR||!barOkEm(id,i))return false;const j=BAR.indexOf(id);if(j>=0&&j!==i&&!barOkEm(BAR[i],j))return false;
 if(j<0&&id!=='item'){const s=JU[clan][id];if((CH.lv|0)<(s.t==='eye'?TOM[1].lv:juLv(s)))return false} // jutsu ainda travado não entra na barra
 if(EYE.on)eyeOff();if(susOn())susEnd();const t=performance.now();BAR.forEach((x,k)=>{JCD[x]=Math.max(JCD[x]||0,t+(cd[k]||0)*1000)});
 if(j>=0&&j!==i)BAR[j]=BAR[i];BAR[i]=id;BAR.forEach((x,k)=>{cd[k]=Math.max(0,((JCD[x]||0)-t)/1000)});barSave();barApply();return true}
// ---------- aba Jutsus ----------
let juSel=null,juPick=null;
function jtInfo(n){const s=n.j&&JU[clan]?JU[clan][n.j]:null;let nm=n.nm||(s&&s.n)||n.id,sub='',ic=s?skIcon(s):'<span>'+(n.ic||'❔')+'</span>';
 if(n.tm){if(n.tm===4){nm='Mangekyō';{const u=UIJ['mgk_'+CH.mgk]||MGKIC;if(u)ic=imgIc(u)}sub=CH.mgk&&EYES[CH.mgk]?'de '+EYES[CH.mgk].n:''}else{nm='Sharingan';sub=n.tm+' tomoe';if(UIJ['olho'+n.tm])ic=imgIc(UIJ['olho'+n.tm])}}
 if(n.id==='sus'&&EYES[CH.mgk]&&SFXIC[CH.mgk]){ic=imgIc(SFXIC[CH.mgk]);sub='de '+EYES[CH.mgk].n}
 if(n.id==='kuchi'){const f=ctFam();if(f&&INVIC[CH.ct.k])ic=imgIc(INVIC[CH.ct.k]);sub=f?f.n:''}
 const ok=!n.soon&&(CH.lv|0)>=n.lv,cur=n.tm?(n.tm===eyeLv()):false,needCt=ok&&n.id==='kuchi'&&!ctFam(),needEye=ok&&(n.id==='mgk'||n.id==='sus')&&!EYES[CH.mgk]||needCt;
 return{nm,sub,ic,ok,cur,needEye,pk:needCt?'escolha o contrato':'escolha o olho',st:n.soon?'soon':!ok?'lock':needEye?'pick':'ok'}}
function juStats(n){const L=[],J=JU[clan]||{},bi=id=>BAR?BAR.indexOf(id):-1,sl=id=>{const k=bi(id);return k>=0?k:(J[id]&&J[id].papel==='ult'?2:1)};
 if(n.tm){const D=TOM[n.tm];L.push('Ativação: o olhar paralisa quem estiver num cone de '+nf(D.cone)+' tiles à frente por '+nf(D.st)+' s (menos tempo quanto mais esquiva o alvo tiver; chefes, metade).');
  L.push('Ativado: +'+D.prec+' de precisão, +'+D.esq+' de esquiva e +'+D.cdmg+'% de dano nos jutsus do clã.');
  L.push('Gasto: '+D.mp+' de chakra para ativar e '+eyeDrTxt(D)+' por segundo'+(D.max?'; fica no máximo '+D.max+' s ativado':'')+'; o chakra não se recupera enquanto estiver ativado. Toque de novo para desativar (recarga de '+nf(cdOf(sl('olho'),J.olho)*(D.k==='mgk'?BAL.olhos.mangekyoRecarga:1))+' s depois).');
  if(n.tm===4)L.push('Libera as técnicas da Mangekyō: Amaterasu (Nv '+juLv(J.amat)+'), Tsukuyomi (Nv '+juLv(J.tsuku)+') e o Susanoo (Nv '+juLv(J.sus)+').');return L}
 if(n.id==='sus'){const E2=EYES[CH.mgk],sk=J.sus;L.push('Invocar: '+mpOf(sl('sus'),sk)+' de chakra, recarga de '+nf(cdOf(sl('sus'),sk))+' s'+(SUSDR?'; enquanto está de pé, gasta +'+SUSDR+' de chakra por segundo':'')+'.');
  if(E2){const A=E2.sus;L.push('Ao surgir: '+A.dmg+' de dano em área'+(A.hits>1?' ('+A.hits+' vezes)':'')+(A.stun?' e atordoa '+nf(A.stun)+' s':'')+'.');L.push(A.t+' s de pé: escudo de '+(+A.escudo||0)+'% da vida'+(A.dmgb?' e +'+A.dmgb+'% de dano':'')+'; '+(+BAL.olhos.susanooLento||0)+'% mais lento e sem recuperar vida; quebrou o escudo, ele se desfaz.')}
  else L.push('Cada Mangekyō tem o seu: escolha o olho no nó da Mangekyō.');return L}
 if(n.id==='kuchi')return ctStats(sl('kuchi'));
 if(n.soon)return L;const s=J[n.j];if(!s)return L;const k=sl(n.j);
 if(s.nat&&NATT[s.nat])L.push('Natureza '+natNome(s.nat)+' ('+natRel(s.nat)+'). '+(s.papel==='basico'?'Golpe básico: só conta forte/fraco.':'No PvP: '+natEfTxt(s.nat)+'.'));
 if(s.papel==='passiva'){L.push('Jutsus de sombra (Kagemane, Kage Nui, Kubishibari, Possessão, Kageyose, Campo e Domínio): −'+(+s.cdSombra||0)+'% de recarga.');L.push('Em monstros, prender, atordoar e deixar lento duram +'+(+s.ccPve||0)+'%.');return L}
 if(s.dmg){const pt=+s.pot||1,ch=isChakra(s.tipo),agora=Math.max(1,Math.round(hitRaw(s.dmg,s.tipo)*pt));L.push('Dano: '+nf(s.dmg*pt)+' <b class="esc '+(ch?'int':'str')+'">(+'+Math.round(pt*100)+'% '+(ch?'INT':'STR')+')</b> · agora '+agora+' por acerto <small class="z">(escala com '+(ch?'Poder de chakra, que vem da Inteligência':'Poder físico, que vem da Força')+')</small>')}
 L.push('Chakra '+mpOf(k,s)+' · Recarga '+nf(cdOf(k,s))+' s'+(s.tel?' · Aviso '+nf(s.tel)+' s':'')+(s.stun?' · Atordoa '+nf(s.stun)+' s':'')+(s.root?' · Prende '+nf(s.root)+' s'+(s.alvos?' (até '+s.alvos+' alvos)':''):'')+(s.ccPvp&&s.ccPvp.k==='selo'?' · Sela o chakra '+nf(s.ccPvp.t)+' s (PvP)':'')+(s.queima?' · Queima '+s.queima+'% do chakra (PvP)':'')+(s.r?' · Área '+nf(s.r/T)+' tiles':''));
 const X=[];if(s.pot&&+s.pot!==1)X.push('Força '+Math.round(s.pot*100)+'%'+(s.t==='nui'?' (3 agulhas)':s.t==='yose'?' (4 puxões)':s.tiros?' ('+s.tiros+' bolas de fogo)':''));if(s.alcance)X.push('Alcance '+s.alcance+' tiles');
 if(s.confusao)X.push('Confunde '+nf(s.confusao)+' s (controles invertidos; passa ao levar dano)');if(s.prec)X.push('Ativado: +'+s.prec+' de precisão, genjutsu −'+(+s.resGen||0)+'% em você, gasta '+(+s.dreno||0)+'% do chakra por segundo (sem recuperar)');
 if(s.empurra)X.push('Empurra '+s.empurra+' tiles');if(s.toques)X.push(s.toques+' golpes que valem '+Math.round((+s.total||1)*100)+'% juntos');if(s.divide)X.push('Força dividida entre os alvos');if(s.imune)X.push('Bloqueia projéteis enquanto gira');if(s.evolui&&JU[clan][s.evolui])X.push('Evolução de '+JU[clan][s.evolui].n);if(s.mgk)X.push('Só com a Mangekyō ativada');if(s.costas)X.push('Não pega quem está de costas para você');if(s.lento)X.push('Deixa lento '+s.lento.v+'% por '+nf(s.lento.t)+' s');if(s.silencio)X.push('Silencia '+nf(s.silencio)+' s');
 if(s.dot&&s.dot.n)X.push('Mais '+s.dot.n+(s.t==='kubi'?' apertos':' queimas')+' ('+Math.round((+s.dot.pot||0)*100)+'% cada'+(s.t==='kubi'?'':', 1 por segundo')+')');if(s.puxa)X.push('Puxa até '+s.puxa+' tiles');if(s.dur)X.push('Fica '+nf(s.dur)+' s no chão');if(s.red)X.push('Você: −'+s.red+'% de dano recebido');
 if(s.exige==='sombra')X.push('Só em quem está preso na sua sombra');if(s.sombra&&naraInt())X.push('Intelecto Nara: −'+(+naraInt().cdSombra||0)+'% de recarga (já contado)');if(X.length)L.push(X.join(' · '));return L}
function juDraw(){const el=$('#paneJu');if(!el||el.hidden||!clan||!CH)return;const all=jtNodes();if(!juSel||!all.some(n=>n.id===juSel))juSel=(all.find(n=>jtInfo(n).cur)||all[0]).id;
 let h='<p class="pfd">Clã <b>'+CLANS[clan].n+'</b> · Nv '+CH.lv+'. Os jutsus liberam com o nível. Toque num jutsu para ver os detalhes e escolher em que botão ele fica.</p>'+juBarHtml()+'<div class="jgrid"><div class="jtree">';
 for(const B of JT[clan]){h+='<div class="jbr"><div class="jbt">'+B.b+'</div><div class="jrow">'+B.n.map((n,k)=>{const I=jtInfo(n);
   return (k?'<i class="jar">›</i>':'')+'<button class="jn '+I.st+(I.cur?' cur':'')+(juSel===n.id?' sel':'')+'" data-j="'+n.id+'"><span class="ji">'+I.ic+'</span><b>'+I.nm+'</b><small>'+(I.sub?I.sub+' · ':'')+(n.soon?'em breve':I.ok?(I.needEye?I.pk:'✓ Nv '+n.lv):'🔒 Nv '+n.lv)+'</small></button>'}).join('')+'</div></div>'}
 const n=all.find(x=>x.id===juSel),I=jtInfo(n),br=JT[clan].find(B=>B.n.includes(n)),js=n.j&&JU[clan][n.j],tp=js&&js.tipo||null,bk=BAR&&n.j?BAR.indexOf(n.j):-1;
 h+='</div><div class="jdet"><div class="jdh"><span class="ji">'+I.ic+'</span><div><b>'+I.nm+(I.sub?' <span class="z">'+I.sub+'</span>':'')+'</b><small>'+br.b.replace(/\s*\(.*\)/,'')+(js?' · '+(js.papel==='ult'?'ultimate':'jutsu')+(bk>=0?' no botão '+SLN[bk]:' fora da barra'):'')+(tp?' · '+(TPN[tp]||tp):'')+(js&&js.nat?' · '+natNome(js.nat):'')+'</small></div><span class="jst '+I.st+'">'+(n.soon?'Em breve':!I.ok?'🔒 Nv '+n.lv:I.needEye?I.pk[0].toUpperCase()+I.pk.slice(1):'✓ Liberado')+'</span></div>'
  +'<p class="pfd">'+(JTD[n.id]||'')+'</p>'+(()=>{const L=juStats(n);return L.length?ulist(L,'up'):''})()+juBarBtns(n,js,I);
 if(n.id==='mgk'){const can=(CH.lv|0)>=TOM[4].lv;h+='<div class="pft pup">'+(CH.mgk?'Seu Mangekyō':'Escolha o seu Mangekyō')+(can?'':' <span>(libera no Nv '+TOM[4].lv+')</span>')+'</div><div class="pfg">';
  for(const k in EYES){const Y=EYES[k],A=Y.sus,cur=CH.mgk===k,conf=juPick===k;
   h+='<div class="pfo'+(cur?' cur':'')+(can?'':' lock')+'"><div class="pfh"><span class="pfi jey">'+imgIc(SFXIC[k])+'</span><div><b>Mangekyō de '+Y.n+'</b><small>'+Y.d+'</small></div></div>'
    +'<div class="pfq">Susanoo: '+A.dmg+' de dano em área'+(A.hits>1?' ('+A.hits+'×)':'')+(A.stun?', atordoa '+nf(A.stun)+' s':'')+' · '+A.t+' s de pé · escudo de '+(+A.escudo||0)+'% da vida'+(A.dmgb?' · +'+A.dmgb+'% de dano':'')+'</div>'
    +'<button data-eye="'+k+'"'+(can&&!cur?'':' disabled')+(conf?' class="conf"':'')+'>'+(cur?'Atual':!can?'Nv '+TOM[4].lv:conf?'Confirmar troca':'Escolher')+'</button></div>'}
  h+='</div>'+(CH.mgk?'<p class="chnote">Por enquanto dá para trocar aqui; depois a escolha vai ser feita numa missão.</p>':'')}
 if(n.id==='kuchi')h+=ctHtml();
 h+='</div></div><div class="jadm admo">[ADM] Ir para o nível: '+[5,10,15,25,40,60].map(v=>'<button data-lv="'+v+'"'+(CH.lv>=v?' disabled':'')+'>'+v+'</button>').join('')+'</div>'+admClaHtml();
 el.innerHTML=h;admClaBind(el,juDraw);
 el.querySelectorAll('[data-j]').forEach(b=>b.onclick=()=>{juSel=b.dataset.j;juPick=null;juDraw()});
 el.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>juEye(b.dataset.eye));
 el.querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>ctChoose(b.dataset.ct));
 el.querySelectorAll('[data-ctz]').forEach(b=>b.onclick=()=>{if(CH.ct)CH.ct.t=0;chSave();toast('[ADM] Espera da troca de contrato zerada.');juDraw()});
 el.querySelectorAll('[data-bar]').forEach(b=>b.onclick=()=>{const [i,id]=b.dataset.bar.split(':');if(!barSet(+i,id))toast('Não dá para pôr aí: '+(id==='item'?'o item fica no botão 3':'tire esse jutsu do outro botão primeiro')+'.');juDraw()});
 el.querySelectorAll('[data-bs]').forEach(b=>b.onclick=()=>{const id=BAR&&BAR[+b.dataset.bs];const n=id&&id!=='item'&&jtNodes().find(x=>x.j===id&&(!x.tm||x.tm===Math.max(1,eyeLv())));if(n){juSel=n.id;juDraw()}});
 el.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{const v=+b.dataset.lv;let g=0;while(CH.lv<v&&CH.lv<LVMAX&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);juDraw()})}
// barra (4 botões) no topo da aba Jutsus
function juBarHtml(){if(!BAR)return '';const ic=id=>{if(id==='item'){const it=atkItem();return it&&it.icon?imgIc(it.icon):'<span>✋</span>'}const s=JU[clan][id];return s?(s.t==='eye'&&eyeLv()===4&&MGKIC&&!UIJ['mgk_'+CH.mgk]?imgIc(MGKIC):skIcon(s)):'<span>❔</span>'};
 const nm=id=>id==='item'?(atkItem()?atkItem().name:'Item da mão'):(JU[clan][id]&&JU[clan][id].t==='eye'&&eyeLv()===4?'Mangekyō':(JU[clan][id]||{}).n||id);
 return '<div class="jbar"><span class="jbl">Sua barra</span>'+[0,1,3,2].map(i=>'<button class="jbs'+(i===2?' big':'')+'" data-bs="'+i+'"><span class="ji">'+ic(BAR[i])+'</span><small>'+(i===2?'Grande':'Botão '+SLN[i])+'</small><b>'+String(nm(BAR[i])).replace(/[<>&]/g,'')+'</b></button>').join('')+'</div>'}
// botões "pôr no botão…" no detalhe de um jutsu liberado
function juBarBtns(n,js,I){if(!js||!BAR||!I.ok||n.soon)return '';const at=BAR.indexOf(js.id);if(js.papel==='passiva')return '<div class="jbb"><span class="z">Passiva: vale sempre, não ocupa botão.</span></div>';
 if(js.papel==='ult')return '<div class="jbb">'+(at===2?'<span class="z">Está no botão grande.</span>':'<button data-bar="2:'+js.id+'">Usar no botão grande</button>')+'</div>';
 return '<div class="jbb"><span>Pôr no botão:</span>'+[0,1,3].map(i=>'<button data-bar="'+i+':'+js.id+'"'+(at===i?' disabled':'')+'>'+SLN[i]+(i===3?' (no lugar do item)':'')+'</button>').join('')+(BAR[3]!=='item'?'<button data-bar="3:item">Item de volta no 3</button>':'')+'</div>'}
function juEye(k){if(!EYES[k]||(CH.lv|0)<TOM[4].lv||CH.mgk===k)return;if(CH.mgk&&juPick!==k){juPick=k;return juDraw()}
 juPick=null;if(EYE.on)eyeOff();CH.mgk=k;chSave();toast('👁️ Mangekyō de '+EYES[k].n+' escolhida!');onlReg('👁️ Sua Mangekyō: '+EYES[k].n+'.');skBtns();juDraw()}

// ---------- Hyuga de branco: parado (postura do Punho Gentil), andando, correndo e poses de golpe ----------
// poses (folha "hya"): 0 guarda · 1 preparo · 2 estocada da palma · 4 guarda · 5 postura das 64 Palmas · 6 giro · 7 agachado
// 8 concentração · 15/16 golpes com rastro · 18/19 rajada de braços · 20 palmas duplas
// root = o ninja fica parado durante a pose e não usa outro golpe (Kaiten e 64 Palmas, como no anime)
// para = o ninja só para de andar durante a pose (selo do Katon e Palma): andando, ele para, faz a pose e volta a correr; os outros golpes continuam livres
const ACTS={fogo:{k:'uca',d:.4,s:[[8,.16],[12,.24]]},palma:{d:.3,s:[[1,.06],[2,.14],[0,.1]]},
 kaiten:{d:1,root:1,s:[[8,.1],[7,.1],['spin',.65],[4,.15]]},
 hakke:{d:1.06,root:1.06,s:[[5,.18],[15,.08],[16,.08],['flurry',.52],[20,.2]]}};
{const U=JU.uchiha.katon,H=JU.hyuga;const tf=U.tel||.16,tp=H.palma.tel||.06,th=Math.max(0,(H.hakke.tel||.26)-.26);
 ACTS.fogo.s[0][1]=tf;ACTS.fogo.d=tf+.24;ACTS.palma.s[0][1]=tp;ACTS.palma.d=tp+.24;ACTS.hakke.s[0][1]+=th;ACTS.hakke.d+=th;ACTS.hakke.root+=th;
 ACTS.fogo.para=ACTS.fogo.d;ACTS.palma.para=ACTS.palma.d} /* Katon (selo de mãos) e Palma: o boneco para só durante a pose (antes, andar cortava a pose e ele ficava sem animação) */
ACTS.nsom={k:'nra',d:.55,s:[[6,.55]]};ACTS.nnui={k:'nra',d:.45,s:[[15,.45]]};ACTS.nyose={k:'nra',d:.4,s:[[16,.4]]};ACTS.nkubi={k:'nra',d:.55,s:[[7,.55]]};ACTS.ndom={k:'nra',d:.7,s:[[9,.7]]}; /* poses do Nara (folha "nra") */
let ACT=null,HHAND=null; // HHAND = onde está a mão da frente no quadro que acabou de ser desenhado (Chidori na mão)
const actEl=A=>(performance.now()-A.t0)/1000;
function actStart(a){const D=ACTS[a];if(!D)return;ACT={a,t0:performance.now(),root:D.root||0,para:D.para||0};fx.push({k:'act',a,life:.05,max:.05})}
function actRoot(){return !!(ACT&&ACT.root&&actEl(ACT)<ACT.root)}
function actPara(){return !!(ACT&&ACT.para&&actEl(ACT)<ACT.para)}
const kaitenGuard=()=>!!(ACT&&ACT.a==='kaiten'&&actEl(ACT)<BAL.golpes.kaitenBloqueio); // girando: bloqueia os golpes recebidos
function actFrame(A){const D=A&&ACTS[A.a];if(!D)return null;const t=actEl(A);if(t>=D.d)return null;let acc=0;
 for(const [f,dt] of D.s){if(t<acc+dt){const lt=t-acc;if(f==='spin')return{i:6,flip:(lt/.07|0)%2};if(f==='flurry')return{i:(lt/.065|0)%2?19:18,flip:0};return{i:f,flip:0}}acc+=dt}return null}
{const _dh=drawHero;drawHero=function(c,x,y,o){
 const HS=o.set||HERO,cl=o.clan!==undefined?o.clan:(o.set?null:clan),A=o.act!==undefined?o.act:(o.set?null:ACT);
 let key=null,fr=0,flip=0;
 if(cl==='nara'&&HS&&HS.nra&&!(o.th>=0)){ /* Nara: boneco próprio (parado, correndo e poses das sombras) */
  const rr=A&&String(A.a)[0]==='n'&&!o.mv?actFrame(A):null,RUN=[0,2,4,2];let f,sy=1;
  if(rr)f=rr.i;else if(o.mv)f=RUN[(o.t/100|0)%4];else{f=0;sy=1+.014*Math.sin(o.t/380)} /* parado: um só quadro (o rosto não muda) com respiração leve */
  const im=HS.nra[f],an=SPR.nrx.nra[f],sc=SPR.sc,bob=o.mv?((o.t/95|0)%2?-1:0):0;HHAND=[(o.fl?-1:1)*30*sc,-70*sc/2+bob];
  c.save();c.translate(x,y);c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(0,0,10,4,0,0,7);c.fill();
  if(o.fl)c.scale(-1,1);c.drawImage(im,-an[0]*sc,-an[1]*sc*sy+bob,im.width*sc,im.height*sc*sy);c.restore();return}
 if(HS&&A&&(A.root||A.para||!o.mv)){const r=actFrame(A),k=(ACTS[A.a]||{}).k||'hya';if(r&&HS[k]){key=k;fr=r.i;flip=r.flip}}
 if(key===null&&cl==='hyuga'&&HS&&HS.hyw&&!(o.th>=0)){ /* com aura também (o Hyuga não tem pose de aura própria: não troca de boneco) */
  if(o.mv){if(o.run){key='hyr';fr=(o.t/60|0)%HS.hyr.length}else{key='hyw';fr=(o.t/95|0)%HS.hyw.length}}else{key='hya';fr=0}}
 if(key===null){HHAND=null;return _dh(c,x,y,o)}
 const im=HS[key][fr],an=(SPR.hyx[key]||SPR.ucx[key])[fr],sc=SPR.sc,bob=key==='hya'&&fr===0&&!o.mv?Math.round(Math.sin(o.t/420)*.6*2)/2:0,hd=SPR.hyh&&SPR.hyh[key]&&SPR.hyh[key][fr];if(!hd&&!SPR.hyx[key]){HHAND=null}
 HHAND=hd?[(((o.fl?1:0)^flip)?-1:1)*hd[0]*sc,hd[1]*sc+bob]:null;
 c.save();c.translate(x,y);c.fillStyle='rgba(0,0,0,.25)';c.beginPath();c.ellipse(0,0,10,4,0,0,7);c.fill();
 if((o.fl?1:0)^flip)c.scale(-1,1);c.drawImage(im,-an[0]*sc,-an[1]*sc+bob,im.width*sc,im.height*sc);c.restore()}}

// Kagemane: a sombra cresce no chão por "tel" s (todo mundo vê) e prende quem estiver na linha; canal: o Nara fica parado junto
function castLine(s,ax,ay){const tp=HTP,x0=p.x,y0=p.y,t=+s.tel||0,root=+s.root||0;
 fx.push({k:'sline',x:x0,y:y0-4,ax,ay,len:s.len,col:'#120a22',life:t+.6,max:t+.6,tel:t});if(s.canal&&root)PRT=Math.max(PRT,t+root);
 KDEL.push({t,fn:()=>{HTP=tp;HCC=root?{root}:null;let n=0;try{E.concat(PVT()).forEach(e=>{if(e.dead)return;const dx=e.x-x0,dy=e.y-y0,pr=Math.max(0,Math.min(s.len,dx*ax+dy*ay));
   if(Math.hypot(dx-ax*pr,dy-ay*pr)<20+(e.rad||0)*.5){n++;hitE(e,s.dmg,ONL.on?+s.stun||0:Math.max(+s.stun||0,root),0,0);if(root)sombraMarca(e,root)}})}finally{HTP=null;HCC=null}
  if(!n&&s.canal)PRT=0;else if(n)onlReg('🌑 Kagemane prendeu '+n+' alvo'+(n>1?'s':'')+' ('+nf(root)+' s).')}})}
// Kagemane múltiplo: a sombra se espalha em área por "tel" s e prende os "alvos" mais perto (no PvP o tempo é dividido entre os jogadores presos)
function castPoss(s,ax,ay){actStart('nsom');const tp=HTP,t=+s.tel||0,x0=p.x,y0=p.y,root=+s.root||0;
 fx.push({k:'sarea',x:x0,y:y0-4,r:s.r,col:'#120a22',life:t+.6,max:t+.6,tel:t});
 KDEL.push({t,fn:()=>{HTP=tp;try{const all=E.concat(PVT()).filter(e=>!e.dead&&Math.hypot(e.x-x0,e.y-y0)<s.r+(e.rad||0)*.6).sort((a,b)=>Math.hypot(a.x-x0,a.y-y0)-Math.hypot(b.x-x0,b.y-y0)).slice(0,+s.alvos||3);
   const np=all.filter(e=>e.pvp).length;all.forEach(e=>{const r=e.pvp?root/Math.max(1,np):root;HCC=r?{root:r}:null;hitE(e,s.dmg,ONL.on?+s.stun||0:Math.max(+s.stun||0,r),0,0);HCC=null;if(r)sombraMarca(e,r)});
   if(all.length){flash={col:s.col,a:.3};onlReg('🌑 Kagemane múltiplo prendeu '+all.length+' alvo'+(all.length>1?'s':'')+'.')}}finally{HTP=null;HCC=null}}})}
function shadowFxDraw(f){const el=f.max-f.life,g=f.tel>0?Math.min(1,el/f.tel):1,a=Math.min(1,f.life/.3);ctx.save();ctx.globalAlpha=.75*a;ctx.fillStyle=f.col;ctx.strokeStyle=f.col;
 if(f.k==='sline'){const L=f.len*g;ctx.lineCap='round';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+f.ax*L,f.y+f.ay*L);ctx.stroke();
  ctx.globalAlpha=.35*a;ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+f.ax*L,f.y+f.ay*L);ctx.stroke()}
 else{const r=f.r*g;ctx.globalAlpha=.28*a;ctx.beginPath();ctx.ellipse(f.x,f.y,r,r*.55,0,0,7);ctx.fill();ctx.globalAlpha=.7*a;ctx.lineWidth=3;ctx.setLineDash([10,6]);ctx.stroke()}ctx.restore()}
// ---------- Entrega 7b: jutsus novos do Nara (números no balanceamento.json → golpes.jutsus.nara) ----------
// quem está preso na MINHA sombra agora (Kagemane, Possessão, Domínio): o Kubishibari só pega esses
const SOMBRA_PRESOS=new Map();
const ccAlvoId=e=>e.pvp?'p:'+e.pvp:'m:'+(e.sid!=null?e.sid:e.id);
function sombraMarca(e,t){if(e&&t>0)SOMBRA_PRESOS.set(ccAlvoId(e),{e,until:performance.now()+t*1000+300})}
function sombraPresos(){const n=performance.now(),L=[];for(const [k,o] of SOMBRA_PRESOS){if(o.until<n||o.e.dead){SOMBRA_PRESOS.delete(k);continue}if(Math.hypot(o.e.x-p.x,o.e.y-p.y)<7*T)L.push(o.e)}return L}
// acerta com o efeito/força certos e volta tudo ao normal
function hitCom(e,s,mul,cc,st,kx,ky){HCC=cc||null;HMUL=mul||1;try{hitE(e,s.dmg,st||0,kx||0,ky||0)}finally{HCC=null;HMUL=1}}
const alvosEm=(x,y,r)=>E.concat(PVT()).filter(e=>!e.dead&&Math.hypot(e.x-x,e.y-y)<r+(e.rad||0)*.6);
// Kage Nui: 3 agulhas de sombra que perseguem (viram devagar: dá para desviar correndo); cada uma vale 1/3 do golpe e deixa lento
function castNui(s,ax,ay){actStart('nnui');const tp=HTP,t=+s.tel||0;fx.push({k:'sarea',x:p.x,y:p.y-4,r:26,col:'#120a22',life:t+.3,max:t+.3,tel:t});
 KDEL.push({t,fn:()=>{const a0=Math.atan2(ay,ax),n=3,sp=s.sp||290;for(let q=0;q<n;q++){const a=a0+(q-1)*.38;
  P.push({x:p.x+Math.cos(a)*8,y:p.y-14,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,col:s.col,dmg:s.dmg,life:1.4,sh:1,seek:1,hm:(+s.pot||1)/n,tp,cc:s.lento?{lento:s.lento}:null})}}})}
function nuiSeek(b,dt){let best=270,tg=null;for(const e of E.concat(PVT())){if(e.dead)continue;const d=Math.hypot(e.x-b.x,e.y-(e.boss?44:16)-b.y);if(d<best){best=d;tg=e}}if(!tg)return;
 const want=Math.atan2(tg.y-(tg.boss?44:16)-b.y,tg.x-b.x),cur=Math.atan2(b.vy,b.vx);let da=want-cur;while(da>Math.PI)da-=6.2832;while(da<-Math.PI)da+=6.2832;
 const mx=3.2*dt,na=cur+Math.max(-mx,Math.min(mx,da)),sp=Math.hypot(b.vx,b.vy);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp}
function nuiDraw(b){const tr=b.tr||(b.tr=[]);tr.push([b.x,b.y]);if(tr.length>10)tr.shift();ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 ctx.strokeStyle='#120a22';ctx.globalAlpha=.35;ctx.lineWidth=7;ctx.beginPath();tr.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();
 ctx.globalAlpha=.9;ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#2a1747';ctx.beginPath();ctx.arc(b.x,b.y,3.4,0,7);ctx.fill();ctx.restore()}
// Kubishibari: a sombra sobe em quem está preso nela e aperta: silencia e machuca aos poucos
function castKubi(s,ax,ay){actStart('nkubi');const tp=HTP,t=+s.tel||0,L=sombraPresos(),D=s.dot||{};
 L.forEach(e=>fx.push({k:'sline',x:p.x,y:p.y-4,ax:(e.x-p.x)/(Math.hypot(e.x-p.x,e.y-p.y)||1),ay:(e.y-p.y)/(Math.hypot(e.x-p.x,e.y-p.y)||1),len:Math.hypot(e.x-p.x,e.y-p.y),col:'#120a22',life:t+.5,max:t+.5,tel:t}));
 KDEL.push({t,fn:()=>{HTP=tp;try{L.forEach(e=>{if(e.dead)return;hitCom(e,s,+s.pot||1,s.silencio?{silencio:+s.silencio}:null);fx.push({k:'ring',x:e.x,y:e.y-30,r:16,col:'#5b3a8a',life:.4,max:.4})})}finally{HTP=null}
  if(L.length)onlReg('🫳 Kubishibari em '+L.length+' alvo'+(L.length>1?'s':'')+': silenciado'+(L.length>1?'s':'')+' por '+nf(+s.silencio||0)+' s.')}});
 for(let j=1;j<=(D.n|0);j++)KDEL.push({t:t+j*(+D.int||.5),fn:()=>{HTP=tp;try{L.forEach(e=>{if(!e.dead)hitCom(e,s,+D.pot||.1)})}finally{HTP=null}}})}
// Kageyose: a sombra estica em linha, agarra o primeiro inimigo e puxa até você (4 puxões)
function castYose(s,ax,ay){actStart('nyose');const tp=HTP,t=+s.tel||0,x0=p.x,y0=p.y,len=s.len||240;
 fx.push({k:'sline',x:x0,y:y0-4,ax,ay,len,col:'#120a22',life:t+.25,max:t+.25,tel:t});
 KDEL.push({t,fn:()=>{let tg=null,bp=1e9;E.concat(PVT()).forEach(e=>{if(e.dead)return;const dx=e.x-x0,dy=e.y-y0,pr=dx*ax+dy*ay;if(pr<0||pr>len)return;if(Math.hypot(dx-ax*pr,dy-ay*pr)<22+(e.rad||0)*.5&&pr<bp){bp=pr;tg=e}});
  if(!tg)return;const N=4,step=(+s.puxa||3)*T/N;onlReg('🪝 Kageyose puxou '+(tg.nome||'o alvo')+'.');
  for(let j=0;j<N;j++)KDEL.push({t:j*.1,fn:()=>{if(tg.dead)return;const dx=p.x-tg.x,dy=p.y-tg.y,d=Math.hypot(dx,dy)||1,k=Math.max(0,Math.min(step,d-T*.9));HTP=tp;
   try{hitCom(tg,s,(+s.pot||1)/N,null,0,dx/d*k,dy/d*k)}finally{HTP=null}fx.push({k:'sline',x:p.x,y:p.y-4,ax:-dx/d,ay:-dy/d,len:d,col:'#120a22',life:.18,max:.18,tel:0})}})}})}
// Campo de Sombras: a sombra cobre o chão por "dur" s; a cada 1 s quem está dentro fica lento (e leva um arranhão); você recebe menos dano enquanto dura
function castCampo(s,ax,ay){actStart('nsom');const tp=HTP,t=+s.tel||0,x0=p.x,y0=p.y,dur=+s.dur||6,r=s.r||3.5*T;
 fx.push({k:'sarea',x:x0,y:y0-4,r,col:'#120a22',life:t+dur,max:t+dur,tel:t});
 KDEL.push({t,fn:()=>{if(s.red)bufStart('campo',{red:+s.red,t:dur,nm:'Campo de Sombras: −'+s.red+'% de dano recebido'});onlReg('🌘 Campo de Sombras por '+nf(dur)+' s.')}});
 for(let j=0;j<Math.round(dur);j++)KDEL.push({t:t+j+.05,fn:()=>{HTP=tp;try{alvosEm(x0,y0,r).forEach(e=>hitCom(e,s,+s.pot||.05,s.lento?{lento:s.lento}:null))}finally{HTP=null}}})}
// Domínio das Sombras (ultimate): a sombra toma a área toda e prende + silencia todo mundo dentro
function castDominio(s,ax,ay){actStart('ndom');const tp=HTP,t=+s.tel||0,x0=p.x,y0=p.y,r=s.r||3.5*T,root=+s.root||0;
 fx.push({k:'sarea',x:x0,y:y0-4,r,col:'#120a22',life:t+.9,max:t+.9,tel:t});
 KDEL.push({t,fn:()=>{HTP=tp;let L=[];try{L=alvosEm(x0,y0,r);L.forEach(e=>{hitCom(e,s,+s.pot||1,{root,silencio:+s.silencio||0},ONL.on?0:root);sombraMarca(e,root)})}finally{HTP=null}
  flash={col:s.col,a:.35};shk=Math.max(shk,.3);if(L.length)onlReg('🌑 Domínio das Sombras: '+L.length+' alvo'+(L.length>1?'s':'')+' preso'+(L.length>1?'s':'')+' e silenciado'+(L.length>1?'s':'')+'.')}})}
const JCAST={nui:castNui,kubi:castKubi,yose:castYose,campo:castCampo,dominio:castDominio};
// ---------- Entrega 7c: jutsus novos do Uchiha (números no balanceamento.json → golpes.jutsus.uchiha) ----------
const alvoPerto=alc=>{let best=alc*T,tg=null;E.concat(PVT()).forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;tg=e}});return tg};
const JALVO={genj:1,amat:1,tsuku:1}; // precisam de alguém no alcance (sem alvo não gasta nada)
// bola de fogo que explode em área (Gōkakyū forte): acerta quem estiver no raio da explosão
function projArea(b,e0){let n=0;E.concat(PVT()).forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-b.x,e.y-(e.boss?44:16)-b.y);if(e!==e0&&d>=b.area+(e.rad||0)*.6)return;n++;const u=d||1;hitE(e,b.dmg,0,(e.x-b.x)/u*8,(e.y-b.y)/u*8)});return n}
// Gōkakyū forte: a bola grande e mais lenta
function castGoka(s,ax,ay){actStart('fogo');const tp=HTP;
 KDEL.push({t:s.tel||.3,fn:()=>{const l=Math.hypot(ax,ay)||1,ux=ax/l,uy=ay/l,sp=s.sp||250;P.push({x:p.x+ux*14,y:p.y-24,vx:ux*sp,vy:uy*sp,col:s.col,dmg:s.dmg,life:1.3,big:1,big2:1,fire:1,area:s.r||45,hm:+s.pot||1,tp})}})}
// Hōsenka: bolinhas de fogo em leque; cada uma vale um pedaço do golpe
function castHosenka(s,ax,ay){actStart('fogo');const tp=HTP,n=Math.max(1,(s.tiros|0)||5);
 KDEL.push({t:s.tel||.3,fn:()=>{const a0=Math.atan2(ay,ax);for(let q=0;q<n;q++){const a=a0+(q-(n-1)/2)*.08+(Math.random()-.5)*.05,sp=(s.sp||330)*(.9+Math.random()*.2);
  P.push({x:p.x+Math.cos(a)*12,y:p.y-24,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,col:s.col,dmg:s.dmg,life:.95,big:1,mini:1,fire:1,hm:(+s.pot||1)/n,tp})}}})}
// Gōryūka: o chão avisa onde o dragão vai cair (todo mundo vê); depois explode em área
function castGoryu(s,ax,ay){actStart('fogo');const tp=HTP,t=+s.tel||.6,tg=alvoPerto(+s.alcance||5),x=tg?tg.x:p.x+ax*3*T,y=tg?tg.y:p.y+ay*3*T,r=s.r||2.2*T;
 fx.push({k:'aviso',x,y,r,col:'#ff5a1a',life:t+.6,max:t+.6,tel:t}); /* o círculo fica mais 0,6 s, sumindo durante a explosão */
 KDEL.push({t,fn:()=>{HTP=tp;try{alvosEm(x,y,r).forEach(e=>{const d=Math.hypot(e.x-x,e.y-y)||1;hitCom(e,s,+s.pot||1,null,0,(e.x-x)/d*14,(e.y-y)/d*14)})}finally{HTP=null}
  fx.push({k:'boom',x,y:y-10,life:.5,max:.5});fx.push({k:'ring',x,y:y-4,r,col:'#ff8a2a',life:.45,max:.45,sp:1});fx.push({k:'chama',x,y,r,life:.9,max:.9});flash={col:'#ff6a1a',a:.25};shk=Math.max(shk,.35)}})}
// Genjutsu: Sharingan: ilusão no alvo mais perto; jogador fica com os controles invertidos, monstro fica perdido (passa ao levar dano)
function castGenj(s,ax,ay){const tp=HTP,t=+s.tel||.4,tg=alvoPerto(+s.alcance||5);p.au=0;p.aud=.6;if(!tg)return;
 fx.push({k:'genj',x:tg.x,y:tg.y,life:t+.6,max:t+.6});
 KDEL.push({t,fn:()=>{if(tg.dead)return;HTP=tp;try{hitCom(tg,s,+s.pot||1,{confusao:+s.confusao||1.5})}finally{HTP=null}onlReg('🌀 Genjutsu em '+(tg.nome||'o alvo')+' ('+nf(+s.confusao||1.5)+' s).')}})}
// Amaterasu (Mangekyō ativada): chamas negras no alvo: golpe + uma queima por segundo
function castAmat(s,ax,ay){const tp=HTP,t=+s.tel||.8,tg=alvoPerto(+s.alcance||6),D=s.dot||{};if(!tg)return;
 fx.push({k:'amat',x:tg.x,y:tg.y,life:t,max:t,pre:1});
 KDEL.push({t,fn:()=>{if(tg.dead)return;HTP=tp;try{hitCom(tg,s,+s.pot||1)}finally{HTP=null}fx.push({k:'amat',x:tg.x,y:tg.y,life:1,max:1});onlReg('🖤 Amaterasu em '+(tg.nome||'o alvo')+'.')}});
 for(let j=1;j<=(D.n|0);j++)KDEL.push({t:t+j*(+D.int||1),fn:()=>{if(tg.dead)return;HTP=tp;try{hitCom(tg,s,+D.pot||.1)}finally{HTP=null}fx.push({k:'amat',x:tg.x,y:tg.y,life:.8,max:.8})}})}
// Tsukuyomi (Mangekyō ativada): o olhar atordoa; quem está de costas para você não é pego
const deFrente=e=>{const dx=p.x-e.x;return Math.abs(dx)<10||(e.fl?-1:1)*dx>0};
function castTsuku(s,ax,ay){const tp=HTP,t=+s.tel||.8,tg=alvoPerto(+s.alcance||5);if(!tg)return;
 fx.push({k:'tsuku',x:tg.x,y:tg.y,life:t+.8,max:t+.8});flash={col:'#c4143c',a:.18};
 KDEL.push({t,fn:()=>{if(tg.dead)return;const ok=!s.costas||deFrente(tg);HTP=tp;try{hitCom(tg,s,+s.pot||1,null,ok?+s.stun||0:0)}finally{HTP=null}
  if(!ok){FT.push({x:tg.x,y:tg.y-62,t:'estava de costas',txt:1,life:1});onlReg('🌕 Tsukuyomi: '+(tg.nome||'o alvo')+' estava de costas e não foi pego.')}
  else{flash={col:'#c4143c',a:.35};onlReg('🌕 Tsukuyomi prendeu '+(tg.nome||'o alvo')+' ('+nf(+s.stun||0)+' s).')}}})}
Object.assign(JCAST,{goka:castGoka,hosenka:castHosenka,goryuka:castGoryu,genj:castGenj,amat:castAmat,tsuku:castTsuku});
// desenho dos efeitos do Uchiha (também chegam para quem está vendo)
function uchFxDraw(f){const k=1-f.life/f.max,a=Math.min(1,f.life/.25),ts=performance.now();ctx.save();
 if(f.k==='aviso'&&runaDraw(f,k,ts)){}
 else if(f.k==='aviso'){ctx.globalAlpha=.25+.35*k;ctx.fillStyle=f.col||'#ff5a1a';ctx.beginPath();ctx.ellipse(f.x,f.y,f.r*k,f.r*k*.55,0,0,7);ctx.fill();ctx.globalAlpha=.85;ctx.strokeStyle=f.col||'#ff5a1a';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.beginPath();ctx.ellipse(f.x,f.y,f.r,f.r*.55,0,0,7);ctx.stroke()}
 else if(f.k==='chama'){ctx.globalCompositeOperation='lighter';for(let i=0;i<14;i++){const an=i*2.4+ts/300,rr=f.r*(.2+.75*((i*37)%10)/10),x=f.x+Math.cos(an)*rr,y=f.y+Math.sin(an)*rr*.55-(1-a)*10,h=10+8*Math.sin(ts/90+i);
  const g=ctx.createRadialGradient(x,y-h/2,0,x,y-h/2,h);g.addColorStop(0,'rgba(255,220,120,'+(.8*a)+')');g.addColorStop(1,'rgba(255,60,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y-h/2,h,0,7);ctx.fill()}}
 else if(f.k==='genj'){ctx.translate(f.x,f.y-34);ctx.globalAlpha=a;ctx.strokeStyle='#c4143c';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<40;i++){const an=i*.35+ts/180,rr=2+i*.45;i?ctx.lineTo(Math.cos(an)*rr,Math.sin(an)*rr*.7):ctx.moveTo(Math.cos(an)*rr,Math.sin(an)*rr*.7)}ctx.stroke();
  ctx.fillStyle='#1a0006';for(let i=0;i<3;i++){const an=ts/250+i*2.094;ctx.beginPath();ctx.arc(Math.cos(an)*14,Math.sin(an)*10,3,0,7);ctx.fill()}}
 else if(f.k==='amat'){const n=f.pre?4:9;for(let i=0;i<n;i++){const x=f.x+Math.sin(i*2.1+ts/140)*10,h=(f.pre?10:22)+Math.sin(ts/70+i*1.7)*6,y=f.y+2;ctx.globalAlpha=a*.9;
  ctx.fillStyle=i%3?'#120008':'#2a0418';ctx.beginPath();ctx.moveTo(x-6,y);ctx.quadraticCurveTo(x-4,y-h*.6,x+Math.sin(ts/60+i)*3,y-h);ctx.quadraticCurveTo(x+5,y-h*.5,x+6,y);ctx.fill();ctx.strokeStyle='rgba(196,20,60,'+(.6*a)+')';ctx.lineWidth=1;ctx.stroke()}}
 else if(f.k==='tsuku'){ctx.translate(f.x,f.y-78);ctx.globalAlpha=a*.9;const r=12+4*k;ctx.fillStyle='#c4143c';ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.fillStyle='#14000a';ctx.beginPath();ctx.arc(r*.35,-r*.15,r*.85,0,7);ctx.fill();
  ctx.globalAlpha=a*.35;ctx.strokeStyle='#c4143c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,78,22+10*k,9+4*k,0,0,7);ctx.stroke()}
 ctx.restore()}
// ---------- Entrega 7d: jutsus novos do Hyuga (números no balanceamento.json → golpes.jutsus.hyuga) ----------
// Byakugan: liga/desliga; ligado dá precisão, gasta um pouco do chakra por segundo e deixa o genjutsu (confusão) mais curto em você
const BYK={on:0,slot:null};
const byakSlot=()=>barSlots().find(k=>CLANS[clan].sk[k]&&CLANS[clan].sk[k].t==='byak');
function byakToggle(i){const s=CLANS[clan].sk[i];if(!s)return;if(BYK.on)return byakOff();if(cd[i]>0||actRoot())return;
 if(PST>0){FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7});return}const mp=mpOf(i,s);if(seloBloqueia(mp))return seloAviso();if(p.mp<mp){FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}
 p.mp-=mp;BYK.on=1;BYK.slot=i;gsMeta();BUFS.byak={prec:+s.prec||0,until:Infinity,nm:'Byakugan: +'+(+s.prec||0)+' de precisão'};stats();bufHud(1);flash={col:'#9db7ff',a:.18}; /* sem pose de aura: o Hyuga continua o mesmo, só os olhos brilham em azul */
 FT.push({x:p.x,y:p.y-80,t:'Byakugan!',txt:1,gold:1,life:1});onlReg('👁️ Byakugan ativado.');skBtns()}
function byakOff(why){if(!BYK.on)return;BYK.on=0;delete BUFS.byak;gsMeta();const k=BYK.slot!=null&&CLANS[clan].sk[BYK.slot]&&CLANS[clan].sk[BYK.slot].t==='byak'?BYK.slot:byakSlot();
 if(k!=null)cd[k]=Math.max(cd[k],cdOf(k,CLANS[clan].sk[k]));stats();bufHud(1);skBtns();if(why){FT.push({x:p.x,y:p.y-70,t:why,txt:1,life:1});onlReg('👁️ Byakugan desativado: '+why+'.')}}
function byakTick(dt){if(!BYK.on)return;const s=JU.hyuga&&JU.hyuga.byak;if(clan!=='hyuga'||!s){byakOff();return}p.mp-=(+s.dreno||0)/100*p.mpMax*dt;if(p.mp<=0){p.mp=0;byakOff('sem chakra')}}
const byakRes=()=>BYK.on&&JU.hyuga&&JU.hyuga.byak?1-(+JU.hyuga.byak.resGen||0)/100:1;
// alvo na linha (o primeiro que a linha encosta)
function alvoNaLinha(x0,y0,ax,ay,len){let tg=null,bp=1e9;E.concat(PVT()).forEach(e=>{if(e.dead)return;const dx=e.x-x0,dy=e.y-y0,pr=dx*ax+dy*ay;if(pr<0||pr>len)return;if(Math.hypot(dx-ax*pr,dy-ay*pr)<22+(e.rad||0)*.5&&pr<bp){bp=pr;tg=e}});return tg}
// Hakke Kūshō: palma de vácuo à distância: acerta o primeiro da linha e empurra (4 empurrões)
function castKusho(s,ax,ay){actStart('palma');const tp=HTP,t=+s.tel||.3,x0=p.x,y0=p.y,len=(+s.alcance||5)*T;
 fx.push({k:'kusho',x:x0,y:y0-16,ax,ay,len,life:t+.3,max:t+.3,tel:t});
 KDEL.push({t,fn:()=>{const tg=alvoNaLinha(x0,y0,ax,ay,len);if(!tg)return;const N=4,step=(+s.empurra||3)*T/N;
  for(let j=0;j<N;j++)KDEL.push({t:j*.08,fn:()=>{if(tg.dead)return;const dx=tg.x-p.x,dy=tg.y-p.y,d=Math.hypot(dx,dy)||1;HTP=tp;try{hitCom(tg,s,(+s.pot||1)/N,null,0,dx/d*step,dy/d*step)}finally{HTP=null}}});
  fx.push({k:'ring',x:tg.x,y:tg.y-16,r:22,col:'#cfe0ff',life:.3,max:.3})}})}
// Hakke Kūshō: Sōjishi: duas palmas de vácuo, para a frente e para trás (cones); quem está dentro leva o golpe, é empurrado e fica lento
function castSojishi(s,ax,ay){actStart('palma');const tp=HTP,t=+s.tel||.5,R=s.r||3*T,h=.7,a0=Math.atan2(ay,ax);
 [a0,a0+Math.PI].forEach(a=>fx.push({k:'cone',x:p.x,y:p.y-18,a,r:R,h,col:'#9db7ff',life:t+.3,max:t+.3}));
 KDEL.push({t,fn:()=>{const x0=p.x,y0=p.y;HTP=tp;try{E.concat(PVT()).forEach(e=>{if(e.dead)return;const dx=e.x-x0,dy=e.y-y0,d=Math.hypot(dx,dy);if(d>R+(e.rad||0)*.6)return;
   let da=Math.atan2(dy,dx)-a0;da=Math.atan2(Math.sin(da),Math.cos(da));if(d>16&&Math.abs(da)>h&&Math.abs(da)<Math.PI-h)return;const u=d||1;hitCom(e,s,+s.pot||1,s.lento?{lento:s.lento}:null,0,dx/u*16,dy/u*16)})}finally{HTP=null}
  flash={col:'#cfe0ff',a:.18}}})}
// Kaiten Perfeito (ultimate): gira maior; bloqueia projéteis enquanto gira e no fim solta o golpe em área (a força é dividida entre os alvos) e sela o chakra
function castKperf(s,ax,ay){actStart('kaiten');const tp=HTP,t=+s.tel||.8,R=s.r||2.5*T;if(s.imune)gsSend({t:'guard',d:Math.max(1,t)});
 const f=KFX_OK?kfxAdd({q:'kaiten',x:p.x,y:p.y,fol:1,dy:6,sc:R*1.4/101}):null;fx.push({k:'aviso',x:p.x,y:p.y,r:R,col:'#9db7ff',life:t+.6,max:t+.6,tel:t});
 KDEL.push({t,fn:()=>{const L=alvosEm(p.x,p.y,R),n=Math.max(1,L.length),mul=(+s.pot||1)/(s.divide?n:1),cc=s.ccPvp&&s.ccPvp.k==='selo'?{selo:+s.ccPvp.t,semStunPvp:1}:null;
  HTP=tp;try{L.forEach(e=>{const d=Math.hypot(e.x-p.x,e.y-p.y)||1;hitCom(e,s,mul,cc,0,(e.x-p.x)/d*22,(e.y-p.y)/d*22)})}finally{HTP=null}
  if(f)f.hit=1;fx.push({k:'ring',x:p.x,y:p.y-10,r:R,col:'#cfe0ff',life:.5,max:.5,sp:1});flash={col:'#e3e9ff',a:.35};shk=Math.max(shk,.35);
  if(L.length)onlReg('🌀 Kaiten Perfeito em '+L.length+' alvo'+(L.length>1?'s':'')+'.')}})}
Object.assign(JCAST,{kusho:castKusho,sojishi:castSojishi,kperf:castKperf});
function hyuFxDraw(f){const k=1-f.life/f.max,a=Math.min(1,f.life/.2);ctx.save();
 if(f.k==='kusho'){const g=f.tel>0?Math.min(1,(f.max-f.life)/f.tel):1,L=f.len*g,x=f.x+f.ax*L,y=f.y+f.ay*L,an=Math.atan2(f.ay,f.ax);ctx.globalAlpha=.55*a;ctx.strokeStyle='#e3efff';ctx.lineWidth=3;
  for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(x-f.ax*i*10,y-f.ay*i*10,10+i*5,an-1,an+1);ctx.stroke()}ctx.globalAlpha=.18*a;ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(x,y);ctx.stroke()}
 ctx.restore()}
// Bola de Fogo (Uchiha): selo com as mãos, depois a bola sai da boca e explode ao acertar
function castFire(s,ax,ay){actStart('fogo');const tp=HTP;
 KDEL.push({t:s.tel||.16,fn:()=>{const l=Math.hypot(ax,ay)||1,ux=ax/l,uy=ay/l;P.push({x:p.x+ux*14,y:p.y-24,vx:ux*(s.sp||300),vy:uy*(s.sp||300),col:s.col,dmg:s.dmg,life:1.1,big:1,fire:1,tp})}})}
// bola de fogo de outro jogador: só visual, mas explode quando encosta em alguém (menos em quem soltou)
function fireRmHit(b){if(b.life>.98)return 0;
 for(const e of E)if(!e.dead&&Math.hypot(e.x-b.x,e.y-(e.boss?44:16)-b.y)<(e.rad||18))return 1;
 if(Math.hypot(p.x-b.x,p.y-24-b.y)<20)return 1;
 for(const id in ONL.peers){if(id===b.pid)continue;const q=ONL.peers[id];if(q.x==null||q.sc!==(scene|0))continue;if(Math.hypot(q.x-b.x,q.y-24-b.y)<20)return 1}return 0}
function fireBoom(b){if(!b.mini)fx.push({k:'boom',x:b.x,y:b.y,life:.4,max:.4,rm:1,_s:1});fx.push({k:'ring',x:b.x,y:b.y+6,r:b.big2?(b.area||45):b.mini?14:26,col:'#ff8a2a',life:.3,max:.3,rm:1,_s:1})}
function fireDraw(b,ts){ctx.save();ctx.globalCompositeOperation='lighter';const l=Math.hypot(b.vx,b.vy)||1,ux=b.vx/l,uy=b.vy/l;
 const sc=b.big2?1.6:b.mini?.55:1;for(let i=5;i>=0;i--){const x=b.x-ux*i*6*sc+Math.sin(ts/40+i)*1.5,y=b.y-uy*i*6*sc+Math.cos(ts/50+i)*1.5,r=Math.max(2,11-i*1.6)*sc;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i?'rgba(255,170,60,.9)':'rgba(255,250,210,1)');g.addColorStop(.5,'rgba(255,110,20,'+(.85-i*.12)+')');g.addColorStop(1,'rgba(200,30,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill()}ctx.restore()}

// ---------- Entrega 11: invocações (Gamabunta, Katsuyu, Manda) — arte em arte/invocacoes, números em balanceamento.json → invocacoes ----------
const IFX=__IFX__,IFIMG=new Image();let IFX_OK=false;IFIMG.onload=()=>{IFX_OK=true};IFIMG.src=IFX.img;
const INVIC=__INVIC__;
let INVA=null,SHT=null,ctPick=null; // INVA = invocação em campo {k, f (efeito), until} · SHT = escudo do sapo
const invAtiva=()=>!!(INVA&&INVA.until>performance.now());
const emPvp=()=>performance.now()-(ONL.pvpT||-1e9)<(+INVB.pvpJanela||8)*1000; // bateu ou apanhou de jogador há pouco: a cura vale a do PvP
const hTxt=ms=>{const m=Math.ceil(ms/60000);return m>=60?Math.floor(m/60)+' h'+(m%60?' '+(m%60)+' min':''):m+' min'};
const ctFalta=()=>{const c=CH&&CH.ct;return c&&c.k&&c.t?Math.max(0,c.t+(+INVB.trocaHoras||0)*3600e3-Date.now()):0};
// quadro "i" da fase "ph" com o ponto do chão em (x,y); fl = olhando para a esquerda (as folhas olham para a direita)
function ifxDraw(ph,i,x,y,fl,al,comp){const F=IFX.f[ph];if(!F||!IFX_OK||al<=0)return;const fr=F[((i|0)%F.length+F.length)%F.length],s=IFX.s[ph]||1,[sx,sy,w,h,gx,gy]=fr;
 ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,al==null?1:al));if(comp)ctx.globalCompositeOperation=comp;ctx.translate(x,y);if(fl)ctx.scale(-1,1);ctx.drawImage(IFIMG,sx,sy,w,h,-gx*s,-gy*s,w*s,h*s);ctx.restore()}
// textos da aba Jutsus
function ctPasTxt(F){const P=F&&F.passiva||{},L=[];for(const k in P){const v=+P[k]||0;L.push(k==='hp'?'+'+v+'% de vida máxima':k==='cura'?'+'+v+'% de cura recebida (regeneração e Katsuyu)':k==='dot'?'+'+v+'% de dano contínuo (queimadura, veneno, Amaterasu, Kubishibari)':k==='gen'?'+'+v+'% de eficácia de genjutsu':k==='spd'?'+'+v+'% de velocidade':k==='prec'?'+'+v+'% de precisão':k==='ccPve'?'+'+v+'% de duração de controle em monstros':k+' +'+v)}return L.join(', ')||'—'}
function ctAtvTxt(k,F){if(k==='sapo')return 'Gamabunta surge ao seu lado e segura '+F.escudo+'% da sua vida em golpes por '+F.dur+' s (somando com o escudo do Susanoo, no máximo '+(+INVB.escudoMaxPct||100)+'%)';
 if(k==='lesma')return 'Katsuyu chega e cura '+F.cura+'% da sua vida em '+F.dur+' s (no PvP, '+nf(F.cura*(+INVB.curaPvp||1))+'%)';
 if(k==='cobra'){const D=F.dot||{};return 'Manda aparece no alvo a até '+F.alcance+' tiles: o selo avisa '+nf(+F.tel||0)+' s antes (quem sai dele escapa), ela morde e envenena — no PvP '+F.venenoPvp+'% da vida em '+F.dur+' s; em monstro, mais '+(D.n|0)+' toques de veneno'}
 return F.desc||''}
function ctStats(k){const F=ctFam(),s=JU[clan]&&JU[clan].kuchi,L=[];if(!s)return L;if(!F){L.push('Escolha uma família abaixo'+((CH.lv|0)<ctLv()?' (libera no Nv '+ctLv()+')':'')+'.');return L}
 L.push('Contrato: '+F.n+'. Passiva (vale sempre): '+ctPasTxt(F)+'.');
 L.push('Invocar '+F.inv+': chakra '+mpOf(k,s)+' · recarga '+nf(cdOf(k,s))+' s · '+ctAtvTxt(CH.ct.k,F)+'.');
 L.push('Só uma invocação em campo. Conta como Ninjutsu.');return L}
function ctHtml(){if(!INV_ON)return '';const can=(CH.lv|0)>=ctLv(),cur=CH.ct&&CH.ct.k,falta=cur?ctFalta():0,TH=+INVB.trocaHoras||0;
 let h='<div class="pft pup">'+(cur?'Seu contrato':'Escolha o seu contrato')+(can?'':' <span>(libera no Nv '+ctLv()+')</span>')+'</div><div class="pfg">';
 for(const k in INVF){if(k[0]==='_')continue;const F=INVF[k],at=!!F.ativo,isc=cur===k,conf=ctPick===k;
  h+='<div class="pfo'+(isc?' cur':'')+(can&&at?'':' lock')+'"><div class="pfh"><span class="pfi jey">'+(INVIC[k]?imgIc(INVIC[k]):'<span>📜</span>')+'</span><div><b>'+esc(F.n)+(F.inv?' <span class="z">· '+esc(F.inv)+'</span>':'')+'</b><small>'+esc(F.funcao||'')+'</small></div></div>'
   +'<div class="pfq">Passiva: '+ctPasTxt(F)+'</div><div class="pfq">'+(at?'Invocação: '+ctAtvTxt(k,F)+'.':'Em breve: '+esc(F.desc||'falta a arte')+'.')+'</div>'
   +'<button data-ct="'+k+'"'+(can&&at&&!isc?'':' disabled')+(conf?' class="conf"':'')+'>'+(isc?'Atual':!at?'Em breve':!can?'Nv '+ctLv():conf?'Confirmar troca':'Escolher')+'</button></div>'}
 h+='</div><p class="chnote">'+(cur?(falta>0?'Dá para trocar de contrato de novo em '+hTxt(falta)+'.':'Trocar de contrato: a invocação entra em recarga e a próxima troca só depois de '+TH+' h.'):'A primeira escolha é livre; depois, cada troca pede '+TH+' h até a próxima.')+'</p>'
 if(cur&&falta>0)h+='<div class="jadm admo">[ADM] <button data-ctz="1">Zerar a espera</button></div>';return h}
function ctChoose(k){const F=INVF[k];if(!INV_ON||!F||!F.ativo||(CH.lv|0)<ctLv())return;const cur=CH.ct&&CH.ct.k;if(cur===k)return;
 const falta=ctFalta();if(cur&&falta>0){toast('📜 Você trocou de contrato há pouco: dá para trocar de novo em '+hTxt(falta)+'.');return}
 if(cur&&ctPick!==k){ctPick=k;return juDraw()} // trocar pede confirmação
 ctPick=null;invEnd();CH.ct={k,t:Date.now()};ctApply();
 if(cur){const s=JU[clan].kuchi,t=performance.now(),bi=BAR?BAR.indexOf('kuchi'):-1,c=cdOf(bi>=0?bi:1,s);JCD.kuchi=Math.max(JCD.kuchi||0,t+c*1000);if(bi>=0)cd[bi]=Math.max(cd[bi],c)}
 chSave();stats();skBtns();toast('📜 Contrato com os '+F.n+'!');
 onlReg('📜 Contrato com os '+F.n+' firmado: '+ctPasTxt(F)+'.');juDraw()}
// efeito que todo mundo vê (vai para os outros jogadores pelo "fx")
function invFx(o){const f=Object.assign({k:'inv',max:o.life},o);fx.push(f);return f}
const INVS={sapo:.4,lesma:.9,cobra:.5}; // saída: a invocação some fazendo a animação (s)
const INVOFF={sapo:34,lesma:44}; // atrás do ninja (px)
function invEnd(why){if(!INVA)return;const f=INVA.f;INVA=null;SHT=null;if(f)f.fim=1;if(BUFS.inv){delete BUFS.inv;bufHud(1)}
 if(f&&f.life>(INVS[f.f]||.3)){f.life=INVS[f.f]||.3;fx.push({k:'invx',life:.25,max:.25})}
 if(why){FT.push({x:p.x,y:p.y-84,t:why,txt:1,life:1});onlReg('📜 '+why+'.')}}
function invTick(){if(INVA&&INVA.until<=performance.now()){INVA=null;SHT=null}}
{const _k=kfxStep;kfxStep=function(dt){_k(dt);invTick()}}
// escudo do sapo: segura o golpe antes do Susanoo; Gamabunta defende com o sabre
function sapoAbsorb(n){if(!SHT||SHT.until<=performance.now()||SHT.v<=0||!(n>0))return n;const a=Math.min(n,SHT.v);SHT.v-=a;
 if(a>0){FT.push({x:p.x-16,y:p.y-64,t:'🛡'+Math.round(a),txt:1,life:.7});if(INVA&&INVA.f)INVA.f.pa=performance.now()}
 if(SHT.v<=0){SHT=null;setTimeout(()=>invEnd('o escudo do Gamabunta quebrou'),0)}bufHud(1);return n-a}
function castKuchi(s,ax,ay){const k=s.fam,F=INVF[k];if(!F)return;if(k==='sapo')invSapo(F);else if(k==='lesma')invLesma(F);else if(k==='cobra')invCobra(F,s)}
function invSapo(F){const dur=+F.dur||8,n=performance.now();
 const cap=(+INVB.escudoMaxPct||100)/100*p.max,usado=SHD&&SHD.until>n?SHD.v:0,v=Math.max(0,Math.min(Math.round((+F.escudo||0)/100*p.max),Math.round(cap-usado)));
 INVA={k:'sapo',until:n+dur*1000,f:invFx({f:'sapo',life:dur+INVS.sapo})};SHT={v,max:v,until:n+dur*1000};
 bufStart('inv',{t:dur,nm:'Gamabunta: escudo de '+v+' ('+(+F.escudo||0)+'% da vida)'+(v<Math.round((+F.escudo||0)/100*p.max)?' — limitado com o Susanoo':'')});shk=Math.max(shk,.25)}
function invLesma(F){const dur=+F.dur||6,N=Math.max(1,Math.round(dur)),n=performance.now(),ent=.8,f=invFx({f:'lesma',life:ent+dur+INVS.lesma});
 INVA={k:'lesma',until:n+(ent+dur)*1000,f};bufStart('inv',{t:ent+dur,nm:'Katsuyu: cura '+(+F.cura||0)+'% da vida em '+dur+' s'});
 for(let j=1;j<=N;j++)KDEL.push({t:ent+j*dur/N,fn:()=>{if(f.fim||p.hp<=0)return;/* acabou antes (derrotado, trocou de mapa) */const pv=emPvp(),v=p.max*(+F.cura||0)/100/N*curaMul()*(pv?+INVB.curaPvp||1:1);
  const a=Math.min(v,p.max-p.hp);p.hp=Math.min(p.max,p.hp+v);if(a>=.5)FT.push({x:p.x+12,y:p.y-60,t:'+'+Math.round(a),txt:1,col:'#7dffb0',life:.9});gsPos(true)}})}
function invCobra(F,s){const tg=alvoPerto(+F.alcance||5);if(!tg)return;const tel=+F.tel||.6,tp=HTP,X=tg.x,Y=tg.y,d=Math.hypot(X-p.x,Y-p.y)||1,dir=X<p.x?-1:1;
 const f=invFx({f:'cobra',x:Math.round(X-dir*30),y:Math.round(Y+2),tx:Math.round(X),ty:Math.round(Y),fl:dir<0?1:0,tel,life:tel+.72+INVS.cobra});
 INVA={k:'cobra',until:performance.now()+(tel+.72)*1000,f};p.au=0;p.aud=.5;
 // jogador escapa saindo do selo (1 tile); monstro não desvia: a Manda alcança até 2 tiles (o alvo escolhido primeiro)
 KDEL.push({t:tel+.16,fn:()=>{const Rr=e=>(e.pvp?T*.95:T*2)+(e.rad||0)*.6,dd=e=>Math.hypot(e.x-X,e.y-Y);let best=!tg.dead&&dd(tg)<Rr(tg)?tg:null,bd=1e9;
  if(!best)E.concat(PVT()).forEach(e=>{if(e.dead)return;const q=dd(e);if(q<Rr(e)&&q<bd){bd=q;best=e}});if(best){f.tx=Math.round(best.x);f.ty=Math.round(best.y)}
  if(!best){FT.push({x:X,y:Y-40,t:'escapou',txt:1,life:.9});onlReg('🐍 A Manda errou: o alvo saiu do selo.');return}
  HTP=tp;try{hitCom(best,s,+s.pot||1,best.pvp?{veneno:1}:null)}finally{HTP=null}shk=Math.max(shk,.2);
  onlReg('🐍 Manda mordeu '+(best.nome||'o alvo')+(best.pvp?' e envenenou ('+F.venenoPvp+'% da vida em '+F.dur+' s).':'.'));
  if(!best.pvp){const D=F.dot||{};for(let j=1;j<=(D.n|0);j++)KDEL.push({t:j*(+D.int||1),fn:()=>{if(best.dead)return;HTP=tp;try{hitCom(best,s,(+D.pot||.1)*dotMul())}finally{HTP=null}fx.push({k:'ring',x:best.x,y:best.y-20,r:10,col:'#9a5cff',life:.35,max:.35})}})}}})}
JCAST.kuchi=castKuchi;
// desenho: a invocação acompanha o dono (o seu ninja ou o de outro jogador) e fica atrás dele
function invDono(f){if(!f.pid)return p;const o=ONL.peers[f.pid];return o&&o.x!=null&&o.sc===(scene|0)?o:null}
function invSegue(f,o){const n=performance.now(),dt=Math.min(.1,(n-(f._lt||n))/1000);f._lt=n;const dir=o.fl?-1:1,tx=o.x-dir*(INVOFF[f.f]||36),ty=o.y-3;
 if(f.cx==null||Math.hypot(tx-f.cx,ty-f.cy)>260){f.cx=tx;f.cy=ty;f.dir=o.fl?1:0;f.mv=0;return}
 const k=Math.min(1,dt*6),nx=f.cx+(tx-f.cx)*k,ny=f.cy+(ty-f.cy)*k,sp=dt>0?Math.hypot(nx-f.cx,ny-f.cy)/dt:0;
 if(sp>14&&Math.abs(nx-f.cx)>.2)f.dir=nx<f.cx?1:0;else if(sp<8)f.dir=o.fl?1:0;f.mv=sp>14;f.cx=nx;f.cy=ny}
function invDraw(f,ts){const t=f.max-f.life,S=INVS[f.f]||.4,out=f.life<S,ko=out?S-f.life:0;
 if(f.f==='sapo'){const x=f.cx,y=f.cy,fl=f.dir;
  if(t<.3)ifxDraw('sp_fum',Math.min(4,t/.06),x,y+4,fl);
  else if(t<.46)ifxDraw('sp_rev',0,x,y+8,fl);
  else if(!out||ko<.12){if(t<.62)ifxDraw('sp_po',(t-.46)/.08,x-(fl?-16:16),y+2,fl,1-(t-.46)/.16);
   const pa=f.pa&&ts-f.pa<240?(ts-f.pa)/80|0:-1;if(pa>=0)ifxDraw('sp_atk',3+Math.min(2,pa),x,y,fl);else if(f.mv)ifxDraw('sp_run',ts/75,x,y,fl);else ifxDraw('sp_run',0,x,y+Math.round(Math.sin(ts/380)),fl)}
  if(out)ifxDraw('sp_fum',2+Math.min(2,ko/.1),x,y+4,fl,1-ko/S)}
 else if(f.f==='lesma'){const x=f.cx,y=f.cy,fl=f.dir;
  if(t<.4)ifxDraw('ls_fum',t/.08,x,y,fl);else if(t<.8)ifxDraw('ls_che',(t-.4)/.08,x,y,fl);
  else if(!out)ifxDraw(f.mv?'ls_mov':'ls_aur',f.mv?ts/100:ts/120,x,y,fl);else ifxDraw('ls_sai',Math.min(9,ko/.09),x,y,fl)}
 else if(f.f==='cobra'){const tel=+f.tel||.6,x=f.x,y=f.y,fl=f.fl;
  if(t<tel){if(t>tel-.42)ifxDraw('cb_fum',Math.min(3,(t-(tel-.42))/.1),x,y,fl,.9)}
  else if(t<tel+.42)ifxDraw('cb_atk',1+Math.min(4,(t-tel)/.08),x,y,fl);
  else if(!out)ifxDraw('cb_atk',6,x,y,fl);
  else{if(ko<.15)ifxDraw('cb_atk',6,x,y,fl,1-ko/.15);ifxDraw('cb_fum',4+Math.min(2,ko/.15),x,y,fl,1-ko/S*.6)}
  if(t>tel+.14&&t<tel+.36)ifxDraw('cb_mor',(t-tel-.14)/.11,f.tx,f.ty-18,fl)}}
// chão: campo de cura da Katsuyu em volta do dono · selo da Manda embaixo do alvo (o aviso)
function invChao(f,o,ts){const t=f.max-f.life;
 if(f.f==='lesma'&&o&&t>.6&&f.life>INVS.lesma*.5)ifxDraw('ls_cmp',ts/150,o.x,o.y+4,0,Math.min(.6,(t-.6)*2,f.life));
 if(f.f==='cobra'){const tel=+f.tel||.6;if(t>tel+.3)return;const k=Math.min(1,t/tel),R=T*.95;ctx.save();ctx.globalAlpha=t>tel?Math.max(0,1-(t-tel)/.3):.35+.5*k;
  ctx.strokeStyle='#b07cff';ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();ctx.ellipse(f.tx,f.ty,R,R*.55,0,0,7);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(126,60,210,'+(.12+.22*k)+')';ctx.beginPath();ctx.ellipse(f.tx,f.ty,R*k,R*k*.55,0,0,7);ctx.fill();
  ctx.strokeStyle='rgba(210,170,255,.8)';ctx.lineWidth=1.5;ctx.beginPath();for(let i=0;i<6;i++){const a=i*1.047+ts/900,r2=R*.62;ctx.lineTo(f.tx+Math.cos(a)*r2,f.ty+Math.sin(a)*r2*.55)}ctx.closePath();ctx.stroke();ctx.restore()}}
function invL(L){if(scene|0)return;const ts=performance.now();
 for(const f of fx){if(f.k==='invx'){if(!f._d){f._d=1;for(const g of fx)if(g.k==='inv'&&g.pid===f.pid&&g.life>(INVS[g.f]||.3))g.life=INVS[g.f]||.3}continue}
  if(f.k!=='inv')continue;const o=invDono(f);if(!o){if(f.pid)f.life=0;continue}
  if(f.f!=='cobra')invSegue(f,o);
  if(f.f==='lesma')L.push({y:o.y-40,d:()=>invChao(f,o,ts)});else if(f.f==='cobra')L.push({y:(f.ty||f.y)-40,d:()=>invChao(f,o,ts)});
  L.push({y:f.f==='cobra'?f.y:f.cy,d:()=>invDraw(f,ts)})}}
{const _s=susL;susL=function(L){_s(L);invL(L)}}
// golpe recebido: veneno da cobra (PvP) · bater ou apanhar de jogador conta como PvP para a cura · derrotado: a invocação some
{const g=gsMsg;gsMsg=function(m){if(m&&m.t==='hurt'&&m.by){ONL.pvpT=performance.now();if(m.vn&&!(scene|0)){FT.push({x:p.x+12,y:p.y-46,t:'☠️',txt:1,life:.6});if(!gsMsg._vn||performance.now()-gsMsg._vn>8000){gsMsg._vn=performance.now();onlReg('🐍 '+(m.src||'?').replace(/ \(veneno\)$/,'')+' envenenou você (Manda).')}}}
 const r=g(m);if(m&&m.t==='hurt'&&HRES&&HRES.dead)invEnd();return r}}
{const _sw=switchMap;switchMap=function(k){invEnd();return _sw(k)}}

// ---------- botão do item da mão (Chidori, Rasengan…): vazio se o item não dá habilidade ----------
function itemBtn(){const b=$('#b3');if(!b||(clan&&CLANS[clan].sk[3]))return;const it=atkItem();b.classList.toggle('empty',!it);
 b.innerHTML=it?(it.icon?'<img src="'+it.icon+'" style="image-rendering:auto">':'<span>⚡</span>')+String(it.name).replace(/[<>&"]/g,'')+'<div class="cd"></div>':'<span class="ph">✋</span>Item<div class="cd"></div>'}
function itemBtnTick(){const b=$('#b3'),it=atkItem();if(!b||(clan&&CLANS[clan].sk[3]))return;if(!!it===b.classList.contains('empty'))itemBtn();const c=b.querySelector('.cd');if(!it){if(c)c.style.height='0';return}
 if(c)c.style.height=Math.min(100,cd[3]/Math.max(.01,cdOf(3))*100)+'%';b.classList.toggle('off',p.mp<mpOf(3))}
function castItem(){const it=atkItem();if(!it){toast('Equipe um item que dá habilidade (como o Chidori) para usar este botão.');return}
 if(actRoot()||cd[3]>0)return;if(PST>0){FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7});return}if(PSI>0)return silAviso();
 if(seloBloqueia(mpOf(3)))return seloAviso();if(p.mp<mpOf(3)){FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}
 cd[3]=cdOf(3);p.mp-=mpOf(3);let ax=p.ax,ay=p.ay,best=300,tg=null;
 E.concat(PVT()).forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;tg=e}});
 if(tg){const d=best||1;ax=(tg.x-p.x)/d;ay=(tg.y-p.y)/d;p.ax=ax;p.ay=ay}
 HTP='@ninjutsu#item';try{castAtk(ax,ay)}finally{HTP=null}}

// golpes em área: os Hyuga usam a folha; os outros continuam com o círculo
let KDEL=[];
// o que um efeito agenda de dentro de outro (ex.: os puxões do Kageyose) entra na fila nova e não se perde
function kfxStep(dt){bufTick();eyeTick(dt);byakTick(dt);ccTick(dt);if(!KDEL.length)return;const cur=KDEL;KDEL=[];const keep=cur.filter(d=>{if((d.t-=dt)>0)return true;try{d.fn()}catch(e){console.error(e)}return false});KDEL=keep.concat(KDEL)}
function castAoe(s,ax,ay){
 const hitAll=(cx,cy,radial,onHit)=>{let n=0;E.concat(PVT()).forEach(e=>{if(e.dead||Math.hypot(e.x-cx,e.y-cy)>=s.r+(e.rad||0)*.6)return;n++;
   let kx=ax*(s.kb||0),ky=ay*(s.kb||0);if(radial){const d=Math.hypot(e.x-cx,e.y-cy)||1;kx=(e.x-cx)/d*(s.kb||0);ky=(e.y-cy)/d*(s.kb||0)}
   hitE(e,s.dmg,s.stun,kx,ky);if(onHit)onHit(e)});return n};
 const q=s.kq&&KFX_OK?s.kq:null;
 if(q==='kaiten'){ // gira no lugar: a esfera acompanha o ninja e empurra todo mundo para fora quando se forma
  actStart('kaiten');gsSend({t:'guard',d:BAL.golpes.kaitenBloqueio});const f=kfxAdd({q,x:p.x,y:p.y,fol:1,dy:6,sc:s.r*1.4/101});const tp=HTP;
  KDEL.push({t:.33,fn:()=>{HTP=tp;try{if(hitAll(p.x,p.y-10,true))f.hit=1}finally{HTP=null}}});return}
 const cx=p.x+ax*(s.off||0),cy=p.y+ay*(s.off||0);
 const later=(t,fn,cc)=>{const tp=HTP;KDEL.push({t,fn:()=>{HTP=tp;HCC=cc||null;try{fn()}finally{HTP=null;HCC=null}}})};
 if(s.alvos)return castPoss(s,ax,ay);
 if(q==='palma'){actStart('palma');later(s.tel||.06,()=>{const x=p.x+ax*(s.off||0),y=p.y+ay*(s.off||0);kfxAdd({q,x,y:y-6,sc:s.r*1.8/87});hitAll(x,y,false)},s.queima?{queima:+s.queima}:null);return}
 if(q==='hakke'){ // Oito Trigramas 64 Palmas: quem estiver a 1 tile do Hyuga fica preso na sequência de golpes,
  // toma dano contínuo e é empurrado até a animação acabar (uns 2 tiles no total), atordoado
  actStart('hakke');kfxAdd({q,x:p.x,y:p.y,sc:1.3,al:.95});
  const d0=Math.max(0,(s.tel||.26)-.26),caught=new Set(),N=Math.max(2,(s.toques|0)||9),TK=[...Array(N)].map((_,j)=>.26+j*.72/(N-1)+d0),PUSH=2*T/N,TOT=+s.total||BAL.golpes.hakkeTotal;
  TK.forEach((t,j)=>later(t,()=>{HMUL=TOT/N; // os toques juntos valem TOT golpes (64 Palmas: 9 toques = hakkeTotal 1,4; 128 Palmas: 12 toques)
   try{E.concat(PVT()).forEach(e=>{if(e.dead)return;const id=e.pvp||e.sid||e.id,d=Math.hypot(e.x-p.x,e.y-p.y);
    if(!caught.has(id)){if(d>=T+(e.rad||0)*.6)return;caught.add(id);kfxAdd({q:'icon',i:[0,4,5][Math.random()*3|0],x:e.x,y:e.y-(e.boss?70:30),sc:.55,d:.7})}
    const u=d||1;hitE(e,s.dmg,s.stun,(e.x-p.x)/u*PUSH,(e.y-p.y)/u*PUSH);
    if(j%2)kfxAdd({q:'icon',i:Math.random()<.5?3:7,x:e.x+(Math.random()*20-10),y:e.y-(e.boss?60:24),sc:.45,d:.3})})}finally{HMUL=1}
   if(j===0||j===N-1)flash={col:s.col,a:j?.3:.15}},s.ccPvp&&s.ccPvp.k==='selo'?{selo:+s.ccPvp.t,semStunPvp:1}:null));return}
 fx.push({k:'ring',x:cx,y:cy-8,r:s.r,col:s.col,life:.45,max:.45,sp:s.fx});hitAll(cx,cy,false);if(s.fx)flash={col:s.col,a:.3}}

// ---------- Atualização automática (sem reinstalar o APK) ----------
// O APK abre um carregador pequeno que roda a versão mais nova guardada no celular (ou a que veio no APK).
// Aqui o jogo procura versão nova no GitHub, baixa em segundo plano, confere a assinatura (SHA-256) e guarda.
// Se uma versão nova não conseguir abrir 2 vezes seguidas, o carregador volta sozinho para a do APK.
const OTA={v:+'__GAME_VER__'||0,base:'__OTA_BASE__',api:'__OTA_API__',loader:1,app:false,busy:0,ready:0,told:0,gate:0};
try{OTA.app=!!localStorage.getItem('so-ota-loader');OTA.loader=+localStorage.getItem('so-ota-loader')||1}catch(_){}
function otaVerTxt(v){const m=String(v).match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)$/);if(!m)return String(v||'teste');const d=new Date(Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5]));return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function otaDb(){return new Promise((res,rej)=>{const r=indexedDB.open('shinobi-ota',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function otaPut(o){const db=await otaDb();await new Promise((res,rej)=>{const t=db.transaction('f','readwrite');t.objectStore('f').put(o,'game');t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function otaSha(txt){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(txt));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
/* baixa um arquivo com limite de tempo; com prog, mostra o andamento (bytes lidos / size) */
async function otaGet(u,ms,o){o=o||{};const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
 try{const r=await fetch(u,{cache:'no-store',headers:o.h,signal:c.signal});if(!r.ok)throw new Error('http '+r.status);
  if(!o.prog||!r.body||!r.body.getReader)return await r.text();
  const rd=r.body.getReader(),ps=[];let n=0;for(;;){const x=await rd.read();if(x.done)break;ps.push(x.value);n+=x.value.length;o.prog(o.size?Math.min(99,Math.round(n/o.size*100)):0)}
  const all=new Uint8Array(n);let q=0;ps.forEach(a=>{all.set(a,q);q+=a.length});return new TextDecoder().decode(all)}
 finally{clearTimeout(t)}}
/* resultado: 'ok' (já é a mais nova), 'nova' (baixou e guardou), 'apk' (precisa do APK novo) ou 'falhou' (sem rede/GitHub) */
async function otaRun(o){o=o||{};if(!OTA.app||!OTA.v)return 'ok';if(OTA.ready)return 'nova';if(OTA.busy)return 'falhou';OTA.busy=1;
 try{let ref='main';
  try{const t=(await otaGet(OTA.api,8000,{h:{Accept:'application/vnd.github.sha'}})).trim();if(/^[0-9a-f]{40}$/.test(t))ref=t}catch(_){}
  const q=ref==='main'?'?t='+Date.now():'';
  const vj=JSON.parse(await otaGet(OTA.base+ref+'/www/version.json'+q,15000));
  if(!(+vj.v>OTA.v))return 'ok';
  let bad=0;try{bad=+localStorage.getItem('so-ota-bad')||0}catch(_){}if(+vj.v===bad)return 'ok';
  if((+vj.loader||1)>OTA.loader)return 'apk';
  if(o.fase)o.fase();
  const html=await otaGet(OTA.base+ref+'/www/game.html'+q,120000,{size:+vj.size||0,prog:o.prog});
  if(vj.sha256&&await otaSha(html)!==vj.sha256)throw new Error('arquivo baixado não confere');
  const m=html.match(/'(\d{12})'\|\|0,base:/);if(!m||+m[1]!==+vj.v)throw new Error('versão do arquivo não confere');
  await otaPut({v:+vj.v,html});OTA.ready=+vj.v;if(!o.gate)otaShow();return 'nova'}
 catch(e){console.warn('atualização:',e&&e.message);return 'falhou'}finally{OTA.busy=0}}
async function otaCheck(){if(!OTA.app||OTA.busy||OTA.ready||!OTA.v)return 0;const r=await otaRun();
 if(r==='apk'&&!OTA.told){OTA.told=1;onlReg('📦 Saiu uma versão nova do jogo: instale para continuar jogando.')}return r==='nova'?1:0}
function otaReload(){location.reload()}
/* porteiro: ao abrir o jogo, Entrar e Criar conta ficam travados até confirmar que a versão é a mais nova */
let otaRetryTk=0;
async function otaGate(){if(!OTA.app||!OTA.v)return 'ok';OTA.gate=1;onlBusy(false);clearTimeout(otaRetryTk);
 const er=$('#err');let bt=$('#otaretry');
 if(!bt){bt=document.createElement('button');bt.id='otaretry';bt.type='button';bt.textContent='Tentar de novo';bt.hidden=true;bt.onclick=()=>otaGate();er.parentNode.insertBefore(bt,er.nextSibling)}
 bt.hidden=true;er.textContent='🔎 Verificando atualização…';
 const r=await otaRun({gate:1,fase:()=>{er.textContent='⬇️ Jogo atualizando… 0%'},prog:n=>{er.textContent='⬇️ Jogo atualizando… '+n+'%'}});
 if(r==='ok'){OTA.gate=0;er.textContent='';onlBusy(false)}
 else if(r==='nova'){er.textContent='✅ Atualizado! Reiniciando o jogo…';setTimeout(otaReload,500)}
 else if(r==='apk')er.textContent='📦 Instale a versão mais nova do jogo para entrar.';
 else{er.textContent='⚠️ Não consegui verificar a atualização. Confira a internet. Tentando de novo…';bt.hidden=false;otaRetryTk=setTimeout(otaGate,10000)}
 return r}
function otaShow(){const b=$('#otabar');if(!b)return;b.querySelector('span').textContent='🔄 Versão nova do jogo baixada ('+otaVerTxt(OTA.ready)+').';b.hidden=false;
 if(ONL.adm)onlReg('🔄 [ADM] Versão '+otaVerTxt(OTA.ready)+' baixada. Ela abre ao tocar em Atualizar ou na próxima vez que abrir o jogo.')}
async function otaApply(){const b=$('#otabar');if(b)b.querySelector('button').disabled=true;try{if(ONL.on)await onlSave(true)}catch(_){}location.reload()}

// ---------- integração com o jogo ----------
{const _start=start;start=function(k){_start(k);if(ONL.on){E=[];EP=[];if(!ONL.hasChar)onlCreateChar().catch(e=>onlLog('⚠️ '+onlErr(e)));else if(!ONL.loading)onlSave();if(ONL.authed)gsJoin();else gsConnect();onlStatus();grpDraw()}}}
{const _sw=switchMap;switchMap=function(k){_sw(k);if(ONL.on){gsJoin();ONL.dirty=true;grpDraw()}}}
function gsReady(){return new Promise((res,rej)=>{if(ONL.authed)return res();ONL.welcomeCb=res;gsConnect();
 const er=$('#err'),t0=performance.now();const tk=setInterval(()=>{if(ONL.authed||!ONL.welcomeCb){clearInterval(tk);return}const s=Math.round((performance.now()-t0)/1000);
  er.textContent=s<4?'Conectando ao servidor do jogo…':'Conectando ao servidor… '+s+'s';
  if(s>120){clearInterval(tk);ONL.welcomeCb=null;rej(new Error('O servidor do jogo não respondeu. Tente de novo em instantes.'))}},500)})}
async function onlEnter(){if(OTA.gate)return;const n=$('#u').value.trim(),s=$('#p').value,er=$('#err');
 if(!n||!s){er.textContent='Digite seu nome de usuário e sua senha.';return}
 if(!/^[A-Za-z0-9_]{3,14}$/.test(n)){er.textContent='Usuário ou senha incorretos.';return}
 er.textContent='Entrando…';onlBusy(true);
 try{await onlLogin(n,s,false);keepSet($('#keep').checked?n:'',s);await onlAfterLogin()}catch(e){onlFail(e)}onlBusy(false)}
const okUser=n=>/^[A-Za-z0-9_]{3,14}$/.test(n),okMail=m=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);
async function onlCreate(){if(OTA.gate)return;const n=$('#nu').value.trim(),s=$('#np').value,em=$('#ne').value.trim(),er=$('#err');
 if(!okUser(n)){er.textContent='Nome de usuário: de 3 a 14 letras, números ou _ (sem espaços nem acentos).';return}
 if(s.length<8){er.textContent='A senha precisa ter pelo menos 8 caracteres.';return}
 if(!okMail(em)){er.textContent='Digite um e-mail de recuperação válido.';return}
 er.textContent='Criando conta…';onlBusy(true);
 try{await onlLogin(n,s,true,em);$('#u').value=n;if($('#keep').checked)keepSet(n,s);await onlAfterLogin()}catch(e){onlFail(e)}onlBusy(false)}
function onlFail(e){$('#err').textContent=e.gs?e.message:onlErr(e);ONL.on=false;ONL.closing=false;try{ONL.ws&&ONL.ws.close()}catch(_){}}
// todo mundo começa na Vila da Areia (a escolha de vila vem depois)
function onlStartMap(){const k=MAPS[START_MAP]?START_MAP:CURMAP;if(k!==CURMAP){CURMAP=k;applyMap(MAPS[k])}}
async function onlAfterLogin(){const er=$('#err');ONL.on=true;ONL.closing=false;name=ONL.nome;
 await itensLoad();
 const row=await onlLoadChar();
 if(ONL.adm&&ONL.itDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem a tabela dos itens do painel: rode o arquivo sql/09_itens.sql no Supabase. O jogo funciona sem ela.'),2300);
 try{await gsReady()}catch(e){e.gs=1;throw e}
 if(ONL.adm&&INV_ON&&ONL.ctDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem as colunas do contrato de invocação: rode o arquivo sql/08_contrato.sql no Supabase. Até lá o contrato fica salvo só neste aparelho.'),2100);
 if(ONL.adm&&ONL.verDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem a coluna da versão do personagem: rode o arquivo sql/07_versao.sql no Supabase. O jogo funciona sem ela.'),1900);
 if(ONL.adm&&ONL.mgkDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem a coluna da Mangekyō: rode o arquivo sql/06_mangekyo.sql no Supabase. Até lá a escolha do olho fica salva só neste aparelho.'),1700);
 if(ONL.adm&&ONL.profDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem as colunas da proficiência: rode o arquivo sql/03_proficiencia.sql no Supabase. Até lá ela fica salva só neste aparelho.'),1500);
 if(row&&row.cla&&CLANS[row.cla]){ONL.hasChar=true;name=ONL.nome=row.nome||ONL.nome;
  ['pele','cabelo','roupa'].forEach((k,i)=>{if(row[k])look[['skin','hair','cloth'][i]]=row[k]});
  const ch={lv:row.nivel,xp:row.xp,pts:row.pontos,st:{str:row.forca,agi:row.agilidade,vit:row.vitalidade,int:row.inteligencia,dex:row.destreza,luk:row.sorte},prof:{k:row.proficiencia||null,xp:row.prof_xp|0},mgk:row.mangekyo||null,v:ONL.verDb?+row.versao||1:1,ct:ONL.ctDb?ctNorm({k:row.contrato,t:row.contrato_em?Date.parse(row.contrato_em):0}):{k:null,t:0}};
  if(!ONL.profDb||!ONL.mgkDb||!ONL.verDb||!ONL.ctDb){try{const o=JSON.parse(localStorage.getItem(chKey())||'null');if(o&&o.prof&&!ONL.profDb)ch.prof=o.prof;if(o&&o.mgk&&!ONL.mgkDb)ch.mgk=o.mgk;if(o&&o.v&&!ONL.verDb)ch.v=o.v;if(o&&o.ct&&!ONL.ctDb)ch.ct=ctNorm(o.ct)}catch(_){}} // sem as colunas no banco: mantém o que estava no aparelho
  const inv={inv:[],eq:{}};ONL.unk=[];(row.inventario||[]).forEach(r=>{const it=ITEMS[r.item];if(!it){ONL.unk.push({item:r.item,equipado:!!r.equipado});return}if(r.equipado&&!inv.eq[it.slot])inv.eq[it.slot]=r.item;else inv.inv.push(r.item)});
  try{localStorage.setItem(chKey(),JSON.stringify(ch));localStorage.setItem(invKey(),JSON.stringify(inv))}catch(_){}
  onlStartMap();
  if(typeof mark==='function')mark();er.textContent='';goFull();ONL.loading=true;start(row.cla);ONL.loading=false;
  ONL.last={cols:onlCols(),inv:JSON.stringify(onlInv())};setTimeout(rs,350)}
 else{ONL.hasChar=false;onlStartMap();try{localStorage.removeItem(chKey());localStorage.removeItem(invKey())}catch(_){}er.textContent='';show('clan')}}
function onlBusy(b){['#go1','#goNew','#tabIn','#tabNew'].forEach(s=>{const e=$(s);if(e)e.disabled=b||!!OTA.gate})}
function onlLogout(){ONL.closing=true;const fin=()=>{try{localStorage.removeItem(ONL_SESS)}catch(_){}location.reload()};
 const pr=ONL.on?onlSave():Promise.resolve();Promise.resolve(pr).finally(()=>{try{ONL.ws&&ONL.ws.close()}catch(_){}if(ONL.tok)onlFetch('/auth/v1/logout',{method:'POST'}).catch(()=>{}).finally(fin);else fin()})}
// ---------- Itens criados no painel (/painel no servidor; tabela "itens", SQL 09) ----------
/*__ITR__*/
async function itensLoad(){if(!ONL.ok||!BAL.itensPainel||typeof ITR==='undefined')return 0;
 try{const L=await onlFetch('/rest/v1/itens?select=*&publicado=eq.true')||[];let n=0;
  for(const r of L){if(!/^p_[a-z0-9_]+$/.test(r.id||''))continue;try{ITEMS[r.id]=ITR.itParaJogo(BAL.itensPainel,r);n++}catch(_){}}ONL.itDb=true;return n}
 catch(e){ONL.itDb=(e.status===404||/PGRST205|Could not find the table/.test(String(e.code)+e.message))?false:null;return 0}}
/* drop de um item que este aparelho ainda não conhece (publicado agora há pouco): busca os itens e depois entrega */
{const g=gsMsg;gsMsg=function(m){if(m&&m.t==='reward'&&(m.items||[]).some(i=>!ITEMS[i])){itensLoad().then(()=>g(m));return}return g(m)}}
/* passiva "drenar chakra" (ex.: Samehada): em jogador o servidor confere e avisa os dois lados; em monstro você recupera um pouco */
function drenoOn(){for(const s in EQ){const it=ITEMS[EQ[s]];if(it&&it.passiva&&it.passiva.k==='drena')return it.passiva}return null}
const drenoTxt=P=>'cada golpe que acerta: em jogador, ele perde '+nf(+P.pvp||0)+'% do chakra máximo e você recupera '+nf(+P.pvp||0)+'% do seu; em monstro, você recupera '+nf(+P.pve||0)+'% do seu chakra (no máximo '+nf(1/Math.max(.2,+P.intervalo||.5))+' vezes por segundo)';
function drenoGanha(pct){const v=Math.round(p.mpMax*pct/100);if(v<1)return;p.mp=Math.min(p.mpMax,p.mp+v);FT.push({x:p.x+14,y:p.y-66,t:'+'+v+' chakra',txt:1,life:.8,col:'#ff9a3a'})}
{const g=gsMsg;gsMsg=function(m){const r=g(m);
  if(m&&m.t==='hurt'&&m.dr>0&&!m.miss&&!m.blk&&!(scene|0)&&p){const v=Math.round(p.mpMax*m.dr/100);if(v>0){p.mp=Math.max(0,p.mp-v);FT.push({x:p.x-14,y:p.y-80,t:'−'+v+' chakra',txt:1,life:.9,col:'#ff9a3a'});onlReg('🦈 '+(m.src||'Alguém')+' drenou '+v+' do seu chakra.')}}
  if(m&&m.t==='ph'&&m.by===ONL.uid&&m.dr>0&&!m.miss&&!m.blk){const P=drenoOn();if(P)drenoGanha(+P.pvp||0)}
  return r}}
{let last=0;const _h=hitE;hitE=function(e,d,st,kx,ky){const vivo=e&&!e.dead&&!e.pvp;const r=_h(e,d,st,kx,ky);const P=vivo&&drenoOn(),t=performance.now();
  if(P&&t-last>=Math.max(.2,+P.intervalo||.5)*1000){last=t;drenoGanha(+P.pve||0)}return r}}
/* ---------- visual no corpo: itens equipados em camadas no boneco (capa e arma atrás, cabeça e acessório na frente) ----------
   O desenho de cada item vem do painel ("Visual no corpo"); os pontos de encaixe saem dos pixels de cada quadro do boneco,
   então a camada acompanha todas as poses (parado, correndo, golpes, aura) e vira junto quando ele vira. */
const VIM={};function visImg(u){if(!u)return null;let i=VIM[u];if(!i){i=new Image();i.src=u;VIM[u]=i}return i.complete&&i.naturalWidth?i:null}
const ANC=new WeakMap();function ancDe(im){if(!im)return null;let a=ANC.get(im);if(a!==undefined)return a;if(im.complete===false||!(im.width>0))return null;a=null;
 try{const w=im.width,h=im.height,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);a=ITR.itAncora(g.getImageData(0,0,w,h).data,w,h)}catch(_){}ANC.set(im,a);return a}
let visBusca=-1e9;function eqVis(ids){const L=[];for(const id of (ids||Object.values(EQ))){const it=ITEMS[id];if(it&&it.vis&&ITR.CAMADA[it.slot])L.push(it);
  else if(!it&&/^p_/.test(id)&&ONL.on&&performance.now()-visBusca>15000){visBusca=performance.now();itensLoad()}}return L} /* outro jogador com item publicado depois que você entrou: busca a lista de novo (no máximo 1 vez a cada 15 s) */
function visCamadas(c,V,tras,im,dx,dy,dw,dh,o){const HS=o.set||HERO,R=HS&&HS.idle&&HS.idle[0]?ancDe(HS.idle[0]):null,A=ITR.itAncoraRef(ancDe(im),R);if(!A)return;const kx=dw/im.width,ky=dh/im.height,t=o.t||0,mv=!!o.mv;
 for(const it of V){if(!ITR.CAMADA[it.slot])continue;const v=it.vis,src=mv&&v.img2?v.img2:v.img,li=visImg(src);if(!li)continue;
  const P=ITR.itCamada(it.slot,A,v,li.width,li.height,mv,t,!!v.img2);if(!P||(!P.div&&!!P.tras!==tras))continue;const pa=P.div?(tras?'baixo':'cima'):0; /* cada pose (parada/correndo) tem o seu ajuste: atrás, na frente ou dividido (a parte de cima na frente do corpo, o resto atrás) */
  const Q={x:dx+P.x*kx,y:dy+P.y*ky,w:P.w*kx,h:P.h*ky,rot:P.rot,px:P.px,py:P.py,corte:P.corte},col=it.fx&&it.fx.arma&&(it.fx.cor||it.fx.glow||'#ff8a1a');
  if(col){const pu=.5+.5*Math.sin(t/140);if(!P.div||tras){c.save();c.globalCompositeOperation='lighter';const g=c.createRadialGradient(Q.x,Q.y,1,Q.x,Q.y,Q.h*.42);g.addColorStop(0,hexA(col,.28+.12*pu));g.addColorStop(1,hexA(col,0));c.fillStyle=g;c.beginPath();c.arc(Q.x,Q.y,Q.h*.42,0,7);c.fill();c.restore()}
   c.save();c.shadowColor=col;c.shadowBlur=4+5*pu;ITR.itDesenha(c,li,Q,pa);c.restore();
   if(!P.div||!tras){c.save();c.globalCompositeOperation='lighter';for(let i=0;i<5;i++){const ph=((t/900)+i/5)%1,ex=Q.x+(i-2)*Q.w*.18+Math.sin(t/200+i)*2,ey=Q.y+Q.h*.3-ph*Q.h*.8;c.fillStyle=hexA(col,.75*(1-ph));c.beginPath();c.arc(ex,ey,1.8*(1-ph)+.5,0,7);c.fill()}c.restore()}}
  else ITR.itDesenha(c,li,Q,pa)}}
/* sempre correndo: todo boneco que se mexe usa a animação de corrida (em todos os clãs; não existe mais a de caminhada) */
{const _dh=drawHero;drawHero=function(c,x,y,o){if(o&&o.mv)o.run=1;return _dh(c,x,y,o)}}
/* o boneco é desenhado com drawImage dentro do drawHero: no primeiro drawImage, desenha as camadas de trás, o boneco e as da frente (com o mesmo giro/espelho) */
{const _dh=drawHero;drawHero=function(c,x,y,o){const V=o&&o.vis;if(!V||!V.length||typeof ITR==='undefined')return _dh(c,x,y,o);
 const di=c.drawImage;let done=false;
 c.drawImage=function(im,dx,dy,dw,dh){if(!done&&arguments.length===5&&im&&im.width>8){done=true;try{visCamadas(c,V,true,im,dx,dy,dw,dh,o)}catch(_){}di.apply(c,arguments);try{visCamadas(c,V,false,im,dx,dy,dw,dh,o)}catch(_){}return}return di.apply(c,arguments)};
 try{return _dh(c,x,y,o)}finally{delete c.drawImage}}}
/* nível do item: só equipa a partir do nível dele */
{const _eq=equipItem;equipItem=function(id){const it=ITEMS[id];if(it&&it.nivel>1&&CH&&(CH.lv|0)<it.nivel){toast('🔒 '+it.name+': precisa do Nv '+it.nivel+' para equipar.');return}return _eq(id)}}
// ---------- Retrato do HUD: o rosto do personagem dentro da moldura (arte/ui) ----------
function hudFace(){const cv=$('#hudFaceCv');if(!cv||cur!=='game'||!cv.offsetParent)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);c.imageSmoothingEnabled=false;
 const k=H/HFACE.z;c.setTransform(k,0,0,k,W/2,H/2+HFACE.y*k);try{if(HERO)drawHero(c,0,0,{fl:0,t:0,mv:0,run:0,aura:-1,th:-1,act:null,vis:eqVis()});else drawChar(c,0,0,{...look,clan,dir:0,t:0,mv:0,run:0})}catch(_){}}
const HFACE={z:22,y:44};setInterval(hudFace,700);
/* tocar no retrato abre a lista Personagem / Status / Jutsus; a Mochila fica sozinha no botão dela */
function pfMenu(v){const m=$('#pfMenu');if(!m)return;m.hidden=v===undefined?!m.hidden:!v}
function pfBadge(){const n=CH&&CH.pts>0?CH.pts:0;[['#hfBadge'],['#pfBadge']].forEach(([s])=>{const e=$(s);if(e){e.hidden=!n;e.textContent=n}})}
{const f=$('#hudFace'),m=$('#pfMenu');if(f&&m){f.onclick=e=>{e.stopPropagation();pfMenu()};
 m.querySelectorAll('[data-pf]').forEach(b=>b.onclick=e=>{e.stopPropagation();pfMenu(false);toggleBag(true,b.dataset.pf)});
 document.addEventListener('click',e=>{if(!m.hidden&&!m.contains(e.target)&&!f.contains(e.target))pfMenu(false)},true)}
 setInterval(pfBadge,500)}
/* pacotes 5 a 9: ícones nas abas e no menu do retrato, nomes embaixo dos botões do canto, slots, atributos e cartões dos clãs */
{const TIC={tbBag:['mochila','Mochila'],tbCh:['personagem','Personagem'],tbSt:['status','Status'],tbJu:['jutsus','Jutsus']},PIC={ch:'personagem',st:'status',ju:'jutsus'};
 for(const id in TIC){const b=$('#'+id);if(b)b.innerHTML='<i class="tic" style="background-image:var(--ui-ab_'+TIC[id][0]+')"></i>'+TIC[id][1]}
 document.querySelectorAll('#pfMenu [data-pf]').forEach(b=>{const t=b.childNodes[0];if(t&&t.nodeType===3)t.textContent=t.textContent.replace(/^\S+\s*/,'');b.insertAdjacentHTML('afterbegin','<i class="tic" style="background-image:var(--ui-ab_'+PIC[b.dataset.pf]+')"></i>')});
 const EMO=/[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
 setInterval(()=>{['#mapbtn','#bagbtn','#grpbtn'].forEach(q=>{const b=$(q);if(!b)return;const t=b.textContent.replace(EMO,'').trim();if(b.dataset.n!==t)b.dataset.n=t})},500);
 document.querySelectorAll('.card canvas[data-k]').forEach(c=>{const d=c.closest('.card'),k=c.dataset.k;if(!d||!UIJ['rolo_'+k])return;d.dataset.k=k;
  d.insertAdjacentHTML('afterbegin','<i class="rolo" style="--rl:url('+UIJ['rolo_'+k]+');--rlon:url('+UIJ['rolo_'+k+'_on']+')"></i>')})}
{const _sr=stRefresh,DK={'Vida máxima':'hp','Chakra máximo':'mp','Poder físico':'pf','Poder de chakra':'pc','Crítico':'crit','Esquiva':'esq','Precisão':'prec','Redução de dano':'red','Velocidade':'spd','Recarga':'cdr','Regeneração de chakra':'mpr'};
 stRefresh=function(){_sr();document.querySelectorAll('#stRows .strow').forEach((r,i)=>{const b=r.querySelector('.sn>b');if(b&&AT[i]&&!b.classList.contains('aic')){b.className='aic';b.title=AT[i][1];b.style.backgroundImage='var(--ui-at_'+AT[i][0]+')';b.textContent=''}});
  document.querySelectorAll('#stDer>div>span:first-child').forEach(sp=>{const k=DK[sp.textContent];if(k&&!sp.querySelector('.aic'))sp.insertAdjacentHTML('afterbegin','<i class="aic" style="background-image:var(--ui-at_'+k+')"></i>')})}}
/* segurar um botão de golpe mostra o que ele faz (dano, chakra, recarga); soltar esconde. O golpe sai normalmente ao tocar */
function sbTipHtml(i){if(!clan||!CH)return '';const esc2=t=>String(t).replace(/[<>&]/g,'');
 if(i===3&&!CLANS[clan].sk[3]){const it=atkItem();if(!it)return '<b class="tt">Item da mão</b><p>Equipe um item de mão com habilidade (ex.: Chidori) para usar aqui.</p>';
  return '<div class="th">'+(it.icon?imgIc(it.icon):'')+'<div><b class="tt">'+esc2(it.name)+'</b><small>Item da mão</small></div></div>'+(it.desc?'<p>'+(typeof ITR!=='undefined'?ITR.descHtml(it.desc):esc2(it.desc))+'</p>':'')}
 const s=CLANS[clan].sk[i];if(!s)return '';const N=jtNodes();let n=s.t==='eye'?N.find(x=>x.tm===Math.max(1,eyeLv())):N.find(x=>x.j===s.id);if(!n)return '';
 const I=jtInfo(n),L=juStats(n)||[],d=JTD[n.id]||'';
 return '<div class="th">'+I.ic+'<div><b class="tt">'+esc2(I.nm)+(I.sub?' <small>'+esc2(I.sub)+'</small>':'')+'</b>'+(I.ok?'':'<small class="tl">🔒 Libera no Nv '+n.lv+'</small>')+'</div></div>'
  +(d?'<p>'+d+'</p>':'')+(L.length?'<ul>'+L.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'')}
{let tk=0,tip=null;const hide=()=>{clearTimeout(tk);tk=0;if(tip)tip.hidden=true};
 [0,1,2,3].forEach(i=>{const b=$('#b'+i);if(!b)return;
  b.addEventListener('pointerdown',()=>{clearTimeout(tk);tk=setTimeout(()=>{const h=sbTipHtml(i);if(!h)return;if(!tip){tip=document.createElement('div');tip.id='sbTip';document.body.appendChild(tip)}tip.innerHTML=h;tip.hidden=false},450)});
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,hide))});
 window.addEventListener('blur',hide)}
{const _sp=setPanel;setPanel=function(w){_sp(w);const bag=w==='bag';$('#tbBag').hidden=!bag;['#tbCh','#tbSt','#tbJu'].forEach(s=>{$(s).hidden=bag})}}
// ---------- Retrato do personagem (mochila e aba Personagem), animado enquanto a janela está aberta ----------
function drawPortrait(cv,ts){if(!cv||!cv.offsetParent)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
 const g=c.createRadialGradient(W/2,H*.8,4,W/2,H*.62,W*.62);g.addColorStop(0,'rgba(255,201,74,.22)');g.addColorStop(1,'rgba(255,201,74,0)');c.fillStyle=g;c.fillRect(0,0,W,H);
 const k=H/(cv.id==='chCv'?78:96);c.setTransform(k,0,0,k,W/2,H*.93);const FL=eqFx();
 try{fxDraw(c,0,0,ts,FL,0);if(HERO)drawHero(c,0,0,{fl:0,t:ts,mv:0,run:0,aura:-1,th:-1,act:null,vis:eqVis()});else drawChar(c,0,0,{...look,clan,dir:0,t:ts,mv:0,run:0});fxDraw(c,0,0,ts,FL,1,{fl:0})}catch(_){}}
let pfLoop=0;function portraitTick(ts){pfLoop=0;if(!invOpen)return;drawPortrait($('#dollCv'),ts);drawPortrait($('#chCv'),ts);pfLoop=requestAnimationFrame(portraitTick)}
function portraitStart(){if(!pfLoop)pfLoop=requestAnimationFrame(portraitTick)}
// ---------- Aba Personagem: mostra cada etapa do cálculo ----------
const ATR=[['hp','Vida máxima'],['mp','Chakra máximo'],['pf','Poder físico'],['pc','Poder de chakra'],['crit','Crítico'],['esq','Esquiva'],['prec','Precisão'],['red','Redução de dano'],['spd','Velocidade'],['cdr','Recarga'],['mpr','Regeneração de chakra']];
const MULT={dmg:1,spd:1,mpr:1}; // mostrados como multiplicador (100% = normal)
function atrTxt(k,v){if(k==='hp'||k==='mp')return String(Math.round(v));if(k==='pf'||k==='pc'||k==='esq'||k==='prec')return nf(v);if(k==='cdr')return (v>0?'−':v<0?'+':'')+nf(Math.abs(v))+'%';return nf(v)+'%'}
function pcTxt(t,a,b,na,nb,c,nc){if(Math.abs(t)<.05)return '<span class="z">—</span>';let h='<span class="'+(t>0?'g':'r')+'">'+sgn(t)+'%</span>';const parts=[];if(Math.abs(a)>=.05)parts.push(na+' '+sgn(a));if(Math.abs(b)>=.05)parts.push(nb+' '+sgn(b));if(c&&Math.abs(c)>=.05)parts.push(nc+' '+sgn(c));if(parts.length>1)h+='<small class="cbk">'+parts.join(' · ')+'</small>';else if(parts.length)h+='<small class="cbk">'+parts[0].split(' ')[0]+'</small>';return h}
function flTxt(k,t,a,b){if(Math.abs(t)<.05)return '<span class="z">—</span>';const txt=k==='cdr'?(t>0?'−':'+')+nf(Math.abs(t)):sgn(k==='hp'||k==='mp'?Math.round(t):t);let h='<span class="'+(t>0?'g':'r')+'">'+txt+'</span>';
 if(Math.abs(a)>=.05&&Math.abs(b)>=.05)h+='<small class="cbk">itens '+sgn(a)+' · esp. '+sgn(b)+'</small>';else h+='<small class="cbk">'+(Math.abs(a)>=.05?'itens':'especialidade')+'</small>';return h}
function stFinTxt(k){if(!CH||!clan)return '';const f=calcChar(1,1).st[k].fin;return Math.abs(f-CH.st[k])<.05?'':'<small class="svf">→ '+nf(f)+'</small>'}
function chDraw(){const el=$('#paneCh');if(!el||el.hidden||!CH||!clan)return;
 const c=calcChar(1,1),P=CH.prof,r=profRank(),C=CLANS[clan];
 let h='<div class="chh"><canvas id="chCv" width="220" height="260"></canvas><div class="chi"><b class="chn">'+esc(name)+'</b><span class="chc" style="--c:'+C.col+'">Clã '+C.n+' · Nível '+CH.lv+'</span>'
  +(P&&P.k?'<span class="chp">'+PROF[P.k].ic+' '+PROF[P.k].n+' <b>rank '+PRK[r][0]+'</b></span>':'<span class="chp z">Sem especialidade (escolha na aba Status)</span>')
  +(()=>{const n=(BAL.naturezas&&BAL.naturezas.cla||{})[clan];return n?'<span class="chp">Natureza: <b>'+natNome(n)+'</b> <small class="z">('+natRel(n)+')</small></span>':''})()
  +(()=>{const f=ctFam();return f?'<span class="chp">Contrato: <b>'+esc(f.n)+'</b> <small class="z">('+ctPasTxt(f)+')</small></span>':''})()
  +'<div class="chbar cbh"><i style="width:'+Math.max(0,Math.min(100,p.hp/p.max*100))+'%"></i><b>Vida '+Math.round(p.hp)+' / '+p.max+'</b></div>'
  +'<div class="chbar cbm"><i style="width:'+Math.max(0,Math.min(100,p.mp/p.mpMax*100))+'%"></i><b>Chakra '+Math.round(p.mp)+' / '+p.mpMax+'</b></div></div></div>'
  +admClaHtml()+'<div class="chord"><b>Como é calculado</b><ol><li><b>Status:</b> pontos + itens = base → base × (1 + soma das %) = final (máx. '+STMAX+'; acima de '+BAL.personagem.retornoDecrescente.inicio.str+' pontos — VIT '+BAL.personagem.retornoDecrescente.inicio.vit+' — cada ponto vale '+Math.round(BAL.personagem.retornoDecrescente.eficacia*100)+'%)</li><li><b>Atributos:</b> valor dos status finais + bônus fixos → × (1 + soma das %) = final. Poder físico vem da Força; Poder de chakra, da Inteligência</li><li><b>Golpe:</b> (dano da habilidade + Poder) × bônus da especialidade × crítico. Taijutsu e Bukijutsu usam o Poder físico; Ninjutsu e Genjutsu, o Poder de chakra</li><li><b>Esquiva:</b> Esquiva = Velocidade acima de 100% + nível; Precisão = Destreza + nível. Chance de esquivar = '+BAL.combate.esquivaBase+'% + sua Esquiva − Precisão de quem ataca (de '+BAL.combate.esquivaMin+'% a '+BAL.combate.esquivaMax+'%)</li></ol></div>';
 h+='<div class="ivt">1 · Status</div><div class="tw"><table class="cht"><thead><tr><th>Status</th><th>Pontos</th><th>Itens</th><th>Base</th><th>% total</th><th>Final</th></tr></thead><tbody>'
  +AT.map(([k,ab,nm])=>{const x=c.st[k];return '<tr><td><b class="ab">'+ab+'</b> '+nm+'</td><td>'+x.pts+'</td><td>'+(x.it?'<span class="g">'+sgn(x.it)+'</span>':'<span class="z">—</span>')+'</td><td>'+x.base+'</td><td>'+pcTxt(x.pct,x.pi,x.pp,'itens','esp.')+'</td><td><b>'+nf(x.fin)+'</b>'+(x.dr?' <small class="z" title="acima de '+BAL.personagem.retornoDecrescente.inicio[k]+' cada ponto vale metade">de '+nf(x.bruto)+'</small>':'')+'</td></tr>'}).join('')+'</tbody></table></div>';
 h+='<div class="ivt">2 · Atributos</div><div class="tw"><table class="cht"><thead><tr><th>Atributo</th><th>Dos status</th><th>+ Fixos</th><th>% total</th><th>Final</th></tr></thead><tbody>'
  +ATR.map(([k,nm])=>{const x=c.at[k];return '<tr><td>'+nm+'</td><td>'+atrTxt(k,x.fromSt)+'</td><td>'+flTxt(k,x.fl,x.fi,x.fp)+'</td><td>'+pcTxt(x.pct,x.pi,x.pp,'itens','esp.',x.pk,'contrato')+'</td><td><b>'+atrTxt(k,x.fin)+'</b></td></tr>'}).join('')+'</tbody></table></div>'
  +'<p class="chnote">Velocidade e Regeneração: 100% = normal. Crítico, Redução e Recarga já são porcentagens; nelas (e na Esquiva) a especialidade soma pontos. Redução: no máximo '+BAL.combate.reducaoMax+'% somando tudo.</p>'
  +'<p class="chnote"><b>Tenacidade (PvP): '+nf(tenac())+'%</b> — VIT final × '+nf(+BAL.cc.tenacidadeVit*100/100)+'%, até '+BAL.cc.tenacidadeMax+'%. Encurta atordoar, prender, silêncio/selo, lentidão e genjutsu. O mesmo controle repetido em '+BAL.cc.janela+' s perde força ('+BAL.cc.fatores.map(f=>Math.round(f*100)+'%').join(' → ')+') e depois você fica imune por '+BAL.cc.imune+' s; atordoado seguido, no máximo '+BAL.cc.cadeiaMax+' s.</p>';
 h+='<div class="ivt">3 · Golpes</div><div class="tw"><table class="cht"><thead><tr><th>Golpe</th><th>Tipo</th><th>Dano</th><th>Recarga</th><th>Chakra</th></tr></thead><tbody>'
  +C.sk.concat(atkItem()&&!C.sk[3]?[{_it:1}]:[]).map((s,i)=>{const a=s._it?atkItem():null,tp=skType(i),bd=a?+a.atk.dmg||16:s.dmg,bc=a?+a.atk.cd||s.cd:s.cd,bm=a?+a.atk.mp||0:s.mp,tm=profTypeMul(tp),
    pw=skPow(tp),fd=Math.max(1,Math.round(hitRaw(bd,tp))),fc=cdOf(i,s),fm=mpOf(i,s),cls=(x,y,lowGood)=>Math.abs(x-y)<.01?'':((lowGood?x<y:x>y)?'g':'r');
    return '<tr><td>'+(a?a.name+' <small>(item · rank A)</small>':s.n+(s.rk?' <small class="rkb">rank '+s.rk+'</small>':''))+'</td><td>'+(tp?PROF[tp].ic+' '+PROF[tp].n+(profOn(tp)?' <small class="g">especialidade</small>':profOth(tp)?' <small class="r">penalidade</small>':''):'—')+'</td>'
     +'<td>'+(Math.abs(tm-1)>.001?'(':'')+bd+' + '+nf(pw)+(Math.abs(tm-1)>.001?') × '+nf(tm):'')+' = <b class="'+cls(fd,bd,0)+'">'+fd+'</b><small class="cbk">'+(isChakra(tp)?'poder de chakra':'poder físico')+'</small></td><td>'+nf(bc)+'s → <b class="'+cls(fc,bc,1)+'">'+nf(fc)+'s</b></td><td>'+bm+' → <b class="'+cls(fm,bm,1)+'">'+fm+'</b></td></tr>'}).join('')+'</tbody></table></div>'
  +'<p class="chnote">Dano por acerto sem crítico: (dano da habilidade + poder) × bônus da especialidade. Crítico: ×'+nf(critPve())+' em monstros e ×'+nf(critPvp())+' em jogadores. No PvP o dano é '+Math.round((ONL.pvpMul||.6)*100)+'% e o bônus de % de dano dos itens vale no máximo '+(BAL.pvp?BAL.pvp.itemDanoMax:20)+'%.</p>';
 el.innerHTML=h;admClaBind(el,chDraw);portraitStart()}
// ---------- [ADM] trocar de clã para testar: começa do zero (nível 1, sem pontos, atributos, especialidade, Mangekyō, barra nem mochila) ----------
let admClaPick=null;
function admClaHtml(){if(!ONL.on||!ONL.adm||!clan)return '';const k=admClaPick&&CLANS[admClaPick]?admClaPick:null;
 if(k)return '<div class="jadm admo acla"><span>[ADM] Virar <b>'+CLANS[k].n+'</b>? Zera tudo: nível, XP, pontos, atributos, especialidade, Mangekyō, barra e mochila.</span><button class="conf" data-acla="ok">Confirmar e zerar</button><button class="sec" data-acla="no">Cancelar</button></div>';
 return '<div class="jadm admo acla"><span>[ADM] Trocar de clã (começa do zero):</span>'+Object.keys(CLANS).map(c=>'<button data-acla="'+c+'"'+(c===clan||ONL.claBusy?' disabled':'')+'>'+CLANS[c].n+'</button>').join('')+'</div>'}
function admClaBind(el,redraw){el.querySelectorAll('[data-acla]').forEach(b=>b.onclick=()=>{const v=b.dataset.acla;
 if(v==='no'){admClaPick=null;return redraw()}if(v==='ok'){const k=admClaPick;admClaPick=null;return admClasse(k)}admClaPick=v;redraw()})}
async function admClasse(k){if(!ONL.on||!ONL.adm||!CLANS[k]||k===clan||ONL.claBusy)return;
 if(ONL.trade){toast('Termine ou cancele a troca antes de trocar de clã.');return}
 ONL.claBusy=1;const de=CLANS[clan]?CLANS[clan].n:clan;
 try{if(EYE.on)eyeOff();
  for(let g=0;ONL.saving&&g<80;g++)await new Promise(r=>setTimeout(r,100)); // espera um salvamento que já estava em andamento
  CH=chNew();for(const j in JCD)delete JCD[j];
  try{localStorage.setItem(chKey(),JSON.stringify(CH));localStorage.setItem(invKey(),JSON.stringify({inv:[],eq:{}}));localStorage.removeItem(barKey())}catch(_){}
  try{ACT=null;KDEL=[];PRT=0;PSL=0;SHD=null}catch(_){}
  if(ONL.inv)gsSend({t:'admreset'}); // mochila no banco: quem apaga é o servidor
  ONL.loading=true;try{start(k)}finally{ONL.loading=false}
  await onlSave();
  const t='🛡️ [ADM] Clã trocado: '+de+' → '+CLANS[k].n+'. Tudo zerado (Nv 1).';onlReg(t+(ONL.dirty?' ⚠️ O banco não respondeu agora; o jogo tenta salvar de novo sozinho.':''));toast(t)}
 catch(e){onlReg('⚠️ [ADM] Erro ao trocar de clã: '+(e&&e.message||e))}
 ONL.claBusy=0}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// ---------- Mochila nova: boneco com os equipamentos, grade maior, comparação e organizar ----------
const SLOT_IC={cabeca:'🪖',capa:'🧥',arma:'🗡️',mao:'✋',acessorio:'💍'},RAR_ORD={lendario:0,epico:1,raro:2,comum:3};
const STX={};STAT_DEFS.forEach(([k,n,u])=>STX[k]=['de '+n.toLowerCase(),u]);
const stLine=(k,v)=>(v>0?'+':'−')+Math.abs(v)+STX[k][1]+' '+STX[k][0];
function rarOf(it){return RAR_DEFS[it.rarity]||RAR_DEFS.comum}
function bagSlot(id,cls,on){const b=slotBtn(id,cls,on);if(id){const r=(ITEMS[id]||{}).rarity;b.style.backgroundImage='var(--ui-rar_'+(RAR_DEFS[r]?r:'comum')+'),var(--ui-'+(id==invSel?'slot_sel':'slot')+')'}return b} /* moldura da raridade (arte/ui) */
bagRefresh=function(){const g=$('#ivGrid'),det=$('#ivDet'),L=$('#dollL'),R=$('#dollR');if(!g||!L)return;L.innerHTML='';R.innerHTML='';
 ['cabeca','capa','arma','mao','acessorio'].forEach((s,j)=>{const n=(SLOT_DEFS.find(x=>x[0]===s)||[s,s])[1],id=EQ[s],w=document.createElement('div');w.className='es';
  const b=bagSlot(id,' big',()=>{invSel=id;bagRefresh()});if(!id){b.innerHTML='';b.style.backgroundImage='var(--ui-eq_'+s+')'}w.appendChild(b);
  const l=document.createElement('small');l.textContent=n;w.appendChild(l);(j<3?L:R).appendChild(w)});
 const sum=Object.keys(STX).filter(k=>AG[k]).map(k=>stLine(k,AG[k]));
 $('#eqSum').innerHTML=sum.length?'<b>Bônus dos equipamentos</b>'+sum.map(x=>'<span>'+x+'</span>').join(''):'<span class="z">Nenhum equipamento com bônus.</span>';
 const SK=stacks(INV),N=Math.max(20,Math.ceil((SK.length+1)/5)*5);g.innerHTML='';for(let i=0;i<N;i++){const o=SK[i],id=o&&o.i;g.appendChild(tSlot(id,o&&o.n,()=>{invSel=id;bagRefresh()},false))}
 $('#bagCnt').textContent=SK.length+' / '+N+(INV.length>SK.length?' · '+INV.length+' itens':'');
 const id=invSel&&hasItem(invSel)?invSel:null;
 if(!id){det.innerHTML='<div class="dempty"><div class="dei">🎒</div><p>'+(INV.length||Object.keys(EQ).length?'Toque num item para ver os detalhes e equipar.':'Sua mochila está vazia.<br>Derrote a <b>Raposa de Nove Caudas</b> e os monstros para ganhar itens.')+'</p></div>';return}
 const it=ITEMS[id],on=EQ[it.slot]==id,rc=rarOf(it),sl=(SLOT_DEFS.find(x=>x[0]==it.slot)||[0,it.slot])[1],curId=!on&&EQ[it.slot]&&EQ[it.slot]!==id?EQ[it.slot]:null,cur=curId?ITEMS[curId]:null;
 const keys=Object.keys(STX).filter(k=>(+(it.stats||{})[k]||0)||(cur&&(+(cur.stats||{})[k]||0)));
 const lines=keys.map(k=>{const v=+(it.stats||{})[k]||0,cv=cur?+(cur.stats||{})[k]||0:0,d=v-cv;
  if(!cur)return v?'<li class="'+(v>0?'g':'r')+'">'+stLine(k,v)+'</li>':'';
  return '<li>'+(v?stLine(k,v):'<span class="z">sem '+STX[k][0].replace(/^de /,'')+'</span>')+(d?' <span class="'+(d>0?'g':'r')+'">('+(d>0?'▲ ':'▼ ')+(d>0?'+':'−')+Math.abs(d)+STX[k][1]+')</span>':'')+'</li>'}).join('');
 const atk=it.atk&&it.atk.kind?'<div class="dsp">⚡ <b>Habilidade do item</b> (4º botão, ao lado dos golpes): '+itemSkTxt(it)+' Conta como Ninjutsu.</div>':'';
 det.innerHTML='<div class="dt" style="--rc:'+rc[1]+'"><div class="dth"><div class="dti" style="background:radial-gradient(circle at 50% 38%,'+hexA(rc[1],.42)+',#150a08 72%)">'+(it.icon?'<img src="'+it.icon+'" alt="">':'?')+'</div><div><div class="dn" style="color:'+rc[1]+'">'+esc(it.name)+'</div>'
  +'<div class="chips"><span class="chip rc">'+rc[0]+'</span><span class="chip">'+(SLOT_IC[it.slot]||'')+' '+sl+'</span>'+(on?'<span class="chip on">Equipado</span>':'')+(freeN(id)>(on?0:1)?'<span class="chip">×'+freeN(id)+' na mochila</span>':'')+'</div></div></div>'
  +(it.desc?'<p class="dd">'+(typeof ITR!=='undefined'?ITR.descHtml(it.desc):esc(it.desc))+'</p>':'')+(lines?(cur?'<div class="dcmp">Comparando com <b>'+esc(cur.name)+'</b> (equipado)</div>':'')+'<ul class="dst">'+lines+'</ul>':'')+atk
  +'<div class="dbt"><button id="ivAct" class="'+(on?'sec':'')+'">'+(on?'Desequipar':cur?'Trocar pelo equipado':'Equipar')+'</button></div></div>';
 $('#ivAct').onclick=()=>{if(on)unequipItem(id);else{equipItem(id);toggleBag(true,'bag');invSel=id;bagRefresh()}}
 portraitStart()};
/* música do login: toca em repetição no login, na escolha do clã e na criação; some quando o jogo começa */
const MUS_TELAS=['login','clan','cust']; /* a música segue até o jogo começar */
{const M={a:null,fd:0};
 const mus=()=>{if(!M.a){M.a=new Audio('data:audio/mpeg;base64,__LGMUS__');M.a.loop=true;M.a.preload='auto'}return M.a};
 const toca=()=>{if(!MUS_TELAS.includes(cur)||document.hidden)return;clearInterval(M.fd);const a=mus();a.volume=.6;if(a.paused){const p=a.play();if(p&&p.catch)p.catch(()=>{})}};
 const para=()=>{const a=M.a;if(!a||a.paused)return;clearInterval(M.fd);M.fd=setInterval(()=>{if(a.volume>.08)a.volume=Math.max(0,a.volume-.08);else{clearInterval(M.fd);a.pause();a.currentTime=0}},50)};
 {const _sh=show;show=function(id){const r=_sh.apply(this,arguments);if(MUS_TELAS.includes(id))toca();else para();return r}}
 /* o celular só deixa tocar depois do primeiro toque: tenta de novo a cada toque enquanto estiver no login */
 ['pointerdown','keydown','touchend'].forEach(e=>document.addEventListener(e,toca,true));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(M.a)M.a.pause()}else toca()});
 window.LGMUS=M;toca()}
/* animação de fundo (estrelas cadentes e poeira) só na tela de login */
{const FX={c:{},st:[],du:[],nx:1,t0:0};
 const mk=id=>{const sc=$('#s-'+id);if(!sc||FX.c[id])return;const c=document.createElement('canvas');c.className='bgfx';sc.insertBefore(c,sc.firstChild);FX.c[id]=c};
 ['login','cust'].forEach(mk);
 FX.tw=[];FX.fg=[{x:0,y:.78,v:6,a:.10},{x:.5,y:.86,v:-0.0+9,a:.08}];FX.lf=[];FX.ff=[];
 for(let i=0;i<34;i++)FX.tw.push({x:Math.random(),y:Math.random(),p:500+Math.random()*900,o:Math.random()*6.3,b:i%9===0});
 for(let i=0;i<9;i++)FX.lf.push({x:Math.random(),y:Math.random(),vx:10+Math.random()*10,vy:12+Math.random()*10,t:Math.random()*9,o:Math.random()*6.3,c:['#6aa84f','#a3c25a','#d98a3a'][i%3]});
 for(let i=0;i<8;i++)FX.ff.push({x:Math.random(),y:.5+Math.random()*.45,t:Math.random()*9,o:Math.random()*6.3});
 for(let i=0;i<46;i++)FX.du.push({x:Math.random(),y:Math.random(),v:.004+Math.random()*.012,a:Math.random()*6.3,s:Math.random()<.2?3:2,w:Math.random()*6.3});
 /* criação de personagem: partículas na cor do clã (brasas, chakra, folhas) */
 const CPAL={uchiha:{c:['255,110,40','255,170,60','255,70,40'],d:-1},hyuga:{c:['150,190,255','210,230,255','120,160,255'],d:-.6},nara:{c:['110,190,110','170,220,120','60,140,90'],d:.8}};
 FX.cp=[];for(let i=0;i<48;i++)FX.cp.push({x:Math.random(),y:Math.random(),v:.02+Math.random()*.05,o:Math.random()*6.3,k:i%3,s:Math.random()<.25?2:1});
 function custFx(g,W,H,dt,ts){const P=CPAL[pickK]||CPAL.hyuga;
  FX.cp.forEach(o=>{o.y+=P.d*o.v*dt;o.x+=Math.sin(ts/900+o.o)*.03*dt+(P.d>0?.012*dt:0);if(o.y<-.03)o.y=1.03;if(o.y>1.03)o.y=-.03;if(o.x>1.03)o.x=-.03;
   const a=.35+.5*Math.abs(Math.sin(ts/500+o.o)),x=(o.x*W)|0,y=(o.y*H)|0,cl=P.c[o.k];
   if(P.d>0){g.fillStyle='rgba('+cl+','+a.toFixed(2)+')';g.fillRect(x,y,o.s+2,o.s+1);g.fillRect(x+1,y-1,o.s,1)} /* folha */
   else{g.fillStyle='rgba('+cl+','+(a*.25).toFixed(2)+')';g.fillRect(x-1,y-1,o.s+2,o.s+2);g.fillStyle='rgba('+cl+','+a.toFixed(2)+')';g.fillRect(x,y,o.s,o.s)}})}
 function bgfx(ts){requestAnimationFrame(bgfx);const c=FX.c[cur];if(!c)return;const dt=Math.min(.05,(ts-FX.t0)/1000||0);FX.t0=ts;
  const W=c.clientWidth>>1,H=c.clientHeight>>1;if(!W)return;if(c.width!==W||c.height!==H){c.width=W;c.height=H}
  const g=c.getContext('2d');g.clearRect(0,0,W,H);
  if(cur==='cust'){custFx(g,W,H,dt,ts);return}
  FX.nx-=dt;if(FX.nx<=0&&FX.st.length<3){FX.nx=1.2+Math.random()*2.6;const sp=130+Math.random()*90;FX.st.push({x:W*(.25+Math.random()*.85),y:-4+Math.random()*H*.3,vx:-sp,vy:sp*.5,l:0,L:.9+Math.random()*.5})}
  /* brilho da lua, estrelas piscando, névoa, folhas e vaga-lumes */
  const mx=W*.44,my=H*.13,pu=.5+.5*Math.sin(ts/1400),gr=g.createRadialGradient(mx,my,H*.04,mx,my,H*.3);gr.addColorStop(0,'rgba(255,240,190,'+(.16+.08*pu).toFixed(3)+')');gr.addColorStop(1,'rgba(255,240,190,0)');g.fillStyle=gr;g.fillRect(0,0,W,H*.6);
  FX.tw.forEach(o=>{const a=.25+.75*Math.max(0,Math.sin(ts/o.p+o.o));g.fillStyle='rgba(255,250,225,'+(a*.8).toFixed(2)+')';g.fillRect((o.x*W)|0,(o.y*H*.55)|0,1,1);if(o.b&&a>.8)g.fillRect((o.x*W)|0,((o.y*H*.55)|0)-1,1,3),g.fillRect(((o.x*W)|0)-1,(o.y*H*.55)|0,3,1)});
  FX.fg.forEach(o=>{o.x+=o.v*dt*.01;if(o.x>1.3)o.x=-.3;const gx=g.createLinearGradient(0,0,W,0);gx.addColorStop(0,'rgba(190,175,220,0)');gx.addColorStop(.5,'rgba(190,175,220,'+o.a+')');gx.addColorStop(1,'rgba(190,175,220,0)');g.save();g.translate(o.x*W-W*.5,H*o.y);g.fillStyle=gx;g.fillRect(0,0,W*1.6,H*.09);g.restore()});
  FX.lf.forEach(o=>{o.t+=dt;o.x+=(o.vx+Math.sin(o.t*1.6+o.o)*14)*dt/W;o.y+=o.vy*dt/H;if(o.y>1.05||o.x>1.1){o.y=-.05;o.x=Math.random()*.9-.1}g.fillStyle=o.c;const fl=Math.sin(o.t*5+o.o)>0?3:2;g.fillRect((o.x*W)|0,(o.y*H)|0,fl,2)});
  FX.ff.forEach(o=>{o.t+=dt;o.x+=Math.sin(o.t*.6+o.o)*.02*dt;o.y+=Math.cos(o.t*.5+o.o*2)*.02*dt;if(o.x<0||o.x>1)o.x=.5;if(o.y<.45||o.y>.98)o.y=.75;const a=.5+.5*Math.sin(o.t*2.2+o.o);if(a>.2){const x=(o.x*W)|0,y=(o.y*H)|0;g.fillStyle='rgba(255,236,130,'+(a*.18).toFixed(2)+')';g.fillRect(x-2,y-2,5,5);g.fillStyle='rgba(255,246,170,'+a.toFixed(2)+')';g.fillRect(x,y,1,1)}});
  FX.st=FX.st.filter(o=>{o.l+=dt;o.x+=o.vx*dt;o.y+=o.vy*dt;const f=1-o.l/o.L;if(f<=0)return false;
   for(let i=0;i<14;i++){const q=i/14,a=(1-q)*f;g.fillStyle='rgba('+(i<2?'255,250,225':'255,226,160')+','+a.toFixed(2)+')';const s=i<3?2:1;g.fillRect((o.x-o.vx*dt*i*1.6)|0,(o.y-o.vy*dt*i*1.6)|0,s,s)}return true});
  FX.du.forEach(d=>{d.a+=dt*.5;d.w+=dt*1.4;d.x+=(Math.sin(d.a)*.006+d.v*.4)*dt*3;d.y-=d.v*dt*2;if(d.y<-.02){d.y=1.02;d.x=Math.random()}if(d.x>1.02)d.x=-.02;if(d.x<-.02)d.x=1.02;
   g.fillStyle='rgba(255,226,170,'+(.12+.28*(.5+.5*Math.sin(d.w))).toFixed(2)+')';g.fillRect((d.x*W)|0,(d.y*H)|0,d.s>>1||1,d.s>>1||1)})}
 requestAnimationFrame(bgfx)}
/* itens do painel: mostra o nível exigido no detalhe */
{const _br=bagRefresh;bagRefresh=function(){_br();{const it=invSel&&ITEMS[invSel],dt=document.querySelector('#ivDet .dt'),P=it&&it.passiva;if(P&&P.k==='drena'&&dt&&!dt.querySelector('.dpas')){const bt=dt.querySelector('.dbt'),h='<div class="dsp dpas">🦈 <b>Passiva: Drenar chakra</b> — '+drenoTxt(P)+'.</div>';if(bt)bt.insertAdjacentHTML('beforebegin',h);else dt.insertAdjacentHTML('beforeend',h)}}{const id=invSel,it=id&&ITEMS[id],dn=document.querySelector('#ivDet .dn');if(it&&it.nivel>1&&dn&&!dn.nextElementSibling?.classList.contains('dnv'))dn.insertAdjacentHTML('afterend','<div class="dnv'+((CH.lv|0)<it.nivel?' lk':'')+'">'+((CH.lv|0)<it.nivel?'🔒 ':'')+'Precisa do Nv '+it.nivel+'</div>')}}}
(function(){
 const goOff=$('#go1').onclick;
 $('#goOff').onclick=()=>{ONL.on=false;$('#err').textContent='';goOff()};
 if(!ONL.ok){$('#goNew').hidden=true;$('#goOff').hidden=true;$('#s-login .m').textContent='Protótipo jogável (modo offline).';return}
 $('#goOff').hidden=true;
 $('#go1').onclick=onlEnter;$('#goNew').onclick=onlCreate;
 try{localStorage.removeItem(ONL_SESS)}catch(_){} // sessão antiga (antes do "manter conectado")
 const lgTab=nw=>{$('#tabIn').classList.toggle('on',!nw);$('#tabNew').classList.toggle('on',nw);$('#fIn').hidden=nw;$('#fNew').hidden=!nw;$('#err').textContent=''};
 $('#tabIn').onclick=()=>lgTab(false);$('#tabNew').onclick=()=>lgTab(true);
 document.querySelectorAll('#s-login .eye').forEach(b=>b.onclick=()=>{const i=$('#'+b.dataset.for),v=i.type==='password';i.type=v?'text':'password';b.textContent=v?'ocultar':'mostrar'});
 const hint=(id,ok,txt)=>{const h=$(id);h.textContent=txt;h.className=ok==null?'':ok?'ok':'bad'};
 $('#nu').oninput=()=>{const n=$('#nu').value.trim();hint('#lgHu',n?okUser(n):null,!n?'3 a 14 letras, números ou _':okUser(n)?'✓ Nome válido':'Use de 3 a 14 letras, números ou _ (sem espaço)')};
 $('#np').oninput=()=>{const l=$('#np').value.length;hint('#lgHp',l?l>=8:null,!l?'Mínimo de 8 caracteres':l>=8?'✓ Senha boa':'Faltam '+(8-l)+' caractere'+(8-l>1?'s':''))};
 $('#keep').onchange=()=>{if(!$('#keep').checked)keepSet('')};
 const kp=keepGet();if(kp){$('#u').value=kp.u;$('#p').value=kp.p;$('#keep').checked=true}
 // trocar de vila fica só para admin por enquanto
 const mb=$('#mapbtn'),mbo=mb.onclick;mb.onclick=()=>{if(!ONL.on||ONL.adm)mbo();else toast('🗺️ As outras vilas ainda estão fechadas. Em breve!')};
 $('#chatbtn').onclick=()=>chatOpen($('#chatp').hidden);$('#chatX').onclick=()=>chatOpen(false);
 $('#tabC').onclick=()=>chatOpen(true,'c');$('#tabR').onclick=()=>chatOpen(true,'r');
 document.querySelectorAll('#cpIn .chs button').forEach(b=>b.onclick=()=>{ONL.chatCh=b.dataset.ch;chatDraw();$('#chatin').focus()});
 $('#chatgo').onclick=onlChatSend;$('#chatin').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')onlChatSend();if(e.key==='Escape')chatOpen(false)});
 $('#chatin').addEventListener('keyup',e=>e.stopPropagation());
 $('#grpbtn').onclick=()=>{$('#grp').hidden=false;grpDraw()};$('#grpX').onclick=()=>{$('#grp').hidden=true};
 $('#grpLeave').onclick=()=>gsSend({t:'pleave'});
 $('#tinvOk').onclick=()=>{if(tInvQ)gsSend({t:'tacc',from:tInvQ.from});$('#tinvp').hidden=true;tInvQ=null};
 $('#tinvNo').onclick=()=>{if(tInvQ)gsSend({t:'tdec',from:tInvQ.from});$('#tinvp').hidden=true;tInvQ=null};
 $('#tdX').onclick=()=>gsSend({t:'tcancel'});
 $('#tdOk').onclick=()=>{const T=ONL.trade;if(!T)return;gsSend({t:!T.ok[0]?'tlock':'tconf'})};
 {const g0=$('#ivGive').onclick,r0=$('#ivReset').onclick;$('#ivGive').onclick=()=>{if(ONL.on&&ONL.inv)gsSend({t:'admitem'});else g0()};$('#ivReset').onclick=()=>{if(ONL.on&&ONL.inv)gsSend({t:'admreset'});else r0()}}
 $('#pinvOk').onclick=()=>{if(gsInvQ)gsSend({t:'pacc',from:gsInvQ.from});$('#pinv').hidden=true;gsInvQ=null};
 $('#pinvNo').onclick=()=>{if(gsInvQ)gsSend({t:'pdec',from:gsInvQ.from});$('#pinv').hidden=true;gsInvQ=null};
 $('#netblock button').onclick=()=>location.reload();
 $('#stOut').onclick=onlLogout;
 $('#bagSort').onclick=()=>{INV.sort((a,b)=>{const A=ITEMS[a],B=ITEMS[b];return (RAR_ORD[A.rarity]??9)-(RAR_ORD[B.rarity]??9)||String(A.name).localeCompare(B.name)});invSave();bagRefresh()};
 $('#tbCh').onclick=()=>setPanel('ch');$('#tbJu').onclick=()=>setPanel('ju');
 // abriu até aqui sem erro: o carregador pode confiar nesta versão
 try{if(OTA.v){localStorage.setItem('so-ota-ok',String(OTA.v));localStorage.setItem('so-ota-fail','0')}}catch(_){}
 {const lv=$('#lgVer');if(lv)lv.textContent='Versão '+otaVerTxt(OTA.v)}
 {const ob=$('#otabar');document.body.appendChild(ob);ob.querySelector('button').onclick=otaApply} // aparece em qualquer tela
 if(OTA.app){otaGate();setInterval(otaCheck,20*60*1000)}})();
//ONLINE-END
