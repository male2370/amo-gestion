/* =====================================================================
   AMO Gestión · sections/caja.js
   Sección 2: Caja diaria.
   Arriba, el día elegido: servicios con cubiertos y cobros por medio de
   pago, vinoteca, propinas y arqueo del efectivo. Abajo, el mes: tabla
   de días, totales, medios de pago y promedio por día de la semana.
   Las cuentas están en calc/caja.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, C = AMO.calc.caja, store = AMO.store, app = AMO.app;
  const { esc, money, integer, pct, today, ymOf, addDays, addMonths, longDate, weekdayShort, parseDate } = U;
  const { icon, kpi, empty, chip, input, field, toast, confirmTap } = AMO.ui;

  const S = { fecha: today(), ym: ymOf(today()) };
  const COL = 'caja';
  const b = path => `${COL}|${S.fecha}|${path}`;
  const docDelDia = () => app.docFor(COL, S.fecha);
  const MEDIO_COLOR = { efectivo: 'var(--accent)', tarjeta: '#3f7d5f', qr: 'var(--gold)', transf: '#c7ab78' };

  /* ---------- Partes de la pantalla ---------- */
  function cabecera() {
    return `
    <section class="page-head caja-head">
      <button class="icon-btn" data-act="dia-prev" aria-label="Día anterior">${icon('prev', 20)}</button>
      <h2>${longDate(S.fecha)}</h2>
      <button class="icon-btn" data-act="dia-next" aria-label="Día siguiente">${icon('next', 20)}</button>
      <span class="spacer"></span>
      <input type="date" id="caja-fecha" value="${S.fecha}" aria-label="Elegir día" class="date-pick">
      ${S.fecha !== today() ? `<button class="btn ghost small" data-act="dia-hoy">Hoy</button>` : ''}
    </section>`;
  }

  function filaServicio(s, i) {
    const ro = store.state.readOnly;
    return `
    <div class="serv-row">
      <label class="cell cell-name"><span class="cl">Servicio</span>${input({ bind: b(`servicios.${i}.nombre`), value: s.nombre, placeholder: 'Noche', id: `cj-${i}-nombre`, attrs: 'list="lista-servicios"', label: 'Servicio' })}</label>
      <label class="cell"><span class="cl">Cubiertos</span>${input({ bind: b(`servicios.${i}.cubiertos`), value: s.cubiertos, kind: 'num', id: `cj-${i}-cub`, label: 'Cubiertos' })}</label>
      ${C.MEDIOS.map(m => `<label class="cell"><span class="cl">${m.l}</span>${input({ bind: b(`servicios.${i}.${m.k}`), value: s[m.k], kind: 'money', id: `cj-${i}-${m.k}`, label: m.l })}</label>`).join('')}
      <div class="cell cell-total"><span class="cl">Total</span><b class="num" data-out="sv-${i}"></b><small class="muted num" data-out="svt-${i}"></small></div>
      ${ro ? '' : `<button class="icon-btn x" data-act="quitar-servicio" data-i="${i}" aria-label="Quitar servicio ${esc(s.nombre)}">${icon('close', 16)}</button>`}
    </div>`;
  }

  function servicios(doc) {
    const sv = doc.servicios || [];
    const cerrado = !C.abreNormalmente(S.fecha);
    return `
    <section class="card">
      <div class="card-title"><h3>Servicios</h3><span class="total num" data-out="salon"></span></div>
      ${sv.length ? `
        <div class="serv-head" aria-hidden="true"><span>Servicio</span><span>Cubiertos</span>${C.MEDIOS.map(m => `<span>${m.l}</span>`).join('')}<span class="r">Total</span><span></span></div>
        <div class="serv-list">${sv.map(filaServicio).join('')}</div>`
      : empty(cerrado ? `Los ${C.DIAS[U.weekdayIndex(S.fecha)].toLowerCase()} AMO no abre. Si hubo servicio igual, agregalo.` : 'No hay servicios cargados este día.')}
      ${store.state.readOnly ? '' : `<div class="row" style="margin-top:10px"><button class="btn small" data-act="agregar-servicio">${icon('plus', 16)} Servicio</button></div>`}
      <datalist id="lista-servicios"><option>Mediodía</option><option>Noche</option><option>Cata</option><option>Brunch</option><option>Evento</option></datalist>
    </section>`;
  }

  function extras(doc) {
    const v = doc.vinoteca || {};
    return `
    <div class="grid-2">
      <section class="card">
        <div class="card-title"><h3>Vinoteca</h3><span class="total num" data-out="vino"></span></div>
        <div class="fields">
          ${field({ label: 'Ventas del día', bind: b('vinoteca.monto'), value: v.monto, kind: 'money', id: 'cj-vino' })}
          ${field({ label: 'De eso, en efectivo', bind: b('vinoteca.efectivo'), value: v.efectivo, kind: 'money', id: 'cj-vino-ef' })}
        </div>
        <div class="fields" style="margin-top:10px">
          ${field({ label: 'Propinas', bind: b('propinas'), value: doc.propinas, kind: 'money', id: 'cj-prop', hint: 'Se registran aparte: no suman a la venta.' })}
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h3>Arqueo del efectivo</h3><span class="total" data-out="arqueo-chip"></span></div>
        <div class="fields">
          ${field({ label: 'Fondo inicial', bind: b('fondo'), value: doc.fondo, kind: 'money', id: 'cj-fondo', hint: 'Cambio con el que se abrió.' })}
          ${field({ label: 'Efectivo contado al cerrar', bind: b('contado'), value: doc.contado, kind: 'money', id: 'cj-contado' })}
        </div>
        <div class="arqueo num">
          <div><span class="muted">Debería haber</span><b data-out="esperado"></b></div>
          <div><span class="muted">Diferencia</span><b data-out="diferencia"></b></div>
        </div>
      </section>
    </div>
    <section class="card">
      <div class="fields">
        <label class="field" for="cj-nota"><span>Notas del día</span>${input({ bind: b('nota'), value: doc.nota, kind: 'textarea', id: 'cj-nota', placeholder: 'Clima, mesas grandes, faltantes, algo para recordar…' })}</label>
      </div>
      <div class="row" style="margin-top:10px">
        <label class="check"><input type="checkbox" id="cj-ok" data-bind="${b('controlada')}" ${doc.controlada ? 'checked' : ''}${store.state.readOnly ? ' disabled' : ''}> Caja controlada</label>
        <span class="muted small">Tildala cuando la caja del día esté revisada.</span>
      </div>
    </section>`;
  }

  function tablaMes(m) {
    if (!m.dias.length) return empty(`Todavía no hay días cargados en ${U.monthOnly(S.ym)}.`);
    return `<div class="table-wrap"><table class="num caja-tabla">
      <thead><tr><th>Día</th><th class="r">Cubiertos</th><th class="r">Salón</th><th class="r hide-s">Vinoteca</th><th class="r hide-s">Ticket</th><th class="r">Total</th><th class="hide-s"></th></tr></thead>
      <tbody>${m.dias.slice().reverse().map(d => `
        <tr class="click${d.fecha === S.fecha ? ' sel' : ''}" data-act="ir-dia" data-fecha="${d.fecha}">
          <td>${weekdayShort(d.fecha)} ${parseDate(d.fecha).getDate()}</td>
          <td class="r">${integer(d.cubiertos)}</td><td class="r">${money(d.salon)}</td>
          <td class="r hide-s">${money(d.vinoteca)}</td><td class="r hide-s">${d.cubiertos ? money(d.ticket) : '–'}</td>
          <td class="r"><b>${money(d.total)}</b></td>
          <td class="hide-s">${d.diferencia ? chip((d.diferencia > 0 ? 'Sobran ' : 'Faltan ') + money(Math.abs(d.diferencia)), 'warn') : d.controlada ? chip('Controlada', 'good') : ''}</td>
        </tr>`).join('')}</tbody>
      <tfoot><tr><td>Mes</td><td class="r">${integer(m.cubiertos)}</td><td class="r">${money(m.salon)}</td><td class="r hide-s">${money(m.vinoteca)}</td><td class="r hide-s">${money(m.ticket)}</td><td class="r">${money(m.total)}</td><td class="hide-s"></td></tr></tfoot>
    </table></div>`;
  }

  function mediosBar(medios, total) {
    if (!total) return '<p class="muted small">Sin cobros cargados.</p>';
    return `<div class="stack-bar">${C.MEDIOS.map(x => `<i style="width:${(medios[x.k] / total * 100).toFixed(1)}%;background:${MEDIO_COLOR[x.k]}"></i>`).join('')}</div>
      <div class="legend">${C.MEDIOS.map(x => `<span><i style="background:${MEDIO_COLOR[x.k]}"></i>${x.l} <b class="num">${pct(medios[x.k] / total)}</b></span>`).join('')}</div>`;
  }

  function resumenMes() {
    const m = C.mes(store.list(COL), S.ym);
    const maxDia = Math.max(1, ...m.porDia.map(x => x.promedio));
    return `
    <section class="month-block" id="caja-mes">
      ${AMO.ui.monthNav(S.ym, 'mes')}
      <div class="kpis">
        ${kpi({ label: 'Total del mes', value: money(m.total), sub: `${m.diasAbiertos} días con caja`, hero: true })}
        ${kpi({ label: 'Cubiertos', value: integer(m.cubiertos), sub: m.cubiertos ? `Ticket promedio ${money(m.ticket)}` : '' })}
        ${kpi({ label: 'Promedio por día', value: money(m.promedioDia), sub: m.mejor ? `Mejor: ${weekdayShort(m.mejor.fecha).toLowerCase()} ${parseDate(m.mejor.fecha).getDate()}, ${money(m.mejor.total)}` : '' })}
        ${kpi({ label: 'Sin controlar', value: integer(m.sinControlar), sub: m.diferencias ? `Diferencias de efectivo: ${money(m.diferencias)}` : 'días sin revisar', tone: m.sinControlar ? 'neg' : '' })}
      </div>
      <div class="grid-wide">
        <section class="card"><div class="card-title"><h3>Días</h3></div>${tablaMes(m)}</section>
        <div class="stack">
          <section class="card"><div class="card-title"><h3>Cómo pagaron en el salón</h3></div>${mediosBar(m.medios, m.salon)}</section>
          <section class="card"><div class="card-title"><h3>Promedio por día de la semana</h3></div>
            ${m.porDia.length ? `<div class="bars">${m.porDia.map(x => `<div class="bar-row"><span>${x.nombre}</span><span class="track"><i style="width:${(x.promedio / maxDia * 100).toFixed(1)}%"></i></span><span class="num r">${money(x.promedio)}<small class="muted"> · ${Math.round(x.cubiertos)} cub.</small></span></div>`).join('')}</div>` : '<p class="muted small">Aparece cuando haya días cargados.</p>'}
          </section>
        </div>
      </div>
    </section>`;
  }

  /* ---------- Sección ---------- */
  app.define({
    id: 'caja', label: 'Caja', icon: 'caja', order: 20,
    collections: [COL],
    defaults: { caja: id => C.nuevoDia(id) },

    render() {
      const doc = docDelDia();
      return `
        ${cabecera()}
        <section class="kpis">
          ${kpi({ label: 'Total del día', value: '', out: 'total', hero: true, sub: '<span data-out="total-sub"></span>' })}
          ${kpi({ label: 'Salón', value: '', out: 'salon-k' })}
          ${kpi({ label: 'Cubiertos', value: '', out: 'cub' })}
          ${kpi({ label: 'Ticket promedio', value: '', out: 'ticket' })}
        </section>
        ${servicios(doc)}
        ${extras(doc)}
        ${resumenMes()}`;
    },

    /** Actualiza números sin redibujar (mientras se escribe). */
    refresh() {
      const d = C.dia(docDelDia());
      const out = (k, v) => document.querySelectorAll(`#main [data-out="${k}"]`).forEach(el => { el.innerHTML = v; });
      out('total', money(d.total));
      out('total-sub', d.vinoteca ? `Salón + vinoteca ${money(d.vinoteca)}` : 'Salón y vinoteca');
      out('salon', money(d.salon)); out('salon-k', money(d.salon));
      out('cub', integer(d.cubiertos)); out('ticket', d.cubiertos ? money(d.ticket) : '–');
      out('vino', money(d.vinoteca));
      d.servicios.forEach((s, i) => { out('sv-' + i, money(s.total)); out('svt-' + i, s.cubiertos ? 'ticket ' + money(s.ticket) : ''); });
      out('esperado', money(d.esperado));
      out('diferencia', d.diferencia === null ? '–' : `<span class="${d.diferencia === 0 ? 'pos' : 'neg'}">${d.diferencia > 0 ? '+' : ''}${money(d.diferencia)}</span>`);
      out('arqueo-chip', d.diferencia === null ? '' : d.diferencia === 0 ? chip('Cierra justo', 'good') : chip(d.diferencia > 0 ? 'Sobra efectivo' : 'Falta efectivo', 'bad'));
      // el resumen del mes no tiene campos: se puede redibujar tranquilo
      const mesEl = document.getElementById('caja-mes');
      if (mesEl) mesEl.outerHTML = resumenMes();
    },

    change(el) { if (el.id === 'caja-fecha' && el.value) irA(el.value); },

    action(act, el) {
      if (act === 'dia-prev' || act === 'dia-next') return irA(addDays(S.fecha, act === 'dia-prev' ? -1 : 1));
      if (act === 'dia-hoy') return irA(today());
      if (act === 'ir-dia') { irA(el.dataset.fecha); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if (act === 'mes-prev' || act === 'mes-next') { S.ym = addMonths(S.ym, act === 'mes-prev' ? -1 : 1); return refreshMes(); }
      if (store.state.readOnly) return;
      if (act === 'agregar-servicio') {
        const doc = docDelDia(); doc.servicios = doc.servicios || [];
        doc.servicios.push(C.servicioVacio(doc.servicios.length ? '' : 'Noche'));
        store.save(COL, S.fecha, doc, { delay: 0 }); app.render();
        app.focus(`#cj-${doc.servicios.length - 1}-${doc.servicios.length === 1 ? 'cub' : 'nombre'}`);
      }
      if (act === 'quitar-servicio') {
        const doc = docDelDia(), i = +el.dataset.i, s = doc.servicios[i];
        const tieneDatos = s && C.totalServicio(s) + U.parseNum(s.cubiertos) > 0;
        if (tieneDatos && !confirmTap(el, '¿Quitar?')) return;
        doc.servicios.splice(i, 1); store.save(COL, S.fecha, doc, { delay: 0 }); app.render();
        if (tieneDatos) toast('Servicio quitado');
      }
    }
  });

  function irA(fecha) {
    store.flushAll();
    S.fecha = fecha; S.ym = ymOf(fecha);
    app.render();
  }
  function refreshMes() { const el = document.getElementById('caja-mes'); if (el) el.outerHTML = resumenMes(); }

})();