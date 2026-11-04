/* =====================================================================
   AMO Gestión · calc/resumen.js
   El número final del restaurante. Junta las cuentas de todas las
   secciones (sin pantalla). Recibe todos los datos en un objeto:
   { caja, gastos, personal, sueldos, eventos, vinos, vinoMov, platos, insumos, config }

   Resultado del mes = ventas − (gastos + sueldos + costos de eventos + impuestos)
     · ventas: caja del salón + vinoteca + eventos cerrados
     · costos de eventos: los de cada ficha. Si las compras de los eventos ya se
       cargan como facturas en Gastos, se activa config.eventosEnGastos para no
       contarlas dos veces.
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.resumen = (() => {
  const { parseNum: n, sum, ratio, addMonths } = AMO.utils;
  const C = () => AMO.calc;

  /**
   * opts.ratioVariables: % de gastos variables sobre ventas a usar en el punto de
   * equilibrio. Sirve a principio de mes, cuando todavía hay pocas ventas y las
   * compras de la semana distorsionan la cuenta (se usa el del mes anterior).
   */
  function mes(d, ym, hoy, opts = {}) {
    const cfg = d.config || {};
    const t = n(cfg.impuestosVentas) / 100;
    const caja = C().caja.mes(d.caja, ym);
    const gas = C().gastos.mes(d.gastos, ym, hoy);
    const per = C().personal.mes(d.personal, d.sueldos, ym, cfg);
    const ev = C().eventos.mes(d.eventos, ym, cfg);

    const evCostos = cfg.eventosEnGastos ? 0 : ev.directo;
    const ventas = caja.total + ev.ingreso;
    const impuestos = ventas * t;
    const costos = gas.total + per.costo + evCostos + impuestos;
    const resultado = ventas - costos;

    // Punto de equilibrio del salón: cuánto vender para cubrir lo fijo.
    const variables = gas.variables;                          // mercadería, bebidas, comisiones
    const fijos = gas.fijos + per.costo;                      // alquiler, servicios, sueldos…
    const evNeto = ev.ingreso - evCostos - ev.ingreso * t;    // lo que dejan los eventos ayuda a cubrir lo fijo
    const ratioVar = opts.ratioVariables !== undefined ? opts.ratioVariables : (caja.total > 0 ? variables / caja.total : null);
    const margenContrib = ratioVar !== null ? 1 - ratioVar - t : 0;
    const pe = margenContrib > 0 ? Math.max(0, (fijos - evNeto) / margenContrib) : 0;

    return {
      ym, caja, gastos: gas, personal: per, eventos: ev,
      salon: caja.salon, vinoteca: caja.vinoteca, ingresosEventos: ev.ingreso,
      ventas, impuestos, evCostos, costos, resultado, margen: ratio(resultado, ventas),
      foodCost: ratio(gas.mercaderia, caja.total), laboral: ratio(per.costo, ventas),
      cubiertos: caja.cubiertos, ticket: caja.ticket,
      equilibrio: { ventas: pe, cubiertos: caja.ticket > 0 ? Math.ceil(pe / caja.ticket) : 0, alcanzado: pe > 0 && caja.total >= pe, falta: Math.max(0, pe - caja.total), margenContrib, ratioVariables: ratioVar, prestado: opts.ratioVariables !== undefined, fijos, variables },
      hayDatos: caja.diasAbiertos + gas.items.length + ev.activos + (per.costo > 0 ? 1 : 0) > 0
    };
  }

  /** Últimos N meses terminando en ym (para el gráfico). */
  function historial(d, ym, hoy, cant = 6) {
    const out = [];
    for (let i = cant - 1; i >= 0; i--) {
      const m = mes(d, addMonths(ym, -i), hoy);
      out.push({ ym: m.ym, ventas: m.ventas, costos: m.costos, resultado: m.resultado });
    }
    return out;
  }

  /** Variación contra otro valor (null si no hay con qué comparar). */
  const variacion = (actual, anterior) => (anterior ? (actual - anterior) / Math.abs(anterior) : null);

  /** Cosas que piden atención hoy, de la más urgente a la menos. */
  function avisos(d, ym, hoy) {
    const cfg = d.config || {}, a = [];
    const venc = C().gastos.pendientes(d.gastos, hoy).filter(g => g.estado.k === 'vencido' || g.estado.k === 'hoy');
    if (venc.length) a.push({ tono: 'bad', ir: 'gastos', txt: `${venc.length} ${venc.length === 1 ? 'cuenta vencida o que vence hoy' : 'cuentas vencidas o que vencen hoy'}`, monto: sum(venc, g => g.monto) });
    const prox = C().gastos.pendientes(d.gastos, hoy).filter(g => g.estado.k === 'pronto');
    if (prox.length) a.push({ tono: 'warn', ir: 'gastos', txt: `${prox.length} ${prox.length === 1 ? 'cuenta vence' : 'cuentas vencen'} esta semana`, monto: sum(prox, g => g.monto) });
    const caja = C().caja.mes(d.caja, ym);
    if (caja.sinControlar) a.push({ tono: 'warn', ir: 'caja', txt: `${caja.sinControlar} ${caja.sinControlar === 1 ? 'caja sin controlar' : 'cajas sin controlar'} este mes` });
    const per = C().personal.mes(d.personal, d.sueldos, ym, cfg);
    if (per.pendientes) a.push({ tono: 'neutral', ir: 'personal', txt: `${per.pendientes} ${per.pendientes === 1 ? 'sueldo sin pagar' : 'sueldos sin pagar'}`, monto: per.faltaPagar });
    const cat = C().vinoteca.catalogo(d.vinos, d.vinoMov, hoy);
    if (cat.reponer.length) a.push({ tono: 'warn', ir: 'vinoteca', txt: `${cat.reponer.length} ${cat.reponer.length === 1 ? 'vino para reponer' : 'vinos para reponer'}` });
    const carta = C().carta.carta(d.platos, d.insumos, cfg);
    if (carta.aRevisar) a.push({ tono: 'neutral', ir: 'carta', txt: `${carta.aRevisar} ${carta.aRevisar === 1 ? 'plato cuesta' : 'platos cuestan'} más de lo ideal` });
    const porCobrar = C().eventos.proximos(d.eventos, hoy, 50).filter(e => e.estado !== 'presupuesto').map(e => C().eventos.calc(e, cfg)).filter(c => c.saldo > 0);
    if (porCobrar.length) a.push({ tono: 'neutral', ir: 'eventos', txt: `Falta cobrar en ${porCobrar.length} ${porCobrar.length === 1 ? 'evento próximo' : 'eventos próximos'}`, monto: sum(porCobrar, c => c.saldo) });
    return a;
  }

  /** Estado de resultados en filas, como en una planilla. */
  function estado(m) {
    const ingresos = [['Salón', m.salon], ['Vinoteca', m.vinoteca], ['Eventos cerrados', m.ingresosEventos]];
    const costos = m.gastos.porCat.map(c => [c.l, c.total, c.color])
      .concat([['Sueldos y cargas', m.personal.costo, '#a8854a'], ['Costos de eventos', m.evCostos, '#5a8a72'], ['Impuestos sobre ventas', m.impuestos, '#6b756f']])
      .filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
    return { ingresos, costos };
  }

  /**
   * El año entero, mes por mes. Los meses que todavía no llegaron y los que
   * no tienen nada cargado (ni caja, ni gastos, ni eventos) no suman: así un
   * sueldo calculado solo, en un mes sin ventas, no ensucia el total.
   * Compara con los mismos meses del año anterior.
   */
  function anio(d, y, hoy) {
    const hasta = String(hoy).slice(0, 7);
    const meses = [];
    for (let i = 1; i <= 12; i++) {
      const ym = `${y}-${String(i).padStart(2, '0')}`;
      if (ym > hasta) { meses.push({ ym, futuro: true, conDatos: false }); continue; }
      const m = mes(d, ym, hoy);
      const conDatos = m.caja.diasAbiertos > 0 || m.gastos.items.length > 0 || m.eventos.activos > 0;
      meses.push({ ym, futuro: false, conDatos, m, ventas: m.ventas, costos: m.costos, resultado: m.resultado, margen: m.margen, cubiertos: m.cubiertos, cajaTotal: m.caja.total, salon: m.salon });
    }
    const con = meses.filter(x => x.conDatos);
    const ventas = sum(con, x => x.ventas), costos = sum(con, x => x.costos), resultado = ventas - costos;
    const cubiertos = sum(con, x => x.cubiertos), salon = sum(con, x => x.salon);

    // Ingresos y costos del año, sumando el estado de resultados de cada mes.
    const juntar = filas => {
      const t = new Map();
      filas.forEach(([l, v, c]) => { const a = t.get(l) || [l, 0, c]; a[1] += n(v); t.set(l, a); });
      return [...t.values()];
    };
    const estados = con.map(x => estado(x.m));
    const ingresos = juntar(estados.flatMap(e => e.ingresos));
    const costosCat = juntar(estados.flatMap(e => e.costos)).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);

    const orden = con.slice().sort((a, b) => b.resultado - a.resultado);

    // Mismos meses del año anterior (si este año va hasta octubre, se compara enero–octubre).
    const ultimo = con.length ? con[con.length - 1].ym.slice(5) : '12';
    let antV = 0, antR = 0, antMeses = 0;
    for (let i = 1; i <= Number(ultimo); i++) {
      const ym = `${y - 1}-${String(i).padStart(2, '0')}`;
      const m = mes(d, ym, hoy);
      if (m.caja.diasAbiertos > 0 || m.gastos.items.length > 0 || m.eventos.activos > 0) { antV += m.ventas; antR += m.resultado; antMeses++; }
    }

    return {
      y, meses, mesesConDatos: con.length,
      ventas, costos, resultado, margen: ratio(resultado, ventas),
      cubiertos, ticket: ratio(salon, cubiertos),
      promedio: con.length ? resultado / con.length : 0,
      mejor: orden[0] || null, peor: orden.length > 1 ? orden[orden.length - 1] : null,
      ingresos, costosCat,
      anterior: antMeses ? { ventas: antV, resultado: antR, meses: antMeses, hasta: ultimo } : null
    };
  }

  return { mes, historial, variacion, avisos, estado, anio };
})();