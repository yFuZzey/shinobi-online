/* Editor de mapas · VISOR DE IMAGEM COM SELEÇÃO (feito para o dedo)
   - Um dedo: no modo "Mover" arrasta a imagem (tocar num recorte seleciona); no modo "Selecionar" desenha um retângulo novo,
     arrasta o recorte selecionado ou as alças dele. Dois dedos: pinça (zoom) e arrasto, em qualquer modo.
   - Alças grandes nos 4 cantos e nos 4 lados (área de toque de 24 px). Perto da borda da tela a visão anda sozinha,
     então dá para selecionar até a borda da imagem mesmo com zoom.
   - Tudo em pixels da imagem original (inteiros), independente do zoom; nada é redimensionado. */
(function (G) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ALCAS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  class Visor {
    constructor(cv, cb) { this.cv = cv; this.g = cv.getContext('2d'); this.cb = cb || {}; this.s = 1; this.ox = 0; this.oy = 0; this.img = null; this.W = 0; this.H = 0;
      this.modo = 'mover'; this.recortes = []; this.sel = null; this.pend = null; this.cand = []; this.grade = null; this.encaixar = false; this.verGrade = true;
      this.ptr = new Map(); this.op = null; this.raf = 0; this.dpr = 1; this.auto = 0; this.ult = null; this.ligar(); }
    imagem(img) { this.img = img; this.W = img.naturalWidth || img.width; this.H = img.naturalHeight || img.height; this.desenhar(); }
    tamanho() { const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(2, G.devicePixelRatio || 1);
      if (this.ult && r.width && r.height) { this.ox += (r.width - this.ult.w) / 2; this.oy += (r.height - this.ult.h) / 2; }
      if (r.width && r.height) this.ult = { w: r.width, h: r.height };
      this.cv.width = Math.max(1, r.width * this.dpr | 0); this.cv.height = Math.max(1, r.height * this.dpr | 0); this.desenhar(); }
    ajustar() { const r = this.cv.getBoundingClientRect(); if (!this.W) return; this.s = clamp(Math.min(r.width / this.W, r.height / this.H) * .94, .02, 64);
      this.ox = (r.width - this.W * this.s) / 2; this.oy = (r.height - this.H * this.s) / 2; this.zoomMudou(); this.desenhar(); }
    zoomEm(px, py, ns) { ns = clamp(ns, .02, 64); const ix = (px - this.ox) / this.s, iy = (py - this.oy) / this.s; this.s = ns; this.ox = px - ix * ns; this.oy = py - iy * ns; this.zoomMudou(); this.desenhar(); }
    zoom(f) { const r = this.cv.getBoundingClientRect(); this.zoomEm(r.width / 2, r.height / 2, this.s * f); }
    // mostra um retângulo da imagem no centro da tela
    focar(rc, z) { const r = this.cv.getBoundingClientRect(); if (z) this.s = clamp(z, .02, 64); this.ox = r.width / 2 - (rc.x + rc.w / 2) * this.s; this.oy = r.height / 2 - (rc.y + rc.h / 2) * this.s; this.zoomMudou(); this.desenhar(); }
    zoomMudou() { this.cb.zoom && this.cb.zoom(this.s); }
    paraImg(p) { return { x: (p.x - this.ox) / this.s, y: (p.y - this.oy) / this.s }; }
    paraTela(x, y) { return { x: this.ox + x * this.s, y: this.oy + y * this.s }; }
    alvo() { return this.pend || this.recortes.find(r => r.id === this.sel) || null; }
    // ---------- desenho ----------
    desenhar() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.pintar(); }); }
    pintar() { const g = this.g, d = this.dpr; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0d10'; g.fillRect(0, 0, this.cv.width, this.cv.height); if (!this.img) return;
      // fundo xadrez (mostra a transparência)
      g.setTransform(d, 0, 0, d, 0, 0); const x0 = Math.max(0, this.ox), y0 = Math.max(0, this.oy), x1 = Math.min(this.cv.width / d, this.ox + this.W * this.s), y1 = Math.min(this.cv.height / d, this.oy + this.H * this.s);
      if (x1 > x0 && y1 > y0) { g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); for (let y = Math.floor(y0 / 12) * 12; y < y1; y += 12) for (let x = Math.floor(x0 / 12) * 12; x < x1; x += 12) { g.fillStyle = ((x + y) / 12) % 2 ? '#8a8a8a' : '#b4b4b4'; g.fillRect(x, y, 12, 12); } g.restore(); }
      g.setTransform(this.s * d, 0, 0, this.s * d, this.ox * d, this.oy * d); g.imageSmoothingEnabled = false; g.drawImage(this.img, 0, 0);
      const lw = 1 / this.s;
      if (this.grade && this.verGrade) { const q = this.grade, st = q.tw + q.sp, sh = q.th + q.sp, mx = q.mg || 0, my = q.my != null ? q.my : mx;
        if (mx || my) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, mx, this.H); g.fillRect(mx, 0, this.W - mx, my); } // margem (fora dos tiles)
        if (q.tw * this.s >= 3) { g.strokeStyle = this.modo === 'grade' ? 'rgba(255,224,77,.95)' : 'rgba(255,60,60,.75)'; g.lineWidth = this.modo === 'grade' ? 1.6 * lw : lw; g.beginPath();
        for (let x = mx; x <= this.W; x += st) { g.moveTo(x, 0); g.lineTo(x, this.H); if (q.sp) { g.moveTo(x + q.tw, 0); g.lineTo(x + q.tw, this.H); } }
        for (let y = my; y <= this.H; y += sh) { g.moveTo(0, y); g.lineTo(this.W, y); if (q.sp) { g.moveTo(0, y + q.th); g.lineTo(this.W, y + q.th); } } g.stroke(); } }
      g.lineWidth = 2 * lw; g.font = (12 * lw) + 'px sans-serif';
      for (const c of this.cand) { g.setLineDash([5 * lw, 4 * lw]); g.strokeStyle = c.ok === false ? 'rgba(160,160,160,.7)' : '#ff4fd8'; g.strokeRect(c.x, c.y, c.w, c.h); }
      g.setLineDash([]);
      for (const r of this.recortes) { const s = r.id === this.sel && !this.pend; g.strokeStyle = s ? '#ff9a3c' : '#38d6ff'; g.fillStyle = s ? 'rgba(255,154,60,.12)' : 'rgba(56,214,255,.08)'; g.fillRect(r.x, r.y, r.w, r.h); g.strokeRect(r.x, r.y, r.w, r.h);
        if (r.nome && r.w * this.s > 40) { g.fillStyle = s ? '#ff9a3c' : '#38d6ff'; g.fillText(r.nome, r.x + 3 * lw, r.y - 4 * lw); } }
      if (this.pend) { g.setLineDash([6 * lw, 4 * lw]); g.strokeStyle = '#ffe04d'; g.fillStyle = 'rgba(255,224,77,.15)'; const p = this.pend; g.fillRect(p.x, p.y, p.w, p.h); g.strokeRect(p.x, p.y, p.w, p.h); g.setLineDash([]); }
      const a = this.alvo(); if (a) { g.setTransform(d, 0, 0, d, 0, 0); for (const k of ALCAS) { const p = this.alcaPos(a, k); g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 1.5; g.fillRect(p.x - 7, p.y - 7, 14, 14); g.strokeRect(p.x - 7, p.y - 7, 14, 14); }
        g.fillStyle = 'rgba(0,0,0,.7)'; const t = a.w + '×' + a.h + ' em ' + a.x + ', ' + a.y, q = this.paraTela(a.x, a.y + a.h); g.font = '12px sans-serif'; const tw = g.measureText(t).width; g.fillRect(q.x, q.y + 4, tw + 10, 18); g.fillStyle = '#fff'; g.fillText(t, q.x + 5, q.y + 17); } }
    alcaPos(r, k) { const x = k.includes('w') ? r.x : k.includes('e') ? r.x + r.w : r.x + r.w / 2, y = k.includes('n') ? r.y : k.includes('s') ? r.y + r.h : r.y + r.h / 2; return this.paraTela(x, y); }
    // ---------- toque ----------
    pt(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    snap(v, eixo) { if (!this.encaixar || !this.grade) return Math.round(v); const q = this.grade, t = eixo === 'x' ? q.tw : q.th, st = t + q.sp, m0 = eixo === 'x' ? (q.mg || 0) : (q.my != null ? q.my : (q.mg || 0)); const k = Math.round((v - m0) / st), a = m0 + k * st, b = m0 + Math.round((v - m0 - t) / st) * st + t; return Math.abs(v - a) <= Math.abs(v - b) ? a : b; }
    norm(x0, y0, x1, y1) { x0 = clamp(this.snap(x0, 'x'), 0, this.W); x1 = clamp(this.snap(x1, 'x'), 0, this.W); y0 = clamp(this.snap(y0, 'y'), 0, this.H); y1 = clamp(this.snap(y1, 'y'), 0, this.H);
      if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0]; if (x1 === x0) x1 = Math.min(this.W, x0 + 1), x0 = x1 - 1; if (y1 === y0) y1 = Math.min(this.H, y0 + 1), y0 = y1 - 1; return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    noRecorte(ip) { for (let i = this.recortes.length - 1; i >= 0; i--) { const r = this.recortes[i]; if (ip.x >= r.x && ip.x <= r.x + r.w && ip.y >= r.y && ip.y <= r.y + r.h) return r; } return null; }
    noCand(ip) { for (const c of this.cand) if (ip.x >= c.x && ip.x <= c.x + c.w && ip.y >= c.y && ip.y <= c.y + c.h) return c; return null; }
    ligar() { const cv = this.cv;
      cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (_) { } const p = this.pt(e); this.ptr.set(e.pointerId, p);
        if (this.ptr.size === 2) { if (this.op && this.op.desfaz) this.op.desfaz(); const [a, b] = [...this.ptr.values()]; this.op = { t: 'pinca', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: this.s, ox: this.ox, oy: this.oy }; return; }
        if (this.ptr.size > 2) return; this.inicio(p); });
      cv.addEventListener('pointermove', e => { if (!this.ptr.has(e.pointerId) || !this.op) return; const p = this.pt(e); this.ptr.set(e.pointerId, p);
        if (this.op.t === 'pinca' && this.ptr.size >= 2) { const [a, b] = [...this.ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ns = clamp(this.op.s0 * d / this.op.d0, .02, 64);
          const ix = (this.op.c0.x - this.op.ox) / this.op.s0, iy = (this.op.c0.y - this.op.oy) / this.op.s0; this.s = ns; this.ox = c.x - ix * ns; this.oy = c.y - iy * ns; this.zoomMudou(); this.desenhar(); return; }
        if (this.ptr.size === 1) this.mover(p); });
      const fim = e => { if (!this.ptr.has(e.pointerId)) return; const p = this.pt(e); this.ptr.delete(e.pointerId);
        if (this.op && this.op.t === 'pinca') { if (!this.ptr.size) this.op = null; else this.op = { t: 'pan', p0: [...this.ptr.values()][0], ox: this.ox, oy: this.oy, moveu: true }; return; }
        if (!this.ptr.size) this.terminar(p, e.type === 'pointercancel'); };
      cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
      cv.addEventListener('wheel', e => { e.preventDefault(); const p = this.pt(e); this.zoomEm(p.x, p.y, this.s * Math.exp(-e.deltaY * .0015)); }, { passive: false }); }
    inicio(p) { const ip = this.paraImg(p), a = this.alvo();
      if (this.modo === 'grade' && this.grade) { const q = this.grade; this.op = { t: 'grade', p0: p, q0: Object.assign({}, q, { my: q.my != null ? q.my : (q.mg || 0) }), moveu: false }; return; } // arrastar a grade até encaixar no desenho
      if (a) for (const k of ALCAS) { const q = this.alcaPos(a, k); if (Math.hypot(q.x - p.x, q.y - p.y) <= 24) { const r0 = { x: a.x, y: a.y, w: a.w, h: a.h }; this.op = { t: 'alca', k, r: a, r0, p0: p, moveu: false, desfaz: () => Object.assign(a, r0) }; return; } }
      if (this.modo === 'sel') {
        if (a && ip.x >= a.x && ip.x <= a.x + a.w && ip.y >= a.y && ip.y <= a.y + a.h) { const r0 = { x: a.x, y: a.y, w: a.w, h: a.h }; this.op = { t: 'mover', r: a, r0, i0: ip, p0: p, moveu: false, desfaz: () => Object.assign(a, r0) }; return; }
        this.op = { t: 'novo', i0: ip, p0: p, moveu: false, desfaz: () => { this.pend = null; } }; return; }
      this.op = { t: 'pan', p0: p, ox: this.ox, oy: this.oy, moveu: false }; }
    mover(p) { const o = this.op; if (!o) return; if (!o.moveu && Math.hypot(p.x - o.p0.x, p.y - o.p0.y) > (o.t === 'alca' || o.t === 'grade' ? 3 : 8)) o.moveu = true; /* alça: começa a mexer com pouco movimento (ajuste fino) */ if (!o.moveu) return; o.ult = p;
      if (o.t === 'pan') { this.ox = o.ox + p.x - o.p0.x; this.oy = o.oy + p.y - o.p0.y; this.desenhar(); return; }
      if (o.t === 'grade') { const q = o.q0, md = (v, n) => ((v % n) + n) % n; this.grade = Object.assign({}, q, { mg: md(Math.round(q.mg + (p.x - o.p0.x) / this.s), q.tw + q.sp), my: md(Math.round(q.my + (p.y - o.p0.y) / this.s), q.th + q.sp) }); this.desenhar(); this.cb.gradeMexe && this.cb.gradeMexe(this.grade); return; }
      this.aplicar(p); this.autoPan(); }
    aplicar(p) { const o = this.op, ip = this.paraImg(p);
      if (o.t === 'novo') { this.pend = this.norm(o.i0.x, o.i0.y, ip.x, ip.y); this.sel = null; }
      else if (o.t === 'mover') { const dx = Math.round(ip.x - o.i0.x), dy = Math.round(ip.y - o.i0.y); let x = clamp(o.r0.x + dx, 0, this.W - o.r0.w), y = clamp(o.r0.y + dy, 0, this.H - o.r0.h);
        if (this.encaixar && this.grade) { x = clamp(this.snap(x, 'x'), 0, this.W - o.r0.w); y = clamp(this.snap(y, 'y'), 0, this.H - o.r0.h); } o.r.x = x; o.r.y = y; }
      else if (o.t === 'alca') { const r0 = o.r0, k = o.k; let x0 = r0.x, y0 = r0.y, x1 = r0.x + r0.w, y1 = r0.y + r0.h; if (k.includes('w')) x0 = ip.x; if (k.includes('e')) x1 = ip.x; if (k.includes('n')) y0 = ip.y; if (k.includes('s')) y1 = ip.y;
        Object.assign(o.r, this.norm(x0, y0, x1, y1)); }
      this.desenhar(); this.cb.mexendo && this.cb.mexendo(this.alvo()); }
    // perto da borda da tela, a visão anda sozinha (para alcançar a borda da imagem com zoom)
    autoPan() { if (this.auto) return; const passo = () => { this.auto = 0; const o = this.op; if (!o || !o.ult || !['novo', 'mover', 'alca'].includes(o.t)) return; const r = this.cv.getBoundingClientRect(), m = 36, p = o.ult;
        const vx = p.x < m ? (m - p.x) : p.x > r.width - m ? -(p.x - (r.width - m)) : 0, vy = p.y < m ? (m - p.y) : p.y > r.height - m ? -(p.y - (r.height - m)) : 0;
        if (!vx && !vy) return; this.ox += clamp(vx * .5, -14, 14); this.oy += clamp(vy * .5, -14, 14); this.aplicar(p); this.auto = requestAnimationFrame(passo); };
      this.auto = requestAnimationFrame(passo); }
    terminar(p, cancel) { const o = this.op; this.op = null; cancelAnimationFrame(this.auto); this.auto = 0; if (!o) return;
      if (cancel) { o.desfaz && o.desfaz(); this.desenhar(); return; }
      if (o.t === 'grade') { if (o.moveu && this.cb.gradeFim) this.cb.gradeFim(this.grade, o.q0); this.desenhar(); return; }
      if (!o.moveu) { // toque: seleciona o recorte / candidato tocado
        const ip = this.paraImg(p); if (this.cb.toqueImg && this.cb.toqueImg(ip)) { this.desenhar(); return; } const c = this.noCand(ip); if (c && this.cb.toqueCand) { this.cb.toqueCand(c); this.desenhar(); return; }
        if (this.pend && o.t === 'novo') { this.desenhar(); return; }
        const r = this.noRecorte(ip); if (!this.pend) { this.sel = r ? r.id : null; this.cb.sel && this.cb.sel(this.sel); } this.desenhar(); return; }
      if (o.t === 'novo') { this.cb.novo && this.cb.novo(this.pend); }
      else if (o.t === 'mover' || o.t === 'alca') { const r = o.r, mud = r.x !== o.r0.x || r.y !== o.r0.y || r.w !== o.r0.w || r.h !== o.r0.h; if (mud) { if (r === this.pend) this.cb.novo && this.cb.novo(this.pend); else this.cb.muda && this.cb.muda(r, o.r0); } }
      this.desenhar(); }
  }
  G.Visor = Visor;
})(window);
