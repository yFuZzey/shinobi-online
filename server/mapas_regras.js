'use strict';
// Mapas criados no editor do painel (/painel/editor): confere o que veio do banco e refaz a colisão do servidor.
// A colisão segue exatamente applyMap do jogo (terreno, tamanho dos objetos no chão, colisão pintada); o teste "mapas" compara os dois.
// Tamanho: W (largura) × H (altura) em tiles; mapas sem W/H são 50×50. Limite pensado para a memória do celular (o chão vira uma imagem W·32 × H·32).
// cat = { fpt: {objeto:[largura,altura,recuo]}, tsz: [objetos que existem] }  (gerado junto com maps.json por src/online/exportmaps.js)
const N = 50, T = 32, MIN = 8, MAX = 100, AREA = 6400;
const dims = m => { const w = m && m.W != null ? m.W : (m && m.N) || N, h = m && m.H != null ? m.H : (m && m.N) || N; return Number.isInteger(w) && Number.isInteger(h) && w >= MIN && h >= MIN && w <= MAX && h <= MAX && w * h <= AREA ? [w, h] : null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = v => typeof v === 'number' && isFinite(v);
const TEMAS = { folha: 1, areia: 1, vazio: 1 }; // vazio = sem fundo (chão preto; rua/água usam a Folha)
const ID = /^[a-z0-9_]{2,30}$/;

// devolve o mapa limpo (formato do jogo) ou null se não prestar
function validar(id, nome, m, cat) {
  if (!ID.test(id || '') || !m || typeof m !== 'object') return null;
  const tsz = new Set((cat && cat.tsz) || []);
  const D = dims(m); if (!D) return null; const W = D[0], H = D[1];
  if (typeof m.ground !== 'string' || m.ground.length !== W * H || /[^0-5]/.test(m.ground)) return null;
  if (!Array.isArray(m.objects) || m.objects.length > 4000) return null;
  const O = [];
  for (const r of m.objects) {
    if (!Array.isArray(r) || !tsz.has(r[0]) || !fin(r[1]) || !fin(r[2])) continue;
    const o = [r[0], +r[1].toFixed(4), +r[2].toFixed(4)];
    // opções do editor novo (r[5]): escala (e), sempre no chão/por cima (z), ajuste fino da ordem (b, px)
    const q = r[5] && typeof r[5] === 'object' ? r[5] : null, op = {};
    if (q) { if (fin(q.e) && q.e > 0 && q.e !== 1) op.e = +Math.min(8, Math.max(.1, q.e)).toFixed(4); if (q.z === 'chao' || q.z === 'acima') op.z = q.z; if (fin(q.b) && q.b) op.b = clamp(Math.round(q.b), -1024, 1024); if (fin(q.r)) { const r = +((((q.r % 360) + 360) % 360).toFixed(1)); if (r && r !== 360) op.r = r; } }
    const temOp = Object.keys(op).length > 0, cel = Array.isArray(r[4]) && r[4].length <= 120 ? r[4].filter(a => Array.isArray(a) && fin(a[0]) && fin(a[1])).map(a => [Math.round(a[0]), Math.round(a[1])]) : null;
    if (r[3] || cel || temOp) o.push(r[3] ? 1 : 0);
    if (cel) o.push(cel); else if (temOp) o.push(null);
    if (temOp) o.push(op);
    O.push(o);
  }
  const pt = (a, d) => Array.isArray(a) && fin(a[0]) && fin(a[1]) ? [clamp(+a[0], 2, W - 2), clamp(+a[1], 2, H - 2)] : d;
  const A = [];
  if (Array.isArray(m.areas)) for (const a of m.areas.slice(0, 60)) {
    if (!a || ![a.x, a.y, a.w, a.h].every(fin)) continue;
    const x = clamp(Math.round(a.x), 0, W - 1), y = clamp(Math.round(a.y), 0, H - 1);
    A.push({ x, y, w: clamp(Math.round(a.w), 1, W - x), h: clamp(Math.round(a.h), 1, H - y),
      mobs: (Array.isArray(a.mobs) ? a.mobs : []).filter(e => e && typeof e.m === 'string' && /^[a-z0-9_]{1,40}$/.test(e.m)).slice(0, 10).map(e => ({ m: e.m, n: clamp(Math.round(+e.n || 0), 0, 40) })) });
  }
  const out = { v: 2, N: W, T, name: id, title: String(nome || id).replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || id, theme: TEMAS[m.theme] ? m.theme : 'folha',
    ground: m.ground, objects: O, spawn: pt(m.spawn, [W / 2 + .5, H / 2 + .5]), boss: pt(m.boss, null) };
  if (W !== N || H !== N) { out.W = W; out.H = H; } // 50×50 continua exatamente como antes
  // camadas de tiles (Chão, Detalhes, Acima…): opcional; mapas antigos não têm. Camadas de tipo desconhecido (estruturas, colisão, altura no futuro) passam adiante sem mexer.
  const TS = Array.isArray(m.tilesets) && m.tilesets.every(t => /^(t|r)_[a-z0-9_]{2,40}$/.test(t)) ? m.tilesets.slice(0, 32) : []; // t_ = tileset do editor antigo, r_ = recurso da biblioteca
  if (TS.length && Array.isArray(m.camadas)) {
    const C = [];
    for (const c of m.camadas.slice(0, 12)) {
      if (!c || typeof c.n !== 'string' || !/^[a-z0-9_]{1,20}$/.test(c.n) || typeof c.t !== 'string' || !/^[a-z0-9_]{1,20}$/.test(c.t)) continue;
      if (c.t === 'tiles') {
        const d = [];
        for (const e of (Array.isArray(c.d) ? c.d : [])) {
          if (!Array.isArray(e) || e.length < 5 || !e.slice(0, 5).every(Number.isInteger) || e[0] < 0 || e[0] >= TS.length || e[1] < 0 || e[2] < 0 || e[1] > 4096 || e[2] > 4096 || e[3] < 0 || e[4] < 0 || e[3] > 4096 || e[4] > 4096) continue;
          d.push(e.slice(0, 5)); if (d.length >= 20000) break;
        }
        const o = { n: c.n, t: 'tiles', d }; if (c.z === 'acima' || c.z === 'baixo') o.z = c.z; if (typeof c.nome === 'string') o.nome = c.nome.replace(/[\u0000-\u001f<>]/g, '').slice(0, 30);
        C.push(o);
      } else if (JSON.stringify(c).length <= 200000) C.push(c);
    }
    if (C.length) { out.tilesets = TS; out.camadas = C; }
  }
  if (typeof m.k === 'string' && m.k.length === W * H && !/[^0-2]/.test(m.k)) out.k = m.k;
  if (A.length) out.areas = A;
  if (m.pvp === 0) out.pvp = 0; // mapa sem PvP (o mapa todo é zona segura)
  // eventos ao pisar num tile: por enquanto teletransporte {x, y, t:'tp', m: mapa destino, tx, ty (tiles)}
  if (Array.isArray(m.ev)) { const EV = [], vis = new Set();
    for (const e of m.ev.slice(0, 300)) { if (!e || e.t !== 'tp' || !Number.isInteger(e.x) || !Number.isInteger(e.y) || e.x < 0 || e.y < 0 || e.x >= W || e.y >= H || typeof e.m !== 'string' || !ID.test(e.m)) continue;
      const k = e.x + ',' + e.y; if (vis.has(k)) continue; vis.add(k); const o = { x: e.x, y: e.y, t: 'tp', m: e.m };
      if (fin(e.tx) && fin(e.ty)) { o.tx = clamp(+e.tx, 0, MAX); o.ty = clamp(+e.ty, 0, MAX); } // sem destino = ponto de nascimento do mapa
      EV.push(o); }
    if (EV.length) out.ev = EV; }
  // NPCs: {id:'n1', n: nome, x, y (tile), a: {t:'ninja', s, h, c (cores da paleta do jogo), fl} ou {t:'img', k: imagem do catálogo}, f: [falas], b: 0 = não bloqueia}
  if (Array.isArray(m.npcs)) { const NP = [], vis = new Set(), txt = (s, n) => String(s).replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, n), ci = (v, a, b) => Number.isInteger(v) && v >= a && v <= b ? v : a;
    for (const c of m.npcs.slice(0, 100)) { if (!c || typeof c.id !== 'string' || !/^n\d{1,4}$/.test(c.id) || vis.has(c.id) || !Number.isInteger(c.x) || !Number.isInteger(c.y) || c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) continue; vis.add(c.id);
      const a = c.a && typeof c.a === 'object' ? c.a : {}, o = { id: c.id, n: txt(c.n || '', 24) || 'NPC', x: c.x, y: c.y };
      o.a = a.t === 'img' && typeof a.k === 'string' && tsz.has(a.k) ? { t: 'img', k: a.k } : { t: 'ninja', s: ci(a.s, 0, 3), h: ci(a.h, 0, 4), c: ci(a.c, 0, 4) }; if (a.fl) o.a.fl = 1;
      if (o.a.t === 'img' && fin(a.e) && a.e > 0) o.a.e = +clamp(a.e, .05, 8).toFixed(3); // escala da imagem; sem e = automático (altura de um personagem)
      // animação (img): q = quadros (imagens do catálogo, o 1º é o parado), ms = duração de cada quadro, qa:'andando' = só anima andando; oe = a imagem original olha para a esquerda
      const imgs = v => Array.isArray(v) ? v.filter(k => typeof k === 'string' && tsz.has(k)).slice(0, 24) : [];
      if (o.a.t === 'img') { const q = imgs(a.q), qc = imgs(a.qc), qb = imgs(a.qb); if (q.length > 1) { o.a.k = q[0]; o.a.q = q; } if (q.length > 1 || qc.length || qb.length) { o.a.ms = clamp(Math.round(fin(a.ms) ? a.ms : 125), 40, 2000); if (a.qa === 'andando') o.a.qa = 'andando'; }
        if (qc.length) o.a.qc = qc; if (qb.length) o.a.qb = qb; if (a.oe) o.a.oe = 1; } // qc/qb = quadros andando para cima/baixo (opcionais)
      if (c.rt === 0) o.rt = 0; else if (typeof c.rt === 'string' && tsz.has(c.rt)) o.rt = c.rt; // retrato na janela de fala: 0 = nenhum; sem rt = automático
      // páginas de fala (missões): a 1ª página cujas condições valem (e que a pessoa não “encerrou”) é a que aparece; sem nenhuma, as falas normais (f, ch)
      // ações: mis (começar/passo/concluir), tp (levar para mapa), fim (não repetir esta conversa). Escolhas (ch): até 4 botões no fim da fala, cada um com falas e ações
      const QI = /^q_[a-z0-9_]{2,40}$/, falas = v => (Array.isArray(v) ? v : []).filter(s => typeof s === 'string').map(s => txt(s, 300)).filter(Boolean).slice(0, 20);
      const acoes = v => (Array.isArray(v) ? v : []).slice(0, 6).map(x => !x ? null : x.t === 'mis' && QI.test(x.q || '') && ['comecar', 'passo', 'fim'].includes(x.a) ? Object.assign({ t: 'mis', q: x.q, a: x.a }, x.a === 'passo' ? { n: ci(x.n, 1, 30) } : {})
        : x.t === 'tp' && typeof x.m === 'string' && ID.test(x.m) ? Object.assign({ t: 'tp', m: x.m }, fin(x.tx) && fin(x.ty) ? { tx: clamp(+x.tx, 0, MAX), ty: clamp(+x.ty, 0, MAX) } : {}) : x.t === 'fim' ? { t: 'fim' } : null).filter(Boolean);
      const escolhas = v => (Array.isArray(v) ? v : []).slice(0, 4).map(e => e && typeof e === 'object' ? { txt: txt(e.txt || '', 40) || '…', f: falas(e.f), faz: acoes(e.faz) } : null).filter(Boolean);
      { const ch = escolhas(c.ch); if (ch.length) o.ch = ch; }
      if (Array.isArray(c.pg)) { const P = [], ids = new Set();
        c.pg.slice(0, 10).forEach((g, gi) => { if (!g || typeof g !== 'object') return; let id = typeof g.id === 'string' && /^p[1-9]\d{0,2}$/.test(g.id) && !ids.has(g.id) ? g.id : 'p' + (gi + 1); while (ids.has(id)) id = 'p' + (+id.slice(1) + 10); ids.add(id);
          const se = (Array.isArray(g.se) ? g.se : []).slice(0, 6).map(k => !k ? null : k.t === 'mis' && QI.test(k.q || '') && ['nao', 'em', 'passo', 'fim'].includes(k.e) ? Object.assign({ t: 'mis', q: k.q, e: k.e }, k.e === 'passo' ? { n: ci(k.n, 1, 30) } : {})
            : k.t === 'item' && typeof k.i === 'string' && /^[a-z0-9_]{1,40}$/.test(k.i) ? { t: 'item', i: k.i, n: ci(k.n, 1, 99) } : k.t === 'nivel' ? { t: 'nivel', n: ci(k.n, 1, 99) } : null).filter(Boolean);
          const pg = { id, se, f: falas(g.f), faz: acoes(g.faz) }, ch = escolhas(g.ch); if (ch.length) pg.ch = ch; P.push(pg); });
        if (P.length) o.pg = P; }
      // passeio: anda sozinho até r tiles da posição (v: 1 devagar, 2 normal, 3 rápido)
      if (c.mv && typeof c.mv === 'object') o.mv = { r: ci(c.mv.r, 1, 10), v: ci(c.mv.v, 1, 3) };
      o.f = (Array.isArray(c.f) ? c.f : []).filter(s => typeof s === 'string').map(s => txt(s, 300)).filter(Boolean).slice(0, 20); if (c.b === 0) o.b = 0;
      NP.push(o); }
    if (NP.length) out.npcs = NP; }
  return out;
}

