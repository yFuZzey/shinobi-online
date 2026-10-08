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
    return e;
  }
  // linha do banco → item do jogo (mesmo formato dos itens feitos no editor)
  function itParaJogo(cfg, r) {
    const atk = itAtk(cfg, r), pas = itPassiva(cfg, r), hid = itHab(cfg, r), h = hid && cfg.habilidades[hid], pronta = r.tipo === 'nova' && !!hid;
    return { id: r.id, name: r.nome, rarity: r.raridade, slot: r.slot, nivel: lv(r), painel: 1, icon: r.icone,
      desc: (r.descricao || '') + (r.tipo === 'nova' && !pronta ? (r.descricao ? '\n' : '') + '(cinza)Habilidade em preparo: por enquanto o item só dá os atributos.(cinza)' : ''),
      stats: itStats(cfg, r), atk: atk || undefined, passiva: pas || undefined, fx: h && h.fx ? Object.assign({ icon: r.icone }, h.fx) : undefined, aguardando: r.tipo === 'nova' && !pronta ? 1 : 0 };
  }
  // descrição com cor e quebra de linha: (red)Passiva: Drenar(red) ou (vermelho)…(vermelho); Enter vira nova linha
  const CORES = { vermelho: '#c0301a', red: '#c0301a', azul: '#1f5fc4', blue: '#1f5fc4', verde: '#2d7a3e', green: '#2d7a3e', amarelo: '#b07a00', yellow: '#b07a00',
    dourado: '#b07a00', gold: '#b07a00', roxo: '#7a3ec0', purple: '#7a3ec0', laranja: '#c0601a', orange: '#c0601a', rosa: '#c0307a', pink: '#c0307a', cinza: '#6a6a6a', gray: '#6a6a6a' };
  function descHtml(t) {
    let h = String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    for (let i = 0; i < 3; i++) h = h.replace(/\(([a-z]+)\)([\s\S]*?)\(\/?\1\)/gi, (m, k, x) => { const c = CORES[k.toLowerCase()]; return c ? '<b style="color:' + c + '">' + x + '</b>' : m; });
    return h.replace(/\r?\n/g, '<br>');
  }
  // nome → código (p_espada_do_zabuza)
  function itId(nome) { return 'p_' + String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30); }
  G.ITR = { RAR, SLOTS, TIPOS, CORES, itStats, itHab, itAtk, itPassiva, itValida, itParaJogo, itId, descHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = G.ITR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
