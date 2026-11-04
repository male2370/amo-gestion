/* =====================================================================
   AMO Gestión · calc/exportar.js
   Arma el contenido de los Excel (sin pantalla, se prueba en tests/run.js).
   Devuelve hojas con filas listas para AMO.xlsx.crear:
   · libroMes(d, ym, hoy): Resumen, Caja, Gastos, Sueldos, Eventos y Vinoteca.
   · libroAnio(d, y, hoy): el año mes por mes, costos por categoría,
     y la caja y los gastos de todo el año.
   d = los datos de todas las secciones (como en calc/resumen.js).
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.exportar = (() => {
  const { parseNum: n, sum, ratio, monthName, weekdayIndex, today } = AMO.utils;
  const C = () => AMO.calc;
  const $ = v => ({ v: n(v), s: '$' }), B$ = v => ({ v: n(v), s: 'b$' }), b = v => ({ v, s: 'b' });
  const pc = v => ({ v: Number.isFinite(v) ? v : 0, s: '%' }), f = v => ({ v: v || '', s: 'f' }), t = v => ({ v, s: 't' });
  const siNo = x => (x ? 'Sí' : 'No');
  const generado = hoy => `Generado el ${hoy.split('-').reverse().join('/')} desde AMO Gestión`;

  /* ---------- Bloques que se usan en el mes y en el año ---------- */
  function hojaCaja(cajaDocs, prefijo, titulo) {
    const dias = (cajaDocs || []).filter(x => String(x.fecha || '').startsWith(prefijo)).map(C().caja.dia).filter(x => x.conDatos)
      .sort((a, z) => a.fecha.localeCompare(z.fecha));
    const filas = [[t(titulo)], [],
      ['Fecha', 'Día', 'Cubiertos', 'Efectivo', 'Tarjeta', 'QR / Mercado Pago', 'Transferencia', 'Salón', 'Vinoteca', 'Total del día', 'Controlada'].map(b)];
    dias.forEach(x => filas.push([f(x.fecha), C().caja.DIAS[weekdayIndex(x.fecha)], x.cubiertos, $(x.medios.efectivo), $(x.medios.tarjeta), $(x.medios.qr), $(x.medios.transf), $(x.salon), $(x.vinoteca), $(x.total), siNo(x.controlada)]));
    filas.push([b('Total'), `${dias.length} días`, b(sum(dias, x => x.cubiertos)), B$(sum(dias, x => x.medios.efectivo)), B$(sum(dias, x => x.medios.tarjeta)), B$(sum(dias, x => x.medios.qr)), B$(sum(dias, x => x.medios.transf)), B$(sum(dias, x => x.salon)), B$(sum(dias, x => x.vinoteca)), B$(sum(dias, x => x.total))]);
    return { anchos: [12, 11, 11, 14, 14, 17, 15, 15, 14, 15, 11], filas };
  }
  function hojaGastos(gastos, prefijo, titulo) {
    const G = C().gastos;
    const items = (gastos || []).filter(g => G.valido(g) && String(g.fecha).startsWith(prefijo)).sort((a, z) => a.fecha.localeCompare(z.fecha));
    const filas = [[t(titulo)], [], ['Fecha', 'Categoría', 'Proveedor', 'Detalle', 'Medio de pago', 'Monto', 'Pagado', 'Vence'].map(b)];
    items.forEach(g => filas.push([f(g.fecha), G.cat(g.cat).l, g.proveedor || '', g.detalle || '', g.medio || '', $(g.monto), siNo(g.pagado), g.vence ? f(g.vence) : '']));
    filas.push([b('Total'), `${items.length} gastos`, '', '', '', B$(sum(items, g => g.monto)), '', '']);
    return { anchos: [12, 26, 24, 32, 16, 15, 9, 12], filas };
  }
  function bloqueEstado(filas, ingresos, costos, ventas, totalCostos, resultado) {
    filas.push([b('Ingresos'), B$(ventas)]);
    ingresos.forEach(([l, v]) => filas.push([l, $(v), pc(ratio(v, ventas))]));
    filas.push([]);
    filas.push([b('Costos'), B$(totalCostos)]);
    costos.forEach(([l, v]) => filas.push([l, $(v), pc(ratio(v, totalCostos))]));
    filas.push([]);
    filas.push([b('Resultado'), B$(resultado), pc(ratio(resultado, ventas))]);
  }

  /* ---------- Libro del mes ---------- */
  function libroMes(d, ym, hoy = today()) {
    const cfg = d.config || {}, R = C().resumen, m = R.mes(d, ym, hoy), e = R.estado(m), nom = monthName(ym);

    const res = [[t(`AMO · Resumen de ${nom}`)], [generado(hoy)], [],
      [b('Ventas'), B$(m.ventas)], [b('Gastos'), B$(m.costos)], [b('Resultado'), B$(m.resultado)], ['Margen', pc(m.margen)],
      ['Cubiertos', m.cubiertos], ['Ticket promedio', $(m.ticket)], ['Días abiertos', m.caja.diasAbiertos],
      ['Mercadería sobre ventas', pc(m.foodCost)], ['Personal sobre ventas', pc(m.laboral)], []];
    bloqueEstado(res, e.ingresos, e.costos, m.ventas, m.costos, m.resultado);
    if (m.equilibrio.ventas > 0) res.push([], ['Punto de equilibrio (salón y vinoteca)', $(m.equilibrio.ventas)]);

    const per = C().personal.mes(d.personal, d.sueldos, ym, cfg);
    const sueldos = [[t(`Sueldos · ${nom}`)], [], ['Nombre', 'Puesto', 'Sueldo bruto', 'Cargas sociales', 'Aguinaldo (provisión)', 'Costo total', 'Adelantos', 'A pagar', 'Pagado'].map(b)];
    per.filas.forEach(x => sueldos.push([x.persona.nombre || '', x.persona.puesto || '', $(x.bruto), $(x.cargas), $(x.sac), $(x.costo), $(x.adelantos), $(x.aPagar), siNo(x.pagado)]));
    sueldos.push([b('Total'), `${per.filas.length} personas`, B$(per.bruto), B$(per.cargas), B$(per.sac), B$(per.costo), B$(per.adelantos), B$(sum(per.filas, x => x.aPagar)), '']);

    const E = C().eventos, ev = E.mes(d.eventos, ym, cfg);
    const eventos = [[t(`Eventos · ${nom}`)], [], ['Fecha', 'Evento', 'Tipo', 'Cliente', 'Estado', 'Invitados', 'Ingreso', 'Costo', 'Ganancia', 'Cobrado', 'Falta cobrar'].map(b)];
    ev.todos.forEach(x => { const c = E.calc(x, cfg); eventos.push([f(x.fecha), x.nombre || '', x.tipo || '', x.cliente || '', E.estado(x.estado).l, c.inv, $(c.ingreso), $(c.costo), $(c.ganancia), $(c.cobrado), $(Math.max(0, c.saldo))]); });
    eventos.push([b('Total que cuenta'), `${ev.activos} eventos`, '', '', '', b(ev.invitados), B$(ev.ingreso), B$(ev.costo), B$(ev.ganancia), '', B$(ev.porCobrar)]);
    eventos.push([], ['Los presupuestos y los cancelados se listan pero no suman.']);

    const cat = C().vinoteca.catalogo(d.vinos, d.vinoMov, hoy);
    const vinos = [[t('Vinoteca · stock al ' + hoy.split('-').reverse().join('/'))], [], ['Bodega', 'Vino', 'Varietal', 'Año', 'Stock', 'Mínimo', 'Costo', 'Precio', 'Valor al costo', 'Valor a la venta', 'Estado'].map(b)];
    cat.filas.forEach(x => vinos.push([x.v.bodega || '', x.v.nombre || '', x.v.varietal || '', x.v.anio || '', x.stock, n(x.v.minimo), $(x.costo), $(x.precio), $(x.valorCosto), $(x.valorVenta), x.estado.l || '']));
    vinos.push([b('Total'), `${cat.etiquetas} etiquetas`, '', '', b(cat.botellas), '', '', '', B$(cat.valorCosto), B$(cat.valorVenta), '']);

    return [
      { nombre: 'Resumen', anchos: [36, 18, 10], filas: res },
      Object.assign({ nombre: 'Caja' }, hojaCaja(d.caja, ym, `Caja · ${nom}`)),
      Object.assign({ nombre: 'Gastos' }, hojaGastos(d.gastos, ym, `Gastos · ${nom}`)),
      { nombre: 'Sueldos', anchos: [22, 16, 15, 15, 19, 15, 13, 15, 9], filas: sueldos },
      { nombre: 'Eventos', anchos: [12, 26, 18, 22, 13, 10, 15, 15, 15, 15, 14], filas: eventos },
      { nombre: 'Vinoteca', anchos: [20, 26, 16, 7, 8, 8, 13, 13, 15, 16, 12], filas: vinos }
    ];
  }

  /* ---------- Libro del año ---------- */
  function libroAnio(d, y, hoy = today()) {
    const a = C().resumen.anio(d, y, hoy);
    const anio = [[t(`AMO · Año ${y}`)], [generado(hoy)], [], ['Mes', 'Ventas', 'Gastos', 'Resultado', 'Margen', 'Cubiertos'].map(b)];
    a.meses.forEach(x => anio.push(x.conDatos
      ? [monthName(x.ym), $(x.ventas), $(x.costos), $(x.resultado), pc(x.margen), x.cubiertos]
      : [monthName(x.ym), x.futuro ? '—' : 'Sin datos']));
    anio.push([b('Total'), B$(a.ventas), B$(a.costos), B$(a.resultado), pc(a.margen), b(a.cubiertos)]);
    anio.push([], ['Promedio de resultado por mes', $(a.promedio)], ['Ticket promedio', $(a.ticket)]);
    if (a.mejor) anio.push(['Mejor mes', monthName(a.mejor.ym), $(a.mejor.resultado)]);
    if (a.anterior) anio.push(['Ventas de los mismos meses del año anterior', $(a.anterior.ventas)], ['Resultado de los mismos meses del año anterior', $(a.anterior.resultado)]);

    const plata = [[t(`De dónde vino y a dónde fue · ${y}`)], []];
    bloqueEstado(plata, a.ingresos, a.costosCat, a.ventas, a.costos, a.resultado);

    return [
      { nombre: `Año ${y}`, anchos: [44, 18, 18, 18, 10, 11], filas: anio },
      { nombre: 'Ingresos y costos', anchos: [30, 18, 10], filas: plata },
      Object.assign({ nombre: 'Caja del año' }, hojaCaja(d.caja, String(y), `Caja · ${y}`)),
      Object.assign({ nombre: 'Gastos del año' }, hojaGastos(d.gastos, String(y), `Gastos · ${y}`))
    ];
  }

  return { libroMes, libroAnio };
})();