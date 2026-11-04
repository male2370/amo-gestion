/* =====================================================================
   AMO Gestión · calc/carta.js
   Costo de los platos. Solo matemática, sin pantalla.

   Insumo (insumos/<id>): lo que se compra, con su precio de hoy.
   { nombre: 'Bife de chorizo', unidad: 'kg', precio: 19000, aprovechamiento: 85 }
     · aprovechamiento: % que queda útil después de limpiar (grasa, cáscara, hueso).
       Si de 1 kg quedan 850 g, el kg útil cuesta 19000 / 0,85.

   Plato (platos/<id>):
   { nombre, seccion, precio, ingredientes: [{ insumo: '<id>', cant }, { insumo: '', d, u, pu, cant }], nota }
     · Con insumo: toma el precio de la lista (si cambia el precio, cambia en todos los platos).
     · Sin insumo: ingrediente suelto con su propio precio.

   Configuración (config/general): foodCost = % ideal del precio que se va en ingredientes.
   ===================================================================== */
AMO.calc = AMO.calc || {};

AMO.calc.carta = (() => {
  const { parseNum: n, sum, ratio } = AMO.utils;

  const SECCIONES = ['Entradas', 'Principales', 'Pastas', 'Para compartir', 'Postres', 'Bebidas', 'Otros'];
  const OBJETIVO_DEFECTO = 30;
  const objetivo = cfg => (cfg && cfg.foodCost !== undefined && cfg.foodCost !== '' ? n(cfg.foodCost) : OBJETIVO_DEFECTO) / 100;

  const nuevoInsumo = () => ({ nombre: '', unidad: 'kg', precio: '', aprovechamiento: 100 });
  const nuevoPlato = () => ({ nombre: '', seccion: 'Principales', precio: '', ingredientes: [], nota: '' });

  /** Costo de una unidad útil del insumo (descuenta lo que se tira). */
  function costoUnidad(ins) {
    if (!ins) return 0;
    const ap = ins.aprovechamiento === '' || ins.aprovechamiento === undefined ? 100 : n(ins.aprovechamiento);
    return ap > 0 ? n(ins.precio) / (ap / 100) : 0;
  }

  /** Una línea de ingrediente: de dónde sale el precio y cuánto cuesta. */
  function linea(x, insumos) {
    const ins = x.insumo ? insumos.get(x.insumo) : null;
    const pu = ins ? costoUnidad(ins) : n(x.pu);
    const costo = n(x.cant) * pu;
    return {
      nombre: ins ? ins.nombre : (x.d || ''), unidad: ins ? ins.unidad : (x.u || ''), pu, costo,
      deLista: !!ins, perdido: !!x.insumo && !ins, sinPrecio: pu <= 0
    };
  }

  /** Estado del plato respecto del objetivo: bien, ajustado (hasta 5 puntos arriba) o caro. */
  function estado(fc, obj, tienePrecio) {
    if (!tienePrecio) return { k: 'sinprecio', l: 'Sin precio', tono: 'neutral' };
    if (fc <= obj) return { k: 'ok', l: 'Bien', tono: 'good' };
    if (fc <= obj + 0.05) return { k: 'justo', l: 'Ajustado', tono: 'warn' };
    return { k: 'caro', l: 'Revisar', tono: 'bad' };
  }

  function plato(p, insumos, cfg) {
    const obj = objetivo(cfg);
    const lineas = (p.ingredientes || []).map(x => linea(x, insumos));
    const costo = sum(lineas, l => l.costo);
    const precio = n(p.precio);
    const fc = ratio(costo, precio);
    return {
      lineas, costo, precio, fc, contribucion: precio - costo,
      sugerido: obj > 0 && costo > 0 ? Math.ceil(costo / obj / 100) * 100 : 0,
      estado: estado(fc, obj, precio > 0),
      incompletos: lineas.filter(l => l.sinPrecio || l.perdido).length, objetivo: obj
    };
  }

  /** Toda la carta. Mapa de insumos por id para buscar rápido. */
  function carta(platos, listaInsumos, cfg) {
    const insumos = new Map((listaInsumos || []).map(i => [i.id, i]));
    const filas = (platos || []).map(p => ({ p, c: plato(p, insumos, cfg) }))
      .sort((a, b) => SECCIONES.indexOf(a.p.seccion) - SECCIONES.indexOf(b.p.seccion) || String(a.p.nombre || '').localeCompare(String(b.p.nombre || '')));
    const conPrecio = filas.filter(f => f.c.precio > 0 && f.c.costo > 0);
    return {
      insumos, filas,
      promedio: conPrecio.length ? sum(conPrecio, f => f.c.fc) / conPrecio.length : 0,
      aRevisar: filas.filter(f => f.c.estado.k === 'caro').length,
      incompletos: filas.filter(f => f.c.incompletos > 0).length,
      objetivo: objetivo(cfg)
    };
  }

  /** En cuántos platos se usa un insumo (para avisar antes de borrarlo). */
  const usos = (insumoId, platos) => (platos || []).filter(p => (p.ingredientes || []).some(x => x.insumo === insumoId));

  return { SECCIONES, OBJETIVO_DEFECTO, objetivo, nuevoInsumo, nuevoPlato, costoUnidad, linea, estado, plato, carta, usos };
})();