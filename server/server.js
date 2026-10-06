'use strict';
// =====================================================================
//  Servidor do Shinobi Online
//  - Node puro (sem dependências): HTTP + WebSocket próprio
//  - Contas: valida o token do Supabase de cada jogador
//  - Autoritativo: a raposa (IA, vida, ataques, projéteis), o dano nos
//    jogadores, os grupos e as recompensas são decididos aqui.
// =====================================================================
const http = require('http'), crypto = require('crypto'), fs = require('fs'), path = require('path');

const PORT = +process.env.PORT || 8080;
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = process.env.SUPABASE_KEY || '';
// chave SECRETA do Supabase (só no painel do Render, nunca no app): o servidor passa a cuidar do inventário no banco
const SB_SVC = process.env.SUPABASE_SERVICE_KEY || '';
const PROTO = 3;                                   // versão do protocolo (cliente precisa bater)
const COMMIT = process.env.RENDER_GIT_COMMIT || process.env.COMMIT || 'dev';
const T = 32;

// Regras do jogo (ajustáveis)
const CFG = {
  aggro: 10,        // a raposa persegue jogadores a até 10 tiles
  resetNear: 15,    // se ninguém estiver a até 15 tiles...
  resetWait: 3,     // ...por 3 segundos, ela volta e recupera a vida
  resetHome: 20,    // se for puxada a mais de 20 tiles do covil, volta na hora
  respawn: 20,      // segundos até renascer depois de morta
  xp: 60,           // XP da raposa para cada membro do grupo vencedor
  partyMax: 6,
  hitRange: 620,    // distância máxima jogador→raposa para um golpe valer (px)
  maxHit: 5000,
  inviteTtl: 30,    // segundos para aceitar convite
  partyGrace: 120,  // segundos que um membro desconectado continua no grupo
  localChat: 15,    // chat Local chega a quem está a até 15 tiles
  safe: 0,          // zona segura em volta do início (em tiles); 0 = desligada
  // PvP: quem não está no mesmo grupo pode se atacar
  pvp: 1,           // 0 = desligado
  pvpMul: .6,       // golpes em jogadores causam 60% do dano normal (as lutas não acabam em 2 golpes)
  pvpSafe: 4,       // em volta do ponto de início (tiles) ninguém ataca nem é atacado (protege quem acabou de renascer)
  pvpStun: 1.5,     // atordoamento máximo em jogador (s)
  pvpMaxHit: 1500,
};

// chance de esquivar: 5% + (Esquiva de quem defende − Precisão de quem ataca), entre 0% e 60%
const dodgeChance = (esq, prec) => clamp(5 + num(esq, 0) - num(prec, 0), 0, 60);
const FOXDEF = () => MOBDEFS.raposa || {};

const MAPS = JSON.parse(fs.readFileSync(path.join(__dirname, 'maps.json'), 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));
let MOBDEFS = {}; try { MOBDEFS = JSON.parse(fs.readFileSync(path.join(__dirname, 'mobs.json'), 'utf8')); } catch (e) {}
const now = () => Date.now() / 1000;
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').slice(0, n);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------------------------------------------------------------- mapa
function sol(map, x, y) { const m = MAPS[map]; const tx = x / T | 0, ty = y / T | 0; if (x < 0 || y < 0 || tx >= m.N || ty >= m.N) return true; const v = m.M.charCodeAt(ty * m.N + tx) - 48; return v === 1 || v === 2; }
const blk = (map, x, y) => sol(map, x - 7, y - 3) || sol(map, x + 7, y - 3) || sol(map, x - 7, y + 3) || sol(map, x + 7, y + 3);
function go(map, o, vx, vy, sp, dt) { o.mv = (vx || vy) ? 1 : 0; if (!o.mv) return; const nx = o.x + vx * sp * dt, ny = o.y + vy * sp * dt; if (!blk(map, nx, o.y)) o.x = nx; if (!blk(map, o.x, ny)) o.y = ny; }

// ---------------------------------------------------------------- WebSocket mínimo
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function wsFrame(op, data) { const d = Buffer.isBuffer(data) ? data : Buffer.from(data || ''); let h;
  if (d.length < 126) h = Buffer.from([0x80 | op, d.length]);
  else if (d.length < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(d.length, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(d.length), 2); }
  return Buffer.concat([h, d]); }
class Conn {
  constructor(sock, ip) { this.sock = sock; this.ip = ip; this.buf = Buffer.alloc(0); this.frag = null; this.open = true; this.player = null; this.alive = true; this.rate = 0; this.rateT = now();
    sock.setNoDelay(true);
    sock.on('data', d => this.onData(d)); sock.on('close', () => this.onClose()); sock.on('error', () => this.onClose()); }
  send(o) { if (!this.open) return; try { this.sock.write(wsFrame(1, JSON.stringify(o))); } catch (e) { this.onClose(); } }
  close(code = 1000, reason = '') { if (!this.open) return; const b = Buffer.alloc(2 + Buffer.byteLength(reason)); b.writeUInt16BE(code, 0); b.write(reason, 2); try { this.sock.write(wsFrame(8, b)); this.sock.end(); } catch (e) {} this.onClose(); }
  onData(d) { this.buf = Buffer.concat([this.buf, d]); if (this.buf.length > 1 << 20) return this.close(1009, 'grande demais');
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1], fin = b0 & 0x80, op = b0 & 15, masked = b1 & 0x80; let len = b1 & 127, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 1 << 20) return this.close(1009, 'grande demais');
      if (this.buf.length < off + (masked ? 4 : 0) + len) return;
      let mask = null; if (masked) { mask = this.buf.subarray(off, off + 4); off += 4; }
      const pl = Buffer.from(this.buf.subarray(off, off + len)); if (mask) for (let i = 0; i < pl.length; i++) pl[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + len);
      if (op === 8) { this.close(1000); return; }
      if (op === 9) { try { this.sock.write(wsFrame(10, pl)); } catch (e) {} continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 0) { if (!this.frag) continue; this.frag.push(pl); if (fin) { const all = Buffer.concat(this.frag); this.frag = null; this.onText(all.toString('utf8')); } continue; }
      if (op === 1) { if (!fin) { this.frag = [pl]; continue; } this.onText(pl.toString('utf8')); }
    } }
  onText(s) { this.alive = true; const t = now(); if (t - this.rateT > 1) { this.rateT = t; this.rate = 0; } if (++this.rate > 80) return; // anti-flood
    let m; try { m = JSON.parse(s); } catch (e) { return; } if (!m || typeof m.t !== 'string') return;
    try { onMessage(this, m); } catch (e) { log('erro', m.t, e.stack); } }
  onClose() { if (!this.open) return; this.open = false; try { this.sock.destroy(); } catch (e) {} onDisconnect(this); }
}

// ---------------------------------------------------------------- estado
const players = new Map();   // uid -> jogador conectado
const rooms = {};            // mapa -> sala
const parties = new Map();   // id -> {id, leader, members:[uid]}
const memberParty = new Map(); // uid -> partyId (inclui desconectados no período de tolerância)
const offlineInfo = new Map(); // uid -> {nome, lv, map, until}

function room(map) {
  if (!rooms[map]) { const r = rooms[map] = { map, players: new Set(), mobs: [], eps: [], epSeq: 0 };
    const b = MAPS[map].boss; if (b) r.mobs.push(newFox(map, b));
    (MAPS[map].areas || []).forEach((A, ai) => (A.mobs || []).forEach(en => { const d = MOBDEFS[en.m]; if (!d) return;
      for (let k = 0; k < clamp(en.n | 0, 0, 40); k++) r.mobs.push(newMob(r, d, A, map + ':a' + ai + ':' + d.id + ':' + k)); })); }
  return rooms[map]; }
function newFox(map, b) { const x = b[0] * T, y = b[1] * T;
  const d = FOXDEF(), vida = Math.max(1, num(d.vida, 300) | 0);
  return { id: map + ':raposa', kind: 'raposa', t: 'raposa', def: d, nome: d.name || 'Raposa de Nove Caudas', boss: 1, rad: 56, max: vida, hp: vida, hx: x, hy: y, x, y,
    dead: 0, dt: 0, rt: 0, mv: 0, fl: 0, ch: 0, fired: 0, bc: 0, lunge: 0, dmgp: 0, atk: 0, jc: 0, ja: 0, jz: 0, jx: 0, jy: 0, sx: 0, sy: 0, jcd: 3,
    stun: 0, hurt: 0, wt: 0, wa: 0, wm: 0, dmg: {}, alone: 0, aim: null, jt: null }; }
function mobDef(e) { return { id: e.id, kind: e.kind, nome: e.nome, boss: e.boss, rad: e.rad, max: e.max, t: e.t || '', lv: num((e.def || {}).nivel, 1) | 0 }; }

