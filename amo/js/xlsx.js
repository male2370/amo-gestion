/* =====================================================================
   AMO Gestión · xlsx.js
   Arma archivos de Excel (.xlsx) de verdad, sin librerías ni internet.
   Un .xlsx es un .zip con unos XML adentro: acá se escriben esos XML
   y se empaquetan (zip sin comprimir, que Excel abre igual).

   Uso:
     const blob = AMO.xlsx.crear([
       { nombre: 'Resumen', anchos: [28, 16], filas: [
           [{ v: 'Ventas', s: 'b' }, { v: 1500000, s: '$' }],
           ['Fecha', { v: '2026-11-04', s: 'f' }]
       ] }
     ]);
     AMO.xlsx.descargar(blob, 'AMO noviembre 2026.xlsx');

   Estilos de celda (s): 'b' negrita · '$' plata · 'b$' plata en negrita
   · '%' porcentaje · 'f' fecha (se pasa 'AAAA-MM-DD') · 't' título.
   Una celda puede ser texto, número, null (vacía) u objeto { v, s }.
   ===================================================================== */
window.AMO = window.AMO || {};

AMO.xlsx = (() => {
  const ESTILOS = { '': 0, b: 1, $: 2, b$: 3, '%': 4, f: 5, t: 6 };

  const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = i => { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  const serialFecha = iso => { const [y, m, d] = String(iso).split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };

  function celda(c, ref) {
    if (c === null || c === undefined || c === '') return '';
    const o = typeof c === 'object' ? c : { v: c };
    const s = ESTILOS[o.s || ''] || 0, st = s ? ` s="${s}"` : '';
    if (o.v === null || o.v === undefined || o.v === '') return s ? `<c r="${ref}"${st}/>` : '';
    if (o.s === 'f' && /^\d{4}-\d{2}-\d{2}/.test(o.v)) return `<c r="${ref}"${st}><v>${serialFecha(o.v)}</v></c>`;
    if (typeof o.v === 'number' && Number.isFinite(o.v)) return `<c r="${ref}"${st}><v>${Math.round(o.v * 10000) / 10000}</v></c>`;
    return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xml(o.v)}</t></is></c>`;
  }

  function hoja(h) {
    const cols = (h.anchos || []).length
      ? `<cols>${h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    const filas = (h.filas || []).map((f, r) => `<row r="${r + 1}">${(f || []).map((c, i) => celda(c, col(i) + (r + 1))).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>${cols}<sheetData>${filas}</sheetData></worksheet>`;
  }

  const ESTILOS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0;-&quot;$&quot; #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF0F4A33"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  /* ---------- ZIP (sin comprimir) ---------- */
  const TABLA = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(archivos) {
    const enc = new TextEncoder(), partes = [], central = [];
    let pos = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const [nombre, texto] of archivos) {
      const n = enc.encode(nombre), d = enc.encode(texto), crc = crc32(d);
      const comun = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(n.length), ...u16(0)];
      const local = new Uint8Array([...u32(0x04034b50), ...comun]);
      partes.push(local, n, d);
      central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...comun, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), n);
      pos += local.length + n.length + d.length;
    }
    const tamCentral = central.reduce((a, b) => a + b.length, 0);
    const fin = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(archivos.length), ...u16(archivos.length), ...u32(tamCentral), ...u32(pos), ...u16(0)]);
    const total = new Uint8Array(pos + tamCentral + fin.length);
    let o = 0;
    for (const p of [...partes, ...central, fin]) { total.set(p, o); o += p.length; }
    return total;
  }

  /** Devuelve los bytes del .xlsx (Uint8Array). */
  function bytes(hojas) {
    const nombres = [];
    const limpio = s => { let x = String(s || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Hoja'; let k = 2, b = x; while (nombres.includes(x)) x = (b.slice(0, 28) + ' ' + k++); nombres.push(x); return x; };
    hojas.forEach(h => limpio(h.nombre));
    const archivos = [
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nombres.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', ESTILOS_XML],
      ...hojas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, hoja(h)])
    ];
    return zip(archivos);
  }

  const crear = hojas => new Blob([bytes(hojas)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return { bytes, crear, descargar };
})();