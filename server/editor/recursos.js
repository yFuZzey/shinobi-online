/* Editor de mapas · BIBLIOTECA DE RECURSOS (dados + processamento de imagem, sem interface)
   Tabela mapa_recursos (sql/17): um registro por imagem importada (tileset, spritesheet ou imagem solta), com
   - original: o arquivo enviado, guardado no Storage SEM nenhuma alteração (caminho pelo hash do conteúdo);
   - arquivo: o que o jogo/editor usam = o próprio original, ou uma cópia PNG com o fundo removido (derivados/);
   - fundo / grade / recortes / meta: só metadados (a imagem não é recortada nem redimensionada).
   Também lê os tilesets e imagens do editor antigo (mapa_tilesets / mapa_imagens) e pode trazê-los para a biblioteca. */
(function (G) {
  'use strict';
  const EXT = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif' };
  const TIPOS = { tileset: 'Tileset (grade)', spritesheet: 'Spritesheet (recortes)', imagem: 'Imagem solta' };
  const CATS = ['Tilesets', 'Spritesheets', 'Estruturas', 'Objetos', 'Natureza', 'Outros'];
  const MAXPX = 36e6; // processar (fundo, detecção) até ~6000×6000; acima disso a imagem vai como está
  const P = () => G.Persist;

  async function sha12(buf) { const d = await crypto.subtle.digest('SHA-256', buf); return [...new Uint8Array(d)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(''); }
  // envia para o Storage; o caminho é o hash do conteúdo, então "já existe" quer dizer que o arquivo igual já está lá
  async function subir(caminho, blob, tipo) {
    const S = P().sessao(); if (!S) throw new Error('Entre com a conta admin.');
    let r; try { r = await fetch(G.EDITOR_SB_URL + '/storage/v1/object/mapa-recursos/' + caminho, { method: 'POST', headers: { apikey: G.EDITOR_SB_KEY, Authorization: 'Bearer ' + S.tok, 'Content-Type': tipo, 'cache-control': '31536000' }, body: blob }); }
    catch (e) { throw new Error('Sem conexão para enviar o arquivo.'); }
    if (r.ok) return caminho;
    let j = {}; try { j = await r.json(); } catch (_) { }
    if (r.status === 409 || String(j.statusCode) === '409' || /already exists/i.test(j.message || j.error || '')) return caminho;
    if (/bucket not found/i.test(j.message || j.error || '')) throw new Error('O Storage ainda não existe: rode o sql/15_mapa_recursos.sql no Supabase.');
    const e = new Error(j.message || j.error || ('Erro ' + r.status + ' ao enviar o arquivo')); e.status = r.status; throw e; }
  const url = c => P().STORE + c;

  /* ---------- banco ---------- */
  function erroSql(e) { const m = String(e && e.message || e);
    if (e && (e.code === 'PGRST205' || /Could not find the table|mapa_recursos/i.test(m) && /schema cache|does not exist/i.test(m))) return 'O banco ainda não tem a biblioteca: rode o arquivo sql/17_mapa_recursos.sql no Supabase.';
    return P().erroTexto(e); }
  async function listar() { return (await P().api('/rest/v1/mapa_recursos?select=*&order=atualizado_em.desc')) || []; }
  async function ler(id) { const r = await P().api('/rest/v1/mapa_recursos?select=*&id=eq.' + encodeURIComponent(id)); return r && r[0] || null; }
  const CAMPOS = ['nome', 'tipo', 'categoria', 'colecao', 'original', 'arquivo', 'w', 'h', 'fundo', 'grade', 'recortes', 'meta'];
  const corpo = r => { const o = {}; for (const k of CAMPOS) o[k] = r[k] === undefined ? null : r[k]; if (!o.recortes) o.recortes = []; if (!o.meta) o.meta = {}; o.categoria = o.categoria || ''; o.colecao = o.colecao || ''; return o; };
  async function criar(r) { const b = Object.assign({ id: r.id }, corpo(r));
    try { const x = await P().api('/rest/v1/mapa_recursos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(b) }); return x && x[0]; }
    catch (e) { if (e.status === 409 || e.code === '23505') { const z = new Error('Já existe um recurso com o identificador ' + r.id); z.existe = 1; throw z; } throw e; } }
  // só grava se ninguém mudou desde que abriu (atualizado_em); forcar = depois de confirmar
  async function atualizar(r, forcar) {
    const f = '/rest/v1/mapa_recursos?id=eq.' + encodeURIComponent(r.id) + (forcar || !r.atualizado_em ? '' : '&atualizado_em=eq.' + encodeURIComponent(r.atualizado_em));
    const x = await P().api(f, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(corpo(r)) });
    if (!x || !x.length) { const z = new Error(forcar ? 'Esse recurso não existe mais.' : 'Esse recurso foi alterado em outro lugar depois que você abriu.'); z.conflito = !forcar; throw z; }
    return x[0]; }
  async function apagar(id) { await P().api('/rest/v1/mapa_recursos?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }
  function novoId(nome, usados) { const b = 'r_' + ((P() && G.Modelo ? G.Modelo.slug(nome) : String(nome)).slice(0, 30) || 'img'); let id = b.length < 4 ? b + '_1' : b, n = 2; while (usados.has(id)) id = b.slice(0, 36) + '_' + n++; return id; }

  /* ---------- imagem ---------- */
  function abrirArquivo(f) { return new Promise((ok, no) => { if (!EXT[f.type]) return no(new Error('Use PNG, WebP, JPG ou GIF.')); const u = URL.createObjectURL(f), i = new Image();
    i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); no(new Error('Não consegui abrir essa imagem.')); }; i.src = u; }); }
  function abrirUrl(u) { return new Promise((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = () => no(new Error('Não consegui baixar a imagem (' + u.split('/').pop() + ').')); i.src = u; }); }
  function pixels(img) { const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height; if (W * H > MAXPX) return null;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return g.getImageData(0, 0, W, H); }
  const hex = k => '#' + k.map(v => v.toString(16).padStart(2, '0')).join('');
  // transparência real? fundo de cor sólida nas bordas?
  function analisar(d) { const a = d.data, W = d.width, H = d.height; let baixo = 0; for (let p = 3; p < a.length; p += 4) if (a[p] < 128) baixo++;
    let bt = 0, bb = 0; const cnt = new Map(), bp = (x, y) => { const p = (y * W + x) * 4; bt++; if (a[p + 3] < 128) { bb++; return; } const q = a[p] << 16 | a[p + 1] << 8 | a[p + 2]; cnt.set(q, (cnt.get(q) || 0) + 1); };
    for (let x = 0; x < W; x++) { bp(x, 0); if (H > 1) bp(x, H - 1); } for (let y = 1; y < H - 1; y++) { bp(0, y); if (W > 1) bp(W - 1, y); }
    const transp = baixo / (W * H) >= .001 || bb / bt >= .2; let best = 0, bn = 0; for (const [q, n] of cnt) if (n > bn) { bn = n; best = q; }
    const k = [best >> 16 & 255, best >> 8 & 255, best & 255], solido = !transp && bn / bt >= .6 ? { cor: k, hex: hex(k), pc: Math.round(bn / bt * 100), magenta: k[0] > 200 && k[2] > 200 && k[1] < 90 } : null;
    return { transp, pcTransp: baixo / (W * H), solido }; }
  // remove o fundo por cor (só cópia): modo 'borda' = só o que se liga às bordas passando por fundo; 'tudo' = toda a imagem
  function removerFundo(d, f) { const W = d.width, H = d.height, out = new ImageData(new Uint8ClampedArray(d.data), W, H), a = out.data, t2 = f.tol * f.tol, kr = f.cor[0], kg = f.cor[1], kb = f.cor[2]; let n = 0;
    const perto = i => { const p = i * 4; if (a[p + 3] === 0) return false; const dr = a[p] - kr, dg = a[p + 1] - kg, db = a[p + 2] - kb; return dr * dr + dg * dg + db * db <= t2; };
    if (f.modo === 'tudo') { for (let i = 0; i < W * H; i++) if (perto(i)) { a[i * 4 + 3] = 0; n++; } }
    else { const seen = new Uint8Array(W * H), q = new Int32Array(W * H); let h = 0, t = 0;
      const push = (x, y) => { const i = y * W + x; if (seen[i]) return; seen[i] = 1; if (a[i * 4 + 3] === 0 || perto(i)) q[t++] = i; };
      for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); } for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
      while (h < t) { const i = q[h++], x = i % W, y = i / W | 0; if (a[i * 4 + 3] !== 0) { a[i * 4 + 3] = 0; n++; } if (x > 0) push(x - 1, y); if (x < W - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < H - 1) push(x, y + 1); } }
    return Object.assign({ dados: out, removidos: n }, limparBordas(out, f)); }
  /* bordas rosadas: os pixels da borda do desenho costumam ser uma mistura da arte com a cor do fundo (antisserrilhado).
     Para cada anel de pixels encostados no que foi removido (f.borda anéis; padrão 2): se ainda é quase a cor do fundo, sai;
     senão tira o “vazamento” da cor do fundo (ex.: magenta → tira o excesso de vermelho+azul sobre o verde). Pixels internos não mudam. */
  function limparBordas(out, f) { const W = out.width, H = out.height, a = out.data, an = f.borda == null ? 2 : Math.max(0, Math.min(3, f.borda | 0)); if (!an) return { bordas: 0 };
    const k = f.cor, hi = [0, 1, 2].filter(c => k[c] > 128), lo = [0, 1, 2].filter(c => k[c] <= 128), t2 = Math.min(160, f.tol * 2.5 + 20) ** 2;
    let fora = new Uint8Array(W * H), nb = 0; for (let i = 0; i < W * H; i++) if (a[i * 4 + 3] === 0) fora[i] = 1;
    for (let r = 0; r < an; r++) { const prox = new Uint8Array(fora);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (fora[i]) continue; let viz = false;
        for (let dy = -1; dy <= 1 && !viz; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && fora[Y * W + X]) { viz = true; break; } }
        if (!viz) continue; const p = i * 4, dr = a[p] - k[0], dg = a[p + 1] - k[1], db = a[p + 2] - k[2];
        if (dr * dr + dg * dg + db * db <= t2) { a[p + 3] = 0; prox[i] = 1; nb++; continue; }
        if (hi.length && lo.length) { let mh = 255, ml = 0; for (const c of hi) mh = Math.min(mh, a[p + c]); for (const c of lo) ml = Math.max(ml, a[p + c]); const v = mh - ml; if (v > 0) { for (const c of hi) a[p + c] -= v; nb++; } }
        prox[i] = 2; }
      for (let i = 0; i < W * H; i++) if (prox[i] === 2) prox[i] = 1; fora = prox; }
    return { bordas: nb }; }
  const paraCanvas = d => { const c = document.createElement('canvas'); c.width = d.width; c.height = d.height; c.getContext('2d').putImageData(d, 0, 0); return c; };
  const canvasPng = c => new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('Não consegui gerar a cópia PNG.')), 'image/png'));

  /* ---------- detecção automática de peças (opcional) ----------
     Peça = pixels "de desenho" ligados entre si (8 vizinhos): não transparentes, ou diferentes da cor de fundo.
     Peças a até "junta" px umas das outras viram uma só (folhas soltas de uma árvore, sombra separada...). Peças menores que "min" px somem. */
  function detectar(d, o) {
    const W = d.width, H = d.height, a = d.data, junta = Math.max(0, o.junta | 0), min = Math.max(1, o.min | 0), t2 = (o.tol || 0) * (o.tol || 0), cor = o.cor;
    const desenho = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < W * H; i++, p += 4) { if (a[p + 3] < (o.alfa || 16)) continue;
      if (cor) { const dr = a[p] - cor[0], dg = a[p + 1] - cor[1], db = a[p + 2] - cor[2]; if (dr * dr + dg * dg + db * db <= t2) continue; } desenho[i] = 1; }
    const vis = new Uint8Array(W * H), q = new Int32Array(W * H); let B = [];
    for (let s = 0; s < W * H; s++) { if (!desenho[s] || vis[s]) continue; let h = 0, t = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0; q[t++] = s; vis[s] = 1;
      while (h < t) { const i = q[h++], x = i % W, y = i / W | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const j = Y * W + X; if (desenho[j] && !vis[j]) { vis[j] = 1; q[t++] = j; } } }
      B.push({ x0, y0, x1, y1, n }); if (B.length > 20000) break; }
    // junta caixas próximas (repete até estabilizar)
    let mudou = true; while (mudou && B.length > 1 && B.length < 6000) { mudou = false; const R = [];
      for (const b of B) { const k = R.find(r => b.x0 - junta <= r.x1 + 1 && r.x0 - junta <= b.x1 + 1 && b.y0 - junta <= r.y1 + 1 && r.y0 - junta <= b.y1 + 1);
        if (k) { k.x0 = Math.min(k.x0, b.x0); k.y0 = Math.min(k.y0, b.y0); k.x1 = Math.max(k.x1, b.x1); k.y1 = Math.max(k.y1, b.y1); k.n += b.n; mudou = true; } else R.push(Object.assign({}, b)); }
      B = R; }
    return B.filter(b => b.n >= min).map(b => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 })).sort((p, q2) => p.y - q2.y || p.x - q2.x).slice(0, 2000); }

  /* ---------- editor antigo -> biblioteca ---------- */
  function antigos(tilesets, imagens) { const L = [];
    for (const t of tilesets) L.push({ antigo: 'tileset', id: t.id, nome: t.nome, w: t.w, h: t.h, arquivo: t.arquivo, original: t.original || t.arquivo, grade: { tw: t.tw, th: t.th, mg: t.mg || 0, sp: t.sp || 0 } });
    for (const i of imagens) if (i.arquivo) L.push({ antigo: 'imagem', id: i.id, nome: i.nome || i.id, w: i.w, h: i.h, arquivo: i.arquivo, original: i.original || i.arquivo });
    return L; }

  G.Recursos = { EXT, TIPOS, CATS, MAXPX, sha12, subir, url, erroSql, listar, ler, criar, atualizar, apagar, novoId, abrirArquivo, abrirUrl, pixels, analisar, removerFundo, paraCanvas, canvasPng, detectar, antigos, hex };
})(window);
