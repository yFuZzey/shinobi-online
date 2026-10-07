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
 if(/not confirmed|email_not_confirmed/i.test(m+c))return 'A conta precisa ser confirmada por e-mail. No Supabase, desligue "Confirm email" em Authentication.';
 if(/rate limit|over_email_send/i.test(m+c))return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
 if(/signups? (not allowed|disabled)/i.test(m+c))return 'Criação de contas está desligada no servidor.';
 if(/personagens|inventario|salvar_inventario|column/.test(m)&&/does not exist|relation|schema cache|could not find/i.test(m))return 'O banco de dados ainda não foi atualizado (falta rodar o SQL novo no Supabase).';
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
async function onlLoadChar(){const q=c=>onlFetch('/rest/v1/personagens?select='+COLS+c+',inventario(item,equipado)&id=eq.'+ONL.uid);let r=null;ONL.profDb=true;ONL.mgkDb=true;ONL.verDb=true;
 // colunas novas (proficiência: sql/03; Mangekyō: sql/06): se o banco ainda não tem, segue sem elas e guarda no aparelho
 for(let k=0;k<4;k++){try{r=await q((ONL.profDb?',proficiencia,prof_xp':'')+(ONL.mgkDb?',mangekyo':'')+(ONL.verDb?',versao':''));break}
  catch(e){const m=String(e.message);if(ONL.verDb&&/versao/.test(m))ONL.verDb=false;else if(ONL.mgkDb&&/mangekyo/.test(m))ONL.mgkDb=false;else if(ONL.profDb&&/proficiencia|prof_xp/.test(m))ONL.profDb=false;else throw e}}
 return r&&r[0]||null}
// uma informação por coluna (dá para editar cada uma no banco)
function onlCols(){const c={cla:clan,nivel:CH.lv,xp:CH.xp,pontos:CH.pts,forca:CH.st.str,agilidade:CH.st.agi,vitalidade:CH.st.vit,inteligencia:CH.st.int,destreza:CH.st.dex,sorte:CH.st.luk,mapa:CURMAP,pele:look.skin,cabelo:look.hair,roupa:look.cloth};
 if(ONL.profDb){const P=CH.prof||{};c.proficiencia=P.k||null;c.prof_xp=P.k?P.xp|0:0}if(ONL.mgkDb)c.mangekyo=EYES[CH.mgk]?CH.mgk:null;if(ONL.verDb)c.versao=Math.max(1,CH.v|0);return c}
function onlInv(){return INV.map(i=>({item:i,equipado:false})).concat(Object.values(EQ).map(i=>({item:i,equipado:true})))}
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
function onlMeta(){let d={esq:0,red:0};try{d=D()}catch(_){}return {clan,lv:CH.lv,eq:Object.values(EQ),look:{skin:look.skin,hair:look.hair,cloth:look.cloth},esq:Math.round(d.esq*10)/10,red:Math.round(d.red*10)/10,ey:EYE.on==='mgk'?2:EYE.on?1:0}}
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
 // grande: Susanoo — só com a Mangekyō ligada (cada olho tem o seu)
 U[2]={n:'Susanoo',ic:sus.ic,t:'sus',col:'#b3122e',cd:24,mp:40}}}
// ===== Equilíbrio dos golpes pelo rank do jutsu (E, D, C, B, A, S — como na obra) =====
// cada rank tem dano base, chakra e recarga; o papel ajusta o dano: f = 1 (dano), 0,8 (área), 0,3–0,4 (controle/atordoar)
const JRK=BAL.golpes.ranks; // balanceamento.json → golpes.ranks
// ===== Catálogo de jutsus de cada clã (balanceamento.json → golpes.jutsus) e a barra de botões (golpes.barra) =====
// JU[clã][id] = o jutsu (no formato que o jogo usa para soltar). Os 3 de hoje vêm de CLANS; os novos são definidos mais abaixo.
const JU={};
function juApply(s,b){const R=JRK[b.r]||{dmg:0,mp:0,cd:1};s.rk=b.r;s.dmg=Math.round((R.dmg||0)*(+b.f||0));s.mp=b.mp!=null?+b.mp:R.mp;s.cd=b.cd!=null?+b.cd:R.cd;s.mpPct=+b.mpPct||0;
 if(b.tel!=null)s.tel=+b.tel;if(b.stun!=null)s.stun=+b.stun;['queima','root','canal','alvos','ccPvp','tipo','papel','lv'].forEach(k=>{if(b[k]!=null)s[k]=b[k]});return s}
for(const c in BAL.golpes.barra){JU[c]={};BAL.golpes.barra[c].forEach((id,i)=>{const s=CLANS[c]&&CLANS[c].sk[i];if(s){s.id=id;JU[c][id]=s}})}
function juLoad(c,id,def){const b=(BAL.golpes.jutsus[c]||{})[id];if(!b)return null;const s=JU[c][id]||(JU[c][id]=Object.assign({id},def||{}));return juApply(s,b)}
for(const c in BAL.golpes.jutsus)if(c[0]!=='_')for(const id in BAL.golpes.jutsus[c])if(id[0]!=='_'&&JU[c]&&JU[c][id])juLoad(c,id);
const juLv=s=>s&&s.lv?+s.lv:1;
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
const PROF_AT_PCT={hp:1,mp:1,dmg:1,spd:1,mpr:1};const atSrc=k=>k==='pf'||k==='pc'?'dmg':k; // "dmg" da especialidade vale para os dois poderes
// retorno decrescente (balanceamento.json → personagem.retornoDecrescente): acima do início (80; VIT 90) cada ponto vale só a eficácia (50%)
function retDec(k,v){const R=BAL.personagem.retornoDecrescente,L=R&&R.inicio&&R.inicio[k];if(!(L>0)||v<=L)return v;return L+(v-L)*R.eficacia}
function calcChar(items,prof){const M=prof?profMods():null,A=items?AG:ZERO(),st={},S={},at={};
 for(const k of STK){const pts=CH.st[k],it=+A[k]||0,base=pts+it,pi=+A[k+'_pct']||0,pp=M?M.st[k]||0:0,pct=pi+pp;const bruto=clv(base*(1+pct/100),0,STMAX);S[k]=retDec(k,bruto);st[k]={pts,it,base,pi,pp,pct,bruto,fin:S[k],dr:S[k]<bruto}}
 for(const k in ATD){const d=ATD[k],q=atSrc(k),fromSt=d.f(S,at),fi=d.fx?+A[d.fx]||0:0,fp=M&&!PROF_AT_PCT[q]?M.at[q]||0:0,pi=d.pc?+A[d.pc]||0:0,pp=M&&PROF_AT_PCT[q]?M.at[q]||0:0,pct=pi+pp;
  at[k]={fromSt,fi,fp,fl:fi+fp,pi,pp,pct,fin:clv((fromSt+fi+fp)*(1+pct/100),d.lo==null?-1e9:d.lo,d.hi==null?1e9:d.hi)}}
 return{st,at}}
// formato usado pelo jogo: spd/mpr = bônus em % sobre o normal; pf/pc = poder somado aos golpes
const isChakra=tp=>tp==='ninjutsu'||tp==='genjutsu';
// esquiva: 5% + (minha Esquiva − Precisão de quem ataca), entre 0% e 35% (balanceamento.json → combate; o servidor usa a mesma conta)
let HPREC=0;const dodgeChance=prec=>clv(BAL.combate.esquivaBase+D().esq-(+prec||0),BAL.combate.esquivaMin,BAL.combate.esquivaMax);
function skPow(tp){const d=D();return isChakra(tp)?d.pc:d.pf}
// etapa 3: (dano da habilidade + poder do tipo) × bônus da especialidade, depois o crítico
let HMUL=1; // golpes contínuos (64 Palmas) dividem o dano entre os toques
// tipo do golpe: "@ninjutsu" = habilidade do item da mão (conta como Ninjutsu, mas não é jutsu do clã)
const tpN=t=>typeof t==='string'&&t[0]==='@'?t.slice(1):t;
function hitRaw(base,tp){const it=typeof tp==='string'&&tp[0]==='@',t=it?tp.slice(1):tp,b=bufSum();return (base+skPow(t))*profTypeMul(t)*HMUL*(1+b.dmg/100)*(it?1:1+b.cdmg/100)}
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
 const h=Object.entries(BUFS).filter(([k,b])=>b.until>n).map(([k,b])=>'<span'+(b.until===Infinity?' class="on"':'')+'>'+String(b.nm).split(':')[0].replace(/[<>&]/g,'')+(k==='sus'&&SHD?' 🛡'+Math.ceil(SHD.v):'')+' <b>'+(b.until===Infinity?'ligado':Math.ceil((b.until-n)/1000)+'s')+'</b></span>').join('')+ccChips();if(el._h!==h){el._h=h;el.innerHTML=h}}
function effSt(prof){const c=calcChar(1,prof),o={};for(const k of STK)o[k]=c.st[k].fin;return o}
const profReqOk=k=>Object.entries(PROF[k].req).every(([s,v])=>CH.st[s]>=v);
function profSkills(k){if(!clan||!JU[clan])return[];return Object.values(JU[clan]).filter(s=>s.tipo===k).map(s=>s.n).concat(k==='ninjutsu'&&atkItem()?[atkItem().name]:[])}
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
 P.k=k;P.xp=0;profPick=null;profSave();stats();onlReg('🎖️ Especialidade escolhida: '+PROF[k].n+' (rank E). Treine usando '+(profSkills(k).join(', ')||'golpes desse tipo')+'.')}
function profDraw(){const el=$('#stProf');if(!el||!CH)return;CH.prof=profNorm(CH.prof);const P=CH.prof,r=profRank();let h='';
 const lib=Object.keys(PROF).filter(profReqOk);if(!P.k&&lib.length&&!profDraw.told&&cur==='game'){profDraw.told=1;setTimeout(()=>{toast('🎖️ Você já pode escolher uma especialidade: '+lib.map(k=>PROF[k].n).join(', ')+' (aba Status).');onlReg('🎖️ Especialidade liberada: '+lib.map(k=>PROF[k].n).join(', ')+'. Escolha na aba Status, no fim da página.')},600)}
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
{const _c=cast;cast=function(i){if(actRoot())return;{const s=CLANS[clan]&&CLANS[clan].sk[i];if(s&&seloBloqueia(mpOf(i,s)))return seloAviso()}if(PST>0){if(!cast._t||performance.now()-cast._t>600){cast._t=performance.now();FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7})}return}
 const sk=CLANS[clan]&&CLANS[clan].sk[i],c0=cd[i];HTP=skType(i);try{_c(i)}finally{HTP=null}
 if(sk&&sk.buf&&cd[i]>c0)bufStart('sk'+i,sk.buf,sk.aura)}} // só se o golpe saiu de verdade (entrou em recarga)
const GMK=['x','y','hp','max','dead','dt','mv','fl','ch','lunge','ja','jz','jc','jx','jy','stun','hurt','rt','root'];
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
 e.sn=s;['hp','max','ch','lunge','ja','jc','jx','jy','stun','rt','root'].forEach(k=>e[k]=s[k]);if(s.hurt>(e.hurt||0))e.hurt=s.hurt;
 if(s.dead&&!wasDead){e.dead=1;e.dt=s.dt}else if(!s.dead&&wasDead){e.dead=0;e.dt=0}}
