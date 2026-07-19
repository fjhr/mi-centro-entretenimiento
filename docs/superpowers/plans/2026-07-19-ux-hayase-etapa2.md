# Plan de Implementación: UX estilo Hayase (Etapa 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir continuar-viendo, progreso/visto por archivo, biblioteca personal, historial y una pantalla de Inicio estilo Netflix/Hayase a "Mi Centro de Entretenimiento", con un refresco visual del sistema de diseño compartido.

**Architecture:** Un único store `server/data/biblioteca.json` (vía `lib/almacen.js` ya existente) es la fuente de verdad; "Continuar viendo" e "Historial" son selectores puros calculados sobre él, no colecciones separadas. El servidor expone `server/lib/biblioteca.js` (lógica pura testeable) tras `server/routes/biblioteca.js`. En el cliente, `Reproductor.jsx` se vuelve autosuficiente: dado un `fuente.origen`, reanuda posición, guarda cada 10s y expone marcar-visto, sin que los módulos que lo usan necesiten saber nada de persistencia. Un nuevo módulo `Inicio.jsx` consume las tres listas del servidor en filas horizontales.

**Tech Stack:** Node ≥18 ESM, Express 4, Vitest, Supertest, React 18.

## Global Constraints

- **Todo en español:** UI, mensajes de error del servidor, comentarios de cara al usuario.
- **Un único store de biblioteca** (`server/data/biblioteca.json`, vía `leerJson('biblioteca', {})`/`guardarJson('biblioteca', datos)`); "Continuar viendo"/"Historial" son selectores puros, no persistencia separada.
- **Clave del registro:** el `origen` normalizado (recortado; sin cambios de mayúsculas), igual que en la Etapa 1.
- **Progreso por archivo:** cada `indice` dentro de un origen tiene su propia posición/estado `visto`. Para fuentes `tipo:'directo'` (un solo archivo), `indice` es siempre `0`.
- **Umbral "visto" automático:** `posicionSeg / duracionSeg >= 0.9`. Un override manual del usuario no se revierte solo por una actualización de progreso posterior por debajo del umbral.
- **Guardado de progreso:** cada 10s durante reproducción, más en pausa, cierre del reproductor y `beforeunload` (best-effort, sin bloquear el cierre).
- **`limpiarHistorial`:** elimina por completo del store las entradas con `guardado:false`; conserva intactas (con su progreso) las entradas con `guardado:true`.
- **Express 4**, rutas nuevas montadas en `crearApp()` antes de los estáticos y el handler 404.
- **Resume a posición fuera de rango** (mayor que la duración real del video): se ignora, reproduce desde el inicio.
- **Commits frecuentes**, formato `feat:`/`test:`/`docs:`/`chore:`.

## Estructura de archivos

Nuevos:
- `server/lib/biblioteca.js` — lógica pura (actualizar progreso, alternar guardado/visto, limpiar historial, tres selectores).
- `server/routes/biblioteca.js` — endpoints REST.
- `server/test/biblioteca.test.js`, `server/test/rutas-biblioteca.test.js`.
- `client/src/lib/biblioteca.js` — helpers HTTP del cliente.
- `client/src/modules/inicio/Inicio.jsx` — hero + filas horizontales.

Modificados:
- `server/index.js` — montar `/api/biblioteca`.
- `client/src/lib/reproductor.js` — añadir `resolverIA`, `resolverTorrentOrigen`, `pareceIdentificadorIA` (factoriza lógica ya duplicada entre los dos flujos de Reproducir).
- `client/src/components/Reproductor.jsx` — auto-resume, autoguardado, botón "visto".
- `client/src/modules/reproducir/Reproducir.jsx` — usa los nuevos resolvers; adjunta `origen/titulo/poster` a la fuente; botón "Guardar" en resultados.
- `client/src/App.jsx` — sección "🏠 Inicio" primera, vista inicial.
- `client/src/styles.css` — variables nuevas, `.tarjeta-progreso`, `.fila-carrusel`, `.hero`, refinamiento de `.tarjeta`/`.boton`/`.chip`.
- `README.md`, `CLAUDE.md` — documentar el módulo.

---

### Task 1: Lógica pura de biblioteca (`server/lib/biblioteca.js`)

**Files:**
- Create: `server/lib/biblioteca.js`
- Test: `server/test/biblioteca.test.js`

**Interfaces:**
- Produces:
  - `actualizarProgreso(datos, { origen, indice, posicionSeg, duracionSeg, titulo?, poster? }) => { datos: nuevoDatos, visto: boolean }` — `visto` es `true` solo si ESTA llamada cruza el umbral del 90% (antes `false`, ahora `true`); si ya estaba visto o sigue sin estarlo, es `false`.
  - `alternarGuardado(datos, origen, guardado, meta?: { titulo?, poster? }) => nuevoDatos` — crea la entrada si no existe.
  - `alternarVisto(datos, origen, indice, visto) => nuevoDatos` — no-op (devuelve `datos` sin cambios) si el origen nunca tuvo progreso.
  - `limpiarHistorial(datos) => nuevoDatos` — elimina las entradas con `guardado:false`; conserva intactas las `guardado:true`.
  - `continuarViendo(datos) => Array<{origen, titulo, poster, guardado, primeraVez, ultimaVez, archivos}>` — orígenes con algún archivo `0 < posicionSeg/duracionSeg < 0.9`, orden `ultimaVez` descendente.
  - `guardados(datos) => Array<...>` — orígenes con `guardado:true`, orden `ultimaVez` descendente.
  - `historial(datos) => Array<...>` — orígenes con algún archivo `posicionSeg > 0`, orden `ultimaVez` descendente.

- [ ] **Step 1: Escribir el test que falla — `server/test/biblioteca.test.js`**

