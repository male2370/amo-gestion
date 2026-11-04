/* =====================================================================
   AMO Gestión · calc/eventos.js
   Cuentas de los eventos cerrados. Solo matemática, sin pantalla.

   Evento (eventos/<id>):
   {
     nombre, cliente, contacto, tipo, fecha, horaInicio, horaFin, estado,
     invitados, precioPersona,
     extras:     [{ d, m }]                        cobros aparte del cubierto
     pagos:      [{ id, fecha, monto, medio }]     seña y pagos recibidos
     mercaderia: [{ d, cant, u, pu, pp }]          pp = la cantidad es por invitado
     personal:   [{ rol, cant, horas, valorHora }]
     otros:      [{ d, m }]
     cronograma: [{ h, a, ok }], menu, notas
   }
   Configuración (config/general): impuestosVentas %, margenEvento %, incluirPresupuestos
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.eventos = (() => {
  const { parseNum: n, sum, ratio, longDate, money } = AMO.utils;

  const ESTADOS = [
    { k: 'presupuesto', l: 'Presupuesto', tono: 'neutral' },
    { k: 'senado', l: 'Señado', tono: 'warn' },
    { k: 'confirmado', l: 'Confirmado', tono: 'accent' },
    { k: 'realizado', l: 'Realizado', tono: 'good' },
    { k: 'cancelado', l: 'Cancelado', tono: 'bad' }
  ];
  const estado = k => ESTADOS.find(e => e.k === k) || ESTADOS[0];
  const TIPOS = ['Cumpleaños', 'Corporativo', 'Casamiento', 'Cata / degustación', 'Aniversario', 'Bautismo / comunión', 'Despedida', 'Otro'];
  const MARGEN_DEFECTO = 35;

  const nuevo = fecha => ({
    nombre: '', cliente: '', contacto: '', tipo: 'Cumpleaños', fecha, horaInicio: '20:30', horaFin: '00:30', estado: 'presupuesto',
    invitados: '', precioPersona: '', extras: [], pagos: [],
    mercaderia: [], personal: [], otros: [],
    cronograma: [{ h: '', a: 'Llegada de invitados', ok: false }, { h: '', a: 'Recepción', ok: false }, { h: '', a: 'Plato principal', ok: false }, { h: '', a: 'Postre y brindis', ok: false }],
    menu: '', notas: ''
  });

  /** Cantidad real de un ítem de mercadería: si es "por invitado", se multiplica. */
  const cantReal = (x, invitados) => (x.pp ? n(x.cant) * n(invitados) : n(x.cant));
  const subMerca = (x, inv) => cantReal(x, inv) * n(x.pu);
  const subPersonal = x => n(x.cant) * n(x.horas) * n(x.valorHora);

  /** Todo lo que se calcula de un evento. */
  function calc(e, cfg = {}) {
    const inv = n(e.invitados);
    const cubiertos = inv * n(e.precioPersona);
    const extras = sum(e.extras, x => x.m);
    const ingreso = cubiertos + extras;
    const merca = sum(e.mercaderia, x => subMerca(x, inv));
    const personal = sum(e.personal, subPersonal);
    const otros = sum(e.otros, x => x.m);
    const t = n(cfg.impuestosVentas) / 100;
    const mo = (cfg.margenEvento === undefined || cfg.margenEvento === '' ? MARGEN_DEFECTO : n(cfg.margenEvento)) / 100;
    const impuestos = ingreso * t;
    const directo = merca + personal + otros;
    const costo = directo + impuestos;
    const ganancia = ingreso - costo;
    const cobrado = sum(e.pagos, p => p.monto);
    // precio por persona para que la ganancia sea "mo" del cobro:  P = directo / (1 - t - mo)
    const necesario = 1 - t - mo > 0 ? directo / (1 - t - mo) : 0;
    return {
      inv, cubiertos, extras, ingreso, merca, personal, otros, impuestos, directo, costo, ganancia,
      margen: ratio(ganancia, ingreso), costoInvitado: ratio(costo, inv), gananciaInvitado: ratio(ganancia, inv),
      cobrado, saldo: ingreso - cobrado, margenBuscado: mo,
      precioSugerido: inv > 0 && directo > 0 ? Math.ceil(Math.max(0, (necesario - extras) / inv) / 100) * 100 : 0
    };
  }

  /** ¿Cuenta para los números del mes? Cancelados nunca; presupuestos solo si se pide. */
  const cuenta = (e, cfg = {}) => e.estado !== 'cancelado' && (cfg.incluirPresupuestos || e.estado !== 'presupuesto');

  function mes(lista, ym, cfg = {}) {
    const delMes = (lista || []).filter(e => String(e.fecha || '').startsWith(ym))
      .sort((a, b) => (a.fecha + (a.horaInicio || '')).localeCompare(b.fecha + (b.horaInicio || '')));
    const activos = delMes.filter(e => cuenta(e, cfg)).map(e => ({ e, c: calc(e, cfg) }));
    return {
      ym, todos: delMes, activos: activos.length,
      presupuestos: delMes.filter(e => e.estado === 'presupuesto').length,
      invitados: sum(activos, x => x.c.inv), ingreso: sum(activos, x => x.c.ingreso),
      costo: sum(activos, x => x.c.costo), directo: sum(activos, x => x.c.directo),
      ganancia: sum(activos, x => x.c.ganancia), porCobrar: sum(activos, x => Math.max(0, x.c.saldo))
    };
  }

  const proximos = (lista, hoy, cant = 5) => (lista || []).filter(e => e.fecha >= hoy && e.estado !== 'cancelado')
    .sort((a, b) => (a.fecha + (a.horaInicio || '')).localeCompare(b.fecha + (b.horaInicio || ''))).slice(0, cant);

  /** Texto listo para mandar por WhatsApp. */
  function presupuesto(e, cfg = {}) {
    const c = calc(e, cfg);
    const l = [`*AMO — Presupuesto de evento*`, e.nombre || 'Evento',
      `${longDate(e.fecha)}${e.horaInicio ? `, de ${e.horaInicio}${e.horaFin ? ` a ${e.horaFin}` : ''} h` : ''}`, '',
      `Invitados: ${c.inv}`, `Valor por persona: ${money(e.precioPersona)}`];
    (e.extras || []).filter(x => x.d || n(x.m)).forEach(x => l.push(`${x.d || 'Extra'}: ${money(x.m)}`));
    l.push(`*Total: ${money(c.ingreso)}*`);
    if (c.cobrado) l.push(`Recibido: ${money(c.cobrado)} · Saldo: ${money(c.saldo)}`);
    if (e.menu) l.push('', '*Menú*', e.menu);
    return l.join('\n');
  }

  return { ESTADOS, estado, TIPOS, MARGEN_DEFECTO, nuevo, cantReal, subMerca, subPersonal, calc, cuenta, mes, proximos, presupuesto };
})();