/* =====================================================================
   AMO Gestión · sections/plan.js
   Plan de obra: qué hace cada sección y en qué estado está.
   Mientras una sección no está terminada, su pantalla muestra lo que va
   a tener. Cuando se termina, su archivo propio la reemplaza.
   ===================================================================== */
AMO.PLAN = [
  { n: 1, id: 'base', label: 'Base de la app', estado: 'lista',
    hace: ['Estructura en archivos separados por sección', 'Diseño en verde esmeralda, claro y oscuro, celular y compu', 'Navegación entre secciones', 'Guardado automático y compartido, con respaldo local', 'Campos de plata con puntos de miles'] },
  { n: 2, id: 'caja', short: 'Caja', label: 'Caja diaria', icon: 'caja', order: 20, estado: 'lista',
    hace: ['Cada día por servicio, según los días que abre AMO', 'Cubiertos y cobros por medio de pago', 'Vinoteca, propinas y arqueo del efectivo', 'Tabla del mes, medios de pago y promedio por día de la semana'] },
  { n: 3, id: 'gastos', short: 'Gastos', label: 'Gastos y cuentas a pagar', icon: 'gastos', order: 30, estado: 'lista',
    hace: ['Cada factura con proveedor, categoría y medio de pago', 'Cuentas a pagar ordenadas por vencimiento', 'Gastos fijos que se traen del mes anterior', 'Totales por categoría y por proveedor'] },
  { n: 4, id: 'personal', short: 'Personal', label: 'Personal y sueldos', icon: 'personal', order: 50, estado: 'lista',
    hace: ['Equipo con sueldo mensual, por hora o por turno, con alta y baja', 'Horas, extras, descuentos y adelantos con fecha', 'Cargas sociales y aguinaldo separado cada mes', 'Costo del personal del mes y por puesto'] },
  { n: 5, id: 'eventos', short: 'Eventos', label: 'Eventos cerrados', icon: 'eventos', order: 40, estado: 'lista',
    hace: ['Agenda con calendario y estados', 'Seña y pagos con lo que falta cobrar', 'Mercadería por cantidad o por invitado, personal y otros gastos', 'Ganancia, margen y precio sugerido por persona', 'Plan de la noche, menú y presupuesto para WhatsApp'] },
  { n: 6, id: 'carta', short: 'Carta', label: 'Costo de la carta', icon: 'carta', order: 60, estado: 'lista',
    hace: ['Lista de insumos con precio y % útil: se actualiza una vez para todos los platos', 'Ingredientes por plato y costo por porción', '% de mercadería sobre el precio y precio sugerido', 'Platos a revisar e incompletos'] },
  { n: 7, id: 'vinoteca', short: 'Vinoteca', label: 'Vinoteca', icon: 'vinoteca', order: 70, estado: 'lista',
    hace: ['Catálogo con costo, precio y margen', 'Stock calculado con ventas, salón, compras, roturas y conteos', 'Pedido sugerido por bodega y cuánto alcanza cada vino', 'Valor del stock, números del mes y los que más salen'] },
  { n: 8, id: 'inicio', short: 'Resumen', label: 'Resumen', icon: 'inicio', order: 10, estado: 'lista',
    hace: ['Avisos de lo urgente: vencidos, cajas sin controlar, sueldos, vinos', 'Estado de resultados del mes y comparación con el anterior', 'Punto de equilibrio en plata y cubiertos', 'Historial de 6 meses, próximos eventos y vinoteca'] },
  { n: 9, id: 'ajustes', short: 'Ajustes', label: 'Ajustes y ejemplos', icon: 'ajustes', order: 90, estado: 'lista',
    hace: ['Todos los porcentajes y opciones de los cálculos en un lugar', 'Datos de ejemplo para mostrar la app, que se borran sin tocar lo real', 'Respaldo: copiar todos los datos y restaurarlos'] }
];

(() => {
  const { esc } = AMO.utils;
  const { icon, chip } = AMO.ui;
  const done = AMO.PLAN.filter(p => p.estado === 'lista').length;

  const card = p => `
    <article class="plan-card${p.estado === 'lista' ? ' is-done' : ''}">
      <div class="plan-n">${p.estado === 'lista' ? icon('check', 16) : p.n}</div>
      <div>
        <div class="row"><h3>${esc(p.label)}</h3>${p.estado === 'lista' ? chip('Lista', 'good') : chip('Pendiente', 'neutral')}</div>
        <ul>${p.hace.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
      </div>
    </article>`;

  /* Pantallas provisorias: cada una se reemplaza por su archivo cuando se construye.
     Si la sección ya está definida (archivo cargado), no se pisa. */
  AMO.PLAN.filter(p => p.id !== 'base').forEach(p => {
    if (AMO.app.sections.has(p.id)) return;
    AMO.app.define({
      id: p.id, label: p.short,
      icon: p.icon, order: p.order, building: true, nav: p.id !== 'ajustes',
      render() {
        const intro = p.id === 'inicio' ? paginaPlan() : `
          <section class="page-head"><h2>${esc(p.label)}</h2>${chip('En construcción', 'warn')}</section>
          <section class="card building">
            <p class="eyebrow">Sección ${p.n} de ${AMO.PLAN.length}</p>
            <p class="lead">Esta sección todavía no está construida. Va a tener:</p>
            <ul class="checklist">${p.hace.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
            <button class="btn" data-nav="plan">Ver el plan completo</button>
          </section>`;
        return intro;
      }
    });
  });

  function paginaPlan() {
    return `
          <section class="hero-plan">
            <p class="eyebrow">Plan de obra · ${done} de ${AMO.PLAN.length} secciones</p>
            <h1>AMO Gestión</h1>
            <p class="lead">La app se arma por secciones. Cada una se termina, se prueba y se perfecciona antes de pasar a la siguiente.</p>
            <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${AMO.PLAN.length}" aria-valuenow="${done}"><i style="width:${(done / AMO.PLAN.length * 100).toFixed(1)}%"></i></div>
          </section>
          <section class="plan-grid">${AMO.PLAN.map(card).join('')}</section>`;
  }

  // Página del plan, siempre disponible (fuera del menú).
  AMO.app.define({ id: 'plan', label: 'Plan de obra', icon: 'inicio', order: 99, nav: false, render: paginaPlan });
})();