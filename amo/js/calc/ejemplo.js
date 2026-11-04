/* =====================================================================
   AMO Gestión · calc/ejemplo.js
   Datos de ejemplo para mostrar la app. Todo lleva ejemplo: true y su id
   empieza con "ej-", así se borran sin tocar nada real.
   Arma un mes completo (el anterior al actual) y un evento próximo.
   Los números son inventados pero con escala de un restaurante de ~50
   cubiertos en Buenos Aires. Siempre da lo mismo (no usa azar real).
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.ejemplo = (() => {
  const { addMonths, ymOf, daysInMonth, pad, addDays, weekdayIndex } = AMO.utils;

  /** Números "al azar" pero repetibles. */
  function azar(semilla) { let x = semilla; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; }
  const redondo = (v, a = 1000) => Math.round(v / a) * a;

  function armar(hoy) {
    const ym = addMonths(ymOf(hoy), -1), r = azar(20261101), docs = [];
    const add = (col, id, doc) => docs.push({ col, id: 'ej-' + id, doc: Object.assign(doc, { ejemplo: true }) });
    const fecha = d => `${ym}-${pad(d)}`;

    /* Personal y sueldos */
    const gente = [
      ['moza1', 'Moza (ejemplo)', 'Moza', 'mensual', 1150000], ['moza2', 'Mozo (ejemplo)', 'Mozo', 'mensual', 1150000],
      ['coci', 'Cocinero (ejemplo)', 'Cocina', 'mensual', 1450000], ['ayud', 'Ayudante (ejemplo)', 'Ayudante de cocina', 'mensual', 1050000],
      ['bacha', 'Bacha (ejemplo)', 'Bacha', 'turno', 32000], ['enc', 'Encargado (ejemplo)', 'Encargado', 'mensual', 1600000]
    ];
    gente.forEach(([id, nombre, puesto, forma, valor]) => {
      add('personal', id, { nombre, puesto, forma, valor, desde: ym, baja: '', tel: '' });
      docs.push({ col: 'sueldos', id: `${ym}_ej-${id}`, doc: { ejemplo: true, ym, persona: 'ej-' + id, cant: forma === 'turno' ? 18 : '', extras: id === 'coci' ? 80000 : '', descuentos: '', adelantos: id === 'moza2' ? [{ id: 'ej-ad1', fecha: fecha(15), monto: 100000 }] : [], pagado: true, fechaPago: fecha(daysInMonth(ym)) } });
    });

    /* Caja de todo el mes, según los días que abre AMO */
    const servicios = AMO.calc.caja.SERVICIOS_POR_DIA;
    const base = { Cata: [14, 20, 30000], Noche: [20, 46, 39000], 'Mediodía': [22, 38, 34000] };
    for (let d = 1; d <= daysInMonth(ym); d++) {
      const f = fecha(d), sv = servicios[weekdayIndex(f)];
      if (!sv.length) continue;
      const lista = sv.map(nombre => {
        const [min, max, ticket] = base[nombre];
        const cub = Math.round(min + r() * (max - min)), tot = redondo(cub * ticket * (0.92 + r() * 0.16));
        const ef = redondo(tot * 0.14), qr = redondo(tot * 0.2), tr = redondo(tot * 0.12);
        return { nombre, cubiertos: cub, efectivo: ef, tarjeta: tot - ef - qr - tr, qr, transf: tr };
      });
      const vino = redondo(60000 + r() * (sv[0] === 'Cata' ? 260000 : 160000));
      add('caja', f, { fecha: f, servicios: lista, vinoteca: { monto: vino, efectivo: redondo(vino * 0.3) }, propinas: redondo(20000 + r() * 40000), fondo: 30000, contado: '', controlada: true, nota: '' });
    }

    /* Gastos */
    const g = (id, d, proveedor, cat, detalle, monto, extra = {}) => add('gastos', id, Object.assign({ fecha: fecha(d), proveedor, cat, detalle, monto, medio: 'Transferencia', pagado: true, fechaPago: fecha(d), vence: '', fijo: false }, extra));
    [2, 9, 16, 23, 30].forEach((d, i) => {
      g('carne' + i, Math.min(d, daysInMonth(ym)), 'Frigorífico (ejemplo)', 'merca', 'Carnes', redondo(1150000 + r() * 250000));
      g('verdu' + i, Math.min(d, daysInMonth(ym)), 'Verdulería (ejemplo)', 'merca', 'Verduras y frutas', redondo(350000 + r() * 90000), { medio: 'Efectivo' });
    });
    g('alma1', 5, 'Mayorista (ejemplo)', 'merca', 'Almacén', 766000); g('alma2', 19, 'Mayorista (ejemplo)', 'merca', 'Almacén', 636000);
    g('vinos1', 8, 'Bodega (ejemplo)', 'bebidas', 'Vinos para salón y vinoteca', 1850000);
    g('bebi', 10, 'Distribuidora (ejemplo)', 'bebidas', 'Gaseosas, agua y cerveza', 520000);
    g('canon', 1, 'Club Portugués (ejemplo)', 'canon', 'Canon mensual', 4200000, { fijo: true });
    g('luz', 12, 'Edesur (ejemplo)', 'servicios', 'Luz', 680000, { fijo: true });
    g('gas', 12, 'Metrogas (ejemplo)', 'servicios', 'Gas', 310000, { fijo: true });
    g('inter', 15, 'Internet (ejemplo)', 'servicios', 'Internet y teléfono', 65000, { fijo: true });
    g('conta', 10, 'Estudio contable (ejemplo)', 'honorarios', 'Honorarios', 420000, { fijo: true });
    g('limp', 20, 'Limpieza (ejemplo)', 'mant', 'Artículos de limpieza', 230000, { medio: 'Efectivo' });
    g('publi', 5, 'Instagram (ejemplo)', 'publi', 'Publicidad', 150000, { medio: 'Tarjeta', fijo: true });
    g('iibb', 20, 'AGIP (ejemplo)', 'impuestos', 'Ingresos brutos', 1350000);
    g('banco', daysInMonth(ym), 'Banco (ejemplo)', 'bancos', 'Comisiones de tarjeta y QR', 890000);
    // Dos cuentas sin pagar que vencen este mes, para que se vean los avisos
    g('musica', daysInMonth(ym), 'Músicos (ejemplo)', 'musica', 'Piano y canto, 9 shows', 1800000, { pagado: false, fechaPago: '', vence: addDays(hoy, 2), medio: 'Efectivo' });
    g('vinos2', 28, 'Bodega (ejemplo)', 'bebidas', 'Vinos a 30 días', 1400000, { pagado: false, fechaPago: '', vence: addDays(hoy, 20), medio: 'Cuenta corriente' });

    /* Eventos: uno hecho el mes pasado y uno próximo */
    add('eventos', 'ev1', {
      nombre: 'Cena corporativa (ejemplo)', cliente: 'Empresa de ejemplo', contacto: '', tipo: 'Corporativo', fecha: fecha(20), horaInicio: '20:00', horaFin: '23:30', estado: 'realizado',
      invitados: 30, precioPersona: 52000, extras: [], pagos: [{ id: 'ej-p1', fecha: fecha(5), monto: 780000, medio: 'Transferencia' }, { id: 'ej-p2', fecha: fecha(20), monto: 780000, medio: 'Transferencia' }],
      mercaderia: [{ d: 'Lomo', cant: 7, u: 'kg', pu: 24000, pp: false }, { d: 'Entradas frías', cant: 1, u: 'porción', pu: 2500, pp: true }, { d: 'Vino', cant: 20, u: 'botella', pu: 11000, pp: false }],
      personal: [{ rol: 'Moza', cant: 2, horas: 5, valorHora: 6500 }, { rol: 'Cocina', cant: 2, horas: 6, valorHora: 7500 }], otros: [{ d: 'Flores', m: 60000 }],
      cronograma: [{ h: '20:00', a: 'Recepción', ok: true }, { h: '21:00', a: 'Cena', ok: true }, { h: '22:30', a: 'Postre y brindis', ok: true }], menu: 'Entrada fría, lomo con papas rústicas, postre', notas: 'Evento de ejemplo.'
    });
    add('eventos', 'ev2', {
      nombre: 'Cumple 50 (ejemplo)', cliente: 'Cliente de ejemplo', contacto: '', tipo: 'Cumpleaños', fecha: addDays(hoy, 12), horaInicio: '20:30', horaFin: '00:30', estado: 'senado',
      invitados: 40, precioPersona: 45000, extras: [{ d: 'Barra libre', m: 200000 }], pagos: [{ id: 'ej-p3', fecha: hoy, monto: 600000, medio: 'Transferencia' }],
      mercaderia: [{ d: 'Vacío', cant: 12, u: 'kg', pu: 14000, pp: false }, { d: 'Empanadas', cant: 3, u: 'u', pu: 1500, pp: true }, { d: 'Malbec', cant: 24, u: 'botella', pu: 9000, pp: false }],
      personal: [{ rol: 'Moza', cant: 3, horas: 5, valorHora: 6500 }, { rol: 'Cocina', cant: 2, horas: 6, valorHora: 7500 }], otros: [{ d: 'Decoración', m: 80000 }],
      cronograma: [{ h: '20:30', a: 'Llegada de invitados', ok: false }, { h: '21:00', a: 'Empanadas', ok: false }, { h: '22:00', a: 'Plato principal', ok: false }, { h: '23:30', a: 'Torta y brindis', ok: false }], menu: 'Empanadas\nVacío con papas\nTorta', notas: 'Evento de ejemplo.'
    });

    /* Carta */
    const ins = [['bife', 'Bife de chorizo', 'kg', 19000, 85], ['papa', 'Papa', 'kg', 1200, 80], ['vacio', 'Vacío', 'kg', 14000, 80], ['harina', 'Harina', 'kg', 1100, 100], ['huevo', 'Huevo', 'u', 250, 100], ['ddl', 'Dulce de leche', 'kg', 8000, 100], ['hongos', 'Hongos', 'kg', 30000, 90], ['arroz', 'Arroz arborio', 'kg', 14000, 100]];
    ins.forEach(([id, nombre, unidad, precio, ap]) => add('insumos', id, { nombre, unidad, precio, aprovechamiento: ap }));
    const pl = (id, nombre, seccion, precio, ingredientes) => add('platos', id, { nombre, seccion, precio, ingredientes, nota: '' });
    pl('bife', 'Bife de chorizo con papas (ejemplo)', 'Principales', 28000, [{ insumo: 'ej-bife', cant: 0.35 }, { insumo: 'ej-papa', cant: 0.3 }, { insumo: '', d: 'Guarnición verde', u: 'porción', pu: 900, cant: 1 }]);
    pl('vacio', 'Vacío a la parrilla (ejemplo)', 'Principales', 24000, [{ insumo: 'ej-vacio', cant: 0.4 }, { insumo: 'ej-papa', cant: 0.25 }]);
    pl('risotto', 'Risotto de hongos (ejemplo)', 'Principales', 22000, [{ insumo: 'ej-arroz', cant: 0.1 }, { insumo: 'ej-hongos', cant: 0.15 }, { insumo: '', d: 'Parmesano', u: 'kg', pu: 32000, cant: 0.04 }, { insumo: '', d: 'Vino, caldo y manteca', u: 'porción', pu: 1800, cant: 1 }]);
    pl('flan', 'Flan con dulce de leche (ejemplo)', 'Postres', 8500, [{ insumo: 'ej-huevo', cant: 2 }, { insumo: '', d: 'Leche', u: 'l', pu: 1500, cant: 0.15 }, { insumo: 'ej-ddl', cant: 0.05 }]);

    /* Vinoteca */
    const vinos = [['malbec', 'Malbec Reserva', 'Bodega A (ejemplo)', 'Malbec', '2022', 9500, 19000, 14, 6], ['cf', 'Cabernet Franc', 'Bodega B (ejemplo)', 'Cabernet Franc', '2021', 12000, 24000, 9, 6],
      ['blend', 'Blend de Altura', 'Bodega C (ejemplo)', 'Blend', '2020', 18500, 36000, 6, 4], ['chardo', 'Chardonnay', 'Bodega A (ejemplo)', 'Chardonnay', '2023', 8200, 16500, 6, 6],
      ['rosado', 'Rosado de Malbec', 'Bodega D (ejemplo)', 'Rosado', '2024', 6500, 13000, 11, 6], ['brut', 'Extra Brut', 'Bodega B (ejemplo)', 'Espumante', '', 9800, 19500, 9, 6]];
    vinos.forEach(([id, nombre, bodega, varietal, anio, costo, precio, ini, minimo]) => add('vinos', id, { nombre, bodega, varietal, anio, costo, precio, stockInicial: ini, minimo, ubicacion: 'Estante principal' }));
    const mov = (i, d, vino, tipo, cant) => { const v = vinos.find(x => x[0] === vino); add('vinoMov', 'm' + i, { fecha: fecha(d), vino: 'ej-' + vino, tipo, cant, precio: v[6], costo: v[5] }); };
    [[3, 'malbec', 'venta', 3], [3, 'brut', 'salon', 2], [7, 'blend', 'venta', 2], [8, 'malbec', 'compra', 12], [10, 'cf', 'venta', 4], [11, 'chardo', 'venta', 3], [14, 'blend', 'venta', 1],
      [17, 'malbec', 'venta', 4], [17, 'rosado', 'salon', 3], [21, 'chardo', 'venta', 3], [24, 'cf', 'venta', 2], [28, 'blend', 'venta', 1], [daysInMonth(ym), 'malbec', 'venta', 5]]
      .forEach(([d, v, t, c], i) => mov(i, d, v, t, c));

    return { ym, docs };
  }

  return { armar };
})();