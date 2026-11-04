/* =====================================================================
   AMO Gestión · app.js
   El "esqueleto": registra secciones, dibuja la navegación, cambia de
   pantalla según el #hash y conecta los campos con los datos guardados.
   Cada sección vive en js/sections/<nombre>.js y se registra con
   AMO.app.define({...}). Contrato de una sección:
     id, label, icon, order        → cómo aparece en el menú
     collections: ['caja', ...]     → qué datos usa (para redibujar solo cuando cambian)
     defaults: { caja: id => {...} } → cómo es un documento nuevo
     render()  → HTML de la pantalla (texto)
     refresh() → (opcional) actualiza totales sin redibujar todo
     action(act, el, ev) → (opcional) responde a botones data-act
     changed(bind, value, el) → (opcional) se llama después de guardar un campo
     input(el, ev) / change(el, ev) → (opcional) campos propios sin data-bind (ej. formularios)
   ===================================================================== */
AMO.app = (() => {
  const { esc, setPath, clone } = AMO.utils;
  const { icon, toast, readInput } = AMO.ui;
  const store = AMO.store;
  const sections = new Map();
  const defaults = {};
  const view = { current: null };

  function define(sec) {
    sections.set(sec.id, Object.assign({ order: 50, collections: [], nav: true }, sec));
    (sec.collections || []).forEach(c => store.register(c));
    Object.assign(defaults, sec.defaults || {});
  }
  const ordered = () => [...sections.values()].sort((a, b) => a.order - b.order);
  const current = () => sections.get(view.current);

  /* ---------- Dibujo ---------- */
  function renderNav() {
    const navSecs = ordered().filter(s => s.nav && s.id !== 'ajustes');
    document.getElementById('tabs').innerHTML = navSecs.map(s =>
      `<button class="tab" data-nav="${s.id}" aria-current="${s.id === view.current}">${icon(s.icon || s.id)}<span>${esc(s.label)}</span>${s.building ? '<i class="tab-dot" title="En construcción"></i>' : ''}</button>`).join('');
    const gear = document.getElementById('gear');
    if (gear) gear.setAttribute('aria-current', view.current === 'ajustes');
  }
  function banners() {
    const st = store.state; let h = '';
    if (st.mode === 'local') h += `<div class="banner warn">Estás usando una copia local: lo que cargues queda solo en este navegador. Para que se guarde y se comparta, abrí la app desde su link de Claude.</div>`;
    if (st.readOnly) h += `<div class="banner warn">Podés ver todo pero no editar. Pedile permiso de edición a quien te compartió la app.</div>`;
    return h;
  }
  /** Pantalla para ingresar la clave (solo en la versión publicada en Cloudflare). */
  function renderLogin() {
    renderNav();
    document.getElementById('main').innerHTML = `
      <section class="login">
        <p class="login-brand">AMO</p>
        <p class="eyebrow">Gestión</p>
        <form id="login-form" class="card login-card" autocomplete="on">
          <label class="field" for="login-clave"><span>Clave</span>
            <input id="login-clave" type="password" autocomplete="current-password" placeholder="Ingresá la clave" required></label>
          ${store.state.loginError ? `<p class="login-error">${esc(store.state.loginError)}</p>` : ''}
          <button class="btn primary" type="submit">Entrar</button>
          <p class="muted small">Se pide una sola vez en cada dispositivo.</p>
        </form>
      </section>`;
    focus('#login-clave');
  }
  function render() {
    if (store.state.needLogin) return renderLogin();
    const sec = current(); if (!sec) return;
    renderNav();
    const main = document.getElementById('main');
    main.innerHTML = banners() + sec.render();
    main.dataset.view = sec.id;
    if (sec.refresh) sec.refresh();
  }
  /** Redibuja salvo que la persona esté escribiendo en un campo: ahí solo refresca totales. */
  function softRender() {
    const a = document.activeElement, main = document.getElementById('main');
    if (a && main.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { const s = current(); if (s && s.refresh) s.refresh(); return; }
    render();
  }
  function go(id, { scroll = true } = {}) {
    if (!sections.has(id)) id = ordered()[0].id;
    store.flushAll();
    view.current = id;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    render();
    if (scroll) window.scrollTo(0, 0);
  }
  /** Pone el foco en un campo después de redibujar (ej. fila nueva). */
  function focus(selector) { requestAnimationFrame(() => { const el = document.querySelector(selector); if (el) { el.focus(); if (el.select && el.type === 'text') el.select(); } }); }

  /* ---------- Datos de un campo ---------- */
  function docFor(col, id) { return store.get(col, id) || (defaults[col] ? defaults[col](id) : {}); }
  function saveBind(bind, value, opts) {
    const [col, id, path] = bind.split('|');
    const doc = docFor(col, id);
    setPath(doc, path, value);
    doc.actualizado = new Date().toISOString();
    store.save(col, id, doc, opts);
    return doc;
  }

  /* ---------- Eventos generales ---------- */
  function wire() {
    document.addEventListener('click', ev => {
      const el = ev.target.closest('[data-nav], [data-act]');
      if (!el) return;
      if (el.dataset.nav) { go(el.dataset.nav); return; }
      const sec = current();
      if (sec && sec.action) sec.action(el.dataset.act, el, ev);
    });
    document.addEventListener('input', ev => {
      const el = ev.target;
      if (!el.dataset.bind) { const sec = current(); if (sec && sec.input && document.getElementById('main').contains(el)) sec.input(el, ev); return; }
      if (store.state.readOnly) return;
      const quick = el.type === 'checkbox' || el.tagName === 'SELECT';
      const value = readInput(el);
      saveBind(el.dataset.bind, value, { delay: quick ? 0 : 600 });
      const sec = current();
      if (sec && sec.changed) sec.changed(el.dataset.bind, value, el);
      if (sec && sec.refresh) sec.refresh();
    });
    document.addEventListener('change', ev => {
      const sec = current(); if (sec && sec.change && document.getElementById('main').contains(ev.target)) sec.change(ev.target, ev);
    });
    // Los campos de plata se reescriben con puntos de miles al salir.
    document.addEventListener('focusout', ev => {
      const el = ev.target;
      if (el.dataset && (el.dataset.kind === 'money' || el.dataset.kind === 'num')) el.value = AMO.utils.toField(readInput(el));
    });
    document.addEventListener('submit', ev => {
      if (ev.target.id !== 'login-form') return;
      ev.preventDefault();
      const v = document.getElementById('login-clave').value;
      if (v.trim()) store.login(v);
    });
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (sections.has(h) && h !== view.current) go(h); });
    window.addEventListener('pagehide', () => store.flushAll());
    store.on(ev => {
      if (ev.type === 'status') { document.getElementById('status').textContent = store.state.status; return; }
      if (ev.type === 'error') { toast(ev.message, 'bad'); return; }
      if (ev.type === 'readonly' || ev.type === 'mode' || ev.type === 'login') { render(); return; }
      if (ev.type === 'data' && !ev.local) {
        const sec = current();
        if (sec && (ev.col === '*' || sec.collections.includes(ev.col) || sec.collections.includes('*'))) softRender();
      }
    });
  }

  function start() {
    wire();
    const h = location.hash.slice(1);
    view.current = sections.has(h) ? h : ordered()[0].id;
    render();
    store.connect();
  }

  return { define, start, go, render, softRender, focus, docFor, saveBind, sections, view, current };
})();