/* =====================================================================
   AMO Gestión · sections/gastos.js
   Sección 3: Gastos y cuentas a pagar.
   - Formulario para cargar cada factura (se guarda al tocar "Agregar").
   - Cuentas sin pagar de todos los meses, de la más urgente a la menos.
   - Lista del mes con filtros y búsqueda; totales por categoría y proveedor.
   - Gastos fijos: se traen del mes anterior con un botón.
   Las cuentas están en calc/gastos.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, G = AMO.calc.gastos, store = AMO.store, app = AMO.app;
  const { esc, money, pct, today, ymOf, addMonths, shortDate, parseNum, toField, uid, clone, monthOnly } = U;
  const { icon, kpi, empty, chip, toast, confirmTap } = AMO.ui;
  const COL = 'gastos';

  const S = { ym: ymOf(today()), cat: '', q: '', form: null, catTocada: false };
  const fechaPorDefecto = () => (ymOf(today()) === S.ym ? today() : S.ym + '-01');
  const formNuevo = (extra = {}) => Object.assign(G.nuevo(fechaPorDefecto()), { id: null }, extra);
  const todos = () => store.list(COL);
  const ESTADO_TONO = { vencido: 'bad', hoy: 'bad', pronto: 'warn', ok: 'neutral', sinfecha: 'neutral' };

  /* ---------- Formulario ---------- */
  function formulario() {
    if (store.state.readOnly) return '';
    const f = S.form, editando = !!f.id;
    const provs = G.proveedores(todos());
    const fld = (k, label, inner) => `<label class="field" for="g-${k}"><span>${label}</span>${inner}</label>`;
    const txt = (k, ph, extra = '') => `<input id="g-${k}" data-gf="${k}" value="${esc(f[k])}" placeholder="${esc(ph)}" autocomplete="off"${extra}>`;
    return `
    <section class="card g-form${editando ? ' editing' : ''}" id="g-form">
      <div class="card-title"><h3>${editando ? 'Editar gasto' : 'Cargar un gasto'}</h3>${editando ? chip('Editando', 'accent') : ''}</div>
      <div class="fields">
        ${fld('fecha', 'Fecha', `<input id="g-fecha" type="date" data-gf="fecha" value="${esc(f.fecha)}">`)}
        ${fld('proveedor', 'Proveedor', txt('proveedor', 'Ej. Frigorífico, Edesur, bodega', ' list="g-provs"'))}
        ${fld('cat', 'Categoría', `<select id="g-cat" data-gf="cat">${G.CATS.map(c => `<option value="${c.k}"${f.cat === c.k ? ' selected' : ''}>${c.l}</option>`).join('')}</select>`)}
        ${fld('detalle', 'Detalle', txt('detalle', 'Ej. Factura A 0001-2345'))}
        ${fld('monto', 'Monto', `<span class="money"><input id="g-monto" data-gf="monto" data-kind="money" type="text" inputmode="decimal" autocomplete="off" value="${esc(toField(f.monto))}" placeholder="0"></span>`)}
        ${fld('medio', 'Medio de pago', `<select id="g-medio" data-gf="medio">${G.MEDIOS.map(m => `<option${f.medio === m ? ' selected' : ''}>${m}</option>`).join('')}</select>`)}
      </div>
      <div class="g-opts">
        <label class="check"><input type="checkbox" id="g-pagado" data-gf="pagado" ${f.pagado ? 'checked' : ''}> Ya está pagado</label>
        ${f.pagado ? '' : `<label class="field g-vence" for="g-vence"><span>Vence</span><input id="g-vence" type="date" data-gf="vence" value="${esc(f.vence)}"></label>`}
        <label class="check"><input type="checkbox" id="g-fijo" data-gf="fijo" ${f.fijo ? 'checked' : ''}> Se repite todos los meses</label>
      </div>
      <div class="row g-actions">
        ${editando ? `<button class="btn danger" data-act="borrar" data-id="${f.id}">Borrar</button><span class="spacer"></span><button class="btn ghost" data-act="cancelar">Cancelar</button>` : '<span class="spacer"></span><button class="btn ghost" data-act="cancelar">Limpiar</button>'}
        <button class="btn primary" data-act="guardar">${editando ? 'Guardar cambios' : `${icon('plus', 16)} Agregar gasto`}</button>
      </div>
      <datalist id="g-provs">${provs.map(p => `<option value="${esc(p)}">`).join('')}</datalist>
    </section>`;
  }

  /* ---------- Cuentas a pagar ---------- */
  function aPagar() {
    const p = G.pendientes(todos(), today());
    if (!p.length) return '';
    return `
    <section class="card">
      <div class="card-title"><h3>Cuentas a pagar</h3><span class="total num neg">${money(U.sum(p, g => g.monto))}</span></div>
      <div class="table-wrap"><table class="num"><tbody>${p.map(g => `
        <tr>
          <td><b>${esc(g.detalle || G.cat(g.cat).l)}</b><div class="muted small">${esc(g.proveedor || 'Sin proveedor')} · ${shortDate(g.fecha)}</div></td>
          <td>${chip(g.estado.l, ESTADO_TONO[g.estado.k])}</td>
          <td class="r"><b>${money(g.monto)}</b></td>
          <td class="r">${store.state.readOnly ? '' : `<button class="btn small" data-act="pagar" data-id="${g.id}">${icon('check', 15)} Pagado</button>`}</td>
        </tr>`).join('')}</tbody></table></div>
    </section>`;
  }

  /* ---------- Lista del mes ---------- */
  function lista(m) {
    const q = S.q.trim().toLowerCase();
    const items = m.items.filter(g => (!S.cat || G.cat(g.cat).k === S.cat) && (!q || [g.proveedor, g.detalle, G.cat(g.cat).l, g.medio].join(' ').toLowerCase().includes(q)));
    if (!m.items.length) return empty(`No hay gastos cargados en ${monthOnly(S.ym)}.`);
    if (!items.length) return empty('Ningún gasto coincide con el filtro.');
    return `<div class="table-wrap"><table class="num g-tabla"><tbody>${items.map(g => {
      const c = G.cat(g.cat);
      return `<tr class="click${S.form && S.form.id === g.id ? ' sel' : ''}" data-act="editar" data-id="${g.id}">
        <td class="g-dia">${shortDate(g.fecha)}</td>
        <td><b>${esc(g.detalle || g.proveedor || c.l)}</b>
          <div class="muted small"><i class="cat-dot" style="background:${c.color}"></i>${esc([g.detalle ? g.proveedor : '', c.l, g.medio].filter(Boolean).join(' · '))}</div></td>
        <td class="r"><b>${money(g.monto)}</b><div>${g.pagado ? '' : chip('A pagar', 'warn')} ${g.fijo ? chip('Fijo', 'neutral') : ''}</div></td>
      </tr>`; }).join('')}</tbody>
      ${S.cat || q ? `<tfoot><tr><td></td><td>${items.length} gastos</td><td class="r">${money(U.sum(items, g => g.monto))}</td></tr></tfoot>` : ''}
    </table></div>`;
  }
  function filtros(m) {
    const usadas = G.CATS.filter(c => m.items.some(g => G.cat(g.cat).k === c.k));
    return `<div class="g-filtros">
      <div class="chips-row">${[{ k: '', l: 'Todas' }].concat(usadas).map(c => `<button class="fchip" data-act="filtro" data-cat="${c.k}" aria-pressed="${S.cat === c.k}">${c.l}</button>`).join('')}</div>
      <input type="search" id="g-q" value="${esc(S.q)}" placeholder="Buscar proveedor o detalle" aria-label="Buscar gastos">
    </div>`;
  }

  function lateral(m) {
    const max = Math.max(1, ...m.porCat.map(c => c.total));
    return `
    <div class="stack">
      <section class="card"><div class="card-title"><h3>Por categoría</h3></div>
        ${m.porCat.length ? `<div class="bars">${m.porCat.map(c => `<div class="bar-row g-bar"><span>${c.l}</span><span class="num r">${money(c.total)} <small class="muted">${pct(c.total / m.total)}</small></span><span class="track"><i style="width:${(c.total / max * 100).toFixed(1)}%;background:${c.color}"></i></span></div>`).join('')}</div>
          <p class="muted small g-split">Variables (suben con las ventas): <b class="num">${money(m.variables)}</b> · Fijos: <b class="num">${money(m.fijos)}</b></p>` : '<p class="muted small">Sin gastos este mes.</p>'}
      </section>
      <section class="card"><div class="card-title"><h3>Principales proveedores</h3></div>
        ${m.porProveedor.length ? `<table class="num"><tbody>${m.porProveedor.slice(0, 6).map(p => `<tr><td>${esc(p.nombre)}</td><td class="r">${money(p.total)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Sin gastos este mes.</p>'}
      </section>
    </div>`;
  }

  /* ---------- Sección ---------- */
  app.define({
    id: 'gastos', label: 'Gastos', icon: 'gastos', order: 30,
    collections: [COL],

    render() {
      if (!S.form) S.form = formNuevo();
      const lst = todos(), m = G.mes(lst, S.ym, today());
      const fijos = G.fijosParaCopiar(lst, S.ym);
      const venc = G.pendientes(lst, today()).filter(g => g.estado.k === 'vencido');
      return `
      <section class="page-head">${AMO.ui.monthNav(S.ym)}<span class="spacer"></span>
        ${!store.state.readOnly && fijos.length ? `<button class="btn small" data-act="traer-fijos">${icon('plus', 15)} Traer ${fijos.length} ${fijos.length === 1 ? 'gasto fijo' : 'gastos fijos'} de ${monthOnly(addMonths(S.ym, -1))}</button>` : ''}
      </section>
      <section class="kpis">
        ${kpi({ label: 'Gastos del mes', value: money(m.total), sub: `${m.items.length} comprobantes · sin sueldos`, hero: true })}
        ${kpi({ label: 'Mercadería y bebidas', value: money(m.mercaderia), sub: m.total ? `${pct(m.mercaderia / m.total)} de los gastos` : '' })}
        ${kpi({ label: 'Sin pagar del mes', value: money(m.montoImpago), sub: `${m.impagos} ${m.impagos === 1 ? 'cuenta' : 'cuentas'}`, tone: m.impagos ? 'neg' : '' })}
        ${kpi({ label: 'Vencidas', value: String(venc.length), sub: venc.length ? money(U.sum(venc, g => g.monto)) + ' en total' : 'Nada vencido', tone: venc.length ? 'neg' : '' })}
      </section>
      ${formulario()}
      ${aPagar()}
      <div class="grid-wide">
        <section class="card"><div class="card-title"><h3>Gastos de ${monthOnly(S.ym)}</h3></div>${filtros(m)}<div id="g-lista">${lista(m)}</div></section>
        ${lateral(m)}
      </div>`;
    },

    /* Campos del formulario: viven en memoria hasta tocar "Agregar". */
    input(el) {
      if (el.id === 'g-q') { S.q = el.value; redibujarLista(); return; }
      const k = el.dataset.gf; if (!k) return;
      const v = el.type === 'checkbox' ? el.checked : el.dataset.kind === 'money' ? parseNum(el.value) : el.value;
      S.form[k] = v;
      if (k === 'cat') S.catTocada = true;
      if (k === 'proveedor' && !S.form.id && !S.catTocada) {
        const sug = G.categoriaDe(todos(), v);
        if (sug) { S.form.cat = sug.cat; S.form.medio = sug.medio || S.form.medio; setVal('g-cat', S.form.cat); setVal('g-medio', S.form.medio); }
      }
      if (k === 'pagado') { if (v) { S.form.fechaPago = S.form.fechaPago || today(); S.form.vence = ''; } app.render(); app.focus('#g-pagado'); }
    },

    action(act, el) {
      if (act === 'month-prev' || act === 'month-next') { S.ym = addMonths(S.ym, act === 'month-prev' ? -1 : 1); S.cat = ''; if (!S.form.id) S.form = formNuevo({ medio: S.form.medio }); return app.render(); }
      if (act === 'filtro') { S.cat = el.dataset.cat; document.querySelectorAll('[data-act="filtro"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === S.cat)); return redibujarLista(); }
      if (act === 'editar') {
        const g = store.get(COL, el.dataset.id); if (!g) return;
        S.form = Object.assign(clone(g), { id: el.dataset.id }); S.catTocada = true;
        app.render(); document.getElementById('g-form').scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
      }
      if (store.state.readOnly) return;
      if (act === 'cancelar') { S.form = formNuevo({ medio: S.form.medio }); S.catTocada = false; return app.render(); }
      if (act === 'guardar') return guardar();
      if (act === 'borrar') {
        if (!confirmTap(el)) return;
        store.remove(COL, el.dataset.id); S.form = formNuevo(); S.catTocada = false; app.render(); toast('Gasto borrado'); return;
      }
      if (act === 'pagar') {
        const g = store.get(COL, el.dataset.id); if (!g) return;
        Object.assign(g, { pagado: true, fechaPago: today(), actualizado: new Date().toISOString() });
        store.save(COL, el.dataset.id, g, { delay: 0 }); app.render(); toast('Marcado como pagado'); return;
      }
      if (act === 'traer-fijos') {
        const nuevos = G.fijosParaCopiar(todos(), S.ym);
        const ahora = new Date().toISOString();
        nuevos.forEach(g => { const { id, ...doc } = g; store.save(COL, id, Object.assign(doc, { creado: ahora }), { delay: 0 }); });
        app.render(); toast(`Listo: ${nuevos.length} ${nuevos.length === 1 ? 'gasto fijo' : 'gastos fijos'}. Revisá los montos y marcalos cuando se paguen.`);
      }
    }
  });

  function guardar() {
    const f = S.form;
    if (!f.fecha) { toast('Falta la fecha', 'bad'); return app.focus('#g-fecha'); }
    if (!(parseNum(f.monto) > 0)) { toast('Falta el monto', 'bad'); return app.focus('#g-monto'); }
    const id = f.id || uid();
    const ahora = new Date().toISOString();
    const previo = f.id ? store.get(COL, f.id) : null;
    const doc = {
      fecha: f.fecha, proveedor: String(f.proveedor || '').trim(), cat: f.cat, detalle: String(f.detalle || '').trim(),
      monto: parseNum(f.monto), medio: f.medio, pagado: !!f.pagado, fechaPago: f.pagado ? (f.fechaPago || today()) : '',
      vence: f.pagado ? '' : (f.vence || ''), fijo: !!f.fijo,
      creado: (previo && previo.creado) || ahora, actualizado: ahora
    };
    if (previo && previo.ejemplo) doc.ejemplo = true;
    store.save(COL, id, doc, { delay: 0 });
    const editado = !!f.id;
    S.ym = ymOf(doc.fecha);
    S.form = formNuevo({ fecha: doc.fecha, medio: doc.medio }); S.catTocada = false;
    app.render();
    toast(editado ? 'Gasto actualizado' : `Agregado: ${money(doc.monto)}`);
    if (!editado) app.focus('#g-proveedor');
  }
  function redibujarLista() {
    const box = document.getElementById('g-lista'); if (!box) return;
    box.innerHTML = lista(G.mes(todos(), S.ym, today()));
  }
  function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
})();