const MTIM=['lunge','ch','jc','ja','stun','hurt','root'];
function gsMobFollow(dt){const rt=performance.now()-IP.dm;
 for(const e of E){e.hit=Math.max(0,(e.hit||0)-dt);if(!e.sn)continue;if(e.dead){e.dt=(e.dt||0)+dt;continue}
  const r=ipAt(e,rt);if(r){e.x=r.x;e.y=r.y;e.jz=r.jz;e.fl=!!r.s.fl;e.mv=r.s.mv}
  for(const q of MTIM)if(e[q]>0)e[q]=Math.max(0,e[q]-dt)}}
// golpes do jogador vão para o servidor (ele decide a vida da raposa)
function gsHit(e,d,st,kx,ky){if(!ONL.on)return false;if(e.pvp)return pvpHit(e,d,st,kx,ky);if(!e.sid||e.dead||!ONL.joined)return true;
 const tp=tpN(HTP),pf=profOn(tp),base=d,x=hitRaw(d,HTP);if(pf&&st&&tp==='genjutsu')st*=1+profPerk()/100;
 lastCrit=Math.random()*100<D().crit||(pf&&tp==='bukijutsu'&&Math.random()*100<profPerk());d=Math.max(1,Math.round(lastCrit?x*BAL.combate.critMult:x));if(pf)profGain(base*HMUL);
 gsSend({t:'hit',m:e.sid,d,st:st||0,rt:HCC&&HCC.root||0,kx:+(kx||0).toFixed(1),ky:+(ky||0).toFixed(1),c:lastCrit?1:0,pr:Math.round(D().prec)});return true}
// ---------- PvP: quem não está no seu grupo pode ser atacado (menos na zona segura em volta do ponto de início) ----------
// quem bate calcula o golpe igual ao dos monstros; o servidor confere (mapa, distância, grupo, zona segura) e repassa;
// o alvo sorteia a esquiva (Esquiva dele x sua Precisão), aplica a redução e conta o resultado para todo mundo ver.
const PVP={on:1,safe:4};let PST=0,HRES={miss:0,d:0,dead:0},pvpTold=0;
// PRT = preso no lugar (não anda, mas usa golpes) · PSL = chakra selado (só jutsu que custa até seloLimite% do chakra) · SHD = escudo do Susanoo
let PRT=0,PSL=0,SHD=null,HCC=null; // HCC = efeito do golpe que está acertando agora (como HTP): {root, selo, queima, pj (projétil), semStunPvp}
function ccTick(dt){if(PRT>0)PRT=Math.max(0,PRT-dt);if(PSL>0)PSL=Math.max(0,PSL-dt);if(SHD&&SHD.until<=performance.now())SHD=null}
function ccChips(){const L=[];if(PRT>0)L.push('<span class="cc">Preso <b>'+Math.ceil(PRT)+'s</b></span>');if(PSL>0)L.push('<span class="cc">Chakra selado <b>'+Math.ceil(PSL)+'s</b></span>');return L.join('')}
function seloBloqueia(mp){return PSL>0&&mp>BAL.golpes.seloLimite/100*p.mpMax}
function seloAviso(){if(!seloAviso._t||performance.now()-seloAviso._t>700){seloAviso._t=performance.now();FT.push({x:p.x,y:p.y-70,t:'chakra selado',txt:1,life:.8})}}
// efeito recebido no PvP (o servidor confere e repassa)
function ccRecebe(cc,src){if(!cc||!cc.k)return;const t=+cc.t||0;
 if(cc.k==='root'&&t>0){PRT=Math.max(PRT,t);FT.push({x:p.x,y:p.y-70,t:'preso pela sombra',txt:1,life:1});onlReg('🌑 '+(src||'?')+' prendeu você no lugar ('+nf(t)+' s).')}
 else if(cc.k==='selo'&&t>0){PSL=Math.max(PSL,t);FT.push({x:p.x,y:p.y-70,t:'chakra selado',txt:1,life:1});onlReg('✋ '+(src||'?')+' selou o seu chakra ('+nf(t)+' s): só jutsus baratos.')}
 else if(cc.k==='queima'){const v=Math.min(p.mp,(+cc.v||0)/100*p.mpMax);if(v>0){p.mp-=v;FT.push({x:p.x+14,y:p.y-60,t:'−'+Math.round(v)+' chakra',txt:1,life:.8})}}}
// escudo: absorve dano antes da vida; quando quebra, o Susanoo se desfaz
function shieldAbsorb(n){if(!SHD||SHD.until<=performance.now()||SHD.v<=0)return n;const a=Math.min(n,SHD.v);SHD.v-=a;
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
  const o=pe._pv||(pe._pv={pvp:id,rad:16,boss:0,dead:0,kind:'pvp'});o.x=pe.x;o.y=pe.y;o.nome=pe.nome;L.push(o)}return L}
function pvpSafeMsg(pe){if(pe)FT.push({x:pe.x,y:pe.y-60,t:'zona segura',txt:1,life:.8});const now=performance.now();if(!pvpSafeMsg.t||now-pvpSafeMsg.t>6000){pvpSafeMsg.t=now;onlReg('🛡️ Zona segura: perto do ponto de início ninguém ataca nem é atacado.')}}
function pvpHit(e,d,st,kx,ky){const pe=ONL.peers[e.pvp];if(!pe||!ONL.joined)return true;
 if(pvpSafeAt(pe.x,pe.y)||pvpSafeAt(p.x,p.y)){pvpSafeMsg(pe);return true}
 const tp=tpN(HTP),pf=profOn(tp),x=hitRaw(d,HTP);if(pf&&st&&tp==='genjutsu')st*=1+profPerk()/100;
 lastCrit=Math.random()*100<D().crit||(pf&&tp==='bukijutsu'&&Math.random()*100<profPerk());
 const H=HCC||{},cc=H.root?{k:'root',t:+H.root}:H.selo?{k:'selo',t:+H.selo}:H.queima?{k:'queima',v:+H.queima}:null;if(H.semStunPvp)st=0;
 gsSend({t:'pvp',to:e.pvp,d:Math.max(1,Math.round(lastCrit?x*BAL.combate.critMult:x)),st:st||0,kx:+(kx||0).toFixed(1),ky:+(ky||0).toFixed(1),c:lastCrit?1:0,pr:Math.round(D().prec),pj:H.pj?1:0,cc:cc||undefined});pe.hitT=.12;return true}
function pvpShow(m){const pe=ONL.peers[m.to];if(m.safe){pvpSafeMsg(pe);return}
 if(m.to===ONL.uid||!pe||pe.sc!==(scene|0))return; // quem apanhou já viu o próprio número
 const me=m.by===ONL.uid,y=pe.y-60;
 if(m.blk){FT.push({x:pe.x,y,t:'defendeu',txt:1,life:.8});if(me)onlReg('🌀 '+pe.nome+' bloqueou com o Kaiten');return}
 if(m.miss){FT.push({x:pe.x,y,t:'esquivou',txt:1,life:.8});if(me)regMiss(pe.nome);return}
 pe.hitT=.18;FT.push({x:pe.x+(me?0:Math.random()*20-10),y,t:m.c?m.d+'!':m.d,life:me?.8:.7,crit:m.c,oth:me?0:1});if(me)regDmg('pout',m.d,m.c,pe.nome)}
function gsMsg(m){
 switch(m.t){
 case 'welcome':ONL.authed=true;ONL.uid=m.id;ONL.adm=!!m.adm;ONL.inv=!!m.inv;if(m.cfg){PVP.on=!!m.cfg.pvp;PVP.safe=+m.cfg.pvpSafe||0}document.body.classList.toggle('adm',ONL.adm);if(ONL.adm&&!m.inv&&m.invWhy&&!ONL.invWarn){ONL.invWarn=1;onlReg('⚠️ [ADM] Trocas desligadas: '+m.invWhy+'.')}if(ONL.welcomeCb){const f=ONL.welcomeCb;ONL.welcomeCb=null;f()}else if(cur==='game')gsJoin();onlStatus();break;
 case 'authfail':onlReg('⚠️ Falha ao entrar no servidor: '+m.msg);if(ONL.rtok)onlRefresh();break;
 case 'old':ONL.closing=true;
  if(m.v&&m.v<GS_PROTO){gsWait();break} // o servidor é que ainda está atualizando
  if(OTA.app){gsBlock('Atualizando o jogo…','Saiu uma versão nova. Baixando… o jogo reinicia sozinho.');otaCheck().then(ok=>{if(ok||OTA.ready)location.reload();else if(!m.v)gsWait();else gsBlock('Versão desatualizada','Não consegui baixar a versão nova agora. Verifique a internet e abra o jogo de novo.')})}
  else gsBlock('Versão desatualizada','Seu app está desatualizado. Baixe a versão nova do jogo no GitHub (Releases).');break;
 case 'banned':{ONL.closing=true;const at=m.ate?new Date(m.ate):null;
  gsBlock('Conta banida','Sua conta foi banida '+(at?'até '+at.toLocaleDateString('pt-BR')+' às '+at.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'por tempo indeterminado')+'.'+(m.motivo?' Motivo: '+m.motivo+'.':''));break}
 case 'kicked':ONL.closing=true;gsBlock('Desconectado',m.msg||'Sua conta entrou em outro aparelho.');break;
 case 'room':if(m.map!==CURMAP)break;ONL.joined=true;if(PVP.on&&!pvpTold){pvpTold=1;setTimeout(()=>onlReg('⚔️ PvP ligado: quem não está no seu grupo pode te atacar, e você também pode atacar. Perto do ponto de início é zona segura.'),800)}ONL.peers={};(m.players||[]).forEach(o=>onlPeer(o.id,o));E=[];(m.mobs||[]).forEach(x=>gsMobState(gsMob(x.def),x.s));ONL.mo=null;onlStatus();gsPos(true);break;
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
  if(m.fin)hurtFix(m.d,m.miss,m.c);else{HPREC=m.pr||0;hurt(m.d);HPREC=0}const R=HRES,src=m.src?' ('+m.src+')':'';
  if(pv&&R.dead)gsSend({t:'phr',by:pv,dead:1});
  if(R.dead){PST=0;onlReg('☠️ Você foi derrotado'+src+' e voltou para o início do mapa.');toast('☠️ Você foi derrotado'+(pv?' por '+m.src:'')+' e voltou para o início.');gsPos(true);break}
  if(R.miss)onlReg('💨 Você esquivou'+src);else regDmg('in',R.d,0,m.src);
  if(pv&&!R.miss&&m.st>0){PST=Math.max(PST,m.st);FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.9})}
  if(pv&&!R.miss&&m.cc)ccRecebe(m.cc,m.src);
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
 case 'fx':{const pe=ONL.peers[m.id];if(!pe||pe.sc!==(scene|0))break;(m.fx||[]).forEach(f=>{if(f.k==='act'){if(ACTS[f.a])pe.act={a:f.a,t0:performance.now(),root:ACTS[f.a].root||0};return}f.rm=1;f._s=1;f.pid=m.id;f.life=f.max||f.life||.5;if(f.k!=='kfx'||KSEQ[f.q])fx.push(f)});(m.pr||[]).forEach(b=>{b.rm=1;b._s=1;b.dmg=0;b.pid=m.id;P.push(b)});break}
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
 else if(m.k==='reset'){const e=E.find(x=>x.sid===m.m);if(e){e.x=m.x;e.y=m.y;e.jz=0;e.buf=null}fx.push({k:'ring',x:m.x,y:m.y-20,r:70,col:'#ffd27a',life:.6,max:.6,rm:1,_s:1});onlReg('🦊 A raposa voltou ao covil e recuperou toda a vida (ninguém por perto).')}
 else if(m.k==='spawn'){const e=E.find(x=>x.sid===m.m);if(e){e.x=m.x;e.y=m.y;e.dead=0;e.dt=0;e.buf=null}onlReg('🦊 A Raposa de Nove Caudas renasceu.')}}
