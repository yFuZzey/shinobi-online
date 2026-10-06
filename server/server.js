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
const PROTO = 1;                                   // versão do protocolo (cliente precisa bater)
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
};

const MAPS = JSON.parse(fs.readFileSync(path.join(__dirname, 'maps.json'), 'utf8'));
const ITEMS = JSON.parse(fs.readFileSync(path.join(__dirname, 'items.json'), 'utf8'));
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
    const b = MAPS[map].boss; if (b) r.mobs.push(newFox(map, b)); }
  return rooms[map]; }
function newFox(map, b) { const x = b[0] * T, y = b[1] * T;
  return { id: map + ':raposa', kind: 'raposa', nome: 'Raposa de Nove Caudas', boss: 1, rad: 56, max: 300, hp: 300, hx: x, hy: y, x, y,
    dead: 0, dt: 0, rt: 0, mv: 0, fl: 0, ch: 0, fired: 0, bc: 0, lunge: 0, dmgp: 0, atk: 0, jc: 0, ja: 0, jz: 0, jx: 0, jy: 0, sx: 0, sy: 0, jcd: 3,
    stun: 0, hurt: 0, wt: 0, wa: 0, wm: 0, dmg: {}, alone: 0, aim: null, jt: null }; }
function mobDef(e) { return { id: e.id, kind: e.kind, nome: e.nome, boss: e.boss, rad: e.rad, max: e.max }; }
const MK = ['x', 'y', 'hp', 'max', 'dead', 'dt', 'mv', 'fl', 'ch', 'lunge', 'ja', 'jz', 'jc', 'jx', 'jy', 'stun', 'hurt', 'rt'];
const mobState = e => MK.map(k => { const v = e[k]; return typeof v === 'number' ? Math.round(v * 100) / 100 : (v ? 1 : 0); });

function toRoom(r, o, except) { const s = JSON.stringify(o), fr = wsFrame(1, s); for (const p of r.players) if (p !== except && p.conn.open) { try { p.conn.sock.write(fr); } catch (e) {} } }
function sys(p, msg) { p.conn.send({ t: 'sys', msg }); }
const pub = p => ({ id: p.id, nome: p.nome, clan: p.clan, lv: p.lv, eq: p.eq, look: p.look, x: p.x, y: p.y, fl: p.fl, mv: p.mv, run: p.run, au: p.au, th: p.th, sc: p.sc, hp: p.hp, max: p.max, g: memberParty.get(p.id) || 0 });

