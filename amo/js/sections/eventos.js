/* =====================================================================
   AMO Gestión · sections/eventos.js
   Sección 5: Eventos cerrados.
   Dos pantallas:
   - Agenda: calendario del mes, totales y lista de eventos.
   - Ficha de un evento: datos, cobro y pagos, costos (mercadería,
     personal, otros), plan de la noche, y a la derecha la ganancia.
   Todo se guarda solo mientras se escribe. Las cuentas están en calc/eventos.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, E = AMO.calc.eventos, store = AMO.store, app = AMO.app;
  const { esc, money, pct, today, ymOf, addMonths, parseDate, toISO, longDate, monthOnly, uid, clone, integer } = U;
  const { icon, kpi, empty, chip, input, select, toast, confirmTap } = AMO.ui;
  const COL = 'eventos';

  const S = { ym: ymOf(today()), sel: today(), abierto: null, fechaNueva: today() };
  const cfg = () => store.get('config', 'general') || {};
  const ro = () => store.state.readOnly;
  const b = path => `${COL}|${S.abierto}|${path}`;
  const doc = () => app.docFor(COL, S.abierto);
  const COLORES = { merca: '#0f4a33', personal: 'var(--gold)', otros: '#7fae92', impuestos: '#9aa79f' };
  const BLANCOS = {
    extras: () => ({ d: '', m: '' }), otros: () => ({ d: '', m: '' }),
    mercaderia: () => ({ d: '', cant: '', u: 'kg', pu: '', pp: false }),
    personal: () => ({ rol: '', cant: 1, horas: 5, valorHora: '' }),
    cronograma: () => ({ h: '', a: '', ok: false }),
    pagos: () => ({ id: uid(), fecha: today(), monto: '', medio: 'Transferencia' })
  };

  /* =================== AGENDA =================== */
  function calendario(lista) {
    const [y, m] = S.ym.split('-').map(Number);
    const primero = new Date(y, m - 1, 1);
    const inicio = new Date(primero); inicio.setDate(1 - ((primero.getDay() + 6) % 7));
    const porDia = {};
    lista.forEach(e => { if (e.fecha) (porDia[e.fecha] = porDia[e.fecha] || []).push(e); });
    let h = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      if (i >= 35 && d.getMonth() !== m - 1) break;
      const f = toISO(d), evs = (porDia[f] || []).sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
      h += `<button class="cal-day${d.getMonth() !== m - 1 ? ' out' : ''}${f === today() ? ' today' : ''}${f === S.sel ? ' sel' : ''}" data-act="dia" data-fecha="${f}" aria-label="${longDate(f)}${evs.length ? `, ${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}` : ''}">
        <span class="cal-n">${d.getDate()}</span>
        ${evs.slice(0, 2).map(e => `<span class="cal-ev chip-${E.estado(e.estado).tono}">${esc(e.nombre || 'Sin nombre')}</span>`).join('')}
        ${evs.length > 2 ? `<span class="cal-more">+${evs.length - 2}</span>` : ''}
        ${evs.length ? `<span class="cal-dots">${evs.map(e => `<i class="chip-${E.estado(e.estado).tono}"></i>`).join('')}</span>` : ''}
      </button>`;
    }
    return `<div class="cal">${h}</div>`;
  }
  function itemEvento(e) {
    const c = E.calc(e, cfg()), d = parseDate(e.fecha), st = E.estado(e.estado);
    return `<button class="ev-item" data-act="abrir" data-id="${e.id}">
      <span class="ev-date"><b>${d.getDate()}</b><small>${d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</small></span>
      <span class="ev-txt"><span class="row" style="gap:8px"><b>${esc(e.nombre || 'Sin nombre')}</b>${chip(st.l, st.tono)}</span>
        <small class="muted">${esc([e.tipo, c.inv ? `${c.inv} invitados` : '', e.horaInicio ? `${e.horaInicio} h` : '', e.cliente].filter(Boolean).join(' · '))}</small></span>
      <span class="ev-money num"><b class="${c.ganancia >= 0 ? 'pos' : 'neg'}">${money(c.ganancia)}</b><small class="muted">de ${money(c.ingreso)}</small></span>
    </button>`;
  }
  function agenda() {
    const lista = store.list(COL), m = E.mes(lista, S.ym, cfg());
    const delDia = lista.filter(e => e.fecha === S.sel).sort((a, b) => (a.horaInicio || '').localeCompare(b.horaInicio || ''));
    return `
    <section class="page-head">${AMO.ui.monthNav(S.ym)}<span class="spacer"></span>
      ${S.ym !== ymOf(today()) ? `<button class="btn ghost small" data-act="hoy">Hoy</button>` : ''}
      ${ro() ? '' : `<button class="btn primary" data-act="nuevo">${icon('plus', 16)} Nuevo evento</button>`}
    </section>
    <section class="kpis">
      ${kpi({ label: 'Eventos', value: integer(m.activos), sub: m.presupuestos ? `+ ${m.presupuestos} ${m.presupuestos === 1 ? 'presupuesto' : 'presupuestos'} sin confirmar` : 'confirmados y realizados' })}
      ${kpi({ label: 'Invitados', value: integer(m.invitados) })}
      ${kpi({ label: 'Facturación', value: money(m.ingreso), sub: m.porCobrar ? `Falta cobrar ${money(m.porCobrar)}` : '' })}
      ${kpi({ label: 'Ganancia', value: money(m.ganancia), hero: true, sub: m.ingreso ? `Margen ${pct(m.ganancia / m.ingreso)}` : '' })}
    </section>
    <section class="card">${calendario(lista)}</section>
    <div class="grid-2">
      <section class="card">
        <div class="card-title"><h3>${longDate(S.sel)}</h3>${ro() ? '' : `<button class="btn small" data-act="nuevo-dia" style="margin-left:auto">${icon('plus', 15)} Evento</button>`}</div>
        ${delDia.length ? `<div class="ev-list">${delDia.map(itemEvento).join('')}</div>` : empty('No hay eventos este día.')}
      </section>
      <section class="card">
        <div class="card-title"><h3>Eventos de ${monthOnly(S.ym)}</h3></div>
        ${m.todos.length ? `<div class="ev-list">${m.todos.map(itemEvento).join('')}</div>` : empty('Todavía no hay eventos este mes.')}
      </section>
    </div>`;
  }

  /* =================== FICHA =================== */
  const quitar = (list, i) => ro() ? '<span></span>' : `<button class="icon-btn x" data-act="quitar-fila" data-list="${list}" data-i="${i}" aria-label="Quitar fila">${icon('close', 15)}</button>`;
  const agregar = (list, txt) => ro() ? '' : `<button class="btn small" data-act="agregar-fila" data-list="${list}">${icon('plus', 15)} ${txt}</button>`;
  const inp = (path, value, kind, ph, label, attrs) => input({ bind: b(path), value, kind, placeholder: ph, label: label || ph, id: 'ev-' + path.replace(/\./g, '-'), attrs });
  const tarjeta = (titulo, out, cuerpo) => `<section class="card"><div class="card-title"><h3>${titulo}</h3>${out ? `<span class="total num" data-out="${out}"></span>` : ''}</div>${cuerpo}</section>`;

  function ficha() {
    const e = doc(), c = cfg(), puestos = [...new Set(store.list('personal').map(p => (p.puesto || '').trim()).filter(Boolean))];
    const existe = !!store.get(COL, S.abierto);
    return `
    <div class="ev-bar">
      <button class="btn ghost" data-act="volver">${icon('prev', 18)} Agenda</button>
      <span class="spacer"></span>
      ${existe ? `<button class="btn small" data-act="copiar">Copiar presupuesto</button>` : ''}
      ${!ro() && existe ? `<button class="btn small" data-act="duplicar">Duplicar</button><button class="btn small danger" data-act="borrar">Borrar</button>` : ''}
    </div>
    <div class="ev-layout">
      <div class="ev-main">
        <section class="card">
          <input class="ev-title" id="ev-nombre" data-bind="${b('nombre')}" value="${esc(e.nombre)}" placeholder="Nombre del evento (ej. Cumple 40 de Laura)" aria-label="Nombre del evento"${ro() ? ' readonly' : ''}>
          <div class="fields">
            ${select({ label: 'Estado', bind: b('estado'), value: e.estado, options: E.ESTADOS.map(s => ({ v: s.k, l: s.l })), id: 'ev-estado' })}
            ${select({ label: 'Tipo', bind: b('tipo'), value: e.tipo, options: E.TIPOS, id: 'ev-tipo' })}
            <label class="field" for="ev-fecha"><span>Fecha</span>${inp('fecha', e.fecha, 'date', '', 'Fecha')}</label>
            <label class="field" for="ev-horaInicio"><span>Desde</span>${inp('horaInicio', e.horaInicio, 'time', '', 'Hora de inicio')}</label>
            <label class="field" for="ev-horaFin"><span>Hasta</span>${inp('horaFin', e.horaFin, 'time', '', 'Hora de fin')}</label>
            <label class="field" for="ev-invitados"><span>Invitados</span>${inp('invitados', e.invitados, 'num', '0', 'Invitados')}</label>
            <label class="field" for="ev-cliente"><span>Cliente</span>${inp('cliente', e.cliente, 'text', 'Quién contrata')}</label>
            <label class="field" for="ev-contacto"><span>Contacto</span>${inp('contacto', e.contacto, 'tel', 'Teléfono o mail')}</label>
          </div>
        </section>

        ${tarjeta('Lo que se cobra', 'ingreso', `
          <div class="fields"><label class="field" for="ev-precioPersona"><span>Precio por persona</span>${inp('precioPersona', e.precioPersona, 'money', '0', 'Precio por persona')}</label></div>
          <div class="ev-rows" style="margin-top:10px">${(e.extras || []).map((x, i) => `<div class="ev-row r-simple">${inp(`extras.${i}.d`, x.d, 'text', 'Extra (ej. barra libre, torta)')}${inp(`extras.${i}.m`, x.m, 'money', '0', 'Monto')}${quitar('extras', i)}</div>`).join('')}</div>
          <div class="row" style="margin-top:8px">${agregar('extras', 'Cobro extra')}</div>
          <p class="hint" data-out="sugerido"></p>`)}

        ${tarjeta('Pagos recibidos', 'cobrado', `
          ${(e.pagos || []).length ? `<div class="ev-rows">${e.pagos.map((p, i) => `<div class="ev-row r-pago">${inp(`pagos.${i}.fecha`, p.fecha, 'date', '', 'Fecha del pago')}${inp(`pagos.${i}.monto`, p.monto, 'money', '0', 'Monto')}${select({ label: '', bind: b(`pagos.${i}.medio`), value: p.medio, options: AMO.calc.gastos ? AMO.calc.gastos.MEDIOS.filter(x => x !== 'Cuenta corriente') : ['Transferencia', 'Efectivo'], id: `ev-pagos-${i}-medio` })}${quitar('pagos', i)}</div>`).join('')}</div>` : '<p class="muted small">Todavía no se recibió plata.</p>'}
          <div class="row" style="margin-top:8px">${agregar('pagos', 'Seña o pago')}<span class="spacer"></span><span class="small">Falta cobrar <b class="num" data-out="saldo"></b></span></div>`)}

        ${tarjeta('Mercadería', 'merca', `
          ${(e.mercaderia || []).length ? `<div class="ev-head r-merca" aria-hidden="true"><span>Producto</span><span>Cantidad</span><span>Por invitado</span><span>Unidad</span><span>$ por unidad</span><span class="r">Subtotal</span><span></span></div>` : ''}
          <div class="ev-rows">${(e.mercaderia || []).map((x, i) => `<div class="ev-row r-merca">
            <label class="cell c-name"><span class="cl">Producto</span>${inp(`mercaderia.${i}.d`, x.d, 'text', 'Ej. Vacío, Malbec, empanadas')}</label>
            <label class="cell"><span class="cl">Cantidad</span>${inp(`mercaderia.${i}.cant`, x.cant, 'num', '0', 'Cantidad')}</label>
            <label class="cell c-pp"><span class="cl">Por invitado</span><input type="checkbox" id="ev-mercaderia-${i}-pp" data-bind="${b(`mercaderia.${i}.pp`)}" ${x.pp ? 'checked' : ''}${ro() ? ' disabled' : ''} aria-label="La cantidad es por invitado"><small class="muted num" data-out="pp-${i}"></small></label>
            <label class="cell"><span class="cl">Unidad</span>${inp(`mercaderia.${i}.u`, x.u, 'text', 'kg', 'Unidad', 'list="ev-unidades"')}</label>
            <label class="cell"><span class="cl">$ por unidad</span>${inp(`mercaderia.${i}.pu`, x.pu, 'money', '0', 'Precio por unidad')}</label>
            <div class="cell r c-sub"><span class="cl">Subtotal</span><b class="num" data-out="m-${i}"></b></div>${quitar('mercaderia', i)}</div>`).join('')}</div>
          <div class="row" style="margin-top:8px">${agregar('mercaderia', 'Producto')}<span class="muted small">Tildá "por invitado" si la cantidad es por persona (ej. 3 empanadas c/u).</span></div>`)}

        ${tarjeta('Personal', 'personal', `
          ${(e.personal || []).length ? `<div class="ev-head r-pers" aria-hidden="true"><span>Puesto</span><span>Personas</span><span>Horas</span><span>$ por hora</span><span class="r">Subtotal</span><span></span></div>` : ''}
          <div class="ev-rows">${(e.personal || []).map((x, i) => `<div class="ev-row r-pers">
            <label class="cell c-name"><span class="cl">Puesto</span>${inp(`personal.${i}.rol`, x.rol, 'text', 'Moza, cocina…', 'Puesto', 'list="ev-puestos"')}</label>
            <label class="cell"><span class="cl">Personas</span>${inp(`personal.${i}.cant`, x.cant, 'num', '1', 'Personas')}</label>
            <label class="cell"><span class="cl">Horas</span>${inp(`personal.${i}.horas`, x.horas, 'num', '0', 'Horas')}</label>
            <label class="cell"><span class="cl">$ por hora</span>${inp(`personal.${i}.valorHora`, x.valorHora, 'money', '0', 'Valor de la hora')}</label>
            <div class="cell r c-sub"><span class="cl">Subtotal</span><b class="num" data-out="p-${i}"></b></div>${quitar('personal', i)}</div>`).join('')}</div>
          <div class="row" style="margin-top:8px">${agregar('personal', 'Puesto')}<span class="muted small">Si cobra un monto fijo por el evento, poné 1 hora y el monto como valor.</span></div>`)}

        ${tarjeta('Otros gastos', 'otros', `
          <div class="ev-rows">${(e.otros || []).map((x, i) => `<div class="ev-row r-simple">${inp(`otros.${i}.d`, x.d, 'text', 'Ej. decoración, música, vajilla alquilada')}${inp(`otros.${i}.m`, x.m, 'money', '0', 'Monto')}${quitar('otros', i)}</div>`).join('')}</div>
          <div class="row" style="margin-top:8px">${agregar('otros', 'Gasto')}</div>`)}

        ${tarjeta('Plan de la noche', '', `
          <div class="ev-rows">${(e.cronograma || []).map((x, i) => `<div class="ev-row r-crono"><input type="checkbox" id="ev-cronograma-${i}-ok" data-bind="${b(`cronograma.${i}.ok`)}" ${x.ok ? 'checked' : ''}${ro() ? ' disabled' : ''} aria-label="Hecho">${inp(`cronograma.${i}.h`, x.h, 'time', '', 'Hora')}${inp(`cronograma.${i}.a`, x.a, 'text', 'Qué pasa')}${quitar('cronograma', i)}</div>`).join('')}</div>
          <div class="row" style="margin-top:8px">${agregar('cronograma', 'Momento')}</div>
          <div class="fields" style="margin-top:14px">
            <label class="field" for="ev-menu"><span>Menú</span>${inp('menu', e.menu, 'textarea', 'Entradas, principal, postre, bebidas…', 'Menú')}</label>
            <label class="field" for="ev-notas"><span>Notas</span>${inp('notas', e.notas, 'textarea', 'Alergias, armado del salón, pedidos especiales…', 'Notas')}</label>
          </div>`)}
      </div>

      <aside class="ev-side">
        <section class="card">
          <p class="label">Ganancia estimada</p>
          <p class="ev-big num" data-out="ganancia"></p>
          <p class="muted small num" data-out="margen"></p>
          <div class="stack-bar" data-out="barra" style="margin-top:12px"></div>
          <div class="legend"><span><i style="background:${COLORES.merca}"></i>Mercadería</span><span><i style="background:${COLORES.personal}"></i>Personal</span><span><i style="background:${COLORES.otros}"></i>Otros</span><span><i style="background:${COLORES.impuestos}"></i>Impuestos</span><span><i style="background:var(--good)"></i>Ganancia</span></div>
        </section>
        <section class="card num ev-sum">
          <div><span>Cobro total</span><b data-out="ingreso"></b></div>
          <div><span>Mercadería</span><span data-out="merca"></span></div>
          <div><span>Personal</span><span data-out="personal"></span></div>
          <div><span>Otros gastos</span><span data-out="otros"></span></div>
          <div><span>Impuestos (${U.toField(c.impuestosVentas || 0)}%)</span><span data-out="impuestos"></span></div>
          <div class="tot"><span>Costo total</span><b data-out="costo"></b></div>
          <div><span>Costo por invitado</span><span data-out="costoInvitado"></span></div>
          <div><span>Ganancia por invitado</span><span data-out="gananciaInvitado"></span></div>
        </section>
        <section class="card">
          <div class="fields">${AMO.ui.field({ label: 'Ganancia que se busca (%)', bind: 'config|general|margenEvento', value: c.margenEvento === undefined ? E.MARGEN_DEFECTO : c.margenEvento, kind: 'num', id: 'ev-margen', hint: 'Para sugerir el precio por persona. Vale para todos los eventos.' })}</div>
        </section>
      </aside>
    </div>
    <div class="ev-mobile-total num"><span>Ganancia</span><b data-out="ganancia"></b></div>
    <datalist id="ev-unidades"><option>kg</option><option>g</option><option>u</option><option>l</option><option>botella</option><option>docena</option><option>porción</option><option>caja</option></datalist>
    <datalist id="ev-puestos">${['Moza', 'Mozo', 'Cocina', 'Bacha', 'Bartender', 'Encargado', 'Sommelier', 'Música'].concat(puestos).filter((x, i, a) => a.indexOf(x) === i).map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
  }

  function refrescarFicha() {
    const e = doc(), c = E.calc(e, cfg());
    const out = (k, v) => document.querySelectorAll(`#main [data-out="${k}"]`).forEach(el => { el.innerHTML = v; });
    ['ingreso', 'merca', 'personal', 'otros', 'impuestos', 'costo', 'cobrado'].forEach(k => out(k, money(c[k])));
    out('costoInvitado', c.inv ? money(c.costoInvitado) : '–'); out('gananciaInvitado', c.inv ? money(c.gananciaInvitado) : '–');
    out('saldo', `<span class="${c.saldo > 0 ? 'neg' : 'pos'}">${money(c.saldo)}</span>`);
    out('ganancia', `<span class="${c.ganancia >= 0 ? 'pos' : 'neg'}">${money(c.ganancia)}</span>`);
    out('margen', c.ingreso ? `Margen ${pct(c.margen)} sobre lo cobrado` : 'Cargá invitados y precio por persona');
    const tot = Math.max(c.ingreso, c.costo, 1);
    out('barra', [[c.merca, COLORES.merca], [c.personal, COLORES.personal], [c.otros, COLORES.otros], [c.impuestos, COLORES.impuestos], [Math.max(0, c.ganancia), 'var(--good)']]
      .map(([v, col]) => `<i style="width:${(v / tot * 100).toFixed(2)}%;background:${col}"></i>`).join(''));
    out('sugerido', c.precioSugerido
      ? `Para ganar un ${Math.round(c.margenBuscado * 100)}% con estos costos, el precio por persona tendría que ser de al menos <b>${money(c.precioSugerido)}</b>.`
      : `Con invitados y costos cargados, acá aparece el precio por persona para ganar un ${Math.round(c.margenBuscado * 100)}%.`);
    (e.mercaderia || []).forEach((x, i) => { out('m-' + i, money(E.subMerca(x, c.inv))); out('pp-' + i, x.pp && c.inv ? `= ${U.number(E.cantReal(x, c.inv))}` : ''); });
    (e.personal || []).forEach((x, i) => out('p-' + i, money(E.subPersonal(x))));
  }

  /* =================== Sección =================== */
  app.define({
    id: 'eventos', label: 'Eventos', icon: 'eventos', order: 40,
    collections: [COL, 'config', 'personal'],
    defaults: { eventos: () => E.nuevo(S.fechaNueva), config: () => ({}) },

    render() { return S.abierto ? ficha() : agenda(); },
    refresh() { if (S.abierto) refrescarFicha(); },

    changed(bind, value) {
      if (!S.abierto) return;
      // Puesto conocido del equipo que cobra por hora → completa el valor
      const m = bind.match(/\|personal\.(\d+)\.rol$/);
      if (m) {
        const e = doc(), fila = e.personal[+m[1]];
        const quien = store.list('personal').find(p => (p.puesto || '').trim().toLowerCase() === String(value).trim().toLowerCase() && p.forma === 'hora');
        if (quien && !U.parseNum(fila.valorHora)) {
          fila.valorHora = U.parseNum(quien.valor); store.save(COL, S.abierto, e, { delay: 0 });
          const el = document.getElementById(`ev-personal-${m[1]}-valorHora`); if (el) el.value = U.toField(fila.valorHora);
        }
      }
      if (/\|fecha$/.test(bind) && value) { S.sel = value; S.ym = ymOf(value); }
    },

    action(act, el) {
      if (act === 'month-prev' || act === 'month-next') { S.ym = addMonths(S.ym, act === 'month-prev' ? -1 : 1); return app.render(); }
      if (act === 'hoy') { S.ym = ymOf(today()); S.sel = today(); return app.render(); }
      if (act === 'dia') { S.sel = el.dataset.fecha; if (ymOf(S.sel) !== S.ym) S.ym = ymOf(S.sel); return app.render(); }
      if (act === 'abrir') return abrir(el.dataset.id);
      if (act === 'volver') { store.flushAll(); S.abierto = null; app.render(); return window.scrollTo(0, 0); }
      if (act === 'copiar') {
        const txt = E.presupuesto(doc(), cfg());
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Presupuesto copiado: pegalo en WhatsApp'), () => toast('Este dispositivo no deja copiar', 'bad'));
        return;
      }
      if (ro()) return;
      if (act === 'nuevo' || act === 'nuevo-dia') {
        S.fechaNueva = act === 'nuevo-dia' || ymOf(S.sel) === S.ym ? S.sel : S.ym + '-01';
        S.abierto = uid(); app.render(); window.scrollTo(0, 0); return app.focus('#ev-nombre');
      }
      if (act === 'agregar-fila') {
        const list = el.dataset.list, e = doc();
        e[list] = e[list] || []; e[list].push(BLANCOS[list]());
        if (list === 'pagos' && e.estado === 'presupuesto') e.estado = 'senado';
        store.save(COL, S.abierto, e, { delay: 0 }); app.render();
        const i = e[list].length - 1;
        return app.focus({ pagos: `#ev-pagos-${i}-monto`, cronograma: `#ev-cronograma-${i}-h`, mercaderia: `#ev-mercaderia-${i}-d`, personal: `#ev-personal-${i}-rol` }[list] || `#ev-${list}-${i}-d`);
      }
      if (act === 'quitar-fila') {
        const e = doc(); e[el.dataset.list].splice(+el.dataset.i, 1);
        store.save(COL, S.abierto, e, { delay: 0 }); return app.render();
      }
      if (act === 'duplicar') {
        store.flushAll();
        const copia = Object.assign(clone(doc()), { nombre: (doc().nombre || 'Evento') + ' (copia)', estado: 'presupuesto', pagos: [], creado: new Date().toISOString() });
        delete copia.id; delete copia.ejemplo;
        (copia.cronograma || []).forEach(x => { x.ok = false; });
        const id = uid(); store.save(COL, id, copia, { delay: 0 });
        abrir(id); return toast('Evento duplicado: cambiale la fecha y el nombre');
      }
      if (act === 'borrar') {
        if (!confirmTap(el)) return;
        store.remove(COL, S.abierto); S.abierto = null; app.render(); return toast('Evento borrado');
      }
    }
  });

  function abrir(id) {
    const e = store.get(COL, id); if (e && e.fecha) { S.sel = e.fecha; S.ym = ymOf(e.fecha); }
    S.abierto = id; app.render(); window.scrollTo(0, 0);
  }
})();