function gsPos(force){const now=performance.now();if(!ONL.joined)return;
 const s=[p.x|0,p.y|0,p.fl?1:0,p.mv?1:0,p.run?1:0,scene|0,Math.round(p.hp),p.au>=0?1:0,p.th>=0?1:0].join(',');
 if(!force&&(now-ONL.lastPos<50||(s===ONL.lastSig&&now-ONL.lastPos<2000)))return;ONL.lastPos=now;ONL.lastSig=s;
 gsSend({t:'pos',c:Math.round(now),x:p.x|0,y:p.y|0,fl:p.fl?1:0,mv:p.mv?1:0,run:p.run?1:0,au:p.au>=0?+p.au.toFixed(2):-1,th:p.th>=0?+p.th.toFixed(2):-1,sc:scene|0,hp:Math.round(p.hp),max:p.max})}
const FXOK={ring:1,rimp:1,bolt:1,line:1,kfx:1,act:1,cone:1,sline:1,sarea:1};
// qualidade automática: se o aparelho não segura ~50 quadros por segundo, desenha com menos pixels (até 1,5x)
const PQ={acc:0,n:0,skip:2};
function perfTick(dt){if(document.hidden)return;PQ.acc+=dt;PQ.n++;if(PQ.acc<3)return;const avg=PQ.acc/PQ.n;PQ.acc=0;PQ.n=0;if(PQ.skip>0){PQ.skip--;return}
 const c=Math.min(window.DPRMAX||2,devicePixelRatio||1);if(avg>.021&&c>1.5){window.DPRMAX=Math.max(1.5,c-.25);rs()}}