// ---------------------------------------------------------------- autenticação
async function verifyToken(token) {
  if (!SB_URL || !SB_KEY) throw new Error('servidor sem configuração do Supabase');
  const h = { apikey: SB_KEY, Authorization: 'Bearer ' + token };
  const r = await fetch(SB_URL + '/auth/v1/user', { headers: h, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error('token inválido (' + r.status + ')');
  const u = await r.json(); if (!u || !u.id) throw new Error('token inválido');
  return { id: u.id, nome: str((u.user_metadata && u.user_metadata.nome) || (u.email || '').split('@')[0], 14) };
}

// ---------------------------------------------------------------- mensagens
function onMessage(c, m) {
  if (m.t === 'ping') return c.send({ t: 'pong', c: m.c });
  if (!c.player) {
    if (m.t !== 'auth' || c.authing) return;
    if (m.v !== PROTO) { c.send({ t: 'old', msg: 'Seu app está desatualizado. Baixe a versão nova do jogo.' }); return c.close(4000, 'versao'); }
    c.authing = true;
    verifyToken(str(m.token, 4000)).then(u => {
      if (!c.open) return;
      const old = players.get(u.id);
      if (old && old.conn.open) { old.conn.send({ t: 'kicked', msg: 'Sua conta entrou em outro aparelho.' }); old.kicked = true; old.conn.close(4001, 'duplicado'); }
      const p = { id: u.id, nome: u.nome, conn: c, map: null, x: 0, y: 0, fl: 0, mv: 0, run: 0, au: -1, th: -1, sc: 0, hp: 100, max: 100, lv: 1, clan: 'uchiha', eq: [], look: null, hitT: now(), hitN: 0 };
      c.player = p; players.set(u.id, p); offlineInfo.delete(u.id);
      c.send({ t: 'welcome', id: u.id, nome: u.nome, cfg: { aggro: CFG.aggro, resetNear: CFG.resetNear, resetHome: CFG.resetHome, partyMax: CFG.partyMax } });
      const pid = memberParty.get(u.id); if (pid) partySync(parties.get(pid));
      log('entrou', u.nome, '(' + players.size + ' online)');
    }).catch(e => { c.send({ t: 'authfail', msg: String(e.message || e) }); c.close(4002, 'auth'); });
    return;
  }
  const p = c.player;
  switch (m.t) {
    case 'join': return onJoin(p, m);
    case 'pos': if (!p.map) return;
      p.x = clamp(num(m.x, p.x), 0, 50 * T); p.y = clamp(num(m.y, p.y), 0, 50 * T); p.fl = m.fl ? 1 : 0; p.mv = m.mv ? 1 : 0; p.run = m.run ? 1 : 0;
      p.au = num(m.au, -1); p.th = num(m.th, -1); p.sc = m.sc ? 1 : 0; p.hp = clamp(num(m.hp, p.hp), 0, 1e5); p.max = clamp(num(m.max, p.max), 1, 1e5); p.dirty = true; return;
    case 'meta': setMeta(p, m); if (p.map) toRoom(room(p.map), { t: 'pm', id: p.id, lv: p.lv, eq: p.eq, look: p.look, clan: p.clan }, p); return;
    case 'fx': if (!p.map) return; {
      const fx = Array.isArray(m.fx) ? m.fx.slice(0, 8) : [], pr = Array.isArray(m.pr) ? m.pr.slice(0, 8) : [];
      if (fx.length || pr.length) toRoom(room(p.map), { t: 'fx', id: p.id, fx, pr }, p); } return;
    case 'chat': { const text = str(m.text, 80).trim(); if (!text) return;
      if (m.ch === 'g') { const pt = parties.get(memberParty.get(p.id)); if (!pt) return sys(p, 'Você não está em um grupo.');
        for (const u of pt.members) { const q = players.get(u); if (q) q.conn.send({ t: 'chat', id: p.id, nome: p.nome, text, ch: 'g' }); } }
      else if (p.map) toRoom(room(p.map), { t: 'chat', id: p.id, nome: p.nome, text, ch: 'm' }); } return;
    case 'hit': return onHit(p, m);
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
function leaveRoom(p) { const r = rooms[p.map]; if (!r) return; r.players.delete(p); toRoom(r, { t: 'pl', id: p.id }); p.map = null; }
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
  const d = Math.round(clamp(num(m.d, 0), 0, CFG.maxHit)); if (!d) return;
  e.hp -= d; e.hurt = .28; e.alone = 0;
  const st = clamp(num(m.st, 0), 0, 6); if (st) e.stun = Math.max(e.stun, st);
  const kx = clamp(num(m.kx, 0), -30, 30), ky = clamp(num(m.ky, 0), -30, 30);
  if (!e.ja && (kx || ky) && !blk(r.map, e.x + kx, e.y + ky)) { e.x += kx; e.y += ky; }
  e.dmg[p.id] = (e.dmg[p.id] || 0) + d;
  toRoom(r, { t: 'mh', m: e.id, d, by: p.id, c: m.c ? 1 : 0 }, p);
  if (e.hp <= 0) killMob(r, e);
}
function killMob(r, e) {
  e.hp = 0; e.dead = 1; e.dt = 0; e.rt = CFG.respawn; e.ch = e.lunge = e.ja = e.jc = e.jz = e.stun = 0; r.eps = [];
  const tot = {}; for (const uid in e.dmg) { const k = groupKey(uid); tot[k] = (tot[k] || 0) + e.dmg[uid]; }
  let best = null; for (const k in tot) if (!best || tot[k] > tot[best]) best = k;
  e.dmg = {};
  if (!best) return;
  const pt = parties.get(best);
  const winners = pt ? pt.members.map(u => players.get(u)).filter(q => q && q.map === r.map) : [players.get(best.slice(2))].filter(q => q && q.map === r.map);
  const names = pt ? 'grupo de ' + (players.get(pt.leader) || { nome: '?' }).nome : ((players.get(best.slice(2)) || {}).nome || '?');
  for (const q of winners) {
    const items = Object.values(ITEMS).filter(it => it.drop && it.drop.src === 'boss' && Math.random() * 100 < (it.drop.chance == null ? 100 : +it.drop.chance)).map(it => it.id);
    q.conn.send({ t: 'reward', xp: CFG.xp, items, mob: e.nome, dmg: tot[best], grp: pt ? 1 : 0 });
  }
  toRoom(r, { t: 'mkill', m: e.id, nome: e.nome, quem: names, dmg: tot[best], ids: winners.map(q => q.id) });
  log('raposa derrotada em', r.map, 'por', names, tot[best]);
}

// ---------------------------------------------------------------- IA da raposa (roda só aqui)
const JC = .55, JA = .62, JH = 85, JR = 92, JD = 26;
function hurtP(q, d, kx, ky) { q.conn.send({ t: 'hurt', d, kx: kx || 0, ky: ky || 0 }); }
function areaHurt(r, x, y, rad, d, kb) {
  for (const q of r.players) { if (q.sc || q.hp <= 0) continue; const dy = (q.y - y) * (kb ? 1.25 : 1);
    if (hyp(q.x - x, dy) < rad) { let kx = 0, ky = 0; if (kb) { const a = Math.atan2(q.y - y, q.x - x); kx = Math.cos(a); ky = Math.sin(a); } hurtP(q, d, kx, ky); } }
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
  for (const q of r.players) { if (q.sc || q.hp <= 0) continue; const d = hyp(q.x - e.x, q.y - e.y); if (d < nd) { nd = d; near = q; } }
  // regras de reset (não no meio do pulo)
  if (!e.ja && !e.jc) {
    const home = hyp(e.x - e.hx, e.y - e.hy);
    if (home > CFG.resetHome * T) { resetMob(r, e, true); return; }
    if (nd > CFG.resetNear * T) { e.alone += dt; if (e.alone >= CFG.resetWait && (e.hp < e.max || home > 2 * T || Object.keys(e.dmg).length)) { resetMob(r, e, true); return; } }
    else e.alone = 0;
  }
  if (e.dmgp && e.lunge < .26) { e.dmgp = 0; areaHurt(r, e.x, e.y, 100, 12, 0); }
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
    areaHurt(r, e.x, e.y, JR, JD, 1); e.atk = .9; }
}
function epTick(r, dt) {
  if (!r.eps.length) return;
  r.eps = r.eps.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || sol(r.map, b.x, b.y + 16)) { toRoom(r, { t: 'mev', k: 'epx', id: b.id, x: Math.round(b.x), y: Math.round(b.y), hit: 0 }); return false; }
    for (const q of r.players) { if (q.sc || q.hp <= 0) continue; if (hyp(q.x - b.x, q.y - 24 - b.y) < 24) { hurtP(q, 30, 0, 0); toRoom(r, { t: 'mev', k: 'epx', id: b.id, x: Math.round(b.x), y: Math.round(b.y), hit: 1 }); return false; } }
    return true; });
}

