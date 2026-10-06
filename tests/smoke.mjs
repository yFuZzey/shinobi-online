// Teste do servidor online real (Supabase): contas, tabela personagens e canal em tempo real.
// Uso: node smoke.mjs <URL> <CHAVE>
const [URL_,KEY]=process.argv.slice(2);const U=URL_.replace(/\/+$/,'');
const DOM='@jogadores.shinobi-online.app';let fails=0;
const ok=(c,m)=>{console.log((c?"::notice::OK ":"::error::FALHA ")+m);if(!c)fails++};
async function F(path,opt={},tok){const h={apikey:KEY,...(opt.body?{'Content-Type':'application/json'}:{}),...(tok?{Authorization:'Bearer '+tok}:KEY.startsWith('eyJ')?{Authorization:'Bearer '+KEY}:{}),...(opt.headers||{})};
 const r=await fetch(U+path,{...opt,headers:h});const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}return {s:r.status,j}}
async function conta(nome){const email=nome+DOM,pw='teste-'+nome+'-123';
 let r=await F('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password:pw})});
 if(r.s!==200){r=await F('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password:pw,data:{nome}})});
  ok(r.s===200&&r.j&&r.j.access_token,'criar conta '+nome+' ('+r.s+' '+JSON.stringify(r.j&&(r.j.msg||r.j.error_code)||'')+')');
  if(!(r.j&&r.j.access_token)){console.log('  → Se aparecer "email_not_confirmed" ou faltar access_token: desligue "Confirm email" no Supabase.');return null}}
 else ok(true,'login '+nome);return {tok:r.j.access_token,id:r.j.user.id,nome}}
const a=await conta('zz_teste_a'),b=await conta('zz_teste_b');
if(!a||!b){process.exit(1)}
let r=await F('/rest/v1/personagens?select=nome,cla,nivel,xp,admin,inventario(item,equipado)&id=eq.'+a.id,{},a.tok);
ok(r.s===200,'ler personagem + inventário em colunas ('+r.s+' '+JSON.stringify(r.j&&r.j.message||'')+')');
if(r.s===200&&r.j.length===0){r=await F('/rest/v1/personagens',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:a.id,nome:a.nome,cla:'uchiha',nivel:1})},a.tok);ok(r.s===201,'criar personagem ('+r.s+' '+JSON.stringify(r.j)+')')}
{const q=await F('/rest/v1/personagens?select=proficiencia,prof_xp&id=eq.'+a.id,{},a.tok);if(q.s===200)ok(true,'colunas da proficiência no banco');else console.log('::warning::O banco ainda não tem as colunas da proficiência — rode sql/03_proficiencia.sql no Supabase ('+q.s+')')}
r=await F('/rest/v1/personagens?id=eq.'+a.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({xp:Date.now()%50,atualizado:new Date().toISOString()})},a.tok);ok(r.s===204,'salvar coluna xp ('+r.s+')');
{const tag='zz_falso_'+(Date.now()%100000);
r=await F('/rest/v1/rpc/salvar_inventario',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({itens:[{item:'chidori',equipado:true},{item:tag,equipado:false}]})},a.tok);ok(r.s===204||r.s===200,'salvar inventário ('+r.s+' '+JSON.stringify(r.j&&r.j.message||'')+')');
r=await F('/rest/v1/inventario?select=item&personagem_id=eq.'+a.id,{},a.tok);ok(r.s===200,'ler a própria mochila ('+r.s+')');
if(r.s===200&&r.j.some(x=>x.item===tag)){console.log('::warning::O inventário ainda usa a regra antiga (o app consegue criar item) — coloque SUPABASE_SERVICE_KEY no Render e rode sql/04_trocas.sql');
 r=await F('/rest/v1/rpc/salvar_inventario',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({itens:[{item:'chidori',equipado:true}]})},a.tok);
 r=await F('/rest/v1/personagens?select=inventario(item,equipado)&id=eq.'+a.id,{},a.tok);ok(r.s===200&&r.j[0]&&r.j[0].inventario.length===1,'inventário gravado (regra antiga)')}