function onlStep(dt){kfxStep(dt);if(!ONL.on)return;perfTick(dt);
 if(ONL.joined){const nf=[],np=[];
  for(const f of fx){if(f._s)continue;f._s=1;if(!f.rm&&FXOK[f.k||'line'])nf.push(Object.assign({},f,{_s:undefined}))}
  for(const b of P){if(b._s)continue;b._s=1;if(!b.rm)np.push({x:b.x|0,y:b.y|0,vx:b.vx|0,vy:b.vy|0,col:b.col,life:b.life,big:b.big,spin:b.spin,fire:b.fire})}
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
   if(HERO)drawHero(ctx,pe.x,pe.y,{fl:pe.fl,t:ts+id.length*97,mv:pe.mv,run:pe.run,aura:pe.au,th:pe.th,set:heroFor(pe.look),clan:pe.clan,act:pe.act&&actFrame(pe.act)?pe.act:null});else drawChar(ctx,pe.x,pe.y,{...(pe.look||look),clan:pe.clan,dir:0,t:ts,mv:pe.mv,run:pe.run});
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
function gsWait(){gsBlock('Servidor atualizando…','Saiu uma versão nova e o servidor está terminando de atualizar. Tentando de novo em 20 segundos…');
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
async function invReload(){if(!ONL.on||!ONL.uid)return;try{const rows=await onlFetch('/rest/v1/inventario?select=item,equipado&personagem_id=eq.'+ONL.uid);
 INV=[];EQ={};(rows||[]).forEach(r=>{const it=ITEMS[r.item];if(!it)return;if(r.equipado&&!EQ[it.slot])EQ[it.slot]=r.item;else INV.push(r.item)});
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
{const H=JU.hyuga;if(H){['palma','kaiten','hakke'].forEach(q=>{if(H[q]){H[q].kq=q;H[q].im=KFX.ic[q]}});if(H.kaiten)H.kaiten.stun=BAL.golpes.kaitenAtordoa}}
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
// cada Mangekyō tem o seu Susanoo (depois: Amaterasu, Tsukuyomi… também só com a Mangekyō ligada)
const EYES={
 itachi:{n:'Itachi',d:'Susanoo vermelho com escudo: o mais resistente. Empurra e atordoa quem está perto.',sus:BAL.olhos.susanoo.itachi},
 sasuke:{n:'Sasuke',d:'Susanoo roxo: as esferas giram em volta e cortam duas vezes. O mais ofensivo.',sus:BAL.olhos.susanoo.sasuke},
 madara:{n:'Madara',d:'Susanoo com armadura: descarga de chakra na maior área e empurra mais longe.',sus:BAL.olhos.susanoo.madara}};
// árvore: ramos com nós (sl = botão: 0 inicial, 1 meio, 2 grande). tm = estágio do olho
// árvore de cada clã: cada nó aponta para um jutsu do catálogo (j); os do olho do Uchiha são estágios do mesmo jutsu ("olho")
const JT={
 uchiha:[{b:'Katon (fogo)',n:[{id:'katon',j:'katon'}]},
  {b:'Sharingan → Mangekyō',n:[{id:'tm1',j:'olho',tm:1},{id:'tm2',j:'olho',tm:2},{id:'tm3',j:'olho',tm:3},{id:'mgk',j:'olho',tm:4}]},
  {b:'Técnicas da Mangekyō (só com ela ligada)',n:[{id:'sus',j:'sus'},{id:'amat',soon:1,nm:'Amaterasu',ic:'🔥'},{id:'tsuku',soon:1,nm:'Tsukuyomi',ic:'🌕'}]}],
 hyuga:[{b:'Punho Gentil (Jūken)',n:[{id:'palma',j:'palma'},{id:'kaiten',j:'kaiten'},{id:'hakke',j:'hakke'}]}],
 nara:[{b:'Ferramentas ninja',n:[{id:'shuri',j:'shuri'}]},{b:'Técnicas de sombra (Kagemane)',n:[{id:'sombra',j:'sombra'},{id:'poss',j:'poss'}]}]};
// nível de cada nó: olhos do Uchiha em olhos.tomoe, o resto no catálogo (balanceamento.json → golpes.jutsus)
for(const c in JT)JT[c].forEach(B=>B.n.forEach(n=>{if(n.soon)return;n.lv=n.tm?TOM[n.tm].lv:juLv(JU[c]&&JU[c][n.j])}));
const JTD={
 katon:'Katon: Gōkakyū no Jutsu. Faz os selos e solta uma grande bola de fogo pela boca, que explode ao acertar.',
 tm1:'O Sharingan desperta com 1 tomoe: enxerga o chakra e acompanha movimentos rápidos.',
 tm2:'2 tomoe: lê o corpo do oponente e prevê melhor os golpes.',
 tm3:'3 tomoe: o Sharingan completo. Prevê qualquer movimento e prende com o olhar.',
 mgk:'O Sharingan evolui para a Mangekyō e toma o lugar dele no botão do meio. Mais forte e mais cara de manter. Ligada, libera as técnicas da Mangekyō.',
 sus:'O guerreiro espectral do seu Mangekyō. Libera no Nv '+juLv(JU.uchiha.sus)+' e só pode ser invocado com a Mangekyō ligada; se ela desligar, ele se desfaz.',
 amat:'Em breve: chamas negras que não se apagam. Só com a Mangekyō ligada.',
 tsuku:'Em breve: a ilusão que prende o oponente num mundo onde o tempo para. Só com a Mangekyō ligada.',
 palma:'Jūken: golpe de palma que atinge os pontos de chakra.',
 kaiten:'Hakkeshō Kaiten: gira soltando chakra pelo corpo todo; empurra quem está perto e bloqueia golpes enquanto gira.',
 hakke:'Hakke Rokujūyon Shō: 64 golpes seguidos nos pontos de chakra; quem está perto fica preso, toma dano contínuo e é empurrado.',
 shuri:'Arremesso de shuriken.',
 sombra:'Kagemane no Jutsu: a sombra estica em linha e prende quem tocar.',
 poss:'A sombra se espalha em área e prende vários inimigos ao mesmo tempo.'};
const SLN=['1','2','grande','3'],TPN={ninjutsu:'Ninjutsu',genjutsu:'Genjutsu',taijutsu:'Taijutsu',bukijutsu:'Bukijutsu'};
// ícone da Mangekyō: o Sharingan sobre a explosão vermelha da folha dos Susanoo
let MGKIC=null;{const U=[null,JU.uchiha&&JU.uchiha.olho];if(U[1]&&SPR.ic&&SPR.ic[U[1].ic]){const a=new Image(),b=new Image();let n=0;
 const go=()=>{if(++n<2)return;try{const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');g.drawImage(b,0,0,96,96);g.drawImage(a,18,18,60,60);MGKIC=c.toDataURL();jtBtnTick.l=null}catch(_){}};
 a.onload=go;b.onload=go;a.src=SPR.ic[U[1].ic];b.src=SFXIC.exp}}
const skIcon=s=>s.imk?'<img src="'+SPR[s.imk]+'" style="image-rendering:auto">':s.im?'<img src="'+s.im+'" style="image-rendering:auto">':s.ic!=null&&SPR.ic&&SPR.ic[s.ic]?'<img src="'+SPR.ic[s.ic]+'">':'<span>'+(s.i||'❔')+'</span>';
const imgIc=u=>'<img src="'+u+'" style="image-rendering:auto">';
function eyeLv(){if(clan!=='uchiha'||!CH)return 0;const l=CH.lv|0;return l>=TOM[4].lv&&EYES[CH.mgk]?4:l>=TOM[3].lv?3:l>=TOM[2].lv?2:l>=TOM[1].lv?1:0}
const jtNodes=()=>(JT[clan]||[]).flatMap(b=>b.n);
function jtSlotLv(i){const s=clan&&CLANS[clan].sk[i];return s?(s.t==='eye'?TOM[1].lv:juLv(s)):1} // nível que libera o jutsu que está no botão
// o que cada botão mostra agora (nome, ícone, trava)
function jtBtn(i){const s=CLANS[clan].sk[i];if(!s)return{nm:'',ic:'',lk:null,eye:0};let nm=s.n,ic=skIcon(s),lk=null,eye=0;
 if(s.t==='eye'){const l=eyeLv();if(l===4){nm='Mangekyō';if(MGKIC)ic=imgIc(MGKIC)}else if(!l)lk=TOM[1].lv}
 else if(s.t==='sus'){const L2=juLv(s);if((CH.lv|0)<L2)lk=L2;else if(eyeLv()===4){if(SFXIC[CH.mgk])ic=imgIc(SFXIC[CH.mgk])}else eye=1}
 else if((CH.lv|0)<juLv(s))lk=juLv(s);
 return{nm,ic,lk,eye}}
const barSlots=()=>clan&&CLANS[clan].sk[3]?[0,1,2,3]:[0,1,2]; // botão 3 só é de jutsu se tiver um nele (senão é o do item)
function skBtns(){if(!clan||!CH)return;for(const i of barSlots()){const b=$('#b'+i);if(!b)continue;const o=jtBtn(i);b.classList.remove('empty');
  b.innerHTML=o.ic+o.nm+(o.lk?'<small class="lk">🔒 Nv '+o.lk+'</small>':o.eye?'<small class="lk">👁️ escolha</small>':'')+'<div class="cd"></div>';b.classList.toggle('lock',!!(o.lk||o.eye))}}
// a cada quadro: travas, olho ligado, Susanoo só com a Mangekyō; e avisa quando um jutsu novo libera
function jtBtnTick(){if(!clan||!CH)return;const key=CH.lv+'|'+CH.mgk+'|'+eyeLv()+'|'+(MGKIC?1:0);
 if(jtBtnTick.l!==key){if(jtBtnTick.lv!=null&&CH.lv>jtBtnTick.lv)jtLvUp(jtBtnTick.lv,CH.lv);jtBtnTick.l=key;jtBtnTick.lv=CH.lv;skBtns();const pj=$('#paneJu');if(pj&&!pj.hidden)juDraw()}
 for(const i of barSlots()){const b=$('#b'+i),s=CLANS[clan].sk[i];if(!b||!s)continue;if(b.classList.contains('lock'))b.classList.add('off');
  if(s.t==='eye'){b.classList.toggle('eyeon',!!EYE.on);if(EYE.on)b.classList.remove('off')}
  else if(s.t==='sus'){b.classList.toggle('eyeon',susOn());if(EYE.on!=='mgk')b.classList.add('off')}}}
function jtLvUp(a,b){const L=jtNodes().filter(n=>!n.soon&&n.lv>a&&n.lv<=b);L.forEach(n=>{const nm=jtInfo(n).nm;toast('🌀 Novo jutsu: '+nm+'!');onlReg('🌀 Jutsu liberado no Nv '+n.lv+': '+nm+'. Veja na aba Jutsus.')});
 if(clan==='uchiha'&&a<TOM[4].lv&&b>=TOM[4].lv&&!CH.mgk)setTimeout(()=>{if(CH.mgk)return; // já escolheu nesse meio-tempo
 toast('👁️ A Mangekyō liberou: escolha o seu olho na aba Jutsus.');onlReg('👁️ Mangekyō liberada: escolha Itachi, Sasuke ou Madara na aba Jutsus. Cada uma tem o seu Susanoo (libera no Nv '+juLv(JU.uchiha.sus)+').')},L.length?2600:0)}
// travado: explica; Uchiha: botão do meio liga/desliga o olho, botão grande invoca o Susanoo
{const _u=useBtn;useBtn=function(i){const s=clan&&CH&&CLANS[clan].sk[i];if(s){const o=jtBtn(i);
  if(o.eye){toast('👁️ Escolha o seu Mangekyō na aba Jutsus para liberar o Susanoo.');juSel='mgk';juPick=null;toggleBag(true,'ju');return}
  if(o.lk){toast('🔒 '+o.nm+' libera no Nv '+o.lk+'. A árvore está na aba Jutsus.');return}
  if(s.t==='eye')return eyeToggle(i);if(s.t==='sus')return susPress(i)}
 return _u(i)}}
// ---------- Sharingan / Mangekyō: liga e desliga, gasta chakra por segundo (o chakra não volta enquanto estiver ligado) ----------
const EYE={on:null,lv:0};
const eyeOnAny=()=>!!EYE.on;
const sevMul=esq=>Math.max(BAL.combate.olharMinimo,Math.min(1,1-(+esq||0)/100)); // quanto mais esquiva o alvo tem, menos tempo fica preso
function eyeToggle(i){i=i==null?barSlots().find(k=>CLANS[clan].sk[k]&&CLANS[clan].sk[k].t==='eye'):i;if(EYE.on)return eyeOff();const l=eyeLv();if(i==null||!l||cd[i]>0||actRoot())return;
 if(PST>0){FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7});return}
 const D=TOM[l],mp=Math.round(D.mp*profMp(i));if(seloBloqueia(mp))return seloAviso();if(p.mp<mp){FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}
 p.mp-=mp;EYE.on=D.k;EYE.lv=l;EYE.slot=i;EYE.t0=performance.now();const nm=D.k==='mgk'?'Mangekyō':'Sharingan';
 BUFS.eye={prec:D.prec,esq:D.esq,cdmg:D.cdmg,until:Infinity,nm};stats();bufHud(1);p.au=0;p.aud=.7;
 if(D.k==='mgk'){flash={col:'#4a000c',a:.45};shk=Math.max(shk,.4);kfxAdd({q:'mgk',x:p.x,y:p.y,fol:1,sc:1.2})}else flash={col:'#8a0010',a:.2};
 const n=gaze(D);FT.push({x:p.x,y:p.y-80,t:nm+'!',txt:1,gold:1,life:1.1});
 onlReg('👁️ '+D.n+' ligado'+(n?' (prendeu '+n+' com o olhar)':'')+': +'+D.prec+' de precisão, +'+D.esq+' de esquiva e +'+D.cdmg+'% de dano nos jutsus do clã. Gasta '+eyeDrTxt(D)+' de chakra por segundo'+(D.max?' e fica no máximo '+D.max+' s ligado':'')+'; toque de novo para desligar.');
 skBtns();gsMeta()}
function eyeOff(why){if(!EYE.on)return;const was=EYE.on;EYE.on=null;delete BUFS.eye;susEnd();
 const k=EYE.slot!=null&&CLANS[clan].sk[EYE.slot]&&CLANS[clan].sk[EYE.slot].t==='eye'?EYE.slot:barSlots().find(q=>CLANS[clan].sk[q]&&CLANS[clan].sk[q].t==='eye');
 if(k!=null){const c=cdOf(k,CLANS[clan].sk[k]);cd[k]=Math.max(cd[k],was==='mgk'?c*BAL.olhos.mangekyoRecarga:c)}stats();bufHud(1);skBtns();gsMeta();
 if(why){FT.push({x:p.x,y:p.y-70,t:why,txt:1,life:1});onlReg('👁️ '+(was==='mgk'?'Mangekyō':'Sharingan')+' desligou: '+why+'.')}}
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
function pstunMsg(m){const st=+m.st||0;if(!(st>0))return;PST=Math.max(PST,st);FT.push({x:p.x,y:p.y-70,t:'paralisado '+nf(st)+'s',txt:1,life:1.1});flash={col:'#5a0010',a:.3};onlReg('👁️ '+(m.src||'?')+' prendeu você com o olhar ('+nf(st)+' s).')}
{const g=gsMsg;gsMsg=function(m){if(m&&m.t==='gz')return gzMsg(m);if(m&&m.t==='pstun')return pstunMsg(m);return g(m)}}
// brilho vermelho nos olhos (o seu e o dos outros jogadores); Mangekyō com faíscas da folha
function eyeL(L){if(scene|0)return;if(EYE.on&&clan==='uchiha')L.push({y:p.y+.3,d:()=>eyeDraw(p,EYE.on==='mgk'?2:1)});
 if(ONL.on)for(const id in ONL.peers){const pe=ONL.peers[id];if(pe.ey&&pe.x!=null&&pe.sc===(scene|0))L.push({y:pe.y+.3,d:()=>eyeDraw(pe,pe.ey)})}}
function eyeDraw(o,lv){const t=performance.now()/1000,hx=o.x+(o.fl?-3:3),hy=o.y-43;ctx.save();ctx.globalCompositeOperation='lighter';
 const r=(lv>1?8:6)+Math.sin(t*6)*1.2,g=ctx.createRadialGradient(hx,hy,0,hx,hy,r);g.addColorStop(0,'rgba(255,50,50,.95)');g.addColorStop(.45,'rgba(220,20,30,.55)');g.addColorStop(1,'rgba(160,0,10,0)');
 ctx.fillStyle=g;ctx.beginPath();ctx.arc(hx,hy,r,0,7);ctx.fill();ctx.restore();
 if(lv>1&&SFX_OK){const F=SFX.f.pt1,fr=F[(t/.12|0)%F.length],sc=(SFX.s.pt1||1)*.85,[sx,sy,w,h,gx,gy]=fr;ctx.save();ctx.globalAlpha=.6;ctx.drawImage(SIMG,sx,sy,w,h,o.x-gx*sc,o.y-gy*sc,w*sc,h*sc);ctx.restore()}}
// ---------- Susanoo do seu Mangekyō: surge em volta do ninja, ataca em área e fica de pé dando o reforço ----------
let SUS=null;const susOn=()=>!!(SUS&&SUS.until>performance.now());
function susPress(i){i=i==null?barSlots().find(k=>CLANS[clan].sk[k]&&CLANS[clan].sk[k].t==='sus'):i;const sk=i!=null&&CLANS[clan].sk[i];if(!sk||eyeLv()<4||(CH.lv|0)<juLv(sk))return;if(EYE.on!=='mgk'){toast('O Susanoo só pode ser invocado com a Mangekyō ligada.');return}
 if(susOn()||cd[i]>0||actRoot())return;if(PST>0){FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7});return}
 const mp=mpOf(i,sk);if(seloBloqueia(mp))return seloAviso();if(p.mp<mp){FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}
 cd[i]=cdOf(i,sk);p.mp-=mp;HTP=sk.tipo||'ninjutsu';try{castSus(EYES[CH.mgk].sus)}finally{HTP=null}}
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
{const _h=hurt;hurt=function(n){_h(n);if(HRES&&HRES.dead){eyeOff();susEnd();bufClear()}}}
// começo de cada partida
function jtStart(){EYE.on=null;SUS=null;BUFS={};jtBtnTick.l=null;jtBtnTick.lv=CH?CH.lv:null;barLoad();skBtns();bufHud(1)}
// ---------- barra de jutsus: botões 0 e 1 e o 3 (no lugar do item) escolhidos pelo jogador; o grande (2) só para ultimate ----------
let BAR=null;const barKey=()=>'shinobi-barra-'+String(name).toLowerCase();
const barDefault=()=>(BAL.golpes.barra[clan]||[]).concat(['item']);
const barOkEm=(id,i)=>{const s=JU[clan]&&JU[clan][id];if(!s)return i===3&&id==='item';return i===2?s.papel==='ult':s.papel!=='ult'};
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
 if(EYE.on)eyeOff();if(susOn())susEnd();const t=performance.now();BAR.forEach((x,k)=>{JCD[x]=Math.max(JCD[x]||0,t+(cd[k]||0)*1000)});
 if(j>=0&&j!==i)BAR[j]=BAR[i];BAR[i]=id;BAR.forEach((x,k)=>{cd[k]=Math.max(0,((JCD[x]||0)-t)/1000)});barSave();barApply();return true}
// ---------- aba Jutsus ----------
let juSel=null,juPick=null;
function jtInfo(n){const s=n.j&&JU[clan]?JU[clan][n.j]:null;let nm=n.nm||(s&&s.n)||n.id,sub='',ic=s?skIcon(s):'<span>'+(n.ic||'❔')+'</span>';
 if(n.tm){if(n.tm===4){nm='Mangekyō';if(MGKIC)ic=imgIc(MGKIC);sub=CH.mgk&&EYES[CH.mgk]?'de '+EYES[CH.mgk].n:''}else{nm='Sharingan';sub=n.tm+' tomoe'}}
 if(n.id==='sus'&&EYES[CH.mgk]&&SFXIC[CH.mgk]){ic=imgIc(SFXIC[CH.mgk]);sub='de '+EYES[CH.mgk].n}
 const ok=!n.soon&&(CH.lv|0)>=n.lv,cur=n.tm?(n.tm===eyeLv()):false,needEye=ok&&(n.id==='mgk'||n.id==='sus')&&!EYES[CH.mgk];
 return{nm,sub,ic,ok,cur,needEye,st:n.soon?'soon':!ok?'lock':needEye?'pick':'ok'}}
function juStats(n){const L=[],J=JU[clan]||{},bi=id=>BAR?BAR.indexOf(id):-1,sl=id=>{const k=bi(id);return k>=0?k:(J[id]&&J[id].papel==='ult'?2:1)};
 if(n.tm){const D=TOM[n.tm];L.push('Ao ligar: o olhar paralisa quem estiver num cone de '+nf(D.cone)+' tiles à frente por '+nf(D.st)+' s (menos tempo quanto mais esquiva o alvo tiver; chefes, metade).');
  L.push('Ligado: +'+D.prec+' de precisão, +'+D.esq+' de esquiva e +'+D.cdmg+'% de dano nos jutsus do clã.');
  L.push('Gasto: '+D.mp+' de chakra para ligar e '+eyeDrTxt(D)+' por segundo'+(D.max?'; fica no máximo '+D.max+' s ligado':'')+'; o chakra não se recupera enquanto estiver ligado. Toque de novo para desligar (recarga de '+nf(cdOf(sl('olho'),J.olho)*(D.k==='mgk'?BAL.olhos.mangekyoRecarga:1))+' s depois).');
  if(n.tm===4)L.push('Libera as técnicas da Mangekyō: o Susanoo no Nv '+juLv(J.sus)+' (depois Amaterasu, Tsukuyomi…).');return L}
 if(n.id==='sus'){const E2=EYES[CH.mgk],sk=J.sus;L.push('Invocar: '+mpOf(sl('sus'),sk)+' de chakra, recarga de '+nf(cdOf(sl('sus'),sk))+' s'+(SUSDR?'; enquanto está de pé, gasta +'+SUSDR+' de chakra por segundo':'')+'.');
  if(E2){const A=E2.sus;L.push('Ao surgir: '+A.dmg+' de dano em área'+(A.hits>1?' ('+A.hits+' vezes)':'')+(A.stun?' e atordoa '+nf(A.stun)+' s':'')+'.');L.push(A.t+' s de pé: escudo de '+(+A.escudo||0)+'% da vida'+(A.dmgb?' e +'+A.dmgb+'% de dano':'')+'; '+(+BAL.olhos.susanooLento||0)+'% mais lento e sem recuperar vida; quebrou o escudo, ele se desfaz.')}
  else L.push('Cada Mangekyō tem o seu: escolha o olho no nó da Mangekyō.');return L}
 if(n.soon)return L;const s=J[n.j];if(!s)return L;const k=sl(n.j);
 L.push((s.dmg?'Dano base '+s.dmg+' · ':'')+'Chakra '+mpOf(k,s)+' · Recarga '+nf(cdOf(k,s))+' s'+(s.tel?' · Aviso '+nf(s.tel)+' s':'')+(s.stun?' · Atordoa '+nf(s.stun)+' s':'')+(s.root?' · Prende '+nf(s.root)+' s'+(s.alvos?' (até '+s.alvos+' alvos)':''):'')+(s.ccPvp&&s.ccPvp.k==='selo'?' · Sela o chakra '+nf(s.ccPvp.t)+' s (PvP)':'')+(s.queima?' · Queima '+s.queima+'% do chakra (PvP)':'')+(s.r?' · Área '+nf(s.r/T)+' tiles':''));return L}
function juDraw(){const el=$('#paneJu');if(!el||el.hidden||!clan||!CH)return;const all=jtNodes();if(!juSel||!all.some(n=>n.id===juSel))juSel=(all.find(n=>jtInfo(n).cur)||all[0]).id;
 let h='<p class="pfd">Clã <b>'+CLANS[clan].n+'</b> · Nv '+CH.lv+'. Os jutsus liberam com o nível. Toque num jutsu para ver os detalhes e escolher em que botão ele fica.</p>'+juBarHtml()+'<div class="jgrid"><div class="jtree">';
 for(const B of JT[clan]){h+='<div class="jbr"><div class="jbt">'+B.b+'</div><div class="jrow">'+B.n.map((n,k)=>{const I=jtInfo(n);
   return (k?'<i class="jar">›</i>':'')+'<button class="jn '+I.st+(I.cur?' cur':'')+(juSel===n.id?' sel':'')+'" data-j="'+n.id+'"><span class="ji">'+I.ic+'</span><b>'+I.nm+'</b><small>'+(I.sub?I.sub+' · ':'')+(n.soon?'em breve':I.ok?(I.needEye?'escolha o olho':'✓ Nv '+n.lv):'🔒 Nv '+n.lv)+'</small></button>'}).join('')+'</div></div>'}
 const n=all.find(x=>x.id===juSel),I=jtInfo(n),br=JT[clan].find(B=>B.n.includes(n)),js=n.j&&JU[clan][n.j],tp=js&&js.tipo||null,bk=BAR&&n.j?BAR.indexOf(n.j):-1;
 h+='</div><div class="jdet"><div class="jdh"><span class="ji">'+I.ic+'</span><div><b>'+I.nm+(I.sub?' <span class="z">'+I.sub+'</span>':'')+'</b><small>'+br.b.replace(/\s*\(.*\)/,'')+(js?' · '+(js.papel==='ult'?'ultimate':'jutsu')+(bk>=0?' no botão '+SLN[bk]:' fora da barra'):'')+(tp?' · '+(TPN[tp]||tp):'')+'</small></div><span class="jst '+I.st+'">'+(n.soon?'Em breve':!I.ok?'🔒 Nv '+n.lv:I.needEye?'Escolha o olho':'✓ Liberado')+'</span></div>'
  +'<p class="pfd">'+(JTD[n.id]||'')+'</p>'+(()=>{const L=juStats(n);return L.length?ulist(L,'up'):''})()+juBarBtns(n,js,I);
 if(n.id==='mgk'){const can=(CH.lv|0)>=TOM[4].lv;h+='<div class="pft pup">'+(CH.mgk?'Seu Mangekyō':'Escolha o seu Mangekyō')+(can?'':' <span>(libera no Nv '+TOM[4].lv+')</span>')+'</div><div class="pfg">';
  for(const k in EYES){const Y=EYES[k],A=Y.sus,cur=CH.mgk===k,conf=juPick===k;
   h+='<div class="pfo'+(cur?' cur':'')+(can?'':' lock')+'"><div class="pfh"><span class="pfi jey">'+imgIc(SFXIC[k])+'</span><div><b>Mangekyō de '+Y.n+'</b><small>'+Y.d+'</small></div></div>'
    +'<div class="pfq">Susanoo: '+A.dmg+' de dano em área'+(A.hits>1?' ('+A.hits+'×)':'')+(A.stun?', atordoa '+nf(A.stun)+' s':'')+' · '+A.t+' s de pé · escudo de '+(+A.escudo||0)+'% da vida'+(A.dmgb?' · +'+A.dmgb+'% de dano':'')+'</div>'
    +'<button data-eye="'+k+'"'+(can&&!cur?'':' disabled')+(conf?' class="conf"':'')+'>'+(cur?'Atual':!can?'Nv '+TOM[4].lv:conf?'Confirmar troca':'Escolher')+'</button></div>'}
  h+='</div>'+(CH.mgk?'<p class="chnote">Por enquanto dá para trocar aqui; depois a escolha vai ser feita numa missão.</p>':'')}
 h+='</div></div><div class="jadm admo">[ADM] Ir para o nível: '+[5,10,15,25,40,60].map(v=>'<button data-lv="'+v+'"'+(CH.lv>=v?' disabled':'')+'>'+v+'</button>').join('')+'</div>'+admClaHtml();
 el.innerHTML=h;admClaBind(el,juDraw);
 el.querySelectorAll('[data-j]').forEach(b=>b.onclick=()=>{juSel=b.dataset.j;juPick=null;juDraw()});
 el.querySelectorAll('[data-eye]').forEach(b=>b.onclick=()=>juEye(b.dataset.eye));
 el.querySelectorAll('[data-bar]').forEach(b=>b.onclick=()=>{const [i,id]=b.dataset.bar.split(':');if(!barSet(+i,id))toast('Não dá para pôr aí: '+(id==='item'?'o item fica no botão 3':'tire esse jutsu do outro botão primeiro')+'.');juDraw()});
 el.querySelectorAll('[data-bs]').forEach(b=>b.onclick=()=>{const id=BAR&&BAR[+b.dataset.bs];const n=id&&id!=='item'&&jtNodes().find(x=>x.j===id&&(!x.tm||x.tm===Math.max(1,eyeLv())));if(n){juSel=n.id;juDraw()}});
 el.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{const v=+b.dataset.lv;let g=0;while(CH.lv<v&&CH.lv<LVMAX&&g++<200)gainXp(xpNeed(CH.lv)-CH.xp);juDraw()})}
// barra (4 botões) no topo da aba Jutsus
function juBarHtml(){if(!BAR)return '';const ic=id=>{if(id==='item'){const it=atkItem();return it&&it.icon?imgIc(it.icon):'<span>✋</span>'}const s=JU[clan][id];return s?(s.t==='eye'&&eyeLv()===4&&MGKIC?imgIc(MGKIC):skIcon(s)):'<span>❔</span>'};
 const nm=id=>id==='item'?(atkItem()?atkItem().name:'Item da mão'):(JU[clan][id]||{}).n||id;
 return '<div class="jbar"><span class="jbl">Sua barra</span>'+[0,1,3,2].map(i=>'<button class="jbs'+(i===2?' big':'')+'" data-bs="'+i+'"><span class="ji">'+ic(BAR[i])+'</span><small>'+(i===2?'Grande':'Botão '+SLN[i])+'</small><b>'+String(nm(BAR[i])).replace(/[<>&]/g,'')+'</b></button>').join('')+'</div>'}
// botões "pôr no botão…" no detalhe de um jutsu liberado
function juBarBtns(n,js,I){if(!js||!BAR||!I.ok||n.soon)return '';const at=BAR.indexOf(js.id);
 if(js.papel==='ult')return '<div class="jbb">'+(at===2?'<span class="z">Está no botão grande.</span>':'<button data-bar="2:'+js.id+'">Usar no botão grande</button>')+'</div>';
 return '<div class="jbb"><span>Pôr no botão:</span>'+[0,1,3].map(i=>'<button data-bar="'+i+':'+js.id+'"'+(at===i?' disabled':'')+'>'+SLN[i]+(i===3?' (no lugar do item)':'')+'</button>').join('')+(BAR[3]!=='item'?'<button data-bar="3:item">Item de volta no 3</button>':'')+'</div>'}
function juEye(k){if(!EYES[k]||(CH.lv|0)<TOM[4].lv||CH.mgk===k)return;if(CH.mgk&&juPick!==k){juPick=k;return juDraw()}
 juPick=null;if(EYE.on)eyeOff();CH.mgk=k;chSave();toast('👁️ Mangekyō de '+EYES[k].n+' escolhida!');onlReg('👁️ Sua Mangekyō: '+EYES[k].n+'. Ela toma o lugar do Sharingan no botão do meio; ligada, o botão grande invoca o seu Susanoo a partir do Nv '+juLv(JU.uchiha.sus)+'.');skBtns();juDraw()}

// ---------- Hyuga de branco: parado (postura do Punho Gentil), andando, correndo e poses de golpe ----------
// poses (folha "hya"): 0 guarda · 1 preparo · 2 estocada da palma · 4 guarda · 5 postura das 64 Palmas · 6 giro · 7 agachado
// 8 concentração · 15/16 golpes com rastro · 18/19 rajada de braços · 20 palmas duplas
// root = o ninja fica parado durante a pose (Kaiten e 64 Palmas, como no anime); sem root, andar corta a pose na hora
const ACTS={fogo:{k:'uca',d:.4,s:[[8,.16],[12,.24]]},palma:{d:.3,s:[[1,.06],[2,.14],[0,.1]]},
 kaiten:{d:1,root:1,s:[[8,.1],[7,.1],['spin',.65],[4,.15]]},
 hakke:{d:1.06,root:1.06,s:[[5,.18],[15,.08],[16,.08],['flurry',.52],[20,.2]]}};
{const U=JU.uchiha.katon,H=JU.hyuga;const tf=U.tel||.16,tp=H.palma.tel||.06,th=Math.max(0,(H.hakke.tel||.26)-.26);
 ACTS.fogo.s[0][1]=tf;ACTS.fogo.d=tf+.24;ACTS.palma.s[0][1]=tp;ACTS.palma.d=tp+.24;ACTS.hakke.s[0][1]+=th;ACTS.hakke.d+=th;ACTS.hakke.root+=th}
let ACT=null,HHAND=null; // HHAND = onde está a mão da frente no quadro que acabou de ser desenhado (Chidori na mão)
const actEl=A=>(performance.now()-A.t0)/1000;
function actStart(a){const D=ACTS[a];if(!D)return;ACT={a,t0:performance.now(),root:D.root||0};fx.push({k:'act',a,life:.05,max:.05})}
function actRoot(){return !!(ACT&&ACT.root&&actEl(ACT)<ACT.root)}
const kaitenGuard=()=>!!(ACT&&ACT.a==='kaiten'&&actEl(ACT)<BAL.golpes.kaitenBloqueio); // girando: bloqueia os golpes recebidos
function actFrame(A){const D=A&&ACTS[A.a];if(!D)return null;const t=actEl(A);if(t>=D.d)return null;let acc=0;
 for(const [f,dt] of D.s){if(t<acc+dt){const lt=t-acc;if(f==='spin')return{i:6,flip:(lt/.07|0)%2};if(f==='flurry')return{i:(lt/.065|0)%2?19:18,flip:0};return{i:f,flip:0}}acc+=dt}return null}
{const _dh=drawHero;drawHero=function(c,x,y,o){
 const HS=o.set||HERO,cl=o.clan!==undefined?o.clan:(o.set?null:clan),A=o.act!==undefined?o.act:(o.set?null:ACT);
 let key=null,fr=0,flip=0;
 if(HS&&A&&(A.root||!o.mv)){const r=actFrame(A),k=(ACTS[A.a]||{}).k||'hya';if(r&&HS[k]){key=k;fr=r.i;flip=r.flip}}
 if(key===null&&cl==='hyuga'&&HS&&HS.hyw&&!(o.aura>=0)&&!(o.th>=0)){
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
   if(Math.hypot(dx-ax*pr,dy-ay*pr)<20+(e.rad||0)*.5){n++;hitE(e,s.dmg,ONL.on?+s.stun||0:Math.max(+s.stun||0,root),0,0)}})}finally{HTP=null;HCC=null}
  if(!n&&s.canal)PRT=0;else if(n)onlReg('🌑 Kagemane prendeu '+n+' alvo'+(n>1?'s':'')+' ('+nf(root)+' s).')}})}
