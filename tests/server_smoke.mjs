// Teste do servidor de jogo publicado (Render).
// Uso: node server_smoke.mjs <SUPABASE_URL> <SUPABASE_KEY> <SERVIDOR_URL> [COMMIT_ESPERADO]
const [SB, KEY, GS, COMMIT] = process.argv.slice(2);
const U = SB.replace(/\/+$/, ''), G = GS.replace(/\/+$/, '');
const DOM = '@jogadores.shinobi-online.app'; let fails = 0;
const ok = (c, m) => { console.log((c ? '::notice::OK ' : '::error::FALHA ') + m); if (!c) fails++; };
const W = ms => new Promise(r => setTimeout(r, ms));

// 1) espera o servidor acordar e estar na versão certa
let h = null; const t0 = Date.now();
while (Date.now() - t0 < 12 * 60 * 1000) {
  try { const r = await fetch(G + '/health', { signal: AbortSignal.timeout(20000) }); if (r.ok) { h = await r.json(); if (!COMMIT || h.commit === COMMIT) break; console.log('servidor ainda na versão', h.commit, '- esperando o deploy de', COMMIT); } }
  catch (e) { console.log('servidor ainda não respondeu:', e.message); }
  await W(15000);
}
ok(h && h.ok, 'servidor no ar (' + (h ? 'commit ' + h.commit + ', ' + h.online + ' online' : 'sem resposta') + ')');
if (!h) process.exit(1);
if (COMMIT) ok(h.commit === COMMIT, 'servidor rodando a versão nova');

// 2) contas de teste
async function token(nome) {
  const email = nome + DOM, pw = 'teste-' + nome + '-123';
  const r = await fetch(U + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) });
  const j = await r.json(); if (!j.access_token) throw new Error('login ' + nome + ': ' + JSON.stringify(j)); return j;
}
function client(tok, nome) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(G.replace(/^http/, 'ws') + '/ws'); const c = { ws, msgs: [], nome, send: o => ws.send(JSON.stringify(o)) };
    c.wait = (f, ms = 8000) => new Promise((ok2, no) => { const f2 = c.msgs.find(f); if (f2) return ok2(f2); const t = setTimeout(() => no(new Error('timeout ' + nome)), ms); c.waiters.push([f, m => { clearTimeout(t); ok2(m); }]); });
    c.waiters = [];
    ws.onopen = () => c.send({ t: 'auth', v: 2, token: tok });
    ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); c.waiters = c.waiters.filter(([f, cb]) => f(m) ? (cb(m), false) : true); if (m.t === 'welcome') res(c); if (m.t === 'authfail') rej(new Error(m.msg)); };
    ws.onerror = () => rej(new Error('websocket erro')); setTimeout(() => rej(new Error('timeout auth')), 15000);
  });
}
try {
  const ta = await token('zz_teste_a'), tb = await token('zz_teste_b');
  const A = await client(ta.access_token, 'A'); ok(true, 'jogador A autenticado no servidor');
  const B = await client(tb.access_token, 'B'); ok(true, 'jogador B autenticado no servidor');
  const meta = { clan: 'uchiha', lv: 1, eq: [], look: {} };
  A.send({ t: 'join', map: 'vila_areia', x: 900, y: 1200, hp: 100, max: 100, sc: 0, ...meta });
  const ra = await A.wait(m => m.t === 'room'); ok(ra.mobs && ra.mobs.some(x => x.def.kind === 'raposa'), 'A entrou no mapa e recebeu a raposa');
  B.send({ t: 'join', map: 'vila_areia', x: 920, y: 1200, hp: 100, max: 100, sc: 0, ...meta });
  const rb = await B.wait(m => m.t === 'room'); ok(rb.players.some(p => p.id === ta.user.id), 'B vê A ao entrar');
  await A.wait(m => m.t === 'pj' && m.p.id === tb.user.id); ok(true, 'A é avisado que B entrou');
  A.send({ t: 'pos', x: 950, y: 1210, fl: 0, mv: 1, run: 0, au: -1, th: -1, sc: 0, hp: 100, max: 100 });
  const ps = await B.wait(m => m.t === 'ps' && m.p.some(a => a[0] === ta.user.id && a[1] === 950)); ok(typeof ps.st === 'number', 'B recebe o movimento de A');
  const ms = await A.wait(m => m.t === 'mobs'); ok(typeof ms.st === 'number', 'estado dos monstros chegando do servidor (com hora para interpolar)');
  A.send({ t: 'pinv', to: tb.user.id }); const inv = await B.wait(m => m.t === 'pinvite'); ok(inv.from === ta.user.id, 'convite de grupo chegou');
  B.send({ t: 'pacc', from: ta.user.id }); const pa = await A.wait(m => m.t === 'party' && m.members && m.members.length === 2); ok(!!pa, 'grupo formado');
  B.send({ t: 'chat', text: 'teste do grupo', ch: 'g' }); await A.wait(m => m.t === 'chat' && m.ch === 'g'); ok(true, 'chat de grupo');
  B.send({ t: 'pleave' }); await A.wait(m => m.t === 'party' && m.none); ok(true, 'grupo desfeito');
  // PvP: fora do grupo e longe do ponto de início, o golpe chega no outro e o resultado volta para todos
  A.send({ t: 'pvp', to: tb.user.id, d: 10, pr: 0 }); const hu = await B.wait(m => m.t === 'hurt' && m.by === ta.user.id); ok(hu.d > 0, 'PvP: golpe de A chegou em B (' + hu.d + ' de dano)');
  B.send({ t: 'phr', by: ta.user.id, d: hu.d, miss: 0, dead: 0 }); const ph = await A.wait(m => m.t === 'ph' && m.to === tb.user.id); ok(ph.d === hu.d, 'PvP: A vê o dano que causou');
  const wel = A.msgs.find(m => m.t === 'welcome');
  if (!wel.inv) console.log('::warning::Trocas desligadas no servidor — coloque SUPABASE_SERVICE_KEY no Render e rode sql/04_trocas.sql no Supabase');
  else {
    A.send({ t: 'tinv', to: tb.user.id }); const ti = await B.wait(m => m.t === 'tinvite'); ok(ti.from === ta.user.id, 'pedido de troca chegou');
    B.send({ t: 'tacc', from: ta.user.id }); const tr = await A.wait(m => m.t === 'trade'); ok(tr.other.id === tb.user.id, 'janela de troca aberta nos dois');
    A.send({ t: 'tcancel' }); await B.wait(m => m.t === 'tend'); ok(true, 'troca cancelada sem mexer nas mochilas');
  }
  A.ws.close(); B.ws.close();
} catch (e) { ok(false, 'servidor: ' + e.message); }
console.log(fails ? '\n' + fails + ' FALHA(S)' : '\nTUDO OK'); process.exit(fails ? 1 : 0);
