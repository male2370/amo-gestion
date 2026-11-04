/* =====================================================================
   AMO Gestión · sections/carta.js
   Sección 6: Costo de la carta.
   Dos pestañas:
   - Platos: cada plato con sus ingredientes, cuánto cuesta hacerlo, qué %
     del precio se va en mercadería y a cuánto convendría venderlo.
   - Insumos: la lista de lo que se compra con su precio. Se actualiza una
     sola vez y cambia el costo de todos los platos que lo usan.
   Las cuentas están en calc/carta.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, K = AMO.calc.carta, store = AMO.store, app = AMO.app;
  const { esc, money, pct, uid, shortDate, toField } = U;
  const { icon, kpi, empty, chip, input, select, field, toast, confirmTap } = AMO.ui;

  const S = { tab: 'platos', abierto: null, filtro: '', q: '' };
  const cfg = () => store.get('config', 'general') || {};
  const ro = () => store.state.readOnly;
  const datos = () => K.carta(store.list('platos'), store.list('insumos'), cfg());
  const listaInsumos = () => store.list('insumos').sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || '')));

  /* =================== PLATOS =================== */
  function filaIngrediente(p, x, i, ins) {
    const bp = path => `platos|${p.id}|ingredientes.${i}.${path}`;
    const insumo = x.insumo ? ins.get(x.insumo) : null;
    const opciones = [{ v: '', l: 'Otro (escribirlo)' }].concat(listaInsumos().map(z => ({ v: z.id, l: `${z.nombre || 'Sin nombre'} (${z.unidad || 'u'})` })));
    return `
    <div class="k-row">
      <div class="cell c-name"><span class="cl">Ingrediente</span>
        <select id="ki-${i}-ins" data-bind="${bp('insumo')}" aria-label="Ingrediente"${ro() ? ' disabled' : ''}>${opciones.map(o => `<option value="${esc(o.v)}"${String(x.insumo || '') === o.v ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select>
        ${insumo ? '' : input({ bind: bp('d'), value: x.d, placeholder: 'Nombre del ingrediente', id: `ki-${i}-d`, label: 'Nombre del ingrediente' })}
      </div>
      <label class="cell"><span class="cl">Cantidad</span>${input({ bind: bp('cant'), value: x.cant, kind: 'num', placeholder: '0,25', id: `ki-${i}-cant`, label: 'Cantidad por porción' })}</label>
      <div class="cell"><span class="cl">Unidad</span>${insumo ? `<span class="k-fixed">${esc(insumo.unidad || 'u')}</span>` : input({ bind: bp('u'), value: x.u, placeholder: 'kg', id: `ki-${i}-u`, label: 'Unidad', attrs: 'list="k-unidades"' })}</div>
      <div class="cell"><span class="cl">$ por unidad</span>${insumo ? `<span class="k-fixed num" title="Precio de la lista de insumos">${money(K.costoUnidad(insumo))}${U.parseNum(insumo.aprovechamiento) && U.parseNum(insumo.aprovechamiento) < 100 ? `<small class="muted"> · ${toField(insumo.aprovechamiento)}% útil</small>` : ''}</span>` : input({ bind: bp('pu'), value: x.pu, kind: 'money', id: `ki-${i}-pu`, label: 'Precio por unidad' })}</div>
      <div class="cell r c-sub"><span class="cl">Costo</span><b class="num" data-out="kl-${i}"></b></div>
      ${ro() ? '<span></span>' : `<button class="icon-btn x" data-act="quitar-ing" data-i="${i}" aria-label="Quitar ingrediente">${icon('close', 15)}</button>`}
    </div>`;
  }

  function editor(m) {
    const p = store.get('platos', S.abierto); if (!p) return '';
    p.id = S.abierto;
    const b = path => `platos|${p.id}|${path}`;
    return `
    <section class="card k-editor" id="k-editor">
      <input class="ev-title" id="k-nombre" data-bind="${b('nombre')}" value="${esc(p.nombre)}" placeholder="Nombre del plato (ej. Bife de chorizo con papas)" aria-label="Nombre del plato"${ro() ? ' readonly' : ''}>
      <div class="fields">
        ${select({ label: 'Sección de la carta', bind: b('seccion'), value: p.seccion, options: K.SECCIONES, id: 'k-seccion' })}
        ${field({ label: 'Precio en la carta', bind: b('precio'), value: p.precio, kind: 'money', id: 'k-precio' })}
      </div>
      <div class="card-title" style="margin-top:16px"><h3>Ingredientes de una porción</h3><span class="total num" data-out="k-costo"></span></div>
      ${(p.ingredientes || []).length ? `<div class="k-head" aria-hidden="true"><span>Ingrediente</span><span>Cantidad</span><span>Unidad</span><span>$ por unidad</span><span class="r">Costo</span><span></span></div>` : ''}
      <div class="ev-rows">${(p.ingredientes || []).map((x, i) => filaIngrediente(p, x, i, m.insumos)).join('')}</div>
      <div class="row" style="margin-top:8px">
        ${ro() ? '' : `<button class="btn small" data-act="agregar-ing">${icon('plus', 15)} Ingrediente</button>`}
        <span class="muted small">La cantidad va en la misma unidad del precio: 0,35 kg de bife a $19.000 el kg.</span>
      </div>
      <div class="kpis" style="margin-top:14px">
        ${kpi({ label: 'Costo por porción', value: '', out: 'k-costo2' })}
        ${kpi({ label: 'Mercadería sobre precio', value: '', out: 'k-fc', sub: '<span data-out="k-estado"></span>' })}
        ${kpi({ label: 'Queda por plato', value: '', out: 'k-cont' })}
        ${kpi({ label: 'Precio sugerido', value: '', out: 'k-sug', sub: `para que la mercadería sea el ${Math.round(m.objetivo * 100)}%` })}
      </div>
      <div class="row" style="margin-top:12px">
        ${ro() ? '' : `<button class="btn small danger" data-act="borrar-plato">Borrar plato</button>`}
        <span class="spacer"></span><button class="btn small primary" data-act="cerrar">Listo</button>
      </div>
    </section>`;
  }

  function tablaPlatos(m) {
    const q = S.q.trim().toLowerCase();
    const filas = m.filas.filter(f => (!S.filtro || (S.filtro === 'revisar' ? f.c.estado.k === 'caro' : f.p.seccion === S.filtro)) && (!q || String(f.p.nombre || '').toLowerCase().includes(q)));
    if (!m.filas.length) return empty('Cargá los platos con sus ingredientes y vas a ver cuánto cuesta hacer cada uno y si el precio de la carta está bien.');
    if (!filas.length) return empty('Ningún plato coincide con el filtro.');
    let sec = null;
    return `<div class="table-wrap"><table class="num k-tabla">
      <thead><tr><th>Plato</th><th class="r">Precio</th><th class="r hide-s">Costo</th><th class="r">Queda</th><th class="r">Mercadería</th></tr></thead>
      <tbody>${filas.map(f => {
        const head = f.p.seccion !== sec ? `<tr class="k-sec"><td colspan="5">${esc(sec = f.p.seccion || 'Otros')}</td></tr>` : '';
        return head + `<tr class="click${f.p.id === S.abierto ? ' sel' : ''}" data-act="abrir" data-id="${f.p.id}">
          <td><b>${esc(f.p.nombre || 'Sin nombre')}</b>${f.c.incompletos ? `<div class="muted small">${f.c.incompletos} ${f.c.incompletos === 1 ? 'ingrediente' : 'ingredientes'} sin precio</div>` : ''}</td>
          <td class="r">${money(f.c.precio)}</td><td class="r hide-s">${money(f.c.costo)}</td><td class="r">${money(f.c.contribucion)}</td>
          <td class="r">${f.c.precio ? chip(pct(f.c.fc), f.c.estado.tono) : chip('Sin precio', 'neutral')}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function vistaPlatos(m) {
    const secciones = K.SECCIONES.filter(s => m.filas.some(f => f.p.seccion === s));
    return `
    <section class="kpis">
      ${kpi({ label: 'Platos', value: String(m.filas.length), sub: `${store.list('insumos').length} insumos en la lista` })}
      ${kpi({ label: 'Mercadería promedio', value: '', out: 'kp-prom', sub: `objetivo ${Math.round(m.objetivo * 100)}% del precio`, hero: true })}
      ${kpi({ label: 'A revisar', value: '', out: 'kp-rev', sub: 'cuestan más de lo ideal' })}
      ${kpi({ label: 'Incompletos', value: '', out: 'kp-inc', sub: 'con ingredientes sin precio' })}
    </section>
    ${S.abierto ? editor(m) : ''}
    <div class="grid-wide">
      <section class="card">
        <div class="g-filtros">
          <div class="chips-row">${[{ k: '', l: 'Todos' }, { k: 'revisar', l: 'A revisar' }].concat(secciones.map(s => ({ k: s, l: s }))).map(c => `<button class="fchip" data-act="filtro" data-f="${esc(c.k)}" aria-pressed="${S.filtro === c.k}">${esc(c.l)}</button>`).join('')}</div>
          <input type="search" id="k-q" value="${esc(S.q)}" placeholder="Buscar plato" aria-label="Buscar plato">
        </div>
        <div id="k-lista">${tablaPlatos(m)}</div>
      </section>
      <section class="card">
        <div class="card-title"><h3>Cómo se lee</h3></div>
        <div class="fields">${field({ label: 'Mercadería ideal sobre el precio (%)', bind: 'config|general|foodCost', value: cfg().foodCost === undefined ? K.OBJETIVO_DEFECTO : cfg().foodCost, kind: 'num', id: 'k-obj', hint: 'En restaurantes suele estar entre 28% y 35%.' })}</div>
        <ul class="k-legend">
          <li>${chip('Bien', 'good')} hasta el ideal</li>
          <li>${chip('Ajustado', 'warn')} hasta 5 puntos arriba</li>
          <li>${chip('Revisar', 'bad')} más que eso: subir el precio o cambiar la receta</li>
        </ul>
      </section>
    </div>`;
  }

  /* =================== INSUMOS =================== */
  function vistaInsumos() {
    const lista = listaInsumos(), platos = store.list('platos');
    const q = S.q.trim().toLowerCase();
    const filas = lista.filter(i => !q || String(i.nombre || '').toLowerCase().includes(q));
    return `
    <section class="card">
      <div class="g-filtros">
        <p class="muted small">Actualizá el precio cuando cambie y se recalculan todos los platos. "% útil" es lo que queda después de limpiar: si de 1 kg de carne quedan 850 g, es 85%.</p>
        <input type="search" id="k-q" value="${esc(S.q)}" placeholder="Buscar insumo" aria-label="Buscar insumo">
      </div>
      ${filas.length ? `
      <div class="i-head" aria-hidden="true"><span>Insumo</span><span>Unidad</span><span>Precio</span><span>% útil</span><span class="r">Costo útil</span><span></span></div>
      <div class="ev-rows">${filas.map(i => {
        const b = f => `insumos|${i.id}|${f}`, usado = K.usos(i.id, platos).length;
        return `<div class="i-row">
          <label class="cell c-name"><span class="cl">Insumo</span>${input({ bind: b('nombre'), value: i.nombre, placeholder: 'Ej. Bife de chorizo', id: `in-${i.id}-n`, label: 'Insumo' })}
            <small class="muted">${usado ? `En ${usado} ${usado === 1 ? 'plato' : 'platos'}` : 'Sin usar'}${i.actualizado ? ` · precio del ${shortDate(String(i.actualizado).slice(0, 10))}` : ''}</small></label>
          <label class="cell"><span class="cl">Unidad</span>${input({ bind: b('unidad'), value: i.unidad, placeholder: 'kg', id: `in-${i.id}-u`, label: 'Unidad', attrs: 'list="k-unidades"' })}</label>
          <label class="cell"><span class="cl">Precio</span>${input({ bind: b('precio'), value: i.precio, kind: 'money', id: `in-${i.id}-p`, label: 'Precio' })}</label>
          <label class="cell"><span class="cl">% útil</span>${input({ bind: b('aprovechamiento'), value: i.aprovechamiento, kind: 'num', placeholder: '100', id: `in-${i.id}-a`, label: 'Porcentaje útil' })}</label>
          <div class="cell r c-sub"><span class="cl">Costo útil</span><b class="num" data-out="iu-${i.id}"></b></div>
          ${ro() ? '<span></span>' : `<button class="icon-btn x" data-act="borrar-insumo" data-id="${i.id}" aria-label="Borrar insumo">${icon('close', 15)}</button>`}
        </div>`; }).join('')}</div>`
      : empty(lista.length ? 'Ningún insumo coincide.' : 'Cargá lo que se compra (carnes, verduras, vinos…) con su precio. Después se eligen desde cada plato.')}
    </section>`;
  }

  /* =================== Sección =================== */
  app.define({
    id: 'carta', label: 'Carta', icon: 'carta', order: 60,
    collections: ['platos', 'insumos', 'config'],
    defaults: { platos: () => K.nuevoPlato(), insumos: () => K.nuevoInsumo(), config: () => ({}) },

    render() {
      const m = datos();
      return `
      <section class="page-head"><h2>Costo de la carta</h2><span class="spacer"></span>
        <div class="seg" role="tablist">
          <button role="tab" class="seg-b" data-act="tab" data-tab="platos" aria-selected="${S.tab === 'platos'}">Platos</button>
          <button role="tab" class="seg-b" data-act="tab" data-tab="insumos" aria-selected="${S.tab === 'insumos'}">Insumos</button>
        </div>
        ${ro() ? '' : `<button class="btn primary" data-act="${S.tab === 'platos' ? 'nuevo-plato' : 'nuevo-insumo'}">${icon('plus', 16)} ${S.tab === 'platos' ? 'Plato' : 'Insumo'}</button>`}
      </section>
      ${S.tab === 'platos' ? vistaPlatos(m) : vistaInsumos()}
      <datalist id="k-unidades"><option>kg</option><option>g</option><option>l</option><option>ml</option><option>u</option><option>docena</option><option>botella</option><option>porción</option></datalist>`;
    },

    refresh() {
      const out = (k, v) => document.querySelectorAll(`#main [data-out="${k}"]`).forEach(el => { el.innerHTML = v; });
      if (S.tab === 'insumos') { store.list('insumos').forEach(i => out('iu-' + i.id, money(K.costoUnidad(i)) + `<small class="muted"> /${esc(i.unidad || 'u')}</small>`)); return; }
      const m = datos();
      out('kp-prom', m.promedio ? pct(m.promedio) : '–');
      out('kp-rev', `<span class="${m.aRevisar ? 'neg' : ''}">${m.aRevisar}</span>`);
      out('kp-inc', `<span class="${m.incompletos ? 'neg' : ''}">${m.incompletos}</span>`);
      const box0 = document.getElementById('k-lista'); if (box0) box0.innerHTML = tablaPlatos(m);
      const f = S.abierto && m.filas.find(x => x.p.id === S.abierto); if (!f) return;
      const c = f.c;
      out('k-costo', money(c.costo)); out('k-costo2', money(c.costo));
      out('k-fc', c.precio ? `<span class="${c.estado.k === 'caro' ? 'neg' : ''}">${pct(c.fc)}</span>` : '–');
      out('k-estado', c.precio ? chip(c.estado.l, c.estado.tono) : 'Falta el precio');
      out('k-cont', money(c.contribucion)); out('k-sug', c.sugerido ? money(c.sugerido) : '–');
      c.lineas.forEach((l, i) => out('kl-' + i, l.perdido ? '<span class="neg small">Insumo borrado</span>' : money(l.costo)));
    },

    changed(bind) { if (/\|ingredientes\.\d+\.insumo$/.test(bind)) { app.render(); } },

    input(el) {
      if (el.id === 'k-q') {
        S.q = el.value;
        if (S.tab === 'platos') { const box = document.getElementById('k-lista'); if (box) box.innerHTML = tablaPlatos(datos()); }
        else { app.render(); app.focus('#k-q'); const i = document.getElementById('k-q'); if (i) i.setSelectionRange(i.value.length, i.value.length); }
      }
    },

    action(act, el) {
      if (act === 'tab') { S.tab = el.dataset.tab; S.q = ''; return app.render(); }
      if (act === 'filtro') { S.filtro = el.dataset.f; return app.render(); }
      if (act === 'abrir') { S.abierto = el.dataset.id; app.render(); const e = document.getElementById('k-editor'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (act === 'cerrar') { store.flushAll(); S.abierto = null; return app.render(); }
      if (ro()) return;
      if (act === 'nuevo-plato') {
        const id = uid(), p = K.nuevoPlato(); p.ingredientes = [{ insumo: '', d: '', u: 'kg', pu: '', cant: '' }]; p.creado = new Date().toISOString();
        store.save('platos', id, p, { delay: 0 }); S.abierto = id; app.render(); return app.focus('#k-nombre');
      }
      if (act === 'nuevo-insumo') {
        const id = uid(); store.save('insumos', id, Object.assign(K.nuevoInsumo(), { creado: new Date().toISOString() }), { delay: 0 });
        S.q = ''; app.render(); return app.focus(`#in-${id}-n`);
      }
      if (act === 'agregar-ing' || act === 'quitar-ing') {
        const p = store.get('platos', S.abierto); if (!p) return;
        p.ingredientes = p.ingredientes || [];
        if (act === 'agregar-ing') p.ingredientes.push({ insumo: '', d: '', u: 'kg', pu: '', cant: '' }); else p.ingredientes.splice(+el.dataset.i, 1);
        store.save('platos', S.abierto, p, { delay: 0 }); app.render();
        if (act === 'agregar-ing') app.focus(`#ki-${p.ingredientes.length - 1}-ins`);
        return;
      }
      if (act === 'borrar-plato') { if (!confirmTap(el)) return; store.remove('platos', S.abierto); S.abierto = null; app.render(); return toast('Plato borrado'); }
      if (act === 'borrar-insumo') {
        const usado = K.usos(el.dataset.id, store.list('platos')).length;
        if (!confirmTap(el, usado ? `Está en ${usado} ${usado === 1 ? 'plato' : 'platos'}. ¿Borrar?` : '¿Borrar?')) return;
        store.remove('insumos', el.dataset.id); app.render(); return toast('Insumo borrado');
      }
    }
  });
})();