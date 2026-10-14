/* Editor de mapas · INTERFACE (Fase 1): gerenciador de mapas, criação, redimensionar, visualização com toque, salvar e publicar.
   Depende de: JOGO (jogo.js), Modelo, Persist, Render, MR (regras de colisão do servidor). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), J = window.JOGO, Mo = window.Modelo, P = window.Persist, R = window.Render, T = 32;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = t => String(t == null ? '' : t).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const hora = t => t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), 2600); }

  /* ---------- estado ---------- */
  const E = { m: null, reg: null, sujo: false, des: [], ref: [], s: 1, ox: 0, oy: 0, aba: null, modo: null,
    ver: { grade: true, colisao: false, chao: true, detalhes: true, objetos: true, acima: true, areas: true, marcas: true },
    cache: {}, srv: [], lib: { imagens: [], tilesets: [], recursos: [] },
    ferr: 'mover', ativa: 'chao', tinta: { terreno: 0, col: 1, tile: null }, contorno: false, sel: null, clip: null, colarClip: null, mira: null, traco: null, conj: [], gradePasso: 32, selTodas: true, pkId: null };
  window.EDITOR = E; // para os testes

  /* ---------- diálogo ---------- */
  function dlg(titulo, html, botoes, aoAbrir) {
    return new Promise(ok => { const d = $('#dlg'); $('#dlgT').textContent = titulo; $('#dlgC').innerHTML = html; const B = $('#dlgB'); B.innerHTML = '';
      const fechar = v => { d.hidden = true; ok(v); };
      for (const b of botoes) { const x = document.createElement('button'); x.className = 'btn ' + (b.c || ''); x.textContent = b.t; x.dataset.v = b.v;
        x.onclick = () => { if (b.antes && b.antes() === false) return; fechar(b.v); }; B.appendChild(x); }
      d.hidden = false; d.onclick = e => { if (e.target === d) fechar(null); }; aoAbrir && aoAbrir($('#dlgC'), B); }); }
  const aviso = (t, msg) => dlg(t, '<p>' + msg + '</p>', [{ t: 'OK', v: 1, c: 'pri' }]);

  /* ---------- lista de mapas ---------- */
  async function inicio() {
    $('#editor').hidden = true; $('#inicio').hidden = false;
    const S = P.sessao(); $('#secLogin').hidden = !!S; $('#secSrv').hidden = !S;
    $('#quem').innerHTML = S ? esc(S.nome) + ' · <a href="#" id="sairL">Sair</a>' : '';
    if (S) $('#sairL').onclick = e => { e.preventDefault(); P.sair(); inicio(); };
    const loc = (await P.listar()).sort((a, b) => b.salvoEm - a.salvoEm), L = $('#lsLocal'); L.innerHTML = '';
    if (!loc.length) L.innerHTML = '<p class="mudo">Nenhum rascunho ainda.</p>';
    for (const r of loc) L.appendChild(item(r.nome, r.id + ' · ' + r.W + '×' + r.H + ' · salvo ' + hora(r.salvoEm), r.servidor ? (r.servidor.publicado ? '<span class="selo ok">No jogo</span>' : '<span class="selo">No servidor</span>') : '<span class="selo av">Só no aparelho</span>', () => acoesLocal(r)));
    const B = $('#lsBase'); B.innerHTML = '';
    for (const id of Object.keys(J.BASE)) { const m = J.BASE[id]; B.appendChild(item(id === 'konoha' ? 'Konoha' : id === 'vila_areia' ? 'Vila da Areia' : id, id + ' · ' + (m.W || m.N) + '×' + (m.H || m.N), '<span class="selo">Do jogo</span>', () => acoesBase(id))); }
    if (S) srvLista(); }
  function item(nome, sub, selos, fn) { const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<div class="info"><b>' + esc(nome) + selos + '</b><small>' + esc(sub) + '</small></div><button class="btn peq">Abrir ▸</button>';
    d.querySelector('button').onclick = fn; return d; }
  async function srvLista() { const L = $('#lsSrv'); L.innerHTML = '<p class="mudo">Carregando…</p>';
    try { E.srv = await P.listarServidor(); L.innerHTML = ''; if (!E.srv.length) L.innerHTML = '<p class="mudo">Nenhum mapa no servidor.</p>';
      for (const r of E.srv) L.appendChild(item(r.nome || r.id, r.id + ' · alterado ' + hora(r.atualizado_em), r.publicado ? '<span class="selo ok">No jogo</span>' : '<span class="selo">Fora do jogo</span>', () => acoesSrv(r))); }
    catch (e) { L.innerHTML = '<p class="status err">' + esc(P.erroTexto(e)) + '</p>'; } }

  async function acoesLocal(r) {
    const v = await dlg(r.nome, '<p class="mudo">' + esc(r.id) + ' · ' + r.W + '×' + r.H + (r.servidor ? ' · ligado ao mapa do servidor' : '') + '</p>',
      [{ t: 'Abrir', v: 'abrir', c: 'pri' }, { t: 'Duplicar', v: 'dup' }, { t: 'Renomear', v: 'ren' }, { t: 'Excluir rascunho', v: 'del', c: 'perigo' }, { t: 'Cancelar', v: null }]);
    if (v === 'abrir') return abrirLocal(r.id);
    const reg = v && await P.ler(r.id); if (!reg) return;
    if (v === 'dup') return duplicar(Mo.deJogo(reg.mapa, reg.id), reg.nome);
    if (v === 'ren') return renomear(reg);
    if (v === 'del') { const ok = await dlg('Excluir rascunho?', '<p>Apagar o rascunho <b>' + esc(r.nome) + '</b> (' + esc(r.id) + ') deste aparelho, junto com as cópias de segurança?</p>' + (r.servidor ? '<p class="mudo">O mapa no servidor não é apagado.</p>' : '<p class="aviso">Ele só existe neste aparelho: não dá para desfazer.</p>'), [{ t: 'Excluir', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]);
      if (ok) { await P.apagar(r.id); toast('Rascunho excluído'); inicio(); } } }
  async function acoesBase(id) {
    const v = await dlg(id, '<p>Os mapas do jogo não são alterados por aqui. Você pode abrir para ver ou duplicar para criar um mapa novo a partir dele.</p>', [{ t: 'Duplicar para editar', v: 'dup', c: 'pri' }, { t: 'Só ver', v: 'ver' }, { t: 'Cancelar', v: null }]);
    const m = Mo.deJogo(J.BASE[id], id); m.nome = id === 'konoha' ? 'Konoha' : id === 'vila_areia' ? 'Vila da Areia' : id;
    if (v === 'dup') return duplicar(m, m.nome);
    if (v === 'ver') abrir(m, { id, nome: m.nome, base: true, servidor: null }); }
  async function acoesSrv(r) {
    const v = await dlg(r.nome || r.id, '<p class="mudo">' + esc(r.id) + ' · ' + (r.publicado ? 'aparece no jogo' : 'fora do jogo') + ' · alterado ' + hora(r.atualizado_em) + '</p>',
      [{ t: 'Abrir', v: 'abrir', c: 'pri' }, { t: 'Duplicar', v: 'dup' }, { t: r.publicado ? 'Tirar do jogo' : 'Pôr no jogo', v: 'tog' }, { t: 'Excluir do servidor', v: 'del', c: 'perigo' }, { t: 'Cancelar', v: null }]);
    try {
      if (v === 'abrir') return abrirSrv(r.id);
      if (v === 'dup') { const s = await P.lerServidor(r.id); if (!s) return aviso('Não encontrado', 'Esse mapa não existe mais no servidor.'); return duplicar(Mo.deJogo(s.mapa, s.id), s.nome); }
      if (v === 'tog') { await P.publicadoServidor(r.id, !r.publicado); toast(r.publicado ? 'Tirado do jogo' : 'Posto no jogo'); return inicio(); }
      if (v === 'del') {
        const ok = await dlg('Excluir do servidor?', '<p>O mapa <b>' + esc(r.id) + '</b> sai do jogo e do servidor. Quem estiver nele termina a visita.</p><p>Para confirmar, escreva o identificador:</p><input id="cfId" autocomplete="off" autocapitalize="none" placeholder="' + esc(r.id) + '">',
          [{ t: 'Excluir', v: 1, c: 'perigo', antes: () => { if ($('#cfId').value.trim() !== r.id) { $('#cfId').focus(); toast('Escreva “' + r.id + '” para confirmar'); return false; } } }, { t: 'Cancelar', v: 0 }]);
        if (ok) { await P.apagarServidor(r.id); const loc = await P.ler(r.id); if (loc) { loc.servidor = null; await P.salvar(loc); } toast('Excluído do servidor'); inicio(); } }
    } catch (e) { aviso('Não deu certo', esc(P.erroTexto(e))); } }

  /* ---------- novo, duplicar, renomear ---------- */
  async function idsUsados() { if (P.sessao()) { try { E.srv = await P.listarServidor(); } catch (e) { } } const s = new Set(Mo.BASE_IDS); for (const r of await P.listar()) s.add(r.id); for (const r of E.srv) s.add(r.id); return s; }
  function idLivre(base, usados) { base = Mo.slug(base) || 'mapa'; if (base.length < 2) base += '_1'; let id = base, n = 2; while (usados.has(id)) id = (base.slice(0, 26) + '_' + n++); return id; }
  async function novo() {
    const usados = await idsUsados(), presets = [[12, 10], [16, 12], [20, 15], [30, 20], [50, 50], [70, 40], [80, 80], [100, 64]];
    const html = `<div class="campo"><label class="lbl">Nome</label><input id="nvNome" maxlength="40" placeholder="Ex.: Floresta da Névoa"></div>
      <div class="campo"><label class="lbl">Identificador (vai no endereço do mapa; não muda depois de publicar)</label><input id="nvId" maxlength="30" autocapitalize="none"></div>
      <label class="lbl">Tamanho em tiles (1 tile = 32 px no jogo)</label><div class="presets">${presets.map(p => `<button data-p="${p}">${p[0]}×${p[1]}</button>`).join('')}</div>
      <div class="grade2"><div><label class="lbl">Largura</label><input id="nvW" type="number" min="${Mo.LIM.MIN}" max="${Mo.LIM.MAX}" value="50"></div><div><label class="lbl">Altura</label><input id="nvH" type="number" min="${Mo.LIM.MIN}" max="${Mo.LIM.MAX}" value="50"></div></div>
      <p class="mudo" id="nvMem"></p>
      <div class="grade2"><div><label class="lbl">Tema</label><select id="nvTema"><option value="folha">Folha</option><option value="areia">Areia</option><option value="vazio">Sem fundo (preto)</option></select></div>
      <div><label class="lbl">Terreno inicial</label><select id="nvTerr"></select></div></div>
      <div class="campo"><label class="lbl">Tile da arte (px): tamanho dos tiles dos seus tilesets. A grade de colisão e de movimento do jogo continua 32 px.</label><select id="nvTile"><option>16</option><option selected>32</option><option>48</option><option>64</option></select></div>
      <label class="lbl">Ponto de nascimento (tiles; vazio = centro)</label><div class="grade2"><input id="nvSx" type="number" step="0.5" placeholder="X"><input id="nvSy" type="number" step="0.5" placeholder="Y"></div>
      <p class="mudo">Colisão: a borda de 2 tiles é sempre bloqueada pelo jogo; lagoa e rio bloqueiam, ruas e pontes liberam. Depois dá para pintar colisão extra.</p>
      <p class="status err" id="nvErr"></p>`;
    let idMexido = false;
    const v = await dlg('Novo mapa', html, [{ t: 'Criar', v: 1, c: 'pri', antes: () => confere(true) }, { t: 'Cancelar', v: 0 }], c => {
      const terr = () => { const t = Mo.TEMAS[$('#nvTema').value]; $('#nvTerr').innerHTML = Mo.INICIAIS.map(i => `<option value="${i}">${t.terr[i]}</option>`).join(''); };
      terr(); $('#nvTema').onchange = terr;
      $('#nvNome').oninput = () => { if (!idMexido) $('#nvId').value = idLivre($('#nvNome').value, usados); confere(); };
      $('#nvId').oninput = () => { idMexido = true; confere(); };
      ['nvW', 'nvH', 'nvSx', 'nvSy'].forEach(i => $('#' + i).oninput = () => confere());
      c.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const [w, h] = b.dataset.p.split(','); $('#nvW').value = w; $('#nvH').value = h; confere(); });
      confere(); setTimeout(() => $('#nvNome').focus(), 50); });
    function confere(final) { const W = +$('#nvW').value, H = +$('#nvH').value, id = $('#nvId').value.trim(); let e = Mo.dimErro(W, H);
      $('#nvMem').textContent = e ? '' : 'Imagem do chão: ' + W * T + '×' + H * T + ' px (~' + Mo.memMB(W, H) + ' MB por camada no celular).';
      if (!e && final && !$('#nvNome').value.trim()) e = 'Dê um nome para o mapa.';
      if (!e && !Mo.ID.test(id)) e = id ? 'Identificador: só letras minúsculas, números e _ (2 a 30).' : (final ? 'Falta o identificador.' : '');
      if (!e && usados.has(id)) e = '“' + id + '” já existe' + (Mo.BASE_IDS.includes(id) ? ' no jogo' : '') + '. Escolha outro.';
      const sx = $('#nvSx').value, sy = $('#nvSy').value;
      if (!e && (sx !== '' || sy !== '') && (!(+sx >= 2 && +sx <= W - 2) || !(+sy >= 2 && +sy <= H - 2))) e = 'O nascimento precisa ficar dentro do mapa, fora da borda (2 a ' + (W - 2) + ' × 2 a ' + (H - 2) + ').';
      $('#nvErr').textContent = e || ''; return !e; }
    if (!v) return;
    const W = +$('#nvW').value, H = +$('#nvH').value, sx = $('#nvSx').value, sy = $('#nvSy').value;
    const m = Mo.novo({ id: $('#nvId').value.trim(), nome: $('#nvNome').value.trim(), W, H, tema: $('#nvTema').value, terreno: +$('#nvTerr').value, tile: +$('#nvTile').value, spawn: sx !== '' && sy !== '' ? [+sx, +sy] : null });
    const reg = { id: m.id, nome: m.nome, W, H, mapa: Mo.paraJogo(m), servidor: null };
    try { await P.salvar(reg); } catch (e) { return aviso('Não consegui salvar', esc(e.message)); }
    abrir(m, reg); toast('Mapa criado e salvo no aparelho'); }
  async function duplicar(m, nome) {
    const usados = await idsUsados(), sug = idLivre(m.id + '_copia', usados);
    const v = await dlg('Duplicar', `<div class="campo"><label class="lbl">Nome da cópia</label><input id="dpNome" maxlength="40" value="${esc((nome || m.nome) + ' (cópia)')}"></div><div class="campo"><label class="lbl">Identificador</label><input id="dpId" maxlength="30" autocapitalize="none" value="${sug}"></div><p class="status err" id="dpErr"></p>`,
      [{ t: 'Duplicar', v: 1, c: 'pri', antes: () => { const id = $('#dpId').value.trim(), e = !Mo.ID.test(id) ? 'Identificador inválido.' : usados.has(id) ? '“' + id + '” já existe.' : !$('#dpNome').value.trim() ? 'Dê um nome.' : ''; $('#dpErr').textContent = e; return !e; } }, { t: 'Cancelar', v: 0 }]);
    if (!v) return;
    const c = Mo.copia(m); c.id = $('#dpId').value.trim(); c.nome = $('#dpNome').value.trim(); c.tem.title = true; c.ed = Object.assign({}, c.ed, { duplicadoDe: m.id, criado: Date.now() });
    const reg = { id: c.id, nome: c.nome, W: c.W, H: c.H, mapa: Mo.paraJogo(c), servidor: null };
    try { await P.salvar(reg); } catch (e) { return aviso('Não consegui salvar', esc(e.message)); }
    abrir(c, reg); toast('Cópia criada'); }
  async function renomear(reg) {
    const fixo = !!reg.servidor, usados = await idsUsados(); usados.delete(reg.id);
    const v = await dlg('Renomear', `<div class="campo"><label class="lbl">Nome</label><input id="rnNome" maxlength="40" value="${esc(reg.nome)}"></div>
      <div class="campo"><label class="lbl">Identificador</label><input id="rnId" maxlength="30" autocapitalize="none" value="${esc(reg.id)}" ${fixo ? 'disabled' : ''}></div>
      ${fixo ? '<p class="mudo">Este mapa já está no servidor: o identificador não muda (para isso, duplique). O nome novo vai para o servidor quando você publicar.</p>' : ''}<p class="status err" id="rnErr"></p>`,
      [{ t: 'Salvar', v: 1, c: 'pri', antes: () => { const id = $('#rnId').value.trim(), e = !$('#rnNome').value.trim() ? 'Dê um nome.' : !Mo.ID.test(id) ? 'Identificador inválido.' : usados.has(id) ? '“' + id + '” já existe.' : ''; $('#rnErr').textContent = e; return !e; } }, { t: 'Cancelar', v: 0 }]);
    if (!v) return;
    const nome = $('#rnNome').value.trim(), id = fixo ? reg.id : $('#rnId').value.trim(), m = Mo.deJogo(reg.mapa, reg.id);
    m.id = id; m.nome = nome; m.tem.title = true;
    const novoReg = Object.assign({}, reg, { id, nome, mapa: Mo.paraJogo(m) });
    try { await P.salvar(novoReg); if (id !== reg.id) await P.apagar(reg.id); } catch (e) { return aviso('Não consegui salvar', esc(e.message)); }
    toast('Renomeado'); if (E.m && E.reg && E.reg.id === reg.id) { E.m.id = id; E.m.nome = nome; E.reg = novoReg; topo(); } else inicio(); }

  /* ---------- abrir ---------- */
  async function abrirLocal(id) {
    const reg = await P.ler(id); if (!reg) return aviso('Não encontrado', 'Esse rascunho não existe mais.');
    let m; try { m = Mo.deJogo(reg.mapa, reg.id); m.nome = reg.nome; } catch (e) { return aviso('Mapa com problema', esc(e.message)); }
    const em = await P.lerEmergencia(id);
    if (em && em.salvoEm > (reg.salvoEm || 0)) {
      const v = await dlg('Recuperar alterações?', '<p>Há alterações que não foram salvas (de ' + hora(em.salvoEm) + '), guardadas quando o editor fechou sem salvar.</p>', [{ t: 'Recuperar', v: 1, c: 'pri' }, { t: 'Abrir o último salvo', v: 2 }, { t: 'Cancelar', v: 0 }]);
      if (!v) return; if (v === 1) { try { const r = Mo.deJogo(em.mapa, em.id); r.nome = em.nome; abrir(r, reg); E.sujo = true; topo(); return; } catch (e) { aviso('Não deu para recuperar', esc(e.message)); } } else await P.limparEmergencia(id); }
    abrir(m, reg); }
  async function abrirSrv(id) {
    const s = await P.lerServidor(id); if (!s) return aviso('Não encontrado', 'Esse mapa não existe mais no servidor.');
    let m; try { m = Mo.deJogo(s.mapa, s.id); m.nome = s.nome || s.id; } catch (e) { return aviso('Mapa com problema', esc(e.message) + '<br>Talvez precise do editor antigo para abri-lo.'); }
    const loc = await P.ler(id), reg = { id, nome: m.nome, W: m.W, H: m.H, mapa: Mo.paraJogo(m), servidor: { atualizado_em: s.atualizado_em, publicado: s.publicado } };
    if (loc && JSON.stringify(loc.mapa) !== JSON.stringify(reg.mapa)) {
      const v = await dlg('Já existe um rascunho', '<p>Você tem um rascunho de <b>' + esc(id) + '</b> neste aparelho (salvo ' + hora(loc.salvoEm) + ') diferente da versão do servidor (' + hora(s.atualizado_em) + ').</p>', [{ t: 'Abrir meu rascunho', v: 'loc', c: 'pri' }, { t: 'Usar a do servidor (o rascunho vira cópia de segurança)', v: 'srv' }, { t: 'Cancelar', v: null }]);
      if (v === 'loc') { if (!loc.servidor) { loc.servidor = reg.servidor; await P.salvar(loc); } return abrirLocal(id); }
      if (v !== 'srv') return; }
    try { await P.salvar(reg); } catch (e) { return aviso('Não consegui salvar no aparelho', esc(e.message)); }
    abrir(m, reg); }
  function abrir(m, reg) {
    E.m = m; E.reg = reg; E.sujo = false; E.des = []; E.ref = []; E.modo = null; E.cache = {}; E.sel = null; E.traco = null; E.mira = null; E.objSel = null; E.colObj = null; E.aqui = []; Ferr.padrao(m); barraObj();
    ferramenta('mover'); ativar(E.ativa && (FIXAS[E.ativa] || Ferr.camada(m, E.ativa)) ? E.ativa : 'chao');
    $('#inicio').hidden = true; $('#editor').hidden = false; fecharPainel(); topo(); ajusta(); requestAnimationFrame(() => { tamanhoCv(); ajustar(); }); }

  /* ---------- editor: barra, histórico, salvar ---------- */
  function topo() { const m = E.m; $('#edNome').textContent = m.nome + (E.reg && E.reg.base ? ' (só ver)' : '');
    $('#edInfo').textContent = m.id + ' · ' + m.W + '×' + m.H + (E.reg && E.reg.servidor ? (E.reg.servidor.publicado ? ' · no jogo' : ' · no servidor') : ' · só no aparelho');
    const e = $('#edEstado'); e.className = 'estado ' + (E.sujo ? 'sujo' : 'limpo'); e.textContent = E.sujo ? '● Não salvo' : '✓ Salvo';
    $('#desf').disabled = !E.des.length; $('#ref').disabled = !E.ref.length; const so = E.reg && E.reg.base; $('#salvar').disabled = so; $('#publicar').disabled = so; }
  // muda o mapa com desfazer: fn recebe o modelo
  function mudar(fn, oque) { const antes = Mo.copia(E.m); antes.nome = E.m.nome; const r = fn(E.m); if (r === false) return false;
    E.des.push(antes); if (E.des.length > 80) E.des.shift(); E.ref.length = 0; marcarSujo(oque); return true; }
  function trocar(m, oque) { const antes = Mo.copia(E.m); antes.nome = E.m.nome; E.des.push(antes); E.ref.length = 0; E.m = m; marcarSujo(oque || 'tudo'); }
  function marcarSujo(oque) { E.sujo = true; invalida(oque); topo(); emerg(); desenhar(); if (E.aba) painel(E.aba); }
  function invalida(oque) { if (!oque || oque === 'tudo' || oque === 'chao') E.cache.chao = null; if (!oque || oque === 'tudo' || oque === 'tiles') E.cache.cam = null; E.cache.M = null; }
  function desfazer() { if (!E.des.length) return; E.objSel = null; E.colObj = null; $('#modoAviso').hidden = !E.modo; const c = Mo.copia(E.m); c.nome = E.m.nome; E.ref.push(c); E.m = E.des.pop(); E.sujo = true; invalida('tudo'); topo(); emerg(); desenhar(); if (E.aba) painel(E.aba); }
  function refazer() { if (!E.ref.length) return; E.objSel = null; E.colObj = null; $('#modoAviso').hidden = !E.modo; const c = Mo.copia(E.m); c.nome = E.m.nome; E.des.push(c); E.m = E.ref.pop(); E.sujo = true; invalida('tudo'); topo(); emerg(); desenhar(); if (E.aba) painel(E.aba); }
  let emT = 0; function emerg() { clearTimeout(emT); emT = setTimeout(() => { if (E.sujo && E.m && !E.reg.base) P.emergencia(registro()); }, 1500); }
  const registro = () => { const c = Mo.copia(E.m); c.nome = E.m.nome; Ferr.compactar(c); return Object.assign({}, E.reg, { id: E.m.id, nome: E.m.nome, W: E.m.W, H: E.m.H, mapa: Mo.paraJogo(c) }); }; // tilesets sem uso saem
  async function salvar() { if (!E.m || E.reg.base) return false;
    try { const r = await P.salvar(registro()); E.reg = r; E.sujo = false; topo(); toast('Salvo no aparelho'); return true; }
    catch (e) { aviso('Não consegui salvar', esc(e.message) + '<br>As alterações continuam abertas aqui; tente de novo.'); return false; } }
  async function publicar() {
    if (!E.m || E.reg.base) return;
    if (!P.sessao()) return aviso('Entre primeiro', 'Volte para a lista de mapas e entre com a conta admin para publicar.');
    const pr = Mo.conferir(E.m, R.cat(J), window.MR.compilar, libSets()), er = pr.filter(p => p.nivel === 'erro');
    if (er.length) return aviso('Corrija antes de publicar', er.map(p => '• ' + esc(p.msg)).join('<br>'));
    const novoSrv = !E.reg.servidor, dimDif = E.m.W !== 50 || E.m.H !== 50;
    const v = await dlg('Publicar “' + E.m.nome + '”', (pr.length ? '<p class="aviso">' + pr.map(p => '• ' + esc(p.msg)).join('<br>') + '</p>' : '') +
      (dimDif ? '<p class="mudo">Mapa de ' + E.m.W + '×' + E.m.H + ': só aparece para quem estiver com o jogo atualizado.</p>' : '') +
      '<p>' + (novoSrv ? 'O mapa vai para o servidor pela primeira vez.' : 'Atualiza o mapa do servidor (versão de ' + hora(E.reg.servidor.atualizado_em) + ').') + '</p>',
      [{ t: novoSrv || !E.reg.servidor.publicado ? 'Enviar e pôr no jogo' : 'Enviar (continua no jogo)', v: 'jogo', c: 'pri' }, { t: 'Enviar sem pôr no jogo', v: 'fora' }, { t: 'Cancelar', v: null }]);
    if (!v) return;
    const pub = v === 'jogo', mapa = Mo.paraJogo(E.m);
    const manda = async forcar => { try { const r = await P.publicar(E.m.id, E.m.nome, mapa, novoSrv ? null : E.reg.servidor.atualizado_em, pub, forcar); return r; }
      catch (e) {
        if (e.existe) { const w = await dlg('Já existe no servidor', '<p>Já há um mapa <b>' + esc(E.m.id) + '</b> no servidor, que não foi aberto daqui. Sobrescrever apaga a versão de lá.</p>', [{ t: 'Sobrescrever o do servidor', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]); return w ? manda(true) : null; }
        if (e.conflito) { const w = await dlg('Alterado no servidor', '<p>Alguém salvou <b>' + esc(E.m.id) + '</b> no servidor depois que você abriu. Se continuar, a versão de lá será substituída pela sua.</p>', [{ t: 'Sobrescrever mesmo assim', v: 1, c: 'perigo' }, { t: 'Cancelar (salvar só no aparelho)', v: 0 }]); return w ? manda(true) : null; }
        aviso('Não consegui publicar', esc(P.erroTexto(e))); return null; } };
    const r = await manda(false); if (!r) return;
    E.reg.servidor = { atualizado_em: r.atualizado_em, publicado: r.publicado }; await salvar(); toast(pub ? 'Publicado no jogo' : 'Enviado ao servidor (fora do jogo)'); }
  const libSets = () => ({ tilesets: new Set(E.lib.tilesets.map(t => t.id).concat((E.lib.recursos || []).filter(r => r.grade).map(r => r.id), pisos(E.lib.recursos).map(p => p.id))), objetos: new Set(Object.keys(J.TSZ).concat(E.lib.imagens.map(i => i.id), Object.keys(R.RC))) });

  async function sairEditor() {
    if (E.sujo) { const v = await dlg('Alterações não salvas', '<p>Salvar antes de voltar para a lista?</p>', [{ t: 'Salvar', v: 's', c: 'pri' }, { t: 'Descartar alterações', v: 'd', c: 'perigo' }, { t: 'Continuar editando', v: null }]);
      if (!v) return; if (v === 's' && !(await salvar())) return; if (v === 'd') await P.limparEmergencia(E.m.id); }
    E.m = null; E.sujo = false; inicio(); }
  window.addEventListener('beforeunload', e => { if (E.sujo) { P.emergencia(registro()); e.preventDefault(); e.returnValue = ''; } });

  /* ---------- painéis ---------- */
  function abrirAba(a) { if (E.aba === a) return fecharPainel(); E.aba = a; document.querySelectorAll('[data-aba]').forEach(b => b.setAttribute('aria-selected', b.dataset.aba === a)); $('#painel').hidden = false; painel(a); tamanhoCv(); }
  function fecharPainel() { E.aba = null; $('#painel').hidden = true; document.querySelectorAll('[data-aba]').forEach(b => b.setAttribute('aria-selected', 'false')); tamanhoCv(); }
  const chk = (id, txt, on) => `<label class="chk"><input type="checkbox" data-v="${id}" ${on ? 'checked' : ''}> ${txt}</label>`;
  function painel(a) {
    const C = $('#pnC'), m = E.m, so = E.reg.base; let h = ''; Ferr.padrao(m);
    if (a === 'mapa') { $('#pnT').textContent = 'Mapa';
      const gp = E.gradePasso, art = (m.ed && m.ed.tile) || 32;
      h = `<label class="lbl">Grade</label><div class="presets">${[[32, 'Colisão (32 px)'], [art, 'Tile da arte (' + art + ' px)'], [0, 'Desligada']].filter((x, i, A) => A.findIndex(y => y[0] === x[0]) === i).map(([v, t]) => `<button data-gp="${v}" aria-pressed="${gp === v}">${t}</button>`).join('')}</div>` +
        `<label class="chk"><input type="checkbox" id="mCol" ${visivel('colisao') ? 'checked' : ''}> Mostrar colisão (vermelho = bloqueado, azul = água)</label>` +
        '<p class="mudo">Um dedo usa a ferramenta escolhida embaixo (✋ Mover só arrasta a visão); dois dedos aproximam/afastam e arrastam sempre.</p><p id="toque" class="mudo"></p>'; }
    else if (a === 'pintura') { $('#pnT').textContent = 'Pintura · ' + nomeAtiva();
      const k = E.ativa, ct = Ferr.camada(m, k);
      h = '<label class="lbl">Onde pintar</label><div class="ondes">' + ondes().map(([v, t, d]) => `<button data-op="${esc(v)}" aria-pressed="${k === v}">${t}<br><small class="mudo">${d}</small></button>`).join('') + '</div>' +
        (k === 'objetos' ? '' : `<div class="presets"><span class="lbl" style="margin:auto 4px auto 0">Retângulo:</span><button data-ct="0" aria-pressed="${!E.contorno}">Preenchido</button><button data-ct="1" aria-pressed="${E.contorno}">Só contorno</button></div>`);
      if (k === 'terreno') { const t = Mo.TEMAS[m.tema];
        h += `<div class="terrs">${t.terr.map((n, i) => `<button data-tr="${i}" aria-pressed="${E.tinta.terreno === i}">${t.th[i] ? `<img alt="" src="${J.TS[t.th[i]] || ''}">` : '<span style="width:32px;height:32px;background:#0b0d10;border:1px solid #444;border-radius:4px"></span>'}${esc(n)}</button>`).join('')}</div><p class="mudo">Pântano, lagoa, rio e ponte ocupam blocos de 2×2 tiles (regra do jogo). A borracha volta ao terreno inicial.</p>`; }
      else if (k === 'colisao') h += `<div class="presets"><button data-cv="1" aria-pressed="${E.tinta.col === 1}">Bloquear</button><button data-cv="2" aria-pressed="${E.tinta.col === 2}">Liberar (passa mesmo sobre obstáculo/água)</button></div><p class="mudo">A borracha tira a colisão pintada (volta à regra do terreno e dos objetos).</p>`;
      else if (k === 'objetos') { const ab = E.catAba || 'bib', L = catalogo(), s = E.tinta.obj;
        h += `<div class="presets"><button data-ca="bib" aria-pressed="${ab === 'bib'}">Biblioteca</button><button data-ca="jogo" aria-pressed="${ab === 'jogo'}">Do jogo</button><button data-ca="img" aria-pressed="${ab === 'img'}">Minhas imagens</button></div>
          <input id="obBusca" type="search" placeholder="Pesquisar objeto" value="${esc(E.busca || '')}" autocomplete="off">
          <label class="lbl">Colocar como</label><div class="presets">${[['auto', 'Automático'], ['objeto', '🏠 Objeto'], ['chao', '🟫 Chão'], ['acima', '☁️ Por cima']].map(([v, t]) => `<button data-om="${v}" aria-pressed="${(E.objModo || 'auto') === v}">${t}</button>`).join('')}</div>
          <p class="mudo">${{ auto: 'Usa o “Como usar no mapa” de cada recorte (Biblioteca → recurso → Recortes). Sem isso, é objeto.', objeto: 'Objeto: o personagem passa na frente ou atrás, conforme a base.', chao: 'Chão: fica sempre por baixo do personagem e sem colisão (piso, tapete, sombra, mancha).', acima: 'Por cima: fica sempre na frente do personagem (copa, telhado, nuvem).' }[E.objModo || 'auto']}</p>
          <label class="chk"><input type="checkbox" id="obEnc" ${E.encaixarObj !== false ? 'checked' : ''}> Encaixar na grade de tiles</label>
          <label class="chk"><input type="checkbox" id="obIma" ${E.imaObj !== false ? 'checked' : ''}> 🧲 Grudar nos vizinhos (cola um sprite colado no outro, sem vão)</label>
          <p class="mudo">${s ? 'Escolhido: <b>' + esc(nomeObj(s)) + '</b>. ✏️ Pincel: toque/arraste e solte no mapa para colocar. ⬚ Seleção: toque num objeto para escolher e arraste para mover.' : 'Escolha um objeto abaixo.'}${ab === 'bib' && !L.length ? ' Nenhum recorte na biblioteca ainda (Biblioteca → recurso → Recortes).' : ''}</p>
          <div class="grade-obj">${L.map(x => `<button class="obj" data-ob="${esc(x.k)}" aria-pressed="${x.k === s}"><canvas width="64" height="64"></canvas><small>${esc(x.n)}</small></button>`).join('')}</div>`; }
      else if (k === 'regioes') h += `<p class="mudo">Áreas de mobs, regiões e saídas chegam na Fase 5. Por enquanto esta camada só pode ser mostrada/escondida e bloqueada.</p>`;
      else { const s = E.tinta.tile; h += `<button class="btn" id="irObj" style="width:100%;margin:4px 0">🌳 Colocar objetos e spritesheets (camada Objetos)</button><p class="mudo">${libTs().length ? (s ? 'Tile escolhido: ' + s.sw + '×' + s.sh + ' do tileset “' + esc((libTs().find(x => x.id === s.id) || {}).nome || s.id) + '”.' : 'Toque num tile abaixo para escolher; “Escolher vários” para um bloco.') : 'Nenhum tileset na biblioteca: importe uma imagem e ligue a grade (Biblioteca → recurso → Grade).'}</p>`;
        if (E.conj.length) h += `<label class="lbl">Conjuntos (carimbos)</label><div class="presets">${E.conj.map(c => `<button data-cj="${esc(c.id)}">${esc(c.nome)} <small>${c.w}×${c.h}</small></button>`).join('')}</div>`; } }
    else if (a === 'camadas') { $('#pnT').textContent = 'Camadas';
      const L = Ferr.tiles(m), cima = L.filter(c => Ferr.ehAcima(c)).reverse(), baixo = L.filter(c => !Ferr.ehAcima(c)).reverse();
      const fixa = (k, n, sub) => `<div class="cam ${E.ativa === k ? 'on' : ''}"><button class="nm" data-at="${k}">${n}<br><small class="mudo">${sub}</small></button><button class="ib" data-vi="${k}" aria-label="Mostrar/esconder">${visivel(k) ? '👁' : '◌'}</button><button class="ib" data-tv="${k}" aria-label="Bloquear">${travada(k) ? '🔒' : '🔓'}</button></div>`;
      const tl = c => `<div class="cam ${E.ativa === c.n ? 'on' : ''}"><button class="nm" data-at="${esc(c.n)}">${esc(Ferr.nomeCamada(c))}<br><small class="mudo">${c.d.length} tile(s)</small></button><button class="ib" data-vi="${esc(c.n)}" aria-label="Mostrar/esconder">${visivel(c.n) ? '👁' : '◌'}</button><button class="ib" data-tv="${esc(c.n)}" aria-label="Bloquear">${travada(c.n) ? '🔒' : '🔓'}</button>${so ? '' : `<button class="ib" data-mais="${esc(c.n)}" aria-label="Mais opções">⋯</button>`}</div>`;
      h = '<p class="mudo">A lista mostra o que fica <b>na frente</b> (em cima) e <b>atrás</b> (embaixo). Toque no nome para pintar nela. 👁 mostra/esconde no editor · 🔒 impede mexer sem querer · ⋯ subir, descer, renomear, excluir.</p>' +
        fixa('regioes', 'Regiões', m.areas.length + ' área(s) de mobs') + fixa('colisao', '🚧 Colisão', 'onde não dá para passar') +
        '<div class="cam sep">▲ na frente do personagem</div>' + cima.map(tl).join('') + fixa('objetos', '🏠 Objetos e spritesheets', m.objetos.length + ' objeto(s) · o personagem passa na frente ou atrás') + '<div class="cam sep">▼ por baixo do personagem</div>' + baixo.map(tl).join('') + fixa('terreno', '🌿 Terreno do jogo', 'grama, rua, água (base do mapa)') +
        (so ? '' : '<button class="btn" id="cNova" style="margin-top:8px">+ Camada de tiles</button>'); }
    else if (a === 'objeto') { $('#pnT').textContent = 'Objeto';
      const o = E.objSel; if (!o || m.objetos.indexOf(o) < 0) h = '<p class="mudo">Nenhum objeto escolhido. Na camada Objetos, use ⬚ Seleção (ou ✋ Mover) e toque num objeto.</p>';
      else { const i = R.info(J, o.k), q = Ferr.objOp(o), e = q.e || 1, cel = celulasObj(o), ns = Ferr.objNs(o), dis = so || q.tv ? 'disabled' : '';
        h = `<div class="prob ok"><b>${esc(nomeObj(o.k))}</b> <small class="mudo">${esc(o.k)}</small><br>${i ? (i.tipo === 'rc' ? 'Recorte do arquivo: ' : 'Imagem: ') + i.sw + '×' + i.sh + ' px · No mapa: ' + Math.round(i.dw) + '×' + Math.round(i.dh) + (e !== 1 ? ' · Com a escala: ' + Math.round(i.dw * e) + '×' + Math.round(i.dh * e) : '') : 'Imagem não encontrada'} · Colisão: ${ns ? 'nenhuma' : cel.length + ' tile(s)'}${q.tv ? ' · <b>bloqueado</b>' : ''}</div>
          <div class="grade2"><div><label class="lbl">X (tiles)</label><input id="obX" type="number" step="0.5" value="${o.x}" ${dis}></div><div><label class="lbl">Y da base (tiles)</label><input id="obY" type="number" step="0.5" value="${o.y}" ${dis}></div></div>
          <label class="lbl" style="margin-top:8px">Escala no mapa (%) — não muda o arquivo nem a colisão</label><div class="linha"><input id="obE" type="number" min="10" max="800" value="${Math.round(e * 100)}" ${dis}><button class="btn peq" id="obE1" ${dis}>100%</button></div>
          <label class="lbl" style="margin-top:8px">Giro (graus) — a colisão não gira junto</label><div class="linha"><input id="obR" type="number" min="-360" max="360" step="5" value="${q.r || 0}" ${dis}><button class="btn peq" id="obR0" ${dis}>0°</button></div>
          <label class="lbl" style="margin-top:8px">Ordem de desenho</label><select id="obZ" ${dis}><option value="" ${!q.z ? 'selected' : ''}>Automática (pela base: o personagem passa na frente ou atrás)</option><option value="chao" ${q.z === 'chao' ? 'selected' : ''}>Sempre no chão (por baixo de tudo)</option><option value="acima" ${q.z === 'acima' ? 'selected' : ''}>Sempre por cima do personagem</option></select>
          <label class="lbl" style="margin-top:8px">Ajuste fino da ordem (px; positivo = mais para a frente)</label><input id="obB" type="number" min="-1024" max="1024" value="${q.b || 0}" ${dis}>
          <label class="chk"><input type="checkbox" id="obNs" ${ns ? 'checked' : ''} ${dis}> Sem colisão (o personagem atravessa)</label>
          <div class="linha"><button class="btn peq" id="obCol" ${dis}>Editar colisão no mapa</button><button class="btn peq" id="obColP" ${dis}>Colisão padrão</button></div>
          <label class="chk"><input type="checkbox" id="obTv" ${q.tv ? 'checked' : ''} ${so ? 'disabled' : ''}> Bloquear (não move nem apaga sem querer)</label>
          ${i && i.tipo === 'rc' ? '<button class="btn" id="obRec" style="width:100%">Tamanho no mapa, âncora e parte da frente: editar o recorte na biblioteca</button>' : ''}
          <div class="linha" style="margin-top:8px"><button class="btn" id="obDup" ${so ? 'disabled' : ''}>Duplicar</button><button class="btn perigo" id="obDel" ${dis}>Excluir</button></div>`; } }
    else if (a === 'prop') { $('#pnT').textContent = 'Propriedades';
      h = `<div class="campo"><label class="lbl">Nome</label><input id="pNome" maxlength="40" value="${esc(m.nome)}" ${so ? 'disabled' : ''}></div>
        <div class="campo"><label class="lbl">Identificador</label><input value="${esc(m.id)}" disabled></div>
        <div class="campo"><label class="lbl">Tamanho</label><div class="linha"><b class="cresce">${m.W} × ${m.H} tiles (${m.W * T}×${m.H * T} px)</b><button class="btn peq" id="pRed" ${so ? 'disabled' : ''}>Redimensionar…</button></div></div>
        <div class="grade2"><div><label class="lbl">Tema</label><select id="pTema" ${so ? 'disabled' : ''}><option value="folha" ${m.tema === 'folha' ? 'selected' : ''}>Folha</option><option value="areia" ${m.tema === 'areia' ? 'selected' : ''}>Areia</option><option value="vazio" ${m.tema === 'vazio' ? 'selected' : ''}>Sem fundo (preto)</option></select></div>
        <div><label class="lbl">Tile da arte (px)</label><input id="pTile" type="number" min="4" max="512" value="${(m.ed && m.ed.tile) || 32}" ${so ? 'disabled' : ''}></div></div>
        <label class="lbl">Ponto de nascimento (tiles)</label><div class="linha"><input id="pSx" type="number" step="0.5" value="${m.spawn[0]}" ${so ? 'disabled' : ''}><input id="pSy" type="number" step="0.5" value="${m.spawn[1]}" ${so ? 'disabled' : ''}><button class="btn peq" id="pSt" ${so ? 'disabled' : ''}>Tocar no mapa</button></div>
        <label class="lbl" style="margin-top:10px">Chefe (tiles)</label><div class="linha">${m.boss ? `<input id="pBx" type="number" step="0.5" value="${m.boss[0]}" ${so ? 'disabled' : ''}><input id="pBy" type="number" step="0.5" value="${m.boss[1]}" ${so ? 'disabled' : ''}>` : '<span class="mudo cresce">Sem chefe</span>'}<button class="btn peq" id="pBt" ${so ? 'disabled' : ''}>Tocar no mapa</button>${m.boss ? `<button class="btn peq perigo" id="pBn" ${so ? 'disabled' : ''}>Tirar</button>` : ''}</div>
        <div class="campo" style="margin-top:14px"><button class="btn" id="pCop" ${so ? 'disabled' : ''}>Cópias de segurança…</button></div>`; }
    else if (a === 'conferir') { $('#pnT').textContent = 'Conferir';
      const pr = Mo.conferir(m, R.cat(J), window.MR.compilar, libSets()); let f = 0; for (const o of m.objetos) if (R.IMG[o.k] && R.IMG[o.k].falhou) f++;
      for (const t of m.tilesets) if (R.TSI[t] && R.TSI[t].falhou) pr.push({ nivel: 'erro', msg: 'Não consegui baixar a imagem do tileset ' + t + '.' });
      if (f) pr.push({ nivel: 'aviso', msg: f + ' objeto(s) com imagem que não carregou.' });
      h = (pr.length ? pr.map(p => `<div class="prob ${p.nivel}">${esc(p.msg)}</div>`).join('') : '<div class="prob ok">Nada a corrigir.</div>') +
        `<p class="mudo">${m.objetos.length} objetos · ${m.areas.length} áreas de mobs · ${m.tilesets.length} tileset(s) · nascimento (${m.spawn.join(', ')})</p>`; }
    C.innerHTML = h; mostraPick();
    if (a === 'mapa') { C.querySelectorAll('[data-gp]').forEach(b => b.onclick = () => { E.gradePasso = +b.dataset.gp; painel('mapa'); desenhar(); }); $('#mCol').onchange = e => marcaEd('vis', 'colisao', e.target.checked); }
    if (a === 'pintura') {
      C.querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { E.contorno = b.dataset.ct === '1'; painel('pintura'); });
      C.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { E.tinta.terreno = +b.dataset.tr; if (E.ferr === 'mover' || E.ferr === 'sel') ferramenta('pincel'); painel('pintura'); });
      C.querySelectorAll('[data-cv]').forEach(b => b.onclick = () => { E.tinta.col = +b.dataset.cv; if (E.ferr === 'mover' || E.ferr === 'sel') ferramenta('pincel'); painel('pintura'); });
      C.querySelectorAll('[data-ca]').forEach(b => b.onclick = () => { E.catAba = b.dataset.ca; painel('pintura'); });
      C.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { const v = b.dataset.op; ativar(v); if (v === 'objetos' && !['pincel', 'sel', 'borracha', 'mover'].includes(E.ferr)) ferramenta('pincel'); });
      C.querySelectorAll('[data-om]').forEach(b => b.onclick = () => { E.objModo = b.dataset.om; painel('pintura'); });
      if ($('#irObj')) $('#irObj').onclick = () => { ativar('objetos'); E.catAba = 'bib'; if (!['pincel', 'sel', 'borracha'].includes(E.ferr)) ferramenta('pincel'); painel('pintura'); };
      if ($('#obBusca')) { $('#obBusca').oninput = e => { E.busca = e.target.value; clearTimeout(E.bT); E.bT = setTimeout(() => { painel('pintura'); const x = $('#obBusca'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 350); };
        $('#obEnc').onchange = e => { E.encaixarObj = e.target.checked; }; $('#obIma').onchange = e => { E.imaObj = e.target.checked; };
        C.querySelectorAll('[data-ob]').forEach(b => { miniatura(b.querySelector('canvas'), b.dataset.ob); b.onclick = () => { E.tinta.obj = b.dataset.ob; if (E.ferr !== 'pincel') ferramenta('pincel'); painel('pintura'); }; }); }
      C.querySelectorAll('[data-cj]').forEach(b => b.onclick = () => { const c = E.conj.find(x => x.id === b.dataset.cj); if (!c) return; E.colarClip = c.dados; ferramenta('colar'); toast('Carimbo “' + c.nome + '”: toque no mapa'); }); }
    if (a === 'objeto' && E.objSel && m.objetos.indexOf(E.objSel) >= 0) { const o = E.objSel, re = () => painel('objeto');
      const num = (id, fn) => { const el = $(id); if (el) el.onchange = e => { const v = +e.target.value; if (!Number.isFinite(v)) return re(); mudaObj(x => fn(x, v)); re(); }; };
      num('#obX', (x, v) => { x.x = clamp(v, 0, m.W - .01); }); num('#obY', (x, v) => { x.y = clamp(v, .03, m.H); });
      num('#obE', (x, v) => { const q = Object.assign({}, Ferr.objOp(x)); const e = clamp(v, 10, 800) / 100; if (e === 1) delete q.e; else q.e = e; Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); });
      num('#obB', (x, v) => { const q = Object.assign({}, Ferr.objOp(x)); const b = clamp(Math.round(v), -1024, 1024); if (b) q.b = b; else delete q.b; Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); });
      num('#obR', (x, v) => { const q = Object.assign({}, Ferr.objOp(x)), r = +((((v % 360) + 360) % 360).toFixed(1)); if (r) q.r = r; else delete q.r; Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); });
      if ($('#obR0')) $('#obR0').onclick = () => { mudaObj(x => { const q = Object.assign({}, Ferr.objOp(x)); delete q.r; Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); }); re(); };
      if ($('#obE1')) $('#obE1').onclick = () => { mudaObj(x => { const q = Object.assign({}, Ferr.objOp(x)); delete q.e; Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); }); re(); };
      if ($('#obZ')) $('#obZ').onchange = e => { mudaObj(x => { const q = Object.assign({}, Ferr.objOp(x)); if (e.target.value) q.z = e.target.value; else delete q.z; Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); }); re(); };
      if ($('#obNs')) $('#obNs').onchange = e => { mudaObj(x => { Ferr.objF(x, e.target.checked, e.target.checked ? null : Ferr.objCel(x), Ferr.objOp(x)); }); re(); };
      if ($('#obCol')) $('#obCol').onclick = () => { fecharPainel(); acaoObj('col'); };
      if ($('#obColP')) $('#obColP').onclick = () => { mudaObj(x => { const rc = R.RC[x.k]; Ferr.objF(x, rc ? rc.ns : 0, rc && !rc.ns ? rc.col : null, Ferr.objOp(x)); }); re(); };
      if ($('#obTv')) $('#obTv').onchange = () => { acaoObj('tv'); re(); };
      if ($('#obDup')) $('#obDup').onclick = () => { acaoObj('dup'); re(); }; if ($('#obDel')) $('#obDel').onclick = () => { acaoObj('del'); };
      if ($('#obRec')) $('#obRec').onclick = () => { const rc = R.RC[o.k]; if (rc && window.BIB) { window.BIB.api.telaBib('editor'); window.BIB.api.abrirRecurso(rc.rec); } }; }
    if (a === 'camadas') {
      C.querySelectorAll('[data-at]').forEach(b => b.onclick = () => ativar(b.dataset.at));
      C.querySelectorAll('[data-vi]').forEach(b => b.onclick = () => { marcaEd('vis', b.dataset.vi, !visivel(b.dataset.vi)); painel('camadas'); });
      C.querySelectorAll('[data-tv]').forEach(b => b.onclick = () => { marcaEd('trava', b.dataset.tv, !travada(b.dataset.tv)); painel('camadas'); });
      const acCam = {
        up: n => mudar(x => Ferr.moverCamada(x, n, 1), 'tiles'),
        dn: n => mudar(x => Ferr.moverCamada(x, n, -1), 'tiles'),
        rn: async n => { const c = Ferr.camada(m, n); const v = await dlg('Renomear camada', `<input id="rcN" maxlength="30" value="${esc(Ferr.nomeCamada(c))}">`, [{ t: 'OK', v: 1, c: 'pri', antes: () => !!$('#rcN').value.trim() }, { t: 'Cancelar', v: 0 }]);
          if (v) { const nm = $('#rcN').value.trim().slice(0, 30); mudar(x => { Ferr.camada(x, n).nome = nm; }, 'nada'); $('#fCamN').textContent = nomeAtiva(); } },
        rm: async n => { const c = Ferr.camada(m, n); const v = await dlg('Excluir camada?', `<p>Excluir <b>${esc(Ferr.nomeCamada(c))}</b>${c.d.length ? ' e os ' + c.d.length + ' tile(s) dela' : ''}? Dá para desfazer (↶).</p>`, [{ t: 'Excluir', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]);
          if (v) { mudar(x => { x.camadas = x.camadas.filter(k => !(k && k.t === 'tiles' && k.n === n)); if (Ferr.PADRAO.some(p => p.n === n)) Ferr.camada(x, n) || x.camadas.push({ n, t: 'tiles', d: [], z: n === 'acima' ? 'acima' : 'baixo', nome: Ferr.nomeCamada(c) }); }, 'tiles'); if (E.ativa === n && !Ferr.camada(E.m, E.ativa)) ativar('chao'); } } };
      C.querySelectorAll('[data-mais]').forEach(b => b.onclick = async () => { const n = b.dataset.mais, c = Ferr.camada(m, n); if (!c) return;
        const v = await dlg(Ferr.nomeCamada(c), `<p class="mudo">${c.d.length} tile(s) · ${Ferr.ehAcima(c) ? 'na frente do personagem' : 'por baixo do personagem'}. Subir/descer passando pelos objetos troca o lado.</p>`,
          [{ t: '▲ Subir (mais para a frente)', v: 'up' }, { t: '▼ Descer (mais para trás)', v: 'dn' }, { t: '✎ Renomear', v: 'rn' }, { t: '🗑 Excluir', v: 'rm', c: 'perigo' }, { t: 'Fechar', v: 0 }]);
        if (v && acCam[v]) acCam[v](n); });
      if ($('#cNova')) $('#cNova').onclick = async () => { const v = await dlg('Nova camada de tiles', '<label class="lbl">Nome</label><input id="ncN" maxlength="30" placeholder="Ex.: Telhados"><div class="presets" style="margin-top:8px"><button data-nz="baixo" aria-pressed="true">Por baixo do personagem</button><button data-nz="acima" aria-pressed="false">Por cima do personagem</button></div>',
          [{ t: 'Criar', v: 1, c: 'pri', antes: () => !!$('#ncN').value.trim() }, { t: 'Cancelar', v: 0 }], c => c.querySelectorAll('[data-nz]').forEach(x => x.onclick = () => c.querySelectorAll('[data-nz]').forEach(y => y.setAttribute('aria-pressed', y === x))));
        if (!v) return; const nome = $('#ncN').value.trim(), z = $('[data-nz="acima"]').getAttribute('aria-pressed') === 'true' ? 'acima' : 'baixo'; let n; mudar(x => { n = Ferr.novaCamada(x, nome, z).n; }, 'tiles'); ativar(n); }; }
    if (a === 'prop' && !so) {
      $('#pNome').onchange = e => { const v = e.target.value.trim().slice(0, 40); if (v && v !== m.nome) mudar(x => { x.nome = v; x.tem.title = true; }, 'nada'); };
      $('#pTema').onchange = e => mudar(x => { x.tema = e.target.value; }, 'chao');
      $('#pTile').onchange = e => { const v = clamp(+e.target.value | 0, 4, 512); mudar(x => { x.ed = Object.assign({}, x.ed, { tile: v }); }, 'nada'); };
      const pnt = (k, ix, iy) => () => { const x = +$(ix).value, y = +$(iy).value; if (!(x >= 2 && x <= m.W - 2 && y >= 2 && y <= m.H - 2)) { toast('Fora do mapa (2 a ' + (m.W - 2) + ', 2 a ' + (m.H - 2) + ')'); painel('prop'); return; } mudar(q => { q[k] = [x, y]; if (k === 'boss') q.tem.boss = true; }, 'nada'); };
      $('#pSx').onchange = $('#pSy').onchange = pnt('spawn', '#pSx', '#pSy');
      if (m.boss) { $('#pBx').onchange = $('#pBy').onchange = pnt('boss', '#pBx', '#pBy'); $('#pBn').onclick = () => mudar(q => { q.boss = null; }, 'nada'); }
      $('#pSt').onclick = () => modo('spawn'); $('#pBt').onclick = () => modo('boss');
      $('#pRed').onclick = redimensionar; $('#pCop').onclick = copiasSeg; } }
  function modo(k) { E.modo = k; const a = $('#modoAviso'); a.hidden = !k; if (k) { a.innerHTML = '<span>Toque no mapa para pôr o ' + (k === 'spawn' ? 'nascimento' : 'chefe') + '</span><button class="btn peq">Cancelar</button>'; a.querySelector('button').onclick = () => modo(null); } }

  async function copiasSeg() {
    const L = await P.copias(E.m.id); if (!L.length) return aviso('Cópias de segurança', 'Ainda não há cópias: elas são feitas a cada salvamento (ficam as 5 últimas).');
    const v = await dlg('Cópias de segurança', '<p class="mudo">Restaurar troca o mapa aberto pela cópia (dá para desfazer).</p>', L.map((c, i) => ({ t: hora(c.em) + ' · ' + c.r.W + '×' + c.r.H, v: 'c' + i })).concat([{ t: 'Cancelar', v: null }]));
    if (!v) return; const c = L[+v.slice(1)]; try { const m = Mo.deJogo(c.r.mapa, c.r.id); m.nome = c.r.nome; trocar(m); toast('Cópia restaurada (não esqueça de salvar)'); } catch (e) { aviso('Cópia com problema', esc(e.message)); } }

  async function redimensionar() {
    const m = E.m; let ax = 0, ay = 0;
    const tsInfo = {}; for (const t of E.lib.tilesets) tsInfo[t.id] = { tw: t.tw, th: t.th };
    const html = `<div class="grade2"><div><label class="lbl">Largura</label><input id="rdW" type="number" value="${m.W}"></div><div><label class="lbl">Altura</label><input id="rdH" type="number" value="${m.H}"></div></div>
      <label class="lbl" style="margin-top:10px">Onde fica o mapa atual (âncora)</label><div class="ancora">${[0, .5, 1].map(y => [0, .5, 1].map(x => `<button data-a="${x},${y}" aria-pressed="${x === 0 && y === 0}">${['↖', '↑', '↗', '←', '•', '→', '↙', '↓', '↘'][y * 6 + x * 2]}</button>`).join('')).join('')}</div>
      <p class="mudo">Ao ampliar, a área nova recebe o terreno inicial. Os deslocamentos são em passos de 2 tiles (água e pontes ficam em blocos de 2×2).</p><div id="rdRes"></div>`;
    let res = null;
    const calc = () => { const W = +$('#rdW').value, H = +$('#rdH').value; res = Mo.redimensionar(m, W, H, ax, ay, tsInfo); const el = $('#rdRes');
      if (res.erro) { el.innerHTML = '<p class="status err">' + esc(res.erro) + '</p>'; return; }
      const L = Mo.perdasTexto(res.perdas); el.innerHTML = '<p class="mudo">Novo tamanho: ' + W + '×' + H + ' (~' + Mo.memMB(W, H) + ' MB por camada).</p>' + (L.length ? '<p class="aviso"><b>Atenção, vai remover/alterar:</b></p><ul class="perdas">' + L.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' : '<p class="status ok">Nada será perdido.</p>'); };
    const v = await dlg('Redimensionar', html, [{ t: 'Aplicar', v: 1, c: 'pri', antes: () => !!(res && !res.erro && (res.mapa.W !== m.W || res.mapa.H !== m.H || res.perdas.dx || res.perdas.dy)) }, { t: 'Cancelar', v: 0 }], c => {
      c.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { [ax, ay] = b.dataset.a.split(',').map(Number); c.querySelectorAll('[data-a]').forEach(x => x.setAttribute('aria-pressed', x === b)); calc(); });
      $('#rdW').oninput = $('#rdH').oninput = calc; calc(); });
    if (!v || !res || res.erro) return;
    const L = Mo.perdasTexto(res.perdas);
    if (L.length) { const ok = await dlg('Confirmar redução', '<p>Isto vai remover conteúdo do mapa:</p><ul class="perdas">' + L.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul><p class="mudo">Dá para desfazer (↶) enquanto o mapa estiver aberto.</p>', [{ t: 'Redimensionar mesmo assim', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]); if (!ok) return; }
    res.mapa.nome = m.nome; trocar(res.mapa); topo(); ajustar(); toast('Mapa agora tem ' + res.mapa.W + '×' + res.mapa.H); }

  /* ---------- desenho e toque ---------- */
  const cv = $('#cv'), ctx = cv.getContext('2d'); let raf = 0, dpr = 1;
  let ult = null; // tamanho anterior: quando um painel abre/fecha, o centro da visão continua no mesmo lugar
  function tamanhoCv() { const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); if (ult && r.width && r.height) { E.ox += (r.width - ult.w) / 2; E.oy += (r.height - ult.h) / 2; } if (r.width && r.height) ult = { w: r.width, h: r.height }; cv.width = Math.max(1, r.width * dpr | 0); cv.height = Math.max(1, r.height * dpr | 0); desenhar(); }
  window.addEventListener('resize', () => { if (E.m) tamanhoCv(); });
  function ajusta() { $('#zVal').textContent = Math.round(E.s * 100) + '%'; }
  function ajustar() { if (!E.m) return; const r = cv.getBoundingClientRect(), W = E.m.W * T, H = E.m.H * T; E.s = clamp(Math.min(r.width / W, r.height / H) * .96, .05, 4); E.ox = (r.width - W * E.s) / 2; E.oy = (r.height - H * E.s) / 2; ajusta(); desenhar(); }
  function zoomEm(px, py, ns) { ns = clamp(ns, .05, 4); const wx = (px - E.ox) / E.s, wy = (py - E.oy) / E.s; E.s = ns; E.ox = px - wx * ns; E.oy = py - wy * ns; ajusta(); desenhar(); }
  function desenhar() { if (!raf) raf = requestAnimationFrame(pinta); }
  const camCv = c => { E.cache.cam = E.cache.cam || {}; if (!(c.n in E.cache.cam)) E.cache.cam[c.n] = R.camadaCv(E.m, c); return E.cache.cam[c.n]; };
  function pinta() { raf = 0; const m = E.m; if (!m) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(E.s * dpr, 0, 0, E.s * dpr, E.ox * dpr, E.oy * dpr); ctx.imageSmoothingEnabled = false;
    if (!E.cache.chao) E.cache.chao = R.chao(m);
    const r = cv.getBoundingClientRect(), vis = { x0: -E.ox / E.s, y0: -E.oy / E.s, x1: (r.width - E.ox) / E.s, y1: (r.height - E.oy) / E.s }, L = Ferr.tiles(m);
    if (visivel('terreno')) ctx.drawImage(E.cache.chao, 0, 0); else { ctx.fillStyle = '#20242b'; ctx.fillRect(0, 0, m.W * T, m.H * T); }
    for (const c of L) if (!Ferr.ehAcima(c) && visivel(c.n)) { const k = camCv(c); if (k) ctx.drawImage(k, 0, 0); }
    if (visivel('objetos')) R.objetos(ctx, J, m, vis);
    for (const c of L) if (Ferr.ehAcima(c) && visivel(c.n)) { const k = camCv(c); if (k) ctx.drawImage(k, 0, 0); }
    if (visivel('colisao')) { if (!E.cache.M) { try { E.cache.M = window.MR.compilar(Mo.paraJogo(m, true), R.cat(J)).M; } catch (e) { E.cache.M = ''; } } if (E.cache.M) R.colisao(ctx, m, E.cache.M); }
    const gp = E.gradePasso; if (gp && E.s * gp >= 5) R.grade(ctx, m, E.s, gp);
    R.borda(ctx, m, E.s);
    if (visivel('regioes')) R.areas(ctx, m, E.s);
    if (E.ver.marcas) { R.marcador(ctx, m.spawn, E.s, '#2f8cff', 'N'); R.marcador(ctx, m.boss, E.s, '#d23c3c', 'C'); }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2 / E.s; ctx.strokeRect(0, 0, m.W * T, m.H * T);
    previa(); }

  /* ---------- camadas: visível / bloqueada (ficam no mapa, em ed) ---------- */
  const PADV = { colisao: false };
  const visivel = k => { const v = E.m && E.m.ed && E.m.ed.vis; return v && k in v ? !!v[k] : PADV[k] !== false; };
  const travada = k => !!(E.m && E.m.ed && E.m.ed.trava && E.m.ed.trava[k]);
  function marcaEd(campo, k, v) { E.m.ed = Object.assign({}, E.m.ed); E.m.ed[campo] = Object.assign({}, E.m.ed[campo], { [k]: v }); E.sujo = true; topo(); emerg(); desenhar(); }
  const FIXAS = { terreno: 'Terreno do jogo', colisao: 'Colisão', objetos: 'Objetos e spritesheets', regioes: 'Regiões' };
  // botões “Onde pintar”: fixas + camadas de tiles (padrão e criadas), na ordem em que se pensa no mapa
  function ondes() { const m = E.m, L = [['terreno', '🌿 Terreno do jogo', 'grama, rua, água']], cs = Ferr.tiles(m);
    const desc = { chao: ['🟫 Piso (tiles)', 'chão com tiles da biblioteca'], detalhes: ['🪨 Detalhes do piso', 'pedras, tapetes, sobre o piso'], acima: ['☁️ Tiles por cima', 'telhado, copa: na frente do personagem'] };
    L.push(['chao', ...desc.chao], ['detalhes', ...desc.detalhes]);
    for (const c of cs) if (!Ferr.PADRAO.some(p => p.n === c.n) && !Ferr.ehAcima(c)) L.push([c.n, '🧩 ' + esc(Ferr.nomeCamada(c)), 'tiles, por baixo do personagem']);
    L.push(['objetos', '🏠 Objetos e spritesheets', 'casas, árvores, recortes']);
    L.push(['acima', ...desc.acima]);
    for (const c of cs) if (!Ferr.PADRAO.some(p => p.n === c.n) && Ferr.ehAcima(c)) L.push([c.n, '🧩 ' + esc(Ferr.nomeCamada(c)), 'tiles, por cima do personagem']);
    L.push(['colisao', '🚧 Colisão', 'onde não dá para passar']); return L; }
  function nomeAtiva() { const c = Ferr.camada(E.m, E.ativa); return FIXAS[E.ativa] || (c ? Ferr.nomeCamada(c) : E.ativa); }
  function camadaAtiva() { if (FIXAS[E.ativa]) return null; let c = Ferr.camada(E.m, E.ativa); if (!c && Ferr.PADRAO.some(p => p.n === E.ativa)) { Ferr.padrao(E.m); c = Ferr.camada(E.m, E.ativa); } return c; }
  function ativar(k) { if (k !== 'objetos' && E.objSel) selObj(null); E.ativa = k; $('#fCamN').textContent = nomeAtiva(); if (E.aba === 'camadas' || E.aba === 'pintura') painel(E.aba); }

  /* ---------- biblioteca de tilesets (antigos t_ + recursos r_ com grade) ---------- */
  // recortes marcados como Chão viram um “tileset de 1 tile” (id recurso__recorte; o servidor faz o mesmo): pincel/balde na camada Piso
  function pisos(rc) { const L = []; for (const r of rc || []) for (const c of r.recortes || []) { const id = r.id + '__' + c.id; if (c.uso !== 'chao' || !/^r_[a-z0-9_]{2,40}$/.test(id)) continue;
      L.push({ id, piso: 1, nome: '🟫 ' + (c.nome || c.id) + ' (' + r.nome + ')', arquivo: r.arquivo, w: r.w, h: r.h, tw: c.w, th: c.h, dw: c.dw || c.w, dh: c.dh || c.h, mg: c.x, my: c.y, sp: 0, k: r.id + '.' + c.id }); } return L; }
  function libTs() { const L = []; for (const t of E.lib.tilesets) L.push({ id: t.id, nome: t.nome, tw: t.tw, th: t.th, dw: t.tw, dh: t.th, mg: t.mg || 0, my: t.mg || 0, sp: t.sp || 0, w: t.w, h: t.h });
    for (const r of E.lib.recursos || []) if (r.grade && r.grade.tw > 0) L.push({ id: r.id, nome: r.nome, tw: r.grade.tw, th: r.grade.th, dw: r.grade.dw || r.grade.tw, dh: r.grade.dh || r.grade.th, mg: r.grade.mg || 0, my: r.grade.my != null ? r.grade.my : (r.grade.mg || 0), sp: r.grade.sp || 0, w: r.w, h: r.h }); return L.concat(pisos(E.lib.recursos)); }
  function tsInfo() { const o = {}; for (const t of libTs()) o[t.id] = { tw: t.dw, th: t.dh }; return o; } // tamanho de cada tile NO MAPA (a grade de pintura)

  /* ---------- ferramentas ---------- */
  function ferramenta(f) {
    // balde/retângulo com um recorte de chão escolhido: pinta como piso (camada Piso), já que objeto não tem balde
    if ((f === 'balde' || f === 'ret') && E.ativa === 'objetos' && E.tinta.obj && E.lib) { const p = pisos(E.lib.recursos).find(x => x.k === E.tinta.obj);
      if (p) { E.ativa = 'chao'; E.pkId = p.id; $('#fCamN').textContent = nomeAtiva(); escolheTile(p, 0, 0, 0, 0); if (E.aba === 'pintura') painel('pintura'); toast((f === 'balde' ? 'Balde' : 'Retângulo') + ': pintando “' + (R.RC[p.k] || {}).nome + '” na camada Piso'); }
      else if (R.RC[E.tinta.obj]) toast('Para usar o balde, marque este recorte como 🟫 Chão (Biblioteca → recurso → Recortes)'); }
    E.ferr = f; document.querySelectorAll('[data-f]').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f)); if (f !== 'sel') E.sel = null; barraSel(); desenhar(); }
  const mundo = p => ({ x: (p.x - E.ox) / E.s, y: (p.y - E.oy) / E.s });
  const cel = w => [Math.floor(w.x / T), Math.floor(w.y / T)];
  const opSel = () => { const tod = E.selTodas !== false, L = Ferr.tiles(E.m).map(c => c.n).filter(n => !travada(n));
    return tod ? { terreno: !travada('terreno'), colisao: !travada('colisao'), objetos: !travada('objetos'), camadas: L } : { terreno: E.ativa === 'terreno', colisao: E.ativa === 'colisao', objetos: E.ativa === 'objetos', camadas: FIXAS[E.ativa] ? [] : [E.ativa] }; };
  function podePintar() { const k = E.ativa;
    if (E.reg.base) { toast('Mapa do jogo: duplique para editar'); return false; }
    if (E.ferr === 'sel' || E.ferr === 'colar') return true;
    if (k === 'regioes') { toast('Regiões: ferramentas na Fase 5'); return false; }
    if (k === 'objetos') { if (travada(k)) { toast('Camada Objetos está bloqueada'); return false; } if (E.ferr === 'balde' || E.ferr === 'ret') { toast('Para objetos use ✏️ Pincel, 🧽 Borracha ou ⬚ Seleção'); return false; }
      if (E.ferr === 'pincel' && !E.tinta.obj) { toast('Escolha um objeto na aba Pintura'); abrirAba('pintura'); return false; } return true; }
    if (travada(k)) { toast('Camada “' + nomeAtiva() + '” está bloqueada'); return false; }
    if (!visivel(k) && k !== 'colisao') { toast('Camada escondida: mostre antes de pintar'); return false; }
    if (!FIXAS[k] && E.ferr !== 'borracha' && !E.tinta.tile) { toast('Escolha um tile na aba Pintura'); abrirAba('pintura'); return false; }
    if (!FIXAS[k] && E.tinta.tile && !tsInfo()[E.tinta.tile.id]) { toast('Tileset não encontrado na biblioteca'); return false; }
    return true; }
  // aplica no ponto w (pixels do mapa); devolve true se mudou
  function pontoPinta(w, apagar) { const m = E.m, k = E.ativa;
    if (k === 'terreno') { const [x, y] = cel(w), t = apagar ? ((m.ed && Mo.INICIAIS.includes(m.ed.terreno)) ? m.ed.terreno : 0) : E.tinta.terreno, r = Ferr.terreno(m, x, y, t); if (r) { R.chaoParcial(E.cache.chao || (E.cache.chao = R.chao(m)), m, r[0], r[1], r[2], r[3]); E.cache.M = null; return true; } return false; }
    if (k === 'colisao') { const [x, y] = cel(w); if (Ferr.colisao(m, x, y, apagar ? 0 : E.tinta.col)) { E.cache.M = null; return true; } return false; }
    const c = camadaAtiva(); if (!c) return false;
    if (apagar) { const n = Ferr.apagarPx(m, c, w.x, w.y, tsInfo()); if (n) delete (E.cache.cam || {})[c.n]; return n > 0; }
    const s = E.tinta.tile, inf = tsInfo()[s.id], n = Ferr.carimbo(m, c, s, inf, Math.floor(w.x / inf.tw), Math.floor(w.y / inf.th)); if (n) delete (E.cache.cam || {})[c.n]; return n > 0; }
  function traco(w) { const t = E.traco, a = t.ult, passo = Math.max(4, Math.min(E.ativa === 'terreno' || E.ativa === 'colisao' ? T : (tsInfo()[(E.tinta.tile || {}).id] || { tw: T }).tw, T) / 2), d = Math.hypot(w.x - a.x, w.y - a.y), n = Math.max(1, Math.ceil(d / passo));
    for (let i = 1; i <= n; i++) if (pontoPinta({ x: a.x + (w.x - a.x) * i / n, y: a.y + (w.y - a.y) * i / n }, E.ferr === 'borracha')) t.mudou = true; t.ult = w; }
  function iniFerr(p) { const w = mundo(p); E.mira = w; if (!podePintar()) return null;
    const t = E.traco = { pre: Mo.copia(E.m), mudou: false, a: w, ult: w, f: E.ferr }; t.pre.nome = E.m.nome;
    if (E.ativa === 'objetos') { t.obj = true; if (E.ferr === 'sel') { const L = objetosEm(w); if (L.length) { selObj(L[0], L); if (!Ferr.objOp(L[0]).tv && !travada('objetos')) t.objMov = { o: L[0], x: L[0].x, y: L[0].y, w0: w }; else t.parado = 1; desenhar(); return t; } selObj(null); } else { desenhar(); return t; } }
    if (E.ferr === 'pincel' || E.ferr === 'borracha') { if (pontoPinta(w, E.ferr === 'borracha')) t.mudou = true; }
    else if (E.ferr === 'sel') { const [x, y] = cel(w), s = E.sel; if (s && x >= s.x && y >= s.y && x < s.x + s.w && y < s.y + s.h) { t.mover = { x0: x, y0: y, dx: 0, dy: 0 }; } else { t.selA = [clamp(x, 0, E.m.W - 1), clamp(y, 0, E.m.H - 1)]; E.sel = { x: t.selA[0], y: t.selA[1], w: 1, h: 1 }; barraSel(); } }
    desenhar(); return t; }
  function moveFerr(p) { const t = E.traco; if (!t) return; const w = mundo(p); E.mira = w;
    if (t.obj && t.f !== 'sel') { desenhar(); return; }
    if (t.objMov) { const q = t.objMov, nx = q.x * T + (w.x - q.w0.x), ny = q.y * T + (w.y - q.w0.y); encaixe(q.o, nx, ny, true); t.mudou = q.o.x !== q.x || q.o.y !== q.y; E.cache.M = null; barraObj(); desenhar(); return; }
    if (t.parado) return;
    if (t.f === 'pincel' || t.f === 'borracha') traco(w);
    else if (t.f === 'ret') t.b = w;
    else if (t.f === 'sel') { const [x, y] = cel(w); if (t.mover) { t.mover.dx = x - t.mover.x0; t.mover.dy = y - t.mover.y0; } else if (t.selA) { const a = t.selA, X = clamp(x, 0, E.m.W - 1), Y = clamp(y, 0, E.m.H - 1); E.sel = { x: Math.min(a[0], X), y: Math.min(a[1], Y), w: Math.abs(X - a[0]) + 1, h: Math.abs(Y - a[1]) + 1 }; } }
    desenhar(); }
  function fimFerr(p, moveu) { const t = E.traco; E.traco = null; if (!t) return; const m = E.m, w = mundo(p), ti = tsInfo();
    if (t.obj && t.f === 'pincel') { const o = novoObj(E.tinta.obj, w); E.m.objetos.push(o); t.mudou = true; E.cache.M = null; }
    else if (t.obj && t.f === 'borracha') { if (!moveu) { const L = objetosEm(w).filter(o => !Ferr.objOp(o).tv); if (L.length) { E.m.objetos.splice(E.m.objetos.indexOf(L[0]), 1); t.mudou = true; E.cache.M = null; if (E.objSel === L[0]) selObj(null); } else if (objetosEm(w).length) toast('Objeto bloqueado'); } }
    else if (t.objMov || t.parado) { }
    else if (t.f === 'ret') { const b = t.b || w; if (E.ativa === 'terreno' || E.ativa === 'colisao') { const k = E.ativa, n = Ferr.retGrade(m, cel(t.a), cel(b), E.contorno, (x, y) => k === 'terreno' ? !!Ferr.terreno(m, x, y, E.tinta.terreno) : Ferr.colisao(m, x, y, E.tinta.col)); if (n) { t.mudou = true; E.cache.chao = null; } }
      else { const c = camadaAtiva(), s = E.tinta.tile, inf = ti[s.id]; if (c && Ferr.retTiles(m, c, s, inf, [Math.floor(t.a.x / inf.tw), Math.floor(t.a.y / inf.th)], [Math.floor(b.x / inf.tw), Math.floor(b.y / inf.th)], E.contorno)) { t.mudou = true; delete (E.cache.cam || {})[c.n]; } } }
    else if (t.f === 'balde' && !moveu) { const k = E.ativa, [x, y] = cel(w); let r;
      if (k === 'terreno') { const tt = E.tinta.terreno; r = Ferr.baldeGrade(m, x, y, (a, b) => m.chao[b * m.W + a], (a, b) => !!Ferr.terreno(m, a, b, tt)); E.cache.chao = null; }
      else if (k === 'colisao') r = Ferr.baldeGrade(m, x, y, (a, b) => m.col[b * m.W + a], (a, b) => Ferr.colisao(m, a, b, E.tinta.col));
      else { const c = camadaAtiva(), s = E.tinta.tile, inf = ti[s.id]; r = Ferr.baldeTiles(m, c, s, inf, Math.floor(w.x / inf.tw), Math.floor(w.y / inf.th)); delete (E.cache.cam || {})[c.n]; if (r.cortado) toast('Área muito grande: preenchi só uma parte'); }
      if (r && r.n) t.mudou = true; }
    else if (t.f === 'sel' && t.mover && (t.mover.dx || t.mover.dy)) { const s = E.sel, op = opSel(), clip = Ferr.copiar(m, s, op, ti); Ferr.apagarArea(m, s, op, ti); const r = Ferr.colar(m, clip, s.x + t.mover.dx, s.y + t.mover.dy, op, ti);
      E.sel = { x: clamp(s.x + t.mover.dx, 0, m.W - 1), y: clamp(s.y + t.mover.dy, 0, m.H - 1), w: s.w, h: s.h }; t.mudou = true; E.cache.chao = null; E.cache.cam = {}; avisaPulados(r); }
    else if (t.f === 'sel' && !moveu && !t.selA) { E.sel = null; }
    else if (t.f === 'colar' && E.colarClip) { const [x, y] = cel(w), r = Ferr.colar(m, E.colarClip, x, y, opColar(), ti); if (r.n) { t.mudou = true; E.cache.chao = null; E.cache.cam = {}; } avisaPulados(r); }
    if (t.mudou) { E.des.push(t.pre); if (E.des.length > 80) E.des.shift(); E.ref.length = 0; marcarSujo('nada'); }
    barraSel(); desenhar(); }
  const opColar = () => ({ terreno: !travada('terreno'), colisao: !travada('colisao'), objetos: !travada('objetos'), camadas: null });
  function avisaPulados(r) { if (r && (r.pulados || r.fora)) toast((r.pulados ? r.pulados + ' tile(s) fora da grade do tileset' : '') + (r.pulados && r.fora ? ' · ' : '') + (r.fora ? r.fora + ' fora do mapa' : '')); }
  function cancelaFerr() { const t = E.traco; E.traco = null; if (!t) return; if (t.mudou) { const n = E.m.nome; E.m = t.pre; E.m.nome = n; invalida('tudo'); } desenhar(); }
  // prévia: carimbo sob o dedo, retângulo, seleção, colar
  function previa() { const m = E.m, w = E.mira, t = E.traco, s = E.s; ctx.save(); ctx.lineWidth = 2 / s;
    if (t && t.f === 'ret' && t.b) { const [ax, ay] = cel(t.a), [bx, by] = cel(t.b); let x0, y0, x1, y1, g = T;
      if (!FIXAS[E.ativa] && E.tinta.tile) { const inf = tsInfo()[E.tinta.tile.id]; if (inf) { x0 = Math.floor(Math.min(t.a.x, t.b.x) / inf.tw) * inf.tw; y0 = Math.floor(Math.min(t.a.y, t.b.y) / inf.th) * inf.th; x1 = (Math.floor(Math.max(t.a.x, t.b.x) / inf.tw) + 1) * inf.tw; y1 = (Math.floor(Math.max(t.a.y, t.b.y) / inf.th) + 1) * inf.th; } }
      if (x0 == null) { x0 = Math.min(ax, bx) * g; y0 = Math.min(ay, by) * g; x1 = (Math.max(ax, bx) + 1) * g; y1 = (Math.max(ay, by) + 1) * g; }
      ctx.fillStyle = 'rgba(255,154,60,.25)'; ctx.strokeStyle = '#ff9a3c'; if (!E.contorno) ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.strokeRect(x0, y0, x1 - x0, y1 - y0); }
    if (E.sel) { const q = E.sel, d = t && t.mover ? t.mover : { dx: 0, dy: 0 }; ctx.setLineDash([6 / s, 4 / s]); ctx.strokeStyle = '#ffe04d'; ctx.fillStyle = 'rgba(255,224,77,.12)'; ctx.fillRect((q.x + d.dx) * T, (q.y + d.dy) * T, q.w * T, q.h * T); ctx.strokeRect((q.x + d.dx) * T, (q.y + d.dy) * T, q.w * T, q.h * T); ctx.setLineDash([]); }
    if (E.objSel && m.objetos.indexOf(E.objSel) >= 0) { const o = E.objSel, b = R.caixa(J, o); ctx.setLineDash([5 / s, 4 / s]); ctx.strokeStyle = Ferr.objOp(o).tv ? '#9aa3b2' : '#ff9a3c'; ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.setLineDash([]);
      const bx = Math.floor(o.x), by = Ferr.baseLin(o); ctx.fillStyle = E.colObj === o ? 'rgba(230,40,60,.55)' : 'rgba(230,40,60,.3)'; for (const [dx, dy] of celulasObj(o)) ctx.fillRect((bx + dx) * T, (by + dy) * T, T, T);
      if (E.colObj === o) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1 / s; for (let y = by - 6; y <= by + 3; y++) for (let x = bx - 6; x <= bx + 6; x++) ctx.strokeRect(x * T, y * T, T, T); ctx.lineWidth = 2 / s; }
      ctx.fillStyle = '#2f8cff'; ctx.beginPath(); ctx.arc(o.x * T, o.y * T, 4 / s + 2, 0, 7); ctx.fill();
      if (E.ativa === 'objetos' && !Ferr.objOp(o).tv && !E.reg.base) { const h = alcasObj(o), w2 = p => [(p[0] - E.ox) / s, (p[1] - E.oy) / s], g = w2(h.gira), t2 = w2(h.topo), e2 = w2(h.esc);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 / s; ctx.beginPath(); ctx.moveTo(t2[0], t2[1]); ctx.lineTo(g[0], g[1]); ctx.stroke();
        for (const [pp, txt] of [[g, '⟳'], [e2, '⤡']]) { ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.arc(pp[0], pp[1], 13 / s, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1a1206'; ctx.font = 'bold ' + (15 / s) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, pp[0], pp[1] + 1 / s); } } }
    if (w && E.ativa === 'objetos' && E.ferr === 'pincel' && E.tinta.obj) { const o = novoObj(E.tinta.obj, w), it = R.listaObjetos(J, { objetos: [o] }); ctx.globalAlpha = .65; for (const x of it) x.d(ctx); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(230,40,60,.3)'; for (const [dx, dy] of celulasObj(o)) ctx.fillRect((Math.floor(o.x) + dx) * T, (Ferr.baseLin(o) + dy) * T, T, T); ctx.fillStyle = '#2f8cff'; ctx.beginPath(); ctx.arc(o.x * T, o.y * T, 4 / s + 2, 0, 7); ctx.fill(); }
    else if (w && E.ferr === 'colar' && E.colarClip) { const [x, y] = cel(w), c = E.colarClip; ctx.globalAlpha = .65; desenhaClip(c, x * T, y * T); ctx.globalAlpha = 1; ctx.strokeStyle = '#38d6ff'; ctx.strokeRect(x * T, y * T, c.w * T, c.h * T); }
    else if (w && !t && E.ativa !== 'objetos' && (E.ferr === 'pincel' || E.ferr === 'balde' || E.ferr === 'ret')) { if (!FIXAS[E.ativa] && E.tinta.tile) { const st = E.tinta.tile, inf = tsInfo()[st.id], ts = R.TSI[st.id]; if (inf) { const x = Math.floor(w.x / inf.tw) * inf.tw, y = Math.floor(w.y / inf.th) * inf.th;
        if (ts && ts.ok) { ctx.globalAlpha = .6; ctx.imageSmoothingEnabled = inf.tw < ts.tw; for (let j = 0; j < st.sh; j++) for (let i = 0; i < st.sw; i++) ctx.drawImage(ts.img, ts.mg + (st.c0 + i) * (ts.tw + ts.sp), ts.my + (st.r0 + j) * (ts.th + ts.sp), ts.tw, ts.th, x + i * inf.tw, y + j * inf.th, inf.tw, inf.th); ctx.globalAlpha = 1; }
        ctx.strokeStyle = '#ff9a3c'; ctx.strokeRect(x, y, st.sw * inf.tw, st.sh * inf.th); } }
      else if (E.ativa === 'terreno' || E.ativa === 'colisao') { let [x, y] = cel(w), n = 1; if (E.ativa === 'terreno' && E.tinta.terreno >= 2) { x = x >> 1 << 1; y = y >> 1 << 1; n = 2; } ctx.strokeStyle = '#ff9a3c'; ctx.strokeRect(x * T, y * T, n * T, n * T); } }
    ctx.restore(); }
  function desenhaClip(c, X, Y) { for (const n in c.tiles) for (const e of c.tiles[n].d) { const ts = R.TSI[e[0]]; if (!ts || !ts.ok) continue; ctx.drawImage(ts.img, ts.mg + e[3] * (ts.tw + ts.sp), ts.my + e[4] * (ts.th + ts.sp), ts.tw, ts.th, X + e[1], Y + e[2], ts.dw || ts.tw, ts.dh || ts.th); }
    if (c.objetos) for (const it of R.listaObjetos(J, { objetos: c.objetos.map(a => ({ k: a[0], x: a[1] + X / T, y: a[2] + Y / T, f: a[3] })) })) it.d(ctx);
    if (c.col) { ctx.fillStyle = 'rgba(230,40,60,.35)'; for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) if (c.col[j * c.w + i] === '1') ctx.fillRect(X + i * T, Y + j * T, T, T); } }
  // barra da seleção: copiar, recortar, duplicar, apagar, salvar conjunto
  function barraSel() { const b = $('#selBar'); const on = E.ferr === 'sel' && E.sel && !E.reg.base; b.hidden = !on && !(E.ferr === 'colar');
    $('[data-f="colar"]').hidden = !E.colarClip && !E.clip;
    if (E.ferr === 'colar') { b.innerHTML = `<span class="cresce"><b>Colar</b> · toque no mapa (canto de cima/esquerda). ${E.colarClip ? E.colarClip.w + '×' + E.colarClip.h : ''}</span><button class="btn peq" data-s="parar">✕ Parar</button>`; }
    else if (on) { const q = E.sel; b.innerHTML = `<span class="mudo" style="width:100%">${q.w}×${q.h} tiles em ${q.x}, ${q.y} · arraste dentro para mover</span><button class="btn peq" data-s="copiar">Copiar</button><button class="btn peq" data-s="recortar">Recortar</button><button class="btn peq" data-s="dup">Duplicar</button><button class="btn peq" data-s="apagar">Apagar</button><button class="btn peq" data-s="conj">Salvar conjunto</button><button class="btn peq" data-s="todas" aria-pressed="${E.selTodas !== false}">${E.selTodas !== false ? 'Todas as camadas' : 'Só a camada ativa'}</button><button class="btn peq" data-s="x">✕</button>`; }
    else return;
    b.querySelectorAll('[data-s]').forEach(x => x.onclick = () => acaoSel(x.dataset.s)); }
  function acaoSel(a) { const m = E.m, s = E.sel, ti = tsInfo();
    if (a === 'parar') { E.colarClip = null; return ferramenta('sel'); }
    if (a === 'x') { E.sel = null; barraSel(); return desenhar(); }
    if (a === 'todas') { E.selTodas = E.selTodas === false; return barraSel(); }
    if (!s) return; const op = opSel();
    if (a === 'copiar' || a === 'recortar') { E.clip = Ferr.copiar(m, s, op, ti); if (a === 'recortar') mudar(x => { Ferr.apagarArea(x, s, op, ti); }, 'tudo'); toast((a === 'copiar' ? 'Copiado' : 'Recortado') + ': use 📋 Colar'); E.colarClip = E.clip; barraSel(); return; }
    if (a === 'apagar') { mudar(x => { if (!Ferr.apagarArea(x, s, op, ti)) return false; }, 'tudo') || toast('Nada para apagar'); return; }
    if (a === 'dup') { const clip = Ferr.copiar(m, s, op, ti), nx = s.x + s.w + s.w <= m.W ? s.x + s.w : s.x, ny = nx === s.x ? Math.min(m.H - s.h, s.y + s.h) : s.y; let r;
      mudar(x => { r = Ferr.colar(x, clip, nx, ny, op, ti); }, 'tudo'); E.sel = { x: nx, y: ny, w: s.w, h: s.h }; avisaPulados(r); barraSel(); desenhar(); toast('Duplicado'); return; }
    if (a === 'conj') salvarConjunto(Ferr.copiar(m, s, op, ti)); }
  async function salvarConjunto(clip) { if (!P.sessao()) return aviso('Entre primeiro', 'Conjuntos ficam no servidor: entre com a conta admin na lista de mapas.');
    if (!Object.keys(clip.tiles).length && !clip.terreno && !clip.col) return toast('Seleção vazia');
    const v = await dlg('Salvar conjunto', '<p class="mudo">Fica na biblioteca para usar como carimbo em qualquer mapa (aba Pintura).</p><label class="lbl">Nome</label><input id="cjNome" maxlength="60" placeholder="Ex.: Estrada reta">', [{ t: 'Salvar', v: 1, c: 'pri', antes: () => !!$('#cjNome').value.trim() }, { t: 'Cancelar', v: 0 }]);
    if (!v) return; const nome = $('#cjNome').value.trim().slice(0, 60), usados = new Set(E.conj.map(c => c.id)); let id = 'k_' + (Mo.slug(nome).slice(0, 34) || 'conj'), n = 2; if (id.length < 4) id += '_1'; while (usados.has(id)) id = id.slice(0, 36) + '_' + n++;
    try { await P.api('/rest/v1/mapa_conjuntos', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id, nome, categoria: '', w: clip.w, h: clip.h, dados: clip }) }); toast('Conjunto salvo'); await carregarConj(); }
    catch (e) { aviso('Não consegui salvar', esc(/mapa_conjuntos|PGRST205/.test(e.message + e.code) ? 'O banco ainda não tem os conjuntos: rode o arquivo sql/18_mapa_conjuntos.sql no Supabase.' : P.erroTexto(e))); } }
  async function carregarConj() { if (!P.sessao()) { E.conj = []; return; } try { E.conj = (await P.api('/rest/v1/mapa_conjuntos?select=*&order=nome.asc')) || []; } catch (e) { E.conj = []; } if (E.aba === 'pintura') painel('pintura'); }

  // toque: ✋ Mover = 1 dedo arrasta (ou toca para pôr nascimento/chefe); outras ferramentas usam 1 dedo; 2 dedos = pinça sempre
  const ptr = new Map(); let gesto = null;
  const pt = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (_) { } ptr.set(e.pointerId, pt(e));
    if (ptr.size === 1 && !E.colObj && !E.modo) { const p = pt(e), k = alcaEm(p); if (k) { const o = E.objSel, h = alcasObj(o), q = Ferr.objOp(o), pre = Mo.copia(E.m); pre.nome = E.m.nome;
      gesto = { t: 'alca', k, o, pre, e0: q.e || 1, r0: q.r || 0, d0: Math.hypot(p.x - h.ancora[0], p.y - h.ancora[1]) || 1, a0: Math.atan2(p.y - h.ancora[1], p.x - h.ancora[0]), A: h.ancora, mudou: false }; return; } }
    // ✋ Mover na camada Objetos: arrastar em cima de um objeto move o objeto; fora dele, move a visão
    if (ptr.size === 1 && E.ferr === 'mover' && E.ativa === 'objetos' && !E.modo && !E.colObj && !E.reg.base && !travada('objetos')) { const p = pt(e), w = mundo(p), L = objetosEm(w);
      if (L.length && !Ferr.objOp(L[0]).tv) { selObj(L[0], L); const pre = Mo.copia(E.m); pre.nome = E.m.nome; E.traco = { pre, mudou: false, a: w, ult: w, f: 'sel', obj: true, objMov: { o: L[0], x: L[0].x, y: L[0].y, w0: w } }; gesto = { t: 'ferr', p0: p, moveu: false }; return; } }
    if (ptr.size === 1) { const p = pt(e); if (E.ferr !== 'mover' && !E.modo && !E.colObj) { const t = iniFerr(p); gesto = t ? { t: 'ferr', p0: p, moveu: false } : { t: 'nada' }; } else gesto = { t: 'um', p0: p, ox: E.ox, oy: E.oy, moveu: false }; }
    else if (ptr.size === 2) { if (gesto && gesto.t === 'ferr') cancelaFerr(); const [a, b] = [...ptr.values()]; gesto = { t: 'dois', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: E.s, ox: E.ox, oy: E.oy }; } });
  cv.addEventListener('pointermove', e => { const p = pt(e); if (!ptr.has(e.pointerId)) { if (e.pointerType === 'mouse' && E.ferr !== 'mover') { E.mira = mundo(p); desenhar(); } return; } if (!gesto) return; ptr.set(e.pointerId, p);
    if (gesto.t === 'um' && ptr.size === 1) { const dx = p.x - gesto.p0.x, dy = p.y - gesto.p0.y; if (Math.hypot(dx, dy) > 8) gesto.moveu = true; if (gesto.moveu) { E.ox = gesto.ox + dx; E.oy = gesto.oy + dy; desenhar(); } }
    else if (gesto.t === 'alca' && ptr.size === 1) { const g = gesto, o = g.o, q = Object.assign({}, Ferr.objOp(o));
      if (g.k === 'esc') { const e = clamp(Math.round(g.e0 * Math.hypot(p.x - g.A[0], p.y - g.A[1]) / g.d0 * 100) / 100, .1, 8); if (e === 1) delete q.e; else q.e = e; }
      else { let r = g.r0 + (Math.atan2(p.y - g.A[1], p.x - g.A[0]) - g.a0) * 180 / Math.PI; r = ((Math.round(r / 5) * 5 % 360) + 360) % 360; if (r) q.r = r; else delete q.r; }
      Ferr.objF(o, Ferr.objNs(o), Ferr.objCel(o), q); g.mudou = true; barraObj(); desenhar(); }
    else if (gesto.t === 'ferr' && ptr.size === 1) { if (Math.hypot(p.x - gesto.p0.x, p.y - gesto.p0.y) > 6) gesto.moveu = true; moveFerr(p); }
    else if (gesto.t === 'dois' && ptr.size >= 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ns = clamp(gesto.s0 * d / gesto.d0, .05, 4);
      const wx = (gesto.c0.x - gesto.ox) / gesto.s0, wy = (gesto.c0.y - gesto.oy) / gesto.s0; E.s = ns; E.ox = c.x - wx * ns; E.oy = c.y - wy * ns; ajusta(); desenhar(); } });
  const solta = e => { if (!ptr.has(e.pointerId)) return; const p = pt(e); ptr.delete(e.pointerId);
    if (gesto && gesto.t === 'ferr') { if (e.type === 'pointercancel') cancelaFerr(); else fimFerr(p, gesto.moveu); gesto = null; return; }
    if (gesto && gesto.t === 'alca') { const g = gesto; gesto = null; if (g.mudou) { E.des.push(g.pre); if (E.des.length > 80) E.des.shift(); E.ref.length = 0; marcarSujo('nada'); } return; }
    if (gesto && gesto.t === 'um' && !gesto.moveu && e.type === 'pointerup') toque(p);
    if (!ptr.size) gesto = null; else if (gesto && gesto.t === 'dois') { const q = [...ptr.values()][0]; gesto = { t: 'um', p0: q, ox: E.ox, oy: E.oy, moveu: true }; } };
  cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', solta);
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = pt(e); zoomEm(p.x, p.y, E.s * Math.exp(-e.deltaY * .0015)); }, { passive: false });
  function toque(p) { const m = E.m; if (!m) return; const wx = (p.x - E.ox) / E.s / T, wy = (p.y - E.oy) / E.s / T, tx = Math.floor(wx), ty = Math.floor(wy);
    const t = $('#toque'); if (t) t.textContent = tx >= 0 && ty >= 0 && tx < m.W && ty < m.H ? 'Tile tocado: ' + tx + ', ' + ty : 'Fora do mapa';
    if (E.colObj) return toqueColisao(tx, ty);
    if (E.ativa === 'objetos' && !E.modo) { const L = objetosEm({ x: wx * T, y: wy * T }); selObj(L[0] || null, L); return; }
    if (E.modo) { if (tx < 2 || ty < 2 || tx >= m.W - 2 || ty >= m.H - 2) { toast('Fora do mapa ou na borda bloqueada'); return; }
      const k = E.modo; mudar(q => { q[k] = [tx + .5, ty + .5]; if (k === 'boss') q.tem.boss = true; }, 'nada'); modo(null); toast(k === 'spawn' ? 'Nascimento posto em ' + tx + ', ' + ty : 'Chefe posto em ' + tx + ', ' + ty); } }

  /* ---------- objetos e estruturas no mapa (Fase 4) ---------- */
  // nome legível do objeto (recorte da biblioteca, imagem do editor antigo ou catálogo do jogo)
  function nomeObj(k) { if (R.RC[k]) return R.RC[k].nome; const c = J.CAT.find(x => x[0] === k); if (c) return c[1]; const i = E.lib.imagens.find(x => x.id === k); return i ? (i.nome || k) : k; }
  /* encaixe do objeto (âncora em px do mapa): grade de tiles (centro do tile, base na linha) e ímã nos vizinhos.
     Ímã: se uma borda do desenho chega perto da borda de outro objeto, cola nela (lado a lado, em cima/embaixo, ou alinhado),
     sem vão e sem sobrepor; vale por eixo, o eixo sem vizinho perto segue a grade. */
  function encaixe(o, nx, ny, arrasto) { const m = E.m, enc = E.encaixarObj !== false;
    let x = enc ? Math.floor(nx / T) + .5 : Math.round(nx) / T, y = enc ? (arrasto ? Math.round(ny / T) : Math.floor(ny / T) + 1) : Math.round(ny) / T;
    // chão com encaixe: as bordas do desenho vão para as linhas da grade (piso de 32/64 px fecha o mapa sem sobra)
    if (enc && Ferr.objOp(o).z === 'chao') { o.x = nx / T; o.y = ny / T; let b = null; try { b = R.caixa(J, o); } catch (e) { }
      if (b && Number.isFinite(b.x0)) { x = o.x + (Math.round(b.x0 / T) * T - b.x0) / T; y = o.y + (Math.round(b.y1 / T) * T - b.y1) / T; } }
    if (E.imaObj !== false) { o.x = nx / T; o.y = ny / T; const d = ima(o); if (d.x != null) x = o.x + d.x / T; if (d.y != null) y = o.y + d.y / T; }
    o.x = +clamp(x, 0, m.W - .01).toFixed(4); o.y = +clamp(y, .03, m.H).toFixed(4); return o; }
  function ima(o) { const r = { x: null, y: null }; let b; try { b = R.caixa(J, o); } catch (e) { return r; } if (!b || !Number.isFinite(b.x0)) return r;
    const th = Math.min(T, Math.max(8, 18 / (E.s || 1))); let bx = th + 1, by = th + 1;
    for (const p of E.m.objetos) { if (p === o) continue; let c; try { c = R.caixa(J, p); } catch (e) { continue; } if (!c || !Number.isFinite(c.x0)) continue;
      const juntoY = b.y0 < c.y1 + th && b.y1 > c.y0 - th, juntoX = b.x0 < c.x1 + th && b.x1 > c.x0 - th;
      if (juntoY) for (const d of [c.x1 - b.x0, c.x0 - b.x1, c.x0 - b.x0, c.x1 - b.x1]) if (Math.abs(d) < bx) { bx = Math.abs(d); r.x = d; }
      if (juntoX) for (const d of [c.y1 - b.y0, c.y0 - b.y1, c.y0 - b.y0, c.y1 - b.y1]) if (Math.abs(d) < by) { by = Math.abs(d); r.y = d; } }
    return r; }
  // colisão padrão ao colocar: recorte = células definidas no recurso; outros = regra antiga (pegada do catálogo)
  // “Colocar como” (E.objModo): auto = o que o recorte diz na biblioteca; chao = sempre por baixo do personagem e sem colisão; acima = sempre por cima
  function usoObj(k) { const md = E.objModo || 'auto', rc = R.RC[k]; return md === 'auto' ? (rc && rc.uso) || '' : md === 'objeto' ? '' : md; }
  function novoObj(k, w) { const o = { k, x: 0, y: 0, f: [] }, rc = R.RC[k], u = usoObj(k);
    if (rc || u) { const ns = u === 'chao' ? 1 : rc ? rc.ns : 0; Ferr.objF(o, ns, ns || !rc ? null : rc.col, u ? { z: u } : null); } return encaixe(o, w.x, w.y); }
  // objeto de cima no ponto (px do mapa), na mesma ordem em que é desenhado
  function objetosEm(w) { const m = E.m, L = []; m.objetos.forEach((o, n) => { const b = R.caixa(J, o); if (w.x >= b.x0 && w.x <= b.x1 && w.y >= b.y0 && w.y <= b.y1) L.push(o); });
    const ord = o => { const q = R.opc(o); return q.z === 'chao' ? o.y - 1e9 : q.z === 'acima' ? 1e9 : o.y * T + (q.b || 0); }; return L.sort((a, b) => ord(b) - ord(a) || m.objetos.indexOf(b) - m.objetos.indexOf(a)); }
  function selObj(o, aqui) { E.objSel = o || null; if (aqui) E.aqui = aqui; barraObj(); desenhar(); if (E.aba === 'objeto') { if (o) painel('objeto'); else fecharPainel(); } }
  function barraObj() { const b = $('#objBar'), o = E.objSel; if (!o || !E.m || E.m.objetos.indexOf(o) < 0) { b.hidden = true; E.objSel = null; return; }
    const tv = !!Ferr.objOp(o).tv, n = (E.aqui || []).length; b.hidden = false;
    const q0 = Ferr.objOp(o);
    b.innerHTML = `<span class="cresce"><b>${esc(nomeObj(o.k))}</b> <small class="mudo">${o.x.toFixed(2)}, ${o.y.toFixed(2)} · ${Math.round((q0.e || 1) * 100)}% · ${Math.round(q0.r || 0)}°${tv ? ' · bloqueado' : ''}</small></span>`+(tv || E.reg.base ? '' : `<button class="btn peq" data-o="r-" aria-label="Girar para a esquerda">⟲ 15°</button><button class="btn peq" data-o="r+" aria-label="Girar para a direita">⟳ 15°</button><button class="btn peq" data-o="s-" aria-label="Diminuir">−</button><button class="btn peq" data-o="s+" aria-label="Aumentar">+</button>`)+`${n > 1 ? `<button class="btn peq" data-o="aqui">Aqui: ${n}</button>` : ''}${tv || E.reg.base ? '' : `<button class="btn peq" data-o="z" aria-label="Ordem de desenho">${q0.z === 'chao' ? '🟫 Chão' : q0.z === 'acima' ? '☁️ Por cima' : '🏠 Normal'}</button>`}<button class="btn peq" data-o="prop">Propriedades</button><button class="btn peq" data-o="dup">Duplicar</button><button class="btn peq" data-o="col">Colisão</button><button class="btn peq" data-o="tv">${tv ? '🔒' : '🔓'}</button><button class="btn peq perigo" data-o="del">Excluir</button><button class="btn peq" data-o="x">✕</button>`;
    b.querySelectorAll('[data-o]').forEach(x => x.onclick = () => acaoObj(x.dataset.o)); }
  const idxSel = () => E.m.objetos.indexOf(E.objSel);
  // mexe no objeto selecionado com desfazer (o desfazer troca o modelo inteiro, então reencontra pelo índice)
  function mudaObj(fn) { const i = idxSel(); if (i < 0) return; mudar(x => fn(x.objetos[i]), 'nada'); E.objSel = E.m.objetos[i]; barraObj(); }
  async function acaoObj(a) { const o = E.objSel; if (!o) return; const tv = !!Ferr.objOp(o).tv;
    if (a === 'x') return selObj(null);
    if (/^[rs][+-]$/.test(a)) { if (tv) return toast('Objeto bloqueado'); mudaObj(x => { const q = Object.assign({}, Ferr.objOp(x)); if (a[0] === 'r') { const r = ((((q.r || 0) + (a[1] === '+' ? 15 : -15)) % 360) + 360) % 360; if (r) q.r = r; else delete q.r; } else { const e = clamp(Math.round((q.e || 1) * (a[1] === '+' ? 1.1 : 1 / 1.1) * 100) / 100, .1, 8); if (e === 1) delete q.e; else q.e = e; } Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); }); if (E.aba === 'objeto') painel('objeto'); return; }
    if (a === 'z') { if (tv) return toast('Objeto bloqueado'); let nz; mudaObj(x => { const q = Object.assign({}, Ferr.objOp(x)); nz = !q.z ? 'chao' : q.z === 'chao' ? 'acima' : ''; if (nz) q.z = nz; else delete q.z; const rc = R.RC[x.k];
        if (nz === 'chao') Ferr.objF(x, 1, null, q); else if (!q.z && Ferr.objNs(x)) Ferr.objF(x, rc ? rc.ns : 0, rc && !rc.ns ? rc.col : null, q); else Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); });
      toast(nz === 'chao' ? 'Chão: fica por baixo do personagem, sem colisão' : nz === 'acima' ? 'Por cima: fica sempre na frente do personagem' : 'Normal: o personagem passa na frente ou atrás (pela base)'); if (E.aba === 'objeto') painel('objeto'); return; }
    if (a === 'prop') return abrirAba('objeto');
    if (a === 'aqui') { const L = (E.aqui || []).filter(x => E.m.objetos.includes(x)); const v = await dlg('Objetos neste ponto', '<p class="mudo">Do que aparece na frente para o de trás.</p>', L.map((x, i) => ({ t: nomeObj(x.k) + ' (' + x.x.toFixed(1) + ', ' + x.y.toFixed(1) + ')' + (Ferr.objOp(x).tv ? ' 🔒' : ''), v: 'o' + i })).concat([{ t: 'Cancelar', v: null }]));
      if (v) selObj(L[+v.slice(1)]); return; }
    if (a === 'tv') { mudaObj(x => { const q = Object.assign({}, Ferr.objOp(x)); if (q.tv) delete q.tv; else q.tv = 1; Ferr.objF(x, Ferr.objNs(x), Ferr.objCel(x), q); }); toast(tv ? 'Objeto desbloqueado' : 'Objeto bloqueado: não sai do lugar sem querer'); return; }
    if (a === 'dup') { const i = idxSel(); let nv; mudar(x => { const s = x.objetos[i]; nv = { k: s.k, x: Math.min(x.W - .5, s.x + 1), y: s.y, f: JSON.parse(JSON.stringify(s.f || [])) }; const q = Object.assign({}, Ferr.objOp(nv)); delete q.tv; Ferr.objF(nv, Ferr.objNs(nv), Ferr.objCel(nv), q); x.objetos.push(nv); }, 'nada'); selObj(nv); toast('Duplicado (1 tile à direita)'); return; }
    if (a === 'del') { if (tv) return toast('Objeto bloqueado: desbloqueie para excluir'); const i = idxSel(); mudar(x => { x.objetos.splice(i, 1); }, 'nada'); selObj(null); toast('Objeto excluído (↶ desfaz)'); return; }
    if (a === 'col') { E.colObj = o; const av = $('#modoAviso'); av.hidden = false; av.innerHTML = '<span>Toque nos tiles para ligar/desligar a colisão deste objeto</span><button class="btn peq">Pronto</button>'; av.querySelector('button').onclick = () => { E.colObj = null; av.hidden = true; desenhar(); }; desenhar(); } }
  // colisão do objeto: células a partir do tile da base (mesma conta do jogo)
  // alças do objeto escolhido (na tela): ⤡ tamanho no canto de cima/direita, ⟳ giro acima do meio
  function alcasObj(o) { const P = R.cantos(J, o), q = Ferr.objOp(o), a = (q.r || 0) * Math.PI / 180, sc = p => [E.ox + p[0] * E.s, E.oy + p[1] * E.s], mt = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2], d = 30 / E.s;
    return { esc: sc(P[1]), gira: sc([mt[0] + Math.sin(a) * d, mt[1] - Math.cos(a) * d]), topo: sc(mt), ancora: sc([o.x * T, o.y * T]) }; }
  function alcaEm(p) { const o = E.objSel; if (!o || E.ativa !== 'objetos' || E.reg.base || travada('objetos') || Ferr.objOp(o).tv || E.m.objetos.indexOf(o) < 0) return null; const h = alcasObj(o);
    for (const k of ['gira', 'esc']) if (Math.hypot(p.x - h[k][0], p.y - h[k][1]) <= 26) return k; return null; }
  function celulasObj(o) { const c = Ferr.objCel(o); if (c) return c; if (Ferr.objNs(o)) return [];
    const f = (R.cat(J).fpt[o.k]) || [1, 1, 0], base = Ferr.baseLin(o), x0 = Math.round(o.x - f[0] / 2), y1 = base - f[2], bx = Math.floor(o.x), L = [];
    for (let y = y1 - f[1] + 1; y <= y1; y++) for (let x = x0; x < x0 + f[0]; x++) L.push([x - bx, y - base]); return L; }
  function toqueColisao(tx, ty) { const o = E.colObj; if (!o || E.m.objetos.indexOf(o) < 0) { E.colObj = null; $('#modoAviso').hidden = true; return; }
    const dx = tx - Math.floor(o.x), dy = ty - Ferr.baseLin(o); if (Math.abs(dx) > 12 || Math.abs(dy) > 12) return toast('Longe demais do objeto');
    const i = idxSel(); mudar(x => { const s = x.objetos[i], L = celulasObj(s).map(a => a.slice()), j = L.findIndex(a => a[0] === dx && a[1] === dy); if (j >= 0) L.splice(j, 1); else L.push([dx, dy]); Ferr.objF(s, 0, L, Ferr.objOp(s)); }, 'nada');
    E.objSel = E.colObj = E.m.objetos[i]; barraObj(); }
  // catálogo para colocar: biblioteca (recortes), jogo (catálogo do tema) e imagens do editor antigo
  function catalogo() { const L = [], q = (E.busca || '').toLowerCase(), aba = E.catAba || 'bib';
    if (aba === 'bib') for (const k in R.RC) L.push({ k, n: R.RC[k].nome, g: (E.lib.recursos.find(r => r.id === R.RC[k].rec) || {}).nome || '' });
    else if (aba === 'jogo') { const tema = E.m.tema, cats = J.CATS.filter(c => c[2] === tema || c[2] === '*').map(c => c[0]); for (const c of J.CAT) if (cats.includes(c[2]) && J.TSZ[c[0]]) L.push({ k: c[0], n: c[1], g: (J.CATS.find(x => x[0] === c[2]) || [])[1] || '' }); }
    else for (const i of E.lib.imagens) if (R.IMG[i.id]) L.push({ k: i.id, n: i.nome || i.id, g: 'Minhas imagens' });
    return L.filter(x => !q || (x.n + ' ' + x.g + ' ' + x.k).toLowerCase().includes(q)).slice(0, 300); }
  function miniatura(cv, k) { const i = R.info(J, k), g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); if (!i || !i.ok) return false; const z = Math.min(cv.width / i.dw, cv.height / i.dh, 2), w = i.dw * z, h = i.dh * z;
    g.imageSmoothingEnabled = !i.px; g.drawImage(i.img, i.sx, i.sy, i.sw, i.sh, (cv.width - w) / 2, (cv.height - h) / 2, w, h); return true; }

  /* ---------- seletor de tiles (aba Pintura) ---------- */
  const pk = new window.Visor($('#pkCv'), {
    toqueImg: ip => { const s = pkTs(); if (!s) return true; const c = clamp(Math.floor((ip.x - s.mg) / (s.tw + s.sp)), 0, pkCols(s)[0] - 1), r = clamp(Math.floor((ip.y - s.my) / (s.th + s.sp)), 0, pkCols(s)[1] - 1); escolheTile(s, c, r, c, r); return true; },
    novo: q => { const s = pkTs(); if (!q || !s) return; const f = v => Math.floor((v - s.mg) / (s.tw + s.sp)), g = v => Math.floor((v - s.my) / (s.th + s.sp)), [cc, rr] = pkCols(s);
      escolheTile(s, clamp(f(q.x), 0, cc - 1), clamp(g(q.y), 0, rr - 1), clamp(f(q.x + q.w - 1), 0, cc - 1), clamp(g(q.y + q.h - 1), 0, rr - 1)); pk.pend = null; } });
  const pkCols = s => [Math.max(1, Math.floor((s.w - s.mg + s.sp) / (s.tw + s.sp))), Math.max(1, Math.floor((s.h - s.my + s.sp) / (s.th + s.sp)))];
  const pkTs = () => libTs().find(t => t.id === E.pkId) || null;
  function escolheTile(s, c0, r0, c1, r1) { E.tinta.tile = { id: s.id, c0, r0, sw: c1 - c0 + 1, sh: r1 - r0 + 1 };
    pk.recortes = [{ id: 'sel', x: s.mg + c0 * (s.tw + s.sp), y: s.my + r0 * (s.th + s.sp), w: (c1 - c0 + 1) * (s.tw + s.sp) - s.sp, h: (r1 - r0 + 1) * (s.th + s.sp) - s.sp }]; pk.desenhar();
    $('#pkInfo').textContent = 'Escolhido: ' + E.tinta.tile.sw + '×' + E.tinta.tile.sh + ' tile(s) de ' + s.tw + '×' + s.th + ' px (coluna ' + c0 + ', linha ' + r0 + ')';
    if (E.ferr === 'mover' || E.ferr === 'sel' || E.ferr === 'colar') ferramenta('pincel'); }
  function mostraPick() { const on = E.aba === 'pintura' && !FIXAS[E.ativa]; $('#pick').hidden = !on; if (!on) return;
    const L = libTs(); if (!L.length) { $('#pick').hidden = true; return; } if (!E.pkId || !L.some(t => t.id === E.pkId)) E.pkId = (E.tinta.tile && E.tinta.tile.id) || L[0].id;
    $('#pkTs').innerHTML = L.map(t => `<option value="${esc(t.id)}" ${t.id === E.pkId ? 'selected' : ''}>${esc(t.nome)} · ${t.tw}×${t.th}</option>`).join('');
    carregaPick(); }
  function carregaPick() { const s = pkTs(), t = s && R.TSI[s.id]; if (!s) return; pk.grade = { tw: s.tw, th: s.th, mg: s.mg, my: s.my, sp: s.sp }; pk.encaixar = true; pk.recortes = []; pk.cand = []; pk.sel = null;
    if (E.tinta.tile && E.tinta.tile.id === s.id) { const q = E.tinta.tile; pk.recortes = [{ id: 'sel', x: s.mg + q.c0 * (s.tw + s.sp), y: s.my + q.r0 * (s.th + s.sp), w: q.sw * (s.tw + s.sp) - s.sp, h: q.sh * (s.th + s.sp) - s.sp }]; }
    requestAnimationFrame(() => { pk.tamanho(); if (t && t.ok) { if (pk.img !== t.img) { pk.imagem(t.img); pk.ajustar(); } else pk.desenhar(); } else { $('#pkInfo').textContent = 'Carregando o tileset…'; setTimeout(() => { if (R.TSI[s.id] && R.TSI[s.id].ok && E.aba === 'pintura') carregaPick(); }, 600); } }); }
  $('#pkTs').onchange = e => { E.pkId = e.target.value; pk.img = null; carregaPick(); const s = libTs().find(t => t.id === E.pkId); if (s && s.piso) escolheTile(s, 0, 0, 0, 0); };
  $('#pkModo').onclick = () => { const on = pk.modo !== 'sel'; pk.modo = on ? 'sel' : 'mover'; $('#pkModo').setAttribute('aria-pressed', on); $('#pkModo').textContent = on ? 'Escolhendo vários (arraste)' : 'Escolher vários'; };
  $('#pkZp').onclick = () => pk.zoom(1.25); $('#pkZm').onclick = () => pk.zoom(1 / 1.25); $('#pkZa').onclick = () => pk.ajustar();

  /* ---------- botões ---------- */
  $('#novo').onclick = novo; $('#srvAtu').onclick = srvLista;
  $('#lgIn').onclick = async () => { const st = $('#lgSt'); st.className = 'status'; st.textContent = 'Entrando…';
    try { await P.entrar($('#lgU').value, $('#lgP').value); $('#lgP').value = ''; st.textContent = ''; carregarLib(); inicio(); } catch (e) { st.className = 'status err'; st.textContent = P.erroTexto(e); } };
  $('#lgP').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lgIn').click(); });
  $('#voltar').onclick = sairEditor; $('#salvar').onclick = salvar; $('#publicar').onclick = publicar; $('#desf').onclick = desfazer; $('#ref').onclick = refazer;
  $('#zMais').onclick = () => { const r = cv.getBoundingClientRect(); zoomEm(r.width / 2, r.height / 2, E.s * 1.25); };
  $('#zMenos').onclick = () => { const r = cv.getBoundingClientRect(); zoomEm(r.width / 2, r.height / 2, E.s / 1.25); };
  $('#zAjustar').onclick = ajustar; $('#pnX').onclick = fecharPainel;
  document.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => abrirAba(b.dataset.aba));
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { if (b.dataset.f === 'colar') { E.colarClip = E.colarClip || E.clip; if (!E.colarClip) return toast('Copie uma seleção primeiro'); } ferramenta(b.dataset.f); });
  $('#fCam').onclick = () => abrirAba('camadas');
  document.addEventListener('keydown', e => { if (!E.m || $('#dlg').hidden === false || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); } if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); salvar(); } });

  // biblioteca já existente (imagens próprias e tilesets) para desenhar mapas que usam
  async function carregarLib() { const [im, ts, rc] = await Promise.all([P.imagens(), P.tilesets(), P.sessao() && window.Recursos ? window.Recursos.listar().catch(() => []) : []]); E.lib = { imagens: im, tilesets: ts, recursos: rc };
    const rg = rc.filter(r => r.grade && r.grade.tw > 0).map(r => ({ id: r.id, nome: r.nome, arquivo: r.arquivo, w: r.w, h: r.h, tw: r.grade.tw, th: r.grade.th, dw: r.grade.dw || r.grade.tw, dh: r.grade.dh || r.grade.th, mg: r.grade.mg || 0, my: r.grade.my != null ? r.grade.my : (r.grade.mg || 0), sp: r.grade.sp || 0 })).concat(pisos(rc));
    for (const r of rg) if (window.Render.TSI[r.id] && window.Render.TSI[r.id].arq !== r.arquivo + JSON.stringify(r)) delete window.Render.TSI[r.id];
    R.recursos(rc, P.STORE, () => { desenhar(); if (E.aba === 'pintura' && E.ativa === 'objetos') painel('pintura'); });
    R.imagens(im, P.STORE, () => { E.cache.M = null; desenhar(); }); R.tilesets(ts.concat(rg), P.STORE, () => { E.cache.cam = null; desenhar(); if (E.aba === 'pintura') carregaPick(); });
    for (const r of rg) if (R.TSI[r.id]) R.TSI[r.id].arq = r.arquivo + JSON.stringify(r);
    carregarConj(); }
  window.UI = { dlg, aviso, toast, esc, hora, telaEditor: () => { $('#inicio').hidden = true; $('#editor').hidden = !E.m; if (!E.m) inicio(); else { carregarLib(); tamanhoCv(); desenhar(); } }, inicio, carregarLib };
  E.api = { selObj, objetosEm, encaixe, ima, acaoObj, ferramenta, ativar, libTs, tsInfo, escolheTile: (id, c0, r0, c1, r1) => escolheTile(libTs().find(t => t.id === id), c0, r0, c1 == null ? c0 : c1, r1 == null ? r0 : r1), carregarLib, acaoSel, novo, abrir, abrirLocal, abrirSrv, salvar, publicar, redimensionar, desfazer, refazer, mudar, ajustar, zoomEm, inicio, sairEditor };
  R.carregar(J).then(() => { carregarLib(); inicio(); E.pronto = true; });
})();
