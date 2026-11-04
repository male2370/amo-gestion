/* =====================================================================
   AMO Gestión · sections/ajustes.js
   Sección 9: Ajustes y ejemplos (se entra con el engranaje).
   - Todos los porcentajes y opciones que usan los cálculos, en un lugar.
   - Datos de ejemplo: cargar para mostrar la app y borrar sin tocar lo real.
   - Respaldo: copiar todos los datos como texto y restaurarlos.
   ===================================================================== */
(() => {
  const U = AMO.utils, store = AMO.store, app = AMO.app;
  const { esc, integer, today, toField } = U;
  const { field, toast, confirmTap, chip, icon } = AMO.ui;
  const COLS = ['caja', 'gastos', 'personal', 'sueldos', 'eventos', 'platos', 'insumos', 'vinos', 'vinoMov'];
  const NOMBRES = { caja: 'Días de caja', gastos: 'Gastos', personal: 'Personas', sueldos: 'Sueldos', eventos: 'Eventos', platos: 'Platos', insumos: 'Insumos', vinos: 'Vinos', vinoMov: 'Movimientos de vinos' };

  const S = { trabajando: '', verRespaldo: false, restaurar: '' };
  const cfg = () => store.get('config', 'general') || {};
  const ro = () => store.state.readOnly;
  const ejemplos = () => COLS.flatMap(c => store.list(c).filter(x => x.ejemplo).map(x => ({ col: c, id: x.id })));
  const conDefecto = (v, d) => (v === undefined || v === '' ? d : v);

  function check(bind, value, label, hint) {
    return `<label class="a-check"><input type="checkbox" id="a-${bind.split('|')[2]}" data-bind="${bind}" ${value ? 'checked' : ''}${ro() ? ' disabled' : ''}><span><b>${label}</b><small class="muted">${hint}</small></span></label>`;
  }

  function calculos() {
    const c = cfg();
    return `
    <section class="card">
      <div class="card-title"><h3>Cálculos</h3></div>
      <div class="fields">
        ${field({ label: 'Impuestos sobre ventas (%)', bind: 'config|general|impuestosVentas', value: conDefecto(c.impuestosVentas, 0), kind: 'num', id: 'a-imp', hint: 'Ingresos brutos y comisiones estimadas. Dejalo en 0 si ya los cargás como facturas en Gastos.' })}
        ${field({ label: 'Cargas sociales sobre sueldos (%)', bind: 'config|general|cargas', value: conDefecto(c.cargas, 0), kind: 'num', id: 'a-cargas', hint: 'Se suma al costo del personal.' })}
        ${field({ label: 'Mercadería ideal en un plato (%)', bind: 'config|general|foodCost', value: conDefecto(c.foodCost, AMO.calc.carta.OBJETIVO_DEFECTO), kind: 'num', id: 'a-fc', hint: 'Qué parte del precio debería irse en ingredientes.' })}
        ${field({ label: 'Ganancia buscada en eventos (%)', bind: 'config|general|margenEvento', value: conDefecto(c.margenEvento, AMO.calc.eventos.MARGEN_DEFECTO), kind: 'num', id: 'a-mg', hint: 'Para sugerir el precio por persona.' })}
      </div>
      <div class="a-checks">
        ${check('config|general|provisionSAC', c.provisionSAC, 'Separar el aguinaldo todos los meses', 'Suma 1/12 del sueldo al costo de cada mes.')}
        ${check('config|general|eventosEnGastos', c.eventosEnGastos, 'Las compras de los eventos las cargo en Gastos', 'Así el Resumen no las cuenta dos veces (la ficha del evento y la factura).')}
        ${check('config|general|incluirPresupuestos', c.incluirPresupuestos, 'Contar presupuestos de eventos sin confirmar', 'Si no, solo cuentan los señados, confirmados y realizados.')}
      </div>
    </section>`;
  }

  function seccionEjemplos() {
    const ej = ejemplos();
    return `
    <section class="card">
      <div class="card-title"><h3>Datos de ejemplo</h3>${ej.length ? chip(`${integer(ej.length)} cargados`, 'accent') : ''}</div>
      <p class="muted small">Sirven para mostrar la app: cargan el mes pasado completo (caja, gastos, sueldos, un evento, platos y vinos) y un evento próximo. Todo dice "ejemplo" y se borra con un botón sin tocar lo que cargaron ustedes.</p>
      ${ro() ? '' : `<div class="row" style="margin-top:12px">
        ${ej.length ? `<button class="btn danger" data-act="borrar-ejemplos"${S.trabajando ? ' disabled' : ''}>Borrar datos de ejemplo</button>` : `<button class="btn primary" data-act="cargar-ejemplos"${S.trabajando ? ' disabled' : ''}>${icon('plus', 16)} Cargar datos de ejemplo</button>`}
        ${S.trabajando ? `<span class="muted small" data-out="a-prog">${esc(S.trabajando)}</span>` : ''}
      </div>`}
    </section>`;
  }

  function respaldo() {
    return `
    <section class="card">
      <div class="card-title"><h3>Respaldo</h3></div>
      <p class="muted small">Una copia de todos los datos como texto. Guardala en un mail o en un archivo cada tanto.</p>
      <div class="row" style="margin-top:12px">
        <button class="btn" data-act="copiar-respaldo">Copiar respaldo</button>
        <button class="btn ghost" data-act="ver-respaldo">${S.verRespaldo ? 'Ocultar' : 'Ver el texto'}</button>
      </div>
      ${S.verRespaldo ? `<textarea class="a-json" readonly aria-label="Respaldo">${esc(textoRespaldo())}</textarea>` : ''}
      ${ro() ? '' : `
      <details class="a-rest"${S.restaurar ? ' open' : ''}>
        <summary>Restaurar desde un respaldo</summary>
        <p class="muted small">Pegá el texto de un respaldo. Se suman y reemplazan los datos con el mismo nombre; no se borra nada que no esté en el respaldo.</p>
        <textarea id="a-restaurar" class="a-json" placeholder="Pegá acá el respaldo" aria-label="Respaldo a restaurar">${esc(S.restaurar)}</textarea>
        <button class="btn" data-act="restaurar" style="margin-top:8px">Restaurar</button>
      </details>`}
    </section>`;
  }

  function info() {
    const filas = COLS.map(c => [NOMBRES[c], store.list(c).length]).filter(x => x[1] > 0);
    return `
    <section class="card">
      <div class="card-title"><h3>Datos guardados</h3></div>
      <p class="small">${{ db: 'Se guardan en la base compartida de Claude: los ve cualquiera con quien se comparta la app, en el celular o en la compu.', api: 'Se guardan en el servidor de AMO (Cloudflare). Cualquiera que tenga la clave los ve desde el celular o la compu; se actualizan cada 15 segundos.' }[store.state.mode] || 'Se guardan solo en este navegador.'}</p>
      ${filas.length ? `<table class="num" style="margin-top:8px"><tbody>${filas.map(([n, c]) => `<tr><td>${n}</td><td class="r">${integer(c)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small" style="margin-top:8px">Todavía no hay nada cargado.</p>'}
      <div class="row" style="margin-top:12px"><button class="link-btn" data-nav="plan">Ver el plan de obra</button>${store.state.mode === 'api' ? `<span class="spacer"></span><button class="btn small" data-act="salir">Cerrar sesión en este dispositivo</button>` : ''}</div>
    </section>`;
  }

  function textoRespaldo() {
    const todo = store.exportar(), data = {};
    COLS.concat('config').forEach(c => { if (todo[c] && Object.keys(todo[c]).length) data[c] = todo[c]; });
    return JSON.stringify({ app: 'AMO Gestión', version: 1, fecha: new Date().toISOString(), data });
  }

  /** Espera a que terminen de guardarse las escrituras, mostrando cuántas faltan. */
  function esperarGuardado(total, fin) {
    const tick = () => {
      const faltan = store.pendientes();
      S.trabajando = faltan ? `Guardando… ${integer(total - faltan)} de ${integer(total)}` : '';
      const el = document.querySelector('[data-out="a-prog"]'); if (el) el.textContent = S.trabajando;
      if (faltan) return setTimeout(tick, 250);
      fin(); app.render();
    };
    tick();
  }

  app.define({
    id: 'ajustes', label: 'Ajustes', icon: 'ajustes', order: 90, nav: false,
    collections: COLS.concat('config'),
    defaults: { config: () => ({}) },

    render() {
      return `
      <section class="page-head"><h2>Ajustes</h2></section>
      <div class="grid-wide">
        <div class="stack">${calculos()}${respaldo()}</div>
        <div class="stack">${seccionEjemplos()}${info()}</div>
      </div>`;
    },

    changed(bind) { if (/eventosEnGastos|incluirPresupuestos|provisionSAC/.test(bind)) toast('Guardado'); },
    input(el) { if (el.id === 'a-restaurar') S.restaurar = el.value; },

    action(act, el) {
      if (act === 'salir') { if (!confirmTap(el, '¿Cerrar sesión? Tocá de nuevo')) return; return store.logout(); }
      if (act === 'ver-respaldo') { S.verRespaldo = !S.verRespaldo; return app.render(); }
      if (act === 'copiar-respaldo') {
        const txt = textoRespaldo();
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
          () => toast(`Respaldo copiado (${integer(Math.round(txt.length / 1024))} KB). Pegalo en un mail o un archivo.`),
          () => { S.verRespaldo = true; app.render(); toast('No se pudo copiar: seleccioná el texto y copialo a mano', 'bad'); });
        return;
      }
      if (ro()) return;
      if (act === 'cargar-ejemplos') {
        const { docs } = AMO.calc.ejemplo.armar(today());
        docs.forEach(d => store.save(d.col, d.id, d.doc, { delay: 0 }));
        S.trabajando = 'Guardando…'; app.render();
        return esperarGuardado(docs.length, () => toast(`Listo: ${integer(docs.length)} datos de ejemplo. Mirá el Resumen del mes pasado.`));
      }
      if (act === 'borrar-ejemplos') {
        if (!confirmTap(el, '¿Borrar todos los ejemplos? Tocá de nuevo')) return;
        const ej = ejemplos();
        S.trabajando = `Borrando ${integer(ej.length)}…`; app.render();
        (async () => { for (const x of ej) await store.remove(x.col, x.id); S.trabajando = ''; app.render(); toast('Datos de ejemplo borrados'); })();
        return;
      }
      if (act === 'restaurar') {
        let r;
        try { r = JSON.parse(S.restaurar); } catch (e) { return toast('Ese texto no es un respaldo válido', 'bad'); }
        if (!r || r.app !== 'AMO Gestión' || !r.data) return toast('Ese texto no es un respaldo de AMO Gestión', 'bad');
        if (!confirmTap(el, '¿Restaurar? Tocá de nuevo')) return;
        let n = 0;
        Object.entries(r.data).forEach(([col, docs]) => {
          if (!COLS.includes(col) && col !== 'config') return;
          Object.entries(docs || {}).forEach(([id, doc]) => { if (doc && typeof doc === 'object') { store.save(col, id, doc, { delay: 0 }); n++; } });
        });
        S.restaurar = ''; S.trabajando = 'Guardando…'; app.render();
        return esperarGuardado(n, () => toast(`Respaldo restaurado: ${integer(n)} datos`));
      }
    }
  });
})();