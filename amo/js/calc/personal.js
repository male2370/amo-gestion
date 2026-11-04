/* =====================================================================
   AMO Gestión · calc/personal.js
   Cuentas del personal. Solo matemática, sin pantalla.

   Persona (personal/<id>):
   { nombre, puesto, forma: 'mensual'|'hora'|'turno', valor, desde: 'AAAA-MM', baja: 'AAAA-MM'|'', tel }
     · desde: primer mes que trabaja · baja: último mes que trabajó (vacío = sigue)

   Sueldo de un mes (sueldos/<AAAA-MM>_<idPersona>), uno por persona y mes
   para que dos personas puedan cargar a la vez sin pisarse:
   { ym, persona, cant, extras, descuentos, adelantos: [{ id, fecha, monto, nota }], pagado, fechaPago }
     · cant: horas o turnos trabajados (no se usa si es mensual)

   Configuración (config/general): { cargas: %, provisionSAC: true|false }
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.personal = (() => {
  const { parseNum: n, sum } = AMO.utils;

  const FORMAS = [
    { k: 'mensual', l: 'Sueldo mensual', unidad: 'por mes' },
    { k: 'hora', l: 'Por hora', unidad: 'por hora', cant: 'Horas' },
    { k: 'turno', l: 'Por turno', unidad: 'por turno', cant: 'Turnos' }
  ];
  const forma = k => FORMAS.find(f => f.k === k) || FORMAS[0];
  const idSueldo = (ym, persona) => `${ym}_${persona}`;

  const nuevaPersona = ym => ({ nombre: '', puesto: '', forma: 'mensual', valor: '', desde: ym, baja: '', tel: '' });
  const nuevoSueldo = id => { const [ym, ...rest] = String(id).split('_'); return { ym, persona: rest.join('_'), cant: '', extras: '', descuentos: '', adelantos: [], pagado: false, fechaPago: '' }; };

  /** ¿Trabaja ese mes? Según el mes de alta y el de baja. */
  const trabajaEn = (p, ym) => (!p.desde || p.desde <= ym) && (!p.baja || ym <= p.baja);

  /** Liquidación de una persona en un mes. */
  function liquidar(p, s, cfg = {}) {
    s = s || {};
    const cg = n(cfg.cargas) / 100;
    const base = forma(p.forma).k === 'mensual' ? n(p.valor) : n(p.valor) * n(s.cant);
    const bruto = Math.max(0, base + n(s.extras) - n(s.descuentos));
    const cargas = bruto * cg;
    const sac = cfg.provisionSAC ? (bruto / 12) * (1 + cg) : 0;   // aguinaldo: medio sueldo por semestre = 1/12 por mes
    const adelantos = sum(s.adelantos, a => a.monto);
    return { base, bruto, cargas, sac, costo: bruto + cargas + sac, adelantos, aPagar: bruto - adelantos, pagado: !!s.pagado };
  }

  /**
   * Todo el mes: quién trabaja, cuánto cobra cada uno y el costo total.
   * Si alguien ya no figura como activo pero tiene datos cargados ese mes, igual aparece.
   */
  function mes(personas, sueldos, ym, cfg = {}) {
    const porId = new Map((sueldos || []).filter(s => s.ym === ym).map(s => [s.persona, s]));
    const filas = (personas || [])
      .filter(p => trabajaEn(p, ym) || porId.has(p.id))
      .map(p => ({ persona: p, sueldo: porId.get(p.id) || null, ...liquidar(p, porId.get(p.id), cfg) }))
      .sort((a, b) => String(a.persona.nombre || '').localeCompare(String(b.persona.nombre || '')));
    const puestos = {};
    filas.forEach(f => { const k = (f.persona.puesto || 'Sin puesto').trim(); puestos[k] = (puestos[k] || 0) + f.costo; });
    const pendientes = filas.filter(f => !f.pagado && f.bruto > 0);
    return {
      ym, filas,
      bruto: sum(filas, f => f.bruto), cargas: sum(filas, f => f.cargas), sac: sum(filas, f => f.sac),
      costo: sum(filas, f => f.costo), adelantos: sum(filas, f => f.adelantos),
      faltaPagar: sum(pendientes, f => f.aPagar), pendientes: pendientes.length,
      porPuesto: Object.entries(puestos).map(([puesto, costo]) => ({ puesto, costo })).sort((a, b) => b.costo - a.costo),
      adelantosLista: filas.flatMap(f => ((f.sueldo && f.sueldo.adelantos) || []).map(a => Object.assign({}, a, { persona: f.persona }))).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    };
  }

  return { FORMAS, forma, idSueldo, nuevaPersona, nuevoSueldo, trabajaEn, liquidar, mes };
})();