/* =====================================================================
   AMO Gestión · sections/inicio.js
   Sección 8: Resumen. La primera pantalla.
   Junta todas las secciones: avisos de lo urgente, ventas, gastos y
   resultado del mes, estado de resultados, punto de equilibrio,
   historial de 6 meses, vinoteca y próximos eventos.
   No tiene campos: solo lee. Las cuentas están en calc/resumen.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, R = AMO.calc.resumen, store = AMO.store, app = AMO.app;
  const { esc, money, moneyShort, pct, today, ymOf, addMonths, monthOnly, monthShort, integer, longDate, parseDate } = U;
  const { icon, kpi, empty, chip } = AMO.ui;
  const COLS = ['caja', 'gastos', 'personal', 'sueldos', 'eventos', 'vinos', 'vinoMov', 'platos', 'insumos', 'config'];

  const S = { ym: ymOf(today()) };
  const datos = () => Object.assign(Object.fromEntries(COLS.filter(c => c !== 'config').map(c => [c, store.list(c)])), { config: store.get('config', 'general') || {} });

  /* ---------- Gráfico de 6 meses (SVG, sin librerías) ---------- */
  function grafico(hist) {
    const W = 600, H = 230, L = 58, B = 28, T = 12;
    const max = Math.max(1, ...hist.map(h => Math.max(h.ventas, h.costos)));
    const paso = escalon(max / 3), tope = Math.ceil(max / paso) * paso;
    const y = v => T + (H - T - B) * (1 - v / tope);
    const gw = (W - L - 8) / hist.length, bw = Math.min(24, gw / 3.2);
    let g = '';
    for (let v = 0; v <= tope + 1; v += paso) g += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${moneyShort(v)}</text>`;
    hist.forEach((h, i) => {
      const cx = L + gw * i + gw / 2, ult = i === hist.length - 1;
      g += `<rect x="${cx - bw - 2}" y="${y(h.ventas)}" width="${bw}" height="${Math.max(0, H - B - y(h.ventas))}" rx="3" fill="var(--accent)"><title>Ventas ${money(h.ventas)}</title></rect>`;
      g += `<rect x="${cx + 2}" y="${y(h.costos)}" width="${bw}" height="${Math.max(0, H - B - y(h.costos))}" rx="3" fill="var(--gold)"><title>Gastos ${money(h.costos)}</title></rect>`;
      g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="12" font-weight="${ult ? 700 : 500}" fill="var(--${ult ? 'ink' : 'muted'})">${monthShort(h.ym)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas y gastos de los últimos 6 meses">${g}</svg>`;
  }
  function escalon(x) { if (x <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }

  /* ---------- Bloques ---------- */
  function avisos(lista) {
    if (!lista.length) return '';
    return `<section class="card r-avisos"><div class="card-title"><h3>Para atender</h3></div>
      <div class="r-aviso-list">${lista.map(a => `<button class="r-aviso t-${a.tono}" data-nav="${a.ir}"><i></i><span>${esc(a.txt)}</span>${a.monto ? `<b class="num">${money(a.monto)}</b>` : ''}${icon('next', 16)}</button>`).join('')}</div></section>`;
  }
  function delta(v, invertir = false) {
    if (v === null || !Number.isFinite(v)) return '';
    const bueno = invertir ? v <= 0 : v >= 0;
    return `<span class="${bueno ? 'pos' : 'neg'}">${v >= 0 ? '▲' : '▼'} ${pct(Math.abs(v))}</span> vs. ${monthOnly(addMonths(S.ym, -1))}`;
  }
  function estadoResultados(m) {
    const e = R.estado(m), max = Math.max(1, ...e.costos.map(r => r[1]));
    return `
    <section class="card">
      <div class="card-title"><h3>Estado de resultados</h3><span class="total muted small">${monthOnly(S.ym)}</span></div>
      <div class="r-er num">
        <div class="r-er-h"><span>Ingresos</span><b>${money(m.ventas)}</b></div>
        ${e.ingresos.map(([l, v]) => `<div class="r-er-row"><span>${l}</span><span>${money(v)}</span></div>`).join('')}
        <div class="r-er-h" style="margin-top:12px"><span>Costos</span><b>${money(m.costos)}</b></div>
        ${e.costos.length ? e.costos.map(([l, v, c]) => `<div class="r-er-row bar"><span>${esc(l)}</span><span>${money(v)} <small class="muted">${pct(v / m.costos)}</small></span><i style="width:${(v / max * 100).toFixed(1)}%;background:${c}"></i></div>`).join('') : '<p class="muted small">Sin costos cargados.</p>'}
        <div class="r-er-res ${m.resultado >= 0 ? 'pos' : 'neg'}"><span>Resultado</span><b>${money(m.resultado)}</b></div>
      </div>
      ${m.evCostos === 0 && m.eventos.directo > 0 ? '<p class="muted small" style="margin-top:8px">Los costos de los eventos no se suman acá porque están cargados como facturas en Gastos (se cambia en Ajustes).</p>' : ''}
    </section>`;
  }
  function equilibrio(m) {
    const e = m.equilibrio, hecho = U.ratio(m.caja.total, e.ventas);
    return `
    <section class="card">
      <div class="card-title"><h3>Punto de equilibrio</h3></div>
      ${e.ventas > 0 ? `
        <p class="r-big num">${money(e.ventas)}</p>
        <p class="muted small">Es lo que hay que vender en el mes (salón y vinoteca) para cubrir los gastos fijos y los sueldos${m.eventos.activos ? ', ya contando lo que dejan los eventos' : ''}.${e.cubiertos ? ` Con el ticket de este mes son unos <b>${integer(e.cubiertos)} cubiertos</b>.` : ''}${e.prestado ? ` Como el mes recién empieza, usa el % de mercadería de ${monthOnly(addMonths(S.ym, -1))} (${pct(e.ratioVariables)}).` : ''}</p>
        <div class="stack-bar" style="margin-top:12px;height:14px"><i style="width:${Math.min(100, hecho * 100).toFixed(1)}%;background:${e.alcanzado ? 'var(--good)' : 'var(--gold)'}"></i></div>
        <p class="small" style="margin-top:8px">${e.alcanzado ? `<span class="pos">Superado por ${money(m.caja.total - e.ventas)}.</span>` : `Van ${pct(hecho)}. Faltan <b class="num">${money(e.falta)}</b>${e.cubiertos && m.ticket ? ` (unos ${integer(Math.ceil(e.falta / m.ticket))} cubiertos)` : ''}.`}</p>`
      : `<p class="muted small">Aparece cuando haya caja y gastos cargados en el mes.</p>`}
    </section>`;
  }
  function vinoteca(d) {
    if (!d.vinos.length) return '';
    const cat = AMO.calc.vinoteca.catalogo(d.vinos, d.vinoMov, today());
    return `<section class="card">
      <div class="card-title"><h3>Vinoteca</h3><button class="btn small" data-nav="vinoteca" style="margin-left:auto">Ver stock</button></div>
      <div class="r-mini num"><div><span class="muted small">Botellas</span><b>${integer(cat.botellas)}</b></div><div><span class="muted small">Al costo</span><b>${money(cat.valorCosto)}</b></div><div><span class="muted small">Para reponer</span><b class="${cat.reponer.length ? 'neg' : ''}">${cat.reponer.length}</b></div></div>
    </section>`;
  }
  function proximos(d) {
    const E = AMO.calc.eventos, cfg = d.config, lista = E.proximos(d.eventos, today(), 4);
    return `<section class="card">
      <div class="card-title"><h3>Próximos eventos</h3><button class="btn small" data-nav="eventos" style="margin-left:auto">Agenda</button></div>
      ${lista.length ? `<div class="r-ev">${lista.map(e => { const c = E.calc(e, cfg), st = E.estado(e.estado), f = parseDate(e.fecha); return `<div class="r-ev-row"><span class="r-ev-d"><b>${f.getDate()}</b><small>${f.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}</small></span><span><span class="row" style="gap:8px"><b>${esc(e.nombre || 'Sin nombre')}</b>${chip(st.l, st.tono)}</span><small class="muted">${c.inv ? `${c.inv} invitados · ` : ''}${money(c.ingreso)}</small></span></div>`; }).join('')}</div>` : '<p class="muted small">No hay eventos próximos.</p>'}
    </section>`;
  }

  /* ---------- Sección ---------- */
  app.define({
    id: 'inicio', label: 'Resumen', icon: 'inicio', order: 10,
    collections: COLS,

    render() {
      const d = datos(), hoy = today();
      const ant = R.mes(d, addMonths(S.ym, -1), hoy);
      let m = R.mes(d, S.ym, hoy);
      // A principio de mes hay pocas ventas: el % de mercadería del mes anterior da una cuenta más realista.
      if (m.caja.diasAbiertos < 8 && ant.caja.total > 0) m = R.mes(d, S.ym, hoy, { ratioVariables: ant.gastos.variables / ant.caja.total });
      const hist = R.historial(d, S.ym, hoy);
      return `
      ${S.ym === ymOf(hoy) ? avisos(R.avisos(d, S.ym, hoy)) : ''}
      <section class="page-head">${AMO.ui.monthNav(S.ym)}<span class="spacer"></span>${S.ym !== ymOf(hoy) ? `<button class="btn ghost small" data-act="hoy">Este mes</button>` : `<span class="muted small">${longDate(hoy)}</span>`}</section>
      ${m.hayDatos ? '' : `<section class="card r-vacio"><div><b>Todavía no hay números de ${monthOnly(S.ym)}.</b><p class="muted small">El resumen se arma solo con la caja de cada día, los gastos, los sueldos y los eventos.</p></div><div class="row"><button class="btn primary" data-nav="caja">Cargar la caja</button><button class="btn" data-nav="gastos">Cargar un gasto</button></div></section>`}
      <section class="kpis">
        ${kpi({ label: 'Ventas', value: money(m.ventas), sub: delta(R.variacion(m.ventas, ant.ventas)) || 'Salón, vinoteca y eventos' })}
        ${kpi({ label: 'Gastos', value: money(m.costos), sub: delta(R.variacion(m.costos, ant.costos), true) || 'Con sueldos y eventos' })}
        ${kpi({ label: 'Resultado', value: money(m.resultado), hero: true, sub: m.ventas ? `Margen ${pct(m.margen)}` : 'Sin ventas cargadas' })}
        ${kpi({ label: 'Cubiertos', value: integer(m.cubiertos), sub: m.cubiertos ? `Ticket ${money(m.ticket)} · ${m.caja.diasAbiertos} días` : 'Sin caja cargada' })}
        ${kpi({ label: 'Mercadería', value: m.caja.total ? pct(m.foodCost) : '–', sub: 'de lo vendido en salón y vinoteca' })}
        ${kpi({ label: 'Personal', value: m.ventas ? pct(m.laboral) : '–', sub: `${money(m.personal.costo)} en sueldos` })}
      </section>
      <div class="grid-wide">
        ${estadoResultados(m)}
        <div class="stack">${equilibrio(m)}
          <section class="card"><div class="card-title"><h3>Últimos 6 meses</h3><span class="legend" style="margin:0 0 0 auto"><span><i style="background:var(--accent)"></i>Ventas</span><span><i style="background:var(--gold)"></i>Gastos</span></span></div><div class="r-chart">${grafico(hist)}</div></section>
        </div>
      </div>
      <div class="grid-2">${proximos(d)}${vinoteca(d)}</div>
      <p class="muted small r-plan"><button class="link-btn" data-nav="plan">Ver el plan de obra de la app</button></p>`;
    },

    action(act) {
      if (act === 'month-prev' || act === 'month-next') { S.ym = addMonths(S.ym, act === 'month-prev' ? -1 : 1); return app.render(); }
      if (act === 'hoy') { S.ym = ymOf(today()); return app.render(); }
    }
  });
})();