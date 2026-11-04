/* =====================================================================
   AMO Gestión · calc/vinoteca.js
   Stock y números de la vinoteca. Solo matemática, sin pantalla.

   Vino (vinos/<id>):
   { nombre, bodega, varietal, anio, costo, precio, minimo, ubicacion, stockInicial }

   Movimiento (vinoMov/<id>), uno por documento para que varias personas
   puedan cargar a la vez sin pisarse:
   { fecha, vino: '<id>', tipo, cant, precio, costo }
     · tipo: venta | salon | compra | baja | conteo
     · cant: botellas (positivo). En "conteo" es la diferencia con lo contado (+ o −).
     · precio y costo: los del momento, así las ventas viejas no cambian si sube el precio.

   El stock NO se guarda: se calcula = stockInicial + entradas − salidas.
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.vinoteca = (() => {
  const { parseNum: n, sum, ratio, addDays } = AMO.utils;

  const TIPOS = [
    { k: 'venta', l: 'Venta en la vinoteca', signo: -1 },
    { k: 'salon', l: 'Consumo del salón', signo: -1 },
    { k: 'compra', l: 'Compra / ingreso', signo: 1 },
    { k: 'baja', l: 'Rotura o faltante', signo: -1 },
    { k: 'conteo', l: 'Ajuste por conteo', signo: 1 }
  ];
  const tipo = k => TIPOS.find(t => t.k === k) || TIPOS[0];
  const efecto = m => tipo(m.tipo).signo * n(m.cant);

  const nuevoVino = () => ({ nombre: '', bodega: '', varietal: '', anio: '', costo: '', precio: '', minimo: 6, ubicacion: '', stockInicial: 0 });

  const stock = (v, movs) => n(v.stockInicial) + sum((movs || []).filter(m => m.vino === v.id), efecto);

  /** Botellas que salen por día (ventas + salón) en los últimos 30 días hasta hoy. */
  function salidaDiaria(vinoId, movs, hoy) {
    const desde = addDays(hoy, -30);
    const sal = (movs || []).filter(m => m.vino === vinoId && (m.tipo === 'venta' || m.tipo === 'salon') && m.fecha > desde && m.fecha <= hoy);
    return sum(sal, m => m.cant) / 30;
  }

  function estado(st, minimo) {
    if (st <= 0) return { k: 'sin', l: 'Sin stock', tono: 'bad' };
    if (st <= n(minimo)) return { k: 'reponer', l: 'Reponer', tono: 'warn' };
    return { k: 'ok', l: 'Hay', tono: 'good' };
  }

  /** Catálogo completo con stock, margen, valor y cuánto alcanza. */
  function catalogo(vinos, movs, hoy) {
    const filas = (vinos || []).map(v => {
      const st = stock(v, movs), costo = n(v.costo), precio = n(v.precio);
      const diaria = salidaDiaria(v.id, movs, hoy);
      return {
        v, stock: st, costo, precio, ganancia: precio - costo, margen: ratio(precio - costo, precio),
        valorCosto: Math.max(0, st) * costo, valorVenta: Math.max(0, st) * precio,
        diaria, alcanza: diaria > 0 ? Math.floor(Math.max(0, st) / diaria) : null,
        estado: estado(st, v.minimo),
        // se pide hasta tener el doble del mínimo
        pedir: st <= n(v.minimo) ? Math.max(0, n(v.minimo) * 2 - st) : 0
      };
    }).sort((a, b) => String(a.v.bodega || '').localeCompare(String(b.v.bodega || '')) || String(a.v.nombre || '').localeCompare(String(b.v.nombre || '')));
    const reponer = filas.filter(f => f.estado.k !== 'ok');
    const porBodega = {};
    reponer.forEach(f => { const b = (f.v.bodega || 'Sin bodega').trim(); (porBodega[b] = porBodega[b] || []).push(f); });
    return {
      filas, reponer,
      pedidos: Object.entries(porBodega).map(([bodega, items]) => ({ bodega, items, botellas: sum(items, f => f.pedir), costo: sum(items, f => f.pedir * f.costo) })),
      botellas: sum(filas, f => Math.max(0, f.stock)), etiquetas: filas.length,
      valorCosto: sum(filas, f => f.valorCosto), valorVenta: sum(filas, f => f.valorVenta)
    };
  }

  /** Números de un mes a partir de los movimientos. */
  function mes(movs, vinos, ym) {
    const nombres = new Map((vinos || []).map(v => [v.id, v]));
    const delMes = (movs || []).filter(m => String(m.fecha || '').startsWith(ym)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const ventas = delMes.filter(m => m.tipo === 'venta');
    const salon = delMes.filter(m => m.tipo === 'salon');
    const compras = delMes.filter(m => m.tipo === 'compra');
    const salen = {};
    ventas.concat(salon).forEach(m => { salen[m.vino] = (salen[m.vino] || 0) + n(m.cant); });
    return {
      movs: delMes,
      vendidas: sum(ventas, m => m.cant), facturado: sum(ventas, m => n(m.cant) * n(m.precio)),
      ganancia: sum(ventas, m => n(m.cant) * (n(m.precio) - n(m.costo))),
      salon: sum(salon, m => m.cant), salonCosto: sum(salon, m => n(m.cant) * n(m.costo)),
      compradas: sum(compras, m => m.cant), comprasCosto: sum(compras, m => n(m.cant) * n(m.costo)),
      bajas: sum(delMes.filter(m => m.tipo === 'baja'), m => m.cant),
      top: Object.entries(salen).map(([id, c]) => ({ vino: nombres.get(id) || { nombre: 'Vino borrado' }, cant: c })).sort((a, b) => b.cant - a.cant).slice(0, 5)
    };
  }

  /** Movimiento de conteo: la diferencia entre lo contado y lo que dice el sistema. */
  const ajusteConteo = (stockActual, contado) => n(contado) - stockActual;

  /** Texto del pedido para mandarle a la bodega. */
  const pedidoTexto = p => [`Hola! Pedido para AMO:`, ...p.items.filter(f => f.pedir > 0).map(f => `• ${f.pedir} × ${[f.v.nombre, f.v.varietal, f.v.anio].filter(Boolean).join(' ')}`), 'Gracias!'].join('\n');

  return { TIPOS, tipo, efecto, nuevoVino, stock, salidaDiaria, estado, catalogo, mes, ajusteConteo, pedidoTexto };
})();