// Kagemane múltiplo: a sombra se espalha em área por "tel" s e prende os "alvos" mais perto (no PvP o tempo é dividido entre os jogadores presos)
function castPoss(s,ax,ay){const tp=HTP,t=+s.tel||0,x0=p.x,y0=p.y,root=+s.root||0;
 fx.push({k:'sarea',x:x0,y:y0-4,r:s.r,col:'#120a22',life:t+.6,max:t+.6,tel:t});
 KDEL.push({t,fn:()=>{HTP=tp;try{const all=E.concat(PVT()).filter(e=>!e.dead&&Math.hypot(e.x-x0,e.y-y0)<s.r+(e.rad||0)*.6).sort((a,b)=>Math.hypot(a.x-x0,a.y-y0)-Math.hypot(b.x-x0,b.y-y0)).slice(0,+s.alvos||3);
   const np=all.filter(e=>e.pvp).length;all.forEach(e=>{const r=e.pvp?root/Math.max(1,np):root;HCC=r?{root:r}:null;hitE(e,s.dmg,ONL.on?+s.stun||0:Math.max(+s.stun||0,r),0,0);HCC=null});
   if(all.length){flash={col:s.col,a:.3};onlReg('🌑 Kagemane múltiplo prendeu '+all.length+' alvo'+(all.length>1?'s':'')+'.')}}finally{HTP=null;HCC=null}}})}