// ---------------------------------------------------------------- mobs comuns (criados no editor, nas áreas do mapa)
function inSafe(map, x, y, extra) { if (!(CFG.safe > 0)) return false; const s = MAPS[map].spawn; return !!s && hyp(x - s[0] * T, y - s[1] * T) < (CFG.safe + (extra || 0)) * T; }
// distância "ideal" entre os mobs de uma área (em tiles): cresce com o tamanho da área e diminui com a quantidade
function areaGap(A) { if (A._gap == null) { let n = 0; for (const en of A.mobs || []) n += clamp(en.n | 0, 0, 40); A._gap = Math.sqrt(Math.max(1, A.w * A.h) / Math.max(1, n)) * .7; } return A._gap; }
// sorteia vários pontos na área inteira e fica com o mais longe dos outros mobs da mesma área
function spreadPoint(r, A, self) { let best = null, bd = -1; const want = areaGap(A) * T;
  for (let i = 0; i < 30; i++) { const p = areaPoint(r.map, A); let md = 1e9;
    for (const o of r.mobs) if (o !== self && o.kind === 'mob' && o.A === A && !o.dead) md = Math.min(md, hyp(o.x - p[0], o.y - p[1]), hyp(o.hx - p[0], o.hy - p[1]));
    if (md >= want) return p; if (md > bd) { bd = md; best = p; } }
  return best || areaPoint(r.map, A); }
// passeio: fica rondando o próprio ponto (assim eles continuam espalhados pela área)
function wanderPoint(r, e) { const A = e.A, rad = clamp(areaGap(A) * .45, 1.5, 6) * T;
  for (let i = 0; i < 12; i++) { const a = Math.random() * 6.2832, d = Math.sqrt(Math.random()) * rad,
    x = clamp(e.hx + Math.cos(a) * d, (A.x + .5) * T, (A.x + A.w - .5) * T), y = clamp(e.hy + Math.sin(a) * d, (A.y + .5) * T, (A.y + A.h - .5) * T);
    if (!blk(r.map, x, y)) return [x, y]; }
  return [e.hx, e.hy]; }
function areaPoint(map, A) { for (let i = 0; i < 60; i++) { const x = (A.x + .5 + Math.random() * Math.max(0, A.w - 1)) * T, y = (A.y + .5 + Math.random() * Math.max(0, A.h - 1)) * T; if (!blk(map, x, y) && !inSafe(map, x, y, 1)) return [x, y]; } for (let i = 0; i < 40; i++) { const x = (A.x + .5 + Math.random() * Math.max(0, A.w - 1)) * T, y = (A.y + .5 + Math.random() * Math.max(0, A.h - 1)) * T; if (!blk(map, x, y)) return [x, y]; } return [(A.x + A.w / 2) * T, (A.y + A.h / 2) * T]; }
function newMob(r, d, A, id) { const [x, y] = spreadPoint(r, A, null), sc = clamp(num(d.escala, 100), 30, 400) / 100;
  return { id, kind: 'mob', t: d.id, def: d, A, nome: d.name || d.id, boss: 0, rad: Math.round(18 * sc), max: Math.max(1, d.vida | 0), hp: Math.max(1, d.vida | 0), hx: x, hy: y, x, y,
    dead: 0, dt: 0, rt: 0, mv: 0, fl: 0, ch: 0, lunge: 0, ja: 0, jz: 0, jc: 0, jx: 0, jy: 0, stun: 0, hurt: 0, atkT: 0, tg: null, back: 0, wt: 0, wx: x, wy: y, dmg: {}, alone: 0 }; }
function rectDist(A, x, y) { const x0 = A.x * T, y0 = A.y * T, x1 = (A.x + A.w) * T, y1 = (A.y + A.h) * T; return hyp(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1)); }
function mobTickG(r, e, dt) {
  const d = e.def;
  if (e.dead) { e.dt += dt; if ((e.rt -= dt) <= 0) { const [x, y] = spreadPoint(r, e.A, e); Object.assign(e, { x, y, hx: x, hy: y, hp: e.max, dead: 0, dt: 0, tg: null, back: 0, dmg: {}, stun: 0, hurt: 0, lunge: 0 }); } return; }
  e.hurt = Math.max(0, e.hurt - dt); e.lunge = Math.max(0, e.lunge - dt); e.atkT -= dt;
  if (e.stun > 0) { e.stun -= dt; e.mv = 0; return; }
  const vel = clamp(num(d.vel, 70), 10, 300), leash = clamp(num(d.persegue, 8), 1, 40) * T, vis = clamp(num(d.visao, 6), 0, 20) * T;
  // ninguém por perto por um tempo: volta inteira para a área
  let nd = 1e9; for (const q of r.players) if (!q.sc && q.hp > 0) nd = Math.min(nd, hyp(q.x - e.x, q.y - e.y));
  if (nd > CFG.resetNear * T) { e.alone += dt; if (e.alone >= CFG.resetWait && (e.hp < e.max || Object.keys(e.dmg).length)) { e.hp = e.max; e.dmg = {}; e.tg = null; e.back = 1; const p = spreadPoint(r, e.A, e); e.hx = p[0]; e.hy = p[1]; } } else e.alone = 0;
  // alvo: continua com o atual enquanto ele estiver dentro do limite de perseguição
  let tg = e.tg;
  if (tg && (!r.players.has(tg) || tg.sc || tg.hp <= 0 || rectDist(e.A, tg.x, tg.y) > leash || inSafe(r.map, tg.x, tg.y))) { tg = null; e.tg = null; e.back = 1; const p = spreadPoint(r, e.A, e); e.hx = p[0]; e.hy = p[1]; }
  if (!tg && !e.back && vis > 0) { let best = null, bd = vis; for (const q of r.players) { if (q.sc || q.hp <= 0 || rectDist(e.A, q.x, q.y) > leash || inSafe(r.map, q.x, q.y)) continue; const dd = hyp(q.x - e.x, q.y - e.y); if (dd <= bd) { bd = dd; best = q; } } if (best) { tg = e.tg = best; } }
  let vx = 0, vy = 0, sp = vel;
  if (e.back) { // voltando para casa: não aceita alvo e recupera a vida ao chegar
    const hd = hyp(e.hx - e.x, e.hy - e.y); if (hd < T * .8 || rectDist(e.A, e.x, e.y) === 0 && hd < 3 * T) { e.back = 0; e.hp = e.max; e.dmg = {}; } else { vx = (e.hx - e.x) / hd; vy = (e.hy - e.y) / hd; sp = vel * 1.6; } }
  else if (tg) {
    const dx = tg.x - e.x, dy = tg.y - e.y, dd = hyp(dx, dy), reach = clamp(num(d.alcance, 1), .5, 8) * T + 12 + e.rad * .4;
    if (dd > reach) { vx = dx / dd; vy = dy / dd; }
    else if (e.atkT <= 0 && !inSafe(r.map, tg.x, tg.y)) { e.atkT = clamp(num(d.atkInt, 1.2), .3, 10); e.lunge = .3; hurtP(tg, Math.max(1, Math.round(num(d.dano, 5))), 0, 0, e.nome, num(d.precisao, 0)); }
    if (Math.abs(dx) > 3) e.fl = dx < 0 ? 1 : 0;
  } else { // passeia dentro da área
    if ((e.wt -= dt) <= 0) { e.wt = 2 + Math.random() * 3; if (Math.random() < .55) { const [x, y] = wanderPoint(r, e); e.wx = x; e.wy = y; } else { e.wx = e.x; e.wy = e.y; } }
    const wd = hyp(e.wx - e.x, e.wy - e.y); if (wd > 6) { vx = (e.wx - e.x) / wd; vy = (e.wy - e.y) / wd; sp = vel * .5; } }
  if (tg) { // não empilha: afasta um pouco dos outros mobs
    let px = 0, py = 0; for (const o of r.mobs) { if (o === e || o.dead || o.kind !== 'mob') continue; const dx = e.x - o.x, dy = e.y - o.y, dd = hyp(dx, dy), mn = (e.rad + o.rad) * .9; if (dd > 0.01 && dd < mn) { px += dx / dd * (mn - dd) / mn; py += dy / dd * (mn - dd) / mn; } }
    if (px || py) { vx += px * 1.2; vy += py * 1.2; const l = hyp(vx, vy); if (l > 1) { vx /= l; vy /= l; } } }
  if (!tg && Math.abs(vx) > .05) e.fl = vx < 0 ? 1 : 0;
  const ox = e.x, oy = e.y; go(r.map, e, vx, vy, sp, dt);
  if (e.mv && e.x === ox && e.y === oy) { e.wt = 0; if (e.back) { e.x = e.hx; e.y = e.hy; } } // preso numa parede
}
const MK = ['x', 'y', 'hp', 'max', 'dead', 'dt', 'mv', 'fl', 'ch', 'lunge', 'ja', 'jz', 'jc', 'jx', 'jy', 'stun', 'hurt', 'rt'];
const mobState = e => MK.map(k => { const v = e[k]; return typeof v === 'number' ? Math.round(v * 100) / 100 : (v ? 1 : 0); });