// colisão do servidor: 0 livre, 1 parede, 2 água/buraco, 3 estrada/ponte (como o M de maps.json)
function compilar(m, cat) {
  const W = m.W || m.N || N, H = m.H || m.N || N;
  const M = new Uint8Array(W * H), g = m.ground, gt = (x, y) => g.charCodeAt(y * W + x) - 48, ring = (x, y) => x < 2 || y < 2 || x >= W - 2 || y >= H - 2;
  const setM = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) M[y * W + x] = v; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (gt(x, y) == 1) M[y * W + x] = 3;
  for (let cy = 0; cy < Math.ceil(H / 2); cy++) for (let cx = 0; cx < Math.ceil(W / 2); cx++) {
    const t = gt(cx * 2, cy * 2); if (t < 2 || t == 2) continue;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setM(cx * 2 + i, cy * 2 + j, t == 5 ? 3 : 2);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ring(x, y)) M[y * W + x] = 1;
  const tsz = new Set(cat.tsz || []);
  for (const r of m.objects) {
    const k = r[0]; if (!tsz.has(k)) continue;
    const f = cat.fpt[k] || [1, 1, 0], base = Math.floor((r[2] * T - 1) / T), x0 = Math.round(r[1] - f[0] / 2), y1 = base - f[2];
    if (Array.isArray(r[4])) { const bx = Math.floor(r[1]); for (const a of r[4]) setM(bx + a[0], base + a[1], 1); }
    else if (!r[3]) for (let y = y1 - f[1] + 1; y <= y1; y++) for (let x = x0; x < x0 + f[0]; x++) setM(x, y, 1);
    if (k == 'tower') for (let x = x0 + 1; x <= x0 + 2; x++) setM(x, y1, 3);
  }
  if (m.k) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = m.k.charCodeAt(y * W + x) - 48; if (v == 1) setM(x, y, 1); else if (v == 2 && !ring(x, y)) setM(x, y, 3); }
  return { N: W, W, H, T, pvp: m.pvp === 0 ? 0 : 1, spawn: m.spawn, boss: m.boss || null, areas: m.areas || [], M: Array.from(M).join('') };
}

module.exports = { validar, compilar, ID, dims, LIM: { MIN, MAX, AREA } };
