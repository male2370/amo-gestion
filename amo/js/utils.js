/* =====================================================================
   AMO Gestión · utils.js
   Funciones puras: números, plata, fechas y texto. No tocan la pantalla
   ni los datos guardados, así se pueden probar solas (tests/utils.test.js).
   ===================================================================== */
window.AMO = window.AMO || {};

AMO.utils = (() => {
  /* ---------- Números y plata ---------- */
  const nfMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const nfNumber = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
  const nfInt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

  /**
   * Convierte lo que escribe una persona en Argentina a número.
   * "1.250.000" → 1250000 · "1,5" → 1.5 · "0,35" / "0.35" → 0.35 · "$ 12.000" → 12000
   */
  function parseNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    let s = String(v ?? '').trim().replace(/[\s$]/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');           // 1.234,5
    else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // 1.234.567
    const x = parseFloat(s);
    return Number.isFinite(x) ? x : 0;
  }
  const money = n => nfMoney.format(Math.round(parseNum(n)));
  const number = n => nfNumber.format(parseNum(n));
  const integer = n => nfInt.format(Math.round(parseNum(n)));
  /** Para escribir en un campo: 1250000 → "1.250.000", 0.35 → "0,35", vacío → "" */
  const toField = n => (n === '' || n === null || n === undefined) ? '' : nfNumber.format(parseNum(n));
  function moneyShort(n) {
    const x = parseNum(n), a = Math.abs(x);
    if (a >= 1e6) return '$' + (x / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' M';
    if (a >= 1e3) return '$' + Math.round(x / 1e3) + ' mil';
    return '$' + Math.round(x);
  }
  const pct = (n, digits = 0) => Number.isFinite(n) ? (n * 100).toFixed(digits).replace('.', ',') + '%' : '–';
  const sum = (arr, f = x => x) => (arr || []).reduce((a, x) => a + parseNum(f(x)), 0);
  const ratio = (a, b) => (b ? a / b : 0);

  /* ---------- Fechas (siempre 'AAAA-MM-DD' y 'AAAA-MM', hora local) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => toISO(new Date());
  const ymOf = s => String(s).slice(0, 7);
  function parseDate(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
  const addDays = (s, k) => { const d = parseDate(s); d.setDate(d.getDate() + k); return toISO(d); };
  const addMonths = (ym, k) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const monthName = ym => cap(parseDate(ym + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));
  const monthOnly = ym => parseDate(ym + '-01').toLocaleDateString('es-AR', { month: 'long' });
  const monthShort = ym => cap(parseDate(ym + '-01').toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''));
  const longDate = s => s ? cap(parseDate(s).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })) : 'Sin fecha';
  const shortDate = s => s ? parseDate(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '') : '';
  const weekdayShort = s => cap(parseDate(s).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''));
  /** 0 = lunes … 6 = domingo (la semana del restaurante arranca el lunes) */
  const weekdayIndex = s => (parseDate(s).getDay() + 6) % 7;

  /* ---------- Texto y objetos ---------- */
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const getPath = (obj, path) => String(path).split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  function setPath(obj, path, val) {
    const ks = String(path).split('.'); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = val;
    return obj;
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  return {
    parseNum, money, number, integer, toField, moneyShort, pct, sum, ratio,
    pad, toISO, today, ymOf, parseDate, addDays, addMonths, daysInMonth, cap,
    monthName, monthOnly, monthShort, longDate, shortDate, weekdayShort, weekdayIndex,
    esc, uid, clone, getPath, setPath, debounce
  };
})();