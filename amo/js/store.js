/* =====================================================================
   AMO Gestión · store.js
   Capa de datos. Es el ÚNICO lugar que sabe dónde se guardan las cosas.
   Elige sola uno de tres modos, en este orden:
   - 'db'    → abierta desde Claude: base compartida de Claude, en vivo.
   - 'api'   → publicada en Cloudflare Pages: servidor propio
               (functions/api) con base D1 y clave. Sincroniza cada 15 s.
   - 'local' → archivo abierto suelto: guarda solo en este navegador.
   Las secciones solo usan: list, get, save, remove, register, on.
   Todo se guarda como "colección / id", ej: caja/2026-11-01.
   ===================================================================== */
AMO.store = (() => {
  const { clone } = AMO.utils;
  const LS_KEY = 'amo-gestion-v3';
  const collections = new Set(['config']);
  const data = new Map();            // col -> Map(id -> doc)
  const pending = new Map();         // 'col/id' -> {timer, body, running, again}
  const listeners = new Set();
  const state = { mode: 'connecting', readOnly: false, status: 'Conectando…', online: false, needLogin: false, loginError: '' };
  let db = null;
  const CLAVE_KEY = 'amo-clave';
  const api = { desde: 0, timer: null, sincronizando: false };

  const colMap = col => { if (!data.has(col)) data.set(col, new Map()); return data.get(col); };
  const emit = ev => listeners.forEach(fn => { try { fn(ev); } catch (e) { console.error(e); } });
  function setStatus(s) { state.status = s; emit({ type: 'status' }); }
  const idleStatus = () => (state.readOnly ? 'Solo lectura' : state.mode === 'local' ? 'Guardado en este navegador' : 'Todo guardado');

  /* ---------- Lectura ---------- */
  /** Una sección avisa qué colecciones usa, antes de connect(). */
  function register(...cols) { cols.forEach(c => collections.add(c)); }
  function get(col, id) { const x = colMap(col).get(id); return x ? clone(x) : null; }
  function list(col) { return [...colMap(col).entries()].map(([id, x]) => Object.assign(clone(x), { id: x.id || id })); }
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  /* ---------- Escritura ----------
     Se guarda el documento entero. Lo que se tipea se agrupa (delay) y
     cada documento escribe de a una vez, en orden. */
  function save(col, id, body, { delay = 600 } = {}) {
    if (state.readOnly) return false;
    colMap(col).set(id, clone(body));
    const key = col + '/' + id;
    let p = pending.get(key);
    if (!p) { p = { timer: null, body: null, running: false, again: false }; pending.set(key, p); }
    p.body = clone(body);
    clearTimeout(p.timer);
    p.timer = setTimeout(() => flush(key), delay);
    setStatus('Guardando…');
    emit({ type: 'data', col, id, local: true });
    return true;
  }
  // Como mucho 4 escrituras a la vez: al cargar muchos datos juntos (ejemplos,
  // respaldo) no se satura la base.
  const MAX_A_LA_VEZ = 4;
  let enCurso = 0;
  async function flush(key) {
    const p = pending.get(key); if (!p) return;
    if (p.running) { p.again = true; return; }
    if (enCurso >= MAX_A_LA_VEZ) { clearTimeout(p.timer); p.timer = setTimeout(() => flush(key), 120); return; }
    enCurso++;
    p.running = true;
    const body = p.body;
    try {
      if (state.mode === 'db') await writeWithRetry(key, body);
      else if (state.mode === 'api') await apiWrite('PUT', key, body);
      else saveLocal();
    } catch (err) { handleWriteError(err); }
    enCurso--;
    p.running = false;
    if (p.again) { p.again = false; return flush(key); }
    if (p.body === body) pending.delete(key);
    if (!pending.size && !state.readOnly && state.status !== 'No se pudo guardar') setStatus(idleStatus());
  }
  async function writeWithRetry(key, body) {
    try { await db.doc(key).set(body); }
    catch (err) {
      if (err && (err.code === 'unavailable' || err.code === 'resource_exhausted')) { await new Promise(r => setTimeout(r, 900 + Math.random() * 1200)); await db.doc(key).set(body); }
      else throw err;
    }
  }
  function handleWriteError(err) {
    const code = err && err.code;
    if (code === 'unauthorized') { pedirClave('La clave cambió o venció. Volvé a ingresarla.'); return; }
    if (code === 'invalid_argument' || code === 'not_granted') { state.readOnly = true; setStatus('Solo lectura'); emit({ type: 'readonly' }); }
    else if (code === 'quota_exceeded') { setStatus('Sin espacio'); emit({ type: 'error', message: 'No hay más espacio para guardar. Hay que borrar datos viejos.' }); }
    else { setStatus('No se pudo guardar'); emit({ type: 'error', message: 'No se pudo guardar. Revisá la conexión; se reintenta al volver a editar.' }); }
  }
  /** Guarda ya mismo lo que esté esperando (al salir de una pantalla). */
  function flushAll() { [...pending.keys()].forEach(k => { clearTimeout(pending.get(k).timer); flush(k); }); }
  async function remove(col, id) {
    if (state.readOnly) return false;
    const key = col + '/' + id, p = pending.get(key);
    if (p) { clearTimeout(p.timer); pending.delete(key); }
    colMap(col).delete(id);
    emit({ type: 'data', col, id, local: true });
    try { if (state.mode === 'db') await db.doc(key).delete(); else if (state.mode === 'api') await apiWrite('DELETE', key); else saveLocal(); return true; }
    catch (err) { handleWriteError(err); return false; }
  }

  /* ---------- Respaldo local ---------- */
  function saveLocal() {
    try {
      const out = {}; data.forEach((m, col) => { out[col] = Object.fromEntries(m); });
      localStorage.setItem(LS_KEY, JSON.stringify(out));
    } catch (e) { /* sin almacenamiento: queda en memoria mientras la página esté abierta */ }
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY); if (!raw) return;
      Object.entries(JSON.parse(raw)).forEach(([col, docs]) => data.set(col, new Map(Object.entries(docs))));
    } catch (e) {}
  }

  /* ---------- Servidor propio (Cloudflare) ---------- */
  const leerClave = () => { try { return localStorage.getItem(CLAVE_KEY) || ''; } catch (e) { return ''; } };
  async function pedido(method, ruta, body) {
    let res;
    try {
      res = await fetch('/api/' + ruta, {
        method, cache: 'no-store',
        headers: Object.assign({ 'X-Clave': leerClave() }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) { throw { code: 'unavailable' }; }
    if (res.status === 401) throw { code: 'unauthorized' };
    if (res.status === 413 || res.status === 400) throw { code: 'invalid_argument' };
    if (!res.ok) throw { code: 'unavailable' };
    return res.json();
  }
  async function apiWrite(method, key, body) {
    try { await pedido(method, 'doc/' + key, body); }
    catch (err) {
      if (err.code !== 'unavailable') throw err;
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 1500));
      await pedido(method, 'doc/' + key, body);
    }
  }
  async function hayServidor() {
    if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return false;
    try {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch('/api/ping', { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) return false;
      const j = await res.json();
      return !!(j && j.ok);
    } catch (e) { return false; }
  }
  function pedirClave(msg = '') {
    clearTimeout(api.timer);
    try { localStorage.removeItem(CLAVE_KEY); } catch (e) {}
    state.needLogin = true; state.loginError = msg;
    setStatus('Falta la clave'); emit({ type: 'login' });
  }
  /** Trae lo que cambió en el servidor y lo aplica. */
  async function sincronizar(completo = false) {
    if (api.sincronizando || state.needLogin) return;
    api.sincronizando = true;
    clearTimeout(api.timer);
    try {
      // 5 s de margen por si dos cambios llegaron casi juntos (repetir no hace daño)
      const desde = completo ? 0 : Math.max(0, api.desde - 5000);
      const r = await pedido('GET', 'datos?desde=' + desde);
      if (completo) collections.forEach(c => data.set(c, new Map()));
      const tocadas = new Set();
      (r.docs || []).forEach(d => {
        if (pending.has(d.col + '/' + d.id)) return;   // lo que se está escribiendo gana
        collections.add(d.col);
        const m = colMap(d.col);
        if (d.borrado) { if (m.delete(d.id)) tocadas.add(d.col); }
        else { m.set(d.id, d.body); tocadas.add(d.col); }
      });
      api.desde = r.ahora || api.desde;
      if (!state.online) { state.online = true; if (!pending.size) setStatus(idleStatus()); }
      if (completo) emit({ type: 'data', col: '*' }); else tocadas.forEach(col => emit({ type: 'data', col }));
    } catch (err) {
      if (err.code === 'unauthorized') { api.sincronizando = false; return pedirClave(leerClave() ? 'Clave incorrecta.' : ''); }
      setStatus('Sin conexión, reintentando…');
    }
    api.sincronizando = false;
    api.timer = setTimeout(() => sincronizar(), document.hidden ? 60000 : 15000);
  }
  /** Ingresa la clave y carga todo. */
  async function login(clave) {
    try { localStorage.setItem(CLAVE_KEY, String(clave || '').trim()); } catch (e) {}
    state.needLogin = false; state.loginError = '';
    setStatus('Cargando…'); emit({ type: 'mode' });
    await sincronizar(true);
  }
  function logout() { pedirClave(''); }

  /* ---------- Conexión ---------- */
  async function connect() {
    let ns = null;
    try { ns = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('db') : null; } catch (e) { ns = null; }
    if (!ns && await hayServidor()) {
      state.mode = 'api'; emit({ type: 'mode' });
      document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.needLogin) sincronizar(); });
      if (!leerClave()) return pedirClave('');
      setStatus('Cargando…');
      return sincronizar(true);
    }
    if (!ns) {
      state.mode = 'local'; loadLocal();
      setStatus(idleStatus()); emit({ type: 'data', col: '*' }); emit({ type: 'mode' });
      return;
    }
    db = ns; state.mode = 'db'; emit({ type: 'mode' });
    setStatus('Cargando…');
    const waiting = new Set(collections);
    const timer = setTimeout(() => { if (waiting.size) setStatus('Sin conexión todavía…'); }, 10000);
    collections.forEach(col => {
      db.collection(col).onSnapshot(snap => {
        const m = new Map();
        snap.docs.forEach(d => { const x = d.data(); if (x) m.set(d.id, clone(x)); });
        // lo que se está tipeando y todavía no se guardó gana sobre lo que llega
        pending.forEach((p, key) => { if (key.startsWith(col + '/')) m.set(key.slice(col.length + 1), clone(p.body)); });
        data.set(col, m);
        if (!snap.metadata.fromCache && waiting.delete(col) && !waiting.size) { clearTimeout(timer); state.online = true; if (!pending.size) setStatus(idleStatus()); }
        emit({ type: 'data', col });
      }, err => {
        clearTimeout(timer);
        setStatus(err && err.code === 'revoked' ? 'Sin acceso' : 'Se perdió la conexión');
      });
    });
  }

  /** Cuántas escrituras faltan (para mostrar progreso al cargar muchas). */
  const pendientes = () => pending.size;
  /** Todas las colecciones conocidas con sus documentos (para el respaldo). */
  function exportar() { const out = {}; collections.forEach(c => { out[c] = Object.fromEntries(colMap(c)); }); return out; }

  return { state, register, get, list, save, remove, flushAll, on, connect, pendientes, exportar, collections, login, logout, sincronizar };
})();