function toRoom(r, o, except) { const s = JSON.stringify(o), fr = wsFrame(1, s); for (const p of r.players) if (p !== except && p.conn.open) { try { p.conn.sock.write(fr); } catch (e) {} } }
function sys(p, msg) { p.conn.send({ t: 'sys', msg }); }
const pub = p => ({ id: p.id, nome: p.nome, clan: p.clan, lv: p.lv, eq: p.eq, look: p.look, x: p.x, y: p.y, fl: p.fl, mv: p.mv, run: p.run, au: p.au, th: p.th, sc: p.sc, hp: p.hp, max: p.max, g: memberParty.get(p.id) || 0, adm: p.adm ? 1 : 0 });

// ---------------------------------------------------------------- inventário no banco (anti-duplicação)
// Com a chave secreta + o SQL 04, só o servidor cria/move itens: drops, trocas e comandos de admin.
let INV_OK = false, INV_WHY = 'iniciando';
async function svc(pth, opt = {}) {
  const h = { apikey: SB_SVC, 'Content-Type': 'application/json' }; if (SB_SVC.startsWith('eyJ')) h.Authorization = 'Bearer ' + SB_SVC;
  const r = await fetch(SB_URL + pth, Object.assign({}, opt, { headers: Object.assign(h, opt.headers || {}), signal: AbortSignal.timeout(10000) }));
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) { const e = new Error((j && (j.message || j.msg || j.hint)) || ('Erro ' + r.status)); e.status = r.status; throw e; } return j;
}
const rpc = (fn, args) => svc('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args) });
async function invCheck() {
  if (!SB_URL || !SB_SVC) { INV_OK = false; INV_WHY = 'falta a chave secreta (SUPABASE_SERVICE_KEY) no Render'; return; }
  try { await rpc('dar_itens', { p_personagem: '00000000-0000-0000-0000-000000000000', p_itens: [] }); INV_OK = true; INV_WHY = ''; }
  catch (e) { INV_OK = false; INV_WHY = e.status === 404 ? 'falta rodar o SQL 04 (trocas) no Supabase' : 'o banco recusou a chave do servidor (' + e.message + ')'; }
  log('inventário pelo servidor: ' + (INV_OK ? 'ligado' : 'desligado — ' + INV_WHY));
}
setTimeout(invCheck, 500); setInterval(invCheck, 5 * 60 * 1000);
async function invOf(uid) { const rows = await svc('/rest/v1/inventario?select=item,equipado&personagem_id=eq.' + encodeURIComponent(uid)); return rows || []; }
// dá itens (drop/admin); cada nome = 1 unidade; devolve o que entrou de fato
async function giveDb(uid, items) { if (!items.length) return []; const got = await rpc('dar_itens', { p_personagem: uid, p_itens: items }); return Array.isArray(got) ? got : []; }

// ---------------------------------------------------------------- trocas
const TRADE = { near: 10, maxItems: 6, maxQty: 999, inviteTtl: 30 }; // até 6 tipos de item, cada um com a quantidade que quiser
const offN = L => L.reduce((a, x) => a + x.n, 0);
const offFlat = L => L.flatMap(x => Array(x.n).fill(x.i)); // [{i:'kunai',n:2}] -> ['kunai','kunai'] (formato do banco)
const trades = new Map(), inTrade = new Map(); let tradeSeq = 0;
const tNear = (p, q) => p && q && p.map && p.map === q.map && !p.sc && !q.sc && hyp(p.x - q.x, p.y - q.y) <= TRADE.near * T;
function tSend(t) { for (const [me, ot] of [[t.a, t.b], [t.b, t.a]]) { const q = players.get(me), o = players.get(ot); if (!q) continue;
  q.conn.send({ t: 'trade', id: t.id, other: { id: ot, nome: o ? o.nome : '?' }, mine: t.off[me], theirs: t.off[ot], ok: [!!t.ok[me], !!t.ok[ot]], conf: [!!t.conf[me], !!t.conf[ot]], busy: t.busy ? 1 : 0 }); } }
function tEnd(t, msg) { if (!trades.has(t.id)) return; trades.delete(t.id); inTrade.delete(t.a); inTrade.delete(t.b);
  for (const u of [t.a, t.b]) { const q = players.get(u); if (q) q.conn.send({ t: 'tend', id: t.id, msg: msg || '' }); } }
function tradeInvite(p, to) {
  if (!INV_OK) return sys(p, 'As trocas ainda estão desligadas no servidor.');
  const q = players.get(to); if (!q || q === p) return sys(p, 'Jogador não encontrado.');
  if (!tNear(p, q)) return sys(p, q.nome + ' precisa estar perto de você (até ' + TRADE.near + ' tiles).');
  if (inTrade.has(p.id) || inTrade.has(q.id)) return sys(p, (inTrade.has(p.id) ? 'Você' : q.nome) + ' já está em uma troca.');
  q.tinv = q.tinv || new Map(); q.tinv.set(p.id, now() + TRADE.inviteTtl);
  q.conn.send({ t: 'tinvite', from: p.id, nome: p.nome, ttl: TRADE.inviteTtl }); sys(p, 'Pedido de troca enviado para ' + q.nome + '.');
}
function tradeAccept(p, from) {
  const exp = p.tinv && p.tinv.get(from); if (p.tinv) p.tinv.delete(from); const q = players.get(from);
  if (!exp || exp < now() || !q) return sys(p, 'O pedido de troca expirou.');
  if (!tNear(p, q)) return sys(p, 'Vocês precisam estar perto para trocar.');
  if (inTrade.has(p.id) || inTrade.has(q.id)) return sys(p, 'Um de vocês já está em uma troca.');
  const t = { id: ++tradeSeq, a: q.id, b: p.id, off: { [q.id]: [], [p.id]: [] }, ok: {}, conf: {}, busy: false };
  trades.set(t.id, t); inTrade.set(t.a, t.id); inTrade.set(t.b, t.id); tSend(t);
}
async function tradeOffer(p, items) {
  const t = trades.get(inTrade.get(p.id)); if (!t || t.busy) return;
  const want = new Map(); // item -> quantidade (aceita [{i,n}] ou lista simples de nomes)
  for (const x of (Array.isArray(items) ? items : []).slice(0, 50)) { const id = str(x && typeof x === 'object' ? x.i : x, 40), n = x && typeof x === 'object' ? clamp(num(x.n, 1) | 0, 0, TRADE.maxQty) : 1;
    if (ITEMS[id] && n > 0 && (want.has(id) || want.size < TRADE.maxItems)) want.set(id, Math.min(TRADE.maxQty, (want.get(id) || 0) + n)); }
  let have; try { have = await invOf(p.id); } catch (e) { return sys(p, 'Não consegui ver sua mochila no banco. Tente de novo.'); }
  const livres = {}; for (const r of have) if (!r.equipado) livres[r.item] = (livres[r.item] || 0) + 1; // só o que não está equipado
  if (!trades.has(t.id) || t.busy) return;
  t.off[p.id] = [...want].map(([i, n]) => ({ i, n: Math.min(n, livres[i] || 0) })).filter(x => x.n > 0);
  t.ok = {}; t.conf = {}; tSend(t); // qualquer mudança desfaz o "pronto" dos dois
}
function tradeLock(p) { const t = trades.get(inTrade.get(p.id)); if (!t || t.busy) return;
  if (!t.off[t.a].length && !t.off[t.b].length) return sys(p, 'Coloque pelo menos um item na troca (pode ser só de um lado, como presente).');
  t.ok[p.id] = true; t.conf = {}; tSend(t); }
async function tradeConfirm(p) {
  const t = trades.get(inTrade.get(p.id)); if (!t || t.busy) return; if (!t.ok[t.a] || !t.ok[t.b]) return sys(p, 'Os dois precisam apertar "Pronto" antes.');
  t.conf[p.id] = true; tSend(t); if (!t.conf[t.a] || !t.conf[t.b]) return;
  const A = players.get(t.a), B = players.get(t.b); if (!tNear(A, B)) return tEnd(t, 'Vocês se afastaram, a troca foi cancelada.');
  t.busy = true; tSend(t);
  try {
    await rpc('trocar_itens', { p_a: t.a, p_b: t.b, p_ia: offFlat(t.off[t.a]), p_ib: offFlat(t.off[t.b]) }); // as unidades escolhidas mudam de dono juntas, dentro do banco
    for (const [me, ot] of [[t.a, t.b], [t.b, t.a]]) { const q = players.get(me); if (q) q.conn.send({ t: 'tdone', deu: t.off[me], ganhou: t.off[ot], com: (players.get(ot) || {}).nome || '?' }); }
    const ls = L => L.map(x => x.n + 'x ' + x.i).join(', '); log('troca ' + t.id + ': ' + t.a + ' [' + ls(t.off[t.a]) + '] <-> ' + t.b + ' [' + ls(t.off[t.b]) + ']');
    trades.delete(t.id); inTrade.delete(t.a); inTrade.delete(t.b);
  } catch (e) {
    const why = /não está/.test(e.message) ? 'um item não está mais na mochila (foi equipado ou usado)' : 'erro no banco';
    tEnd(t, 'A troca não foi feita: ' + why + '. Nada mudou nas mochilas.');
  }
}
function tradeTick() { for (const t of trades.values()) { if (t.busy) continue; const A = players.get(t.a), B = players.get(t.b);
  if (!A || !B) tEnd(t, 'O outro jogador saiu. Troca cancelada.'); else if (!tNear(A, B)) tEnd(t, 'Vocês se afastaram. Troca cancelada.'); } }
// admin: itens de teste direto no banco
async function admItems(p, m) { if (!p.adm) return; if (!INV_OK) return sys(p, '[ADM] Inventário pelo servidor desligado: ' + INV_WHY);
  try { if (m.t === 'admitem') await giveDb(p.id, Object.keys(ITEMS)); else await svc('/rest/v1/inventario?personagem_id=eq.' + encodeURIComponent(p.id), { method: 'DELETE' });
    p.conn.send({ t: 'invreload' }); } catch (e) { sys(p, '[ADM] Erro no banco: ' + e.message); } }

// ---------------------------------------------------------------- comandos de admin no chat
// Mensagem que começa com "/" não vai para o chat: só quem mandou recebe a resposta.
// /admin nome · /desadmin nome · /ajuda  (só para quem já é admin; para os outros é "comando desconhecido")
async function findChar(nome) {
  const low = nome.toLowerCase();
  for (const q of players.values()) if (q.nome.toLowerCase() === low) return { id: q.id, nome: q.nome };
  const pat = nome.replace(/[\\%_*]/g, c => '\\' + c); // "_" é curinga no ilike: procura o nome exato
  const rows = await svc('/rest/v1/personagens?select=id,nome&nome=ilike.' + encodeURIComponent(pat) + '&limit=5');
  const r = (rows || []).find(x => String(x.nome).toLowerCase() === low); return r ? { id: r.id, nome: r.nome } : null; }
async function setAdmin(id, on) {
  const r = await svc('/rest/v1/personagens?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ admin: on }) });
  return Array.isArray(r) && r.length > 0; }
// banimento: tabela "banidos" (sql/05_banimento.sql), só o servidor lê e grava
async function banOf(id) { // devolve {ate, motivo} se estiver banido agora; null se não
  const rows = await svc('/rest/v1/banidos?select=ate,motivo&personagem_id=eq.' + encodeURIComponent(id));
  const b = rows && rows[0]; if (!b) return null; if (b.ate && Date.parse(b.ate) <= Date.now()) return null; return b; }
const banMsg = b => ({ t: 'banned', ate: b.ate || null, motivo: b.motivo || '' });
function parseDur(t) { const m = /^(\d{1,4})(m|h|d)$/i.exec(t || ''); if (!m) return null; return +m[1] * { m: 60, h: 3600, d: 86400 }[m[2].toLowerCase()] * 1000; }
const durTxt = ms => { const m = ms / 60000; return m % 1440 === 0 ? m / 1440 + (m / 1440 > 1 ? ' dias' : ' dia') : m % 60 === 0 ? m / 60 + 'h' : m + ' min'; };
async function cmdBan(p, me, parts) {
  const nome = (parts[1] || '').replace(/^@/, ''); let i = 2, dur = parseDur(parts[2]); if (dur) i = 3;
  const motivo = parts.slice(i).join(' ').slice(0, 60);
  if (!/^[A-Za-z0-9_]{3,14}$/.test(nome)) return me('Use assim: /ban nome [tempo] [motivo]  ·  tempo: 30m, 2h, 7d (sem tempo = para sempre)');
  if (!SB_SVC) return me('Para isso o servidor precisa da chave secreta (SUPABASE_SERVICE_KEY) no Render.');
  try {
    const t = await findChar(nome); if (!t) return me('Jogador "' + nome + '" não encontrado.');
    if (t.id === p.id) return me('Você não pode banir a si mesmo.');
    const q = players.get(t.id);
    const adm = q ? q.adm : !!((await svc('/rest/v1/personagens?select=admin&id=eq.' + encodeURIComponent(t.id)))[0] || {}).admin;
    if (adm) return me(t.nome + ' é admin: tire o admin antes (/desadmin ' + t.nome + ').');
    const ate = dur ? new Date(Date.now() + dur).toISOString() : null;
    await svc('/rest/v1/banidos?on_conflict=personagem_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ personagem_id: t.id, ate, motivo: motivo || null, por: p.nome, quando: new Date().toISOString() }) });
    if (q) { q.kicked = true; q.conn.send(banMsg({ ate, motivo })); q.conn.close(4005, 'ban'); }
    log('ADM:', p.nome, 'baniu', t.nome, dur ? 'por ' + durTxt(dur) : 'para sempre', motivo ? '(' + motivo + ')' : '');
    me('⛔ ' + t.nome + ' foi banido ' + (dur ? 'por ' + durTxt(dur) : 'para sempre') + (motivo ? ' (motivo: ' + motivo + ')' : '') + (q ? ' e saiu do jogo.' : '.'));
  } catch (e) { me(e.status === 404 ? 'Falta rodar o sql/05_banimento.sql no Supabase.' : 'Erro no banco: ' + e.message); }
}
async function cmdUnban(p, me, parts) {
  const nome = (parts[1] || '').replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{3,14}$/.test(nome)) return me('Use assim: /unban nome');
  if (!SB_SVC) return me('Para isso o servidor precisa da chave secreta (SUPABASE_SERVICE_KEY) no Render.');
  try {
    const t = await findChar(nome); if (!t) return me('Jogador "' + nome + '" não encontrado.');
    const r = await svc('/rest/v1/banidos?personagem_id=eq.' + encodeURIComponent(t.id), { method: 'DELETE', headers: { Prefer: 'return=representation' } });
    log('ADM:', p.nome, 'desbaniu', t.nome);
    me(Array.isArray(r) && r.length ? '✅ ' + t.nome + ' foi desbanido e já pode entrar.' : t.nome + ' não estava banido.');
  } catch (e) { me(e.status === 404 ? 'Falta rodar o sql/05_banimento.sql no Supabase.' : 'Erro no banco: ' + e.message); }
}
async function cmdBanList(p, me) {
  if (!SB_SVC) return me('Para isso o servidor precisa da chave secreta (SUPABASE_SERVICE_KEY) no Render.');
  try {
    const rows = await svc('/rest/v1/banidos?select=ate,motivo,personagens(nome)&order=quando.desc&limit=20');
    const L = (rows || []).filter(b => !b.ate || Date.parse(b.ate) > Date.now());
    if (!L.length) return me('Ninguém banido agora.');
    me('Banidos: ' + L.map(b => ((b.personagens || {}).nome || '?') + (b.ate ? ' (até ' + b.ate.slice(0, 16).replace('T', ' ') + ' UTC)' : ' (para sempre)')).join(' · '));
  } catch (e) { me(e.status === 404 ? 'Falta rodar o sql/05_banimento.sql no Supabase.' : 'Erro no banco: ' + e.message); }
}
async function onCmd(p, m) {
  const txt = str(m.text, 80).trim(), parts = txt.split(/\s+/), cmd = (parts[0] || '').toLowerCase(), arg = parts.slice(1).join(' ').replace(/^@/, '');
  const me = msg => p.conn.send({ t: 'cmdr', msg });
  if (!p.adm) return me('Comando desconhecido.');
  if (cmd === '/ajuda' || cmd === '/help') return me('Comandos de admin (ninguém mais vê): /admin nome · /desadmin nome · /ban nome [tempo] [motivo] (tempo: 30m, 2h, 7d; sem tempo = para sempre) · /unban nome · /banidos');
  if (cmd === '/ban') return cmdBan(p, me, parts);
  if (cmd === '/unban' || cmd === '/desbanir') return cmdUnban(p, me, parts);
  if (cmd === '/banidos') return cmdBanList(p, me);
  if (cmd !== '/admin' && cmd !== '/desadmin') return me('Comando desconhecido. Digite /ajuda.');
  const on = cmd === '/admin';
  if (!/^[A-Za-z0-9_]{3,14}$/.test(arg)) return me('Use assim: ' + cmd + ' nomedojogador');
  if (!SB_SVC) return me('Para isso o servidor precisa da chave secreta (SUPABASE_SERVICE_KEY) no Render.');
  try {
    const t = await findChar(arg); if (!t) return me('Jogador "' + arg + '" não encontrado.');
    if (!on && t.id === p.id) return me('Você não pode tirar o seu próprio admin.');
    if (!(await setAdmin(t.id, on))) return me('Não consegui gravar no banco.');
    const q = players.get(t.id);
    if (q) { q.adm = on; q.conn.send({ t: 'adm', on: on ? 1 : 0 }); if (q.map) toRoom(room(q.map), { t: 'pm', id: q.id, adm: on ? 1 : 0 }, q); }
    log('ADM:', p.nome, on ? 'deu admin para' : 'tirou o admin de', t.nome);
    me(on ? '✅ ' + t.nome + ' agora é admin' + (q ? '.' : ' (vale quando ele entrar no jogo).') : '✅ ' + t.nome + ' não é mais admin.');
  } catch (e) { me('Erro no banco: ' + e.message); }
}

// ---------------------------------------------------------------- autenticação
async function verifyToken(token) {
  if (!SB_URL || !SB_KEY) throw new Error('servidor sem configuração do Supabase');
  const h = { apikey: SB_KEY, Authorization: 'Bearer ' + token };
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: h, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('token inválido (' + r.status + ')');
  const u = await r.json(); if (!u || !u.id) throw new Error('token inválido');
  // TAG admin: coluna "admin" da tabela personagens (só o dono do projeto muda, pelo painel do Supabase)
  let adm = false;
  try { const q = await fetch(SB_URL + '/rest/v1/personagens?select=admin&id=eq.' + u.id, { headers: h, signal: AbortSignal.timeout(8000) });
    if (q.ok) { const rows = await q.json(); adm = !!(rows[0] && rows[0].admin === true); } } catch (e) {}
  let ban = null; if (SB_SVC) { try { ban = await banOf(u.id); } catch (e) {} } // sem a tabela (SQL 05) ninguém fica banido
  return { id: u.id, adm, ban, nome: str((u.user_metadata && u.user_metadata.nome) || (u.email || '').split('@')[0], 14) };
}

// ---------------------------------------------------------------- mensagens
function onMessage(c, m) {
  if (m.t === 'ping') return c.send({ t: 'pong', c: m.c });
  if (!c.player) {
    if (m.t !== 'auth' || c.authing) return;
    if (m.v !== PROTO) { c.send({ t: 'old', v: PROTO, msg: 'Seu app está desatualizado. Baixe a versão nova do jogo.' }); return c.close(4000, 'versao'); }
    c.authing = true;
    verifyToken(str(m.token, 4000)).then(u => {
      if (!c.open) return;
      if (u.ban) { log('banido tentou entrar:', u.nome); c.send(banMsg(u.ban)); return c.close(4005, 'ban'); }
      const old = players.get(u.id);
      if (old && old.conn.open) { old.conn.send({ t: 'kicked', msg: 'Sua conta entrou em outro aparelho.' }); old.kicked = true; old.conn.close(4001, 'duplicado'); }
      const p = { id: u.id, nome: u.nome, adm: u.adm, conn: c, map: null, x: 0, y: 0, fl: 0, mv: 0, run: 0, au: -1, th: -1, sc: 0, hp: 100, max: 100, lv: 1, clan: 'uchiha', eq: [], look: null, hitT: now(), hitN: 0 };
      c.player = p; players.set(u.id, p); offlineInfo.delete(u.id);
      c.send({ t: 'welcome', id: u.id, nome: u.nome, adm: u.adm ? 1 : 0, inv: INV_OK ? 1 : 0, invWhy: u.adm ? INV_WHY : '', cfg: { aggro: CFG.aggro, resetNear: CFG.resetNear, resetHome: CFG.resetHome, partyMax: CFG.partyMax, pvp: CFG.pvp, pvpSafe: CFG.pvpSafe } });
      const pid = memberParty.get(u.id); if (pid) partySync(parties.get(pid));
      log('entrou', u.nome + (u.adm ? ' [ADM]' : ''), '(' + players.size + ' online)');
    }).catch(e => { c.send({ t: 'authfail', msg: String(e.message || e) }); c.close(4002, 'auth'); });
    return;
  }
  const p = c.player;
  switch (m.t) {
    case 'join': return onJoin(p, m);
    case 'pos': if (!p.map) return;
      p.x = clamp(num(m.x, p.x), 0, 50 * T); p.y = clamp(num(m.y, p.y), 0, 50 * T); p.fl = m.fl ? 1 : 0; p.mv = m.mv ? 1 : 0; p.run = m.run ? 1 : 0;
      p.au = num(m.au, -1); p.th = num(m.th, -1); p.sc = m.sc ? 1 : 0; p.hp = clamp(num(m.hp, p.hp), 0, 1e5); p.max = clamp(num(m.max, p.max), 1, 1e5); p.ct = Number.isFinite(m.c) ? Math.round(m.c) : null; p.dirty = true; return;
    case 'meta': setMeta(p, m); if (p.map) toRoom(room(p.map), { t: 'pm', id: p.id, lv: p.lv, eq: p.eq, look: p.look, clan: p.clan }, p); return;
    case 'fx': if (!p.map) return; {
      const fx = Array.isArray(m.fx) ? m.fx.slice(0, 8) : [], pr = Array.isArray(m.pr) ? m.pr.slice(0, 8) : [];
      if (fx.length || pr.length) toRoom(room(p.map), { t: 'fx', id: p.id, fx, pr }, p); } return;
    case 'chat': { const text = str(m.text, 80).trim(); if (!text) return;
      if (m.ch === 'g') { const pt = parties.get(memberParty.get(p.id)); if (!pt) return sys(p, 'Você não está em um grupo.');
        for (const u of pt.members) { const q = players.get(u); if (q) q.conn.send({ t: 'chat', id: p.id, nome: p.nome, text, ch: 'g' }); } }
      else if (m.ch === 'l') { if (!p.map) return; const o = JSON.stringify({ t: 'chat', id: p.id, nome: p.nome, text, ch: 'l' });
        for (const q of room(p.map).players) if (q.sc === p.sc && hyp(q.x - p.x, q.y - p.y) <= CFG.localChat * T && q.conn.open) { try { q.conn.sock.write(wsFrame(1, o)); } catch (e) {} } }
      else if (p.map) toRoom(room(p.map), { t: 'chat', id: p.id, nome: p.nome, text, ch: 'm' }); } return;
    case 'hit': return onHit(p, m);
    case 'cmd': return onCmd(p, m);
    case 'pvp': return onPvp(p, m);
    case 'phr': return onPvpResult(p, m);
    case 'tinv': return tradeInvite(p, str(m.to, 64));
    case 'tacc': return tradeAccept(p, str(m.from, 64));
    case 'tdec': { const f = str(m.from, 64), q = players.get(f); if (p.tinv) p.tinv.delete(f); if (q) sys(q, p.nome + ' recusou a troca.'); } return;
    case 'toff': return tradeOffer(p, m.items);
    case 'tlock': return tradeLock(p);
    case 'tconf': return tradeConfirm(p);
    case 'tcancel': { const t = trades.get(inTrade.get(p.id)); if (t && !t.busy) tEnd(t, p.nome + ' cancelou a troca.'); } return;
    case 'admitem': case 'admreset': return admItems(p, m);
    case 'pinv': return partyInvite(p, str(m.to, 64));
    case 'pacc': return partyAccept(p, str(m.from, 64));
    case 'pdec': { const q = players.get(str(m.from, 64)); if (p.invites) p.invites.delete(str(m.from, 64)); if (q) sys(q, p.nome + ' recusou o convite.'); } return;
    case 'pleave': return partyLeave(p.id, 'saiu do grupo');
    case 'pkick': { const pt = parties.get(memberParty.get(p.id)); const id = str(m.id, 64);
      if (!pt || pt.leader !== p.id || id === p.id || !pt.members.includes(id)) return; partyLeave(id, 'foi removido do grupo'); } return;
  }
}
function setMeta(p, m) {
  if (m.lv != null) p.lv = clamp(num(m.lv, 1) | 0, 1, 99);
  if (Array.isArray(m.eq)) p.eq = m.eq.slice(0, 8).map(x => str(x, 40));
  if (m.look && typeof m.look === 'object') { const ok = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : undefined; p.look = { skin: ok(m.look.skin), hair: ok(m.look.hair), cloth: ok(m.look.cloth) }; }
  if (typeof m.clan === 'string' && /^(uchiha|hyuga|nara)$/.test(m.clan)) p.clan = m.clan;
  if (m.esq != null) p.esq = clamp(num(m.esq, 0), 0, 500);
  if (m.red != null) p.red = clamp(num(m.red, 0), -50, 90);
}
function onJoin(p, m) {
  const map = str(m.map, 40); if (!MAPS[map]) return sys(p, 'Mapa desconhecido.');
  if (p.map) leaveRoom(p);
  setMeta(p, m);
  p.x = clamp(num(m.x, MAPS[map].spawn[0] * T), 0, 50 * T); p.y = clamp(num(m.y, MAPS[map].spawn[1] * T), 0, 50 * T);
  p.hp = num(m.hp, 100); p.max = num(m.max, 100); p.sc = m.sc ? 1 : 0;
  const r = room(map); p.map = map; r.players.add(p);
  p.conn.send({ t: 'room', map, players: [...r.players].filter(q => q !== p).map(pub), mobs: r.mobs.map(e => ({ def: mobDef(e), s: mobState(e) })) });
  toRoom(r, { t: 'pj', p: pub(p) }, p);
  const pt = parties.get(memberParty.get(p.id)); if (pt) partySync(pt);
}
function leaveRoom(p) { { const t = trades.get(inTrade.get(p.id)); if (t && !t.busy) tEnd(t, p.nome + ' saiu do mapa. Troca cancelada.'); }
  const r = rooms[p.map]; if (!r) return; r.players.delete(p); toRoom(r, { t: 'pl', id: p.id }); p.map = null; }
function onDisconnect(c) {
  const p = c.player; if (!p) return;
  if (players.get(p.id) === p) players.delete(p.id);
  if (p.map) leaveRoom(p);
  const pid = memberParty.get(p.id);
  if (pid && !p.kicked) { offlineInfo.set(p.id, { nome: p.nome, lv: p.lv, until: now() + CFG.partyGrace }); partySync(parties.get(pid)); }
  log('saiu', p.nome, '(' + players.size + ' online)');
}

// ---------------------------------------------------------------- grupo
let partySeq = 0;
function partyInvite(p, to) {
  const q = players.get(to); if (!q || q === p) return sys(p, 'Jogador não encontrado.');
  if (memberParty.get(q.id)) return sys(p, q.nome + ' já está em um grupo.');
  const pt = parties.get(memberParty.get(p.id)); if (pt && pt.members.length >= CFG.partyMax) return sys(p, 'Seu grupo está cheio (' + CFG.partyMax + ').');
  q.invites = q.invites || new Map(); q.invites.set(p.id, now() + CFG.inviteTtl);
  q.conn.send({ t: 'pinvite', from: p.id, nome: p.nome, ttl: CFG.inviteTtl }); sys(p, 'Convite enviado para ' + q.nome + '.');
}
function partyAccept(p, from) {
  const exp = p.invites && p.invites.get(from); if (p.invites) p.invites.delete(from);
  if (!exp || exp < now()) return sys(p, 'Esse convite expirou.');
  if (memberParty.get(p.id)) return sys(p, 'Você já está em um grupo. Saia dele primeiro.');
  const q = players.get(from); if (!q) return sys(p, 'Quem te convidou saiu do jogo.');
  let pt = parties.get(memberParty.get(q.id));
  if (!pt) { pt = { id: 'g' + (++partySeq), leader: q.id, members: [q.id] }; parties.set(pt.id, pt); memberParty.set(q.id, pt.id); }
  if (pt.members.length >= CFG.partyMax) return sys(p, 'O grupo está cheio.');
  pt.members.push(p.id); memberParty.set(p.id, pt.id);
  partyNotice(pt, p.nome + ' entrou no grupo.'); partySync(pt); partyTagRooms(pt);
}
function partyLeave(uid, why) {
  const pt = parties.get(memberParty.get(uid)); if (!pt) return;
  const nome = (players.get(uid) || offlineInfo.get(uid) || {}).nome || 'Alguém';
  pt.members = pt.members.filter(x => x !== uid); memberParty.delete(uid); offlineInfo.delete(uid);
  const q = players.get(uid); if (q) { q.conn.send({ t: 'party', none: 1 }); sys(q, why === 'foi removido do grupo' ? 'Você foi removido do grupo.' : 'Você saiu do grupo.'); tagPlayer(q); }
  if (pt.members.length <= 1) { for (const u of pt.members) { memberParty.delete(u); const r = players.get(u); if (r) { r.conn.send({ t: 'party', none: 1 }); sys(r, 'O grupo foi desfeito.'); tagPlayer(r); } } parties.delete(pt.id); return; }
  if (pt.leader === uid) pt.leader = pt.members.find(u => players.has(u)) || pt.members[0];
  partyNotice(pt, nome + ' ' + why + '.'); partySync(pt);
}
function partyNotice(pt, msg) { for (const u of pt.members) { const q = players.get(u); if (q) sys(q, msg); } }
function partyState(pt) { return { t: 'party', id: pt.id, leader: pt.leader, members: pt.members.map(u => { const q = players.get(u), o = offlineInfo.get(u);
  return q ? { id: u, nome: q.nome, lv: q.lv, map: q.map, hp: Math.round(q.hp), max: q.max, on: 1 } : { id: u, nome: o ? o.nome : '?', lv: o ? o.lv : 1, map: null, hp: 0, max: 1, on: 0 }; }) }; }
function partySync(pt) { if (!pt) return; const s = partyState(pt); for (const u of pt.members) { const q = players.get(u); if (q) q.conn.send(s); } }
function tagPlayer(q) { if (q.map) toRoom(room(q.map), { t: 'pm', id: q.id, g: memberParty.get(q.id) || 0 }, q); }
function partyTagRooms(pt) { for (const u of pt.members) { const q = players.get(u); if (q) tagPlayer(q); } }
function groupKey(uid) { const g = memberParty.get(uid); return g ? g : 'u:' + uid; }

// ---------------------------------------------------------------- combate: jogador → raposa
function onHit(p, m) {
  if (!p.map || p.sc) return; const r = room(p.map); const e = r.mobs.find(x => x.id === m.m); if (!e || e.dead) return;
  const t = now(); if (t - p.hitT > 1) { p.hitT = t; p.hitN = 0; } if (++p.hitN > 25) return;
  if (hyp(p.x - e.x, p.y - e.y) > CFG.hitRange) return;
  let d = Math.round(clamp(num(m.d, 0), 0, CFG.maxHit)); if (!d) return;
  if (e.back) return; if (e.kind === 'mob' && !e.tg) e.tg = p;
  const pr = clamp(num(m.pr, 0), 0, 5000), esq = num((e.def || {}).esquiva, 0);
  if (Math.random() * 100 < dodgeChance(esq, pr)) { e.alone = 0; toRoom(r, { t: 'mh', m: e.id, d: 0, miss: 1, by: p.id }); return; }
  e.hp -= d; e.hurt = .28; e.alone = 0;
  const st = clamp(num(m.st, 0), 0, 8); if (st) e.stun = Math.max(e.stun, st); // até 8 s (Genjutsu rank alto alonga o atordoamento)
  const kx = clamp(num(m.kx, 0), -30, 30), ky = clamp(num(m.ky, 0), -30, 30);
  if (!e.ja && (kx || ky) && !blk(r.map, e.x + kx, e.y + ky)) { e.x += kx; e.y += ky; }
  e.dmg[p.id] = (e.dmg[p.id] || 0) + d;
  toRoom(r, { t: 'mh', m: e.id, d, by: p.id, c: m.c ? 1 : 0 }); // vai também para quem bateu: o número só aparece confirmado
  if (e.hp <= 0) killMob(r, e);
}
function killMob(r, e) {
  e.hp = 0; e.dead = 1; e.dt = 0; e.rt = e.kind === 'mob' ? clamp(num(e.def.renasce, 15), 2, 3600) * (.8 + Math.random() * .4) : clamp(num(FOXDEF().renasce, CFG.respawn), 2, 36000); e.ch = e.lunge = e.ja = e.jc = e.jz = e.stun = 0; e.tg = null; if (e.kind !== 'mob') r.eps = [];
  const tot = {}; for (const uid in e.dmg) { const k = groupKey(uid); tot[k] = (tot[k] || 0) + e.dmg[uid]; }
  let best = null; for (const k in tot) if (!best || tot[k] > tot[best]) best = k;
  e.dmg = {};
  if (!best) return;
  const pt = parties.get(best);
  const winners = pt ? pt.members.map(u => players.get(u)).filter(q => q && q.map === r.map) : [players.get(best.slice(2))].filter(q => q && q.map === r.map);
  const names = pt ? 'grupo de ' + (players.get(pt.leader) || { nome: '?' }).nome : ((players.get(best.slice(2)) || {}).nome || '?');
  const isBoss = e.kind === 'raposa', d = e.def || {};
  for (const q of winners) {
    const fd = FOXDEF().drops || [];
    const items = isBoss && !fd.length ? Object.values(ITEMS).filter(it => it.drop && it.drop.src === 'boss' && Math.random() * 100 < (it.drop.chance == null ? 100 : +it.drop.chance)).map(it => it.id)
      : isBoss ? fd.filter(x => ITEMS[x.item] && Math.random() * 100 < clamp(num(x.chance, 0), 0, 100)).map(x => x.item)
      : (d.drops || []).filter(x => ITEMS[x.item] && Math.random() * 100 < clamp(num(x.chance, 0), 0, 100)).map(x => x.item);
    const sendRw = got => q.conn.send({ t: 'reward', xp: isBoss ? clamp(num(FOXDEF().xp, CFG.xp), 0, 1e8) | 0 : clamp(num(d.xp, 0), 0, 1e7) | 0, items: got, mob: e.nome, dmg: tot[best], grp: pt ? 1 : 0, boss: isBoss ? 1 : 0, db: INV_OK ? 1 : 0 });
    if (INV_OK && items.length) giveDb(q.id, items).then(sendRw, err => { log('drop não gravado: ' + err.message); sendRw([]); }); else sendRw(items);
  }
  const nomeG = k => { const g = parties.get(k); if (g) return 'grupo de ' + ((players.get(g.leader) || offlineInfo.get(g.leader) || {}).nome || '?'); const u = k.slice(2); return (players.get(u) || offlineInfo.get(u) || {}).nome || '?'; };
  const rank = Object.keys(tot).sort((a, b) => tot[b] - tot[a]).slice(0, 5).map(k => ({ quem: nomeG(k), dmg: tot[k] }));
  const msg = { t: 'mkill', m: e.id, nome: e.nome, quem: names, dmg: tot[best], ids: winners.map(q => q.id), rank: isBoss ? rank : undefined, boss: isBoss ? 1 : 0 };
  if (isBoss) { toRoom(r, msg); log('raposa derrotada em', r.map, 'por', names, tot[best]); }
  else { const who = new Set(Object.keys(tot).flatMap(k => { const g = parties.get(k); return g ? g.members : [k.slice(2)]; })); for (const u of who) { const q = players.get(u); if (q && q.map === r.map) q.conn.send(msg); } }
}

// ---------------------------------------------------------------- IA da raposa (roda só aqui)
const JC = .55, JA = .62, JH = 85, JR = 92, JD = 26;
// pr = precisão de quem bateu: o cliente sorteia a esquiva do jogador (PvE); no PvP isso vai para o servidor
function hurtP(q, d, kx, ky, src, pr) { q.conn.send({ t: 'hurt', d: Math.round(d), kx: kx || 0, ky: ky || 0, src: src || '', pr: Math.round(pr || 0) }); }
function areaHurt(r, x, y, rad, d, kb, src, pr) {
  for (const q of r.players) { if (q.sc || q.hp <= 0 || inSafe(r.map, q.x, q.y)) continue; const dy = (q.y - y) * (kb ? 1.25 : 1);
    if (hyp(q.x - x, dy) < rad) { let kx = 0, ky = 0; if (kb) { const a = Math.atan2(q.y - y, q.x - x); kx = Math.cos(a); ky = Math.sin(a); } hurtP(q, d, kx, ky, src, pr); } }
}
// ---------------------------------------------------------------- PvP (jogador x jogador)
// quem bate manda o golpe; o servidor confere e repassa para o alvo, que sorteia a esquiva (Esquiva dele x Precisão de quem bateu)
// e devolve o resultado; aí todo mundo do mapa vê o número e, se morrer, o aviso de quem derrotou quem.
function pvpSafeAt(map, x, y) { const s = MAPS[map] && MAPS[map].spawn; return !!s && CFG.pvpSafe > 0 && hyp(x - s[0] * T, y - s[1] * T) < CFG.pvpSafe * T; }
function pvpWhy(a, b) {
  if (!CFG.pvp) return 'O PvP está desligado.';
  if (!b || b === a || !a.map || a.map !== b.map || a.sc !== b.sc) return 'longe';
  if (a.hp <= 0 || b.hp <= 0) return 'longe';
  const g = memberParty.get(a.id); if (g && g === memberParty.get(b.id)) return 'grupo';
  if (hyp(a.x - b.x, a.y - b.y) > CFG.hitRange) return 'longe';
  if (pvpSafeAt(a.map, a.x, a.y) || pvpSafeAt(b.map, b.x, b.y)) return 'seguro';
  return ''; }
function onPvp(p, m) {
  const q = players.get(str(m.to, 64)); const why = pvpWhy(p, q);
  if (why === 'seguro') return p.conn.send({ t: 'ph', to: q.id, by: p.id, safe: 1 });
  if (why) return;
  const t = now(); if (t - p.hitT > 1) { p.hitT = t; p.hitN = 0; } if (++p.hitN > 25) return;
  const d = Math.max(1, Math.round(clamp(num(m.d, 0), 0, CFG.pvpMaxHit) * CFG.pvpMul)); if (!num(m.d, 0)) return;
  let kx = num(m.kx, 0), ky = num(m.ky, 0); const kl = hyp(kx, ky); if (kl > .01) { kx = kx / kl * .6; ky = ky / kl * .6; } else { kx = ky = 0; }
  const r = room(p.map), pr = clamp(num(m.pr, 0), 0, 5000), c = m.c ? 1 : 0;
  // o servidor sorteia a esquiva (Esquiva de quem apanha x Precisão de quem bate) e aplica a redução de dano:
  // assim o número aparece para todo mundo com uma ida e volta só (antes eram duas)
  if (Math.random() * 100 < dodgeChance(q.esq || 0, pr)) { toRoom(r, { t: 'ph', to: q.id, by: p.id, miss: 1 }, q); q.conn.send({ t: 'hurt', fin: 1, miss: 1, d: 0, src: p.nome, by: p.id }); return; }
  const dd = Math.max(1, Math.round(d * (1 - clamp(q.red || 0, -50, 90) / 100)));
  const pe = q.pvpPend || (q.pvpPend = new Map()), o = pe.get(p.id) || { n: 0 }; o.n = Math.min(o.n + 1, 30); o.exp = t + 4; pe.set(p.id, o);
  toRoom(r, { t: 'ph', to: q.id, by: p.id, d: dd, c }, q);
  q.conn.send({ t: 'hurt', fin: 1, d: dd, kx: Math.round(kx * 100) / 100, ky: Math.round(ky * 100) / 100, src: p.nome, by: p.id, st: Math.min(CFG.pvpStun, clamp(num(m.st, 0), 0, 8)), c });
}
function onPvpResult(q, m) { // q = quem apanhou, avisando que foi derrotado por "by"
  const by = str(m.by, 64), pe = q.pvpPend && q.pvpPend.get(by); if (!pe || pe.exp < now() || pe.n <= 0 || !q.map) return;
  pe.n--; const a = players.get(by), r = room(q.map), dead = m.dead ? 1 : 0;
  if (dead) { q.pvpPend.clear(); if (a) a.pvpK = (a.pvpK || 0) + 1; q.pvpD = (q.pvpD || 0) + 1;
    toRoom(r, { t: 'pk', by, byN: a ? a.nome : '?', to: q.id, toN: q.nome, k: a ? a.pvpK : 0 });
    log('PvP:', a ? a.nome : by, 'derrotou', q.nome, 'em', q.map); }
}
function resetMob(r, e, announce) {
  Object.assign(e, { x: e.hx, y: e.hy, hp: e.max, dead: 0, dt: 0, rt: 0, mv: 0, ch: 0, fired: 0, lunge: 0, dmgp: 0, ja: 0, jc: 0, jz: 0, stun: 0, hurt: 0, dmg: {}, alone: 0, jcd: 3, bc: 2, atk: 0, aim: null, jt: null });
  r.eps = [];
  if (announce) toRoom(r, { t: 'mev', k: 'reset', m: e.id, x: e.x, y: e.y });
}
function mobTick(r, e, dt) {
  if (e.dead) { e.dt += dt; if ((e.rt -= dt) <= 0) { resetMob(r, e, false); toRoom(r, { t: 'mev', k: 'spawn', m: e.id, x: e.x, y: e.y }); } return; }
  e.hurt = Math.max(0, e.hurt - dt); e.lunge = Math.max(0, e.lunge - dt); e.bc = Math.max(0, e.bc - dt); e.jcd = Math.max(0, e.jcd - dt);
  // jogadores válidos e o mais próximo
  let near = null, nd = 1e9;
  for (const q of r.players) { if (q.sc || q.hp <= 0 || inSafe(r.map, q.x, q.y)) continue; const d = hyp(q.x - e.x, q.y - e.y); if (d < nd) { nd = d; near = q; } }
  // regras de reset (não no meio do pulo)
  if (!e.ja && !e.jc) {
    const home = hyp(e.x - e.hx, e.y - e.hy);
    if (home > CFG.resetHome * T) { resetMob(r, e, true); return; }
    if (nd > CFG.resetNear * T) { e.alone += dt; if (e.alone >= CFG.resetWait && (e.hp < e.max || home > 2 * T || Object.keys(e.dmg).length)) { resetMob(r, e, true); return; } }
    else e.alone = 0;
  }
  if (e.dmgp && e.lunge < .26) { e.dmgp = 0; areaHurt(r, e.x, e.y, 100, num(FOXDEF().dano, 12), 0, 'mordida', num(FOXDEF().precisao, 0)); }
  if (e.ja > 0) { e.mv = 0; foxAir(r, e, dt); return; }
  if (e.stun > 0) { e.stun -= dt; e.mv = 0; e.jc = 0; e.ch = 0; return; }
  const tg = near && nd <= CFG.aggro * T ? near : null;
  if (e.jc > 0) { e.mv = 0; foxCrouch(r, e, dt); return; }
  if (e.ch > 0) { e.mv = 0; e.ch -= dt; const a0 = tg || e.aim; if (a0 && Math.abs(a0.x - e.x) > 4) e.fl = a0.x < e.x ? 1 : 0;
    if (!e.fired && e.ch <= .4) { e.fired = 1; const ox = e.x + (e.fl ? -1 : 1) * 52, oy = e.y - 46, ax = a0 ? a0.x : ox + (e.fl ? -100 : 100), ay = a0 ? a0.y - 22 : oy;
      const a = Math.atan2(ay - oy, ax - ox), b = { id: ++r.epSeq, x: ox, y: oy, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, life: 1.35 };
      r.eps.push(b); toRoom(r, { t: 'mev', k: 'ep', id: b.id, x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.vx), vy: Math.round(b.vy), life: b.life }); }
    return; }
  if (e.lunge > 0) { e.mv = 0; return; }
  let vx = 0, vy = 0;
  if (tg) {
    const dx = tg.x - e.x, dy = tg.y - e.y, dist = nd;
    if (dist > 110 && dist < 320 && e.jcd <= 0 && !(dist > 170 && e.bc <= 0 && Math.random() < .5)) foxJump(e, tg);
    else if (dist > 170 && dist < 300 && e.bc <= 0) { e.ch = 1.2; e.fired = 0; e.bc = 5.5; e.jcd = Math.max(e.jcd, 2); e.aim = tg; }
    else if (dist > 84) { vx = dx / dist; vy = dy / dist; }
    else if ((e.atk -= dt) <= 0) { e.atk = 1.6; e.lunge = .5; e.dmgp = 1; }
    if (Math.abs(dx) > 4) e.fl = dx < 0 ? 1 : 0;
  } else {
    const hd = hyp(e.hx - e.x, e.hy - e.y);
    if (hd > 2 * T) { vx = (e.hx - e.x) / hd * .7; vy = (e.hy - e.y) / hd * .7; }
    else { if ((e.wt -= dt) <= 0) { e.wt = 1 + Math.random() * 2; e.wa = Math.random() * 6.3; e.wm = Math.random() < .5; } if (e.wm) { vx = Math.cos(e.wa) * .5; vy = Math.sin(e.wa) * .5; } }
    if (Math.abs(vx) > .05) e.fl = vx < 0 ? 1 : 0;
  }
  go(r.map, e, vx, vy, 72, dt);
}
function foxJump(e, tg) { e.jc = JC; e.jcd = 5 + Math.random() * 1.5; e.bc = Math.max(e.bc, 1.6); e.jx = tg.x; e.jy = tg.y; e.fl = tg.x < e.x ? 1 : 0; e.jt = tg; }
function foxCrouch(r, e, dt) {
  e.jc -= dt; const t = e.jt; if (e.jc > .15 && t && r.players.has(t) && !t.sc) { e.jx = t.x; e.jy = t.y; e.fl = t.x < e.x ? 1 : 0; }
  if (e.jc <= 0) { e.jc = 0; let tx = e.jx, ty = e.jy; const d = hyp(tx - e.x, ty - e.y), mx = 330; if (d > mx) { tx = e.x + (tx - e.x) / d * mx; ty = e.y + (ty - e.y) / d * mx; }
    for (let i = 0; i < 12 && sol(r.map, tx, ty); i++) { tx += (e.x - tx) * .2; ty += (e.y - ty) * .2; }
    e.sx = e.x; e.sy = e.y; e.jx = tx; e.jy = ty; e.ja = JA; e.jz = 0; }
}
function foxAir(r, e, dt) {
  e.ja -= dt; const q = Math.min(1, 1 - e.ja / JA), qq = q * q * (3 - 2 * q);
  e.x = e.sx + (e.jx - e.sx) * qq; e.y = e.sy + (e.jy - e.sy) * qq; e.jz = Math.sin(Math.PI * q) * JH;
  if (e.ja <= 0) { e.ja = 0; e.jz = 0; e.x = e.jx; e.y = e.jy;
    toRoom(r, { t: 'mev', k: 'shock', m: e.id, x: Math.round(e.x), y: Math.round(e.y), r: JR + 10 });
    areaHurt(r, e.x, e.y, JR, num(FOXDEF().pulo, JD), 1, 'pulo', num(FOXDEF().precisao, 0)); e.atk = .9; }
}
function epTick(r, dt) {
  if (!r.eps.length) return;
  r.eps = r.eps.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || sol(r.map, b.x, b.y + 16)) { toRoom(r, { t: 'mev', k: 'epx', id: b.id, x: Math.round(b.x), y: Math.round(b.y), hit: 0 }); return false; }
    for (const q of r.players) { if (q.sc || q.hp <= 0 || inSafe(r.map, q.x, q.y)) continue; if (hyp(q.x - b.x, q.y - 24 - b.y) < 24) { hurtP(q, num(FOXDEF().esfera, 30), 0, 0, 'esfera', num(FOXDEF().precisao, 0)); toRoom(r, { t: 'mev', k: 'epx', id: b.id, x: Math.round(b.x), y: Math.round(b.y), hit: 1 }); return false; } }
    return true; });
}

