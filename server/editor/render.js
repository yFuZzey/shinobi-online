/* Editor de mapas · DESENHO (pré-visualização igual ao jogo)
   O chão segue exatamente o buildGround do jogo (grama/areia, pântano, ruas, água com margens, pontes), mas com largura × altura.
   Objetos são desenhados pela base (ordem pelo Y, como no jogo); camadas de tiles no tamanho original, sem suavizar. */
(function (G) {
  'use strict';
  const T = 32, TX = {}, IMG = {}, TSI = {};
  let pronto = null;
  const GR = ['g1', 'g2', 'g3', 'g4', 'g1', 'g2', 'g3', 'g4', 'g1', 'g2', 'g3', 'g4', 'g1', 'g2', 'g3', 'g4', 'g1', 'g2', 'g3', 'g4', 'g1', 'g2', 'g3', 'gd'];
  function carregar(J) {
    if (pronto) return pronto;
    pronto = Promise.all(Object.keys(J.TS).map(k => new Promise(ok => { const i = new Image(); i.onload = i.onerror = () => { TX[k] = i; ok(); }; i.src = J.TS[k]; })));
    return pronto; }
  // imagens próprias (tabela mapa_imagens) e tilesets (mapa_tilesets): chegam do banco, carregam aos poucos
  function imagens(rows, store, cb) {
    for (const r of rows) { if (IMG[r.id]) continue; const i = new Image(); i.crossOrigin = 'anonymous';
      IMG[r.id] = { img: i, w: r.w, h: r.h, dw: r.dw || r.w, dh: r.dh || r.h, px: !!r.px, fw: r.fw || 1, fh: r.fh || 1, off: r.off || 0, ns: !!r.ns, ok: false };
      i.onload = () => { IMG[r.id].ok = true; cb && cb(); }; i.onerror = () => { IMG[r.id].falhou = true; cb && cb(); };
      i.src = typeof r.png === 'string' && r.png ? r.png : store + r.arquivo; } }
  function tilesets(rows, store, cb) {
    for (const r of rows) { if (TSI[r.id]) continue; const i = new Image(); i.crossOrigin = 'anonymous';
      TSI[r.id] = { img: i, tw: r.tw, th: r.th, dw: r.dw || r.tw, dh: r.dh || r.th, mg: r.mg || 0, my: r.my != null ? r.my : (r.mg || 0), sp: r.sp || 0, w: r.w, h: r.h, nome: r.nome, ok: false };
      i.onload = () => { TSI[r.id].ok = true; cb && cb(); }; i.onerror = () => { TSI[r.id].falhou = true; cb && cb(); }; i.src = store + r.arquivo; } }
  // catálogo para a colisão do servidor (mesmo formato de mapa_objetos.json)
  function cat(J) { const fpt = {}, tsz = Object.keys(J.TSZ);
    for (const c of J.CAT) if (c[3] !== 1 || c[4] !== 1 || c[5] !== 0) fpt[c[0]] = [c[3], c[4], c[5]];
    for (const k in IMG) { tsz.push(k); fpt[k] = [IMG[k].fw, IMG[k].fh, IMG[k].off]; }
    for (const k in RC) { tsz.push(k); fpt[k] = [1, 1, 0]; }
    return { fpt, tsz }; }
  const tamanho = (J, k) => RC[k] ? [RC[k].dw, RC[k].dh] : IMG[k] ? [IMG[k].dw, IMG[k].dh] : J.TSZ[k] || null;

  /* chão: igual ao jogo (src/index_before_manto.html buildGround + applyMap), para W × H */
  function chao(m) {
    const W = m.W, H = m.H, AW = Math.ceil(W / 2), AH = Math.ceil(H / 2), A = m.tema === 'areia', g0 = m.chao;
    const WC = new Uint8Array(AW * AH), SWC = new Uint8Array(AW * AH), RD = new Uint8Array(W * H), BRD = [];
    for (let i = 0; i < W * H; i++) if (g0[i] === 1) RD[i] = 1;
    for (let cy = 0; cy < AH; cy++) for (let cx = 0; cx < AW; cx++) { const t = g0[cy * 2 * W + cx * 2]; if (t < 2) continue;
      if (t === 2) SWC[cy * AW + cx] = 1; else { WC[cy * AW + cx] = t === 3 ? 2 : 1; if (t === 5) BRD.push([cx, cy]); } }
    const c = document.createElement('canvas'); c.width = W * T; c.height = H * T; const g = c.getContext('2d');
    if (A) { for (let cy = 0; cy < AH; cy++) for (let cx = 0; cx < AW; cx++) { const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0; g.drawImage(TX['sg' + (h % 5 + 1)], cx * 64, cy * 64); } }
    else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = ((x * 73856093) ^ (y * 19349663)) >>> 0; g.drawImage(TX[GR[h % GR.length]], x * T, y * T); }
    for (let cy = 0; cy < AH; cy++) for (let cx = 0; cx < AW; cx++) if (SWC[cy * AW + cx]) g.drawImage(TX[A ? ((cx + cy) % 2 ? 'sd1' : 'sd2') : ((cx + cy) % 2 ? 'sw1' : 'sw2')], cx * 64, cy * 64);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (RD[y * W + x]) { const h = ((x * 83492791) ^ (y * 29765729)) >>> 0; g.drawImage(TX[A ? (h % 3 ? 'sp1' : 'sp2') : (h % 3 ? 'p1' : 'p2')], x * T, y * T); }
    for (let cy = 0; cy < AH; cy++) for (let cx = 0; cx < AW; cx++) { const v = WC[cy * AW + cx]; if (!v) continue;
      g.drawImage(TX[v === 1 ? (A ? 'sriver' : 'river') : (A ? 'swater' : 'water')], cx * 64, cy * 64);
      if (v === 2) { const land = (a, b) => a < 0 || b < 0 || a >= AW || b >= AH || WC[b * AW + a] === 0, B = TX[A ? 'sbank' : 'bank'], X = cx * 64, Y = cy * 64;
        if (land(cx, cy - 1)) g.drawImage(B, X, Y, 64, 10);
        if (land(cx, cy + 1)) { g.save(); g.translate(X, Y + 64); g.scale(1, -1); g.drawImage(B, 0, 0, 64, 10); g.restore(); }
        if (land(cx - 1, cy)) { g.save(); g.translate(X, Y + 64); g.rotate(-Math.PI / 2); g.drawImage(B, 0, 0, 64, 10); g.restore(); }
        if (land(cx + 1, cy)) { g.save(); g.translate(X + 64, Y); g.rotate(Math.PI / 2); g.drawImage(B, 0, 0, 64, 10); g.restore(); } } }
    BRD.forEach(b => { g.drawImage(TX.plank1, b[0] * 64 - 13, b[1] * 64, 90, T); g.drawImage(TX.plank2, b[0] * 64 - 13, b[1] * 64 + T, 90, T); });
    return c; }

  // redesenha só uma parte do chão (enquanto pinta), com a mesma regra do jogo; pega 1 bloco de vizinhos por causa das margens da água e das pontes
  function chaoParcial(c, m, x0, y0, x1, y1) {
    const W = m.W, H = m.H, AW = Math.ceil(W / 2), AH = Math.ceil(H / 2), A = m.tema === 'areia', g0 = m.chao, g = c.getContext('2d');
    const cellT = (cx, cy) => { if (cx < 0 || cy < 0 || cx >= AW || cy >= AH) return -1; const v = g0[cy * 2 * W + cx * 2]; return v >= 2 ? v : 0; };
    const cx0 = Math.max(0, (x0 >> 1) - 1), cy0 = Math.max(0, (y0 >> 1) - 1), cx1 = Math.min(AW - 1, (x1 >> 1) + 1), cy1 = Math.min(AH - 1, (y1 >> 1) + 1);
    g.save(); g.beginPath(); g.rect(cx0 * 64, cy0 * 64, (cx1 - cx0 + 1) * 64, (cy1 - cy0 + 1) * 64); g.clip();
    const yA = cy0 * 2, yB = Math.min(H - 1, cy1 * 2 + 1), xA = cx0 * 2, xB = Math.min(W - 1, cx1 * 2 + 1);
    if (A) { for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { const h = ((cx * 73856093) ^ (cy * 19349663)) >>> 0; g.drawImage(TX['sg' + (h % 5 + 1)], cx * 64, cy * 64); } }
    else for (let y = yA; y <= yB; y++) for (let x = xA; x <= xB; x++) { const h = ((x * 73856093) ^ (y * 19349663)) >>> 0; g.drawImage(TX[GR[h % GR.length]], x * T, y * T); }
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) if (cellT(cx, cy) === 2) g.drawImage(TX[A ? ((cx + cy) % 2 ? 'sd1' : 'sd2') : ((cx + cy) % 2 ? 'sw1' : 'sw2')], cx * 64, cy * 64);
    for (let y = yA; y <= yB; y++) for (let x = xA; x <= xB; x++) if (g0[y * W + x] === 1) { const h = ((x * 83492791) ^ (y * 29765729)) >>> 0; g.drawImage(TX[A ? (h % 3 ? 'sp1' : 'sp2') : (h % 3 ? 'p1' : 'p2')], x * T, y * T); }
    const land = (a, b) => cellT(a, b) < 3;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { const t = cellT(cx, cy); if (t < 3) continue;
      g.drawImage(TX[t === 3 ? (A ? 'swater' : 'water') : (A ? 'sriver' : 'river')], cx * 64, cy * 64);
      if (t === 3) { const B = TX[A ? 'sbank' : 'bank'], X = cx * 64, Y = cy * 64;
        if (land(cx, cy - 1)) g.drawImage(B, X, Y, 64, 10);
        if (land(cx, cy + 1)) { g.save(); g.translate(X, Y + 64); g.scale(1, -1); g.drawImage(B, 0, 0, 64, 10); g.restore(); }
        if (land(cx - 1, cy)) { g.save(); g.translate(X, Y + 64); g.rotate(-Math.PI / 2); g.drawImage(B, 0, 0, 64, 10); g.restore(); }
        if (land(cx + 1, cy)) { g.save(); g.translate(X + 64, Y); g.rotate(Math.PI / 2); g.drawImage(B, 0, 0, 64, 10); g.restore(); } } }
    for (let cy = Math.max(0, cy0 - 1); cy <= Math.min(AH - 1, cy1 + 1); cy++) for (let cx = Math.max(0, cx0 - 1); cx <= Math.min(AW - 1, cx1 + 1); cx++) if (cellT(cx, cy) === 5) { g.drawImage(TX.plank1, cx * 64 - 13, cy * 64, 90, T); g.drawImage(TX.plank2, cx * 64 - 13, cy * 64 + T, 90, T); }
    g.restore(); }
  // camada de tiles (objeto da camada) num canvas do tamanho do mapa
  function camadaCv(m, c) { if (!c || !c.d.length) return null;
    const cv = document.createElement('canvas'); cv.width = m.W * T; cv.height = m.H * T; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; let falta = 0;
    for (const e of c.d) { const id = m.tilesets[e[0]], t = TSI[id]; if (!t || !t.ok) { falta++; continue; }
      g.imageSmoothingEnabled = t.dw < t.tw; g.drawImage(t.img, t.mg + e[3] * (t.tw + t.sp), t.my + e[4] * (t.th + t.sp), t.tw, t.th, e[1] * t.dw, e[2] * t.dh, t.dw, t.dh); }
    cv.falta = falta; return cv; }
  // camada de tiles num canvas do tamanho do mapa (cache por versão)
  function camada(m, nome) {
    const c = (m.camadas || []).find(x => x && x.t === 'tiles' && x.n === nome); if (!c || !c.d.length) return null;
    const cv = document.createElement('canvas'); cv.width = m.W * T; cv.height = m.H * T; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; let falta = 0;
    for (const e of c.d) { const id = m.tilesets[e[0]], t = TSI[id]; if (!t || !t.ok) { falta++; continue; }
      g.imageSmoothingEnabled = t.dw < t.tw; g.drawImage(t.img, t.mg + e[3] * (t.tw + t.sp), t.my + e[4] * (t.th + t.sp), t.tw, t.th, e[1] * t.dw, e[2] * t.dh, t.dw, t.dh); }
    cv.falta = falta; return cv; }

  /* ---------- objetos ----------
     Três origens: catálogo do jogo (TX/TSZ), imagens próprias do editor antigo (IMG) e recortes da biblioteca (RC, chave "recurso.recorte").
     info() devolve como desenhar: imagem, pedaço de origem, tamanho no mapa (dw×dh), âncora (ax, ay) e linha da frente (corte).
     Opções da instância (o.f[2]): e = escala, z = 'chao' | 'acima', b = ajuste da ordem (px). Igual ao jogo. */
  const RC = {}, RIM = {};
  function recursos(rows, store, cb) {
    for (const k in RC) delete RC[k];
    for (const r of rows) { if (!Array.isArray(r.recortes) || !r.recortes.length) continue;
      if (!RIM[r.id] || RIM[r.id].arq !== r.arquivo) { const i = new Image(); i.crossOrigin = 'anonymous'; const o = RIM[r.id] = { img: i, ok: false, arq: r.arquivo }; i.onload = () => { o.ok = true; cb && cb(); }; i.onerror = () => { o.falhou = true; cb && cb(); }; i.src = store + r.arquivo; }
      for (const c of r.recortes) { const dw = c.dw || c.w, dh = c.dh || c.h; RC[r.id + '.' + c.id] = { rec: r.id, nome: c.nome || c.id, cat: c.cat || '', sx: c.x, sy: c.y, sw: c.w, sh: c.h, dw, dh, ax: c.ax != null ? c.ax : Math.round(dw / 2), ay: c.ay != null ? c.ay : dh, corte: c.corte || 0, ns: !!c.ns, col: c.col || [[0, 0]] }; } } }
  function info(J, k) { const R0 = RC[k];
    if (R0) { const b = RIM[R0.rec]; return { img: b && b.img, ok: !!(b && b.ok), falhou: !!(b && b.falhou), sx: R0.sx, sy: R0.sy, sw: R0.sw, sh: R0.sh, dw: R0.dw, dh: R0.dh, ax: R0.ax, ay: R0.ay, corte: R0.corte, px: true, tipo: 'rc' }; }
    const P = IMG[k]; if (P) { const w = P.img.naturalWidth || P.w, h = P.img.naturalHeight || P.h; return { img: P.img, ok: P.ok, falhou: P.falhou, sx: 0, sy: 0, sw: w, sh: h, dw: P.dw, dh: P.dh, ax: P.dw / 2, ay: P.dh, corte: 0, px: P.px, tipo: 'img' }; }
    const im = TX[k], s = J.TSZ[k]; if (im && s) return { img: im, ok: !!im.naturalWidth, sx: 0, sy: 0, sw: im.naturalWidth, sh: im.naturalHeight, dw: im.naturalWidth, dh: im.naturalHeight, ax: s[0] / 2, ay: s[1], corte: 0, px: false, tipo: 'jogo' };
    return null; }
  const opc = o => (o.f && o.f[2] && typeof o.f[2] === 'object') ? o.f[2] : {};
  // retângulo do desenho no mapa (px)
  // cantos do desenho no mapa (px), já com escala e rotação em volta da âncora: [sup-esq, sup-dir, inf-dir, inf-esq]
  function cantos(J, o) { const i = info(J, o.k), q = opc(o), e = q.e || 1, x = o.x * T, y = o.y * T; if (!i) return [[x - 14, y - 28], [x + 14, y - 28], [x + 14, y], [x - 14, y]];
    const a = (q.r || 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), L = [[-i.ax * e, -i.ay * e], [(i.dw - i.ax) * e, -i.ay * e], [(i.dw - i.ax) * e, (i.dh - i.ay) * e], [-i.ax * e, (i.dh - i.ay) * e]];
    return L.map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]); }
  function caixa(J, o) { const P = cantos(J, o), xs = P.map(p => p[0]), ys = P.map(p => p[1]); return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }; }
  // ordem de desenho (igual ao jogo); devolve [{y, d}] já com a parte de cima (corte) separada
  function listaObjetos(J, m, vis, marca) { const L = [];
    m.objetos.forEach((o, n) => { const i = info(J, o.k), q = opc(o), e = q.e || 1, x = o.x * T, y = o.y * T;
      if (!i) { L.push({ y, n, d: c => falta(c, x, y, true) }); return; }
      const dw = i.dw * e, dh = i.dh * e, X = Math.floor(x - i.ax * e), Y = Math.floor(y - i.ay * e);
      if (vis && !q.r && (X + dw < vis.x0 || X > vis.x1 || Y + dh < vis.y0 || Y > vis.y1)) return;
      const oy = q.z === 'chao' ? y - 1e9 : q.z === 'acima' ? 1e9 - 1 : y + (q.b || 0), ct = i.corte > 0 ? Math.min(dh, i.corte * e) : 0, cs = ct ? ct / dh * i.sh : 0;
      const rot = (q.r || 0) * Math.PI / 180; // girado: desenha em volta da âncora (o jogo faz igual)
      const dr = (c, a, b, c0, d0) => { if (!i.ok) { falta(c, x, y, i.falhou); return; } const sm = c.imageSmoothingEnabled; c.imageSmoothingEnabled = !i.px;
        if (rot) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(i.img, i.sx, i.sy + a, i.sw, b - a, -i.ax * e, -i.ay * e + c0, dw, d0 - c0); c.restore(); } else c.drawImage(i.img, i.sx, i.sy + a, i.sw, b - a, X, Y + c0, dw, d0 - c0); c.imageSmoothingEnabled = sm; };
      if (ct) { L.push({ y: oy, n, d: c => dr(c, cs, i.sh, ct, dh) }); L.push({ y: 1e9 - 2, n, d: c => dr(c, 0, cs, 0, ct) }); } else L.push({ y: oy, n, d: c => dr(c, 0, i.sh, 0, dh) }); });
    return L.sort((a, b) => a.y - b.y || a.n - b.n); }
  function objetos(ctx, J, m, vis) { for (const it of listaObjetos(J, m, vis)) it.d(ctx); }
  function falta(ctx, x, y, erro) { ctx.save(); ctx.fillStyle = erro ? 'rgba(220,40,60,.55)' : 'rgba(255,255,255,.35)'; ctx.fillRect(x - 14, y - 28, 28, 28); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(x - 14, y - 28, 28, 28); ctx.restore(); }

  // colisão compilada (mesma função do servidor): 1 parede, 2 água/buraco, 3 caminho/ponte
  function colisao(ctx, m, M) { ctx.save();
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) { const v = M.charCodeAt(y * m.W + x) - 48;
      if (v === 1) { ctx.fillStyle = 'rgba(230,40,60,.42)'; ctx.fillRect(x * T, y * T, T, T); } else if (v === 2) { ctx.fillStyle = 'rgba(40,110,255,.4)'; ctx.fillRect(x * T, y * T, T, T); } }
    ctx.restore(); }
  function grade(ctx, m, s, passo) { ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1 / s; ctx.beginPath(); const p = passo || T;
    for (let x = 0; x <= m.W * T; x += p) { ctx.moveTo(x, 0); ctx.lineTo(x, m.H * T); } for (let y = 0; y <= m.H * T; y += p) { ctx.moveTo(0, y); ctx.lineTo(m.W * T, y); } ctx.stroke(); ctx.restore(); }
  function areas(ctx, m, s) { ctx.save(); ctx.lineWidth = 2 / s; ctx.font = (12 / s) + 'px sans-serif';
    for (const a of m.areas) { ctx.fillStyle = 'rgba(255,170,0,.16)'; ctx.strokeStyle = 'rgba(255,170,0,.9)'; ctx.fillRect(a.x * T, a.y * T, a.w * T, a.h * T); ctx.strokeRect(a.x * T, a.y * T, a.w * T, a.h * T);
      ctx.fillStyle = '#fff'; ctx.fillText((a.mobs || []).map(e => e.m + '×' + e.n).join(', '), a.x * T + 4 / s, a.y * T + 14 / s); }
    ctx.restore(); }
  function marcador(ctx, p, s, cor, txt) { if (!p) return; const x = p[0] * T, y = p[1] * T, r = Math.max(10, 13 / s);
    ctx.save(); ctx.fillStyle = cor; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / s; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (r * 1.1) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + 1 / s); ctx.restore(); }
  // borda de 2 tiles que o jogo sempre bloqueia
  function borda(ctx, m, s) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([6 / s, 5 / s]); ctx.lineWidth = 1.5 / s; ctx.strokeRect(2 * T, 2 * T, (m.W - 4) * T, (m.H - 4) * T); ctx.restore(); }

  G.Render = { T, TX, IMG, TSI, RC, RIM, recursos, info, caixa, cantos, listaObjetos, opc, carregar, imagens, tilesets, cat, tamanho, chao, chaoParcial, camadaCv, camada, objetos, colisao, grade, areas, marcador, borda };
})(window);
