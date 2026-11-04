/* =====================================================================
   AMO Gestión · calc/gastos.js
   Cuentas de los gastos. Solo matemática, sin pantalla.

   Cada gasto es un documento propio (gastos/<id>), así dos personas
   pueden cargar al mismo tiempo sin pisarse:
   {
     fecha: '2026-11-03', proveedor: 'Frigorífico X', cat: 'merca',
     detalle: 'Factura A 0001-2345', monto: 1820000, medio: 'Transferencia',
     pagado: true, fechaPago: '2026-11-03', vence: '', fijo: false
   }
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.gastos = (() => {
  const { parseNum: n, sum, addMonths, daysInMonth, parseDate, pad, uid } = AMO.utils;

  /** variable: sube y baja con lo que se vende (sirve para el punto de equilibrio). */
  const CATS = [
    { k: 'merca', l: 'Mercadería de cocina', variable: true, color: '#0f4a33' },
    { k: 'bebidas', l: 'Bebidas y vinos', variable: true, color: '#3f7d5f' },
    { k: 'canon', l: 'Alquiler / canon del club', color: '#a8854a' },
    { k: 'servicios', l: 'Luz, gas, agua e internet', color: '#c7ab78' },
    { k: 'honorarios', l: 'Contador y honorarios', color: '#8c7b63' },
    { k: 'musica', l: 'Música en vivo', color: '#6f8f7d' },
    { k: 'mant', l: 'Mantenimiento y limpieza', color: '#7fae92' },
    { k: 'publi', l: 'Publicidad', color: '#b9a07a' },
    { k: 'impuestos', l: 'Impuestos y tasas', color: '#6b756f' },
    { k: 'bancos', l: 'Bancos y comisiones', variable: true, color: '#9aa79f' },
    { k: 'otros', l: 'Otros', color: '#c2b8a8' }
  ];
  const MEDIOS = ['Transferencia', 'Efectivo', 'Tarjeta', 'Mercado Pago', 'Cuenta corriente', 'Cheque'];
  const cat = k => CATS.find(c => c.k === k) || CATS[CATS.length - 1];

  const nuevo = (fecha, extra = {}) => Object.assign({
    fecha, proveedor: '', cat: 'merca', detalle: '', monto: '', medio: 'Transferencia',
    pagado: true, fechaPago: fecha, vence: '', fijo: false
  }, extra);

  /** Un gasto está completo si tiene fecha y monto mayor a cero. */
  const valido = g => !!(g && g.fecha && n(g.monto) > 0);

  /** Estado de una cuenta sin pagar respecto de hoy. */
  function estadoPago(g, hoy) {
    if (g.pagado) return { k: 'pagado', l: 'Pagado', dias: null };
    if (!g.vence) return { k: 'sinfecha', l: 'Sin vencimiento', dias: null };
    const dias = Math.round((parseDate(g.vence) - parseDate(hoy)) / 86400000);
    if (dias < 0) return { k: 'vencido', l: `Vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`, dias };
    if (dias === 0) return { k: 'hoy', l: 'Vence hoy', dias };
    if (dias <= 7) return { k: 'pronto', l: `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`, dias };
    return { k: 'ok', l: `Vence el ${parseDate(g.vence).getDate()}/${parseDate(g.vence).getMonth() + 1}`, dias };
  }

  /** Todas las cuentas sin pagar (de cualquier mes), de la más urgente a la menos. */
  function pendientes(lista, hoy) {
    const orden = { vencido: 0, hoy: 1, pronto: 2, ok: 3, sinfecha: 4 };
    return (lista || []).filter(g => valido(g) && !g.pagado)
      .map(g => Object.assign({}, g, { estado: estadoPago(g, hoy) }))
      .sort((a, b) => orden[a.estado.k] - orden[b.estado.k] || (a.vence || a.fecha).localeCompare(b.vence || b.fecha));
  }

  /** Resumen de un mes (por fecha del gasto, pagado o no). */
  function mes(lista, ym, hoy) {
    const items = (lista || []).filter(g => valido(g) && String(g.fecha).startsWith(ym))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.creado || '').localeCompare(String(a.creado || '')));
    const total = sum(items, g => g.monto);
    const porCat = CATS.map(c => ({ k: c.k, l: c.l, color: c.color, variable: !!c.variable, total: sum(items.filter(g => cat(g.cat).k === c.k), g => g.monto) }))
      .filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    const prov = {};
    items.forEach(g => { const k = (g.proveedor || 'Sin proveedor').trim(); prov[k] = (prov[k] || 0) + n(g.monto); });
    const porProveedor = Object.entries(prov).map(([nombre, t]) => ({ nombre, total: t })).sort((a, b) => b.total - a.total);
    const impagos = items.filter(g => !g.pagado);
    return {
      ym, items, total, porCat, porProveedor,
      variables: sum(porCat.filter(c => c.variable), c => c.total),
      fijos: sum(porCat.filter(c => !c.variable), c => c.total),
      mercaderia: sum(porCat.filter(c => c.k === 'merca' || c.k === 'bebidas'), c => c.total),
      impagos: impagos.length, montoImpago: sum(impagos, g => g.monto),
      vencidos: hoy ? pendientes(items, hoy).filter(g => g.estado.k === 'vencido').length : 0
    };
  }

  /**
   * Gastos marcados como fijos del mes anterior, listos para cargar en este mes.
   * Mantiene el día (si el mes es más corto, usa el último día), arranca sin pagar
   * y con vencimiento ese mismo día. No repite los que ya estén cargados.
   */
  function fijosParaCopiar(lista, ymDestino) {
    const ymOrigen = addMonths(ymDestino, -1);
    const clave = g => [g.proveedor, g.detalle, g.cat].map(x => String(x || '').trim().toLowerCase()).join('|');
    const yaEstan = new Set((lista || []).filter(g => g.fijo && String(g.fecha).startsWith(ymDestino)).map(clave));
    const ultimo = daysInMonth(ymDestino);
    return (lista || []).filter(g => g.fijo && valido(g) && String(g.fecha).startsWith(ymOrigen) && !yaEstan.has(clave(g)))
      .map(g => {
        const dia = Math.min(ultimo, parseDate(g.fecha).getDate());
        const fecha = `${ymDestino}-${pad(dia)}`;
        return { id: uid(), fecha, proveedor: g.proveedor, cat: g.cat, detalle: g.detalle, monto: n(g.monto), medio: g.medio, pagado: false, fechaPago: '', vence: fecha, fijo: true };
      });
  }

  /** Categoría que se usó la última vez con ese proveedor (para completarla sola). */
  function categoriaDe(lista, proveedor) {
    const p = String(proveedor || '').trim().toLowerCase(); if (!p) return null;
    const hit = (lista || []).filter(g => String(g.proveedor || '').trim().toLowerCase() === p)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
    return hit ? { cat: hit.cat, medio: hit.medio } : null;
  }
  const proveedores = lista => [...new Set((lista || []).map(g => String(g.proveedor || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return { CATS, MEDIOS, cat, nuevo, valido, estadoPago, pendientes, mes, fijosParaCopiar, categoriaDe, proveedores };
})();