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
    cache: {}, srv: [], lib: { imagens: [], tilesets: [] } };
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
    const usados = await idsUsados(), presets = [[50, 50], [40, 30], [60, 40], [70, 40], [80, 80], [100, 64]];
    const html = `<div class="campo"><label class="lbl">Nome</label><input id="nvNome" maxlength="40" placeholder="Ex.: Floresta da Névoa"></div>
      <div class="campo"><label class="lbl">Identificador (vai no endereço do mapa; não muda depois de publicar)</label><input id="nvId" maxlength="30" autocapitalize="none"></div>
      <label class="lbl">Tamanho em tiles (1 tile = 32 px no jogo)</label><div class="presets">${presets.map(p => `<button data-p="${p}">${p[0]}×${p[1]}</button>`).join('')}</div>
      <div class="grade2"><div><label class="lbl">Largura</label><input id="nvW" type="number" min="${Mo.LIM.MIN}" max="${Mo.LIM.MAX}" value="50"></div><div><label class="lbl">Altura</label><input id="nvH" type="number" min="${Mo.LIM.MIN}" max="${Mo.LIM.MAX}" value="50"></div></div>
      <p class="mudo" id="nvMem"></p>
      <div class="grade2"><div><label class="lbl">Tema</label><select id="nvTema"><option value="folha">Folha</option><option value="areia">Areia</option></select></div>
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
    E.m = m; E.reg = reg; E.sujo = false; E.des = []; E.ref = []; E.modo = null; E.cache = {};
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
  function desfazer() { if (!E.des.length) return; const c = Mo.copia(E.m); c.nome = E.m.nome; E.ref.push(c); E.m = E.des.pop(); E.sujo = true; invalida('tudo'); topo(); emerg(); desenhar(); if (E.aba) painel(E.aba); }
  function refazer() { if (!E.ref.length) return; const c = Mo.copia(E.m); c.nome = E.m.nome; E.des.push(c); E.m = E.ref.pop(); E.sujo = true; invalida('tudo'); topo(); emerg(); desenhar(); if (E.aba) painel(E.aba); }
  let emT = 0; function emerg() { clearTimeout(emT); emT = setTimeout(() => { if (E.sujo && E.m && !E.reg.base) P.emergencia(registro()); }, 1500); }
  const registro = () => Object.assign({}, E.reg, { id: E.m.id, nome: E.m.nome, W: E.m.W, H: E.m.H, mapa: Mo.paraJogo(E.m) });
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
  const libSets = () => ({ tilesets: new Set(E.lib.tilesets.map(t => t.id)), objetos: new Set(Object.keys(J.TSZ).concat(E.lib.imagens.map(i => i.id))) });

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
    const C = $('#pnC'), m = E.m, so = E.reg.base; let h = '';
    if (a === 'mapa') { $('#pnT').textContent = 'Mapa';
      h = chk('grade', 'Grade (32 px)', E.ver.grade) + chk('colisao', 'Mostrar colisão (vermelho = bloqueado, azul = água)', E.ver.colisao) +
        '<p class="mudo">Um dedo arrasta a visão; dois dedos aproximam/afastam. As ferramentas de pintura chegam na Fase 3.</p><p id="toque" class="mudo"></p>'; }
    else if (a === 'camadas') { $('#pnT').textContent = 'Camadas (visibilidade)';
      const n = nm => ((m.camadas.find(c => c.t === 'tiles' && c.n === nm) || { d: [] }).d.length);
      h = chk('chao', 'Chão (terreno + tiles “Chão”: ' + n('chao') + ')', E.ver.chao) + chk('detalhes', 'Detalhes do chão (' + n('detalhes') + ' tiles)', E.ver.detalhes) + chk('objetos', 'Objetos e estruturas (' + m.objetos.length + ')', E.ver.objetos) +
        chk('acima', 'Acima do personagem (' + n('acima') + ' tiles)', E.ver.acima) + chk('colisao', 'Colisão', E.ver.colisao) + chk('areas', 'Áreas de mobs (' + m.areas.length + ')', E.ver.areas) + chk('marcas', 'Nascimento e chefe', E.ver.marcas) +
        '<p class="mudo">Ordem, bloqueio e renomear camadas chegam na Fase 3.</p>'; }
    else if (a === 'prop') { $('#pnT').textContent = 'Propriedades';
      h = `<div class="campo"><label class="lbl">Nome</label><input id="pNome" maxlength="40" value="${esc(m.nome)}" ${so ? 'disabled' : ''}></div>
        <div class="campo"><label class="lbl">Identificador</label><input value="${esc(m.id)}" disabled></div>
        <div class="campo"><label class="lbl">Tamanho</label><div class="linha"><b class="cresce">${m.W} × ${m.H} tiles (${m.W * T}×${m.H * T} px)</b><button class="btn peq" id="pRed" ${so ? 'disabled' : ''}>Redimensionar…</button></div></div>
        <div class="grade2"><div><label class="lbl">Tema</label><select id="pTema" ${so ? 'disabled' : ''}><option value="folha" ${m.tema === 'folha' ? 'selected' : ''}>Folha</option><option value="areia" ${m.tema === 'areia' ? 'selected' : ''}>Areia</option></select></div>
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
    C.innerHTML = h;
    C.querySelectorAll('[data-v]').forEach(i => i.onchange = () => { E.ver[i.dataset.v] = i.checked; desenhar(); });
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
  function pinta() { raf = 0; const m = E.m; if (!m) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(E.s * dpr, 0, 0, E.s * dpr, E.ox * dpr, E.oy * dpr); ctx.imageSmoothingEnabled = false;
    if (!E.cache.chao) E.cache.chao = R.chao(m);
    if (!E.cache.cam) E.cache.cam = { chao: R.camada(m, 'chao'), detalhes: R.camada(m, 'detalhes'), acima: R.camada(m, 'acima') };
    const r = cv.getBoundingClientRect(), vis = { x0: -E.ox / E.s, y0: -E.oy / E.s, x1: (r.width - E.ox) / E.s, y1: (r.height - E.oy) / E.s };
    if (E.ver.chao) { ctx.drawImage(E.cache.chao, 0, 0); if (E.cache.cam.chao) ctx.drawImage(E.cache.cam.chao, 0, 0); } else { ctx.fillStyle = '#20242b'; ctx.fillRect(0, 0, m.W * T, m.H * T); }
    if (E.ver.detalhes && E.cache.cam.detalhes) ctx.drawImage(E.cache.cam.detalhes, 0, 0);
    if (E.ver.objetos) R.objetos(ctx, J, m, vis);
    if (E.ver.acima && E.cache.cam.acima) ctx.drawImage(E.cache.cam.acima, 0, 0);
    if (E.ver.colisao) { if (!E.cache.M) { try { E.cache.M = window.MR.compilar(Mo.paraJogo(m, true), R.cat(J)).M; } catch (e) { E.cache.M = ''; } } if (E.cache.M) R.colisao(ctx, m, E.cache.M); }
    if (E.ver.grade && E.s * T >= 6) R.grade(ctx, m, E.s);
    R.borda(ctx, m, E.s);
    if (E.ver.areas) R.areas(ctx, m, E.s);
    if (E.ver.marcas) { R.marcador(ctx, m.spawn, E.s, '#2f8cff', 'N'); R.marcador(ctx, m.boss, E.s, '#d23c3c', 'C'); }
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2 / E.s; ctx.strokeRect(0, 0, m.W * T, m.H * T); }
  // toque: 1 dedo arrasta (ou toca para pôr nascimento/chefe), 2 dedos = pinça
  const ptr = new Map(); let gesto = null;
  const pt = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (_) { } ptr.set(e.pointerId, pt(e));
    if (ptr.size === 1) gesto = { t: 'um', p0: pt(e), ox: E.ox, oy: E.oy, moveu: false };
    else if (ptr.size === 2) { const [a, b] = [...ptr.values()]; gesto = { t: 'dois', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, c0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: E.s, ox: E.ox, oy: E.oy }; } });
  cv.addEventListener('pointermove', e => { if (!ptr.has(e.pointerId) || !gesto) return; ptr.set(e.pointerId, pt(e));
    if (gesto.t === 'um' && ptr.size === 1) { const p = pt(e), dx = p.x - gesto.p0.x, dy = p.y - gesto.p0.y; if (Math.hypot(dx, dy) > 8) gesto.moveu = true; if (gesto.moveu) { E.ox = gesto.ox + dx; E.oy = gesto.oy + dy; desenhar(); } }
    else if (gesto.t === 'dois' && ptr.size >= 2) { const [a, b] = [...ptr.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ns = clamp(gesto.s0 * d / gesto.d0, .05, 4);
      const wx = (gesto.c0.x - gesto.ox) / gesto.s0, wy = (gesto.c0.y - gesto.oy) / gesto.s0; E.s = ns; E.ox = c.x - wx * ns; E.oy = c.y - wy * ns; ajusta(); desenhar(); } });
  const solta = e => { if (!ptr.has(e.pointerId)) return; const p = pt(e); ptr.delete(e.pointerId);
    if (gesto && gesto.t === 'um' && !gesto.moveu && e.type === 'pointerup') toque(p);
    if (!ptr.size) gesto = null; else if (gesto && gesto.t === 'dois') { const q = [...ptr.values()][0]; gesto = { t: 'um', p0: q, ox: E.ox, oy: E.oy, moveu: true }; } };
  cv.addEventListener('pointerup', solta); cv.addEventListener('pointercancel', solta);
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = pt(e); zoomEm(p.x, p.y, E.s * Math.exp(-e.deltaY * .0015)); }, { passive: false });
  function toque(p) { const m = E.m; if (!m) return; const wx = (p.x - E.ox) / E.s / T, wy = (p.y - E.oy) / E.s / T, tx = Math.floor(wx), ty = Math.floor(wy);
    const t = $('#toque'); if (t) t.textContent = tx >= 0 && ty >= 0 && tx < m.W && ty < m.H ? 'Tile tocado: ' + tx + ', ' + ty : 'Fora do mapa';
    if (E.modo) { if (tx < 2 || ty < 2 || tx >= m.W - 2 || ty >= m.H - 2) { toast('Fora do mapa ou na borda bloqueada'); return; }
      const k = E.modo; mudar(q => { q[k] = [tx + .5, ty + .5]; if (k === 'boss') q.tem.boss = true; }, 'nada'); modo(null); toast(k === 'spawn' ? 'Nascimento posto em ' + tx + ', ' + ty : 'Chefe posto em ' + tx + ', ' + ty); } }

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
  document.addEventListener('keydown', e => { if (!E.m || $('#dlg').hidden === false || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); } if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); salvar(); } });

  // biblioteca já existente (imagens próprias e tilesets) para desenhar mapas que usam
  async function carregarLib() { const [im, ts] = await Promise.all([P.imagens(), P.tilesets()]); E.lib = { imagens: im, tilesets: ts };
    R.imagens(im, P.STORE, () => { E.cache.M = null; desenhar(); }); R.tilesets(ts, P.STORE, () => { E.cache.cam = null; desenhar(); }); }
  window.UI = { dlg, aviso, toast, esc, hora, telaEditor: () => { $('#inicio').hidden = true; $('#editor').hidden = !E.m; if (!E.m) inicio(); else { tamanhoCv(); desenhar(); } }, inicio, carregarLib };
  E.api = { novo, abrir, abrirLocal, abrirSrv, salvar, publicar, redimensionar, desfazer, refazer, mudar, ajustar, zoomEm, inicio, sairEditor };
  R.carregar(J).then(() => { carregarLib(); inicio(); E.pronto = true; });
})();