function shadowFxDraw(f){const el=f.max-f.life,g=f.tel>0?Math.min(1,el/f.tel):1,a=Math.min(1,f.life/.3);ctx.save();ctx.globalAlpha=.75*a;ctx.fillStyle=f.col;ctx.strokeStyle=f.col;
 if(f.k==='sline'){const L=f.len*g;ctx.lineCap='round';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+f.ax*L,f.y+f.ay*L);ctx.stroke();
  ctx.globalAlpha=.35*a;ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.x+f.ax*L,f.y+f.ay*L);ctx.stroke()}
 else{const r=f.r*g;ctx.globalAlpha=.28*a;ctx.beginPath();ctx.ellipse(f.x,f.y,r,r*.55,0,0,7);ctx.fill();ctx.globalAlpha=.7*a;ctx.lineWidth=3;ctx.setLineDash([10,6]);ctx.stroke()}ctx.restore()}
// Bola de Fogo (Uchiha): selo com as mãos, depois a bola sai da boca e explode ao acertar
function castFire(s,ax,ay){actStart('fogo');const tp=HTP;
 KDEL.push({t:s.tel||.16,fn:()=>{const l=Math.hypot(ax,ay)||1,ux=ax/l,uy=ay/l;P.push({x:p.x+ux*14,y:p.y-24,vx:ux*(s.sp||300),vy:uy*(s.sp||300),col:s.col,dmg:s.dmg,life:1.1,big:1,fire:1,tp})}})}
// bola de fogo de outro jogador: só visual, mas explode quando encosta em alguém (menos em quem soltou)
function fireRmHit(b){if(b.life>.98)return 0;
 for(const e of E)if(!e.dead&&Math.hypot(e.x-b.x,e.y-(e.boss?44:16)-b.y)<(e.rad||18))return 1;
 if(Math.hypot(p.x-b.x,p.y-24-b.y)<20)return 1;
 for(const id in ONL.peers){if(id===b.pid)continue;const q=ONL.peers[id];if(q.x==null||q.sc!==(scene|0))continue;if(Math.hypot(q.x-b.x,q.y-24-b.y)<20)return 1}return 0}
function fireBoom(b){fx.push({k:'boom',x:b.x,y:b.y,life:.4,max:.4,rm:1,_s:1});fx.push({k:'ring',x:b.x,y:b.y+6,r:26,col:'#ff8a2a',life:.3,max:.3,rm:1,_s:1})}
function fireDraw(b,ts){ctx.save();ctx.globalCompositeOperation='lighter';const l=Math.hypot(b.vx,b.vy)||1,ux=b.vx/l,uy=b.vy/l;
 for(let i=5;i>=0;i--){const x=b.x-ux*i*6+Math.sin(ts/40+i)*1.5,y=b.y-uy*i*6+Math.cos(ts/50+i)*1.5,r=Math.max(2,11-i*1.6);
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i?'rgba(255,170,60,.9)':'rgba(255,250,210,1)');g.addColorStop(.5,'rgba(255,110,20,'+(.85-i*.12)+')');g.addColorStop(1,'rgba(200,30,0,0)');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill()}ctx.restore()}

