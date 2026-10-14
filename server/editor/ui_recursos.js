/* Editor de mapas · INTERFACE DA BIBLIOTECA (Fase 2)
   Biblioteca: pesquisar, filtrar por categoria, importar, abrir, duplicar, renomear, excluir; trazer recursos do editor antigo.
   Recurso: imagem inteira com zoom/pinça/arrasto, recortes livres com alças (vários por imagem), grade opcional, detecção automática
   de peças (opcional, para revisar) e remoção de fundo por cor numa cópia. O arquivo original nunca é alterado. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s), Rc = window.Recursos, P = window.Persist, U = window.UI, esc = U.esc;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const B = { lista: [], antigos: [], filtro: 'Todas', voltar: 'inicio' };
  const RS = { r: null, img: null, od: null, an: null, fundoCv: null, sujo: false, des: [], ref: [], novo: false, file: null, aba: null, gotas: false, arqFundo: null };
  window.BIB = { B, RS }; // para os testes

  /* ---------- biblioteca ---------- */
  function telaBib(de) { if (de) B.voltar = de; for (const t of ['inicio', 'editor', 'recurso']) $('#' + t).hidden = true; $('#biblio').hidden = false; carregarBib(); }
  async function carregarBib() { const st = $('#bbSt'); st.className = 'status';
    if (!P.sessao()) { st.className = 'status err'; st.textContent = 'Entre com a conta admin (na lista de mapas) para usar a biblioteca.'; B.lista = []; B.antigos = []; desenharBib(); return; }
    st.textContent = 'Carregando…';
    try { B.lista = await Rc.listar(); st.textContent = ''; } catch (e) { B.lista = []; st.className = 'status err'; st.textContent = Rc.erroSql(e); }
    const [ts, im] = await Promise.all([P.tilesets(), P.imagens()]); const ja = new Set(B.lista.map(r => r.meta && r.meta.de).filter(Boolean));
    B.antigos = Rc.antigos(ts, im).filter(a => !ja.has(a.antigo + ':' + a.id)); desenharBib(); }
  function desenharBib() {
    const q = $('#bbBusca').value.trim().toLowerCase(), cats = ['Todas'].concat([...new Set(B.lista.map(r => r.categoria).filter(Boolean))].sort());
    if (!cats.includes(B.filtro)) B.filtro = 'Todas';
    $('#bbCats').innerHTML = cats.map(c => `<button data-cat="${esc(c)}" aria-pressed="${c === B.filtro}">${esc(c)}</button>`).join('');
    $('#bbCats').querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { B.filtro = b.dataset.cat; desenharBib(); });
    const L = B.lista.filter(r => (B.filtro === 'Todas' || r.categoria === B.filtro) && (!q || [r.nome, r.categoria, r.colecao, r.id].join(' ').toLowerCase().includes(q)));
    const el = $('#bbLista'); el.innerHTML = L.length ? '' : '<p class="mudo">' + (B.lista.length ? 'Nada encontrado.' : 'Nenhum recurso ainda. Toque em “+ Importar imagem”.') + '</p>';
    for (const r of L) el.appendChild(cartao(r.nome, r.w + '×' + r.h + ' · ' + (r.recortes || []).length + ' recorte(s)', [r.categoria, r.colecao].filter(Boolean).join(' · ') || Rc.TIPOS[r.tipo], Rc.url(r.arquivo), () => acoes(r)));
    $('#bbAnt').hidden = !B.antigos.length; const A = $('#bbAntL'); A.innerHTML = '';
    for (const a of B.antigos) A.appendChild(cartao(a.nome, a.w + '×' + a.h, a.antigo === 'tileset' ? 'Tileset antigo' : 'Imagem antiga', Rc.url(a.arquivo), () => trazer(a))); }
  function cartao(nome, l1, l2, src, fn) { const b = document.createElement('button'); b.className = 'rec';
    b.innerHTML = `<div class="th"><img loading="lazy" alt="" src="${esc(src)}"></div><b>${esc(nome)}</b><small>${esc(l1)}</small><small>${esc(l2)}</small>`; b.onclick = fn; return b; }
  async function acoes(r) {
    const v = await U.dlg(r.nome, `<p class="mudo">${esc(r.id)} · ${r.w}×${r.h} px · ${esc(Rc.TIPOS[r.tipo] || r.tipo)}${r.categoria ? ' · ' + esc(r.categoria) : ''}${r.colecao ? ' · coleção ' + esc(r.colecao) : ''}</p>`,
      [{ t: 'Abrir', v: 'abrir', c: 'pri' }, { t: 'Duplicar', v: 'dup' }, { t: 'Renomear', v: 'ren' }, { t: 'Excluir', v: 'del', c: 'perigo' }, { t: 'Cancelar', v: null }]);
    try {
      if (v === 'abrir') return abrirRecurso(r.id);
      if (v === 'dup') { const n = await pedirNome('Duplicar recurso', r.nome + ' (cópia)'); if (!n) return; const c = Object.assign({}, r, { id: Rc.novoId(n, new Set(B.lista.map(x => x.id))), nome: n, meta: Object.assign({}, r.meta, { duplicadoDe: r.id }) }); delete c.de;
        await Rc.criar(c); U.toast('Recurso duplicado'); return carregarBib(); }
      if (v === 'ren') { const n = await pedirNome('Renomear', r.nome); if (!n || n === r.nome) return; await Rc.atualizar(Object.assign({}, r, { nome: n })); U.toast('Renomeado'); return carregarBib(); }
      if (v === 'del') { const ok = await U.dlg('Excluir recurso?', `<p>Tirar <b>${esc(r.nome)}</b> da biblioteca, com os ${(r.recortes || []).length} recorte(s)?</p><p class="mudo">Os arquivos continuam guardados no Storage (podem estar sendo usados por cópias deste recurso).</p>`, [{ t: 'Excluir', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]);
        if (ok) { await Rc.apagar(r.id); U.toast('Recurso excluído'); carregarBib(); } }
    } catch (e) { U.aviso('Não deu certo', esc(Rc.erroSql(e))); } }
  async function pedirNome(t, ini) { const v = await U.dlg(t, `<label class="lbl">Nome</label><input id="pnNome" maxlength="60" value="${esc(ini)}">`, [{ t: 'OK', v: 1, c: 'pri', antes: () => !!$('#pnNome').value.trim() }, { t: 'Cancelar', v: 0 }]); return v ? $('#pnNome').value.trim().slice(0, 60) : null; }
  async function trazer(a) {
    const ok = await U.dlg('Trazer para a biblioteca', `<p><b>${esc(a.nome)}</b> passa a aparecer na biblioteca nova, usando o mesmo arquivo (nada é reenviado). Os mapas que já usam continuam iguais.</p>`, [{ t: 'Trazer', v: 1, c: 'pri' }, { t: 'Cancelar', v: 0 }]); if (!ok) return;
    try { const r = { id: Rc.novoId(a.nome, new Set(B.lista.map(x => x.id))), nome: a.nome, tipo: a.antigo === 'tileset' ? 'tileset' : 'imagem', categoria: a.antigo === 'tileset' ? 'Tilesets' : 'Objetos', colecao: '', original: a.original, arquivo: a.arquivo, w: a.w, h: a.h, fundo: null, grade: a.grade || null, recortes: [], meta: { de: a.antigo + ':' + a.id } };
      await Rc.criar(r); U.toast('Trazido para a biblioteca'); carregarBib(); } catch (e) { U.aviso('Não deu certo', esc(Rc.erroSql(e))); } }
  $('#bbBusca').oninput = desenharBib;
  $('#bbVoltar').onclick = () => { $('#biblio').hidden = true; if (B.voltar === 'editor') U.telaEditor(); else { U.inicio(); } };
  $('#abreBib').onclick = () => telaBib('inicio'); $('#abaBib').onclick = () => telaBib('editor');
  $('#bbImp').onclick = () => { if (!P.sessao()) return U.aviso('Entre primeiro', 'Volte para a lista de mapas e entre com a conta admin.'); $('#bbFile').value = ''; $('#bbFile').click(); };
  $('#bbFile').onchange = async e => { const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const img = await Rc.abrirArquivo(f); const nome = (f.name || 'imagem').replace(/\.[^.]+$/, '').slice(0, 60);
      const W = img.naturalWidth, H = img.naturalHeight, tipo = W === H && W <= 64 ? 'imagem' : 'spritesheet';
      editar({ id: null, nome, tipo, categoria: tipo === 'imagem' ? 'Objetos' : 'Spritesheets', colecao: '', original: null, arquivo: null, w: W, h: H, fundo: null, grade: null, recortes: [], meta: { arquivoNome: f.name, bytes: f.size, tipoArquivo: f.type } }, img, f); }
    catch (err) { U.aviso('Não deu para importar', esc(err.message)); } };

  /* ---------- editar recurso ---------- */
  const vis = new window.Visor($('#rcCv'), {
    zoom: s => { $('#rcZv').textContent = Math.round(s * 100) + '%'; },
    novo: p => { $('#rcPend').hidden = !p; },
    sel: () => { if (RS.aba === 'recortes') painel('recortes'); },
    mexendo: () => { if (RS.aba === 'recortes') valoresVivos(); },
    muda: (r, r0) => { const antes = estado(); const k = antes.recortes.find(x => x.id === r.id); if (k) Object.assign(k, r0); empilha(antes); marca(); if (RS.aba === 'recortes') painel('recortes'); },
    toqueCand: c => { c.ok = c.ok === false; if (RS.aba === 'detectar') painel('detectar'); },
    toqueImg: ip => { if (!RS.gotas) return false; pegarCor(ip); return true; },
    gradeMexe: g => { if ($('#rgMg')) { $('#rgMg').value = g.mg; $('#rgMy').value = g.my; } },
    gradeFim: (g, g0) => { const antes = estado(); antes.grade = Object.assign({}, g0); RS.r.grade = Object.assign({}, g); empilha(antes); marca(); if (RS.aba === 'grade') painel('grade'); } });
  async function abrirRecurso(id) { const st = $('#bbSt'); st.className = 'status'; st.textContent = 'Abrindo…';
    try { const r = await Rc.ler(id); if (!r) throw new Error('Esse recurso não existe mais.'); const img = await Rc.abrirUrl(Rc.url(r.original)); st.textContent = ''; editar(r, img, null); }
    catch (e) { st.className = 'status err'; st.textContent = Rc.erroSql(e); } }
  function editar(r, img, file) {
    RS.r = JSON.parse(JSON.stringify(r)); RS.gradeOrig = JSON.stringify(r.grade || null); RS.recOrig = JSON.stringify(r.recortes || []); RS.img = img; RS.file = file; RS.novo = !r.id; RS.sujo = RS.novo; RS.des = []; RS.ref = []; RS.gotas = false; RS.arqFundo = r.fundo ? r.arquivo : null;
    RS.od = Rc.pixels(img); RS.an = RS.od ? Rc.analisar(RS.od) : null; RS.fundoCv = null; if (RS.r.fundo && RS.od) refazFundo();
    RS.r.meta = RS.r.meta || {}; RS.seq = Math.max(0, ...RS.r.recortes.map(c => +String(c.id).slice(1) || 0));
    $('#biblio').hidden = true; $('#recurso').hidden = false; vis.pend = null; vis.cand = []; vis.sel = null; $('#rcPend').hidden = true; avisoGotas();
    modo('mover'); sincVisor(); fecharPainel(); requestAnimationFrame(() => { vis.tamanho(); vis.ajustar(); }); topo();
    if (RS.novo) abaRc('info'); }
  function sincVisor() { vis.recortes = RS.r.recortes; vis.grade = RS.r.grade; vis.imagem(RS.r.fundo && RS.fundoCv ? RS.fundoCv : RS.img); }
  function topo() { const r = RS.r; $('#rcNome').textContent = r.nome || 'Sem nome'; $('#rcInfo').textContent = r.w + '×' + r.h + ' px · ' + r.recortes.length + ' recorte(s)' + (RS.novo ? ' · ainda não enviado' : '');
    const e = $('#rcEstado'); e.className = 'estado ' + (RS.sujo ? 'sujo' : 'limpo'); e.textContent = RS.sujo ? '● Não salvo' : '✓ Salvo'; $('#rcDesf').disabled = !RS.des.length; $('#rcRef').disabled = !RS.ref.length; }
  const CH = ['nome', 'tipo', 'categoria', 'colecao', 'fundo', 'grade', 'recortes'];
  const estado = () => { const o = {}; for (const k of CH) o[k] = JSON.parse(JSON.stringify(RS.r[k] === undefined ? null : RS.r[k])); return o; };
  function empilha(antes) { RS.des.push(antes); if (RS.des.length > 100) RS.des.shift(); RS.ref.length = 0; }
  function mudar(fn) { const antes = estado(); fn(RS.r); empilha(antes); marca(); }
  function marca() { RS.sujo = true; sincVisor(); topo(); }
  function volta(de, para) { if (!de.length) return; para.push(estado()); const s = de.pop(); const fundoMudou = JSON.stringify(s.fundo) !== JSON.stringify(RS.r.fundo); Object.assign(RS.r, s);
    if (fundoMudou) refazFundo(); vis.pend = null; $('#rcPend').hidden = true; if (vis.sel && !RS.r.recortes.some(c => c.id === vis.sel)) vis.sel = null; RS.sujo = true; sincVisor(); topo(); if (RS.aba) painel(RS.aba); }
  $('#rcDesf').onclick = () => volta(RS.des, RS.ref); $('#rcRef').onclick = () => volta(RS.ref, RS.des);
  function modo(m) { vis.modo = m; $('#rcMover').setAttribute('aria-pressed', m === 'mover'); $('#rcSel').setAttribute('aria-pressed', m === 'sel'); vis.desenhar(); }
  $('#rcMover').onclick = () => modo('mover'); $('#rcSel').onclick = () => modo('sel');
  $('#rcZp').onclick = () => vis.zoom(1.25); $('#rcZm').onclick = () => vis.zoom(1 / 1.25); $('#rcZa').onclick = () => vis.ajustar();
  window.addEventListener('resize', () => { if (!$('#recurso').hidden) vis.tamanho(); });
  // recorte pendente: confirmar / cancelar
  $('#rcOk').onclick = () => { const p = vis.pend; if (!p) return; const id = 'c' + (++RS.seq); mudar(r => r.recortes.push({ id, nome: 'Recorte ' + RS.seq, cat: r.categoria || '', x: p.x, y: p.y, w: p.w, h: p.h })); vis.pend = null; vis.sel = id; $('#rcPend').hidden = true; sincVisor(); abaRc('recortes', true); U.toast('Recorte adicionado'); };
  $('#rcNo').onclick = () => { vis.pend = null; $('#rcPend').hidden = true; vis.desenhar(); };

  /* ---------- painéis do recurso ---------- */
  function abaRc(a, manter) { if (RS.aba === a && !manter) return fecharPainel(); RS.aba = a; document.querySelectorAll('[data-rc]').forEach(b => b.setAttribute('aria-selected', b.dataset.rc === a)); $('#rcPainel').hidden = false; painel(a); vis.tamanho(); }
  function fecharPainel() { RS.aba = null; $('#rcPainel').hidden = true; document.querySelectorAll('[data-rc]').forEach(b => b.setAttribute('aria-selected', 'false')); vis.tamanho(); }
  $('#rcPnX').onclick = fecharPainel; document.querySelectorAll('[data-rc]').forEach(b => b.onclick = () => abaRc(b.dataset.rc));
  const opt = (v, t, s) => `<option value="${esc(v)}" ${s ? 'selected' : ''}>${esc(t)}</option>`;
  function painel(a) { const C = $('#rcPnC'), r = RS.r; let h = '';
    if (a === 'info') { $('#rcPnT').textContent = 'Informações';
      const cols = [...new Set(B.lista.map(x => x.colecao).filter(Boolean))], m = r.meta || {};
      h = `<div class="campo"><label class="lbl">Nome</label><input id="riNome" maxlength="60" value="${esc(r.nome)}"></div>
        <div class="grade2"><div><label class="lbl">Tipo</label><select id="riTipo">${Object.keys(Rc.TIPOS).map(k => opt(k, Rc.TIPOS[k], r.tipo === k)).join('')}</select></div>
        <div><label class="lbl">Categoria</label><input id="riCat" list="riCats" maxlength="40" value="${esc(r.categoria)}"><datalist id="riCats">${Rc.CATS.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
        <div class="campo"><label class="lbl">Coleção (para agrupar; ex.: “Vila da Folha”)</label><input id="riCol" list="riCols" maxlength="40" value="${esc(r.colecao)}"><datalist id="riCols">${cols.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <p class="mudo">Arquivo original: <b>${r.w}×${r.h} px</b>${m.bytes ? ' · ' + Math.round(m.bytes / 1024) + ' KB' : ''}${m.tipoArquivo ? ' · ' + esc(Rc.EXT[m.tipoArquivo] || '').toUpperCase() : ''} — guardado sem alteração${r.original ? ' (' + esc(r.original) + ')' : ', vai no primeiro “Salvar”'}.</p>
        <p class="mudo">O editor e o jogo usam: ${r.fundo ? '<b>cópia PNG sem o fundo</b> (mesmas dimensões)' : '<b>o próprio original</b>'}.</p>
        ${RS.od ? '' : '<p class="aviso">Imagem muito grande para remover fundo ou detectar peças aqui; recortes manuais funcionam normalmente.</p>'}`; }
    else if (a === 'fundo') { $('#rcPnT').textContent = 'Fundo';
      const an = RS.an, f = r.fundo;
      h = !RS.od ? '<p class="aviso">Imagem grande demais para processar aqui.</p>' :
        `<p class="mudo">${an.transp ? 'Transparência real detectada (' + (an.pcTransp * 100).toFixed(1) + '% dos pixels): nada é removido automaticamente.' : an.solido ? 'Fundo sólido detectado' + (an.solido.magenta ? ' (magenta)' : '') + ': ' + an.solido.hex + ' em ' + an.solido.pc + '% da borda.' : 'Imagem toda opaca, sem fundo sólido nas bordas.'}</p>
        <label class="chk"><input type="checkbox" id="rfOn" ${f ? 'checked' : ''}> Remover fundo por cor (gera uma cópia; o original não muda)</label>
        ${f ? `<div class="linha"><span class="lbl">Cor</span><input type="color" id="rfCor" value="${Rc.hex(f.cor)}" style="width:64px"><button class="btn peq" id="rfGotas" aria-pressed="${RS.gotas}">${RS.gotas ? 'Toque na imagem…' : 'Conta-gotas'}</button><button class="btn peq" id="rfMag">Magenta</button></div>
        <div class="presets"><button data-rfm="borda" aria-pressed="${f.modo !== 'tudo'}">Só o que toca as bordas</button><button data-rfm="tudo" aria-pressed="${f.modo === 'tudo'}">Toda a imagem</button></div>
        <label class="lbl">Tolerância: <b id="rfTolV">${f.tol}</b></label><input type="range" id="rfTol" min="0" max="120" value="${f.tol}" style="height:44px">
        <p class="mudo" id="rfInfo">${RS.removidos != null ? 'Removidos ' + RS.removidos.toLocaleString('pt-BR') + ' pixels (' + (RS.removidos / (r.w * r.h) * 100).toFixed(1) + '%).' : ''}</p>
        <button class="btn" id="rfVolta">Voltar ao original</button>` : ''}`; }
    else if (a === 'grade') { $('#rcPnT').textContent = 'Grade (tileset)';
      const q = r.grade, my = q ? (q.my != null ? q.my : q.mg) : 0; const cr = q ? [Math.max(0, Math.floor((r.w - q.mg + q.sp) / (q.tw + q.sp))), Math.max(0, Math.floor((r.h - my + q.sp) / (q.th + q.sp)))] : null;
      h = `<label class="chk"><input type="checkbox" id="rgOn" ${q ? 'checked' : ''}> Esta imagem tem grade de tiles</label>` + (q ? `
        <div class="grade4"><div><label class="lbl">Largura</label><input id="rgTw" type="number" min="1" max="1024" value="${q.tw}"></div><div><label class="lbl">Altura</label><input id="rgTh" type="number" min="1" max="1024" value="${q.th}"></div>
        <div><label class="lbl">Início X</label><input id="rgMg" type="number" min="0" max="2048" value="${q.mg}"></div><div><label class="lbl">Início Y</label><input id="rgMy" type="number" min="0" max="2048" value="${my}"></div></div>
        <div class="grade4" style="margin-top:6px"><div><label class="lbl">Espaço</label><input id="rgSp" type="number" min="0" max="128" value="${q.sp}"></div></div>
        <button class="btn ${vis.modo === 'grade' ? 'pri' : ''}" id="rgArr" style="width:100%;margin-top:8px">${vis.modo === 'grade' ? '✥ Arrastando a grade — toque para terminar' : '✥ Arrastar a grade (encaixar no desenho)'}</button>
        <label class="lbl" style="margin-top:8px">Ajuste fino (1 px)</label><div class="presets"><button data-gn="x,-1">← X</button><button data-gn="x,1">X →</button><button data-gn="y,-1">↑ Y</button><button data-gn="y,1">Y ↓</button><button data-gn="w,-1">Tile − </button><button data-gn="w,1">Tile +</button></div>
        <p class="mudo">${cr[0]}×${cr[1]} tiles de ${q.tw}×${q.th} px. Mover a grade não mexe na imagem: só diz onde cada tile começa (a área escura fica de fora).</p>
        <label class="chk"><input type="checkbox" id="rgVer" ${vis.verGrade ? 'checked' : ''}> Mostrar a grade</label>
        <label class="chk"><input type="checkbox" id="rgEnc" ${vis.encaixar ? 'checked' : ''}> Encaixar seleções na grade</label>` : '<p class="mudo">Para tilesets regulares. Spritesheets com peças de tamanhos variados usam recortes livres.</p>'); }
    else if (a === 'recortes') { $('#rcPnT').textContent = 'Recortes (' + r.recortes.length + ')';
      const c = r.recortes.find(x => x.id === vis.sel);
      h = `<p class="mudo">No modo <b>⬚ Selecionar</b>, arraste na imagem para criar um recorte; arraste as alças para ajustar. No modo <b>✋ Mover</b>, toque num recorte para escolher.</p>` +
        (c ? `<div class="cartao" style="margin:8px 0"><div class="linha"><b class="cresce">${esc(c.nome)}</b><button class="btn peq" id="rrFoco">Mostrar</button></div>
          <canvas id="rrPrev" class="zoomPrev"></canvas>
          <div class="grade2"><div><label class="lbl">Nome</label><input id="rrNome" maxlength="40" value="${esc(c.nome)}"></div><div><label class="lbl">Categoria</label><input id="rrCat" list="riCats2" maxlength="40" value="${esc(c.cat || '')}"><datalist id="riCats2">${Rc.CATS.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div></div>
          <label class="lbl" style="margin-top:8px">Recorte no arquivo original (px)</label>
          <div class="grade4"><div><label class="lbl">X</label><input id="rrX" type="number" value="${c.x}"></div><div><label class="lbl">Y</label><input id="rrY" type="number" value="${c.y}"></div><div><label class="lbl">Largura</label><input id="rrW" type="number" value="${c.w}"></div><div><label class="lbl">Altura</label><input id="rrH" type="number" value="${c.h}"></div></div>
          ${propsRecorte(c)}
          <div class="linha" style="margin-top:8px"><button class="btn" id="rrDup">Duplicar</button><button class="btn perigo" id="rrDel">Excluir recorte</button></div></div>` : '') +
        (r.recortes.length ? '' : '<button class="btn" id="rrInteira" style="width:100%">Usar a imagem inteira como um objeto</button>') +
        r.recortes.map(x => `<div class="lrec ${x.id === vis.sel ? 'on' : ''}" data-rr="${x.id}"><b>${esc(x.nome)}</b><small class="mudo">${x.w}×${x.h} · ${x.x},${x.y}</small></div>`).join(''); }
    else if (a === 'detectar') { $('#rcPnT').textContent = 'Detectar peças (opcional)';
      const an = RS.an, cor = r.fundo ? r.fundo.cor : an && an.solido ? an.solido.cor : null, ok = vis.cand.filter(c => c.ok !== false).length;
      h = !RS.od ? '<p class="aviso">Imagem grande demais para detectar aqui; use os recortes manuais.</p>' :
        `<p class="mudo">Acha as peças separadas ${an.transp || r.fundo ? 'por transparência' : cor ? 'pela cor de fundo ' + Rc.hex(cor) : 'por transparência'}. Os resultados aparecem em rosa para você revisar: toque num para ignorar/voltar; depois aceite.</p>
        <div class="grade2"><div><label class="lbl">Juntar peças a até (px)</label><input id="rdJ" type="number" min="0" max="64" value="${RS.detJ == null ? 2 : RS.detJ}"></div><div><label class="lbl">Ignorar menores que (px²)</label><input id="rdMin" type="number" min="1" max="100000" value="${RS.detMin || 16}"></div></div>
        <div class="linha" style="margin-top:8px"><button class="btn pri" id="rdGo">Detectar</button>${vis.cand.length ? `<button class="btn" id="rdOk">Aceitar ${ok}</button><button class="btn" id="rdX">Descartar</button>` : ''}</div>
        <p class="mudo">${vis.cand.length ? vis.cand.length + ' peça(s) encontradas, ' + ok + ' marcadas para aceitar.' : ''}</p>`; }
    C.innerHTML = h; ligarPainel(a); }
  function ligarPainel(a) { const r = RS.r;
    if (a === 'info') { $('#riNome').onchange = e => { const v = e.target.value.trim().slice(0, 60); if (v) mudar(x => { x.nome = v; }); };
      $('#riTipo').onchange = e => mudar(x => { x.tipo = e.target.value; if (x.tipo === 'tileset' && !x.grade) x.grade = { tw: 32, th: 32, mg: 0, sp: 0 }; });
      $('#riCat').onchange = e => mudar(x => { x.categoria = e.target.value.trim().slice(0, 40); }); $('#riCol').onchange = e => mudar(x => { x.colecao = e.target.value.trim().slice(0, 40); }); }
    if (a === 'fundo' && RS.od) {
      $('#rfOn').onchange = e => { mudar(x => { x.fundo = e.target.checked ? { cor: RS.an.solido ? RS.an.solido.cor : [255, 0, 255], tol: 24, modo: 'borda' } : null; }); refazFundo(); sincVisor(); painel('fundo'); };
      if (r.fundo) { $('#rfCor').onchange = e => { const v = e.target.value; setFundo({ cor: [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)) }); };
        $('#rfMag').onclick = () => setFundo({ cor: [255, 0, 255] });
        $('#rfGotas').onclick = () => { RS.gotas = !RS.gotas; avisoGotas(); painel('fundo'); };
        document.querySelectorAll('[data-rfm]').forEach(b => b.onclick = () => setFundo({ modo: b.dataset.rfm }));
        $('#rfTol').oninput = e => { $('#rfTolV').textContent = e.target.value; }; $('#rfTol').onchange = e => setFundo({ tol: +e.target.value });
        $('#rfVolta').onclick = () => { mudar(x => { x.fundo = null; }); refazFundo(); sincVisor(); painel('fundo'); U.toast('Voltou ao original'); }; } }
    if (a === 'grade') { $('#rgOn').onchange = e => { mudar(x => { x.grade = e.target.checked ? { tw: 32, th: 32, mg: 0, sp: 0 } : null; }); painel('grade'); };
      if (r.grade) { const num = (id, k, a0, b0) => $(id).onchange = e => { const v = clamp(Math.round(+e.target.value || 0), a0, b0); mudar(x => { x.grade = Object.assign({}, x.grade, { [k]: v }); }); painel('grade'); };
        num('#rgTw', 'tw', 1, 1024); num('#rgTh', 'th', 1, 1024); num('#rgMg', 'mg', 0, 2048); num('#rgMy', 'my', 0, 2048); num('#rgSp', 'sp', 0, 128);
        $('#rgArr').onclick = () => { if (vis.modo === 'grade') { modo('mover'); } else { vis.verGrade = true; modo('grade'); } painel('grade'); };
        document.querySelectorAll('[data-gn]').forEach(b => b.onclick = () => { const [k, d] = b.dataset.gn.split(','), g = Object.assign({}, r.grade); if (g.my == null) g.my = g.mg;
          if (k === 'x') g.mg = Math.max(0, g.mg + +d); else if (k === 'y') g.my = Math.max(0, g.my + +d); else { g.tw = clamp(g.tw + +d, 1, 1024); g.th = clamp(g.th + +d, 1, 1024); } mudar(x => { x.grade = g; }); painel('grade'); });
        $('#rgVer').onchange = e => { vis.verGrade = e.target.checked; vis.desenhar(); }; $('#rgEnc').onchange = e => { vis.encaixar = e.target.checked; }; } }
    if (a === 'recortes') {
      if ($('#rrInteira')) $('#rrInteira').onclick = () => { const id = 'c' + (++RS.seq); mudar(x => x.recortes.push({ id, nome: x.nome, cat: x.categoria || '', x: 0, y: 0, w: x.w, h: x.h })); vis.sel = id; sincVisor(); painel('recortes'); };
      document.querySelectorAll('[data-rr]').forEach(d => d.onclick = () => { vis.sel = d.dataset.rr; const c = r.recortes.find(x => x.id === vis.sel); vis.focar(c, Math.min(vis.s * 1.0, 64)); painel('recortes'); });
      const c = r.recortes.find(x => x.id === vis.sel); if (!c) return; prevRecorte(c);
      $('#rrFoco').onclick = () => { const rc = vis.cv.getBoundingClientRect(); vis.focar(c, clamp(Math.min(rc.width / c.w, rc.height / c.h) * .6, .02, 64)); };
      $('#rrNome').onchange = e => { const v = e.target.value.trim().slice(0, 40); if (v) mudar(x => { x.recortes.find(k => k.id === c.id).nome = v; }); painel('recortes'); };
      $('#rrCat').onchange = e => mudar(x => { x.recortes.find(k => k.id === c.id).cat = e.target.value.trim().slice(0, 40); });
      const geo = () => { let X = Math.round(+$('#rrX').value), Y = Math.round(+$('#rrY').value), Wd = Math.round(+$('#rrW').value), Hd = Math.round(+$('#rrH').value);
        if (![X, Y, Wd, Hd].every(Number.isFinite) || Wd < 1 || Hd < 1 || X < 0 || Y < 0 || X + Wd > r.w || Y + Hd > r.h) { U.toast('Fora da imagem (0 a ' + r.w + ' × 0 a ' + r.h + ')'); painel('recortes'); return; }
        mudar(x => Object.assign(x.recortes.find(k => k.id === c.id), { x: X, y: Y, w: Wd, h: Hd })); painel('recortes'); };
      ['#rrX', '#rrY', '#rrW', '#rrH'].forEach(i => $(i).onchange = geo);
      mapaRecorte(c);
      const d = dims(c), prop = () => $('#rdProp').checked;
      $('#rdW2').onchange = e => { const v = clamp(Math.round(+e.target.value || 0), 1, 2048); setRec(c.id, k => { const h = prop() ? Math.max(1, Math.round(v * c.h / c.w)) : (k.dh || k.h); const dd = dims(k); k.dw = v; k.dh = h; k.ax = Math.round(dd.ax * v / dd.dw); k.ay = Math.round(dd.ay * h / dd.dh); if (k.corte) k.corte = Math.round(k.corte * h / dd.dh); k.livre = !prop(); }); };
      $('#rdH2').onchange = e => { const v = clamp(Math.round(+e.target.value || 0), 1, 2048); setRec(c.id, k => { const w = prop() ? Math.max(1, Math.round(v * c.w / c.h)) : (k.dw || k.w); const dd = dims(k); k.dh = v; k.dw = w; k.ax = Math.round(dd.ax * w / dd.dw); k.ay = Math.round(dd.ay * v / dd.dh); if (k.corte) k.corte = Math.round(k.corte * v / dd.dh); k.livre = !prop(); }); };
      $('#rdProp').onchange = e => setRec(c.id, k => { k.livre = !e.target.checked; if (e.target.checked) { const dd = dims(k); k.dh = Math.max(1, Math.round(dd.dw * c.h / c.w)); k.ay = Math.round(dd.ay * k.dh / dd.dh); } });
      document.querySelectorAll('[data-esc]').forEach(b => b.onclick = () => { const f = +b.dataset.esc; setRec(c.id, k => { const dd = dims(k), w = Math.max(1, Math.round(c.w * f)), h = Math.max(1, Math.round(c.h * f)); k.dw = w; k.dh = h; k.ax = Math.round(dd.ax * w / dd.dw); k.ay = Math.round(dd.ay * h / dd.dh); if (k.corte) k.corte = Math.round(k.corte * h / dd.dh); k.livre = false; }); });
      document.querySelectorAll('[data-anc]').forEach(b => b.onclick = () => setRec(c.id, k => { const dd = dims(k); k.ay = dd.dh; k.ax = b.dataset.anc === 'c' ? Math.round(dd.dw / 2) : b.dataset.anc === 'e' ? 16 : dd.dw - 16; }));
      $('#rdAx').onchange = e => setRec(c.id, k => { k.ax = clamp(Math.round(+e.target.value || 0), -2048, 4096); });
      $('#rdAy').onchange = e => setRec(c.id, k => { k.ay = clamp(Math.round(+e.target.value || 0), -2048, 4096); });
      $('#rdCt').onchange = e => setRec(c.id, k => { k.corte = clamp(Math.round(+e.target.value || 0), 0, dims(k).dh); });
      $('#rdNs').onchange = e => setRec(c.id, k => { k.ns = e.target.checked; });
      $('#rdColP').onclick = () => setRec(c.id, k => { k.col = [[0, 0]]; k.ns = false; });
      $('#rrDup').onclick = () => { const id = 'c' + (++RS.seq); mudar(x => x.recortes.push(Object.assign({}, c, { id, nome: c.nome + ' (cópia)', x: clamp(c.x + 8, 0, r.w - c.w), y: clamp(c.y + 8, 0, r.h - c.h) }))); vis.sel = id; sincVisor(); painel('recortes'); };
      $('#rrDel').onclick = async () => { const ok = await U.dlg('Excluir recorte?', `<p>Excluir <b>${esc(c.nome)}</b>? Dá para desfazer (↶).</p>`, [{ t: 'Excluir', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]); if (!ok) return;
        mudar(x => { x.recortes = x.recortes.filter(k => k.id !== c.id); }); vis.sel = null; sincVisor(); painel('recortes'); }; }
    if (a === 'detectar' && RS.od) {
      $('#rdGo').onclick = () => { RS.detJ = clamp(+$('#rdJ').value | 0, 0, 64); RS.detMin = clamp(+$('#rdMin').value | 0, 1, 100000);
        const an = RS.an, d = r.fundo && RS.fundoCv ? RS.fundoDados : RS.od, cor = r.fundo ? null : an.transp ? null : an.solido ? an.solido.cor : null;
        vis.cand = Rc.detectar(d, { junta: RS.detJ, min: RS.detMin, cor, tol: 24 }); vis.desenhar(); painel('detectar'); if (!vis.cand.length) U.toast('Nenhuma peça encontrada'); };
      if (vis.cand.length) { $('#rdX').onclick = () => { vis.cand = []; vis.desenhar(); painel('detectar'); };
        $('#rdOk').onclick = () => { const L = vis.cand.filter(c => c.ok !== false && !r.recortes.some(k => k.x === c.x && k.y === c.y && k.w === c.w && k.h === c.h)); if (!L.length) return;
          mudar(x => { for (const c of L) { const id = 'c' + (++RS.seq); x.recortes.push({ id, nome: 'Peça ' + RS.seq, cat: x.categoria || '', x: c.x, y: c.y, w: c.w, h: c.h }); } });
          vis.cand = []; sincVisor(); U.toast(L.length + ' recorte(s) adicionados'); abaRc('recortes', true); }; } } }
  function valoresVivos() { const c = RS.r.recortes.find(x => x.id === vis.sel); if (!c || !$('#rrX')) return; $('#rrX').value = c.x; $('#rrY').value = c.y; $('#rrW').value = c.w; $('#rrH').value = c.h; }
  /* ---------- propriedades do recorte no mapa (Fase 4): tamanho de exibição, âncora, parte da frente, colisão ----------
     O arquivo não muda: dw/dh = tamanho em que aparece no mapa; ax/ay = ponto que fica no chão (px do desenho já no tamanho do mapa);
     corte = linha (px do topo) acima da qual o desenho fica sempre na frente do personagem; col = células de colisão (tiles de 32 px)
     contadas a partir do tile da âncora; ns = sem colisão. */
  const dims = c => { const dw = c.dw || c.w, dh = c.dh || c.h; return { dw, dh, ax: c.ax != null ? c.ax : Math.round(dw / 2), ay: c.ay != null ? c.ay : dh, corte: c.corte || 0, col: c.col || [[0, 0]], ns: !!c.ns }; };
  function propsRecorte(c) { const d = dims(c), r = RS.r;
    return `<div class="prob ok" style="margin:8px 0">Arquivo original: <b>${r.w}×${r.h}</b> · Recorte: <b>${c.w}×${c.h}</b> em ${c.x},${c.y} · No mapa: <b>${d.dw}×${d.dh}</b> · Colisão: <b>${d.ns ? 'nenhuma' : d.col.length + ' tile(s)'}</b></div>
      <label class="lbl">Tamanho no mapa (px) — não muda o arquivo nem a colisão</label>
      <div class="grade4"><div><input id="rdW2" type="number" min="1" max="2048" value="${d.dw}" aria-label="Largura no mapa"></div><div><input id="rdH2" type="number" min="1" max="2048" value="${d.dh}" aria-label="Altura no mapa"></div>
      <label class="chk" style="grid-column:span 2"><input type="checkbox" id="rdProp" ${c.livre ? '' : 'checked'}> Manter proporção</label></div>
      <div class="presets"><button data-esc=".5">50%</button><button data-esc="1">Original</button><button data-esc="2">200%</button><button data-esc="3">300%</button></div>
      <label class="lbl">Âncora (o ponto que fica no chão e decide quem passa na frente)</label>
      <div class="presets"><button data-anc="c">Base centro</button><button data-anc="e">Base esquerda</button><button data-anc="d">Base direita</button></div>
      <div class="grade4"><div><label class="lbl">X</label><input id="rdAx" type="number" value="${d.ax}"></div><div><label class="lbl">Y</label><input id="rdAy" type="number" value="${d.ay}"></div>
      <div style="grid-column:span 2"><label class="lbl">Frente do personagem: linha (px do topo; 0 = desligado)</label><input id="rdCt" type="number" min="0" max="${d.dh}" value="${d.corte}"></div></div>
      <p class="mudo">Acima da linha amarela o desenho fica sempre na frente do personagem (copa, telhado). Abaixo, segue a ordem pela base. A imagem não é duplicada.</p>
      <label class="lbl">Como fica no mapa (toque nos quadrados para ligar/desligar a colisão)</label>
      <canvas id="rrMapa" class="zoomPrev" style="touch-action:manipulation"></canvas>
      <label class="chk"><input type="checkbox" id="rdNs" ${d.ns ? 'checked' : ''}> Sem colisão (o personagem atravessa)</label>
      <button class="btn peq" id="rdColP">Colisão padrão (1 tile na âncora)</button>`; }
  // desenha o recorte no tamanho do mapa sobre grama, com a grade de 32 px, a âncora, a linha da frente e a colisão
  function mapaRecorte(c) { const cv = $('#rrMapa'); if (!cv) return; const d = dims(c), src = RS.r.fundo && RS.fundoCv ? RS.fundoCv : RS.img, T = 32;
    // o tile da âncora fica no centro; mostra 2 tiles de folga em volta do desenho
    const esq = Math.ceil(d.ax / T) + 1, dir = Math.ceil((d.dw - d.ax) / T) + 1, cima = Math.ceil(d.ay / T) + 1, baixo = 2, cols = esq + dir, rows = cima + baixo;
    const z = clamp(Math.floor(Math.min(340 / (cols * T), 300 / (rows * T)) * 4) / 4, .25, 3); cv.width = Math.round(cols * T * z); cv.height = Math.round(rows * T * z);
    const g = cv.getContext('2d'), gr = window.Render.TX.g1; g.imageSmoothingEnabled = false; g.setTransform(z, 0, 0, z, 0, 0);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { if (gr && gr.naturalWidth) g.drawImage(gr, x * T, y * T, T, T); else { g.fillStyle = (x + y) % 2 ? '#4f8a3c' : '#5b9a4a'; g.fillRect(x * T, y * T, T, T); } }
    const ax0 = esq * T - T / 2, ay0 = cima * T; // âncora = meio de baixo do tile (esq-1, cima-1)
    const ox = ax0 - d.ax, oy = ay0 - d.ay; g.drawImage(src, c.x, c.y, c.w, c.h, ox, oy, d.dw, d.dh);
    if (!d.ns) { g.fillStyle = 'rgba(230,40,60,.45)'; for (const [dx, dy] of d.col) g.fillRect((esq - 1 + dx) * T, (cima - 1 + dy) * T, T, T); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1 / z; g.beginPath(); for (let x = 0; x <= cols; x++) { g.moveTo(x * T, 0); g.lineTo(x * T, rows * T); } for (let y = 0; y <= rows; y++) { g.moveTo(0, y * T); g.lineTo(cols * T, y * T); } g.stroke();
    if (d.corte) { g.strokeStyle = '#ffe04d'; g.lineWidth = 2 / z; g.setLineDash([5 / z, 3 / z]); g.beginPath(); g.moveTo(ox - 6, oy + d.corte); g.lineTo(ox + d.dw + 6, oy + d.corte); g.stroke(); g.setLineDash([]); }
    g.fillStyle = '#2f8cff'; g.strokeStyle = '#fff'; g.lineWidth = 2 / z; g.beginPath(); g.arc(ax0, ay0, 5 / z, 0, 7); g.fill(); g.stroke();
    cv.onclick = e => { const b = cv.getBoundingClientRect(), x = Math.floor((e.clientX - b.left) * cv.width / b.width / z / T), y = Math.floor((e.clientY - b.top) * cv.height / b.height / z / T), dx = x - (esq - 1), dy = y - (cima - 1);
      setRec(c.id, k => { const L = (k.col || [[0, 0]]).slice(), i = L.findIndex(a => a[0] === dx && a[1] === dy); if (i >= 0) L.splice(i, 1); else L.push([dx, dy]); k.col = L; k.ns = false; }); }; }
  function setRec(id, fn) { mudar(x => fn(x.recortes.find(k => k.id === id))); painel('recortes'); }
  function prevRecorte(c) { const cv = $('#rrPrev'), src = RS.r.fundo && RS.fundoCv ? RS.fundoCv : RS.img, z = clamp(Math.floor(Math.min(300 / c.w, 160 / c.h)), 1, 16);
    cv.width = c.w * z; cv.height = c.h * z; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, c.x, c.y, c.w, c.h, 0, 0, c.w * z, c.h * z); cv.title = 'Ampliado ' + z + '×'; }
  // fundo
  function refazFundo() { if (!RS.r.fundo || !RS.od) { RS.fundoCv = null; RS.fundoDados = null; RS.removidos = null; return; } const x = Rc.removerFundo(RS.od, RS.r.fundo); RS.fundoDados = x.dados; RS.fundoCv = Rc.paraCanvas(x.dados); RS.removidos = x.removidos; }
  function setFundo(o) { mudar(x => { x.fundo = Object.assign({}, x.fundo, o); }); refazFundo(); sincVisor(); painel('fundo'); }
  function avisoGotas() { const a = $('#rcAviso'); a.hidden = !RS.gotas; if (RS.gotas) { a.innerHTML = '<span class="cresce">Toque num pixel do fundo</span><button class="btn peq">Cancelar</button>'; a.querySelector('button').onclick = () => { RS.gotas = false; avisoGotas(); if (RS.aba === 'fundo') painel('fundo'); }; } }
  function pegarCor(ip) { const x = Math.floor(ip.x), y = Math.floor(ip.y); if (x < 0 || y < 0 || x >= RS.r.w || y >= RS.r.h) return; const d = RS.od.data, p = (y * RS.r.w + x) * 4;
    if (d[p + 3] < 128) { U.toast('Esse pixel já é transparente'); return; } RS.gotas = false; avisoGotas(); setFundo({ cor: [d[p], d[p + 1], d[p + 2]] }); U.toast('Cor escolhida: ' + Rc.hex([d[p], d[p + 1], d[p + 2]])); }

  /* ---------- salvar ---------- */
  async function salvar() { const r = RS.r; if (!P.sessao()) { U.aviso('Entre primeiro', 'Volte para a lista de mapas e entre com a conta admin.'); return false; }
    if (!r.nome || !r.nome.trim()) { U.aviso('Falta o nome', 'Dê um nome ao recurso (aba Info).'); return false; }
    if (!RS.novo) { const ant = JSON.parse(RS.recOrig || '[]'), mud = ant.filter(o => { const n = r.recortes.find(k => k.id === o.id); return !n || ['x', 'y', 'w', 'h', 'dw', 'dh', 'ax', 'ay', 'corte'].some(f => (n[f] || 0) !== (o[f] || 0)); }).map(o => r.id + '.' + o.id);
      if (mud.length) { const us = await usos(null, mud); if (us.length) { const v = await U.dlg('Recortes usados em mapas', '<p>Você mudou ou apagou recortes que já estão nestes mapas; eles vão aparecer diferentes (ou sumir, se apagados):</p><ul class="perdas">' + us.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul><p class="mudo">A colisão de cada objeto já colocado não muda sozinha.</p>', [{ t: 'Salvar mesmo assim', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]); if (!v) return false; } } }
    if (!RS.novo && JSON.stringify(r.grade || null) !== RS.gradeOrig) { const us = await usos(r.id);
      if (us.length) { const v = await U.dlg('Grade alterada', '<p>Estes mapas usam este tileset; com a grade nova os tiles deles podem mudar de lugar ou de desenho:</p><ul class="perdas">' + us.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>', [{ t: 'Salvar mesmo assim', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]); if (!v) return false; } }
    $('#rcSalvar').disabled = true; U.toast('Enviando…');
    try {
      if (RS.novo) { const f = RS.file; r.original = 'originais/' + await Rc.sha12(await f.arrayBuffer()) + '.' + Rc.EXT[f.type]; await Rc.subir(r.original, f, f.type); }
      if (r.fundo && RS.fundoCv) { const b = await Rc.canvasPng(RS.fundoCv); const c = 'derivados/' + await Rc.sha12(await b.arrayBuffer()) + '.png'; if (c !== RS.arqFundo) await Rc.subir(c, b, 'image/png'); r.arquivo = c; RS.arqFundo = c; }
      else r.arquivo = r.original;
      let x;
      if (RS.novo) { r.id = Rc.novoId(r.nome, new Set(B.lista.map(k => k.id))); try { x = await Rc.criar(r); } catch (e) { if (!e.existe) throw e; r.id = Rc.novoId(r.nome + '_' + Date.now() % 1000, new Set()); x = await Rc.criar(r); } }
      else { try { x = await Rc.atualizar(r); }
        catch (e) { if (!e.conflito) throw e; const v = await U.dlg('Alterado em outro lugar', '<p>Este recurso foi salvo por outra tela depois que você abriu. Sobrescrever substitui aquela versão.</p>', [{ t: 'Sobrescrever', v: 1, c: 'perigo' }, { t: 'Cancelar', v: 0 }]); if (!v) return false; x = await Rc.atualizar(r, true); } }
      RS.r = Object.assign(RS.r, x); RS.gradeOrig = JSON.stringify(RS.r.grade || null); RS.recOrig = JSON.stringify(RS.r.recortes || []); RS.novo = false; RS.sujo = false; RS.file = null; sincVisor(); topo(); U.toast('Recurso salvo'); if (RS.aba) painel(RS.aba); return true;
    } catch (e) { U.aviso('Não consegui salvar', esc(Rc.erroSql(e))); return false; }
    finally { $('#rcSalvar').disabled = false; } }
  // mapas (rascunhos do aparelho e do servidor) que usam o tileset
  // mapas (aparelho e servidor) que usam o tileset id ou algum dos objetos (chaves "recurso.recorte")
  async function usos(id, chaves) { const L = [], usa = mp => mp && ((id && (mp.tilesets || []).includes(id)) || (chaves && (mp.objects || []).some(o => Array.isArray(o) && chaves.includes(o[0]))));
    for (const x of await P.listar()) { const r = await P.ler(x.id); if (r && usa(r.mapa)) L.push(x.nome + ' (' + x.id + ', no aparelho)'); }
    try { for (const r of (await P.api('/rest/v1/mapas?select=id,nome,mapa')) || []) if (usa(r.mapa) && !L.some(t => t.includes('(' + r.id + ','))) L.push((r.nome || r.id) + ' (' + r.id + ', no servidor)'); } catch (e) { }
    return L; }
  $('#rcSalvar').onclick = salvar;
  $('#rcVoltar').onclick = async () => { if (RS.sujo) { const v = await U.dlg(RS.novo ? 'Importação não salva' : 'Alterações não salvas', RS.novo ? '<p>A imagem ainda não foi enviada. Salvar agora?</p>' : '<p>Salvar antes de sair?</p>', [{ t: 'Salvar', v: 's', c: 'pri' }, { t: RS.novo ? 'Descartar importação' : 'Descartar alterações', v: 'd', c: 'perigo' }, { t: 'Continuar editando', v: null }]);
      if (!v) return; if (v === 's' && !(await salvar())) return; }
    RS.sujo = false; $('#recurso').hidden = true; telaBib(); };
  window.addEventListener('beforeunload', e => { if (RS.sujo && !$('#recurso').hidden) { e.preventDefault(); e.returnValue = ''; } });
  window.BIB.api = { telaBib, abrirRecurso, editar, salvar, abaRc, vis, modo };
})();
