/* =====================================================================
   AMO Gestión · sections/vinoteca.js
   Sección 7: Vinoteca.
   - Registrar lo que pasa: venta, consumo del salón, compra, rotura.
   - Stock de cada vino (calculado), margen, y cuánto alcanza según lo que sale.
   - Para reponer: pedido sugerido por bodega, listo para copiar.
   - Ficha de cada vino, con ajuste por conteo físico.
   - Números del mes y los que más salen.
   Las cuentas están en calc/vinoteca.js.
   ===================================================================== */
(() => {
  const U = AMO.utils, V = AMO.calc.vinoteca, store = AMO.store, app = AMO.app;
  const { esc, money, pct, today, ymOf, addMonths, shortDate, parseNum, toField, uid, monthOnly, integer } = U;
  const { icon, kpi, empty, chip, field, toast, confirmTap } = AMO.ui;

  const S = { ym: ymOf(today()), abierto: null, q: '', filtro: '', mov: { vino: '', tipo: 'venta', cant: 1, fecha: today() }, conteo: '' };
  const ro = () => store.state.readOnly;
  const vinos = () => store.list('vinos');
  const movs = () => store.list('vinoMov');
  const etiqueta = v => [v.bodega, v.nombre, v.anio].filter(Boolean).join(' · ') || 'Sin nombre';
  const alcanzaTxt = a => (a === null ? '–' : a > 90 ? 'más de 90 días' : `${a} ${a === 1 ? 'día' : 'días'}`);

  /* ---------- Registrar ---------- */
  function registrar(cat) {
    if (ro() || !cat.filas.length) return '';
    const f = S.mov, sel = cat.filas.find(x => x.v.id === f.vino);
    return `
    <section class="card">
      <div class="card-title"><h3>Registrar</h3></div>
      <div class="fields v-mov">
        <label class="field v-mov-vino" for="vm-vino"><span>Vino</span><select id="vm-vino" data-vf="vino"><option value="">Elegí un vino…</option>${cat.filas.map(x => `<option value="${x.v.id}"${f.vino === x.v.id ? ' selected' : ''}>${esc(etiqueta(x.v))} (${integer(x.stock)})</option>`).join('')}</select></label>
        <label class="field" for="vm-tipo"><span>Qué pasó</span><select id="vm-tipo" data-vf="tipo">${V.TIPOS.filter(t => t.k !== 'conteo').map(t => `<option value="${t.k}"${f.tipo === t.k ? ' selected' : ''}>${t.l}</option>`).join('')}</select></label>
        <label class="field" for="vm-cant"><span>Botellas</span><span class="numwrap"><input id="vm-cant" data-vf="cant" type="text" inputmode="numeric" value="${esc(f.cant)}"></span></label>
        <label class="field" for="vm-fecha"><span>Fecha</span><input id="vm-fecha" type="date" data-vf="fecha" value="${esc(f.fecha)}"></label>
        <div class="field v-mov-btn"><span>&nbsp;</span><button class="btn primary" data-act="registrar">${icon('check', 16)} Registrar</button></div>
      </div>
      <p class="muted small" data-out="vm-hint">${sel ? `Hay ${integer(sel.stock)} · ${f.tipo === 'compra' ? `costo ${money(sel.costo)}` : `precio ${money(sel.precio)}`}` : 'El stock se actualiza solo.'}</p>
    </section>`;
  }

  /* ---------- Reponer ---------- */
  function reponer(cat) {
    if (!cat.pedidos.length) return '';
    return `
    <section class="card">
      <div class="card-title"><h3>Para reponer</h3><span class="total num">${integer(U.sum(cat.pedidos, p => p.botellas))} botellas · ${money(U.sum(cat.pedidos, p => p.costo))}</span></div>
      <div class="v-pedidos">${cat.pedidos.map((p, i) => `
        <div class="v-pedido">
          <div class="row"><b>${esc(p.bodega)}</b><span class="muted small num">${integer(p.botellas)} botellas · ${money(p.costo)}</span><span class="spacer"></span><button class="btn small" data-act="copiar-pedido" data-i="${i}">Copiar pedido</button></div>
          <ul>${p.items.map(f => `<li><span>${esc(f.v.nombre || 'Sin nombre')}${f.v.anio ? ` ${esc(f.v.anio)}` : ''}</span>${chip(f.estado.k === 'sin' ? 'Sin stock' : `Quedan ${integer(f.stock)}`, f.estado.tono)}<span class="num muted">pedir ${integer(f.pedir)}</span></li>`).join('')}</ul>
        </div>`).join('')}</div>
      <p class="muted small" style="margin-top:8px">Sugiere pedir hasta tener el doble del mínimo de cada vino.</p>
    </section>`;
  }

  /* ---------- Ficha ---------- */
  function ficha(cat) {
    const f = cat.filas.find(x => x.v.id === S.abierto); if (!f) return '';
    const v = f.v, b = k => `vinos|${v.id}|${k}`, nuevo = !movs().some(m => m.vino === v.id);
    return `
    <section class="card k-editor" id="v-ficha">
      <input class="ev-title" id="v-nombre" data-bind="${b('nombre')}" value="${esc(v.nombre)}" placeholder="Nombre del vino (ej. Gran Reserva Malbec)" aria-label="Nombre del vino"${ro() ? ' readonly' : ''}>
      <div class="fields">
        ${field({ label: 'Bodega', bind: b('bodega'), value: v.bodega, placeholder: 'Bodega', id: 'v-bodega', attrs: 'list="v-bodegas"' })}
        ${field({ label: 'Varietal', bind: b('varietal'), value: v.varietal, placeholder: 'Malbec, blend…', id: 'v-varietal', attrs: 'list="v-varietales"' })}
        ${field({ label: 'Año', bind: b('anio'), value: v.anio, placeholder: '2022', id: 'v-anio' })}
        ${field({ label: 'Costo por botella', bind: b('costo'), value: v.costo, kind: 'money', id: 'v-costo' })}
        ${field({ label: 'Precio de venta', bind: b('precio'), value: v.precio, kind: 'money', id: 'v-precio' })}
        ${field({ label: 'Avisar cuando queden', bind: b('minimo'), value: v.minimo, kind: 'num', id: 'v-min', hint: 'botellas' })}
        ${field({ label: 'Ubicación', bind: b('ubicacion'), value: v.ubicacion, placeholder: 'Estante, cava, depósito', id: 'v-ubi' })}
        ${nuevo ? field({ label: 'Botellas que hay hoy', bind: b('stockInicial'), value: v.stockInicial, kind: 'num', id: 'v-ini', hint: 'Después se mueve solo con lo que registres.' }) : ''}
      </div>
      <div class="v-ficha-nums num">
        <div><span class="muted small">Stock</span><b data-out="vf-stock"></b></div>
        <div><span class="muted small">Gana por botella</span><b data-out="vf-gan"></b></div>
        <div><span class="muted small">Alcanza</span><b data-out="vf-alc"></b></div>
      </div>
      ${nuevo || ro() ? '' : `
      <div class="v-conteo">
        <label class="field" for="v-contado"><span>¿Contaste y hay otra cantidad?</span><span class="numwrap"><input id="v-contado" data-vc="1" type="text" inputmode="numeric" value="${esc(S.conteo)}" placeholder="Botellas contadas"></span></label>
        <button class="btn" data-act="conteo">Ajustar stock</button>
      </div>`}
      <div class="row" style="margin-top:12px">
        ${ro() ? '' : `<button class="btn small danger" data-act="borrar-vino">Borrar vino</button>`}
        <span class="spacer"></span><button class="btn small primary" data-act="cerrar">Listo</button>
      </div>
    </section>`;
  }

  /* ---------- Tabla de stock ---------- */
  function tabla(cat) {
    const q = S.q.trim().toLowerCase();
    const filas = cat.filas.filter(f => (!S.filtro || (S.filtro === 'reponer' ? f.estado.k !== 'ok' : f.v.varietal === S.filtro)) && (!q || [f.v.nombre, f.v.bodega, f.v.varietal, f.v.anio, f.v.ubicacion].join(' ').toLowerCase().includes(q)));
    if (!cat.filas.length) return empty('Cargá los vinos con su costo, precio y cuántas botellas hay, y llevá el control de lo que entra y sale.');
    if (!filas.length) return empty('Ningún vino coincide.');
    return `<div class="table-wrap"><table class="num v-tabla">
      <thead><tr><th>Vino</th><th class="r">Stock</th><th class="r hide-s">Alcanza</th><th class="r hide-s">Costo</th><th class="r">Precio</th><th class="r">Margen</th></tr></thead>
      <tbody>${filas.map(f => `
        <tr class="click${f.v.id === S.abierto ? ' sel' : ''}" data-act="abrir" data-id="${f.v.id}">
          <td><b>${esc(f.v.nombre || 'Sin nombre')}</b> ${f.estado.k !== 'ok' ? chip(f.estado.l, f.estado.tono) : ''}<div class="muted small">${esc([f.v.bodega, f.v.varietal, f.v.anio].filter(Boolean).join(' · '))}</div></td>
          <td class="r"><b>${integer(f.stock)}</b></td>
          <td class="r hide-s muted">${alcanzaTxt(f.alcanza).replace('más de ', '+')}</td>
          <td class="r hide-s">${money(f.costo)}</td><td class="r">${money(f.precio)}</td>
          <td class="r">${f.precio ? pct(f.margen) : '–'}</td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- Mes ---------- */
  function mes() {
    const m = V.mes(movs(), vinos(), S.ym), nombres = new Map(vinos().map(v => [v.id, v]));
    return `
    <section class="month-block">
      ${AMO.ui.monthNav(S.ym)}
      <div class="kpis">
        ${kpi({ label: 'Vendidas', value: integer(m.vendidas), sub: 'botellas en la vinoteca' })}
        ${kpi({ label: 'Facturado', value: money(m.facturado) })}
        ${kpi({ label: 'Ganancia de esas ventas', value: money(m.ganancia), hero: true, sub: m.facturado ? `Margen ${pct(m.ganancia / m.facturado)}` : '' })}
        ${kpi({ label: 'Consumo del salón', value: integer(m.salon), sub: m.salon ? `${money(m.salonCosto)} al costo` : 'botellas' })}
      </div>
      <div class="grid-wide">
        <section class="card"><div class="card-title"><h3>Movimientos</h3>${m.compradas ? `<span class="total num muted">Compras: ${integer(m.compradas)} · ${money(m.comprasCosto)}</span>` : ''}</div>
          ${m.movs.length ? `<div class="table-wrap"><table class="num"><tbody>${m.movs.map(x => {
            const t = V.tipo(x.tipo), d = V.efecto(x), v = nombres.get(x.vino);
            return `<tr><td class="g-dia">${shortDate(x.fecha)}</td><td>${esc(v ? etiqueta(v) : 'Vino borrado')}<div class="muted small">${t.l}</div></td>
              <td class="r"><b class="${d > 0 ? 'pos' : ''}">${d > 0 ? '+' : '−'}${integer(Math.abs(d))}</b></td>
              <td class="r">${ro() ? '' : `<button class="icon-btn x" data-act="borrar-mov" data-id="${x.id}" aria-label="Borrar movimiento">${icon('close', 15)}</button>`}</td></tr>`;
          }).join('')}</tbody></table></div>` : empty(`No hay movimientos en ${monthOnly(S.ym)}.`)}
        </section>
        <section class="card"><div class="card-title"><h3>Los que más salen</h3></div>
          ${m.top.length ? `<ol class="v-top">${m.top.map(t => `<li><span>${esc(etiqueta(t.vino))}</span><b class="num">${integer(t.cant)}</b></li>`).join('')}</ol>` : '<p class="muted small">Sin ventas registradas.</p>'}
        </section>
      </div>
    </section>`;
  }

  /* ---------- Sección ---------- */
  app.define({
    id: 'vinoteca', label: 'Vinoteca', icon: 'vinoteca', order: 70,
    collections: ['vinos', 'vinoMov'],
    defaults: { vinos: () => V.nuevoVino() },

    render() {
      const cat = V.catalogo(vinos(), movs(), today());
      const varietales = [...new Set(cat.filas.map(f => f.v.varietal).filter(Boolean))];
      return `
      <section class="page-head"><h2>Vinoteca</h2><span class="spacer"></span>${ro() ? '' : `<button class="btn primary" data-act="nuevo">${icon('plus', 16)} Vino</button>`}</section>
      <section class="kpis">
        ${kpi({ label: 'Botellas en stock', value: integer(cat.botellas), sub: `${cat.etiquetas} etiquetas` })}
        ${kpi({ label: 'Stock al costo', value: money(cat.valorCosto), sub: 'Plata parada en vinos', hero: true })}
        ${kpi({ label: 'Stock a precio de venta', value: money(cat.valorVenta), sub: `Ganancia posible ${money(cat.valorVenta - cat.valorCosto)}` })}
        ${kpi({ label: 'Para reponer', value: integer(cat.reponer.length), sub: 'en el mínimo o sin stock', tone: cat.reponer.length ? 'neg' : '' })}
      </section>
      ${registrar(cat)}
      ${S.abierto ? ficha(cat) : ''}
      <div class="grid-wide">
        <section class="card">
          <div class="g-filtros">
            <div class="chips-row">${[{ k: '', l: 'Todos' }, { k: 'reponer', l: 'Para reponer' }].concat(varietales.map(x => ({ k: x, l: x }))).map(c => `<button class="fchip" data-act="filtro" data-f="${esc(c.k)}" aria-pressed="${S.filtro === c.k}">${esc(c.l)}</button>`).join('')}</div>
            <input type="search" id="v-q" value="${esc(S.q)}" placeholder="Buscar vino o bodega" aria-label="Buscar vino">
          </div>
          <div id="v-lista">${tabla(cat)}</div>
        </section>
        ${reponer(cat) || `<section class="card"><div class="card-title"><h3>Para reponer</h3></div><p class="muted small">${cat.filas.length ? 'Todo en orden: ningún vino está en el mínimo.' : 'Aparece cuando haya vinos cargados.'}</p></section>`}
      </div>
      ${mes()}
      <datalist id="v-bodegas">${[...new Set(vinos().map(v => v.bodega).filter(Boolean))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <datalist id="v-varietales">${['Malbec', 'Cabernet Sauvignon', 'Cabernet Franc', 'Merlot', 'Pinot Noir', 'Syrah', 'Bonarda', 'Blend', 'Chardonnay', 'Sauvignon Blanc', 'Torrontés', 'Rosado', 'Espumante'].map(x => `<option value="${x}">`).join('')}</datalist>`;
    },

    refresh() {
      if (!S.abierto) return;
      const f = V.catalogo(vinos(), movs(), today()).filas.find(x => x.v.id === S.abierto); if (!f) return;
      const out = (k, v) => document.querySelectorAll(`#main [data-out="${k}"]`).forEach(el => { el.innerHTML = v; });
      out('vf-stock', `${integer(f.stock)} ${chip(f.estado.l, f.estado.tono)}`);
      out('vf-gan', f.precio ? `${money(f.ganancia)} <small class="muted">(${pct(f.margen)})</small>` : '–');
      out('vf-alc', f.alcanza === null ? '<small class="muted">sin ventas en 30 días</small>' : alcanzaTxt(f.alcanza));
      const box = document.getElementById('v-lista'); if (box) box.innerHTML = tabla(V.catalogo(vinos(), movs(), today()));
    },

    input(el) {
      if (el.id === 'v-q') { S.q = el.value; const box = document.getElementById('v-lista'); if (box) box.innerHTML = tabla(V.catalogo(vinos(), movs(), today())); return; }
      if (el.dataset.vc) { S.conteo = el.value; return; }
      const k = el.dataset.vf; if (!k) return;
      S.mov[k] = el.value;
      if (k === 'vino' || k === 'tipo') {
        const sel = V.catalogo(vinos(), movs(), today()).filas.find(x => x.v.id === S.mov.vino);
        const h = document.querySelector('[data-out="vm-hint"]');
        if (h) h.textContent = sel ? `Hay ${integer(sel.stock)} · ${S.mov.tipo === 'compra' ? `costo ${money(sel.costo)}` : `precio ${money(sel.precio)}`}` : 'El stock se actualiza solo.';
      }
    },

    action(act, el) {
      if (act === 'month-prev' || act === 'month-next') { S.ym = addMonths(S.ym, act === 'month-prev' ? -1 : 1); return app.render(); }
      if (act === 'filtro') { S.filtro = el.dataset.f; return app.render(); }
      if (act === 'abrir') { S.abierto = el.dataset.id; S.conteo = ''; if (!ro()) S.mov.vino = el.dataset.id; app.render(); const e = document.getElementById('v-ficha'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (act === 'cerrar') { store.flushAll(); S.abierto = null; return app.render(); }
      if (act === 'copiar-pedido') {
        const p = V.catalogo(vinos(), movs(), today()).pedidos[+el.dataset.i]; if (!p) return;
        (navigator.clipboard ? navigator.clipboard.writeText(V.pedidoTexto(p)) : Promise.reject()).then(() => toast(`Pedido para ${p.bodega} copiado`), () => toast('Este dispositivo no deja copiar', 'bad'));
        return;
      }
      if (ro()) return;
      if (act === 'nuevo') {
        const id = uid(); store.save('vinos', id, Object.assign(V.nuevoVino(), { creado: new Date().toISOString() }), { delay: 0 });
        S.abierto = id; S.q = ''; S.filtro = ''; app.render(); return app.focus('#v-nombre');
      }
      if (act === 'registrar') {
        const f = S.mov, v = store.get('vinos', f.vino), cant = Math.round(parseNum(f.cant));
        if (!v) { toast('Elegí un vino', 'bad'); return app.focus('#vm-vino'); }
        if (!(cant > 0)) { toast('Poné cuántas botellas', 'bad'); return app.focus('#vm-cant'); }
        const fecha = f.fecha || today();
        store.save('vinoMov', uid(), { fecha, vino: f.vino, tipo: f.tipo, cant, precio: parseNum(v.precio), costo: parseNum(v.costo), creado: new Date().toISOString() }, { delay: 0 });
        const st = V.stock(Object.assign(v, { id: f.vino }), movs());
        S.mov = Object.assign({}, f, { cant: 1 }); if (ymOf(fecha) !== S.ym) S.ym = ymOf(fecha);
        app.render(); return toast(`${V.tipo(f.tipo).l}: ${cant} ${cant === 1 ? 'botella' : 'botellas'}. Quedan ${integer(st)}.`);
      }
      if (act === 'conteo') {
        const v = store.get('vinos', S.abierto); if (!v || S.conteo.trim() === '') { toast('Poné cuántas botellas contaste', 'bad'); return app.focus('#v-contado'); }
        const actual = V.stock(Object.assign(v, { id: S.abierto }), movs()), dif = V.ajusteConteo(actual, S.conteo);
        if (!dif) { S.conteo = ''; app.render(); return toast('El stock ya coincide'); }
        store.save('vinoMov', uid(), { fecha: today(), vino: S.abierto, tipo: 'conteo', cant: dif, precio: parseNum(v.precio), costo: parseNum(v.costo), creado: new Date().toISOString() }, { delay: 0 });
        S.conteo = ''; app.render(); return toast(`Stock ajustado: ${dif > 0 ? 'sobraban' : 'faltaban'} ${integer(Math.abs(dif))}`);
      }
      if (act === 'borrar-mov') { if (!confirmTap(el, '¿Borrar?')) return; store.remove('vinoMov', el.dataset.id); app.render(); return toast('Movimiento borrado: el stock se corrigió solo'); }
      if (act === 'borrar-vino') {
        if (!confirmTap(el)) return;
        store.remove('vinos', S.abierto); S.abierto = null; app.render(); return toast('Vino borrado');
      }
    }
  });
})();