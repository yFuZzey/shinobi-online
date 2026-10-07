// Servidor simulado (subconjunto do Supabase: Auth, REST de "personagens" e Realtime/Phoenix) para testes locais.
const http=require('http'),crypto=require('crypto');
const PORT=+process.argv[2]||54321;
const users={},rows={},INV={},PATCHES=[],TROCAS=[],BANS={};let RPCS=0;let n=0;const log=[];
function J(res,code,obj){res.writeHead(code,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(obj===undefined?'':JSON.stringify(obj))}
function sess(u){const r='ref-'+u.id+'-'+(++n);u.refresh=r;return {access_token:'tok-'+u.id,refresh_token:r,expires_in:3600,token_type:'bearer',user:{id:u.id,email:u.email,user_metadata:u.meta}}}
function uidOf(req){const a=req.headers.authorization||'';const m=/^Bearer tok-(.+)$/.exec(a);return m?m[1]:null}
const srv=http.createServer((req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,authorization,content-type,prefer','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'});return res.end()}
 let b='';req.on('data',c=>b+=c);req.on('end',()=>{
  const u=new URL(req.url,'http://x');let body={};try{body=b?JSON.parse(b):{}}catch(_){}
  log.push(req.method+' '+u.pathname+u.search);
  if(!req.headers.apikey)return J(res,401,{message:'No API key found in request'});
  if(u.pathname==='/auth/v1/signup'){if(users[body.email])return J(res,422,{code:422,error_code:'user_already_exists',msg:'User already registered'});
   if((body.password||'').length<6)return J(res,422,{code:422,error_code:'weak_password',msg:'Password should be at least 6 characters.'});
   const usr={id:crypto.randomUUID(),email:body.email,pw:body.password,meta:body.data||{}};users[body.email]=usr;return J(res,200,sess(usr))}
  if(u.pathname==='/auth/v1/token'){const g=u.searchParams.get('grant_type');
   if(g==='password'){const usr=users[body.email];if(!usr||usr.pw!==body.password)return J(res,400,{code:400,error_code:'invalid_credentials',msg:'Invalid login credentials'});return J(res,200,sess(usr))}
   if(g==='refresh_token'){const usr=Object.values(users).find(x=>x.refresh===body.refresh_token);if(!usr)return J(res,400,{code:400,error_code:'refresh_token_not_found',msg:'Invalid Refresh Token: Refresh Token Not Found'});return J(res,200,sess(usr))}}
  if(u.pathname==='/auth/v1/logout')return J(res,204);
  if(u.pathname==='/auth/v1/user'){const uid=uidOf(req);const usr=Object.values(users).find(x=>x.id===uid);if(!usr)return J(res,401,{code:401,msg:'invalid JWT'});return J(res,200,{id:usr.id,email:usr.email,user_metadata:usr.meta})}
  if(u.pathname==='/__rows')return J(res,200,rows);
  if(u.pathname==='/__inv')return J(res,200,{inv:INV,trocas:TROCAS});
  // NOPROF=1 simula o banco ANTES do SQL da proficiência (colunas ainda não existem)
  if(process.env.NOVER&&u.pathname==='/rest/v1/personagens'&&(/versao/.test(u.searchParams.get('select')||'')||'versao' in body))return J(res,400,{code:'42703',message:'column personagens.versao does not exist'});
  if(process.env.NOMGK&&u.pathname==='/rest/v1/personagens'&&(/mangekyo/.test(u.searchParams.get('select')||'')||'mangekyo' in body))return J(res,400,{code:'42703',message:'column personagens.mangekyo does not exist'});
  if(process.env.NOPROF&&u.pathname==='/rest/v1/personagens'&&(/proficiencia|prof_xp/.test(u.searchParams.get('select')||'')||'proficiencia' in body||'prof_xp' in body))return J(res,400,{code:'42703',message:'column personagens.proficiencia does not exist'});
  // banidos (SQL 05): só com a chave secreta; NOBAN=1 simula o banco sem a tabela
  if(u.pathname==='/rest/v1/banidos'){if(process.env.NOBAN)return J(res,404,{code:'42P01',message:'relation "public.banidos" does not exist'});if(req.headers.apikey!=='svc-test')return J(res,401,{message:'permission denied for table banidos'});
   const pid=(u.searchParams.get('personagem_id')||'').replace(/^eq\./,'');
   if(req.method==='GET'){const L=Object.values(BANS).filter(b=>!pid||b.personagem_id===pid).map(b=>({...b,personagens:{nome:(rows[b.personagem_id]||{}).nome}}));return J(res,200,L)}
   if(req.method==='POST'){BANS[body.personagem_id]={...body};return J(res,201)}
   if(req.method==='DELETE'){const had=BANS[pid]?[BANS[pid]]:[];delete BANS[pid];return J(res,200,had)}}
  // chave secreta (servidor do jogo): procurar pelo nome e mudar o admin
  if(u.pathname==='/rest/v1/personagens'&&req.headers.apikey==='svc-test'){const all=Object.entries(rows).map(([id,r])=>({id,nome:r.nome,admin:!!r.admin}));
   if(req.method==='GET'){const nf=(u.searchParams.get('nome')||'').replace(/^ilike\./,'').replace(/\\(.)/g,'$1');return J(res,200,nf?all.filter(r=>r.nome.toLowerCase()===nf.toLowerCase()):all)}
   if(req.method==='PATCH'){const id=(u.searchParams.get('id')||'').replace(/^eq\./,'');if(!rows[id])return J(res,200,[]);Object.assign(rows[id],body);return J(res,200,[{id,nome:rows[id].nome,admin:!!rows[id].admin}])}}
  if(u.pathname==='/rest/v1/personagens'){const uid=uidOf(req);if(!uid)return J(res,401,{message:'JWT required'});
   const idf=(u.searchParams.get('id')||'').replace(/^eq\./,'');
   if(req.method==='GET'){if(!(rows[idf]&&idf===uid))return J(res,200,[]);const r=Object.assign({admin:false},rows[idf]);if((u.searchParams.get('select')||'').includes('inventario'))r.inventario=(INV[uid]||[]).map(x=>({...x}));return J(res,200,[r])}
   if(req.method==='POST'){if(body.id!==uid)return J(res,403,{message:'new row violates row-level security policy'});if('admin' in body)return J(res,403,{code:'42501',message:'permission denied for table personagens'});
    if(Object.values(rows).some(r=>r.nome.toLowerCase()===body.nome.toLowerCase()))return J(res,409,{message:'duplicate key value violates unique constraint "personagens_nome_unico"'});
    rows[uid]={nivel:1,xp:0,pontos:0,forca:0,agilidade:0,vitalidade:0,inteligencia:0,destreza:0,sorte:0,...body};return J(res,201)}
   if(req.method==='PATCH'){if('admin' in body||'nome' in body)return J(res,403,{code:'42501',message:'permission denied for table personagens'});if(idf!==uid||!rows[uid])return J(res,200);Object.assign(rows[uid],body);PATCHES.push(Object.keys(body));return J(res,204)}}
  // ---- simulação do SQL 04 (SQL04=1): inventário só pelo servidor (chave "svc-test"), trocas atômicas
  const SVC=req.headers.apikey==='svc-test';
  if(u.pathname==='/rest/v1/rpc/salvar_inventario'){const uid=uidOf(req);if(!uid)return J(res,401,{message:'JWT required'});RPCS++;
   if(process.env.SQL04){const L=INV[uid]||[],want=new Set((body.itens||[]).filter(x=>x.equipado).map(x=>x.item)),done=new Set();
    L.slice().sort((a,b)=>(b.equipado-a.equipado)).forEach(r=>{if(want.has(r.item)&&!done.has(r.item)){r._e=1;done.add(r.item)}else r._e=0});L.forEach(r=>{r.equipado=!!r._e;delete r._e});return J(res,204)}
   INV[uid]=(body.itens||[]).map(x=>({item:x.item,equipado:!!x.equipado}));return J(res,204)}
  if(u.pathname==='/rest/v1/rpc/dar_itens'){if(!process.env.SQL04)return J(res,404,{message:'Could not find the function public.dar_itens'});if(!SVC)return J(res,401,{message:'permission denied for function dar_itens'});
   const L=INV[body.p_personagem]=INV[body.p_personagem]||[],got=[];(body.p_itens||[]).forEach(x=>{if(x){L.push({item:x,equipado:false});got.push(x)}});
   if(body.p_personagem==='00000000-0000-0000-0000-000000000000')delete INV[body.p_personagem];return J(res,200,got)}
  if(u.pathname==='/rest/v1/rpc/trocar_itens'){if(!process.env.SQL04)return J(res,404,{message:'Could not find the function'});if(!SVC)return J(res,401,{message:'permission denied'});
   const{p_a,p_b}=body,ia=body.p_ia||[],ib=body.p_ib||[],A=INV[p_a]=INV[p_a]||[],B=INV[p_b]=INV[p_b]||[];
   if(!ia.length&&!ib.length)return J(res,400,{message:'troca vazia'});
   const pick=(L,list)=>{const used=new Set();for(const x of list){const r=L.find(r=>r.item===x&&!r.equipado&&!used.has(r));if(!r)return null;used.add(r)}return used};
   const ua=pick(A,ia),ub=pick(B,ib);if(!ua||!ub)return J(res,400,{message:'item não está mais na mochila'});
   INV[p_a]=A.filter(r=>!ua.has(r)).concat([...ub].map(r=>({item:r.item,equipado:false})));INV[p_b]=B.filter(r=>!ub.has(r)).concat([...ua].map(r=>({item:r.item,equipado:false})));
   TROCAS.push({a:p_a,b:p_b,ia,ib});return J(res,204)}
  if(u.pathname==='/rest/v1/inventario'){const pid=(u.searchParams.get('personagem_id')||'').replace(/^eq\./,''),uid=uidOf(req);
   if(req.method==='GET'){if(!SVC&&pid!==uid)return J(res,200,[]);return J(res,200,(INV[pid]||[]).map(r=>({...r})))}
   if(req.method==='DELETE'){if(!SVC)return J(res,403,{message:'permission denied for table inventario'});INV[pid]=[];return J(res,204)}
   return J(res,403,{message:'permission denied for table inventario'})}
  if(u.pathname==='/__admin'){const r=Object.values(rows).find(r=>r.nome.toLowerCase()===String(u.searchParams.get('nome')).toLowerCase());if(r)r.admin=true;return J(res,200,{ok:!!r})}
  if(u.pathname==='/__state')return J(res,200,{users:Object.keys(users),rows,inv:INV,patches:PATCHES.slice(-20),rpcs:RPCS,log:log.slice(-60),topics:Object.fromEntries(Object.entries(topics).map(([k,v])=>[k,[...v].map(c=>c.pres&&c.pres[k]&&c.pres[k].nome)]))});
  J(res,404,{message:'not found'})})});
// ---------- WebSocket mínimo ----------
const topics={};
function frame(str){const d=Buffer.from(str);let h;if(d.length<126)h=Buffer.from([0x81,d.length]);else if(d.length<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(d.length,2)}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(d.length),2)}return Buffer.concat([h,d])}
function send(c,o){if(!c.dead)c.sock.write(frame(JSON.stringify(o)))}
function leaveAll(c){for(const t in topics){if(topics[t].has(c)){topics[t].delete(c);const k=c.key[t];if(k&&c.pres&&c.pres[t]){const leaves={[k]:{metas:[c.pres[t]]}};delete c.pres[t];for(const o of topics[t])send(o,{topic:t,event:'presence_diff',payload:{joins:{},leaves},ref:null})}}}}
function onMsg(c,m){
 if(m.topic==='phoenix'&&m.event==='heartbeat')return send(c,{topic:'phoenix',event:'phx_reply',payload:{status:'ok',response:{}},ref:m.ref});
 const t=m.topic;
 if(m.event==='phx_join'){const cfg=m.payload&&m.payload.config||{};if(!m.payload||!('access_token' in m.payload))return send(c,{topic:t,event:'phx_reply',payload:{status:'error',response:{reason:'no token'}},ref:m.ref});
  (topics[t]=topics[t]||new Set()).add(c);c.key[t]=cfg.presence&&cfg.presence.key||crypto.randomUUID();c.self[t]=!!(cfg.broadcast&&cfg.broadcast.self);
  send(c,{topic:t,event:'phx_reply',payload:{status:'ok',response:{postgres_changes:[]}},ref:m.ref,join_ref:m.join_ref});
  const st={};for(const o of topics[t])if(o.pres&&o.pres[t])st[o.key[t]]={metas:[o.pres[t]]};send(c,{topic:t,event:'presence_state',payload:st,ref:null});return}
 if(m.event==='phx_leave'){if(topics[t]&&topics[t].has(c)){topics[t].delete(c);const k=c.key[t];if(c.pres&&c.pres[t]){const leaves={[k]:{metas:[c.pres[t]]}};delete c.pres[t];for(const o of topics[t])send(o,{topic:t,event:'presence_diff',payload:{joins:{},leaves},ref:null})}}return send(c,{topic:t,event:'phx_reply',payload:{status:'ok',response:{}},ref:m.ref})}
 if(!topics[t]||!topics[t].has(c))return;
 if(m.event==='presence'&&m.payload&&m.payload.event==='track'){c.pres=c.pres||{};const meta={phx_ref:'r'+(++n),...m.payload.payload};c.pres[t]=meta;for(const o of topics[t])send(o,{topic:t,event:'presence_diff',payload:{joins:{[c.key[t]]:{metas:[meta]}},leaves:{}},ref:null});return}
 if(m.event==='broadcast'){for(const o of topics[t])if(o!==c||c.self[t])send(o,{topic:t,event:'broadcast',payload:m.payload,ref:null});return}
 if(m.event==='access_token')return}
