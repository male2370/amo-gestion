/* =====================================================================
   AMO Gestión · functions/api/[[path]].js
   Servidor de la app en Cloudflare Pages (Pages Functions + base D1).
   Cloudflare lo publica solo: todo pedido a /api/... llega acá.

   Necesita, en el proyecto de Cloudflare Pages:
     · Binding D1 con nombre de variable  DB
     · Variable secreta                    CLAVE  (la clave para entrar)

   Rutas:
     GET    /api/ping                 → { ok: true }  (sin clave: sirve para saber si hay servidor)
     GET    /api/datos?desde=<ms>     → todo lo que cambió desde ese momento (0 = todo)
     PUT    /api/doc/<col>/<id>       → guarda un documento (cuerpo: JSON)
     DELETE /api/doc/<col>/<id>       → lo borra
   Todas menos /ping piden el encabezado  X-Clave.

   Los borrados quedan marcados (no se eliminan de la tabla) para que los
   otros dispositivos se enteren en la próxima sincronización.
   ===================================================================== */

const SEGMENTO = /^[A-Za-z0-9_\-.:@+]{1,200}$/;
const MAX_BYTES = 256 * 1024;
let tablaLista = false;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

/** Compara la clave sin dar pistas por el tiempo de respuesta. */
function mismaClave(a, b) {
  const x = new TextEncoder().encode(String(a || '')), y = new TextEncoder().encode(String(b || ''));
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] || 0) ^ (y[i] || 0);
  return dif === 0 && y.length > 0;
}

async function prepararTabla(db) {
  if (tablaLista) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, body TEXT, borrado INTEGER NOT NULL DEFAULT 0, actualizado INTEGER NOT NULL, PRIMARY KEY (col, id))').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS docs_actualizado ON docs (actualizado)').run();
  tablaLista = true;
}

/** Hora del servidor en milisegundos, siempre creciente (dos cambios nunca tienen la misma). */
let ultimaHora = 0;
const ahora = () => (ultimaHora = Math.max(Date.now(), ultimaHora + 1));

export async function onRequest({ request, env, params }) {
  try {
    const partes = [].concat(params.path || []);
    const metodo = request.method;

    if (partes[0] === 'ping' && metodo === 'GET') return json({ ok: true, app: 'AMO Gestión' });

    if (!env.DB) return json({ error: 'Falta conectar la base de datos (binding DB).' }, 500);
    if (!env.CLAVE) return json({ error: 'Falta configurar la variable CLAVE.' }, 500);
    if (!mismaClave(request.headers.get('X-Clave'), env.CLAVE)) return json({ error: 'Clave incorrecta' }, 401);

    await prepararTabla(env.DB);

    if (partes[0] === 'datos' && metodo === 'GET') {
      const desde = Number(new URL(request.url).searchParams.get('desde')) || 0;
      const hora = ahora();
      const { results } = await env.DB.prepare('SELECT col, id, body, borrado, actualizado FROM docs WHERE actualizado > ?1 ORDER BY actualizado').bind(desde).all();
      return json({
        ahora: hora,
        docs: (results || []).map(r => ({ col: r.col, id: r.id, borrado: !!r.borrado, actualizado: r.actualizado, body: r.borrado ? null : JSON.parse(r.body) }))
      });
    }

    if (partes[0] === 'doc' && partes.length === 3) {
      const [, col, id] = partes;
      if (!SEGMENTO.test(col) || !SEGMENTO.test(id)) return json({ error: 'Nombre de dato inválido' }, 400);

      if (metodo === 'PUT') {
        const texto = await request.text();
        if (texto.length > MAX_BYTES) return json({ error: 'Dato demasiado grande' }, 413);
        let body;
        try { body = JSON.parse(texto); } catch (e) { return json({ error: 'No es JSON' }, 400); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Tiene que ser un objeto' }, 400);
        const hora = ahora();
        await env.DB.prepare('INSERT INTO docs (col, id, body, borrado, actualizado) VALUES (?1, ?2, ?3, 0, ?4) ON CONFLICT (col, id) DO UPDATE SET body = excluded.body, borrado = 0, actualizado = excluded.actualizado')
          .bind(col, id, JSON.stringify(body), hora).run();
        return json({ ok: true, actualizado: hora });
      }
      if (metodo === 'DELETE') {
        const hora = ahora();
        await env.DB.prepare('INSERT INTO docs (col, id, body, borrado, actualizado) VALUES (?1, ?2, NULL, 1, ?3) ON CONFLICT (col, id) DO UPDATE SET body = NULL, borrado = 1, actualizado = excluded.actualizado')
          .bind(col, id, hora).run();
        return json({ ok: true, actualizado: hora });
      }
    }

    return json({ error: 'No existe esa ruta' }, 404);
  } catch (err) {
    return json({ error: 'Error del servidor', detalle: String(err && err.message || err) }, 500);
  }
}