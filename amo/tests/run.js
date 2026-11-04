/* =====================================================================
   AMO Gestión · tests/run.js
   Pruebas de la base. Correr con:  node tests/run.js
   Carga los archivos del núcleo como en el navegador y revisa que los
   cálculos y el guardado den lo que tienen que dar.
   ===================================================================== */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

function makeEnv() {
  const ls = new Map();
  const ctx = {
    console, setTimeout, clearTimeout, Intl, Date, Math, JSON,
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  ['js/utils.js', 'js/store.js', 'js/calc/caja.js', 'js/calc/gastos.js', 'js/calc/personal.js', 'js/calc/eventos.js', 'js/calc/carta.js', 'js/calc/vinoteca.js', 'js/calc/resumen.js', 'js/calc/ejemplo.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }));
  return { ctx, ls };
}

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    esperado: ${JSON.stringify(want)}\n    obtenido: ${JSON.stringify(got)}`}`);
};
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { ctx, ls } = makeEnv();
  const u = ctx.AMO.utils;

  console.log('\n— Números escritos en Argentina');
  eq('1.250.000', u.parseNum('1.250.000'), 1250000);
  eq('$ 12.000', u.parseNum('$ 12.000'), 12000);
  eq('1,5', u.parseNum('1,5'), 1.5);
  eq('0,35', u.parseNum('0,35'), 0.35);
  eq('0.35', u.parseNum('0.35'), 0.35);
  eq('0.350 (decimal, empieza con 0)', u.parseNum('0.350'), 0.35);
  eq('1.234,56', u.parseNum('1.234,56'), 1234.56);
  eq('vacío', u.parseNum(''), 0);
  eq('texto', u.parseNum('hola'), 0);
  eq('número', u.parseNum(45000), 45000);

  console.log('\n— Formatos');
  eq('plata', u.money(1250000).replace(/\s/g, ' '), '$ 1.250.000');
  eq('plata redondea', u.money(999.6).replace(/\s/g, ' '), '$ 1.000');
  eq('campo con miles', u.toField(1250000), '1.250.000');
  eq('campo decimal', u.toField(0.35), '0,35');
  eq('campo vacío', u.toField(''), '');
  eq('porcentaje', u.pct(0.3456), '35%');
  eq('porcentaje con decimal', u.pct(0.3456, 1), '34,6%');
  eq('millones corto', u.moneyShort(37491000), '$37,5 M');
  eq('millones redondo', u.moneyShort(20000000), '$20 M');
  eq('suma con textos', u.sum([{ m: '1.000' }, { m: 500 }, { m: '' }], x => x.m), 1500);

  console.log('\n— Fechas');
  eq('sumar días cruza mes', u.addDays('2026-10-31', 1), '2026-11-01');
  eq('restar meses cruza año', u.addMonths('2026-01', -1), '2025-12');
  eq('días de febrero 2028', u.daysInMonth('2028-02'), 29);
  eq('lunes = 0', u.weekdayIndex('2026-11-02'), 0);
  eq('domingo = 6', u.weekdayIndex('2026-11-01'), 6);
  eq('nombre del mes', u.monthName('2026-11'), 'Noviembre de 2026');

  console.log('\n— Objetos');
  const o = {}; u.setPath(o, 'servicios.0.cubiertos', 30);
  eq('setPath crea listas', o, { servicios: [{ cubiertos: 30 }] });
  eq('getPath', u.getPath(o, 'servicios.0.cubiertos'), 30);
  eq('esc', u.esc('<b>"AMO"</b>'), '&lt;b&gt;&quot;AMO&quot;&lt;/b&gt;');

  console.log('\n— Guardado (modo local)');
  const s = ctx.AMO.store;
  s.register('caja');
  await s.connect();
  eq('arranca en modo local', s.state.mode, 'local');
  s.save('caja', '2026-11-01', { total: 100 }, { delay: 20 });
  s.save('caja', '2026-11-01', { total: 200 }, { delay: 20 });
  eq('se lee al instante', s.get('caja', '2026-11-01'), { total: 200 });
  await wait(60);
  eq('se agrupa en una sola escritura', JSON.parse(ls.get('amo-gestion-v3')).caja['2026-11-01'], { total: 200 });
  const got = s.get('caja', '2026-11-01'); got.total = 999;
  eq('get devuelve una copia', s.get('caja', '2026-11-01').total, 200);
  eq('list agrega el id', s.list('caja'), [{ total: 200, id: '2026-11-01' }]);
  await s.remove('caja', '2026-11-01');
  eq('borrar', s.get('caja', '2026-11-01'), null);
  eq('borrar persiste', JSON.parse(ls.get('amo-gestion-v3')).caja, {});

  const env2 = makeEnv();
  env2.ls.set('amo-gestion-v3', JSON.stringify({ caja: { '2026-10-01': { total: 5 } } }));
  env2.ctx.AMO.store.register('caja'); await env2.ctx.AMO.store.connect();
  eq('recupera lo guardado al volver a abrir', env2.ctx.AMO.store.get('caja', '2026-10-01'), { total: 5 });

  console.log('\n— Caja: un día');
  const C = ctx.AMO.calc.caja;
  eq('sábado trae mediodía y noche', C.nuevoDia('2026-11-07').servicios.map(x => x.nombre), ['Mediodía', 'Noche']);
  eq('miércoles trae cata', C.nuevoDia('2026-11-04').servicios.map(x => x.nombre), ['Cata']);
  eq('lunes no abre', C.abreNormalmente('2026-11-02'), false);
  const dia = {
    fecha: '2026-11-07',
    servicios: [
      { nombre: 'Mediodía', cubiertos: 20, efectivo: 100000, tarjeta: 400000, qr: 200000, transf: 0 },
      { nombre: 'Noche', cubiertos: '40', efectivo: '300.000', tarjeta: '1.000.000', qr: '', transf: 300000 }
    ],
    vinoteca: { monto: '150.000', efectivo: 50000 }, propinas: 30000, fondo: 20000, contado: '460.000'
  };
  const d = C.dia(dia);
  eq('salón', d.salon, 2300000);
  eq('cubiertos', d.cubiertos, 60);
  eq('ticket promedio', Math.round(d.ticket), 38333);
  eq('total con vinoteca', d.total, 2450000);
  eq('efectivo por medio', d.medios.efectivo, 400000);
  eq('efectivo esperado (fondo + salón + vinoteca)', d.esperado, 470000);
  eq('faltan 10.000', d.diferencia, -10000);
  eq('total por servicio', d.servicios.map(x => x.total), [700000, 1600000]);
  eq('sin contar no hay diferencia', C.dia(Object.assign({}, dia, { contado: '' })).diferencia, null);
  eq('día vacío', C.dia(C.nuevoDia('2026-11-07')).conDatos, false);

  console.log('\n— Caja: un mes');
  const docs = [
    dia,
    { fecha: '2026-11-14', servicios: [{ nombre: 'Noche', cubiertos: 50, tarjeta: 2000000 }], controlada: true },
    { fecha: '2026-11-13', servicios: [{ nombre: 'Noche', cubiertos: 30, efectivo: 900000 }] },
    { fecha: '2026-11-12', servicios: [] },
    { fecha: '2026-10-31', servicios: [{ nombre: 'Noche', cubiertos: 10, efectivo: 1 }] }
  ];
  const m = C.mes(docs, '2026-11');
  eq('solo días del mes y con datos', m.dias.map(x => x.fecha), ['2026-11-07', '2026-11-13', '2026-11-14']);
  eq('total del mes', m.total, 5350000);
  eq('cubiertos del mes', m.cubiertos, 140);
  eq('mejor día', m.mejor.fecha, '2026-11-07');
  eq('promedio de los sábados', m.porDia.find(x => x.nombre === 'Sábado').promedio, 2225000);
  eq('días sin controlar', m.sinControlar, 2);
  eq('diferencias de efectivo', m.diferencias, -10000);
  eq('mes vacío no rompe', C.mes([], '2026-12').ticket, 0);

  console.log('\n— Gastos');
  const G = ctx.AMO.calc.gastos;
  const gs = [
    { id: 'a', fecha: '2026-10-01', proveedor: 'Club Portugués', cat: 'canon', detalle: 'Canon', monto: 4200000, medio: 'Transferencia', pagado: true, fijo: true },
    { id: 'b', fecha: '2026-10-12', proveedor: 'Edesur', cat: 'servicios', detalle: 'Luz', monto: '680.000', pagado: true, fijo: true },
    { id: 'c', fecha: '2026-10-31', proveedor: 'Edesur', cat: 'servicios', detalle: 'Luz', monto: 10, pagado: true, fijo: false },
    { id: 'd', fecha: '2026-11-02', proveedor: 'Frigorífico', cat: 'merca', detalle: 'Carnes', monto: 1800000, medio: 'Efectivo', pagado: true },
    { id: 'e', fecha: '2026-11-03', proveedor: 'Bodega', cat: 'bebidas', detalle: 'Vinos', monto: 1400000, pagado: false, vence: '2026-11-01' },
    { id: 'f', fecha: '2026-11-03', proveedor: 'Músicos', cat: 'musica', detalle: 'Shows', monto: 900000, pagado: false, vence: '2026-11-08' },
    { id: 'g', fecha: '2026-11-03', proveedor: 'Técnico', cat: 'mant', monto: 300000, pagado: false, vence: '' },
    { id: 'h', fecha: '2026-11-04', proveedor: 'Club Portugués', cat: 'canon', detalle: 'Canon', monto: 4200000, pagado: false, vence: '2026-11-03', fijo: true },
    { id: 'z', fecha: '2026-11-05', proveedor: 'Sin monto', cat: 'otros', monto: '' }
  ];
  const gm = G.mes(gs, '2026-11', '2026-11-03');
  eq('total del mes (ignora sin monto)', gm.total, 8600000);
  eq('mercadería y bebidas', gm.mercaderia, 3200000);
  eq('variables vs fijos', [gm.variables, gm.fijos], [3200000, 5400000]);
  eq('categoría más grande primero', gm.porCat[0].k, 'canon');
  eq('sin pagar del mes', [gm.impagos, gm.montoImpago], [4, 6800000]);
  eq('vencidos', gm.vencidos, 1);
  const pend = G.pendientes(gs, '2026-11-03');
  eq('orden de urgencia', pend.map(g => g.id), ['e', 'h', 'f', 'g']);
  eq('textos de estado', pend.map(g => g.estado.l), ['Vencido hace 2 días', 'Vence hoy', 'Vence en 5 días', 'Sin vencimiento']);
  const fj = G.fijosParaCopiar(gs, '2026-11');
  eq('trae fijos que faltan (canon ya está)', fj.map(g => g.detalle), ['Luz']);
  eq('fijo copiado sin pagar y vence ese día', [fj[0].fecha, fj[0].pagado, fj[0].vence, fj[0].monto], ['2026-11-12', false, '2026-11-12', 680000]);
  eq('día 31 → último día de un mes corto', G.fijosParaCopiar([{ fecha: '2027-01-31', fijo: true, monto: 1, cat: 'canon' }], '2027-02')[0].fecha, '2027-02-28');
  eq('categoría según proveedor', G.categoriaDe(gs, ' edesur '), { cat: 'servicios', medio: undefined });
  eq('lista de proveedores sin repetir', G.proveedores(gs).length, 7);

  console.log('\n— Personal');
  const P = ctx.AMO.calc.personal;
  const gente = [
    { id: 'p1', nombre: 'Ana', puesto: 'Moza', forma: 'mensual', valor: '1.150.000', desde: '2026-01', baja: '' },
    { id: 'p2', nombre: 'Beto', puesto: 'Bacha', forma: 'turno', valor: 32000, desde: '2026-10', baja: '' },
    { id: 'p3', nombre: 'Caro', puesto: 'Cocina', forma: 'hora', valor: 7000, desde: '2025-05', baja: '2026-10' },
    { id: 'p4', nombre: 'Dani', puesto: 'Moza', forma: 'mensual', valor: 1000000, desde: '2026-12', baja: '' }
  ];
  const sueldos = [
    { ym: '2026-11', persona: 'p1', extras: 80000, descuentos: 30000, adelantos: [{ fecha: '2026-11-10', monto: 100000 }, { fecha: '2026-11-20', monto: '50.000' }] },
    { ym: '2026-11', persona: 'p2', cant: 18, pagado: true },
    { ym: '2026-10', persona: 'p3', cant: 100 }
  ];
  eq('trabaja según alta y baja', ['2026-11', '2026-10', '2026-12'].map(ym => gente.filter(p => P.trabajaEn(p, ym)).map(p => p.id).join(',')), ['p1,p2', 'p1,p2,p3', 'p1,p2,p4']);
  const pm = P.mes(gente, sueldos, '2026-11', { cargas: 0 });
  eq('quiénes cobran en noviembre', pm.filas.map(f => f.persona.nombre), ['Ana', 'Beto']);
  eq('sueldo mensual con extras y descuentos', pm.filas[0].bruto, 1200000);
  eq('adelantos se descuentan', [pm.filas[0].adelantos, pm.filas[0].aPagar], [150000, 1050000]);
  eq('por turno', pm.filas[1].bruto, 576000);
  eq('total y falta pagar', [pm.bruto, pm.faltaPagar, pm.pendientes], [1776000, 1050000, 1]);
  const pc = P.mes(gente, sueldos, '2026-11', { cargas: 25, provisionSAC: true });
  eq('cargas 25%', Math.round(pc.cargas), 444000);
  eq('aguinaldo separado (1/12 con cargas)', Math.round(pc.sac), 185000);
  eq('costo total', Math.round(pc.costo), 2405000);
  eq('costo por puesto', pc.porPuesto.map(x => x.puesto), ['Moza', 'Bacha']);
  eq('por hora en octubre', P.mes(gente, sueldos, '2026-10', {}).filas.find(f => f.persona.id === 'p3').bruto, 700000);
  eq('id del sueldo ida y vuelta', P.nuevoSueldo(P.idSueldo('2026-11', 'abc_1')).persona, 'abc_1');
  eq('descuento no deja sueldo negativo', P.liquidar({ forma: 'mensual', valor: 100 }, { descuentos: 500 }).bruto, 0);

  console.log('\n— Eventos');
  const E = ctx.AMO.calc.eventos;
  const ev = {
    nombre: 'Cumple 50', fecha: '2026-11-17', horaInicio: '20:30', horaFin: '00:30', estado: 'senado', invitados: 40, precioPersona: '45.000',
    extras: [{ d: 'Barra libre', m: 200000 }],
    pagos: [{ fecha: '2026-11-01', monto: 600000 }],
    mercaderia: [{ d: 'Vacío', cant: 12, pu: 14000 }, { d: 'Empanadas', cant: 3, pp: true, pu: 1500 }],
    personal: [{ rol: 'Moza', cant: 2, horas: 5, valorHora: 6000 }],
    otros: [{ d: 'Decoración', m: 80000 }], menu: 'Empanadas\nVacío'
  };
  const ec = E.calc(ev, { impuestosVentas: 5, margenEvento: 35 });
  eq('cobro total', ec.ingreso, 2000000);
  eq('mercadería por invitado (3 × 40)', E.cantReal(ev.mercaderia[1], 40), 120);
  eq('mercadería', ec.merca, 348000);
  eq('personal', ec.personal, 60000);
  eq('impuestos 5%', ec.impuestos, 100000);
  eq('ganancia', ec.ganancia, 1412000);
  eq('costo por invitado', ec.costoInvitado, 14700);
  eq('saldo a cobrar', ec.saldo, 1400000);
  eq('precio sugerido: (488.000 ÷ 0,60 − 200.000) ÷ 40, redondeado a $100', ec.precioSugerido, 15400);
  eq('margen por defecto 35%', E.calc(ev, {}).margenBuscado, 0.35);
  const lista = [ev, Object.assign({}, ev, { fecha: '2026-11-20', estado: 'presupuesto' }), Object.assign({}, ev, { fecha: '2026-11-21', estado: 'cancelado' }), Object.assign({}, ev, { fecha: '2026-12-01' })];
  eq('mes sin presupuestos ni cancelados', E.mes(lista, '2026-11', {}).activos, 1);
  eq('mes con presupuestos', E.mes(lista, '2026-11', { incluirPresupuestos: true }).activos, 2);
  eq('próximos (sin cancelados)', E.proximos(lista, '2026-11-18').map(e => e.fecha), ['2026-11-20', '2026-12-01']);
  const txt = E.presupuesto(ev, {});
  eq('presupuesto tiene total y saldo', [txt.includes('*Total: $'), txt.includes('Saldo:'), txt.includes('Menú')], [true, true, true]);

  console.log('\n— Carta');
  const K = ctx.AMO.calc.carta;
  const insumos = [
    { id: 'bife', nombre: 'Bife de chorizo', unidad: 'kg', precio: 19000, aprovechamiento: 85 },
    { id: 'papa', nombre: 'Papa', unidad: 'kg', precio: '1.200', aprovechamiento: 80 },
    { id: 'mant', nombre: 'Manteca', unidad: 'kg', precio: 12000, aprovechamiento: '' }
  ];
  eq('costo útil con 85% de aprovechamiento', Math.round(K.costoUnidad(insumos[0])), 22353);
  eq('aprovechamiento vacío = 100%', K.costoUnidad(insumos[2]), 12000);
  const platos = [
    { id: 'p1', nombre: 'Bife con papas', seccion: 'Principales', precio: 28000, ingredientes: [{ insumo: 'bife', cant: 0.35 }, { insumo: 'papa', cant: '0,3' }, { insumo: '', d: 'Guarnición', pu: 900, cant: 1 }] },
    { id: 'p2', nombre: 'Flan', seccion: 'Postres', precio: 8500, ingredientes: [{ insumo: '', d: 'Huevos', pu: 250, cant: 2 }, { insumo: '', d: 'Dulce de leche', pu: 0, cant: 0.05 }] },
    { id: 'p3', nombre: 'Provoleta', seccion: 'Entradas', precio: 0, ingredientes: [{ insumo: 'borrado', cant: 1 }] }
  ];
  const kc = K.carta(platos, insumos, {});
  const bife = kc.filas.find(f => f.p.id === 'p1').c;
  eq('costo del plato con insumos y suelto', Math.round(bife.costo), 9174);
  eq('% de mercadería', Math.round(bife.fc * 1000) / 10, 32.8);
  eq('32,8% con objetivo 30% = ajustado', bife.estado.k, 'justo');
  eq('precio sugerido', bife.sugerido, 30600);
  eq('con objetivo 25% pasa a revisar', K.carta(platos, insumos, { foodCost: 25 }).filas.find(f => f.p.id === 'p1').c.estado.k, 'caro');
  eq('ingrediente sin precio cuenta como incompleto', kc.filas.find(f => f.p.id === 'p2').c.incompletos, 1);
  eq('insumo borrado se marca', kc.filas.find(f => f.p.id === 'p3').c.lineas[0].perdido, true);
  eq('orden por sección de la carta', kc.filas.map(f => f.p.id), ['p3', 'p1', 'p2']);
  eq('si sube el bife, sube el plato', Math.round(K.carta(platos, [Object.assign({}, insumos[0], { precio: 23000 }), insumos[1], insumos[2]], {}).filas.find(f => f.p.id === 'p1').c.costo), 10821);
  eq('dónde se usa un insumo', K.usos('papa', platos).map(p => p.id), ['p1']);

  console.log('\n— Vinoteca');
  const V = ctx.AMO.calc.vinoteca;
  const vinos = [
    { id: 'm', nombre: 'Malbec Reserva', bodega: 'Bodega A', costo: 9500, precio: '19.000', minimo: 6, stockInicial: 10 },
    { id: 'c', nombre: 'Chardonnay', bodega: 'Bodega A', costo: 8000, precio: 16000, minimo: 6, stockInicial: 4 },
    { id: 'b', nombre: 'Blend', bodega: 'Bodega C', costo: 18000, precio: 36000, minimo: 4, stockInicial: 2 }
  ];
  const vm = [
    { vino: 'm', fecha: '2026-11-02', tipo: 'venta', cant: 3, precio: 19000, costo: 9500 },
    { vino: 'm', fecha: '2026-11-05', tipo: 'compra', cant: 12, costo: 9000 },
    { vino: 'm', fecha: '2026-11-10', tipo: 'salon', cant: 2, costo: 9500 },
    { vino: 'm', fecha: '2026-11-12', tipo: 'conteo', cant: -1 },
    { vino: 'c', fecha: '2026-11-03', tipo: 'venta', cant: 4, precio: 15000, costo: 8000 },
    { vino: 'b', fecha: '2026-11-04', tipo: 'baja', cant: 1 },
    { vino: 'm', fecha: '2026-10-20', tipo: 'venta', cant: 1, precio: 18000, costo: 9000 }
  ];
  eq('stock = inicial + compras − salidas ± conteo', V.stock(vinos[0], vm), 15);
  eq('sin stock', V.catalogo(vinos, vm, '2026-11-15').filas.find(f => f.v.id === 'c').estado.k, 'sin');
  const vc = V.catalogo(vinos, vm, '2026-11-15');
  eq('para reponer', vc.reponer.map(f => f.v.id).sort(), ['b', 'c']);
  eq('pedido: hasta el doble del mínimo', vc.reponer.map(f => [f.v.id, f.pedir]).sort(), [['b', 7], ['c', 12]]);
  eq('pedidos agrupados por bodega', vc.pedidos.map(p => [p.bodega, p.botellas]), [['Bodega A', 12], ['Bodega C', 7]]);
  eq('valor del stock al costo', vc.valorCosto, 15 * 9500 + 1 * 18000);
  eq('cuánto alcanza (6 salidas en 30 días → 75 días)', vc.filas.find(f => f.v.id === 'm').alcanza, 75);
  const vmes = V.mes(vm, vinos, '2026-11');
  eq('vendidas y facturado (precio del momento)', [vmes.vendidas, vmes.facturado], [7, 117000]);
  eq('ganancia de las ventas', vmes.ganancia, 3 * 9500 + 4 * 7000);
  eq('consumo del salón al costo', [vmes.salon, vmes.salonCosto], [2, 19000]);
  eq('más vendido', vmes.top[0].vino.id, 'm');
  eq('ajuste por conteo', V.ajusteConteo(15, '12'), -3);
  eq('texto del pedido', V.pedidoTexto(vc.pedidos[1]).split('\n')[1], '• 7 × Blend');

  console.log('\n— Resumen');
  const R = ctx.AMO.calc.resumen;
  const base = {
    caja: [
      { fecha: '2026-11-06', servicios: [{ nombre: 'Noche', cubiertos: 40, tarjeta: 1600000 }], vinoteca: { monto: 200000 } },
      { fecha: '2026-11-07', servicios: [{ nombre: 'Noche', cubiertos: 60, tarjeta: 2400000 }], controlada: true },
      { fecha: '2026-10-10', servicios: [{ nombre: 'Noche', cubiertos: 50, tarjeta: 1000000 }] }
    ],
    gastos: [
      { id: 'g1', fecha: '2026-11-02', cat: 'merca', monto: 1200000, pagado: true },
      { id: 'g2', fecha: '2026-11-01', cat: 'canon', monto: 1000000, pagado: false, vence: '2026-11-01' },
      { id: 'g3', fecha: '2026-11-03', cat: 'bancos', monto: 100000, pagado: true }
    ],
    personal: [{ id: 'p1', nombre: 'Ana', forma: 'mensual', valor: 800000, desde: '2026-01' }],
    sueldos: [],
    eventos: [{ id: 'e1', fecha: '2026-11-20', estado: 'confirmado', invitados: 10, precioPersona: 50000, mercaderia: [{ cant: 1, pu: 100000 }], personal: [], otros: [] }],
    vinos: [], vinoMov: [], platos: [], insumos: [],
    config: {}
  };
  const rm = R.mes(base, '2026-11', '2026-11-05');
  eq('ventas = caja + vinoteca + eventos', rm.ventas, 4700000);
  eq('costos = gastos 2.300.000 + sueldo 800.000 + evento 100.000', rm.costos, 3200000);
  eq('resultado', rm.resultado, 1500000);
  eq('mercadería sobre salón y vinoteca', Math.round(rm.foodCost * 1000) / 10, 28.6);
  eq('punto de equilibrio: fijos 1.800.000 − eventos 400.000, sobre margen 69%', Math.round(rm.equilibrio.ventas), Math.round(1400000 / (1 - 1300000 / 4200000)));
  eq('cubiertos para el equilibrio', rm.equilibrio.cubiertos, Math.ceil(rm.equilibrio.ventas / 40000));
  eq('equilibrio alcanzado', rm.equilibrio.alcanzado, true);
  const rm2 = R.mes(Object.assign({}, base, { config: { eventosEnGastos: true, impuestosVentas: 10 } }), '2026-11', '2026-11-05');
  eq('si las compras de eventos ya están en Gastos no se suman dos veces', rm2.evCostos, 0);
  eq('impuestos sobre ventas', rm2.impuestos, 470000);
  eq('historial de 6 meses', R.historial(base, '2026-11', '2026-11-05').map(h => h.ventas), [0, 0, 0, 0, 1000000, 4700000]);
  eq('variación', R.variacion(4700000, 1000000), 3.7);
  const av = R.avisos(base, '2026-11', '2026-11-05');
  eq('avisos: vencida, caja sin controlar, sueldo, evento por cobrar', av.map(a => a.ir), ['gastos', 'caja', 'personal', 'eventos']);
  eq('estado de resultados: costo más grande primero', R.estado(rm).costos[0][0], 'Mercadería de cocina');
  eq('equilibrio con % de variables del mes anterior', Math.round(R.mes(base, '2026-11', '2026-11-05', { ratioVariables: 0.3 }).equilibrio.ventas), 2000000);

  console.log('\n— Datos de ejemplo');
  const EJ = ctx.AMO.calc.ejemplo.armar('2026-11-03');
  eq('arma el mes anterior', EJ.ym, '2026-10');
  eq('todo marcado como ejemplo', EJ.docs.every(d => d.doc.ejemplo === true), true);
  eq('ids sin repetir', new Set(EJ.docs.map(d => d.col + '/' + d.id)).size, EJ.docs.length);
  eq('siempre da lo mismo', ctx.AMO.calc.ejemplo.armar('2026-11-03').docs.length, EJ.docs.length);
  const ejData = {};
  ['caja', 'gastos', 'personal', 'sueldos', 'eventos', 'vinos', 'vinoMov', 'platos', 'insumos'].forEach(c => { ejData[c] = EJ.docs.filter(d => d.col === c).map(d => Object.assign({ id: d.id }, d.doc)); });
  ejData.config = {};
  eq('caja solo los días que abre AMO (oct 2026: 31 − 4 lunes − 4 martes = 23)', ejData.caja.length, 23);
  const ejm = R.mes(ejData, '2026-10', '2026-11-03');
  eq('los sueldos de ejemplo coinciden con las personas', ejm.personal.filas.every(f => f.sueldo && f.pagado), true);
  eq('el mes de ejemplo da números razonables', [ejm.ventas > 25e6, ejm.resultado > 0, ejm.margen < 0.3], [true, true, true]);
  eq('platos de ejemplo sin ingredientes perdidos', ctx.AMO.calc.carta.carta(ejData.platos, ejData.insumos, {}).incompletos, 0);
  eq('avisos de ejemplo: cuenta que vence pronto', R.avisos(ejData, '2026-11', '2026-11-03').some(a => a.txt.includes('esta semana')), true);

  console.log(`\n${pass} bien, ${fail} mal\n`);
  process.exit(fail ? 1 : 0);
})();