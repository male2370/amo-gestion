/* =====================================================================
   AMO Gestión · calc/caja.js
   Cuentas de la caja. Solo matemática, sin pantalla: se prueba en
   tests/run.js y la usan la sección Caja y, más adelante, el Resumen.

   Un día guardado (caja/AAAA-MM-DD) tiene esta forma:
   {
     fecha: '2026-11-07',
     servicios: [{ nombre:'Noche', cubiertos:40, efectivo, tarjeta, qr, transf }],
     vinoteca: { monto, efectivo },     // ventas de la vinoteca y cuánto fue en efectivo
     propinas, fondo, contado,          // fondo inicial y efectivo contado al cerrar
     controlada: true|false, nota
   }
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.caja = (() => {
  const { parseNum: n, sum, ratio, weekdayIndex } = AMO.utils;

  const MEDIOS = [
    { k: 'efectivo', l: 'Efectivo' },
    { k: 'tarjeta', l: 'Tarjeta' },
    { k: 'qr', l: 'QR / Mercado Pago' },
    { k: 'transf', l: 'Transferencia' }
  ];
  /** Días y servicios habituales de AMO (0 = lunes). Lunes y martes cerrado. */
  const SERVICIOS_POR_DIA = { 0: [], 1: [], 2: ['Cata'], 3: ['Noche'], 4: ['Noche'], 5: ['Mediodía', 'Noche'], 6: ['Mediodía'] };
  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const servicioVacio = nombre => ({ nombre, cubiertos: '', efectivo: '', tarjeta: '', qr: '', transf: '' });
  /** Documento nuevo para una fecha, con los servicios que suele haber ese día. */
  const nuevoDia = fecha => ({
    fecha, servicios: SERVICIOS_POR_DIA[weekdayIndex(fecha)].map(servicioVacio),
    vinoteca: { monto: '', efectivo: '' }, propinas: '', fondo: '', contado: '', controlada: false, nota: ''
  });
  const abreNormalmente = fecha => SERVICIOS_POR_DIA[weekdayIndex(fecha)].length > 0;

  const totalServicio = s => sum(MEDIOS, m => s[m.k]);

  /** Todo lo que se calcula de un día. */
  function dia(doc) {
    const sv = (doc && doc.servicios) || [];
    const vino = (doc && doc.vinoteca) || {};
    const medios = Object.fromEntries(MEDIOS.map(m => [m.k, sum(sv, s => s[m.k])]));
    const salon = sum(sv, totalServicio);
    const cubiertos = sum(sv, s => s.cubiertos);
    const vinoteca = n(vino.monto);
    const efectivoTotal = medios.efectivo + n(vino.efectivo);
    const hayArqueo = doc && doc.contado !== '' && doc.contado !== undefined && doc.contado !== null;
    const esperado = n(doc && doc.fondo) + efectivoTotal;
    return {
      fecha: doc && doc.fecha, salon, cubiertos, vinoteca, total: salon + vinoteca,
      ticket: ratio(salon, cubiertos), medios, efectivoTotal, esperado,
      diferencia: hayArqueo ? n(doc.contado) - esperado : null,
      propinas: n(doc && doc.propinas),
      servicios: sv.map(s => ({ nombre: s.nombre, total: totalServicio(s), cubiertos: n(s.cubiertos), ticket: ratio(totalServicio(s), n(s.cubiertos)) })),
      conDatos: salon + vinoteca + cubiertos > 0,
      controlada: !!(doc && doc.controlada)
    };
  }

  /** Resumen de un mes a partir de todos los días guardados. */
  function mes(docs, ym) {
    const dias = (docs || []).filter(d => String(d.fecha || '').startsWith(ym)).map(dia).filter(d => d.conDatos)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const salon = sum(dias, d => d.salon), vinoteca = sum(dias, d => d.vinoteca), cubiertos = sum(dias, d => d.cubiertos);
    const medios = Object.fromEntries(MEDIOS.map(m => [m.k, sum(dias, d => d.medios[m.k])]));
    const porDia = DIAS.map((nombre, i) => {
      const ds = dias.filter(d => weekdayIndex(d.fecha) === i);
      return { nombre, veces: ds.length, promedio: ratio(sum(ds, d => d.total), ds.length), cubiertos: ratio(sum(ds, d => d.cubiertos), ds.length) };
    }).filter(x => x.veces > 0);
    const mejor = dias.reduce((a, d) => (!a || d.total > a.total ? d : a), null);
    return {
      ym, dias, salon, vinoteca, total: salon + vinoteca, cubiertos, ticket: ratio(salon, cubiertos), medios,
      diasAbiertos: dias.length, promedioDia: ratio(salon + vinoteca, dias.length), porDia, mejor,
      sinControlar: dias.filter(d => !d.controlada).length,
      diferencias: sum(dias.filter(d => d.diferencia !== null), d => d.diferencia)
    };
  }

  return { MEDIOS, DIAS, SERVICIOS_POR_DIA, servicioVacio, nuevoDia, abreNormalmente, totalServicio, dia, mes };
})();