srv.on('upgrade',(req,sock)=>{const u=new URL(req.url,'http://x');
 if(u.pathname!=='/realtime/v1/websocket'||!u.searchParams.get('apikey')){sock.destroy();return}
 const acc=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
 sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
 const c={sock,key:{},self:{},dead:false};let buf=Buffer.alloc(0);
 sock.on('data',d=>{buf=Buffer.concat([buf,d]);
  while(buf.length>=2){const op=buf[0]&15;let len=buf[1]&127,off=2;if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4}else if(len===127){if(buf.length<10)return;len=Number(buf.readBigUInt64BE(2));off=10}
   const masked=buf[1]&128;if(buf.length<off+(masked?4:0)+len)return;let mask=null;if(masked){mask=buf.slice(off,off+4);off+=4}
   const pl=Buffer.from(buf.slice(off,off+len));if(mask)for(let i=0;i<pl.length;i++)pl[i]^=mask[i&3];buf=buf.slice(off+len);
   if(op===8){c.dead=true;leaveAll(c);sock.end();return}if(op===9){sock.write(Buffer.from([0x8a,0]));continue}
   if(op===1){try{onMsg(c,JSON.parse(pl.toString()))}catch(e){console.error(e)}}}});
 sock.on('close',()=>{c.dead=true;leaveAll(c)});sock.on('error',()=>{c.dead=true;leaveAll(c)})});
srv.listen(PORT,()=>console.log('mock on',PORT));