// ---------------------------------------------------------------- laço principal
// 30 passos de simulação e 15 fotos por segundo; cada foto leva a hora do servidor (st) para o cliente interpolar liso
const TICK = 1 / 30, SNAP = 1 / 15; let snapAcc = 0, partyAcc = 0, last = now();
setInterval(() => {
  const t = now(); let dt = Math.min(.1, t - last); last = t;
  for (const k in rooms) { const r = rooms[k];
    if (!r.players.size) { if (!r.empty) { r.empty = 1; for (const e of r.mobs) if (e.kind === 'mob' && !e.dead) { const p = spreadPoint(r, e.A, e); Object.assign(e, { x: p[0], y: p[1], hx: p[0], hy: p[1], back: 0, wx: p[0], wy: p[1] }); } }
      for (const e of r.mobs) { if (e.kind === 'mob') { if (!e.dead) { e.hp = e.max; e.dmg = {}; e.tg = null; } else mobTickG(r, e, dt); } else if (!e.dead && (e.hp < e.max || hyp(e.x - e.hx, e.y - e.hy) > 2 * T)) resetMob(r, e, false); } r.eps = []; continue; }
    r.empty = 0; for (const e of r.mobs) e.kind === 'mob' ? mobTickG(r, e, dt) : mobTick(r, e, dt); epTick(r, dt); }
  snapAcc += dt; if (snapAcc >= SNAP - .004) { snapAcc = 0; const sts = Math.round(performance.now());
    for (const k in rooms) { const r = rooms[k]; if (!r.players.size) continue;
      const st = new Map(r.mobs.map(e => [e, [e.id, ...mobState(e)]]));
      for (const q of r.players) { if (!q.conn.open) continue; const l = []; for (const [e, a] of st) if (e.boss || hyp(q.x - e.x, q.y - e.y) < 24 * T) l.push(a); q.conn.send({ t: 'mobs', st: sts, m: l }); }
    } }
  // posições dos jogadores: repassa a cada passo (30 por segundo), sem esperar a foto dos monstros
  { const sts = Math.round(performance.now());
    for (const k in rooms) { const r = rooms[k]; if (r.players.size < 2) { for (const q of r.players) q.dirty = false; continue; }
      const ch = [...r.players].filter(q => q.dirty); if (ch.length) { ch.forEach(q => q.dirty = false);
        toRoom(r, { t: 'ps', st: sts, p: ch.map(q => [q.id, Math.round(q.x), Math.round(q.y), q.fl, q.mv, q.run, Math.round(q.au * 100) / 100, Math.round(q.th * 100) / 100, q.sc, Math.round(q.hp), q.max, q.ct]) }); } } }
  partyAcc += dt; if (partyAcc >= 1) { partyAcc = 0; const tt = now();
    for (const [u, o] of offlineInfo) if (o.until < tt) partyLeave(u, 'desconectou');
    for (const q of players.values()) if (q.invites) for (const [f, ex] of q.invites) if (ex < tt) q.invites.delete(f);
    for (const pt of parties.values()) partySync(pt); tradeTick(); }
}, TICK * 1000);
// mantém as conexões vivas e derruba as mortas
setInterval(() => { for (const q of players.values()) { const c = q.conn; if (!c.alive) { c.close(1001, 'sem resposta'); continue; } c.alive = false; try { c.sock.write(wsFrame(9, '')); } catch (e) {} } }, 25000);

// ---------------------------------------------------------------- HTTP
const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  const u = req.url.split('?')[0];
  if (u === '/health' || u === '/') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, jogo: 'Shinobi Online', v: PROTO, commit: COMMIT, online: players.size, trocas: INV_OK ? 1 : 0, trocasMotivo: INV_OK ? '' : INV_WHY, mapas: Object.fromEntries(Object.entries(rooms).map(([k, r]) => [k, r.players.size])) })); }
  res.writeHead(404, cors); res.end('nada aqui');
});
server.on('upgrade', (req, sock) => {
  if (req.url.split('?')[0] !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket' || !req.headers['sec-websocket-key']) { sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  const c = new Conn(sock, req.headers['x-forwarded-for'] || sock.remoteAddress);
  setTimeout(() => { if (c.open && !c.player) c.close(4003, 'sem login'); }, 20000);
});
server.listen(PORT, () => log('Shinobi Online: servidor na porta', PORT, 'protocolo', PROTO, 'commit', COMMIT));
module.exports = { CFG };
