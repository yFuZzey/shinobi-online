/* Editor de mapas · FERRAMENTAS DE PINTURA (sem interface; funciona no Node para os testes)
   Opera no modelo (modelo.js): terreno do jogo (0–5; água/pântano/ponte em blocos 2×2, igual ao editor antigo),
   colisão pintada (k: 1 bloqueia, 2 libera) e camadas de tiles ({n, t:'tiles', d:[[iTileset, tx, ty, col, lin]], z, nome}).
   tx/ty ficam na grade do próprio tileset (tamanho original do tile, nada é esticado). tsInfo = {id:{tw,th}}.
   Camada "acima" (z:'acima') é desenhada por cima do personagem; as outras por baixo dos objetos, na ordem da lista. */
(function (G) {
  'use strict';
  const T = 32, MAXBALDE = 120000;
  const PADRAO = [{ n: 'chao', nome: 'Chão', z: 'baixo' }, { n: 'detalhes', nome: 'Detalhes do chão', z: 'baixo' }, { n: 'acima', nome: 'Acima do personagem', z: 'acima' }];
  const ehAcima = c => c.z ? c.z === 'acima' : c.n === 'acima';
  const nomeCamada = c => c.nome || (PADRAO.find(p => p.n === c.n) || {}).nome || c.n;
  const tiles = m => m.camadas.filter(c => c && c.t === 'tiles');
  function camada(m, n) { return m.camadas.find(c => c && c.t === 'tiles' && c.n === n) || null; }
  // garante as 3 camadas padrão (sem mexer nas que já existem)
  function padrao(m) { for (const p of PADRAO) if (!camada(m, p.n)) { const c = { n: p.n, t: 'tiles', d: [] }; if (p.n === 'acima') m.camadas.push(c); else { const i = m.camadas.findIndex(x => x && x.t === 'tiles' && ehAcima(x)); i < 0 ? m.camadas.push(c) : m.camadas.splice(i, 0, c); } } }
  function novaCamada(m, nome, z) { let i = 1, n; do n = 'c' + i++; while (camada(m, n)); const c = { n, t: 'tiles', d: [], nome: String(nome || 'Camada').slice(0, 30), z: z === 'acima' ? 'acima' : 'baixo' };
    if (c.z === 'acima') m.camadas.push(c); else { const k = m.camadas.findIndex(x => x && x.t === 'tiles' && ehAcima(x)); k < 0 ? m.camadas.push(c) : m.camadas.splice(k, 0, c); } return c; }
  // mover na ordem: dir = -1 (para baixo) / +1 (para cima). Passar pelos objetos troca o lado (baixo <-> acima)
  function moverCamada(m, n, dir) { const L = tiles(m), c = camada(m, n); if (!c) return false; const i = L.indexOf(c), viz = L[i + dir];
    if (dir > 0 && !ehAcima(c) && (!viz || ehAcima(viz))) { c.z = 'acima'; return true; }
    if (dir < 0 && ehAcima(c) && (!viz || !ehAcima(viz))) { c.z = 'baixo'; return true; }
    if (!viz) return false; const a = m.camadas.indexOf(c), b = m.camadas.indexOf(viz); m.camadas[a] = viz; m.camadas[b] = c; return true; }
  function tsIdx(m, id) { let i = m.tilesets.indexOf(id); if (i < 0) { m.tilesets.push(id); i = m.tilesets.length - 1; } return i; }
  // índice rápido de uma camada: "iTileset|tx|ty" -> entrada (refeito quando a camada é outra)
  const IDX = new WeakMap();
  function idx(c) { let x = IDX.get(c); if (!x || x.n !== c.d.length) { const M = new Map(); for (const e of c.d) M.set(e[0] + '|' + e[1] + '|' + e[2], e); x = { M, n: c.d.length }; IDX.set(c, x); } return x.M; }
  const dentro = (m, inf, tx, ty) => tx >= 0 && ty >= 0 && tx * inf.tw < m.W * T && ty * inf.th < m.H * T;
  function putTile(m, c, id, inf, tx, ty, col, lin) { if (!inf || !dentro(m, inf, tx, ty)) return false; const i = tsIdx(m, id), M = idx(c), k = i + '|' + tx + '|' + ty, e = M.get(k);
    if (e) { if (e[3] === col && e[4] === lin) return false; e[3] = col; e[4] = lin; return true; }
    const n = [i, tx, ty, col, lin]; c.d.push(n); M.set(k, n); IDX.get(c).n = c.d.length; return true; }
  function delEntrada(c, e) { const i = c.d.indexOf(e); if (i < 0) return false; c.d.splice(i, 1); IDX.delete(c); return true; }
  // apaga os tiles da camada que cobrem o ponto (px, py) em pixels do mapa
  function apagarPx(m, c, px, py, tsInfo) { let n = 0; const M = idx(c);
    for (let i = 0; i < m.tilesets.length; i++) { const inf = tsInfo[m.tilesets[i]]; if (!inf) continue; const e = M.get(i + '|' + Math.floor(px / inf.tw) + '|' + Math.floor(py / inf.th)); if (e && delEntrada(c, e)) n++; }
    return n; }
  // carimbo de tiles: s = {id, c0, r0, sw, sh} (pedaço do tileset); coloca com o canto em (tx, ty) da grade do tileset
  function carimbo(m, c, s, inf, tx, ty) { let n = 0; for (let j = 0; j < s.sh; j++) for (let i = 0; i < s.sw; i++) if (putTile(m, c, s.id, inf, tx + i, ty + j, s.c0 + i, s.r0 + j)) n++; return n; }
  // retângulo (na grade do tileset) com o desenho do carimbo repetido; contorno = só as bordas
  function retTiles(m, c, s, inf, a, b, contorno) { const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]); let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (contorno && x > x0 && x < x1 && y > y0 && y < y1) continue; if (putTile(m, c, s.id, inf, x, y, s.c0 + (x - x0) % s.sw, s.r0 + (y - y0) % s.sh)) n++; } return n; }
  // balde na grade do tileset: preenche a região ligada com o mesmo conteúdo (vazio ou o mesmo tile), sem sair do mapa
  function baldeTiles(m, c, s, inf, tx, ty) { if (!dentro(m, inf, tx, ty)) return { n: 0 }; const i = tsIdx(m, s.id), M = idx(c), mx = Math.ceil(m.W * T / inf.tw), my = Math.ceil(m.H * T / inf.th);
    const val = (x, y) => { const e = M.get(i + '|' + x + '|' + y); return e ? e[3] + ',' + e[4] : ''; }, alvo = val(tx, ty), novo = s.c0 + ',' + s.r0;
    if (alvo === novo && s.sw === 1 && s.sh === 1) return { n: 0 };
    const vis = new Set([tx + ',' + ty]), q = [[tx, ty]], L = []; let cort = false;
    while (q.length) { const [x, y] = q.pop(); L.push([x, y]); if (L.length >= MAXBALDE) { cort = true; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, k = X + ',' + Y; if (X < 0 || Y < 0 || X >= mx || Y >= my || vis.has(k)) continue; vis.add(k); if (val(X, Y) === alvo) q.push([X, Y]); } }
    let n = 0; for (const [x, y] of L) if (putTile(m, c, s.id, inf, x, y, s.c0 + (((x - tx) % s.sw) + s.sw) % s.sw, s.r0 + (((y - ty) % s.sh) + s.sh) % s.sh)) n++;
    return { n, cortado: cort }; }

  /* ---------- terreno do jogo (tiles de 32 px) ---------- */
  // devolve a área que mudou [x0,y0,x1,y1] ou null
  function terreno(m, x, y, t) { const W = m.W, H = m.H, g = m.chao; if (x < 0 || y < 0 || x >= W || y >= H) return null;
    if (t >= 2) { const bx = x >> 1 << 1, by = y >> 1 << 1; let mud = false; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const X = bx + b, Y = by + a; if (X < W && Y < H && g[Y * W + X] !== t) { g[Y * W + X] = t; mud = true; } } return mud ? [bx, by, bx + 1, by + 1] : null; }
    const i = y * W + x; let r = null;
    if (g[i] >= 2) { const bx = x >> 1 << 1, by = y >> 1 << 1; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const X = bx + b, Y = by + a; if (X < W && Y < H) g[Y * W + X] = 0; } r = [bx, by, bx + 1, by + 1]; }
    if (g[i] !== t) { g[i] = t; r = r || [x, y, x, y]; } return r; }
  function colisao(m, x, y, v) { if (x < 0 || y < 0 || x >= m.W || y >= m.H) return false; const i = y * m.W + x; if (m.col[i] === v) return false; m.col[i] = v; return true; }
  function retGrade(m, a, b, contorno, fn) { const x0 = Math.max(0, Math.min(a[0], b[0])), y0 = Math.max(0, Math.min(a[1], b[1])), x1 = Math.min(m.W - 1, Math.max(a[0], b[0])), y1 = Math.min(m.H - 1, Math.max(a[1], b[1])); let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { if (contorno && x > x0 && x < x1 && y > y0 && y < y1) continue; if (fn(x, y)) n++; } return n; }
  // balde em células de 32 px: lê o valor com get, pinta com set
  function baldeGrade(m, x, y, get, set) { if (x < 0 || y < 0 || x >= m.W || y >= m.H) return { n: 0 }; const alvo = get(x, y), vis = new Uint8Array(m.W * m.H), q = [x + y * m.W], L = []; vis[q[0]] = 1;
    while (q.length) { const i = q.pop(), X = i % m.W, Y = i / m.W | 0; L.push([X, Y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = X + dx, b = Y + dy; if (a < 0 || b < 0 || a >= m.W || b >= m.H) continue; const j = b * m.W + a; if (vis[j]) continue; vis[j] = 1; if (get(a, b) === alvo) q.push(j); } }
    let n = 0; for (const [a, b] of L) if (set(a, b)) n++; return { n }; }

  /* ---------- seleção: copiar, colar, apagar, mover (em tiles de 32 px) ----------
     clip = {w, h, terreno:'...'|null, col:'...'|null, tiles:{n:{nome,z,d:[[tsId, dxPx, dyPx, col, lin]]}}}  (JSON: serve para os conjuntos) */
  function copiar(m, s, op, tsInfo) { const clip = { w: s.w, h: s.h, terreno: null, col: null, tiles: {} };
    if (op.terreno) { let t = ''; for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) t += m.chao[y * m.W + x]; clip.terreno = t; }
    if (op.colisao) { let t = ''; for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) t += m.col[y * m.W + x]; clip.col = t; }
    const X0 = s.x * T, Y0 = s.y * T, X1 = (s.x + s.w) * T, Y1 = (s.y + s.h) * T;
    for (const c of tiles(m)) { if (op.camadas && !op.camadas.includes(c.n)) continue; const d = [];
      for (const e of c.d) { const id = m.tilesets[e[0]], inf = tsInfo[id]; if (!inf) continue; const px = e[1] * inf.tw, py = e[2] * inf.th; if (px >= X0 && px < X1 && py >= Y0 && py < Y1) d.push([id, px - X0, py - Y0, e[3], e[4]]); }
      if (d.length) clip.tiles[c.n] = { nome: nomeCamada(c), z: ehAcima(c) ? 'acima' : 'baixo', d }; }
    return clip; }
  function apagarArea(m, s, op, tsInfo) { let n = 0; const ini = m.ed && [0, 1, 2].includes(m.ed.terreno) ? m.ed.terreno : 0;
    for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) { if (op.terreno && terreno(m, x, y, ini)) n++; if (op.colisao && colisao(m, x, y, 0)) n++; }
    const X0 = s.x * T, Y0 = s.y * T, X1 = (s.x + s.w) * T, Y1 = (s.y + s.h) * T;
    for (const c of tiles(m)) { if (op.camadas && !op.camadas.includes(c.n)) continue; const fica = c.d.filter(e => { const inf = tsInfo[m.tilesets[e[0]]]; if (!inf) return true; const px = e[1] * inf.tw, py = e[2] * inf.th; return !(px >= X0 && px < X1 && py >= Y0 && py < Y1); });
      if (fica.length !== c.d.length) { n += c.d.length - fica.length; c.d = fica; IDX.delete(c); } }
    return n; }
  // cola com o canto em (X, Y) (tiles de 32 px). Tiles que não caem na grade do tileset (ex.: 48 px com deslocamento ímpar) são pulados
  function colar(m, clip, X, Y, op, tsInfo) { const r = { n: 0, pulados: 0, fora: 0 };
    if (clip.terreno && op.terreno) for (let j = 0; j < clip.h; j++) for (let i = 0; i < clip.w; i++) { const t = +clip.terreno[j * clip.w + i]; const x = X + i, y = Y + j; if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
      if (t >= 2 && ((x & 1) || (y & 1))) continue; if (terreno(m, x, y, t)) r.n++; }
    if (clip.col && op.colisao) for (let j = 0; j < clip.h; j++) for (let i = 0; i < clip.w; i++) if (colisao(m, X + i, Y + j, +clip.col[j * clip.w + i])) r.n++;
    for (const n in clip.tiles) { const src = clip.tiles[n]; if (op.camadas && !op.camadas.includes(n)) continue; let c = camada(m, n);
      if (!c) { c = { n, t: 'tiles', d: [] }; if (src.nome) c.nome = src.nome; if (src.z) c.z = src.z; if (ehAcima(c)) m.camadas.push(c); else { const k = m.camadas.findIndex(x => x && x.t === 'tiles' && ehAcima(x)); k < 0 ? m.camadas.push(c) : m.camadas.splice(k, 0, c); } }
      for (const e of src.d) { const inf = tsInfo[e[0]]; if (!inf) { r.pulados++; continue; } const px = X * T + e[1], py = Y * T + e[2];
        if (px % inf.tw || py % inf.th) { r.pulados++; continue; } if (!dentro(m, inf, px / inf.tw, py / inf.th)) { r.fora++; continue; } if (putTile(m, c, e[0], inf, px / inf.tw, py / inf.th, e[3], e[4])) r.n++; } }
    return r; }
  // tira do mapa os tilesets que ninguém usa e reajusta os números
  function compactar(m) { const usado = new Set(); for (const c of tiles(m)) for (const e of c.d) usado.add(e[0]); if (usado.size === m.tilesets.length) return;
    const novo = [], mapa = {}; m.tilesets.forEach((id, i) => { if (usado.has(i)) { mapa[i] = novo.length; novo.push(id); } });
    for (const c of tiles(m)) { for (const e of c.d) e[0] = mapa[e[0]]; IDX.delete(c); } m.tilesets = novo; }

  const API = { T, PADRAO, ehAcima, nomeCamada, tiles, camada, padrao, novaCamada, moverCamada, tsIdx, putTile, apagarPx, carimbo, retTiles, baldeTiles, terreno, colisao, retGrade, baldeGrade, copiar, colar, apagarArea, compactar };
  if (typeof module === 'object' && module.exports) module.exports = API; else G.Ferr = API;
})(typeof window !== 'undefined' ? window : globalThis);