else{ok(true,'salvar mochila pelo app NÃO cria item (sem duplicar)');
 r=await F('/rest/v1/inventario',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({personagem_id:a.id,item:tag,equipado:false})},a.tok);ok(r.s>=400,'jogador NÃO consegue criar item direto no banco ('+r.s+')');
 r=await F('/rest/v1/rpc/trocar_itens',{method:'POST',body:JSON.stringify({p_a:a.id,p_b:b.id,p_ia:[],p_ib:['chidori']})},a.tok);ok(r.s>=400,'jogador NÃO consegue chamar a troca direto ('+r.s+')');
 r=await F('/rest/v1/rpc/dar_itens',{method:'POST',body:JSON.stringify({p_personagem:a.id,p_itens:[tag]})},a.tok);ok(r.s>=400,'jogador NÃO consegue se dar itens ('+r.s+')')}}
r=await F('/rest/v1/personagens?id=eq.'+a.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({admin:true})},a.tok);ok(r.s>=400,'jogador NÃO consegue se dar admin ('+r.s+')');
r=await F('/rest/v1/personagens?select=nome&id=eq.'+a.id,{},b.tok);ok(r.s===200&&r.j.length===0,'outro jogador NÃO lê personagem alheio (segurança)');
r=await F('/rest/v1/inventario?select=item&personagem_id=eq.'+a.id,{},b.tok);ok(r.s===200&&r.j.length===0,'outro jogador NÃO lê inventário alheio');
// tempo real
function canal(u,topic,onmsg){return new Promise((res,rej)=>{const w=new WebSocket(U.replace(/^http/,'ws')+'/realtime/v1/websocket?apikey='+encodeURIComponent(KEY)+'&vsn=1.0.0');let ref=0;
 const send=(event,payload)=>w.send(JSON.stringify({topic,event,payload,ref:String(++ref),join_ref:'1'}));
 w.onopen=()=>w.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{self:false,ack:false},presence:{key:u.id,enabled:true},postgres_changes:[],private:false},access_token:u.tok},ref:'1',join_ref:'1'}));
 w.onmessage=e=>{const m=JSON.parse(e.data);if(m.event==='phx_reply'&&m.ref==='1'){if(m.payload.status==='ok')res({w,send});else rej(new Error(JSON.stringify(m.payload)))}onmsg(m)};
 w.onerror=e=>rej(new Error('websocket erro'));setTimeout(()=>rej(new Error('timeout ao entrar no canal')),10000)})}
const topic='realtime:shinobi-teste',got={pres:false,bc:false};
try{
 const A=await canal(a,topic,()=>{});ok(true,'jogador A entrou no canal');
 const B=await canal(b,topic,m=>{if(m.event==='presence_diff'||m.event==='presence_state'){if(JSON.stringify(m.payload).includes('zz_teste_a'))got.pres=true}if(m.event==='broadcast'&&m.payload&&m.payload.event==='pos'&&m.payload.payload.x===123)got.bc=true});ok(true,'jogador B entrou no canal');
 A.send('presence',{type:'presence',event:'track',payload:{nome:'zz_teste_a',lv:1}});
 await new Promise(r=>setTimeout(r,1500));
 for(let i=0;i<3;i++){A.send('broadcast',{type:'broadcast',event:'pos',payload:{id:a.id,x:123,y:45}});await new Promise(r=>setTimeout(r,400))}
 await new Promise(r=>setTimeout(r,1500));
 ok(got.pres,'B vê A online (presença)');ok(got.bc,'B recebe movimento de A (broadcast)');A.w.close();B.w.close();
}catch(e){ok(false,'tempo real: '+e.message)}
console.log(fails?('\n'+fails+' FALHA(S)'):'\nTUDO OK');process.exit(fails?1:0);
