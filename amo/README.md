# AMO Gestión

App de gestión para AMO: caja, gastos, personal, eventos, carta y vinoteca.
Se construye por secciones; cada una se termina y se prueba antes de pasar a la siguiente.

## Estructura

```
index.html              Página principal: carga estilos y scripts en orden
css/base.css            Paleta (claro/oscuro), tipografías, encabezado y menú
css/components.css      Tarjetas, botones, campos, tablas, chips, avisos
js/utils.js             Funciones puras: números en formato argentino, plata, fechas
js/store.js             Guardado: base compartida de Claude o, si no hay, el navegador
js/ui.js                Piezas de interfaz: íconos, avisos, campos, confirmación de borrado
js/app.js               Esqueleto: registra secciones, navegación y conexión campo ↔ dato
js/sections/plan.js     Plan de obra (y pantallas provisorias si se agrega algo nuevo)
js/calc/<x>.js          Cuentas de cada sección, sin pantalla (se prueban solas)
js/sections/<x>.js      Una sección terminada por archivo (se agregan de a una)
css/sections/<x>.css    Estilos propios de una sección
tests/run.js            Pruebas: node tests/run.js
```

## Cómo se agrega una sección

1. Crear `js/sections/<id>.js` con `AMO.app.define({ id, label, icon, order, collections, defaults, render, refresh, action })`.
2. Agregar su `<script>` en `index.html`, antes de `plan.js`.
3. Marcarla como `estado: 'lista'` en el plan.
4. Sumar sus pruebas en `tests/`.

## Datos

Todo se guarda como `colección/id` (por ejemplo `caja/2026-11-01`).
Un campo se conecta a un dato con `data-bind="colección|id|ruta"`; `app.js` lo guarda solo.
Los campos con `data-kind="money"` se muestran con puntos de miles y se guardan como número.

## Estado

| # | Sección | Estado |
|---|---------|--------|
| 1 | Base de la app | Lista |
| 2 | Caja diaria | Lista |
| 3 | Gastos y cuentas a pagar | Lista |
| 4 | Personal y sueldos | Lista |
| 5 | Eventos cerrados | Lista |
| 6 | Costo de la carta | Lista |
| 7 | Vinoteca | Lista |
| 8 | Resumen | Lista |
| 9 | Ajustes y ejemplos | Lista |