```js
import { describe, it, expect } from 'vitest';
import {
  actualizarProgreso, alternarGuardado, alternarVisto, limpiarHistorial,
  continuarViendo, guardados, historial,
} from '../lib/biblioteca.js';

describe('actualizarProgreso', () => {
  it('crea una entrada nueva con el archivo indicado', () => {
    const { datos, visto } = actualizarProgreso({}, { origen: 'peli1', indice: 0, posicionSeg: 30, duracionSeg: 600, titulo: 'Peli', poster: 'p.jpg' });
    expect(datos.peli1.titulo).toBe('Peli');
    expect(datos.peli1.poster).toBe('p.jpg');
    expect(datos.peli1.guardado).toBe(false);
    expect(datos.peli1.archivos[0]).toMatchObject({ posicionSeg: 30, duracionSeg: 600, visto: false });
    expect(visto).toBe(false);
  });

  it('marca visto automáticamente al cruzar el 90% y lo informa', () => {
    let r = actualizarProgreso({}, { origen: 'p', indice: 0, posicionSeg: 100, duracionSeg: 600 });
    expect(r.visto).toBe(false);
    r = actualizarProgreso(r.datos, { origen: 'p', indice: 0, posicionSeg: 550, duracionSeg: 600 });
    expect(r.datos.p.archivos[0].visto).toBe(true);
    expect(r.visto).toBe(true);
  });

  it('no vuelve a informar visto:true si ya estaba visto', () => {
    let r = actualizarProgreso({}, { origen: 'p', indice: 0, posicionSeg: 590, duracionSeg: 600 });
    expect(r.visto).toBe(true);
    r = actualizarProgreso(r.datos, { origen: 'p', indice: 0, posicionSeg: 595, duracionSeg: 600 });
    expect(r.visto).toBe(false);
    expect(r.datos.p.archivos[0].visto).toBe(true);
  });

  it('actualizar un archivo no pisa el progreso de otros archivos del mismo origen', () => {
    let r = actualizarProgreso({}, { origen: 's', indice: 0, posicionSeg: 100, duracionSeg: 600 });
    r = actualizarProgreso(r.datos, { origen: 's', indice: 1, posicionSeg: 50, duracionSeg: 500 });
    expect(r.datos.s.archivos[0].posicionSeg).toBe(100);
    expect(r.datos.s.archivos[1].posicionSeg).toBe(50);
  });

  it('no pisa guardado ni titulo/poster existentes si no se pasan de nuevo', () => {
    let r = actualizarProgreso({}, { origen: 'g', indice: 0, posicionSeg: 10, duracionSeg: 600, titulo: 'T', poster: 'x.jpg' });
    r = { ...r, datos: alternarGuardado(r.datos, 'g', true) };
    r = actualizarProgreso(r.datos, { origen: 'g', indice: 0, posicionSeg: 20, duracionSeg: 600 });
    expect(r.datos.g.guardado).toBe(true);
    expect(r.datos.g.titulo).toBe('T');
    expect(r.datos.g.poster).toBe('x.jpg');
  });
});

describe('alternarGuardado', () => {
  it('crea la entrada si no existe', () => {
    const datos = alternarGuardado({}, 'nuevo', true, { titulo: 'N', poster: null });
    expect(datos.nuevo).toMatchObject({ guardado: true, titulo: 'N', archivos: {} });
  });

  it('alterna guardado sin tocar el progreso existente', () => {
    let r = actualizarProgreso({}, { origen: 'x', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    const datos = alternarGuardado(r.datos, 'x', true);
    expect(datos.x.guardado).toBe(true);
    expect(datos.x.archivos[0].posicionSeg).toBe(5);
  });
});

describe('alternarVisto', () => {
  it('no hace nada si el origen nunca tuvo progreso', () => {
    const datos = alternarVisto({}, 'fantasma', 0, true);
    expect(datos).toEqual({});
  });

  it('marca visto manualmente y no se revierte con progreso posterior bajo el umbral', () => {
    let r = actualizarProgreso({}, { origen: 'm', indice: 0, posicionSeg: 10, duracionSeg: 600 });
    let datos = alternarVisto(r.datos, 'm', 0, true);
    expect(datos.m.archivos[0].visto).toBe(true);
    const r2 = actualizarProgreso(datos, { origen: 'm', indice: 0, posicionSeg: 20, duracionSeg: 600 });
    expect(r2.datos.m.archivos[0].visto).toBe(true);
  });
});

describe('limpiarHistorial', () => {
  it('elimina por completo los orígenes no guardados y conserva los guardados', () => {
    let r = actualizarProgreso({}, { origen: 'a', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    r = actualizarProgreso(r.datos, { origen: 'b', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    let datos = alternarGuardado(r, 'b', true);
    datos = limpiarHistorial(datos);
    expect(datos.a).toBeUndefined();
    expect(datos.b).toBeDefined();
    expect(datos.b.archivos[0].posicionSeg).toBe(5);
  });
});

describe('selectores', () => {
  function construir() {
    let datos = {};
    ({ datos } = actualizarProgreso(datos, { origen: 'medio', indice: 0, posicionSeg: 100, duracionSeg: 600, titulo: 'Medio' }));
    ({ datos } = actualizarProgreso(datos, { origen: 'terminado', indice: 0, posicionSeg: 590, duracionSeg: 600, titulo: 'Terminado' }));
    datos = alternarGuardado(datos, 'guardado-sin-ver', true, { titulo: 'Guardado' });
    return datos;
  }

  it('continuarViendo excluye lo terminado y lo nunca empezado', () => {
    const r = continuarViendo(construir());
    expect(r.map((x) => x.origen)).toEqual(['medio']);
  });

  it('guardados solo incluye guardado:true', () => {
    const r = guardados(construir());
    expect(r.map((x) => x.origen)).toEqual(['guardado-sin-ver']);
  });

  it('historial incluye cualquier progreso, incluido lo terminado', () => {
    const r = historial(construir());
    expect(r.map((x) => x.origen).sort()).toEqual(['medio', 'terminado']);
  });

  it('ordena por ultimaVez descendente', () => {
    let datos = {};
    ({ datos } = actualizarProgreso(datos, { origen: 'viejo', indice: 0, posicionSeg: 5, duracionSeg: 100 }));
    datos.viejo.ultimaVez = '2020-01-01T00:00:00.000Z';
    ({ datos } = actualizarProgreso(datos, { origen: 'nuevo', indice: 0, posicionSeg: 5, duracionSeg: 100 }));
    datos.nuevo.ultimaVez = '2026-01-01T00:00:00.000Z';
    expect(historial(datos).map((x) => x.origen)).toEqual(['nuevo', 'viejo']);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -w server`
Expected: FAIL — no existe `../lib/biblioteca.js`.

- [ ] **Step 3: Implementar `server/lib/biblioteca.js`**

```js
const UMBRAL_VISTO = 0.9;

export function actualizarProgreso(datos, { origen, indice, posicionSeg, duracionSeg, titulo, poster }) {
  const ahora = new Date().toISOString();
  const existente = datos[origen];
  const vistoPrevio = existente?.archivos?.[indice]?.visto ?? false;
  const vistoNuevo = duracionSeg > 0 && posicionSeg / duracionSeg >= UMBRAL_VISTO ? true : vistoPrevio;
  const cruzoUmbral = !vistoPrevio && vistoNuevo;

  const entrada = {
    titulo: titulo ?? existente?.titulo ?? '',
    poster: poster ?? existente?.poster ?? null,
    guardado: existente?.guardado ?? false,
    primeraVez: existente?.primeraVez ?? ahora,
    ultimaVez: ahora,
    archivos: {
      ...existente?.archivos,
      [indice]: { posicionSeg, duracionSeg, visto: vistoNuevo, ultimaVez: ahora },
    },
  };

  return { datos: { ...datos, [origen]: entrada }, visto: cruzoUmbral };
}

export function alternarGuardado(datos, origen, guardado, meta = {}) {
  const ahora = new Date().toISOString();
  const existente = datos[origen];
  const entrada = {
    titulo: meta.titulo ?? existente?.titulo ?? '',
    poster: meta.poster ?? existente?.poster ?? null,
    guardado,
    primeraVez: existente?.primeraVez ?? ahora,
    ultimaVez: existente?.ultimaVez ?? ahora,
    archivos: existente?.archivos ?? {},
  };
  return { ...datos, [origen]: entrada };
}

export function alternarVisto(datos, origen, indice, visto) {
  const existente = datos[origen];
  if (!existente) return datos;
  const ahora = new Date().toISOString();
  const archivoExistente = existente.archivos[indice] ?? { posicionSeg: 0, duracionSeg: 0 };
  return {
    ...datos,
    [origen]: {
      ...existente,
      ultimaVez: ahora,
      archivos: { ...existente.archivos, [indice]: { ...archivoExistente, visto, ultimaVez: ahora } },
    },
  };
}

export function limpiarHistorial(datos) {
  const resultado = {};
  for (const [origen, entrada] of Object.entries(datos)) {
    if (entrada.guardado) resultado[origen] = entrada;
  }
  return resultado;
}

function archivosDe(entrada) {
  return Object.values(entrada.archivos ?? {});
}

function aLista(datos, filtro) {
  return Object.entries(datos)
    .filter(([, entrada]) => filtro(entrada))
    .sort((a, b) => new Date(b[1].ultimaVez) - new Date(a[1].ultimaVez))
    .map(([origen, entrada]) => ({ origen, ...entrada }));
}

export function continuarViendo(datos) {
  return aLista(datos, (e) => archivosDe(e).some((a) => a.duracionSeg > 0 && a.posicionSeg > 0 && a.posicionSeg / a.duracionSeg < UMBRAL_VISTO));
}

export function guardados(datos) {
  return aLista(datos, (e) => e.guardado);
}

export function historial(datos) {
  return aLista(datos, (e) => archivosDe(e).some((a) => a.posicionSeg > 0));
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -w server`
Expected: PASS (todos los tests de biblioteca).