// ---------------------------------------------------------------- laço principal
const TICK = 1 / 30; let snapAcc = 0, partyAcc = 0, last = now();
setInterval(() => {
  const t = now(); let dt = Math.min(.1, t - last); last = t;
  for (const k in rooms) { const r = rooms[k];
    if (!r.players.size) { for (const e of r.mobs) if (!e.dead && (e.hp < e.max || hyp(e.x - e.hx, e.y - e.hy) > 2 * T)) resetMob(r, e, false); r.eps = []; continue; }
    for (const e of r.mobs) mobTick(r, e, dt); epTick(r, dt); }
  snapAcc += dt; if (snapAcc >= .1) { snapAcc = 0;
    for (const k in rooms) { const r = rooms[k]; if (!r.players.size) continue;
      toRoom(r, { t: 'mobs', m: r.mobs.map(e => [e.id, ...mobState(e)]) });
      const ch = [...r.players].filter(q => q.dirty); if (ch.length) { ch.forEach(q => q.dirty = false);
        toRoom(r, { t: 'ps', p: ch.map(q => [q.id, Math.round(q.x), Math.round(q.y), q.fl, q.mv, q.run, Math.round(q.au * 100) / 100, Math.round(q.th * 100) / 100, q.sc, Math.round(q.hp), q.max]) }); } } }
  partyAcc += dt; if (partyAcc >= 1) { partyAcc = 0; const tt = now();
    for (const [u, o] of offlineInfo) if (o.until < tt) partyLeave(u, 'desconectou');
    for (const q of players.values()) if (q.invites) for (const [f, ex] of q.invites) if (ex < tt) q.invites.delete(f);
    for (const pt of parties.values()) partySync(pt); }
}, TICK * 1000);
// mantém as conexões vivas e derruba as mortas
setInterval(() => { for (const q of players.values()) { const c = q.conn; if (!c.alive) { c.close(1001, 'sem resposta'); continue; } c.alive = false; try { c.sock.write(wsFrame(9, '')); } catch (e) {} } }, 25000);

// ---------------------------------------------------------------- HTTP
const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  const u = req.url.split('?')[0];
  if (u === '/health' || u === '/') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, jogo: 'Shinobi Online', v: PROTO, commit: COMMIT, online: players.size, mapas: Object.fromEntries(Object.entries(rooms).map(([k, r]) => [k, r.players.size])) })); }
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
