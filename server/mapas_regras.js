'use strict';
// Mapas criados no editor do painel (/painel/mapas): confere o que veio do banco e refaz a colisão do servidor.
// A colisão segue exatamente applyMap do jogo (terreno, tamanho dos objetos no chão, colisão pintada); o teste "mapas" compara os dois.
// cat = { fpt: {objeto:[largura,altura,recuo]}, tsz: [objetos que existem] }  (gerado junto com maps.json por src/online/exportmaps.js)
const N = 50, T = 32;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fin = v => typeof v === 'number' && isFinite(v);
const TEMAS = { folha: 1, areia: 1 };
const ID = /^[a-z0-9_]{2,30}$/;

// devolve o mapa limpo (formato do jogo) ou null se não prestar
function validar(id, nome, m, cat) {
  if (!ID.test(id || '') || !m || typeof m !== 'object') return null;
  const tsz = new Set((cat && cat.tsz) || []);
  if (typeof m.ground !== 'string' || m.ground.length !== N * N || /[^0-5]/.test(m.ground)) return null;
  if (!Array.isArray(m.objects) || m.objects.length > 4000) return null;
  const O = [];
  for (const r of m.objects) {
    if (!Array.isArray(r) || !tsz.has(r[0]) || !fin(r[1]) || !fin(r[2])) continue;
    const o = [r[0], +r[1].toFixed(4), +r[2].toFixed(4)];
    if (r[3] || Array.isArray(r[4])) o.push(r[3] ? 1 : 0);
    if (Array.isArray(r[4]) && r[4].length <= 120) o.push(r[4].filter(a => Array.isArray(a) && fin(a[0]) && fin(a[1])).map(a => [Math.round(a[0]), Math.round(a[1])]));
    O.push(o);
  }
  const pt = (a, d) => Array.isArray(a) && fin(a[0]) && fin(a[1]) ? [clamp(+a[0], 2, N - 2), clamp(+a[1], 2, N - 2)] : d;
  const A = [];
  if (Array.isArray(m.areas)) for (const a of m.areas.slice(0, 60)) {
    if (!a || ![a.x, a.y, a.w, a.h].every(fin)) continue;
    const x = clamp(Math.round(a.x), 0, N - 1), y = clamp(Math.round(a.y), 0, N - 1);
    A.push({ x, y, w: clamp(Math.round(a.w), 1, N - x), h: clamp(Math.round(a.h), 1, N - y),
      mobs: (Array.isArray(a.mobs) ? a.mobs : []).filter(e => e && typeof e.m === 'string' && /^[a-z0-9_]{1,40}$/.test(e.m)).slice(0, 10).map(e => ({ m: e.m, n: clamp(Math.round(+e.n || 0), 0, 40) })) });
  }
  const out = { v: 2, N, T, name: id, title: String(nome || id).replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) || id, theme: TEMAS[m.theme] ? m.theme : 'folha',
    ground: m.ground, objects: O, spawn: pt(m.spawn, [25.5, 25.5]), boss: pt(m.boss, null) };
  if (typeof m.k === 'string' && m.k.length === N * N && !/[^0-2]/.test(m.k)) out.k = m.k;
  if (A.length) out.areas = A;
  return out;
}

// colisão do servidor: 0 livre, 1 parede, 2 água/buraco, 3 estrada/ponte (como o M de maps.json)
function compilar(m, cat) {
  const M = new Uint8Array(N * N), g = m.ground, gt = (x, y) => g.charCodeAt(y * N + x) - 48, ring = (x, y) => x < 2 || y < 2 || x >= N - 2 || y >= N - 2;
  const setM = (x, y, v) => { if (x >= 0 && y >= 0 && x < N && y < N) M[y * N + x] = v; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (gt(x, y) == 1) M[y * N + x] = 3;
  for (let cy = 0; cy < 25; cy++) for (let cx = 0; cx < 25; cx++) {
    const t = gt(cx * 2, cy * 2); if (t < 2 || t == 2) continue;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) M[(cy * 2 + j) * N + cx * 2 + i] = t == 5 ? 3 : 2;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (ring(x, y)) M[y * N + x] = 1;
  const tsz = new Set(cat.tsz || []);
  for (const r of m.objects) {
    const k = r[0]; if (!tsz.has(k)) continue;
    const f = cat.fpt[k] || [1, 1, 0], base = Math.floor((r[2] * T - 1) / T), x0 = Math.round(r[1] - f[0] / 2), y1 = base - f[2];
    if (Array.isArray(r[4])) { const bx = Math.floor(r[1]); for (const a of r[4]) setM(bx + a[0], base + a[1], 1); }
    else if (!r[3]) for (let y = y1 - f[1] + 1; y <= y1; y++) for (let x = x0; x < x0 + f[0]; x++) setM(x, y, 1);
    if (k == 'tower') for (let x = x0 + 1; x <= x0 + 2; x++) setM(x, y1, 3);
  }
  if (m.k) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = m.k.charCodeAt(y * N + x) - 48; if (v == 1) setM(x, y, 1); else if (v == 2 && !ring(x, y)) setM(x, y, 3); }
  return { N, T, spawn: m.spawn, boss: m.boss || null, areas: m.areas || [], M: Array.from(M).join('') };
}

module.exports = { validar, compilar, ID };