- [ ] **Step 5: Commit**

```bash
git add server/lib/biblioteca.js server/test/biblioteca.test.js
git commit -m "feat: logica pura de biblioteca (progreso, guardado, visto, selectores)"
```

---

### Task 2: Rutas de biblioteca (`server/routes/biblioteca.js`)

**Files:**
- Create: `server/routes/biblioteca.js`
- Modify: `server/index.js`
- Test: `server/test/rutas-biblioteca.test.js`

**Interfaces:**
- Consumes: `leerJson`/`guardarJson` (`lib/almacen.js`, clave `'biblioteca'`, valor por defecto `{}`); `actualizarProgreso`/`alternarGuardado`/`alternarVisto`/`limpiarHistorial`/`continuarViendo`/`guardados`/`historial` (Task 1).
- Produces:
  - `GET /api/biblioteca` → `{ continuarViendo:[...], guardados:[...], historial:[...], entradas: {<origen>: {...}} }` (`entradas` es el store crudo completo, para que el cliente pueda mirar el progreso de un origen/archivo específico sin un endpoint por origen).
  - `PUT /api/biblioteca/progreso` body `{origen, indice, posicionSeg, duracionSeg, titulo?, poster?}` → `200 {ok:true, visto:boolean}`; `400` con JSON español si `origen` vacío, `indice` no es entero ≥0, o `posicionSeg`/`duracionSeg` no son números ≥0.
  - `PUT /api/biblioteca/guardado` body `{origen, guardado, titulo?, poster?}` → `200 {ok:true}`; `400` si `origen` vacío o `guardado` no es booleano.
  - `PUT /api/biblioteca/visto` body `{origen, indice, visto}` → `200 {ok:true}`; `400` si `origen` vacío, `indice` no entero ≥0, o `visto` no booleano.
  - `DELETE /api/biblioteca/historial` → `200 {ok:true}`.

- [ ] **Step 1: Escribir tests que fallan — `server/test/rutas-biblioteca.test.js`**

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-'));
const { crearApp } = await import('../index.js');
const app = crearApp();

describe('GET /api/biblioteca', () => {
  it('devuelve las tres listas vacías y entradas vacío cuando no hay nada', async () => {
    const r = await request(app).get('/api/biblioteca');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ continuarViendo: [], guardados: [], historial: [], entradas: {} });
  });
});

describe('PUT /api/biblioteca/progreso', () => {
  it('guarda progreso y aparece en GET', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({
      origen: 'peli1', indice: 0, posicionSeg: 30, duracionSeg: 600, titulo: 'Peli', poster: 'p.jpg',
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, visto: false });
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.entradas.peli1.archivos['0']).toMatchObject({ posicionSeg: 30, duracionSeg: 600 });
    expect(g.body.continuarViendo.map((x) => x.origen)).toEqual(['peli1']);
  });

  it('informa visto:true al cruzar el 90%', async () => {
    await request(app).put('/api/biblioteca/progreso').send({ origen: 'p2', indice: 0, posicionSeg: 10, duracionSeg: 100 });
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: 'p2', indice: 0, posicionSeg: 95, duracionSeg: 100 });
    expect(r.body.visto).toBe(true);
  });

  it('rechaza origen vacío', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: '', indice: 0, posicionSeg: 1, duracionSeg: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('origen-invalido');
  });

  it('rechaza indice no entero', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: 'x', indice: 'a', posicionSeg: 1, duracionSeg: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('indice-invalido');
  });

  it('rechaza posicionSeg negativa', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: 'x', indice: 0, posicionSeg: -1, duracionSeg: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('posicion-invalida');
  });
});