// ---------- botão do item da mão (Chidori, Rasengan…): vazio se o item não dá habilidade ----------
function itemBtn(){const b=$('#b3');if(!b||(clan&&CLANS[clan].sk[3]))return;const it=atkItem();b.classList.toggle('empty',!it);
 b.innerHTML=it?(it.icon?'<img src="'+it.icon+'" style="image-rendering:auto">':'<span>⚡</span>')+String(it.name).replace(/[<>&"]/g,'')+'<div class="cd"></div>':'<span class="ph">✋</span>Item<div class="cd"></div>'}
function itemBtnTick(){const b=$('#b3'),it=atkItem();if(!b||(clan&&CLANS[clan].sk[3]))return;if(!!it===b.classList.contains('empty'))itemBtn();const c=b.querySelector('.cd');if(!it){if(c)c.style.height='0';return}
 if(c)c.style.height=Math.min(100,cd[3]/Math.max(.01,cdOf(3))*100)+'%';b.classList.toggle('off',p.mp<mpOf(3))}
function castItem(){const it=atkItem();if(!it){toast('Equipe um item que dá habilidade (como o Chidori) para usar este botão.');return}
 if(actRoot()||cd[3]>0)return;if(PST>0){FT.push({x:p.x,y:p.y-70,t:'atordoado',txt:1,life:.7});return}
 if(seloBloqueia(mpOf(3)))return seloAviso();if(p.mp<mpOf(3)){FT.push({x:p.x,y:p.y-60,t:'sem chakra',life:.8,txt:1});return}
 cd[3]=cdOf(3);p.mp-=mpOf(3);let ax=p.ax,ay=p.ay,best=300,tg=null;
 E.concat(PVT()).forEach(e=>{if(e.dead)return;const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<best){best=d;tg=e}});
 if(tg){const d=best||1;ax=(tg.x-p.x)/d;ay=(tg.y-p.y)/d;p.ax=ax;p.ay=ay}
 HTP='@ninjutsu';try{castAtk(ax,ay)}finally{HTP=null}}

// golpes em área: os Hyuga usam a folha; os outros continuam com o círculo
let KDEL=[];
function kfxStep(dt){bufTick();eyeTick(dt);ccTick(dt);if(!KDEL.length)return;KDEL=KDEL.filter(d=>{if((d.t-=dt)>0)return true;try{d.fn()}catch(e){console.error(e)}return false})}
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
  const d0=Math.max(0,(s.tel||.26)-.26),caught=new Set(),TK=[.26,.35,.44,.53,.62,.71,.8,.89,.98].map(t=>t+d0),N=TK.length,PUSH=2*T/N;
  TK.forEach((t,j)=>later(t,()=>{HMUL=BAL.golpes.hakkeTotal/N; // os 9 toques juntos valem hakkeTotal golpes (1,4)
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
const OTA={v:+'__GAME_VER__'||0,base:'__OTA_BASE__',api:'__OTA_API__',loader:1,app:false,busy:0,ready:0,told:0};
try{OTA.app=!!localStorage.getItem('so-ota-loader');OTA.loader=+localStorage.getItem('so-ota-loader')||1}catch(_){}
function otaVerTxt(v){const m=String(v).match(/^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)$/);if(!m)return String(v||'teste');const d=new Date(Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5]));return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
function otaDb(){return new Promise((res,rej)=>{const r=indexedDB.open('shinobi-ota',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function otaPut(o){const db=await otaDb();await new Promise((res,rej)=>{const t=db.transaction('f','readwrite');t.objectStore('f').put(o,'game');t.oncomplete=res;t.onerror=()=>rej(t.error)})}
async function otaSha(txt){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(txt));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function otaCheck(){if(!OTA.app||OTA.busy||OTA.ready||!OTA.v)return 0;OTA.busy=1;
 try{let ref='main';
  try{const r=await fetch(OTA.api,{headers:{Accept:'application/vnd.github.sha'},cache:'no-store'});if(r.ok){const t=(await r.text()).trim();if(/^[0-9a-f]{40}$/.test(t))ref=t}}catch(_){}
  const q=ref==='main'?'?t='+Date.now():'';
  const vj=await (await fetch(OTA.base+ref+'/www/version.json'+q,{cache:'no-store'})).json();
  if(!(+vj.v>OTA.v))return 0;
  let bad=0;try{bad=+localStorage.getItem('so-ota-bad')||0}catch(_){}if(+vj.v===bad)return 0;
  if((+vj.loader||1)>OTA.loader){if(!OTA.told){OTA.told=1;onlReg('📦 Saiu uma versão que precisa do APK novo: baixe em GitHub → Releases.')}return 0}
  const html=await (await fetch(OTA.base+ref+'/www/game.html'+q,{cache:'no-store'})).text();
  if(vj.sha256&&await otaSha(html)!==vj.sha256)throw new Error('arquivo baixado não confere');
  const m=html.match(/'(\d{12})'\|\|0,base:/);if(!m||+m[1]!==+vj.v)throw new Error('versão do arquivo não confere');
  await otaPut({v:+vj.v,html});OTA.ready=+vj.v;otaShow();return 1}
 catch(e){console.warn('atualização:',e&&e.message);return 0}finally{OTA.busy=0}}
function otaShow(){const b=$('#otabar');if(!b)return;b.querySelector('span').textContent='🔄 Versão nova do jogo baixada ('+otaVerTxt(OTA.ready)+').';b.hidden=false;
 if(ONL.adm)onlReg('🔄 [ADM] Versão '+otaVerTxt(OTA.ready)+' baixada. Ela abre ao tocar em Atualizar ou na próxima vez que abrir o jogo.')}
async function otaApply(){const b=$('#otabar');if(b)b.querySelector('button').disabled=true;try{if(ONL.on)await onlSave(true)}catch(_){}location.reload()}

// ---------- integração com o jogo ----------
{const _start=start;start=function(k){_start(k);if(ONL.on){E=[];EP=[];if(!ONL.hasChar)onlCreateChar().catch(e=>onlLog('⚠️ '+onlErr(e)));else if(!ONL.loading)onlSave();if(ONL.authed)gsJoin();else gsConnect();onlStatus();grpDraw()}}}
{const _sw=switchMap;switchMap=function(k){_sw(k);if(ONL.on){gsJoin();ONL.dirty=true;grpDraw()}}}
function gsReady(){return new Promise((res,rej)=>{if(ONL.authed)return res();ONL.welcomeCb=res;gsConnect();
 const er=$('#err'),t0=performance.now();const tk=setInterval(()=>{if(ONL.authed||!ONL.welcomeCb){clearInterval(tk);return}const s=Math.round((performance.now()-t0)/1000);
  er.textContent=s<4?'Conectando ao servidor do jogo…':'Acordando o servidor do jogo… '+s+'s (no plano grátis ele dorme quando ninguém joga; pode levar até 1 minuto)';
  if(s>120){clearInterval(tk);ONL.welcomeCb=null;rej(new Error('O servidor do jogo não respondeu. Tente de novo em instantes.'))}},500)})}
async function onlEnter(){const n=$('#u').value.trim(),s=$('#p').value,er=$('#err');
 if(!n||!s){er.textContent='Digite seu nome de usuário e sua senha.';return}
 if(!/^[A-Za-z0-9_]{3,14}$/.test(n)){er.textContent='Usuário ou senha incorretos.';return}
 er.textContent='Entrando…';onlBusy(true);
 try{await onlLogin(n,s,false);keepSet($('#keep').checked?n:'',s);await onlAfterLogin()}catch(e){onlFail(e)}onlBusy(false)}
const okUser=n=>/^[A-Za-z0-9_]{3,14}$/.test(n),okMail=m=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);
async function onlCreate(){const n=$('#nu').value.trim(),s=$('#np').value,em=$('#ne').value.trim(),er=$('#err');
 if(!okUser(n)){er.textContent='Nome de usuário: de 3 a 14 letras, números ou _ (sem espaços nem acentos).';return}
 if(s.length<8){er.textContent='A senha precisa ter pelo menos 8 caracteres.';return}
 if(!okMail(em)){er.textContent='Digite um e-mail de recuperação válido.';return}
 er.textContent='Criando conta…';onlBusy(true);
 try{await onlLogin(n,s,true,em);$('#u').value=n;if($('#keep').checked)keepSet(n,s);await onlAfterLogin()}catch(e){onlFail(e)}onlBusy(false)}
function onlFail(e){$('#err').textContent=e.gs?e.message:onlErr(e);ONL.on=false;ONL.closing=false;try{ONL.ws&&ONL.ws.close()}catch(_){}}
// todo mundo começa na Vila da Areia (a escolha de vila vem depois)
function onlStartMap(){const k=MAPS[START_MAP]?START_MAP:CURMAP;if(k!==CURMAP){CURMAP=k;applyMap(MAPS[k])}}
async function onlAfterLogin(){const er=$('#err');ONL.on=true;ONL.closing=false;name=ONL.nome;
 const row=await onlLoadChar();
 try{await gsReady()}catch(e){e.gs=1;throw e}
 if(ONL.adm&&ONL.verDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem a coluna da versão do personagem: rode o arquivo sql/07_versao.sql no Supabase. O jogo funciona sem ela.'),1900);
 if(ONL.adm&&ONL.mgkDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem a coluna da Mangekyō: rode o arquivo sql/06_mangekyo.sql no Supabase. Até lá a escolha do olho fica salva só neste aparelho.'),1700);
 if(ONL.adm&&ONL.profDb===false)setTimeout(()=>onlReg('⚠️ [ADM] O banco ainda não tem as colunas da proficiência: rode o arquivo sql/03_proficiencia.sql no Supabase. Até lá ela fica salva só neste aparelho.'),1500);
 if(row&&row.cla&&CLANS[row.cla]){ONL.hasChar=true;name=ONL.nome=row.nome||ONL.nome;
  ['pele','cabelo','roupa'].forEach((k,i)=>{if(row[k])look[['skin','hair','cloth'][i]]=row[k]});
  const ch={lv:row.nivel,xp:row.xp,pts:row.pontos,st:{str:row.forca,agi:row.agilidade,vit:row.vitalidade,int:row.inteligencia,dex:row.destreza,luk:row.sorte},prof:{k:row.proficiencia||null,xp:row.prof_xp|0},mgk:row.mangekyo||null,v:ONL.verDb?+row.versao||1:1};
  if(!ONL.profDb||!ONL.mgkDb||!ONL.verDb){try{const o=JSON.parse(localStorage.getItem(chKey())||'null');if(o&&o.prof&&!ONL.profDb)ch.prof=o.prof;if(o&&o.mgk&&!ONL.mgkDb)ch.mgk=o.mgk;if(o&&o.v&&!ONL.verDb)ch.v=o.v}catch(_){}} // sem as colunas no banco: mantém o que estava no aparelho
  const inv={inv:[],eq:{}};(row.inventario||[]).forEach(r=>{const it=ITEMS[r.item];if(!it)return;if(r.equipado&&!inv.eq[it.slot])inv.eq[it.slot]=r.item;else inv.inv.push(r.item)});
  try{localStorage.setItem(chKey(),JSON.stringify(ch));localStorage.setItem(invKey(),JSON.stringify(inv))}catch(_){}
  onlStartMap();
  if(typeof mark==='function')mark();er.textContent='';goFull();ONL.loading=true;start(row.cla);ONL.loading=false;
  ONL.last={cols:onlCols(),inv:JSON.stringify(onlInv())};setTimeout(rs,350)}
 else{ONL.hasChar=false;onlStartMap();try{localStorage.removeItem(chKey());localStorage.removeItem(invKey())}catch(_){}er.textContent='';show('cust')}}
function onlBusy(b){['#go1','#goNew','#tabIn','#tabNew'].forEach(s=>{const e=$(s);if(e)e.disabled=b})}
function onlLogout(){ONL.closing=true;const fin=()=>{try{localStorage.removeItem(ONL_SESS)}catch(_){}location.reload()};
 const pr=ONL.on?onlSave():Promise.resolve();Promise.resolve(pr).finally(()=>{try{ONL.ws&&ONL.ws.close()}catch(_){}if(ONL.tok)onlFetch('/auth/v1/logout',{method:'POST'}).catch(()=>{}).finally(fin);else fin()})}
// ---------- Retrato do personagem (mochila e aba Personagem), animado enquanto a janela está aberta ----------
function drawPortrait(cv,ts){if(!cv||!cv.offsetParent)return;const c=cv.getContext('2d'),W=cv.width,H=cv.height;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,W,H);
 const g=c.createRadialGradient(W/2,H*.8,4,W/2,H*.62,W*.62);g.addColorStop(0,'rgba(255,201,74,.22)');g.addColorStop(1,'rgba(255,201,74,0)');c.fillStyle=g;c.fillRect(0,0,W,H);
 const k=H/(cv.id==='chCv'?78:96);c.setTransform(k,0,0,k,W/2,H*.93);const FL=eqFx();
 try{fxDraw(c,0,0,ts,FL,0);if(HERO)drawHero(c,0,0,{fl:0,t:ts,mv:0,run:0,aura:-1,th:-1,act:null});else drawChar(c,0,0,{...look,clan,dir:0,t:ts,mv:0,run:0});fxDraw(c,0,0,ts,FL,1,{fl:0})}catch(_){}}
let pfLoop=0;function portraitTick(ts){pfLoop=0;if(!invOpen)return;drawPortrait($('#dollCv'),ts);drawPortrait($('#chCv'),ts);pfLoop=requestAnimationFrame(portraitTick)}
function portraitStart(){if(!pfLoop)pfLoop=requestAnimationFrame(portraitTick)}
// ---------- Aba Personagem: mostra cada etapa do cálculo ----------
const ATR=[['hp','Vida máxima'],['mp','Chakra máximo'],['pf','Poder físico'],['pc','Poder de chakra'],['crit','Crítico'],['esq','Esquiva'],['prec','Precisão'],['red','Redução de dano'],['spd','Velocidade'],['cdr','Recarga'],['mpr','Regeneração de chakra']];
const MULT={dmg:1,spd:1,mpr:1}; // mostrados como multiplicador (100% = normal)
function atrTxt(k,v){if(k==='hp'||k==='mp')return String(Math.round(v));if(k==='pf'||k==='pc'||k==='esq'||k==='prec')return nf(v);if(k==='cdr')return (v>0?'−':v<0?'+':'')+nf(Math.abs(v))+'%';return nf(v)+'%'}
function pcTxt(t,a,b,na,nb){if(Math.abs(t)<.05)return '<span class="z">—</span>';let h='<span class="'+(t>0?'g':'r')+'">'+sgn(t)+'%</span>';const parts=[];if(Math.abs(a)>=.05)parts.push(na+' '+sgn(a));if(Math.abs(b)>=.05)parts.push(nb+' '+sgn(b));if(parts.length>1)h+='<small class="cbk">'+parts.join(' · ')+'</small>';else if(parts.length)h+='<small class="cbk">'+parts[0].split(' ')[0]+'</small>';return h}
function flTxt(k,t,a,b){if(Math.abs(t)<.05)return '<span class="z">—</span>';const txt=k==='cdr'?(t>0?'−':'+')+nf(Math.abs(t)):sgn(k==='hp'||k==='mp'?Math.round(t):t);let h='<span class="'+(t>0?'g':'r')+'">'+txt+'</span>';
 if(Math.abs(a)>=.05&&Math.abs(b)>=.05)h+='<small class="cbk">itens '+sgn(a)+' · esp. '+sgn(b)+'</small>';else h+='<small class="cbk">'+(Math.abs(a)>=.05?'itens':'especialidade')+'</small>';return h}
function stFinTxt(k){if(!CH||!clan)return '';const f=calcChar(1,1).st[k].fin;return Math.abs(f-CH.st[k])<.05?'':'<small class="svf">→ '+nf(f)+'</small>'}
function chDraw(){const el=$('#paneCh');if(!el||el.hidden||!CH||!clan)return;
 const c=calcChar(1,1),P=CH.prof,r=profRank(),C=CLANS[clan];
 let h='<div class="chh"><canvas id="chCv" width="220" height="260"></canvas><div class="chi"><b class="chn">'+esc(name)+'</b><span class="chc" style="--c:'+C.col+'">Clã '+C.n+' · Nível '+CH.lv+'</span>'
  +(P&&P.k?'<span class="chp">'+PROF[P.k].ic+' '+PROF[P.k].n+' <b>rank '+PRK[r][0]+'</b></span>':'<span class="chp z">Sem especialidade (escolha na aba Status)</span>')
  +'<div class="chbar cbh"><i style="width:'+Math.max(0,Math.min(100,p.hp/p.max*100))+'%"></i><b>Vida '+Math.round(p.hp)+' / '+p.max+'</b></div>'
  +'<div class="chbar cbm"><i style="width:'+Math.max(0,Math.min(100,p.mp/p.mpMax*100))+'%"></i><b>Chakra '+Math.round(p.mp)+' / '+p.mpMax+'</b></div></div></div>'
  +admClaHtml()+'<div class="chord"><b>Como é calculado</b><ol><li><b>Status:</b> pontos + itens = base → base × (1 + soma das %) = final (máx. '+STMAX+'; acima de '+BAL.personagem.retornoDecrescente.inicio.str+' pontos — VIT '+BAL.personagem.retornoDecrescente.inicio.vit+' — cada ponto vale '+Math.round(BAL.personagem.retornoDecrescente.eficacia*100)+'%)</li><li><b>Atributos:</b> valor dos status finais + bônus fixos → × (1 + soma das %) = final. Poder físico vem da Força; Poder de chakra, da Inteligência</li><li><b>Golpe:</b> (dano da habilidade + Poder) × bônus da especialidade × crítico. Taijutsu e Bukijutsu usam o Poder físico; Ninjutsu e Genjutsu, o Poder de chakra</li><li><b>Esquiva:</b> Esquiva = Velocidade acima de 100% + nível; Precisão = Destreza + nível. Chance de esquivar = '+BAL.combate.esquivaBase+'% + sua Esquiva − Precisão de quem ataca (de '+BAL.combate.esquivaMin+'% a '+BAL.combate.esquivaMax+'%)</li></ol></div>';
 h+='<div class="ivt">1 · Status</div><div class="tw"><table class="cht"><thead><tr><th>Status</th><th>Pontos</th><th>Itens</th><th>Base</th><th>% total</th><th>Final</th></tr></thead><tbody>'
  +AT.map(([k,ab,nm])=>{const x=c.st[k];return '<tr><td><b class="ab">'+ab+'</b> '+nm+'</td><td>'+x.pts+'</td><td>'+(x.it?'<span class="g">'+sgn(x.it)+'</span>':'<span class="z">—</span>')+'</td><td>'+x.base+'</td><td>'+pcTxt(x.pct,x.pi,x.pp,'itens','esp.')+'</td><td><b>'+nf(x.fin)+'</b>'+(x.dr?' <small class="z" title="acima de '+BAL.personagem.retornoDecrescente.inicio[k]+' cada ponto vale metade">de '+nf(x.bruto)+'</small>':'')+'</td></tr>'}).join('')+'</tbody></table></div>';
 h+='<div class="ivt">2 · Atributos</div><div class="tw"><table class="cht"><thead><tr><th>Atributo</th><th>Dos status</th><th>+ Fixos</th><th>% total</th><th>Final</th></tr></thead><tbody>'
  +ATR.map(([k,nm])=>{const x=c.at[k];return '<tr><td>'+nm+'</td><td>'+atrTxt(k,x.fromSt)+'</td><td>'+flTxt(k,x.fl,x.fi,x.fp)+'</td><td>'+pcTxt(x.pct,x.pi,x.pp,'itens','esp.')+'</td><td><b>'+atrTxt(k,x.fin)+'</b></td></tr>'}).join('')+'</tbody></table></div>'
  +'<p class="chnote">Velocidade e Regeneração: 100% = normal. Crítico, Redução e Recarga já são porcentagens; nelas (e na Esquiva) a especialidade soma pontos.</p>';
 h+='<div class="ivt">3 · Golpes</div><div class="tw"><table class="cht"><thead><tr><th>Golpe</th><th>Tipo</th><th>Dano</th><th>Recarga</th><th>Chakra</th></tr></thead><tbody>'
  +C.sk.concat(atkItem()&&!C.sk[3]?[{_it:1}]:[]).map((s,i)=>{const a=s._it?atkItem():null,tp=skType(i),bd=a?+a.atk.dmg||16:s.dmg,bc=a?+a.atk.cd||s.cd:s.cd,bm=a?+a.atk.mp||0:s.mp,tm=profTypeMul(tp),
    pw=skPow(tp),fd=Math.max(1,Math.round(hitRaw(bd,tp))),fc=cdOf(i,s),fm=mpOf(i,s),cls=(x,y,lowGood)=>Math.abs(x-y)<.01?'':((lowGood?x<y:x>y)?'g':'r');
    return '<tr><td>'+(a?a.name+' <small>(item · rank A)</small>':s.n+(s.rk?' <small class="rkb">rank '+s.rk+'</small>':''))+'</td><td>'+(tp?PROF[tp].ic+' '+PROF[tp].n+(profOn(tp)?' <small class="g">especialidade</small>':profOth(tp)?' <small class="r">penalidade</small>':''):'—')+'</td>'
     +'<td>'+(Math.abs(tm-1)>.001?'(':'')+bd+' + '+nf(pw)+(Math.abs(tm-1)>.001?') × '+nf(tm):'')+' = <b class="'+cls(fd,bd,0)+'">'+fd+'</b><small class="cbk">'+(isChakra(tp)?'poder de chakra':'poder físico')+'</small></td><td>'+nf(bc)+'s → <b class="'+cls(fc,bc,1)+'">'+nf(fc)+'s</b></td><td>'+bm+' → <b class="'+cls(fm,bm,1)+'">'+fm+'</b></td></tr>'}).join('')+'</tbody></table></div>'
  +'<p class="chnote">Dano por acerto sem crítico: (dano da habilidade + poder) × bônus da especialidade. Crítico dobra.</p>';
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
function bagSlot(id,cls,on){const b=slotBtn(id,cls,on);if(id){const c=rarOf(ITEMS[id])[1];b.style.background='radial-gradient(circle at 50% 38%,'+hexA(c,.38)+',#150a08 72%)'}return b}
bagRefresh=function(){const g=$('#ivGrid'),det=$('#ivDet'),L=$('#dollL'),R=$('#dollR');if(!g||!L)return;L.innerHTML='';R.innerHTML='';
 ['cabeca','capa','arma','mao','acessorio'].forEach((s,j)=>{const n=(SLOT_DEFS.find(x=>x[0]===s)||[s,s])[1],id=EQ[s],w=document.createElement('div');w.className='es';
  const b=bagSlot(id,' big',()=>{invSel=id;bagRefresh()});if(!id)b.innerHTML='<span class="ph">'+(SLOT_IC[s]||'')+'</span>';w.appendChild(b);
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
  +(it.desc?'<p class="dd">'+esc(it.desc)+'</p>':'')+(lines?(cur?'<div class="dcmp">Comparando com <b>'+esc(cur.name)+'</b> (equipado)</div>':'')+'<ul class="dst">'+lines+'</ul>':'')+atk
  +'<div class="dbt"><button id="ivAct" class="'+(on?'sec':'')+'">'+(on?'Desequipar':cur?'Trocar pelo equipado':'Equipar')+'</button></div></div>';
 $('#ivAct').onclick=()=>{if(on)unequipItem(id);else{equipItem(id);toggleBag(true,'bag');invSel=id;bagRefresh()}}
 portraitStart()};
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
 const mb=$('#mapbtn'),mbo=mb.onclick;mb.onclick=()=>{if(!ONL.on||ONL.adm)mbo();else toast('Por enquanto todos os ninjas ficam na Vila da Areia.')};
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
 {const lv=$('#lgVer');if(lv)lv.textContent='Versão '+otaVerTxt(OTA.v)+(OTA.app?' · atualiza sozinho':'')}
 {const ob=$('#otabar');document.body.appendChild(ob);ob.querySelector('button').onclick=otaApply} // aparece em qualquer tela
 if(OTA.app){setTimeout(otaCheck,2500);setInterval(otaCheck,20*60*1000)}})();
//ONLINE-END
