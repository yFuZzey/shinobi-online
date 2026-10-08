// Regras dos itens criados no painel. O mesmo arquivo roda no jogo, no servidor e no painel, para os três calcularem igual.
// Os números ficam em balanceamento.json → itensPainel.
(function (G) {
  const RAR = ['comum', 'raro', 'epico', 'lendario'], SLOTS = ['capa', 'arma', 'mao', 'cabeca', 'acessorio'], TIPOS = ['status', 'habilidade', 'nova'];
  const lv = it => Math.max(1, Math.round(+it.nivel || 1));
  // valor de cada atributo escolhido: (base + porNivel × (nível − 1)) × raridade
  function itStats(cfg, it) {
    const o = {}, R = cfg.raridade[it.raridade] || 1;
    for (const k of it.atributos || []) { const a = cfg.atributos[k]; if (!a) continue; const v = (a.base + a.porNivel * (lv(it) - 1)) * R; o[k] = Math.max(1, Math.round(v)); }
    return o;
  }
  // habilidade do item: a escolhida no painel ou, para "habilidade nova", a que o Claude já programou (itensPainel.prontas)
  function itHab(cfg, it) { const id = it.tipo === 'habilidade' ? it.habilidade : it.tipo === 'nova' ? (cfg.prontas || {})[it.id] : null; return id && (cfg.habilidades || {})[id] ? id : null; }
  // habilidade de botão (hoje: raio = investida do Chidori); o dano cresce com o nível e a raridade
  function itAtk(cfg, it) {
    const hid = itHab(cfg, it), h = hid && cfg.habilidades[hid]; if (!h || h.passiva) return null;
    const R = cfg.raridade[it.raridade] || 1, a = Object.assign({ kind: hid }, h.base);
    for (const k in h.porNivel || {}) a[k] = Math.round((h.base[k] + h.porNivel[k] * (lv(it) - 1)) * (k === 'dmg' ? R : 1));
    return a;
  }
  // habilidade passiva (funciona sozinha): hoje drena = drenar chakra a cada golpe que acerta
  function itPassiva(cfg, it) { const hid = itHab(cfg, it), h = hid && cfg.habilidades[hid]; return h && h.passiva ? Object.assign({ k: hid, n: h.n }, h.base) : null; }
  // confere tudo antes de gravar (o banco também confere); devolve a lista de problemas (vazia = ok)
  function itValida(cfg, it) {
    const e = [];
    if (!/^p_[a-z0-9_]{2,36}$/.test(it.id || '')) e.push('código do item inválido');
    const n = String(it.nome || '').trim(); if (n.length < 2 || n.length > 40) e.push('nome precisa ter de 2 a 40 letras');
    if (!(lv(it) >= 1 && lv(it) <= (cfg.nivelMax || 99))) e.push('nível de 1 a ' + (cfg.nivelMax || 99));
    if (!RAR.includes(it.raridade)) e.push('escolha a raridade');
    if (!SLOTS.includes(it.slot)) e.push('escolha onde o item vai (parte do corpo)');
    if (!TIPOS.includes(it.tipo)) e.push('escolha o tipo do item');
    if (it.tipo === 'habilidade' && !(cfg.habilidades || {})[it.habilidade]) e.push('escolha a habilidade');
    if (it.tipo === 'nova' && String(it.pedido || '').trim().length < 5) e.push('descreva a habilidade nova (o que ela faz)');
    const A = it.atributos || [], mx = (cfg.maxAtributos || {})[it.raridade] || 1;
    if (!A.length) e.push('escolha pelo menos 1 atributo');
    if (A.length > mx) e.push('a raridade ' + it.raridade + ' pode ter até ' + mx + ' atributo' + (mx > 1 ? 's' : ''));
    if (A.some(k => !cfg.atributos[k]) || new Set(A).size !== A.length) e.push('atributo inválido');
    if (!/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(it.icone || '')) e.push('envie o ícone');
    else if (it.icone.length > (cfg.iconeMaxKb || 40) * 1400) e.push('ícone grande demais');
    for (const k of ['visual', 'visual2']) if (it[k] && (!/^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(it[k]) || it[k].length > (cfg.visualMaxKb || 80) * 1400)) e.push(k === 'visual' ? 'visual no corpo inválido ou grande demais' : 'visual da capa ao vento inválido ou grande demais');
    if (it.visual && !CAMADA[it.slot]) e.push('itens da mão não têm visual no corpo (usam efeito)');
    return e;
  }
  // linha do banco → item do jogo (mesmo formato dos itens feitos no editor)
  function itParaJogo(cfg, r) {
    const atk = itAtk(cfg, r), pas = itPassiva(cfg, r), hid = itHab(cfg, r), h = hid && cfg.habilidades[hid], pronta = r.tipo === 'nova' && !!hid;
    return { id: r.id, name: r.nome, rarity: r.raridade, slot: r.slot, nivel: lv(r), painel: 1, icon: r.icone,
      desc: (r.descricao || '') + (r.tipo === 'nova' && !pronta ? (r.descricao ? '\n' : '') + '(cinza)Habilidade em preparo: por enquanto o item só dá os atributos.(cinza)' : ''),
      stats: itStats(cfg, r), atk: atk || undefined, passiva: pas || undefined, vis: r.visual ? Object.assign(itVisLimpa(r.vis), { img: r.visual, img2: r.visual2 || null }) : undefined, fx: h && h.fx ? Object.assign({ icon: r.icone }, h.fx) : undefined, aguardando: r.tipo === 'nova' && !pronta ? 1 : 0 };
  }
  // descrição com cor e quebra de linha: (red)Passiva: Drenar(red) ou (vermelho)…(vermelho); Enter vira nova linha
  const CORES = { vermelho: '#c0301a', red: '#c0301a', azul: '#1f5fc4', blue: '#1f5fc4', verde: '#2d7a3e', green: '#2d7a3e', amarelo: '#b07a00', yellow: '#b07a00',
    dourado: '#b07a00', gold: '#b07a00', roxo: '#7a3ec0', purple: '#7a3ec0', laranja: '#c0601a', orange: '#c0601a', rosa: '#c0307a', pink: '#c0307a', cinza: '#6a6a6a', gray: '#6a6a6a' };
  function descHtml(t) {
    let h = String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    for (let i = 0; i < 3; i++) h = h.replace(/\(([a-z]+)\)([\s\S]*?)\(\/?\1\)/gi, (m, k, x) => { const c = CORES[k.toLowerCase()]; return c ? '<b style="color:' + c + '">' + x + '</b>' : m; });
    return h.replace(/\r?\n/g, '<br>');
  }
  // ---------- visual no corpo (camadas por cima/por trás do boneco) ----------
  // pontos do boneco num quadro (a partir dos pixels): topo da cabeça, ombros, costas, pés. O boneco olha para a direita.
  function itAncora(d, w, h) {
    let x0 = w, x1 = -1, y0 = h, y1 = -1; const op = (x, y) => d[(y * w + x) * 4 + 3] > 40;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (op(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null; const bh = y1 - y0 + 1, bw = x1 - x0 + 1;
    let sx = 0, n = 0; for (let y = y0; y < y0 + Math.max(2, Math.round(bh * .15)); y++) for (let x = x0; x <= x1; x++) if (op(x, y)) { sx += x; n++; }
    const headX = n ? sx / n : (x0 + x1) / 2, shY = y0 + bh * .3;
    let backX = x1; for (let x = x0; x <= x1; x++) if (op(x, Math.round(shY))) { backX = x; break; }
    return { x0, x1, y0, y1, bw, bh, headX, shY, backX };
  }
  // quadro da pose comparado com o boneco em pé (R): o tamanho e a largura vêm do boneco em pé, então a peça não "pulsa"
  // quando as pernas sobem na corrida; a posição continua seguindo a cabeça e as costas de cada quadro
  function itAncoraRef(A, R) { if (!A || !R || A === R) return A; return Object.assign({}, A, { bh: R.bh, bw: R.bw, shY: A.y0 + R.bh * .3 }); }
  // onde fica cada parte do corpo (px do quadro do boneco); v = ajuste do painel (x/y em % da altura do boneco):
  //   novo: {parado:{esc,x,y,giro,frente}, correndo:{…}} (cada pose com o seu ajuste e se fica na frente ou atrás do corpo)
  //   antigo: {esc,x,y,giro} (vale para as duas poses)
  const CAMADA = {
    capa:      { tras: 1, piv: [.5, .02], alt: .72, pos: A => [A.headX - A.bw * .12, A.shY - A.bh * .06] },
    arma:      { tras: 1, piv: [.5, .5],  alt: .95, pos: A => [A.backX + A.bw * .2, A.shY + A.bh * .14] },
    cabeca:    { tras: 0, piv: [.5, 1],   alt: .2,  pos: A => [A.headX, A.y0 + A.bh * .17] },
    acessorio: { tras: 0, piv: [.5, .5],  alt: .18, pos: A => [A.headX, A.shY + A.bh * .14] },
  };
  const POSES = ['parado', 'correndo'];
  // lado (frente): 0 = atrás do corpo, 1 = na frente, 2 = dividido (a parte de cima do desenho na frente, o resto atrás; corte = % do desenho que fica na frente)
  const lado = (f, C) => f == null ? (C.tras ? 0 : 1) : Math.round(+f) === 2 ? 2 : +f ? 1 : 0;
  function itPose(slot, v, mv) {
    v = v || {}; const C = CAMADA[slot] || {}, p = v[mv ? 'correndo' : 'parado'];
    if (p && typeof p === 'object') { const l = lado(p.frente, C); return { esc: +p.esc || 100, x: +p.x || 0, y: +p.y || 0, giro: +p.giro || 0, lado: l, frente: l === 1, corte: Math.max(5, Math.min(95, +p.corte || 35)), poses: 1 }; }
    return { esc: +v.esc || 100, x: +v.x || 0, y: +v.y || 0, giro: +v.giro || 0, lado: C.tras ? 0 : 1, frente: !C.tras, corte: 35, poses: 0 };
  }
  // ajuste padrão de uma pose (a capa correndo já começa inclinada, como se fosse o vento)
  function itPosePad(slot, pose, img2) { const C = CAMADA[slot] || {}; return { esc: 100, x: 0, y: 0, giro: slot === 'capa' && pose === 'correndo' && !img2 ? 14 : 0, frente: C.tras ? 0 : 1, corte: 35 }; }
  // limpa o ajuste vindo do banco/painel (só números dentro dos limites)
  function itVisLimpa(v) {
    v = v && typeof v === 'object' ? v : {}; const n = (x, d, a, b) => { x = Math.round(+x); return isFinite(x) ? Math.max(a, Math.min(b, x)) : d; };
    const um = p => ({ esc: n(p.esc || 100, 100, 20, 300), x: n(p.x, 0, -100, 100), y: n(p.y, 0, -100, 100), giro: n(p.giro, 0, -180, 180) }), o = um(v);
    for (const k of POSES) if (v[k] && typeof v[k] === 'object') o[k] = Object.assign(um(v[k]), { frente: v[k].frente == null ? undefined : lado(v[k].frente, {}), corte: n(v[k].corte, 35, 5, 95) });
    return o;
  }
  // mv = pose correndo; img2 = o item tem desenho próprio para correr (então não inclina sozinho)
  function itCamada(slot, A, v, iw, ih, mv, t, img2) {
    const C = CAMADA[slot]; if (!C || !A || !iw || !ih) return null; const p = itPose(slot, v, mv);
    const esc = Math.max(.2, Math.min(3, p.esc / 100)), h = A.bh * C.alt * esc, w = h * iw / ih, [bx, by] = C.pos(A);
    const rot = p.giro + (slot === 'capa' ? (mv && !p.poses && !img2 ? 14 : 0) + Math.sin((t || 0) / 420) * 2 : slot === 'arma' ? Math.sin((t || 0) / 520) * 1.2 : 0);
    return { x: bx + p.x * A.bh / 100, y: by + p.y * A.bh / 100, w, h, rot: rot * Math.PI / 180, px: C.piv[0], py: C.piv[1], tras: p.lado === 0 ? 1 : 0, div: p.lado === 2 ? 1 : 0, corte: p.corte / 100 };
  }
  // parte: 'cima' (do topo do desenho até o corte) ou 'baixo' (do corte até o fim); sem parte, o desenho inteiro.
  // O corte acompanha o giro do item; a parte de cima passa 1 px do corte para não aparecer emenda.
  function itDesenha(c, im, P, parte) {
    c.save(); c.translate(P.x, P.y); c.rotate(P.rot); const x0 = -P.px * P.w, y0 = -P.py * P.h;
    if (parte) { const yc = y0 + P.h * (P.corte || .35); c.beginPath(); if (parte === 'cima') c.rect(x0 - 2, y0 - 2, P.w + 4, yc - y0 + 3); else c.rect(x0 - 2, yc, P.w + 4, y0 + P.h - yc + 2); c.clip(); }
    c.drawImage(im, x0, y0, P.w, P.h); c.restore();
  }
  // nome → código (p_espada_do_zabuza)
  function itId(nome) { return 'p_' + String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30); }
  G.ITR = { RAR, SLOTS, TIPOS, CORES, CAMADA, itStats, itHab, itAtk, itPassiva, itValida, itParaJogo, itId, descHtml, itAncora, itAncoraRef, itCamada, itDesenha, POSES, itPose, itPosePad, itVisLimpa };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.ITR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