describe('PUT /api/biblioteca/guardado', () => {
  it('guarda y aparece en guardados', async () => {
    const r = await request(app).put('/api/biblioteca/guardado').send({ origen: 'g1', guardado: true, titulo: 'G1' });
    expect(r.status).toBe(200);
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.guardados.map((x) => x.origen)).toContain('g1');
  });

  it('rechaza guardado no booleano', async () => {
    const r = await request(app).put('/api/biblioteca/guardado').send({ origen: 'g2', guardado: 'si' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('guardado-invalido');
  });
});

describe('PUT /api/biblioteca/visto', () => {
  it('rechaza visto no booleano', async () => {
    const r = await request(app).put('/api/biblioteca/visto').send({ origen: 'x', indice: 0, visto: 'si' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('visto-invalido');
  });

  it('marca visto sobre un origen existente', async () => {
    await request(app).put('/api/biblioteca/progreso').send({ origen: 'v1', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    const r = await request(app).put('/api/biblioteca/visto').send({ origen: 'v1', indice: 0, visto: true });
    expect(r.status).toBe(200);
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.entradas.v1.archivos['0'].visto).toBe(true);
  });
});

describe('DELETE /api/biblioteca/historial', () => {
  it('limpia lo no guardado y conserva lo guardado', async () => {
    await request(app).put('/api/biblioteca/progreso').send({ origen: 'temp', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    await request(app).put('/api/biblioteca/guardado').send({ origen: 'perm', guardado: true });
    const r = await request(app).delete('/api/biblioteca/historial');
    expect(r.status).toBe(200);
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.entradas.temp).toBeUndefined();
    expect(g.body.entradas.perm).toBeDefined();
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -w server`
Expected: FAIL — no existe `../routes/biblioteca.js`.

- [ ] **Step 3: Implementar `server/routes/biblioteca.js`**

```js
import { Router } from 'express';
import { leerJson, guardarJson } from '../lib/almacen.js';
import {
  actualizarProgreso, alternarGuardado, alternarVisto, limpiarHistorial,
  continuarViendo, guardados, historial,
} from '../lib/biblioteca.js';

const router = Router();

function obtenerDatos() {
  return leerJson('biblioteca', {});
}

router.get('/', (req, res) => {
  const datos = obtenerDatos();
  res.json({
    continuarViendo: continuarViendo(datos),
    guardados: guardados(datos),
    historial: historial(datos),
    entradas: datos,
  });
});

router.put('/progreso', (req, res) => {
  const { origen, indice, posicionSeg, duracionSeg, titulo, poster } = req.body ?? {};
  if (typeof origen !== 'string' || !origen.trim()) {
    return res.status(400).json({ error: 'origen-invalido', mensaje: 'Falta el origen.' });
  }
  if (!Number.isInteger(indice) || indice < 0) {
    return res.status(400).json({ error: 'indice-invalido', mensaje: 'Índice de archivo inválido.' });
  }
  if (typeof posicionSeg !== 'number' || posicionSeg < 0 || typeof duracionSeg !== 'number' || duracionSeg < 0) {
    return res.status(400).json({ error: 'posicion-invalida', mensaje: 'Posición o duración inválida.' });
  }
  const { datos, visto } = actualizarProgreso(obtenerDatos(), { origen: origen.trim(), indice, posicionSeg, duracionSeg, titulo, poster });
  guardarJson('biblioteca', datos);
  res.json({ ok: true, visto });
});

router.put('/guardado', (req, res) => {
  const { origen, guardado, titulo, poster } = req.body ?? {};
  if (typeof origen !== 'string' || !origen.trim()) {
    return res.status(400).json({ error: 'origen-invalido', mensaje: 'Falta el origen.' });
  }
  if (typeof guardado !== 'boolean') {
    return res.status(400).json({ error: 'guardado-invalido', mensaje: 'Falta indicar si se guarda o quita.' });
  }
  const datos = alternarGuardado(obtenerDatos(), origen.trim(), guardado, { titulo, poster });
  guardarJson('biblioteca', datos);
  res.json({ ok: true });
});

router.put('/visto', (req, res) => {
  const { origen, indice, visto } = req.body ?? {};
  if (typeof origen !== 'string' || !origen.trim()) {
    return res.status(400).json({ error: 'origen-invalido', mensaje: 'Falta el origen.' });
  }
  if (!Number.isInteger(indice) || indice < 0) {
    return res.status(400).json({ error: 'indice-invalido', mensaje: 'Índice de archivo inválido.' });
  }
  if (typeof visto !== 'boolean') {
    return res.status(400).json({ error: 'visto-invalido', mensaje: 'Falta indicar el estado de visto.' });
  }
  const datos = alternarVisto(obtenerDatos(), origen.trim(), indice, visto);
  guardarJson('biblioteca', datos);
  res.json({ ok: true });
});

router.delete('/historial', (req, res) => {
  guardarJson('biblioteca', limpiarHistorial(obtenerDatos()));
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Montar en `server/index.js`**

Añadir el import junto a los otros routers y el `app.use` en el mismo grupo `/api/*` (antes de los estáticos y el 404):

```js
import bibliotecaRouter from './routes/biblioteca.js';
// junto a los otros app.use('/api/...', ...):
  app.use('/api/biblioteca', bibliotecaRouter);
```

- [ ] **Step 5: Verificar que pasan**

Run: `npm test -w server`
Expected: PASS (todos, incluidos los nuevos de biblioteca).

- [ ] **Step 6: Commit**

```bash
git add server/routes/biblioteca.js server/index.js server/test/rutas-biblioteca.test.js
git commit -m "feat: rutas REST de biblioteca (progreso, guardado, visto, historial)"
```

---

### Task 3: Helpers de cliente de biblioteca (`client/src/lib/biblioteca.js`)

**Files:**
- Create: `client/src/lib/biblioteca.js`
- Test: `client/src/lib/biblioteca.test.js`

**Interfaces:**
- Consumes: `api()` de `client/src/lib/api.js`.
- Produces:
  - `obtenerBiblioteca(): Promise<{continuarViendo, guardados, historial, entradas}>`.
  - `guardarProgreso({origen, indice, posicionSeg, duracionSeg, titulo?, poster?}): Promise<{ok:true, visto:boolean}>`.
  - `alternarGuardado(origen, guardado, meta?: {titulo?, poster?}): Promise<{ok:true}>`.
  - `alternarVisto(origen, indice, visto): Promise<{ok:true}>`.
  - `limpiarHistorial(): Promise<{ok:true}>`.

- [ ] **Step 1: Escribir el test que falla — `client/src/lib/biblioteca.test.js`**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api.js', () => ({ api: vi.fn() }));
const { api } = await import('./api.js');
const {
  obtenerBiblioteca, guardarProgreso, alternarGuardado, alternarVisto, limpiarHistorial,
} = await import('./biblioteca.js');

beforeEach(() => { api.mockReset(); api.mockResolvedValue({ ok: true }); });

describe('helpers de biblioteca', () => {
  it('obtenerBiblioteca hace GET a /biblioteca', async () => {
    await obtenerBiblioteca();
    expect(api).toHaveBeenCalledWith('/biblioteca');
  });

  it('guardarProgreso hace PUT con el body exacto', async () => {
    await guardarProgreso({ origen: 'x', indice: 1, posicionSeg: 10, duracionSeg: 100, titulo: 'T', poster: 'p.jpg' });
    expect(api).toHaveBeenCalledWith('/biblioteca/progreso', {
      method: 'PUT',
      body: { origen: 'x', indice: 1, posicionSeg: 10, duracionSeg: 100, titulo: 'T', poster: 'p.jpg' },
    });
  });

  it('alternarGuardado hace PUT incluyendo meta opcional', async () => {
    await alternarGuardado('x', true, { titulo: 'T', poster: null });
    expect(api).toHaveBeenCalledWith('/biblioteca/guardado', {
      method: 'PUT',
      body: { origen: 'x', guardado: true, titulo: 'T', poster: null },
    });
  });

  it('alternarVisto hace PUT con origen/indice/visto', async () => {
    await alternarVisto('x', 2, false);
    expect(api).toHaveBeenCalledWith('/biblioteca/visto', { method: 'PUT', body: { origen: 'x', indice: 2, visto: false } });
  });

  it('limpiarHistorial hace DELETE', async () => {
    await limpiarHistorial();
    expect(api).toHaveBeenCalledWith('/biblioteca/historial', { method: 'DELETE' });
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -w client`
Expected: FAIL — no existe `./biblioteca.js`.

- [ ] **Step 3: Implementar `client/src/lib/biblioteca.js`**

```js
import { api } from './api.js';

export function obtenerBiblioteca() {
  return api('/biblioteca');
}

export function guardarProgreso({ origen, indice, posicionSeg, duracionSeg, titulo, poster }) {
  return api('/biblioteca/progreso', { method: 'PUT', body: { origen, indice, posicionSeg, duracionSeg, titulo, poster } });
}

export function alternarGuardado(origen, guardado, meta = {}) {
  return api('/biblioteca/guardado', { method: 'PUT', body: { origen, guardado, ...meta } });
}

export function alternarVisto(origen, indice, visto) {
  return api('/biblioteca/visto', { method: 'PUT', body: { origen, indice, visto } });
}

export function limpiarHistorial() {
  return api('/biblioteca/historial', { method: 'DELETE' });
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -w client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/biblioteca.js client/src/lib/biblioteca.test.js
git commit -m "feat: helpers de cliente para la API de biblioteca, con tests"
```

---

### Task 4: Resolvers compartidos en `lib/reproductor.js`

**Files:**
- Modify: `client/src/lib/reproductor.js`
- Test: `client/src/lib/reproductor.test.js` (añadir casos)

**Interfaces:**
- Consumes: `abrirIA`, `abrirTorrent`, `cerrarTorrent` (ya existentes en el mismo archivo).
- Produces (nuevas, para Tasks 5 y 6):
  - `pareceIdentificadorIA(origen: string): boolean` — `true` si `origen` matchea `/^[A-Za-z0-9._-]+$/` (mismo patrón que usa el servidor para reconocer identificadores de Internet Archive; una URL, magnet o `.torrent` nunca matchea por sus `:`/`/`).
  - `resolverIA(identificador: string): Promise<{tipo:'directo', url, subtitulos, metaTitulo} | {tipo:'torrent', id, archivos, subtitulos, metaTitulo}>` — abre un identificador de Internet Archive; si no hay archivo reproducible lanza `Error` con `.motivo = 'sin-reproducibles'` (y cierra el torrent si llegó a abrir uno).
  - `resolverTorrentOrigen(origen: string): Promise<{tipo:'torrent', id, archivos}>` — abre cualquier origen vía `/stream/torrent`; mismo comportamiento de error que `resolverIA` si no hay archivo reproducible. Los errores de origen rechazado (`err.motivo`/`err.codigo`) de `abrirTorrent` se propagan tal cual (los traduce `MOTIVOS` en el llamador).

- [ ] **Step 1: Añadir el test que falla a `client/src/lib/reproductor.test.js`**

Añadir estos casos al archivo existente (mockeando `./api.js` igual que hace el resto del archivo si ya usa mocks; si no, mockear `abrirIA`/`abrirTorrent`/`cerrarTorrent` del propio módulo no es posible por ser el mismo archivo — en su lugar, mockear `./api.js` de nuevo, ya que `abrirIA`/`abrirTorrent`/`cerrarTorrent` llaman a `api()` internamente):

```js
import { vi, beforeEach } from 'vitest';

vi.mock('./api.js', () => ({ api: vi.fn() }));
const { api } = await import('./api.js');
// (el resto de imports de este archivo ya existen; añadir estos junto a ellos)
const { pareceIdentificadorIA, resolverIA, resolverTorrentOrigen } = await import('./reproductor.js');

beforeEach(() => { api.mockReset(); });

describe('pareceIdentificadorIA', () => {
  it('reconoce un identificador simple de Internet Archive', () => {
    expect(pareceIdentificadorIA('night_of_the_living_dead')).toBe(true);
  });
  it('rechaza magnets y URLs', () => {
    expect(pareceIdentificadorIA('magnet:?xt=urn:btih:abc')).toBe(false);
    expect(pareceIdentificadorIA('https://archive.org/details/x')).toBe(false);
  });
});

describe('resolverIA', () => {
  it('devuelve tipo directo cuando hay un archivo de video', async () => {
    api.mockResolvedValueOnce({ titulo: 'Peli', archivos: [{ esVideo: true, esAudio: false, url: 'https://a/x.mp4' }], torrent: null, subtitulos: [] });
    const r = await resolverIA('id1');
    expect(r).toMatchObject({ tipo: 'directo', url: 'https://a/x.mp4', metaTitulo: 'Peli' });
  });

  it('lanza error con motivo sin-reproducibles si no hay video/audio ni torrent', async () => {
    api.mockResolvedValueOnce({ titulo: 'Vacío', archivos: [], torrent: null, subtitulos: [] });
    await expect(resolverIA('id2')).rejects.toMatchObject({ motivo: 'sin-reproducibles' });
  });
});

describe('resolverTorrentOrigen', () => {
  it('devuelve tipo torrent cuando hay al menos un archivo reproducible', async () => {
    api.mockResolvedValueOnce({ id: 'abc', archivos: [{ indice: 0, reproducible: true, nombre: 'x.mp4' }] });
    const r = await resolverTorrentOrigen('magnet:?xt=urn:btih:abc&ws=https://x/y.mp4');
    expect(r).toMatchObject({ tipo: 'torrent', id: 'abc' });
  });

  it('cierra el torrent y lanza sin-reproducibles si ningún archivo es reproducible', async () => {
    api.mockResolvedValueOnce({ id: 'abc', archivos: [{ indice: 0, reproducible: false, nombre: 'x.txt' }] });
    api.mockResolvedValueOnce({ ok: true });
    await expect(resolverTorrentOrigen('magnet:?xt=urn:btih:abc&ws=https://x/y')).rejects.toMatchObject({ motivo: 'sin-reproducibles' });
    expect(api).toHaveBeenCalledWith('/stream/torrent/abc', { method: 'DELETE' });
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -w client`
Expected: FAIL — `pareceIdentificadorIA`/`resolverIA`/`resolverTorrentOrigen` no existen.

- [ ] **Step 3: Añadir a `client/src/lib/reproductor.js`**

Añadir al final del archivo (después de las funciones existentes `buscarIA`, `abrirIA`, `abrirTorrent`, `cerrarTorrent`, `urlStream`, `urlSubtitulo`, `MOTIVOS`):

```js
const RE_ID_IA = /^[A-Za-z0-9._-]+$/;

export function pareceIdentificadorIA(origen) {
  return RE_ID_IA.test(origen);
}

function errorSinReproducibles() {
  return Object.assign(new Error('Sin archivos reproducibles'), { motivo: 'sin-reproducibles' });
}

export async function resolverIA(identificador) {
  const meta = await abrirIA(identificador);
  const video = meta.archivos.find((a) => a.esVideo) || meta.archivos.find((a) => a.esAudio);
  if (video) {
    return { tipo: 'directo', url: video.url, subtitulos: meta.subtitulos, metaTitulo: meta.titulo };
  }
  if (meta.torrent) {
    const { id, archivos } = await abrirTorrent(meta.torrent);
    if (!archivos.some((a) => a.reproducible)) {
      await cerrarTorrent(id);
      throw errorSinReproducibles();
    }
    return { tipo: 'torrent', id, archivos, subtitulos: meta.subtitulos, metaTitulo: meta.titulo };
  }
  throw errorSinReproducibles();
}

export async function resolverTorrentOrigen(origen) {
  const { id, archivos } = await abrirTorrent(origen);
  if (!archivos.some((a) => a.reproducible)) {
    await cerrarTorrent(id);
    throw errorSinReproducibles();
  }
  return { tipo: 'torrent', id, archivos };
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -w client`
Expected: PASS (todos, incluidos los nuevos de reproductor.js).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/reproductor.js client/src/lib/reproductor.test.js
git commit -m "feat: resolvers compartidos resolverIA/resolverTorrentOrigen con tests"
```

---

### Task 5: `Reproductor.jsx` — auto-resume, autoguardado, marcar visto

**Files:**
- Modify: `client/src/components/Reproductor.jsx`

**Interfaces:**
- Consumes: `obtenerBiblioteca`, `guardarProgreso`, `alternarVisto` (Task 3); `urlStream`, `urlSubtitulo` (ya existentes).
- Produces: `<Reproductor fuente onCerrar>` donde `fuente` ahora además de `{tipo, url|id+archivos, subtitulos}` incluye `{ origen: string, titulo: string, poster: string|null }` (obligatorios; Tasks 6/7 los rellenan). El componente es autosuficiente: no necesita que el padre le pase nada de biblioteca.

Este componente no tiene test dedicado (no hay tests de componentes React en el proyecto; se verifica manualmente en la Task 7). Es TDD en el sentido de "verificar con la suite completa que nada se rompe" en cada paso.

- [ ] **Step 1: Verificar el estado actual**

Run: `npm test -w client`
Expected: PASS (estado previo a esta tarea; para tener una línea base antes de modificar el componente).

- [ ] **Step 2: Reescribir `client/src/components/Reproductor.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import { urlStream, urlSubtitulo } from '../lib/reproductor.js';
import { obtenerBiblioteca, guardarProgreso, alternarVisto } from '../lib/biblioteca.js';

const INTERVALO_GUARDADO_MS = 10_000;

export default function Reproductor({ fuente, onCerrar }) {
  const [indice, setIndice] = useState(0);
  const [visto, setVisto] = useState(false);
  const videoRef = useRef(null);
  const resumeAplicado = useRef(false);

  useEffect(() => { setIndice(0); resumeAplicado.current = false; }, [fuente]);

  const reproducibles = fuente?.tipo === 'torrent'
    ? fuente.archivos.filter((a) => a.reproducible)
    : [];
  const indiceActivo = !fuente
    ? 0
    : fuente.tipo === 'directo'
      ? 0
      : (reproducibles[indice] ?? fuente.archivos[0])?.indice ?? 0;
  const src = !fuente
    ? null
    : fuente.tipo === 'directo'
      ? fuente.url
      : urlStream(fuente.id, indiceActivo);

  // Al cambiar de fuente/archivo activo: buscar progreso guardado y estado de "visto".
  useEffect(() => {
    if (!fuente) return;
    let cancelado = false;
    obtenerBiblioteca().then((biblio) => {
      if (cancelado) return;
      const archivo = biblio.entradas?.[fuente.origen]?.archivos?.[indiceActivo];
      setVisto(archivo?.visto ?? false);
      const video = videoRef.current;
      if (!video || !archivo || archivo.posicionSeg <= 0) return;
      const aplicarResume = () => {
        if (resumeAplicado.current) return;
        resumeAplicado.current = true;
        if (archivo.posicionSeg < video.duration) video.currentTime = archivo.posicionSeg;
      };
      if (video.readyState >= 1) aplicarResume();
      else video.addEventListener('loadedmetadata', aplicarResume, { once: true });
    }).catch(() => {});
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, indiceActivo]);

  const guardarAhora = () => {
    const video = videoRef.current;
    if (!fuente || !video || !video.duration || Number.isNaN(video.duration)) return;
    guardarProgreso({
      origen: fuente.origen,
      indice: indiceActivo,
      posicionSeg: video.currentTime,
      duracionSeg: video.duration,
      titulo: fuente.titulo,
      poster: fuente.poster,
    }).then((r) => { if (r?.visto) setVisto(true); }).catch(() => {});
  };

  // Autoguardado periódico mientras hay una fuente activa.
  useEffect(() => {
    if (!fuente) return;
    const id = setInterval(guardarAhora, INTERVALO_GUARDADO_MS);
    window.addEventListener('beforeunload', guardarAhora);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', guardarAhora);
      guardarAhora();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, indiceActivo]);

  const alternarVistoManual = () => {
    if (!fuente) return;
    const nuevo = !visto;
    setVisto(nuevo);
    alternarVisto(fuente.origen, indiceActivo, nuevo).catch(() => setVisto(!nuevo));
  };

  const cerrar = () => {
    guardarAhora();
    onCerrar?.();
  };

  if (!fuente) return null;

  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>▶️ Reproduciendo</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={visto ? 'chip chip-activo' : 'chip'} onClick={alternarVistoManual}>
            {visto ? '✔ Visto' : '○ Marcar como visto'}
          </button>
          {onCerrar && <button className="chip" onClick={cerrar}>✕ Cerrar</button>}
        </div>
      </div>
      <video
        key={src}
        ref={videoRef}
        className="poster"
        style={{ width: '100%', aspectRatio: '16/9', height: 'auto', background: '#000' }}
        src={src}
        controls
        autoPlay
        onPause={guardarAhora}
      >
        {(fuente.subtitulos ?? []).map((s, i) => (
          <track key={i} kind="subtitles" src={urlSubtitulo(s.url)} label={s.idioma || `Subtítulo ${i + 1}`} default={i === 0} />
        ))}
      </video>
      {reproducibles.length > 1 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {reproducibles.map((a, i) => (
            <button key={a.indice} className={i === indice ? 'chip chip-activo' : 'chip'} onClick={() => setIndice(i)}>
              {a.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar que la suite sigue en verde**

Run: `npm test -w client`
Expected: PASS (el componente no tiene test propio; esto confirma que nada más se rompió).

- [ ] **Step 4: Verificar el build**

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso — confirma que `fuente.origen`/`titulo`/`poster` no rompen el tipo de uso existente (JS sin tipos estrictos, pero el build valida sintaxis/imports).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/Reproductor.jsx
git commit -m "feat: Reproductor con auto-resume, autoguardado cada 10s y marcar visto"
```

---

### Task 6: `Reproducir.jsx` — usa los resolvers, adjunta origen/titulo/poster, botón Guardar

**Files:**
- Modify: `client/src/modules/reproducir/Reproducir.jsx`

**Interfaces:**
- Consumes: `resolverIA`, `resolverTorrentOrigen`, `pareceIdentificadorIA`, `cerrarTorrent`, `MOTIVOS` (Task 4); `alternarGuardado` (Task 3).
- Produces: sin cambios de interfaz pública (módulo de navegación, sin props).

- [ ] **Step 1: Reescribir `client/src/modules/reproducir/Reproducir.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import { resolverIA, resolverTorrentOrigen, cerrarTorrent, MOTIVOS, buscarIA } from '../../lib/reproductor.js';
import { alternarGuardado } from '../../lib/biblioteca.js';

export default function Reproducir() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fuente, setFuente] = useState(null);
  const [origen, setOrigen] = useState('');
  const [guardados, setGuardados] = useState({});
  const torrentActivo = useRef(null);

  const limpiarTorrent = () => {
    if (torrentActivo.current) { cerrarTorrent(torrentActivo.current); torrentActivo.current = null; }
  };
  useEffect(() => () => limpiarTorrent(), []);

  const buscar = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setCargando(true); setError(null);
    try {
      const { resultados } = await buscarIA(q);
      setResultados(resultados);
    } catch (err) {
      setError('No se pudo buscar en Internet Archive.');
    } finally {
      setCargando(false);
    }
  };

  const cerrarReproductor = () => { limpiarTorrent(); setFuente(null); };

  const reproducirIA = async (resultado) => {
    setError(null); cerrarReproductor();
    try {
      const base = await resolverIA(resultado.identificador);
      if (base.tipo === 'torrent') torrentActivo.current = base.id;
      setFuente({
        ...base,
        origen: resultado.identificador,
        titulo: resultado.titulo || base.metaTitulo || resultado.identificador,
        poster: resultado.miniatura ?? null,
      });
    } catch (err) {
      setError(err.motivo === 'sin-reproducibles' ? 'Este elemento no tiene archivos reproducibles.' : 'No se pudo abrir el contenido.');
    }
  };

  const reproducirOrigen = async (e) => {
    e?.preventDefault();
    if (!origen.trim()) return;
    const valor = origen.trim();
    setError(null); cerrarReproductor();
    try {
      const base = await resolverTorrentOrigen(valor);
      torrentActivo.current = base.id;
      setFuente({ ...base, origen: valor, titulo: valor, poster: null });
    } catch (err) {
      setError(
        err.motivo === 'sin-reproducibles'
          ? 'Este torrent no tiene archivos reproducibles.'
          : MOTIVOS[err.motivo || err.codigo] || 'No se pudo abrir el origen. Revisa que esté en tu lista de fuentes permitidas (Ajustes).',
      );
    }
  };

  const alternarGuardadoResultado = async (resultado) => {
    const nuevo = !guardados[resultado.identificador];
    setGuardados((g) => ({ ...g, [resultado.identificador]: nuevo }));
    try {
      await alternarGuardado(resultado.identificador, nuevo, { titulo: resultado.titulo, poster: resultado.miniatura });
    } catch {
      setGuardados((g) => ({ ...g, [resultado.identificador]: !nuevo }));
    }
  };

  return (
    <div>
      <h2>🎬 Reproducir</h2>
      <p className="texto-suave">Busca en Internet Archive o pega un origen permitido. Solo se reproducen fuentes de tu lista permitida (Ajustes) e Internet Archive.</p>

      <form onSubmit={buscar} style={{ display: 'flex', gap: 8 }}>
        <input placeholder="Buscar en Internet Archive…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <button className="boton" disabled={cargando}>{cargando ? 'Buscando…' : 'Buscar'}</button>
      </form>

      <form onSubmit={reproducirOrigen} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input placeholder="Pegar magnet, enlace .torrent o URL de video…" value={origen} onChange={(e) => setOrigen(e.target.value)} style={{ flex: 1 }} />
        <button className="boton boton-secundario">Reproducir origen</button>
      </form>

      {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}

      {fuente && <Reproductor fuente={fuente} onCerrar={cerrarReproductor} />}

      {resultados.length > 0 && (
        <div className="cuadricula" style={{ marginTop: 16 }}>
          {resultados.map((r) => (
            <div className="tarjeta" key={r.identificador}>
              <img
                className="poster" src={r.miniatura} alt={r.titulo} loading="lazy"
                style={{ aspectRatio: '1', objectFit: 'cover', cursor: 'pointer' }}
                onClick={() => reproducirIA(r)}
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
              />
              <h4 style={{ margin: '8px 0 2px', cursor: 'pointer' }} onClick={() => reproducirIA(r)}>{r.titulo}</h4>
              <span className="texto-suave">{r.tipo}{r.anio ? ` · ${r.anio}` : ''}</span>
              <div style={{ marginTop: 8 }}>
                <button className="chip" onClick={() => alternarGuardadoResultado(r)}>
                  {guardados[r.identificador] ? '✔ Guardada' : '💾 Guardar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tests y build**

Run: `npm test -w client`
Expected: PASS.

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev` (raíz).
Expected: en Reproducir, buscar algo en IA → tarjetas con botón "💾 Guardar" que alterna a "✔ Guardada"; reproducir un resultado; reproducir un origen pegado sigue funcionando con los mismos mensajes de error de antes. Detener.

- [ ] **Step 4: Commit**

```bash
git add client/src/modules/reproducir/Reproducir.jsx
git commit -m "feat: Reproducir usa los resolvers compartidos y permite guardar resultados"
```

---

### Task 7: Pantalla de Inicio (`modules/inicio/Inicio.jsx`) + navegación

**Files:**
- Create: `client/src/modules/inicio/Inicio.jsx`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: `obtenerBiblioteca`, `alternarGuardado`, `limpiarHistorial` (Task 3); `resolverIA`, `resolverTorrentOrigen`, `pareceIdentificadorIA`, `cerrarTorrent` (Task 4); `<Reproductor>` (Task 5).

- [ ] **Step 1: Implementar `client/src/modules/inicio/Inicio.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import { obtenerBiblioteca, alternarGuardado, limpiarHistorial } from '../../lib/biblioteca.js';
import { resolverIA, resolverTorrentOrigen, pareceIdentificadorIA, cerrarTorrent } from '../../lib/reproductor.js';

function progresoDe(item) {
  const archivos = Object.values(item.archivos ?? {});
  const activo = archivos.find((a) => a.duracionSeg > 0 && a.posicionSeg > 0) ?? archivos[0];
  if (!activo || !activo.duracionSeg) return 0;
  return Math.min(100, Math.round((activo.posicionSeg / activo.duracionSeg) * 100));
}

function TarjetaItem({ item, onAbrir, onGuardar }) {
  const pct = progresoDe(item);
  return (
    <div className="tarjeta tarjeta-mini" key={item.origen}>
      <div style={{ cursor: 'pointer' }} onClick={() => onAbrir(item)}>
        {item.poster
          ? <img className="poster" src={item.poster} alt={item.titulo} loading="lazy" />
          : <div className="poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎬</div>}
        {pct > 0 && (
          <div className="tarjeta-progreso"><div className="tarjeta-progreso-barra" style={{ width: `${pct}%` }} /></div>
        )}
      </div>
      <h4 style={{ margin: '8px 0 4px', cursor: 'pointer' }} onClick={() => onAbrir(item)}>{item.titulo || item.origen}</h4>
      <button className="chip" onClick={() => onGuardar(item)}>{item.guardado ? '✔ Guardada' : '💾 Guardar'}</button>
    </div>
  );
}

function Fila({ titulo, items, onAbrir, onGuardar, extra }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="fila-carrusel-titulo">{titulo}</h3>
        {extra}
      </div>
      <div className="fila-carrusel">
        {items.map((item) => <TarjetaItem key={item.origen} item={item} onAbrir={onAbrir} onGuardar={onGuardar} />)}
      </div>
    </section>
  );
}

export default function Inicio() {
  const [biblio, setBiblio] = useState({ continuarViendo: [], guardados: [], historial: [] });
  const [fuente, setFuente] = useState(null);
  const [error, setError] = useState(null);
  const torrentActivo = useRef(null);

  const cargar = () => obtenerBiblioteca().then(setBiblio).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const limpiarTorrent = () => {
    if (torrentActivo.current) { cerrarTorrent(torrentActivo.current); torrentActivo.current = null; }
  };
  useEffect(() => () => limpiarTorrent(), []);

  const cerrarReproductor = () => { limpiarTorrent(); setFuente(null); cargar(); };

  const abrir = async (item) => {
    setError(null); limpiarTorrent(); setFuente(null);
    try {
      const base = pareceIdentificadorIA(item.origen)
        ? await resolverIA(item.origen)
        : await resolverTorrentOrigen(item.origen);
      if (base.tipo === 'torrent') torrentActivo.current = base.id;
      setFuente({
        ...base,
        origen: item.origen,
        titulo: item.titulo || base.metaTitulo || item.origen,
        poster: item.poster ?? null,
      });
    } catch {
      setError('No se pudo reanudar este título.');
    }
  };

  const guardar = async (item) => {
    const nuevo = !item.guardado;
    try {
      await alternarGuardado(item.origen, nuevo, { titulo: item.titulo, poster: item.poster });
      cargar();
    } catch { /* deja el estado anterior visible en la próxima carga */ }
  };

  const limpiar = async () => {
    await limpiarHistorial().catch(() => {});
    cargar();
  };

  const destacado = biblio.continuarViendo[0];

  return (
    <div>
      {destacado && (
        <div className="hero" style={destacado.poster ? { backgroundImage: `linear-gradient(to top, var(--fondo), transparent 60%), url(${destacado.poster})` } : undefined}>
          <div className="hero-texto">
            <h2 style={{ margin: '0 0 8px' }}>{destacado.titulo || destacado.origen}</h2>
            <p className="texto-suave">Continuar viendo — {progresoDe(destacado)}% completado</p>
            <button className="boton" onClick={() => abrir(destacado)}>▶ Continuar</button>
          </div>
        </div>
      )}
      {!destacado && (
        <div>
          <h2>🏠 Inicio</h2>
          <p className="texto-suave">Aún no has empezado nada. Ve a <b>🎬 Reproducir</b> para buscar en Internet Archive o abrir un origen permitido.</p>
        </div>
      )}

      {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
      {fuente && <Reproductor fuente={fuente} onCerrar={cerrarReproductor} />}

      <Fila titulo="Continuar viendo" items={biblio.continuarViendo} onAbrir={abrir} onGuardar={guardar} />
      <Fila titulo="Mi biblioteca" items={biblio.guardados} onAbrir={abrir} onGuardar={guardar} />
      <Fila
        titulo="Historial reciente" items={biblio.historial} onAbrir={abrir} onGuardar={guardar}
        extra={<button className="chip" onClick={limpiar}>🗑️ Limpiar historial</button>}
      />
    </div>
  );
}
```

- [ ] **Step 2: Conectar en `client/src/App.jsx`**

Añadir el import, colocar `['inicio', '🏠 Inicio']` como PRIMERA entrada de `SECCIONES`, añadir `inicio: Inicio` a `MODULOS`, y cambiar el estado inicial de `vista`:

```jsx
import Inicio from './modules/inicio/Inicio.jsx';
// SECCIONES: agregar como primer elemento del array
  ['inicio', '🏠 Inicio'],
// MODULOS: agregar
  inicio: Inicio,
// en el componente App:
  const [vista, setVista] = useState('inicio');
```

- [ ] **Step 3: Verificar tests y build**

Run: `npm test -w client`
Expected: PASS.

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso.

- [ ] **Step 4: Verificación manual**

Run: `npm run dev` (raíz).
Expected: Inicio es la sección de arranque; sin biblioteca previa muestra el mensaje vacío. Reproducir algo en 🎬 Reproducir, cerrarlo, volver a Inicio → aparece en "Continuar viendo" con barra de progreso; abrirlo desde ahí reanuda cerca de donde quedó. Guardar/quitar desde una tarjeta de Inicio funciona. "Limpiar historial" quita lo no guardado y conserva lo guardado. Detener.

- [ ] **Step 5: Commit**

```bash
git add client/src/modules/inicio client/src/App.jsx
git commit -m "feat: pantalla de Inicio con continuar viendo, biblioteca e historial"
```

---

### Task 8: Refresco visual (`styles.css`)

**Files:**
- Modify: `client/src/styles.css`

**Interfaces:** Añade clases nuevas (`.tarjeta-mini`, `.tarjeta-progreso`, `.tarjeta-progreso-barra`, `.fila-carrusel`, `.fila-carrusel-titulo`, `.hero`, `.hero-texto`) consumidas por Task 7. Refina clases existentes (`.tarjeta`, `.boton`, `.chip`, `.lateral button`) sin cambiar sus nombres, para que las 8 secciones existentes hereden el refresco automáticamente.

- [ ] **Step 1: Añadir variables nuevas al bloque `:root`**

En `client/src/styles.css`, reemplazar el bloque `:root { ... }` completo por:

```css
:root {
  --fondo: #0b0b10;
  --panel: #16161f;
  --panel-2: #1e1e2a;
  --texto: #f2f2f5;
  --texto-suave: #a0a0b0;
  --acento: #e50914;
  --acento-2: #f5a623;
  --borde: #2a2a38;
  --radio: 12px;
  --radio-chico: 8px;
  --sombra: 0 4px 16px rgba(0, 0, 0, 0.4);
  --sombra-hover: 0 8px 28px rgba(0, 0, 0, 0.55);
  --transicion: 160ms ease;
}
```

- [ ] **Step 2: Refinar `.tarjeta`, `.boton`, `.chip`, `.lateral button` con transiciones y sombra**

Reemplazar las reglas existentes de `.tarjeta` por:

```css
.tarjeta {
  background: var(--panel);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  padding: 16px;
  box-shadow: var(--sombra);
  transition: transform var(--transicion), box-shadow var(--transicion);
}

.tarjeta:hover { transform: translateY(-2px); box-shadow: var(--sombra-hover); }
```

Reemplazar `.chip { ... }` por:

```css
.chip {
  background: var(--panel-2);
  border: 1px solid var(--borde);
  color: var(--texto);
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  transition: background var(--transicion), border-color var(--transicion);
}

.chip:hover { background: var(--borde); }
```

Reemplazar `.boton { ... }` por:

```css
.boton {
  background: var(--acento);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radio-chico);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: filter var(--transicion), transform var(--transicion);
}

.boton:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
```

Añadir transición a `.lateral button` (mantener el resto de sus reglas igual, solo añadir `transition`):

```css
.lateral button { transition: background var(--transicion), color var(--transicion); }
```

- [ ] **Step 3: Añadir las clases nuevas al final del archivo**

```css
.tarjeta-mini { width: 180px; flex-shrink: 0; padding: 10px; }
.tarjeta-mini .poster { aspect-ratio: 2/3; }
.tarjeta-mini h4 { font-size: 14px; }

.tarjeta-progreso {
  position: relative;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  margin-top: 6px;
  overflow: hidden;
}

.tarjeta-progreso-barra { height: 100%; background: var(--acento); }

.fila-carrusel {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  padding: 12px 2px 6px;
  scroll-snap-type: x proximity;
}

.fila-carrusel > * { scroll-snap-align: start; }

.fila-carrusel-titulo { margin: 0; font-size: 18px; }

.hero {
  position: relative;
  border-radius: var(--radio);
  min-height: 260px;
  display: flex;
  align-items: flex-end;
  padding: 28px;
  margin-bottom: 8px;
  background-color: var(--panel);
  background-size: cover;
  background-position: center;
  box-shadow: var(--sombra);
}

.hero-texto { position: relative; max-width: 560px; }
```

- [ ] **Step 4: Verificar build**

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso (CSS es solo copiado/minificado, no hay lógica que romper).

- [ ] **Step 5: Verificación manual**

Run: `npm run dev` (raíz).
Expected: recorrer las 8 secciones; tarjetas con leve elevación al pasar el mouse, botones/chips con transición suave; Inicio muestra el hero y las filas horizontales con scroll. Nada se ve roto en Fuentes/Noche de Cine/etc. Detener.

- [ ] **Step 6: Commit**

```bash
git add client/src/styles.css
git commit -m "feat: refresco visual compartido (sombras, transiciones, hero y filas tipo carrusel)"
```

---

### Task 9: Documentación y verificación final

**Files:**
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:** —

- [ ] **Step 1: Añadir sección al `README.md`**

Insertar después de la sección "🎬 Reproducir (streaming legal)" existente:

```markdown
## 🏠 Inicio — continuar viendo y biblioteca

La pantalla de Inicio recuerda dónde te quedaste: reanuda automáticamente la posición de cualquier título, marca lo que ya viste (o márcalo tú manualmente), y te deja guardar tus favoritos en "Mi biblioteca". El historial se puede limpiar en cualquier momento sin perder lo guardado.
```

- [ ] **Step 2: Añadir sección al `CLAUDE.md`**

Insertar después de la sección "Reproductor / streaming legal (Etapa 1)" existente:

```markdown
### Biblioteca / continuar viendo (Etapa 2)

- `server/lib/biblioteca.js`: lógica pura sobre un único store `{ [origen]: { titulo, poster, guardado, archivos: { [indice]: { posicionSeg, duracionSeg, visto } } } }`. `actualizarProgreso` marca `visto` automático al 90%; un override manual (`alternarVisto`) no se revierte por progreso posterior bajo el umbral. `continuarViendo`/`guardados`/`historial` son selectores puros, no colecciones separadas.
- `server/routes/biblioteca.js`: `GET /api/biblioteca` (las tres listas + `entradas` crudo), `PUT /progreso`, `PUT /guardado`, `PUT /visto`, `DELETE /historial`.
- Cliente: `lib/biblioteca.js` (helpers HTTP); `Reproductor.jsx` es autosuficiente — dado `fuente.origen/titulo/poster`, reanuda posición, autoguarda cada 10s (+pausa/cierre/beforeunload) y expone marcar-visto, sin que el módulo padre gestione persistencia. `resolverIA`/`resolverTorrentOrigen`/`pareceIdentificadorIA` en `lib/reproductor.js` traducen cualquier `origen` guardado de vuelta a una fuente reproducible. `modules/inicio/Inicio.jsx` es la pantalla de arranque.
```

- [ ] **Step 3: Verificación final completa**

Run: `npm test` (raíz)
Expected: PASS — server (biblioteca + rutas-biblioteca + los tests previos de la Etapa 1) y client (biblioteca + reproductor + engine).

Run: `npm start` y recorrer manualmente: Inicio vacío al primer arranque → reproducir algo en Reproducir → cerrar antes de terminar → Inicio muestra "Continuar viendo" → reanuda → marcar visto manualmente → guardar un resultado en biblioteca → limpiar historial (lo guardado sobrevive).

- [ ] **Step 4: Commit y push**

```bash
git add README.md CLAUDE.md
git commit -m "docs: documentar biblioteca, continuar viendo e Inicio (Etapa 2)"
git push
```
