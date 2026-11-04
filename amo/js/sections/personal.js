/* =====================================================================
   AMO Gestión · sections/personal.js
   Sección 4: Personal y sueldos.
   - Liquidación del mes: por persona, horas o turnos, extras, descuentos,
     adelantos, cuánto falta pagar y si ya cobró.
   - Adelantos con fecha (se descuentan solos de lo que falta pagar).
   - Equipo: alta y baja por mes, forma de cobro y valor.
   - Cargas sociales y provisión de aguinaldo.
   Las cuentas están en calc/personal.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, P = AMO.calc.personal, store = AMO.store, app = AMO.app;
  const { esc, money, pct, today, ymOf, addMonths, shortDate, parseNum, toField, uid, monthOnly, monthName } = U;
  const { icon, kpi, empty, chip, input, field, select, toast, confirmTap } = AMO.ui;

  const S = { ym: ymOf(today()), adel: { persona: '', fecha: today(), monto: '' }, abierta: null };
  const cfg = () => store.get('config', 'general') || {};
  const sb = (id, path) => `sueldos|${P.idSueldo(S.ym, id)}|${path}`;
  const pb = (id, path) => `personal|${id}|${path}`;
  const ro = () => store.state.readOnly;
  const datos = () => P.mes(store.list('personal'), store.list('sueldos'), S.ym, cfg());

  /* ---------- Liquidación ---------- */
  function filaSueldo(f) {
    const p = f.persona, fm = P.forma(p.forma), s = f.sueldo || {};
    return `
    <div class="p-row${f.pagado ? ' is-paid' : ''}">
      <div class="p-who"><b>${esc(p.nombre || 'Sin nombre')}</b><small class="muted">${esc(p.puesto || 'Sin puesto')} · ${money(p.valor)} ${fm.unidad}</small></div>
      <label class="cell"><span class="cl">${fm.cant || 'Horas / turnos'}</span>${fm.k === 'mensual' ? '<span class="p-na muted">Mensual</span>' : input({ bind: sb(p.id, 'cant'), value: s.cant, kind: 'num', id: `ps-${p.id}-cant`, label: fm.cant, placeholder: fm.cant })}</label>
      <label class="cell"><span class="cl">Extras y bonos</span>${input({ bind: sb(p.id, 'extras'), value: s.extras, kind: 'money', id: `ps-${p.id}-ext`, label: 'Extras y bonos' })}</label>
      <label class="cell"><span class="cl">Descuentos</span>${input({ bind: sb(p.id, 'descuentos'), value: s.descuentos, kind: 'money', id: `ps-${p.id}-desc`, label: 'Descuentos' })}</label>
      <div class="cell r"><span class="cl">Sueldo</span><b class="num" data-out="br-${p.id}"></b><small class="muted num" data-out="ad-${p.id}"></small></div>
      <div class="cell r"><span class="cl">Falta pagar</span><b class="num" data-out="ap-${p.id}"></b></div>
      <label class="cell p-ok"><span class="cl">Cobró</span><input type="checkbox" id="ps-${p.id}-ok" data-bind="${sb(p.id, 'pagado')}" ${f.pagado ? 'checked' : ''}${ro() ? ' disabled' : ''} aria-label="Ya cobró ${esc(p.nombre)}"></label>
    </div>`;
  }
  function liquidacion(m) {
    if (!m.filas.length) return `<section class="card"><div class="card-title"><h3>Sueldos de ${monthOnly(S.ym)}</h3></div>${empty('Cargá el equipo más abajo y acá se calculan los sueldos del mes.')}</section>`;
    return `
    <section class="card">
      <div class="card-title"><h3>Sueldos de ${monthOnly(S.ym)}</h3>
        ${!ro() && m.pendientes ? `<button class="btn small" data-act="pagar-todos" style="margin-left:auto">${icon('check', 15)} Marcar todos cobrados</button>` : ''}</div>
      <div class="p-head" aria-hidden="true"><span>Persona</span><span>Horas / turnos</span><span>Extras</span><span>Descuentos</span><span class="r">Sueldo</span><span class="r">Falta pagar</span><span class="r">Cobró</span></div>
      <div class="p-list">${m.filas.map(filaSueldo).join('')}</div>
      <div class="p-foot num"><span>Total</span><b data-out="tot-bruto"></b><b data-out="tot-falta"></b></div>
    </section>`;
  }

  /* ---------- Adelantos ---------- */
  function adelantos(m) {
    const a = S.adel, gente = m.filas.map(f => f.persona);
    return `
    <section class="card">
      <div class="card-title"><h3>Adelantos</h3><span class="total num">${money(m.adelantos)}</span></div>
      ${ro() || !gente.length ? '' : `
      <div class="fields p-adel-form">
        <label class="field" for="pa-persona"><span>Persona</span><select id="pa-persona" data-af="persona"><option value="">Elegí…</option>${gente.map(p => `<option value="${p.id}"${a.persona === p.id ? ' selected' : ''}>${esc(p.nombre || 'Sin nombre')}</option>`).join('')}</select></label>
        <label class="field" for="pa-fecha"><span>Fecha</span><input id="pa-fecha" type="date" data-af="fecha" value="${esc(a.fecha)}"></label>
        <label class="field" for="pa-monto"><span>Monto</span><span class="money"><input id="pa-monto" data-af="monto" data-kind="money" type="text" inputmode="decimal" value="${esc(toField(a.monto))}" placeholder="0"></span></label>
        <div class="field p-adel-btn"><span>&nbsp;</span><button class="btn primary" data-act="adelanto">${icon('plus', 15)} Anotar</button></div>
      </div>`}
      ${m.adelantosLista.length ? `<div class="table-wrap"><table class="num"><tbody>${m.adelantosLista.map(x => `
        <tr><td>${shortDate(x.fecha)}</td><td>${esc(x.persona.nombre || 'Sin nombre')}</td><td class="r">${money(x.monto)}</td>
        <td class="r">${ro() ? '' : `<button class="icon-btn x" data-act="quitar-adelanto" data-p="${x.persona.id}" data-id="${x.id}" aria-label="Borrar adelanto">${icon('close', 15)}</button>`}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="muted small">${gente.length ? 'No hubo adelantos este mes.' : 'Primero cargá el equipo.'}</p>`}
    </section>`;
  }

  /* ---------- Equipo ---------- */
  function persona(p) {
    const abierta = S.abierta === p.id, fm = P.forma(p.forma), activa = P.trabajaEn(p, S.ym);
    if (!abierta) return `
      <button class="p-card" data-act="abrir" data-id="${p.id}">
        <span class="p-avatar" aria-hidden="true">${esc((p.nombre || '?').trim().charAt(0).toUpperCase())}</span>
        <span class="p-card-txt"><b>${esc(p.nombre || 'Sin nombre')}</b><small class="muted">${esc(p.puesto || 'Sin puesto')} · ${money(p.valor)} ${fm.unidad}</small></span>
        ${activa ? '' : chip(p.baja && p.baja < S.ym ? 'De baja' : 'Todavía no entró', 'neutral')}
      </button>`;
    return `
      <div class="p-edit" id="pe-${p.id}">
        <div class="fields">
          ${field({ label: 'Nombre', bind: pb(p.id, 'nombre'), value: p.nombre, placeholder: 'Nombre y apellido', id: `pe-${p.id}-n` })}
          ${field({ label: 'Puesto', bind: pb(p.id, 'puesto'), value: p.puesto, placeholder: 'Moza, cocina, bacha…', id: `pe-${p.id}-p`, attrs: 'list="p-puestos"' })}
          ${select({ label: 'Cómo cobra', bind: pb(p.id, 'forma'), value: p.forma, options: P.FORMAS.map(f => ({ v: f.k, l: f.l })), id: `pe-${p.id}-f` })}
          ${field({ label: fm.k === 'mensual' ? 'Sueldo por mes' : fm.k === 'hora' ? 'Valor de la hora' : 'Valor del turno', bind: pb(p.id, 'valor'), value: p.valor, kind: 'money', id: `pe-${p.id}-v` })}
          ${field({ label: 'Trabaja desde', bind: pb(p.id, 'desde'), value: p.desde, kind: 'month', id: `pe-${p.id}-d` })}
          ${field({ label: 'Último mes (si se fue)', bind: pb(p.id, 'baja'), value: p.baja, kind: 'month', id: `pe-${p.id}-b`, hint: 'Vacío si sigue trabajando.' })}
          ${field({ label: 'Teléfono', bind: pb(p.id, 'tel'), value: p.tel, kind: 'tel', placeholder: 'Opcional', id: `pe-${p.id}-t` })}
        </div>
        <div class="row" style="margin-top:12px">
          ${ro() ? '' : `<button class="btn small danger" data-act="borrar-persona" data-id="${p.id}">Borrar</button>`}
          <span class="spacer"></span><button class="btn small primary" data-act="cerrar-persona">Listo</button>
        </div>
      </div>`;
  }
  function equipo() {
    const gente = store.list('personal').sort((a, b) => (P.trabajaEn(b, S.ym) - P.trabajaEn(a, S.ym)) || String(a.nombre || '').localeCompare(String(b.nombre || '')));
    const puestos = [...new Set(gente.map(p => (p.puesto || '').trim()).filter(Boolean))];
    return `
    <section class="card">
      <div class="card-title"><h3>Equipo</h3>${ro() ? '' : `<button class="btn small" data-act="nueva-persona" style="margin-left:auto">${icon('plus', 15)} Persona</button>`}</div>
      ${gente.length ? `<div class="p-team">${gente.map(persona).join('')}</div>` : empty('Todavía no hay nadie cargado.')}
      <datalist id="p-puestos">${['Moza', 'Mozo', 'Cocina', 'Ayudante de cocina', 'Bacha', 'Encargado', 'Bartender', 'Sommelier'].concat(puestos).filter((x, i, a) => a.indexOf(x) === i).map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    </section>`;
  }

  function lateral(m) {
    const c = cfg(), max = Math.max(1, ...m.porPuesto.map(x => x.costo));
    return `
    <div class="stack">
      <section class="card"><div class="card-title"><h3>Costo por puesto</h3></div>
        ${m.porPuesto.length ? `<div class="bars">${m.porPuesto.map(x => `<div class="bar-row g-bar"><span>${esc(x.puesto)}</span><span class="num r">${money(x.costo)}</span><span class="track"><i style="width:${(x.costo / max * 100).toFixed(1)}%"></i></span></div>`).join('')}</div>` : '<p class="muted small">Sin sueldos este mes.</p>'}
      </section>
      <section class="card"><div class="card-title"><h3>Cargas y aguinaldo</h3></div>
        <div class="fields">${field({ label: 'Cargas sociales (%)', bind: 'config|general|cargas', value: c.cargas, kind: 'num', id: 'p-cargas', hint: 'Aportes y contribuciones sobre el sueldo. 0 si no aplica.' })}</div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="p-sac" data-bind="config|general|provisionSAC" ${c.provisionSAC ? 'checked' : ''}${ro() ? ' disabled' : ''}> Separar el aguinaldo todos los meses</label>
        <p class="muted small" style="margin-top:6px">Suma 1/12 del sueldo al costo de cada mes, así junio y diciembre no caen de golpe.</p>
      </section>
    </div>`;
  }

  /* ---------- Sección ---------- */
  app.define({
    id: 'personal', label: 'Personal', icon: 'personal', order: 50,
    collections: ['personal', 'sueldos', 'config'],
    defaults: { sueldos: id => P.nuevoSueldo(id), personal: () => P.nuevaPersona(S.ym), config: () => ({}) },

    render() {
      const m = datos(), c = cfg();
      const extra = [c.cargas ? `cargas ${toField(c.cargas)}%` : '', c.provisionSAC ? 'aguinaldo' : ''].filter(Boolean).join(' y ');
      return `
      <section class="page-head">${AMO.ui.monthNav(S.ym)}</section>
      <section class="kpis">
        ${kpi({ label: 'Costo del personal', value: '', out: 'k-costo', hero: true, sub: extra ? `Sueldos + ${extra}` : 'Sueldos (sin cargas)' })}
        ${kpi({ label: 'Sueldos del mes', value: '', out: 'k-bruto', sub: `${m.filas.length} ${m.filas.length === 1 ? 'persona' : 'personas'}` })}
        ${kpi({ label: 'Falta pagar', value: '', out: 'k-falta', sub: '<span data-out="k-falta-sub"></span>' })}
        ${kpi({ label: 'Adelantos dados', value: money(m.adelantos), sub: `${m.adelantosLista.length} en el mes` })}
      </section>
      ${liquidacion(m)}
      <div class="grid-wide">
        <div class="stack">${adelantos(m)}${equipo()}</div>
        ${lateral(m)}
      </div>`;
    },

    refresh() {
      const m = datos();
      const out = (k, v) => document.querySelectorAll(`#main [data-out="${k}"]`).forEach(el => { el.innerHTML = v; });
      out('k-costo', money(m.costo)); out('k-bruto', money(m.bruto));
      out('k-falta', `<span class="${m.faltaPagar > 0 ? 'neg' : ''}">${money(m.faltaPagar)}</span>`);
      out('k-falta-sub', m.pendientes ? `${m.pendientes} sin cobrar` : 'Todos cobraron');
      out('tot-bruto', money(m.bruto)); out('tot-falta', money(m.faltaPagar));
      m.filas.forEach(f => {
        const id = f.persona.id;
        out('br-' + id, money(f.bruto));
        out('ad-' + id, f.adelantos ? `− ${money(f.adelantos)} adelanto` : '');
        out('ap-' + id, f.pagado ? chip('Cobró', 'good') : money(f.aPagar));
      });
    },

    /* Cambios que mueven la pantalla: forma de cobro, fechas, cobró. */
    changed(bind) {
      if (/\|(forma|desde|baja|pagado|provisionSAC)$/.test(bind)) { const a = document.activeElement && document.activeElement.id; app.render(); if (a) app.focus('#' + a); }
    },

    input(el) {
      const k = el.dataset.af; if (!k) return;
      S.adel[k] = el.dataset.kind === 'money' ? parseNum(el.value) : el.value;
    },

    action(act, el) {
      if (act === 'month-prev' || act === 'month-next') { S.ym = addMonths(S.ym, act === 'month-prev' ? -1 : 1); S.abierta = null; return app.render(); }
      if (act === 'abrir') { S.abierta = el.dataset.id; app.render(); return app.focus(`#pe-${el.dataset.id}-n`); }
      if (act === 'cerrar-persona') { store.flushAll(); S.abierta = null; return app.render(); }
      if (ro()) return;
      if (act === 'nueva-persona') {
        const id = uid();
        store.save('personal', id, Object.assign(P.nuevaPersona(S.ym), { creado: new Date().toISOString() }), { delay: 0 });
        S.abierta = id; app.render(); return app.focus(`#pe-${id}-n`);
      }
      if (act === 'borrar-persona') {
        if (!confirmTap(el, '¿Borrar? Tocá de nuevo')) return;
        store.remove('personal', el.dataset.id); S.abierta = null; app.render();
        return toast('Persona borrada. Si se fue, conviene poner su último mes en vez de borrarla.');
      }
      if (act === 'pagar-todos') {
        datos().filas.filter(f => !f.pagado && f.bruto > 0).forEach(f => {
          const id = P.idSueldo(S.ym, f.persona.id);
          store.save('sueldos', id, Object.assign(app.docFor('sueldos', id), { pagado: true, fechaPago: today() }), { delay: 0 });
        });
        app.render(); return toast('Todos marcados como cobrados');
      }
      if (act === 'adelanto') {
        const a = S.adel;
        if (!a.persona) { toast('Elegí a quién', 'bad'); return app.focus('#pa-persona'); }
        if (!(parseNum(a.monto) > 0)) { toast('Falta el monto', 'bad'); return app.focus('#pa-monto'); }
        // El adelanto cuenta en el mes de su fecha
        const ym = ymOf(a.fecha || today()), id = P.idSueldo(ym, a.persona);
        const s = app.docFor('sueldos', id); s.adelantos = s.adelantos || [];
        s.adelantos.push({ id: uid(), fecha: a.fecha || today(), monto: parseNum(a.monto) });
        store.save('sueldos', id, s, { delay: 0 });
        const quien = (store.get('personal', a.persona) || {}).nombre || '';
        S.adel = { persona: '', fecha: a.fecha, monto: '' };
        if (ym !== S.ym) S.ym = ym;
        app.render(); return toast(`Adelanto anotado${quien ? ' para ' + quien : ''}: ${money(s.adelantos[s.adelantos.length - 1].monto)}`);
      }
      if (act === 'quitar-adelanto') {
        if (!confirmTap(el, '¿Borrar?')) return;
        const id = P.idSueldo(S.ym, el.dataset.p), s = app.docFor('sueldos', id);
        s.adelantos = (s.adelantos || []).filter(x => x.id !== el.dataset.id);
        store.save('sueldos', id, s, { delay: 0 }); app.render(); return toast('Adelanto borrado');
      }
    }
  });
})();