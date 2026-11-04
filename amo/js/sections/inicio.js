/* =====================================================================
   AMO Gestión · sections/inicio.js
   Sección 8: Resumen. La primera pantalla. Tiene dos vistas:
   · Mes: avisos de lo urgente, ventas, gastos y resultado del mes,
     estado de resultados, punto de equilibrio, historial de 6 meses,
     vinoteca y próximos eventos.
   · Año: los 12 meses lado a lado, con gráfico, tabla, totales,
     mejor y peor mes, y comparación con el año anterior.
   No tiene campos: solo lee. Las cuentas están en calc/resumen.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, R = AMO.calc.resumen, store = AMO.store, app = AMO.app;
  const { esc, money, moneyShort, pct, today, ymOf, addMonths, monthOnly, monthShort, monthName, integer, longDate, parseDate } = U;
  const { icon, kpi, empty, chip } = AMO.ui;
  const COLS = ['caja', 'gastos', 'personal', 'sueldos', 'eventos', 'vinos', 'vinoMov', 'platos', 'insumos', 'config'];

  const S = { ym: ymOf(today()), vista: 'mes', anio: Number(today().slice(0, 4)) };
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


  /* ---------- Vista del año ---------- */
  const mesCorto = ym => monthShort(ym);
  function graficoAnio(a) {
    const chico = window.innerWidth < 640;                  // en el celular, más alto y con letras más grandes
    const W = chico ? 380 : 720, H = chico ? 250 : 260, L = chico ? 46 : 58, B = 26, T = 12, fs = chico ? 10.5 : 11.5;
    const con = a.meses.filter(x => x.conDatos);
    const max = Math.max(1, ...con.map(x => Math.max(x.ventas, x.costos)));
    const minR = Math.min(0, ...con.map(x => x.resultado));
    const paso = escalon((max - minR) / 4), tope = Math.ceil(max / paso) * paso, piso = Math.floor(minR / paso) * paso;
    const y = v => T + (H - T - B) * (tope - v) / (tope - piso || 1);
    const gw = (W - L - 6) / 12, bw = Math.max(3, Math.min(16, gw / 3.2));
    let g = '';
    for (let v = piso; v <= tope + 1; v += paso) g += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"${v === 0 ? ' stroke-width="1.5"' : ''}/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="${fs - .5}" fill="var(--muted)">${moneyShort(v)}</text>`;
    const pts = [];
    a.meses.forEach((x, i) => {
      const cx = L + gw * i + gw / 2, esteMes = x.ym === ymOf(today());
      if (x.conDatos) {
        g += `<rect x="${cx - bw - 1.5}" y="${y(x.ventas)}" width="${bw}" height="${Math.max(0, y(0) - y(x.ventas))}" rx="2.5" fill="var(--accent)"><title>${monthOnly(x.ym)} · Ventas ${money(x.ventas)}</title></rect>`;
        g += `<rect x="${cx + 1.5}" y="${y(x.costos)}" width="${bw}" height="${Math.max(0, y(0) - y(x.costos))}" rx="2.5" fill="var(--gold)"><title>${monthOnly(x.ym)} · Gastos ${money(x.costos)}</title></rect>`;
        pts.push([cx, y(x.resultado), x]);
      }
      g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="${fs}" font-weight="${esteMes ? 700 : 500}" fill="var(--${x.futuro ? 'line' : esteMes ? 'ink' : 'muted'})">${chico ? mesCorto(x.ym).charAt(0) : mesCorto(x.ym)}</text>`;
    });
    if (pts.length > 1) g += `<polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" opacity=".75"/>`;
    pts.forEach(([px, py, x]) => { g += `<circle cx="${px}" cy="${py}" r="${chico ? 3.5 : 4.5}" fill="var(--surface)" stroke="${x.resultado >= 0 ? 'var(--good)' : 'var(--bad)'}" stroke-width="2.5"><title>${monthOnly(x.ym)} · Resultado ${money(x.resultado)}</title></circle>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ventas, gastos y resultado de cada mes de ${a.y}">${g}</svg>`;
  }
  // En la tabla, el monto completo; en el celular, abreviado (para que entren las columnas).
  const m2 = v => `<span class="lg">${money(v)}</span><span class="sh">${moneyShort(v)}</span>`;
  function tablaAnio(a) {
    const fila = x => {
      if (x.futuro) return `<tr class="a-fut"><td>${cap(monthOnly(x.ym))}</td><td class="r" colspan="4">—</td></tr>`;
      if (!x.conDatos) return `<tr class="a-vacio click" data-act="ver-mes" data-ym="${x.ym}"><td>${cap(monthOnly(x.ym))}</td><td class="r" colspan="4">Sin datos</td></tr>`;
      return `<tr class="click${x.ym === ymOf(today()) ? ' sel' : ''}" data-act="ver-mes" data-ym="${x.ym}"><td>${cap(monthOnly(x.ym))}</td><td class="r">${m2(x.ventas)}</td><td class="r">${m2(x.costos)}</td><td class="r ${x.resultado >= 0 ? 'pos' : 'neg'}"><b>${m2(x.resultado)}</b></td><td class="r a-mg">${x.ventas ? pct(x.margen) : '–'}</td></tr>`;
    };
    return `<div class="table-wrap"><table class="num a-tabla">
      <thead><tr><th>Mes</th><th class="r">Ventas</th><th class="r">Gastos</th><th class="r">Resultado</th><th class="r a-mg">Margen</th></tr></thead>
      <tbody>${a.meses.map(fila).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="r">${m2(a.ventas)}</td><td class="r">${m2(a.costos)}</td><td class="r ${a.resultado >= 0 ? 'pos' : 'neg'}">${m2(a.resultado)}</td><td class="r a-mg">${a.ventas ? pct(a.margen) : '–'}</td></tr></tfoot>
    </table></div>`;
  }
  function plataAnio(a) {
    const max = Math.max(1, ...a.costosCat.map(r => r[1]));
    return `
    <section class="card">
      <div class="card-title"><h3>De dónde vino y a dónde fue</h3><span class="total muted small">${a.y}</span></div>
      <div class="r-er num">
        <div class="r-er-h"><span>Ingresos</span><b>${money(a.ventas)}</b></div>
        ${a.ingresos.map(([l, v]) => `<div class="r-er-row"><span>${l}</span><span>${money(v)} <small class="muted">${pct(U.ratio(v, a.ventas))}</small></span></div>`).join('')}
        <div class="r-er-h" style="margin-top:12px"><span>Costos</span><b>${money(a.costos)}</b></div>
        ${a.costosCat.length ? a.costosCat.map(([l, v, c]) => `<div class="r-er-row bar"><span>${esc(l)}</span><span>${money(v)} <small class="muted">${pct(v / a.costos)}</small></span><i style="width:${(v / max * 100).toFixed(1)}%;background:${c}"></i></div>`).join('') : '<p class="muted small">Sin costos cargados.</p>'}
        <div class="r-er-res ${a.resultado >= 0 ? 'pos' : 'neg'}"><span>Resultado</span><b>${money(a.resultado)}</b></div>
      </div>
    </section>`;
  }
  function renderAnio() {
    const d = datos(), hoy = today(), a = R.anio(d, S.anio, hoy);
    const ant = a.anterior, periodo = ant ? (ant.hasta === '12' ? String(a.y - 1) : `ene–${monthShort(a.y - 1 + '-' + ant.hasta).toLowerCase()} ${a.y - 1}`) : '';
    const dAnio = (act, prev, invertir = false) => {
      const v = R.variacion(act, prev);
      if (v === null || !Number.isFinite(v)) return '';
      const bueno = invertir ? v <= 0 : v >= 0;
      return `<span class="${bueno ? 'pos' : 'neg'}">${v >= 0 ? '▲' : '▼'} ${pct(Math.abs(v))}</span> vs. ${periodo}`;
    };
    return `
      ${cabecera(`<div class="month-nav"><button class="icon-btn" data-act="anio-prev" aria-label="Año anterior">${icon('prev', 20)}</button><h2>${a.y}</h2><button class="icon-btn" data-act="anio-next" aria-label="Año siguiente">${icon('next', 20)}</button></div>`,
        a.y !== Number(hoy.slice(0, 4)) ? `<button class="btn ghost small" data-act="hoy">Este año</button>` : '')}
      ${a.mesesConDatos ? '' : `<section class="card r-vacio"><div><b>Todavía no hay números de ${a.y}.</b><p class="muted small">El año se arma solo con lo que se carga cada mes.</p></div></section>`}
      <section class="kpis a-kpis">
        ${kpi({ label: 'Ventas del año', value: money(a.ventas), sub: (ant && dAnio(a.ventas, ant.ventas)) || `${a.mesesConDatos} ${a.mesesConDatos === 1 ? 'mes' : 'meses'} con datos` })}
        ${kpi({ label: 'Gastos del año', value: money(a.costos), sub: 'Con sueldos, eventos e impuestos' })}
        ${kpi({ label: 'Resultado del año', value: money(a.resultado), hero: true, sub: a.ventas ? `Margen ${pct(a.margen)}${ant ? ' · ' + dAnio(a.resultado, ant.resultado) : ''}` : 'Sin ventas cargadas' })}
        ${kpi({ label: 'Promedio por mes', value: money(a.promedio), sub: 'de resultado' })}
        ${kpi({ label: 'Mejor mes', value: a.mejor ? cap(monthOnly(a.mejor.ym)) : '–', sub: a.mejor ? `Dejó ${money(a.mejor.resultado)}` : '' })}
        ${kpi({ label: 'Cubiertos', value: integer(a.cubiertos), sub: a.cubiertos ? `Ticket promedio ${money(a.ticket)}` : 'Sin caja cargada' })}
      </section>
      <section class="card"><div class="card-title"><h3>Mes a mes</h3><span class="legend" style="margin:0 0 0 auto"><span><i style="background:var(--accent)"></i>Ventas</span><span><i style="background:var(--gold)"></i>Gastos</span><span><i class="a-dot"></i>Resultado</span></span></div><div class="r-chart">${graficoAnio(a)}</div>
        ${a.peor && a.peor.resultado < a.mejor.resultado ? `<p class="muted small" style="margin-top:6px">El mes más flojo fue ${monthOnly(a.peor.ym)} (${money(a.peor.resultado)}).</p>` : ''}</section>
      <div class="grid-wide">
        <section class="card"><div class="card-title"><h3>Cada mes</h3><span class="total muted small">Tocá un mes para verlo entero</span></div>${tablaAnio(a)}</section>
        ${plataAnio(a)}
      </div>`;
  }
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  function cabecera(nav, derecha) {
    return `<p class="print-only r-print">AMO · ${S.vista === 'anio' ? `Resumen del año ${S.anio}` : `Resumen de ${monthName(S.ym)}`} · generado el ${today().split('-').reverse().join('/')}</p>
    <section class="page-head r-head">
      <div class="seg" role="tablist"><button role="tab" class="seg-b" data-act="vista" data-v="mes" aria-selected="${S.vista === 'mes'}">Mes</button><button role="tab" class="seg-b" data-act="vista" data-v="anio" aria-selected="${S.vista === 'anio'}">Año</button></div>
      ${nav}<span class="spacer"></span>${derecha}
      <span class="r-bajar"><button class="btn small" data-act="excel" title="Bajar en Excel">${icon('download', 15)} Excel</button><button class="btn small" data-act="pdf" title="Guardar en PDF o imprimir">${icon('print', 15)} PDF</button></span></section>`;
  }

  /* ---------- Exportar ---------- */
  function bajarExcel() {
    const d = datos(), X = AMO.calc.exportar;
    const hojas = S.vista === 'anio' ? X.libroAnio(d, S.anio, today()) : X.libroMes(d, S.ym, today());
    const nombre = S.vista === 'anio' ? `AMO ${S.anio}.xlsx` : `AMO ${monthName(S.ym)}.xlsx`;
    AMO.xlsx.descargar(AMO.xlsx.crear(hojas), nombre);
    AMO.ui.toast('Excel descargado');
  }
  function guardarPdf() {
    // El nombre del PDF sale del título de la página.
    const antes = document.title;
    document.title = S.vista === 'anio' ? `AMO ${S.anio}` : `AMO ${monthName(S.ym)}`;
    const volver = () => { document.title = antes; window.removeEventListener('afterprint', volver); };
    window.addEventListener('afterprint', volver);
    window.print();
    setTimeout(volver, 3000);
  }

  /* ---------- Sección ---------- */
  app.define({
    id: 'inicio', label: 'Resumen', icon: 'inicio', order: 10,
    collections: COLS,

    render() {
      if (S.vista === 'anio') return renderAnio();
      const d = datos(), hoy = today();
      const ant = R.mes(d, addMonths(S.ym, -1), hoy);
      let m = R.mes(d, S.ym, hoy);
      // A principio de mes hay pocas ventas: el % de mercadería del mes anterior da una cuenta más realista.
      if (m.caja.diasAbiertos < 8 && ant.caja.total > 0) m = R.mes(d, S.ym, hoy, { ratioVariables: ant.gastos.variables / ant.caja.total });
      const hist = R.historial(d, S.ym, hoy);
      return `
      ${S.ym === ymOf(hoy) ? avisos(R.avisos(d, S.ym, hoy)) : ''}
      ${cabecera(AMO.ui.monthNav(S.ym), S.ym !== ymOf(hoy) ? `<button class="btn ghost small" data-act="hoy">Este mes</button>` : `<span class="muted small r-hoy">${longDate(hoy)}</span>`)}
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

    action(act, el) {
      if (act === 'month-prev' || act === 'month-next') { S.ym = addMonths(S.ym, act === 'month-prev' ? -1 : 1); return app.render(); }
      if (act === 'anio-prev' || act === 'anio-next') { S.anio += act === 'anio-prev' ? -1 : 1; return app.render(); }
      if (act === 'hoy') { S.ym = ymOf(today()); S.anio = Number(today().slice(0, 4)); return app.render(); }
      if (act === 'vista') { S.vista = el.dataset.v; if (S.vista === 'anio') S.anio = Number(S.ym.slice(0, 4)); return app.render(); }
      if (act === 'excel') return bajarExcel();
      if (act === 'pdf') return guardarPdf();
      if (act === 'ver-mes') { S.ym = el.dataset.ym; S.vista = 'mes'; app.render(); return window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
  });
})();