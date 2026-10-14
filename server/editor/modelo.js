/* Editor de mapas · MODELO DO MAPA (sem interface): criar, ler/gravar no formato do jogo, redimensionar e conferir.
   Funciona no navegador (window.Modelo) e no Node (require), para os testes.
   Formato do jogo (v2): ground (W·H dígitos 0–5), objects [[chave,x,y,...]], k (colisão pintada 0–2), spawn, boss, areas, tilesets/camadas.
   Mapas sem W/H são 50×50 (os antigos). O editor guarda os dados dele em "ed" (o jogo e o servidor ignoram).
   Coordenadas: tiles de 32 px; x/y dos objetos são números com fração (a base do objeto), guardados sem arredondar. */
(function (G) {
  'use strict';
  const T = 32, N0 = 50, LIM = { MIN: 8, MAX: 100, AREA: 6400 }; // 8 = sala pequena (a borda de 2 tiles é sempre bloqueada)
  const TEMAS = {
    folha: { n: 'Folha', terr: ['Grama', 'Rua', 'Pântano', 'Lagoa', 'Rio', 'Ponte'], th: ['g1', 'p1', 'sw1', 'water', 'river', 'river'] },
    areia: { n: 'Areia', terr: ['Areia', 'Caminho', 'Duna', 'Oásis', 'Rio', 'Ponte'], th: ['sg1', 'sp1', 'sd1', 'swater', 'sriver', 'sriver'] },
    // sem fundo: o terreno inicial é preto (salas, interiores); rua/água/ponte usam as texturas da Folha
    vazio: { n: 'Sem fundo (preto)', terr: ['Vazio (preto)', 'Rua', 'Pântano', 'Lagoa', 'Rio', 'Ponte'], th: ['', 'p1', 'sw1', 'water', 'river', 'river'] } };
  const INICIAIS = [0, 1, 2]; // terrenos em que dá para andar (água bloqueia: um mapa todo de água não teria onde nascer)
  const ID = /^[a-z0-9_]{2,30}$/, BASE_IDS = ['konoha', 'vila_areia'];
  const CONHECIDOS = new Set(['v', 'N', 'T', 'W', 'H', 'name', 'title', 'theme', 'ground', 'objects', 'spawn', 'boss', 'k', 'areas', 'tilesets', 'camadas', 'ed', 'pvp', 'ev']);
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fundo = o => JSON.parse(JSON.stringify(o));

  function slug(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30); }
  // problema com as dimensões ('' = ok)
  function dimErro(W, H) {
    if (!Number.isInteger(W) || !Number.isInteger(H)) return 'Largura e altura precisam ser números inteiros.';
    if (W < LIM.MIN || H < LIM.MIN) return 'O mínimo é ' + LIM.MIN + ' tiles de cada lado (a borda de 2 tiles é sempre bloqueada).';
    if (W > LIM.MAX || H > LIM.MAX) return 'O máximo é ' + LIM.MAX + ' tiles de cada lado.';
    if (W * H > LIM.AREA) return 'Grande demais para o celular: ' + W + '×' + H + ' = ' + (W * H) + ' tiles (máximo ' + LIM.AREA + ', por exemplo 80×80 ou 100×64).';
    return ''; }
  // memória da imagem do chão (uma camada) em MB
  const memMB = (W, H) => Math.round(W * T * H * T * 4 / 1048576);

  /* ---------- criar ---------- */
  function novo(o) {
    const W = o.W | 0, H = o.H | 0, e = dimErro(W, H); if (e) throw new Error(e);
    const id = o.id; if (!ID.test(id || '')) throw new Error('Identificador inválido: use 2 a 30 letras minúsculas, números ou _.');
    const tema = TEMAS[o.tema] ? o.tema : 'folha', terreno = INICIAIS.includes(o.terreno) ? o.terreno : 0, tile = clamp((o.tile | 0) || 32, 4, 512);
    const sp = Array.isArray(o.spawn) && fin(o.spawn[0]) && fin(o.spawn[1]) ? [clamp(+o.spawn[0], 2, W - 2), clamp(+o.spawn[1], 2, H - 2)] : [Math.floor(W / 2) + .5, Math.floor(H / 2) + .5];
    return { id, nome: String(o.nome || id).slice(0, 40), W, H, tema, chao: new Uint8Array(W * H).fill(terreno), col: new Uint8Array(W * H), objetos: [],
      spawn: sp, boss: null, areas: [], pvp: true, eventos: [], tilesets: [], camadas: [], extra: {}, tem: { k: false, title: true, boss: false }, ed: { v: 1, tile, terreno, criado: Date.now() } }; }

  /* ---------- formato do jogo -> modelo (sem perder nada) ---------- */
  function deJogo(j, id) {
    if (!j || typeof j !== 'object') throw new Error('Mapa vazio.');
    if (j.v !== 1 && j.v !== 2) throw new Error('Versão de mapa desconhecida (' + j.v + ').');
    const W = j.W != null ? j.W : (j.N || N0), H = j.H != null ? j.H : (j.N || N0);
    if (!Number.isInteger(W) || !Number.isInteger(H) || W < 4 || H < 4 || W > 512 || H > 512) throw new Error('Tamanho do mapa inválido.');
    if (typeof j.ground !== 'string' || j.ground.length !== W * H || /[^0-5]/.test(j.ground)) throw new Error('Terreno inválido (esperava ' + W * H + ' tiles).');
    if (!Array.isArray(j.objects)) throw new Error('Lista de objetos inválida.');
    const chao = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) chao[i] = j.ground.charCodeAt(i) - 48;
    const col = new Uint8Array(W * H); if (typeof j.k === 'string' && j.k.length === W * H && !/[^0-2]/.test(j.k)) for (let i = 0; i < W * H; i++) col[i] = j.k.charCodeAt(i) - 48;
    const objetos = [];
    for (const r of j.objects) { if (!Array.isArray(r) || typeof r[0] !== 'string' || !fin(r[1]) || !fin(r[2])) continue; objetos.push({ k: r[0], x: r[1], y: r[2], f: fundo(r.slice(3)) }); }
    const extra = {}; for (const k in j) if (!CONHECIDOS.has(k)) extra[k] = fundo(j[k]);
    const ed = j.ed && typeof j.ed === 'object' ? fundo(j.ed) : { v: 1, tile: 32, terreno: 0 };
    return { id: id || j.name || 'mapa', nome: typeof j.title === 'string' ? j.title : (id || j.name || 'mapa'), W, H, tema: TEMAS[j.theme] ? j.theme : 'folha', chao, col, objetos,
      spawn: Array.isArray(j.spawn) ? j.spawn.slice() : [W / 2 + .5, H / 2 + .5], boss: Array.isArray(j.boss) ? j.boss.slice() : null,
      areas: Array.isArray(j.areas) ? fundo(j.areas) : [], pvp: j.pvp !== 0, eventos: Array.isArray(j.ev) ? fundo(j.ev) : [], tilesets: Array.isArray(j.tilesets) ? j.tilesets.slice() : [], camadas: Array.isArray(j.camadas) ? fundo(j.camadas) : [],
      extra, tem: { cn: Array.isArray(j.camadas) ? j.camadas.map(c => c && c.n) : [], v: j.v, k: typeof j.k === 'string', title: typeof j.title === 'string', boss: 'boss' in j, areas: 'areas' in j, theme: 'theme' in j, name: j.name }, ed }; }

  /* ---------- modelo -> formato do jogo ---------- */
  function paraJogo(m, semEd) {
    const j = { v: m.tem.v === 1 ? 1 : 2, N: m.W, T, name: m.id }; // v1 e v2 têm o mesmo conteúdo; mantém a do arquivo
    if (m.tem.title || m.nome !== m.id) j.title = m.nome;
    if (m.tem.theme !== false) j.theme = m.tema;
    if (m.W !== N0 || m.H !== N0) { j.W = m.W; j.H = m.H; }
    j.ground = Array.from(m.chao).join('');
    j.objects = m.objetos.map(o => [o.k, o.x, o.y].concat(fundo(o.f || [])));
    j.spawn = m.spawn.slice();
    if (m.boss || m.tem.boss) j.boss = m.boss ? m.boss.slice() : null;
    if (m.tem.k || m.col.some(v => v)) j.k = Array.from(m.col).join('');
    if (m.areas.length || m.tem.areas) j.areas = fundo(m.areas);
    if (m.pvp === false) j.pvp = 0; // sem o campo = PvP ligado (como sempre foi)
    if (m.eventos && m.eventos.length) j.ev = fundo(m.eventos); // eventos ao pisar: {x, y, t:'tp', m: mapa, tx, ty}
    // camadas padrão vazias criadas só pelo editor não vão para o arquivo (mapa antigo continua igual se ninguém pintou)
    const orig = new Set((m.tem && m.tem.cn) || []), cam = m.camadas.filter(c => !(c && c.t === 'tiles' && !c.d.length && !c.nome && !c.z && ['chao', 'detalhes', 'acima'].includes(c.n) && !orig.has(c.n)));
    if (m.tilesets.length || cam.length) { j.tilesets = m.tilesets.slice(); j.camadas = fundo(cam); }
    for (const k in m.extra) j[k] = fundo(m.extra[k]);
    if (!semEd) j.ed = fundo(m.ed);
    return j; }

  function copia(m) { const c = deJogo(paraJogo(m), m.id); c.nome = m.nome; c.tem = fundo(m.tem); return c; }

  /* ---------- redimensionar: ancora ax/ay = 0 (esquerda/topo), .5 (centro), 1 (direita/baixo) ----------
     O deslocamento é sempre par (água, pântano e ponte ficam em blocos de 2×2). tsInfo = {id:{tw,th}} dos tilesets usados.
     Devolve {mapa, perdas, erro}: nada é alterado no mapa original. */
  function redimensionar(m, W2, H2, ax, ay, tsInfo) {
    const e = dimErro(W2, H2); if (e) return { erro: e };
    const dx = Math.round((W2 - m.W) * (ax || 0) / 2) * 2, dy = Math.round((H2 - m.H) * (ay || 0) / 2) * 2;
    const perdas = { objetos: 0, areasRemovidas: 0, areasCortadas: 0, colisao: 0, tiles: 0, terreno: 0, spawn: false, boss: false, outrasCamadas: 0, dx, dy };
    const n = copia(m); n.W = W2; n.H = H2;
    const ini = INICIAIS.includes(m.ed && m.ed.terreno) ? m.ed.terreno : 0;
    n.chao = new Uint8Array(W2 * H2).fill(ini); n.col = new Uint8Array(W2 * H2);
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const i = y * m.W + x, X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W2 && Y < H2) { n.chao[Y * W2 + X] = m.chao[i]; n.col[Y * W2 + X] = m.col[i]; }
      else { if (m.chao[i] !== ini) perdas.terreno++; if (m.col[i]) perdas.colisao++; } }
    n.objetos = [];
    for (const o of m.objetos) { const x = o.x + dx, y = o.y + dy, base = Math.floor((y * T - 1) / T);
      if (x >= 0 && x < W2 && base >= 0 && base < H2) n.objetos.push({ k: o.k, x, y, f: fundo(o.f || []) }); else perdas.objetos++; }
    n.areas = [];
    for (const a of m.areas) { const x0 = Math.max(0, a.x + dx), y0 = Math.max(0, a.y + dy), x1 = Math.min(W2, a.x + dx + a.w), y1 = Math.min(H2, a.y + dy + a.h);
      if (x1 <= x0 || y1 <= y0) { perdas.areasRemovidas++; continue; }
      if (x1 - x0 !== a.w || y1 - y0 !== a.h) perdas.areasCortadas++;
      n.areas.push(Object.assign(fundo(a), { x: x0, y: y0, w: x1 - x0, h: y1 - y0 })); }
    const pt = (p, k) => { if (!p) return p; const q = [p[0] + dx, p[1] + dy], c = [clamp(q[0], 2, W2 - 2), clamp(q[1], 2, H2 - 2)]; if (c[0] !== q[0] || c[1] !== q[1]) perdas[k] = true; return c; };
    n.eventos = []; for (const v of m.eventos || []) { const x = v.x + dx, y = v.y + dy; if (x >= 0 && y >= 0 && x < W2 && y < H2) n.eventos.push(Object.assign(fundo(v), { x, y })); else perdas.eventos = (perdas.eventos || 0) + 1; }
    n.spawn = pt(m.spawn, 'spawn'); n.boss = pt(m.boss, 'boss');
    n.camadas = [];
    for (const c of m.camadas) {
      if (!c || c.t !== 'tiles') { if (dx || dy) perdas.outrasCamadas++; n.camadas.push(fundo(c)); continue; }
      const d = [];
      for (const t of c.d || []) { const tid = m.tilesets[t[0]], inf = tsInfo && tsInfo[tid];
        if (!inf) { if (dx || dy) return { erro: 'Não sei o tamanho do tile do tileset "' + tid + '" (ele não está na biblioteca). Use o canto superior esquerdo como âncora.' }; d.push(t.slice()); continue; }
        const sx = dx * T / inf.tw, sy = dy * T / inf.th;
        if (!Number.isInteger(sx) || !Number.isInteger(sy)) return { erro: 'Com essa âncora os tiles de ' + inf.tw + '×' + inf.th + ' px do tileset "' + tid + '" ficariam desalinhados. Use o canto superior esquerdo como âncora.' };
        const tx = t[1] + sx, ty = t[2] + sy;
        if (tx >= 0 && ty >= 0 && tx * inf.tw < W2 * T && ty * inf.th < H2 * T) d.push([t[0], tx, ty, t[3], t[4]]); else perdas.tiles++; }
      n.camadas.push(Object.assign(fundo(c), { d })); }
    return { mapa: n, perdas }; }

  function perdasTexto(p) {
    const L = [];
    if (p.objetos) L.push(p.objetos + ' objeto(s) ficam fora e serão apagados');
    if (p.terreno) L.push(p.terreno + ' tile(s) de terreno pintado serão cortados');
    if (p.colisao) L.push(p.colisao + ' célula(s) de colisão pintada serão cortadas');
    if (p.tiles) L.push(p.tiles + ' tile(s) das camadas serão apagados');
    if (p.eventos) L.push(p.eventos + ' evento(s) ficam fora e serão apagados');
    if (p.areasRemovidas) L.push(p.areasRemovidas + ' área(s) de mobs serão apagadas');
    if (p.areasCortadas) L.push(p.areasCortadas + ' área(s) de mobs ficam menores');
    if (p.spawn) L.push('o ponto de nascimento será movido para dentro do mapa');
    if (p.boss) L.push('o ponto do chefe será movido para dentro do mapa');
    if (p.outrasCamadas) L.push(p.outrasCamadas + ' camada(s) de outro tipo não acompanham o deslocamento');
    return L; }

  /* ---------- conferir antes de salvar/publicar ---------- */
  // cat = {fpt,tsz} (como o servidor); compilar = MR.compilar; lib = {tilesets:Set, objetos:Set}
  function conferir(m, cat, compilar, lib) {
    const P = [], e = dimErro(m.W, m.H); if (e) P.push({ nivel: 'erro', msg: e });
    if (!ID.test(m.id)) P.push({ nivel: 'erro', msg: 'Identificador inválido.' });
    if (BASE_IDS.includes(m.id)) P.push({ nivel: 'erro', msg: '“' + m.id + '” é um mapa que já vem no jogo: duplique e use outro identificador.' });
    if (lib && lib.objetos) { const f = new Set(m.objetos.filter(o => !lib.objetos.has(o.k)).map(o => o.k)); if (f.size) P.push({ nivel: 'aviso', msg: 'Objeto(s) sem imagem na biblioteca: ' + [...f].join(', ') + ' (o servidor descarta).' }); }
    if (lib && lib.tilesets) { const f = m.tilesets.filter(t => !lib.tilesets.has(t)); if (f.length) P.push({ nivel: 'erro', msg: 'Tileset(s) ausente(s) da biblioteca: ' + f.join(', ') + '.' }); }
    if (compilar && cat && !e) { try { const c = compilar(paraJogo(m, true), cat), sx = Math.floor(m.spawn[0]), sy = Math.floor(m.spawn[1]), v = c.M.charCodeAt(sy * m.W + sx) - 48;
      if (v === 1 || v === 2) P.push({ nivel: 'aviso', msg: 'O ponto de nascimento está num lugar bloqueado (' + sx + ', ' + sy + ').' }); } catch (_) { } }
    return P; }

  const API = { T, N0, LIM, TEMAS, INICIAIS, ID, BASE_IDS, slug, dimErro, memMB, novo, deJogo, paraJogo, copia, redimensionar, perdasTexto, conferir };
  if (typeof module === 'object' && module.exports) module.exports = API; else G.Modelo = API;
})(typeof window !== 'undefined' ? window : globalThis);
