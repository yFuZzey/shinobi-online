/* Editor de mapas · SALVAR E CARREGAR
   - Rascunhos no aparelho: IndexedDB (gravação atômica; guarda as 5 últimas versões de cada mapa como cópia de segurança).
     Se o IndexedDB não existir, usa localStorage gravando primeiro numa chave temporária e conferindo antes de trocar.
   - Recuperação: um "rascunho de emergência" separado, gravado a cada pouco enquanto há alterações não salvas (não substitui o salvamento manual).
   - Servidor (Supabase): mesmo login do /painel. Publicar nunca sobrescreve em silêncio:
     mapa novo = POST sem "upsert" (se o identificador já existir, avisa); mapa existente = PATCH só se ninguém mudou desde que você abriu
     (filtro pela data atualizado_em); se mudou, avisa e só sobrescreve se você confirmar. */
(function (G) {
  'use strict';
  const SB = G.EDITOR_SB_URL, KEY = G.EDITOR_SB_KEY, DOM = '@jogadores.shinobi-online.app';
  const DBN = 'shinobi-editor-mapas', LSP = 'shinobi-ed2:';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((ok, no) => { try { if (!G.indexedDB) return no(new Error('sem IndexedDB'));
      const r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('rascunhos', { keyPath: 'id' }); const c = d.createObjectStore('copias', { keyPath: 'n', autoIncrement: true }); c.createIndex('id', 'id'); d.createObjectStore('emergencia', { keyPath: 'id' }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error || new Error('IndexedDB falhou')); } catch (e) { no(e); } });
    dbp.catch(() => { dbp = null; }); return dbp; }
  const req = r => new Promise((ok, no) => { r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const fim = tx => new Promise((ok, no) => { tx.oncomplete = ok; tx.onerror = () => no(tx.error || new Error('gravação falhou')); tx.onabort = () => no(tx.error || new Error('gravação cancelada')); });
  const ls = { get: k => { try { const t = localStorage.getItem(LSP + k); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
    set: (k, v) => { const t = JSON.stringify(v); localStorage.setItem(LSP + 'tmp', t); if (localStorage.getItem(LSP + 'tmp') !== t) throw new Error('não consegui conferir a gravação'); localStorage.setItem(LSP + k, t); localStorage.removeItem(LSP + 'tmp'); },
    del: k => { try { localStorage.removeItem(LSP + k); } catch (e) { } },
    keys: p => { const L = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(LSP + p)) L.push(k.slice(LSP.length + p.length)); } } catch (e) { } return L; } };

  /* registro: {id, nome, W, H, mapa (formato do jogo + ed), salvoEm, servidor: {atualizado_em, publicado} | null} */
  async function salvar(r) {
    r = Object.assign({}, r, { salvoEm: Date.now() });
    try { const d = await db(), tx = d.transaction(['rascunhos', 'copias', 'emergencia'], 'readwrite');
      tx.objectStore('rascunhos').put(r); tx.objectStore('copias').add({ id: r.id, em: r.salvoEm, r }); tx.objectStore('emergencia').delete(r.id);
      await fim(tx);
      // confere lendo de volta e poda as cópias antigas (fica com as 5 últimas)
      const v = await req(d.transaction('rascunhos').objectStore('rascunhos').get(r.id));
      if (!v || JSON.stringify(v.mapa) !== JSON.stringify(r.mapa)) throw new Error('A gravação não conferiu. Tente de novo.');
      await podar(r.id); return r;
    } catch (e) { if (e && /IndexedDB/.test(e.message || '')) { ls.set('r:' + r.id, r); ls.del('e:' + r.id); return r; } throw e; } }
  async function podar(id) { try { const d = await db(), tx = d.transaction('copias', 'readwrite'), st = tx.objectStore('copias'), ks = await req(st.index('id').getAllKeys(id));
    ks.sort((a, b) => a - b).slice(0, Math.max(0, ks.length - 5)).forEach(k => st.delete(k)); await fim(tx); } catch (e) { } }
  async function listar() { try { const d = await db(); return (await req(d.transaction('rascunhos').objectStore('rascunhos').getAll())).map(resumo); }
    catch (e) { return ls.keys('r:').map(k => ls.get('r:' + k)).filter(Boolean).map(resumo); } }
  const resumo = r => ({ id: r.id, nome: r.nome, W: r.W, H: r.H, salvoEm: r.salvoEm, servidor: r.servidor || null });
  async function ler(id) { try { const d = await db(); return await req(d.transaction('rascunhos').objectStore('rascunhos').get(id)) || null; } catch (e) { return ls.get('r:' + id); } }
  async function apagar(id) { try { const d = await db(), tx = d.transaction(['rascunhos', 'copias', 'emergencia'], 'readwrite');
      tx.objectStore('rascunhos').delete(id); tx.objectStore('emergencia').delete(id);
      const st = tx.objectStore('copias'), ks = await req(st.index('id').getAllKeys(id)); ks.forEach(k => st.delete(k)); await fim(tx);
    } catch (e) { ls.del('r:' + id); ls.del('e:' + id); } }
  async function copias(id) { try { const d = await db(); return (await req(d.transaction('copias').objectStore('copias').index('id').getAll(id))).sort((a, b) => b.em - a.em); } catch (e) { return []; } }
  // emergência: guarda o estado atual sem mexer no rascunho salvo
  async function emergencia(r) { r = Object.assign({}, r, { salvoEm: Date.now() }); try { const d = await db(), tx = d.transaction('emergencia', 'readwrite'); tx.objectStore('emergencia').put(r); await fim(tx); } catch (e) { try { ls.set('e:' + r.id, r); } catch (_) { } } }
  async function lerEmergencia(id) { try { const d = await db(); return await req(d.transaction('emergencia').objectStore('emergencia').get(id)) || null; } catch (e) { return ls.get('e:' + id); } }
  async function limparEmergencia(id) { try { const d = await db(), tx = d.transaction('emergencia', 'readwrite'); tx.objectStore('emergencia').delete(id); await fim(tx); } catch (e) { ls.del('e:' + id); } }

  /* ---------- servidor ---------- */
  let S = null; try { S = JSON.parse(sessionStorage.getItem('painel') || 'null'); } catch (e) { S = null; }
  async function api(p, o = {}) {
    const h = { apikey: KEY, 'Content-Type': 'application/json', ...(o.headers || {}) }; if (S && S.tok) h.Authorization = 'Bearer ' + S.tok;
    let r; try { r = await fetch(SB + p, { ...o, headers: h }); } catch (e) { const x = new Error('Sem conexão com o banco. Confira a internet.'); x.rede = 1; throw x; }
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (_) { }
    if (!r.ok) { const e = new Error((j && (j.message || j.msg || j.error_description)) || ('Erro ' + r.status)); e.status = r.status; e.code = j && j.code; throw e; }
    return j; }
  function erroTexto(e) { const m = String(e && e.message || e);
    if (/invalid login|invalid_credentials/i.test(m)) return 'Usuário ou senha incorretos.';
    if (e && (e.code === 'PGRST205' || /Could not find the table/i.test(m))) return 'O banco ainda não tem a tabela de mapas: rode o sql/11_mapas.sql no Supabase.';
    if (e && (e.status === 401 || /JWT expired|invalid JWT/i.test(m))) { sair(); return 'A sessão expirou: entre de novo.'; }
    if (/row-level security|permission denied/i.test(m)) return 'O banco recusou: esta conta não tem permissão de admin para mapas.';
    return m; }
  async function entrar(u, p) {
    const j = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: String(u).trim().toLowerCase() + DOM, password: p }) });
    S = { tok: j.access_token, uid: j.user.id, nome: '' };
    const r = (await api('/rest/v1/personagens?select=nome,admin&id=eq.' + S.uid)) || [];
    if (!r[0] || !r[0].admin) { S = null; throw new Error('Esta conta não é admin.'); }
    S.nome = r[0].nome; try { sessionStorage.setItem('painel', JSON.stringify(S)); } catch (_) { } return S; }
  function sair() { S = null; try { sessionStorage.removeItem('painel'); } catch (_) { } }
  const sessao = () => S && S.tok ? S : null;
  async function listarServidor() { return (await api('/rest/v1/mapas?select=id,nome,publicado,atualizado_em&order=atualizado_em.desc')) || []; }
  async function lerServidor(id) { const r = await api('/rest/v1/mapas?select=id,nome,mapa,publicado,atualizado_em&id=eq.' + encodeURIComponent(id)); return r && r[0] || null; }
  // publicar: base = atualizado_em de quando você abriu (null = mapa novo no servidor). forcar = sobrescrever mesmo assim (depois de confirmar)
  async function publicar(id, nome, mapa, base, publicado, forcar) {
    const body = JSON.stringify({ id, nome, mapa, publicado: !!publicado });
    if (base == null && !forcar) {
      try { const r = await api('/rest/v1/mapas', { method: 'POST', headers: { Prefer: 'return=representation' }, body }); avisar(); return r && r[0]; }
      catch (e) { if (e.status === 409 || e.code === '23505') { const x = new Error('Já existe um mapa “' + id + '” no servidor.'); x.existe = 1; throw x; } throw e; } }
    const filtro = '/rest/v1/mapas?id=eq.' + encodeURIComponent(id) + (forcar ? '' : '&atualizado_em=eq.' + encodeURIComponent(base));
    const r = await api(filtro, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ nome, mapa, publicado: !!publicado }) });
    if (!r || !r.length) { if (forcar) { const x = new Error('O mapa “' + id + '” não existe mais no servidor.'); x.sumiu = 1; throw x; }
      const x = new Error('O mapa “' + id + '” foi alterado no servidor depois que você abriu.'); x.conflito = 1; throw x; }
    avisar(); return r[0]; }
  async function renomearServidor(id, nome) { const r = await api('/rest/v1/mapas?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ nome }) }); avisar(); return r && r[0]; }
  async function publicadoServidor(id, on) { const r = await api('/rest/v1/mapas?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ publicado: !!on }) }); avisar(); return r && r[0]; }
  async function apagarServidor(id) { await api('/rest/v1/mapas?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); avisar(); }
  // o servidor do jogo relê os mapas na hora
  function avisar() { try { fetch('/painel/recarregar', { method: 'POST' }).catch(() => { }); } catch (e) { } }
  // biblioteca já existente: imagens próprias (objetos) e tilesets
  async function imagens() { try { return (await api('/rest/v1/mapa_imagens?select=*')) || []; } catch (e) { return []; } }
  async function tilesets() { try { return (await api('/rest/v1/mapa_tilesets?select=*')) || []; } catch (e) { return []; } }
  const STORE = SB + '/storage/v1/object/public/mapa-recursos/';

  G.Persist = { api, salvar, listar, ler, apagar, copias, emergencia, lerEmergencia, limparEmergencia, entrar, sair, sessao, erroTexto,
    listarServidor, lerServidor, publicar, renomearServidor, publicadoServidor, apagarServidor, imagens, tilesets, STORE };
})(window);
