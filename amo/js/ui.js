/* =====================================================================
   AMO Gestión · ui.js
   Piezas de interfaz que repiten todas las secciones: íconos, avisos,
   tarjetas de números, campos de plata y botones que piden confirmación.
   Devuelven HTML como texto; app.js se encarga de los clicks generales.
   ===================================================================== */
AMO.ui = (() => {
  const { esc, toField, parseNum, monthName } = AMO.utils;

  /* ---------- Íconos (trazo, 24×24) ---------- */
  const PATHS = {
    inicio: '<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10"/>',
    caja: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    gastos: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
    eventos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    personal: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>',
    carta: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 0-3 2.5-3 6s1.3 4 3 4v8"/>',
    vinoteca: '<path d="M8 3h8l-.4 5.5a3.6 3.6 0 0 1-7.2 0zM12 12v8M8.5 21h7"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    prev: '<path d="M15 18l-6-6 6-6"/>', next: '<path d="M9 18l6-6-6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5 10 17l9-10"/>', dot: '<circle cx="12" cy="12" r="4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'
  };
  const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;

  /* ---------- Aviso flotante ---------- */
  let toastTimer;
  function toast(msg, kind = '') {
    const el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.className = 'toast show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
  }

  /* ---------- Bloques ---------- */
  const kpi = ({ label, value, sub = '', hero = false, tone = '', out = '' }) =>
    `<div class="kpi${hero ? ' hero' : ''}"><div class="label">${esc(label)}</div><div class="v num ${tone}"${out ? ` data-out="${out}"` : ''}>${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
  const empty = (text, action = '') => `<div class="empty"><p>${text}</p>${action}</div>`;
  const monthNav = (ym, act = 'month') =>
    `<div class="month-nav"><button class="icon-btn" data-act="${act}-prev" aria-label="Mes anterior">${icon('prev', 20)}</button><h2>${monthName(ym)}</h2><button class="icon-btn" data-act="${act}-next" aria-label="Mes siguiente">${icon('next', 20)}</button></div>`;
  const chip = (text, tone = 'neutral') => `<span class="chip chip-${tone}">${esc(text)}</span>`;

  /* ---------- Campos ----------
     data-bind="col|id|ruta" conecta el campo con un documento guardado.
     data-kind="money" o "num" hace que se muestre con puntos de miles y se
     guarde como número. */
  function field({ label, bind, value = '', kind = 'text', placeholder = '', id, hint = '', attrs = '' }) {
    const fid = id || 'f-' + bind.replace(/[|.]/g, '-');
    return `<label class="field" for="${fid}"><span>${esc(label)}</span>${input({ bind, value, kind, placeholder, id: fid, attrs })}${hint ? `<small>${hint}</small>` : ''}</label>`;
  }
  function input({ bind, value = '', kind = 'text', placeholder = '', id, attrs = '', label = '' }) {
    const fid = id || 'f-' + bind.replace(/[|.]/g, '-');
    const ro = AMO.store.state.readOnly ? ' readonly' : '';
    const aria = label ? ` aria-label="${esc(label)}"` : '';
    if (kind === 'money' || kind === 'num') {
      return `<span class="${kind === 'money' ? 'money' : 'numwrap'}"><input id="${fid}" data-bind="${bind}" data-kind="${kind}" type="text" inputmode="decimal" autocomplete="off" value="${esc(toField(value))}" placeholder="${esc(placeholder || '0')}"${aria}${attrs ? ' ' + attrs : ''}${ro}></span>`;
    }
    if (kind === 'textarea') return `<textarea id="${fid}" data-bind="${bind}" placeholder="${esc(placeholder)}"${aria}${ro}>${esc(value)}</textarea>`;
    return `<input id="${fid}" data-bind="${bind}" type="${kind}" value="${esc(value)}" placeholder="${esc(placeholder)}"${aria}${attrs ? ' ' + attrs : ''}${ro}>`;
  }
  function select({ label, bind, value, options, id }) {
    const fid = id || 'f-' + bind.replace(/[|.]/g, '-');
    const dis = AMO.store.state.readOnly ? ' disabled' : '';
    const opts = options.map(o => typeof o === 'string' ? { v: o, l: o } : o).map(o => `<option value="${esc(o.v)}"${String(o.v) === String(value) ? ' selected' : ''}>${esc(o.l)}</option>`).join('');
    return `<label class="field" for="${fid}"><span>${esc(label)}</span><select id="${fid}" data-bind="${bind}"${dis}>${opts}</select></label>`;
  }
  /** Lee el valor de un campo según su tipo (plata/número → número). */
  function readInput(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.kind === 'money' || el.dataset.kind === 'num') return el.value.trim() === '' ? '' : parseNum(el.value);
    return el.value;
  }

  /* ---------- Botón de dos toques para borrar ---------- */
  const armed = new WeakMap();
  /** Devuelve true en el segundo toque (dentro de 3 s). */
  function confirmTap(btn, text = '¿Seguro? Tocá de nuevo') {
    if (armed.get(btn)) { armed.delete(btn); return true; }
    const old = btn.innerHTML; armed.set(btn, true); btn.textContent = text; btn.classList.add('armed');
    setTimeout(() => { if (armed.get(btn)) { armed.delete(btn); btn.innerHTML = old; btn.classList.remove('armed'); } }, 3000);
    return false;
  }

  return { icon, toast, kpi, empty, monthNav, chip, field, input, select, readInput, confirmTap };
})();