# Plan de Implementación: Mi Centro de Entretenimiento

> **Estado: ✅ EJECUTADO por completo el 2026-07-17** (14/14 tareas con revisión por subagentes + revisión final de rama). Publicado en https://github.com/fjhr/mi-centro-entretenimiento. Desviaciones respecto a este plan aplicadas en la ejecución: handlers globales 404/error en español en `server/index.js`; validación anti-SSRF de la ruta TMDB y api_key fuera de la clave de caché; mensajes 502 genéricos en español; ratings OMDb consultados con `tituloOriginal`; `npm start` sirve el build de producción desde Express (el dev server queda solo en `npm run dev`); manejo de errores en Ajustes; LICENSE MIT y ajustes de `.gitignore`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App local (Express + React/Vite) de dashboard de entretenimiento en español con 6 módulos que comparten un motor de recomendación, catálogo curado de fuentes gratuitas legales, y datos en vivo de TMDB/OMDb.

**Architecture:** Monorepo npm workspaces con `server/` (Express: proxy con caché a TMDB/OMDb, config y persistencia en JSON) y `client/` (SPA React con 6 módulos + Ajustes, motor de recomendación puro y testeable en `client/src/engine/`). El cliente habla solo con el servidor (`/api/*` vía proxy de Vite); las API keys nunca llegan al navegador.

**Tech Stack:** Node.js ≥18 (fetch nativo), Express 4, React 18, Vite 5, Vitest, Supertest, concurrently.

## Global Constraints

- **Todo en español:** UI, textos generados, comentarios de cara al usuario, README, mensajes de error.
- **Solo fuentes legales.** Torrents únicamente legales (Internet Archive, dominio público, Creative Commons). Sin indexadores de contenido con copyright.
- **Express 4 exacto** (`"express": "^4.19.2"`) — las rutas comodín `/*` con `req.params[0]` no funcionan igual en Express 5.
- **Puertos:** servidor `3001`, cliente Vite `5173`.
- **Región configurable** desde Ajustes; por defecto `MX`. Idioma TMDB: `es-ES` si región es `ES`, si no `es-MX`.
- **Degradación elegante:** sin keys o sin internet la app funciona con el catálogo curado y avisa qué falta (HTTP `503` con `{ error: 'falta-key' }` desde el servidor).
- **Persistencia:** archivos JSON en `server/data/` (gitignored). Caché de APIs en `server/cache/` (gitignored). Sin base de datos. Las keys se guardan en `server/data/config.json` desde la pantalla de Ajustes (no se edita `.env` a mano).
- **Commits frecuentes**, mensajes en español, formato `feat:`/`test:`/`docs:`/`chore:`.

---

### Task 1: Andamiaje del monorepo

**Files:**
- Create: `package.json`, `.gitignore`, `server/package.json`, `client/package.json`

**Interfaces:**
- Produces: workspaces npm `server` y `client`; scripts raíz `npm run dev`, `npm start`, `npm test`.

- [ ] **Step 1: Crear `package.json` raíz**

```json
{
  "name": "mi-centro-entretenimiento",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently -n servidor,cliente -c blue,magenta \"npm run dev -w server\" \"npm run dev -w client\"",
    "start": "npm run dev",
    "test": "npm test -w server && npm test -w client"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

- [ ] **Step 2: Crear `.gitignore`**

```gitignore
node_modules/
server/cache/
server/data/
client/dist/
.env
```

- [ ] **Step 3: Crear `server/package.json`**

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 4: Crear `client/package.json`**

```json
{
  "name": "client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --open",
    "build": "vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 5: Instalar dependencias y verificar**

Run: `npm install`
Expected: termina sin errores y crea `node_modules/` y `package-lock.json`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore server/package.json client/package.json
git commit -m "chore: andamiaje del monorepo con workspaces server y client"
```

---

### Task 2: Servidor — almacenamiento JSON, config y datos del usuario

**Files:**
- Create: `server/lib/almacen.js`, `server/routes/config.js`, `server/routes/datos.js`, `server/index.js`
- Test: `server/test/almacen.test.js`, `server/test/rutas.test.js`

**Interfaces:**
- Produces:
  - `leerJson(nombre: string, porDefecto: any): any` y `guardarJson(nombre: string, valor: any): void` (lib/almacen.js; respetan `process.env.DIR_DATOS`).
  - `obtenerConfig(): { tmdbKey: string, omdbKey: string, region: string }` (lib/almacen.js).
  - `crearApp(): Express` (index.js) con rutas: `GET/PUT /api/config`, `POST /api/config/probar`, `GET/PUT /api/datos/:nombre`.
  - `GET /api/config` responde `{ region, tieneTmdb: boolean, tieneOmdb: boolean }` (nunca expone las keys).

- [ ] **Step 1: Escribir tests que fallan**

`server/test/almacen.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const dirTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'almacen-'));
process.env.DIR_DATOS = dirTemp;

const { leerJson, guardarJson, obtenerConfig } = await import('../lib/almacen.js');

describe('almacen', () => {
  beforeEach(() => {
    for (const f of fs.readdirSync(dirTemp)) fs.rmSync(path.join(dirTemp, f));
  });

  it('devuelve el valor por defecto si el archivo no existe', () => {
    expect(leerJson('no-existe', { a: 1 })).toEqual({ a: 1 });
  });

  it('guarda y lee un JSON', () => {
    guardarJson('prueba', { hola: 'mundo' });
    expect(leerJson('prueba', null)).toEqual({ hola: 'mundo' });
  });

  it('obtenerConfig aplica valores por defecto', () => {
    expect(obtenerConfig()).toEqual({ tmdbKey: '', omdbKey: '', region: 'MX' });
    guardarJson('config', { tmdbKey: 'abc', region: 'ES' });
    expect(obtenerConfig()).toEqual({ tmdbKey: 'abc', omdbKey: '', region: 'ES' });
  });
});
```

`server/test/rutas.test.js`:

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'rutas-'));

const { crearApp } = await import('../index.js');
const app = crearApp();

describe('rutas de config y datos', () => {
  it('GET /api/config no expone las keys', async () => {
    const r = await request(app).get('/api/config');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ region: 'MX', tieneTmdb: false, tieneOmdb: false });
  });

  it('PUT /api/config guarda keys y region', async () => {
    await request(app).put('/api/config').send({ tmdbKey: 'k1', region: 'es' });
    const r = await request(app).get('/api/config');
    expect(r.body).toEqual({ region: 'ES', tieneTmdb: true, tieneOmdb: false });
  });

  it('GET/PUT /api/datos/:nombre persiste JSON arbitrario', async () => {
    const vacio = await request(app).get('/api/datos/plan-semanal');
    expect(vacio.body).toEqual({ valor: null });
    await request(app).put('/api/datos/plan-semanal').send({ dias: [1, 2] });
    const r = await request(app).get('/api/datos/plan-semanal');
    expect(r.body).toEqual({ valor: { dias: [1, 2] } });
  });

  it('rechaza nombres de datos inválidos (path traversal)', async () => {
    const r = await request(app).get('/api/datos/..%2Fconfig');
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -w server`
Expected: FAIL — no existe `../lib/almacen.js` ni `../index.js`.

- [ ] **Step 3: Implementar `server/lib/almacen.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

function dirDatos() {
  return process.env.DIR_DATOS || path.join(aqui, '..', 'data');
}

export function leerJson(nombre, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dirDatos(), `${nombre}.json`), 'utf8'));
  } catch {
    return porDefecto;
  }
}

export function guardarJson(nombre, valor) {
  fs.mkdirSync(dirDatos(), { recursive: true });
  fs.writeFileSync(path.join(dirDatos(), `${nombre}.json`), JSON.stringify(valor, null, 2));
}

const CONFIG_POR_DEFECTO = { tmdbKey: '', omdbKey: '', region: 'MX' };

export function obtenerConfig() {
  return { ...CONFIG_POR_DEFECTO, ...leerJson('config', {}) };
}
```

- [ ] **Step 4: Implementar `server/routes/config.js`**

```js
import { Router } from 'express';
import { obtenerConfig, guardarJson } from '../lib/almacen.js';

const router = Router();

router.get('/', (req, res) => {
  const c = obtenerConfig();
  res.json({ region: c.region, tieneTmdb: Boolean(c.tmdbKey), tieneOmdb: Boolean(c.omdbKey) });
});

router.put('/', (req, res) => {
  const actual = obtenerConfig();
  const { tmdbKey, omdbKey, region } = req.body || {};
  if (typeof tmdbKey === 'string' && tmdbKey.trim()) actual.tmdbKey = tmdbKey.trim();
  if (typeof omdbKey === 'string' && omdbKey.trim()) actual.omdbKey = omdbKey.trim();
  if (typeof region === 'string' && region.trim()) actual.region = region.trim().toUpperCase();
  guardarJson('config', actual);
  res.json({ ok: true });
});

router.post('/probar', async (req, res) => {
  const c = obtenerConfig();
  const resultado = { tmdb: false, omdb: false };
  try {
    const r = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${c.tmdbKey}`);
    resultado.tmdb = r.ok;
  } catch { /* sin internet: queda en false */ }
  try {
    const r = await fetch(`https://www.omdbapi.com/?apikey=${c.omdbKey}&i=tt0111161`);
    resultado.omdb = (await r.json()).Response === 'True';
  } catch { /* sin internet: queda en false */ }
  res.json(resultado);
});

export default router;
```

- [ ] **Step 5: Implementar `server/routes/datos.js`**

```js
import { Router } from 'express';
import { leerJson, guardarJson } from '../lib/almacen.js';

const router = Router();
const NOMBRE_VALIDO = /^[a-z0-9-]+$/;

router.get('/:nombre', (req, res) => {
  if (!NOMBRE_VALIDO.test(req.params.nombre)) return res.status(400).json({ error: 'nombre-invalido' });
  res.json({ valor: leerJson(`datos-${req.params.nombre}`, null) });
});

router.put('/:nombre', (req, res) => {
  if (!NOMBRE_VALIDO.test(req.params.nombre)) return res.status(400).json({ error: 'nombre-invalido' });
  guardarJson(`datos-${req.params.nombre}`, req.body);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 6: Implementar `server/index.js`**

```js
import express from 'express';
import configRouter from './routes/config.js';
import datosRouter from './routes/datos.js';

export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/config', configRouter);
  app.use('/api/datos', datosRouter);
  return app;
}

const PUERTO = process.env.PUERTO || 3001;
if (process.env.NODE_ENV !== 'test') {
  crearApp().listen(PUERTO, () => {
    console.log(`Servidor de Mi Centro de Entretenimiento en http://localhost:${PUERTO}`);
  });
}
```

- [ ] **Step 7: Verificar que pasan**

Run: `npm test -w server`
Expected: PASS (7 tests).

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "feat: servidor base con config, datos persistentes y tests"
```

---

### Task 3: Servidor — caché en disco y proxys TMDB/OMDb

**Files:**
- Create: `server/lib/cache.js`, `server/routes/tmdb.js`, `server/routes/omdb.js`
- Modify: `server/index.js` (montar rutas nuevas)
- Test: `server/test/cache.test.js`

**Interfaces:**
- Consumes: `obtenerConfig()` de Task 2.
- Produces:
  - `conCache(clave: string, ttlMs: number, obtener: () => Promise<any>): Promise<{ valor: any, deCache: boolean, fecha: string }>` — si `obtener` falla y hay caché vencida, la devuelve como respaldo (`deCache: true`).
  - `GET /api/tmdb/<ruta-tmdb>?<query>` — proxy a `https://api.themoviedb.org/3/<ruta>` con `api_key` y `language` inyectados; caché 12 h; `503 { error: 'falta-key' }` sin key; `502 { error: 'tmdb' }` si falla.
  - `GET /api/omdb?i=<imdbId>` o `?t=<titulo>&y=<año>` — responde `{ imdb: string|null, rottenTomatoes: string|null, titulo: string|null, fecha: string }`; caché 7 días.

- [ ] **Step 1: Escribir test que falla — `server/test/cache.test.js`**

```js
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-'));

const { conCache } = await import('../lib/cache.js');

describe('conCache', () => {
  it('llama a obtener la primera vez y usa caché la segunda', async () => {
    let llamadas = 0;
    const obtener = async () => { llamadas++; return { n: llamadas }; };
    const a = await conCache('clave-a', 60_000, obtener);
    const b = await conCache('clave-a', 60_000, obtener);
    expect(a).toMatchObject({ valor: { n: 1 }, deCache: false });
    expect(b).toMatchObject({ valor: { n: 1 }, deCache: true });
    expect(llamadas).toBe(1);
  });

  it('con TTL vencido vuelve a llamar a obtener', async () => {
    let llamadas = 0;
    const obtener = async () => { llamadas++; return llamadas; };
    await conCache('clave-b', -1, obtener);
    await conCache('clave-b', -1, obtener);
    expect(llamadas).toBe(2);
  });

  it('si obtener falla, devuelve la caché vencida como respaldo', async () => {
    await conCache('clave-c', -1, async () => 'viejo');
    const r = await conCache('clave-c', -1, async () => { throw new Error('sin internet'); });
    expect(r).toMatchObject({ valor: 'viejo', deCache: true });
  });

  it('si obtener falla y no hay caché, propaga el error', async () => {
    await expect(conCache('clave-d', 60_000, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -w server`
Expected: FAIL — no existe `../lib/cache.js`.

- [ ] **Step 3: Implementar `server/lib/cache.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

function rutaDe(clave) {
  const dir = process.env.DIR_CACHE || path.join(aqui, '..', 'cache');
  const hash = crypto.createHash('md5').update(clave).digest('hex');
  return { dir, ruta: path.join(dir, `${hash}.json`) };
}

function leerEntrada(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}

export async function conCache(clave, ttlMs, obtener) {
  const { dir, ruta } = rutaDe(clave);
  const entrada = leerEntrada(ruta);
  if (entrada && Date.now() < entrada.exp) {
    return { valor: entrada.valor, deCache: true, fecha: entrada.fecha };
  }
  try {
    const valor = await obtener();
    const fecha = new Date().toISOString();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify({ exp: Date.now() + ttlMs, fecha, valor }));
    return { valor, deCache: false, fecha };
  } catch (error) {
    if (entrada) return { valor: entrada.valor, deCache: true, fecha: entrada.fecha };
    throw error;
  }
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -w server`
Expected: PASS.

- [ ] **Step 5: Implementar `server/routes/tmdb.js`**

```js
import { Router } from 'express';
import { obtenerConfig } from '../lib/almacen.js';
import { conCache } from '../lib/cache.js';

const router = Router();
const DOCE_HORAS = 12 * 60 * 60 * 1000;

router.get('/*', async (req, res) => {
  const c = obtenerConfig();
  if (!c.tmdbKey) {
    return res.status(503).json({ error: 'falta-key', mensaje: 'Configura tu API key de TMDB en Ajustes.' });
  }
  const params = new URLSearchParams(req.query);
  params.set('api_key', c.tmdbKey);
  if (!params.has('language')) params.set('language', c.region === 'ES' ? 'es-ES' : 'es-MX');
  const url = `https://api.themoviedb.org/3/${req.params[0]}?${params}`;
  try {
    const { valor } = await conCache(url, DOCE_HORAS, async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`TMDB respondió ${r.status}`);
      return r.json();
    });
    res.json(valor);
  } catch (error) {
    res.status(502).json({ error: 'tmdb', mensaje: error.message });
  }
});

export default router;
```

- [ ] **Step 6: Implementar `server/routes/omdb.js`**

```js
import { Router } from 'express';
import { obtenerConfig } from '../lib/almacen.js';
import { conCache } from '../lib/cache.js';

const router = Router();
const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

router.get('/', async (req, res) => {
  const c = obtenerConfig();
  if (!c.omdbKey) {
    return res.status(503).json({ error: 'falta-key', mensaje: 'Configura tu API key de OMDb en Ajustes.' });
  }
  const params = new URLSearchParams();
  for (const nombre of ['i', 't', 'y']) {
    if (req.query[nombre]) params.set(nombre, req.query[nombre]);
  }
  if (!params.has('i') && !params.has('t')) {
    return res.status(400).json({ error: 'parametros', mensaje: 'Se requiere i (imdbId) o t (título).' });
  }
  const clave = `omdb:${params.toString()}`;
  params.set('apikey', c.omdbKey);
  try {
    const { valor, fecha } = await conCache(clave, SIETE_DIAS, async () => {
      const r = await fetch(`https://www.omdbapi.com/?${params}`);
      const j = await r.json();
      if (j.Response !== 'True') throw new Error(j.Error || 'OMDb sin resultado');
      return j;
    });
    const rt = valor.Ratings?.find((x) => x.Source === 'Rotten Tomatoes')?.Value ?? null;
    res.json({
      imdb: valor.imdbRating && valor.imdbRating !== 'N/A' ? valor.imdbRating : null,
      rottenTomatoes: rt,
      titulo: valor.Title ?? null,
      fecha,
    });
  } catch (error) {
    res.status(502).json({ error: 'omdb', mensaje: error.message });
  }
});

export default router;
```

- [ ] **Step 7: Montar rutas en `server/index.js`**

En `server/index.js`, agregar los imports y `app.use` (el archivo completo queda así):

```js
import express from 'express';
import configRouter from './routes/config.js';
import datosRouter from './routes/datos.js';
import tmdbRouter from './routes/tmdb.js';
import omdbRouter from './routes/omdb.js';

export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/config', configRouter);
  app.use('/api/datos', datosRouter);
  app.use('/api/tmdb', tmdbRouter);
  app.use('/api/omdb', omdbRouter);
  return app;
}

const PUERTO = process.env.PUERTO || 3001;
if (process.env.NODE_ENV !== 'test') {
  crearApp().listen(PUERTO, () => {
    console.log(`Servidor de Mi Centro de Entretenimiento en http://localhost:${PUERTO}`);
  });
}
```

- [ ] **Step 8: Verificación manual del modo degradado**

Run: `npm run dev -w server` (dejarlo corriendo) y en otra terminal `curl http://localhost:3001/api/tmdb/discover/movie`
Expected: `{"error":"falta-key","mensaje":"Configura tu API key de TMDB en Ajustes."}` con status 503. Detener el servidor.

- [ ] **Step 9: Correr todos los tests y commit**

Run: `npm test -w server`
Expected: PASS.

```bash
git add server
git commit -m "feat: cache en disco y proxys TMDB/OMDb con degradacion elegante"
```

---

### Task 4: Catálogo curado — fuentes y contenido

**Files:**
- Create: `client/src/catalog/fuentes.json`, `client/src/catalog/contenido.json`

**Interfaces:**
- Produces:
  - `fuentes.json`: array de plataformas `{ nombre, url, categoria, mejorPara, registro: boolean, regiones: string[] | "*", anuncios: boolean, consejoPremium }`. Categorías válidas: `peliculas, series, musica, podcasts, anime, libros, juegos, documentales, aprendizaje, torrents-legales`.
  - `contenido.json`: array de ítems recomendables `{ id, titulo, categoria, url, dondeVer, duracionMin, etiquetas: string[], energia: "baja"|"media"|"alta", compania: string[], aprenderas?, descripcion }`. Categorías válidas: `video, podcast, juego, aprendizaje, documental`. Valores de `compania`: `solo, pareja, familia, amigos`. Etiquetas de interés usadas por la UI: `negocios, ia, tecnologia, ciencia, historia, idiomas, psicologia, cultura, humor, musica`.

- [ ] **Step 1: Crear `client/src/catalog/fuentes.json`**

Crear el archivo con este contenido completo (catálogo curado legal, en español):

```json
[
  { "nombre": "Tubi", "url": "https://tubitv.com", "categoria": "peliculas", "mejorPara": "Catálogo enorme de películas de Hollywood gratis con anuncios", "registro": false, "regiones": ["MX", "US", "CO", "PE", "EC", "SV", "CR", "GT", "PA"], "anuncios": true, "consejoPremium": "Crea cuenta gratis para guardar tu lista y continuar viendo donde te quedaste." },
  { "nombre": "Pluto TV", "url": "https://pluto.tv", "categoria": "peliculas", "mejorPara": "Canales lineales estilo TV de paga + películas bajo demanda", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Usa la sección 'On Demand', no solo los canales: ahí está el catálogo completo." },
  { "nombre": "ViX", "url": "https://vix.com", "categoria": "peliculas", "mejorPara": "Cine mexicano y latino, novelas y fútbol gratis", "registro": false, "regiones": ["MX", "US", "CO", "AR", "PE", "CL"], "anuncios": true, "consejoPremium": "El plan gratis incluye miles de horas; entra desde la app de TV para mejor experiencia." },
  { "nombre": "Plex (gratis)", "url": "https://watch.plex.tv", "categoria": "peliculas", "mejorPara": "Películas y TV gratis con apariencia de servicio premium", "registro": true, "regiones": "*", "anuncios": true, "consejoPremium": "Además de su catálogo gratis, puedes montar tu propio servidor con tus archivos personales." },
  { "nombre": "YouTube Películas gratis", "url": "https://www.youtube.com/feed/storefront", "categoria": "peliculas", "mejorPara": "Películas oficiales gratis con anuncios y canales de estudios", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Busca 'película completa en español' + filtra por canal verificado para evitar copias ilegales." },
  { "nombre": "Internet Archive — Cine", "url": "https://archive.org/details/feature_films", "categoria": "peliculas", "mejorPara": "Cine clásico y de dominio público (cine negro, terror clásico, serie B)", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Explora las colecciones 'Film Noir' y 'Sci-Fi/Horror'; todo es descargable legalmente." },
  { "nombre": "RTVE Play", "url": "https://www.rtve.es/play/", "categoria": "peliculas", "mejorPara": "Cine español, series y documentales de la TV pública española", "registro": false, "regiones": ["ES", "*"], "anuncios": false, "consejoPremium": "Gran parte del catálogo funciona fuera de España; el cine español clásico es oro." },
  { "nombre": "Canela.TV", "url": "https://canela.tv", "categoria": "series", "mejorPara": "Series y novelas latinas gratis", "registro": false, "regiones": ["MX", "US", "CO", "AR"], "anuncios": true, "consejoPremium": "Tiene canales en vivo de noticias y deportes latinos que sustituyen la TV abierta." },
  { "nombre": "Pluto TV Series", "url": "https://pluto.tv", "categoria": "series", "mejorPara": "Maratones de series completas en canales 24/7 (CSI, Ley y Orden, etc.)", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Los canales de una sola serie son perfectos para dejar de fondo como TV clásica." },
  { "nombre": "Tubi Series", "url": "https://tubitv.com/category/tv_shows", "categoria": "series", "mejorPara": "Temporadas completas de series de estudios grandes", "registro": false, "regiones": ["MX", "US", "CO", "PE"], "anuncios": true, "consejoPremium": "Revisa la sección 'Leaving soon' cada mes para ver antes de que se vayan." },
  { "nombre": "Spotify (gratis)", "url": "https://open.spotify.com", "categoria": "musica", "mejorPara": "Streaming de música completo con anuncios", "registro": true, "regiones": "*", "anuncios": true, "consejoPremium": "En escritorio el plan gratis permite elegir canciones exactas (no solo aleatorio como en móvil)." },
  { "nombre": "YouTube Music", "url": "https://music.youtube.com", "categoria": "musica", "mejorPara": "Conciertos, remixes, covers y rarezas que no están en Spotify", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Busca 'live session' o 'tiny desk' de tus artistas: material exclusivo gratis." },
  { "nombre": "Radio Garden", "url": "https://radio.garden", "categoria": "musica", "mejorPara": "Radios en vivo de todo el mundo en un globo interactivo", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Gira el globo a Japón, Islandia o Brasil para descubrir música que ningún algoritmo te daría." },
  { "nombre": "Jamendo", "url": "https://www.jamendo.com", "categoria": "musica", "mejorPara": "Música libre (Creative Commons) descargable legal", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Ideal para música de fondo para videos o proyectos sin problemas de copyright." },
  { "nombre": "SoundCloud", "url": "https://soundcloud.com", "categoria": "musica", "mejorPara": "Artistas emergentes, DJ sets y podcasts musicales", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Sigue las etiquetas de géneros nicho; ahí nacen los artistas antes de llegar a Spotify." },
  { "nombre": "Pocket Casts (web)", "url": "https://pocketcasts.com", "categoria": "podcasts", "mejorPara": "Gestor de podcasts limpio y gratuito con sincronización", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Usa las velocidades 1.2x-1.5x y el recorte de silencios: escucharás 30% más en el mismo tiempo." },
  { "nombre": "iVoox", "url": "https://www.ivoox.com", "categoria": "podcasts", "mejorPara": "El mayor catálogo de podcasts en español", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Las listas curadas por usuarios son la mejor forma de descubrir joyas en español." },
  { "nombre": "Spotify Podcasts", "url": "https://open.spotify.com/genre/podcasts-web", "categoria": "podcasts", "mejorPara": "Podcasts exclusivos y videopodcasts", "registro": true, "regiones": "*", "anuncios": true, "consejoPremium": "Activa las transcripciones para 'leer' episodios cuando no puedas escuchar." },
  { "nombre": "Crunchyroll (gratis)", "url": "https://www.crunchyroll.com", "categoria": "anime", "mejorPara": "Anime de temporada legal con anuncios (catálogo parcial gratis)", "registro": true, "regiones": "*", "anuncios": true, "consejoPremium": "El primer episodio de casi todo es gratis: úsalo para decidir qué serie vale la pena." },
  { "nombre": "RetroCrush", "url": "https://www.retrocrush.tv", "categoria": "anime", "mejorPara": "Anime clásico de los 80s y 90s gratis", "registro": false, "regiones": ["MX", "US", "*"], "anuncios": true, "consejoPremium": "Perfecto para ver los clásicos que todos citan y nunca viste completos." },
  { "nombre": "AnimeOnegai", "url": "https://www.animeonegai.com", "categoria": "anime", "mejorPara": "Anime con doblaje latino, plan gratuito con anuncios", "registro": true, "regiones": ["MX", "CO", "AR", "PE", "CL"], "anuncios": true, "consejoPremium": "Especialistas en doblaje latino de series que nadie más trae legalmente." },
  { "nombre": "Pluto TV Anime", "url": "https://pluto.tv", "categoria": "anime", "mejorPara": "Canales 24/7 de anime doblado (Naruto, caballeros del zodiaco, etc.)", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Ideal como 'canal de fondo'; para elegir episodio usa la sección bajo demanda." },
  { "nombre": "Proyecto Gutenberg", "url": "https://www.gutenberg.org", "categoria": "libros", "mejorPara": "70,000+ libros clásicos de dominio público en varios formatos", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Descarga en EPUB y envíalos a tu Kindle o app de lectura; hay sección en español." },
  { "nombre": "Open Library", "url": "https://openlibrary.org", "categoria": "libros", "mejorPara": "Préstamo digital gratuito de millones de libros (como biblioteca)", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Funciona como biblioteca real: pides prestado el libro digital por 14 días, gratis." },
  { "nombre": "Elejandría", "url": "https://www.elejandria.com", "categoria": "libros", "mejorPara": "Libros de dominio público en español, descarga directa", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Colecciones por autor: toda la obra de Galdós, Cervantes o Quiroga en un clic." },
  { "nombre": "Wikisource en español", "url": "https://es.wikisource.org", "categoria": "libros", "mejorPara": "Textos históricos, poesía y documentos en español verificados", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "La mejor fuente para poesía hispanoamericana completa y bien transcrita." },
  { "nombre": "Epic Games Store", "url": "https://store.epicgames.com/es-ES/free-games", "categoria": "juegos", "mejorPara": "1-2 juegos comerciales GRATIS cada semana (te los quedas para siempre)", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Reclama el juego gratis CADA semana aunque no lo juegues: en un año tienes biblioteca de +50 juegos." },
  { "nombre": "itch.io", "url": "https://itch.io/games/free", "categoria": "juegos", "mejorPara": "Miles de juegos indie gratis y experimentales", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Filtra por 'top rated' + gratis: hay joyas indie mejores que juegos de paga." },
  { "nombre": "Steam (free to play)", "url": "https://store.steampowered.com/genre/Free%20to%20Play/", "categoria": "juegos", "mejorPara": "F2P grandes: Dota 2, CS2, Path of Exile, Warframe", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Revisa también los 'fines de semana gratis' de juegos de paga." },
  { "nombre": "GOG (gratis)", "url": "https://www.gog.com/es/games?priceRange=0,0", "categoria": "juegos", "mejorPara": "Clásicos de PC gratis sin DRM", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Los regalos por temporada (navidad, aniversario) son juegos completos sin DRM." },
  { "nombre": "Internet Archive — MS-DOS", "url": "https://archive.org/details/softwarelibrary_msdos_games", "categoria": "juegos", "mejorPara": "2,500+ juegos retro jugables en el navegador", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Corren en el navegador sin instalar nada: nostalgia instantánea legal." },
  { "nombre": "DW Documental", "url": "https://www.youtube.com/@DWDocumental", "categoria": "documentales", "mejorPara": "Documentales alemanes de alta calidad doblados al español", "registro": false, "regiones": "*", "anuncios": true, "consejoPremium": "Suben varios por semana; sus documentales de economía y geopolítica rivalizan con Netflix." },
  { "nombre": "TED en Español", "url": "https://www.ted.com/talks?language=es", "categoria": "documentales", "mejorPara": "Charlas de expertos de 10-18 minutos con subtítulos", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Usa las 'playlists' temáticas: mini-cursos gratuitos de cualquier tema." },
  { "nombre": "Tubi Documentales", "url": "https://tubitv.com/category/documentary", "categoria": "documentales", "mejorPara": "Documentales comerciales completos (true crime, música, deportes)", "registro": false, "regiones": ["MX", "US", "CO"], "anuncios": true, "consejoPremium": "Su sección de true crime es de las más grandes gratis." },
  { "nombre": "Internet Archive — Documentales", "url": "https://archive.org/details/documentaries", "categoria": "documentales", "mejorPara": "Documentales históricos y de archivo", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "El material de archivo histórico (guerras, NASA) es único e imposible de ver en otro lado." },
  { "nombre": "Khan Academy", "url": "https://es.khanacademy.org", "categoria": "aprendizaje", "mejorPara": "Cursos estructurados de mates, ciencia, economía y programación", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Totalmente gratis y en español; el sistema de práctica con puntos sustituye apps de pago." },
  { "nombre": "freeCodeCamp en Español", "url": "https://www.freecodecamp.org/espanol/", "categoria": "aprendizaje", "mejorPara": "Aprender a programar gratis con certificaciones", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Sus certificaciones de 300 horas son reconocidas y 100% gratuitas." },
  { "nombre": "Coursera (modo oyente)", "url": "https://www.coursera.org", "categoria": "aprendizaje", "mejorPara": "Cursos universitarios reales gratis en 'modo auditar'", "registro": true, "regiones": "*", "anuncios": false, "consejoPremium": "Al inscribirte busca el enlace pequeño 'Auditar curso': todo el contenido gratis, sin certificado." },
  { "nombre": "MIT OpenCourseWare", "url": "https://ocw.mit.edu", "categoria": "aprendizaje", "mejorPara": "Cursos completos del MIT con notas, tareas y exámenes", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "El curso 6.0001 de Python es el curso de introducción a programar más famoso del mundo, gratis." },
  { "nombre": "Duolingo", "url": "https://www.duolingo.com", "categoria": "aprendizaje", "mejorPara": "Idiomas gamificados 10-15 min al día", "registro": true, "regiones": "*", "anuncios": true, "consejoPremium": "Combínalo con podcasts del idioma que aprendes para acelerar 3x la comprensión." },
  { "nombre": "Internet Archive — Torrents", "url": "https://archive.org/help/archive-bittorrent-faq.php", "categoria": "torrents-legales", "mejorPara": "Descargar TODO el catálogo de Internet Archive vía torrent legal", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Cada ítem de archive.org tiene un archivo .torrent oficial: descargas rápidas y 100% legales." },
  { "nombre": "Public Domain Torrents", "url": "http://www.publicdomaintorrents.info", "categoria": "torrents-legales", "mejorPara": "Cine clásico de dominio público vía torrent", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Películas de Hitchcock, cine mudo y serie B clásica listas para cualquier cliente torrent." },
  { "nombre": "Academic Torrents", "url": "https://academictorrents.com", "categoria": "torrents-legales", "mejorPara": "Datasets, papers y cursos académicos vía torrent", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Datasets de IA de terabytes que serían imposibles de bajar por HTTP." },
  { "nombre": "Distros Linux (torrents oficiales)", "url": "https://ubuntu.com/download/alternative-downloads", "categoria": "torrents-legales", "mejorPara": "Descargar sistemas operativos libres de forma eficiente", "registro": false, "regiones": "*", "anuncios": false, "consejoPremium": "Deja el torrent sembrando: es la forma clásica de contribuir al software libre." }
]
```

- [ ] **Step 2: Crear `client/src/catalog/contenido.json`**

Crear el archivo con este contenido completo:

```json
[
  { "id": "pod-entiende-tu-mente", "titulo": "Entiende Tu Mente", "categoria": "podcast", "url": "https://open.spotify.com/show/0uEsPQVSXFtcYVAn5J9BvW", "dondeVer": "Spotify / iVoox", "duracionMin": 20, "etiquetas": ["psicologia"], "energia": "baja", "compania": ["solo", "pareja"], "descripcion": "Psicología en 20 minutos, uno de los podcasts en español más escuchados del mundo." },
  { "id": "pod-ted-espanol", "titulo": "TED en Español (podcast)", "categoria": "podcast", "url": "https://www.ted.com/podcasts/ted-en-espanol", "dondeVer": "TED / Spotify", "duracionMin": 25, "etiquetas": ["ciencia", "cultura", "tecnologia"], "energia": "media", "compania": ["solo"], "descripcion": "Ideas que valen la pena, en español y en formato corto." },
  { "id": "pod-cracks", "titulo": "Cracks Podcast", "categoria": "podcast", "url": "https://crackspodcast.com", "dondeVer": "Spotify / YouTube", "duracionMin": 60, "etiquetas": ["negocios", "psicologia"], "energia": "media", "compania": ["solo"], "descripcion": "Entrevistas de alto rendimiento y negocios con invitados de primer nivel en español." },
  { "id": "pod-diana-uribe", "titulo": "DianaUribe.fm", "categoria": "podcast", "url": "https://www.dianauribe.fm", "dondeVer": "Spotify / iVoox", "duracionMin": 45, "etiquetas": ["historia", "cultura"], "energia": "baja", "compania": ["solo", "pareja", "familia"], "descripcion": "La mejor narradora de historia en español; cada episodio es una clase magistral." },
  { "id": "pod-radio-ambulante", "titulo": "Radio Ambulante", "categoria": "podcast", "url": "https://radioambulante.org", "dondeVer": "NPR / Spotify", "duracionMin": 35, "etiquetas": ["cultura", "historia"], "energia": "baja", "compania": ["solo", "pareja"], "descripcion": "Crónicas latinoamericanas narradas como cine para los oídos." },
  { "id": "pod-el-hilo", "titulo": "El hilo", "categoria": "podcast", "url": "https://elhilo.audio", "dondeVer": "Spotify / web", "duracionMin": 30, "etiquetas": ["cultura", "historia"], "energia": "media", "compania": ["solo"], "descripcion": "El contexto detrás de la noticia más importante de la semana en América Latina." },
  { "id": "vid-quantumfracture", "titulo": "QuantumFracture", "categoria": "video", "url": "https://www.youtube.com/@QuantumFracture", "dondeVer": "YouTube", "duracionMin": 15, "etiquetas": ["ciencia"], "energia": "media", "compania": ["solo", "familia"], "descripcion": "Física cuántica y ciencia con animaciones brillantes, en español." },
  { "id": "vid-date-un-vlog", "titulo": "Date un Vlog", "categoria": "video", "url": "https://www.youtube.com/@DateunVlog", "dondeVer": "YouTube", "duracionMin": 25, "etiquetas": ["ciencia", "psicologia"], "energia": "media", "compania": ["solo"], "descripcion": "Ciencia profunda con humor: los videos de matemáticas y física más vistos en español." },
  { "id": "vid-cdeciencia", "titulo": "CdeCiencia", "categoria": "video", "url": "https://www.youtube.com/@CdeCiencia", "dondeVer": "YouTube", "duracionMin": 20, "etiquetas": ["ciencia"], "energia": "media", "compania": ["solo", "familia"], "descripcion": "Misterios del universo y la Tierra contados con rigor y asombro." },
  { "id": "vid-dot-csv", "titulo": "Dot CSV", "categoria": "video", "url": "https://www.youtube.com/@DotCSV", "dondeVer": "YouTube", "duracionMin": 20, "etiquetas": ["ia", "tecnologia"], "energia": "alta", "compania": ["solo"], "descripcion": "El canal de referencia de inteligencia artificial en español." },
  { "id": "vid-visualpolitik", "titulo": "VisualPolitik", "categoria": "video", "url": "https://www.youtube.com/@VisualPolitik", "dondeVer": "YouTube", "duracionMin": 15, "etiquetas": ["negocios", "historia", "cultura"], "energia": "media", "compania": ["solo"], "descripcion": "Geopolítica y economía mundial explicadas de forma entretenida." },
  { "id": "vid-luisito-comunica", "titulo": "Luisito Comunica", "categoria": "video", "url": "https://www.youtube.com/@LuisitoComunica", "dondeVer": "YouTube", "duracionMin": 20, "etiquetas": ["cultura", "humor"], "energia": "alta", "compania": ["solo", "amigos", "familia"], "descripcion": "Viajes por el mundo con el youtuber más grande de habla hispana." },
  { "id": "jue-epic-semanal", "titulo": "Juego gratis de la semana (Epic)", "categoria": "juego", "url": "https://store.epicgames.com/es-ES/free-games", "dondeVer": "Epic Games Store", "duracionMin": 120, "etiquetas": ["tecnologia"], "energia": "alta", "compania": ["solo", "amigos"], "descripcion": "Cada jueves hay 1-2 juegos comerciales gratis para siempre: revisa y reclama." },
  { "id": "jue-rocket-league", "titulo": "Rocket League", "categoria": "juego", "url": "https://www.rocketleague.com", "dondeVer": "Epic / consolas (F2P)", "duracionMin": 30, "etiquetas": ["humor"], "energia": "alta", "compania": ["amigos", "solo"], "descripcion": "Fútbol con coches: partidas de 5 minutos, diversión inmediata con amigos." },
  { "id": "jue-fall-guys", "titulo": "Fall Guys", "categoria": "juego", "url": "https://www.fallguys.com", "dondeVer": "Epic / consolas (F2P)", "duracionMin": 30, "etiquetas": ["humor"], "energia": "alta", "compania": ["amigos", "familia"], "descripcion": "Carreras de obstáculos caóticas: risas garantizadas en grupo." },
  { "id": "jue-brawlhalla", "titulo": "Brawlhalla", "categoria": "juego", "url": "https://www.brawlhalla.com", "dondeVer": "Steam / consolas (F2P)", "duracionMin": 30, "etiquetas": ["humor"], "energia": "alta", "compania": ["amigos"], "descripcion": "Smash Bros gratuito multiplataforma, perfecto para tardes con amigos." },
  { "id": "jue-msdos-retro", "titulo": "Clásicos MS-DOS en el navegador", "categoria": "juego", "url": "https://archive.org/details/softwarelibrary_msdos_games", "dondeVer": "Internet Archive", "duracionMin": 45, "etiquetas": ["historia", "tecnologia"], "energia": "media", "compania": ["solo", "familia"], "descripcion": "Prince of Persia, SimCity y 2,500 clásicos jugables sin instalar nada." },
  { "id": "apr-cs50", "titulo": "CS50: Introducción a la Computación (Harvard)", "categoria": "aprendizaje", "url": "https://cs50.harvard.edu/x/", "dondeVer": "edX / YouTube (subtítulos en español)", "duracionMin": 45, "etiquetas": ["tecnologia", "ia"], "energia": "alta", "compania": ["solo"], "aprenderas": "Fundamentos reales de programación con el curso más famoso de Harvard", "descripcion": "El mejor curso de introducción a la computación del mundo, gratis." },
  { "id": "apr-ia-google", "titulo": "Google: Elementos de IA / Machine Learning Crash Course", "categoria": "aprendizaje", "url": "https://developers.google.com/machine-learning/crash-course?hl=es-419", "dondeVer": "Google Developers (español)", "duracionMin": 40, "etiquetas": ["ia", "tecnologia"], "energia": "alta", "compania": ["solo"], "aprenderas": "Cómo funciona el machine learning con ejercicios prácticos", "descripcion": "El curso interno de Google para aprender ML, traducido al español." },
  { "id": "apr-khan-finanzas", "titulo": "Khan Academy: Finanzas personales", "categoria": "aprendizaje", "url": "https://es.khanacademy.org/college-careers-more/personal-finance", "dondeVer": "Khan Academy (español)", "duracionMin": 30, "etiquetas": ["negocios"], "energia": "media", "compania": ["solo", "pareja"], "aprenderas": "Presupuesto, inversión, deuda e impuestos explicados desde cero", "descripcion": "Módulos cortos de finanzas personales que deberían enseñar en la escuela." },
  { "id": "apr-fcc-javascript", "titulo": "freeCodeCamp: JavaScript desde cero", "categoria": "aprendizaje", "url": "https://www.freecodecamp.org/espanol/learn/javascript-algorithms-and-data-structures/", "dondeVer": "freeCodeCamp (español)", "duracionMin": 40, "etiquetas": ["tecnologia"], "energia": "alta", "compania": ["solo"], "aprenderas": "Programar en JavaScript con ejercicios interactivos y certificación gratis", "descripcion": "Certificación completa de 300 horas dividida en lecciones de minutos." },
  { "id": "apr-duolingo-sesion", "titulo": "Sesión de idiomas (Duolingo + podcast)", "categoria": "aprendizaje", "url": "https://www.duolingo.com", "dondeVer": "Duolingo", "duracionMin": 20, "etiquetas": ["idiomas"], "energia": "media", "compania": ["solo"], "aprenderas": "Vocabulario y comprensión del idioma que estés aprendiendo", "descripcion": "15 min de lecciones + 5 min del Duolingo Podcast del idioma." },
  { "id": "apr-mit-python", "titulo": "MIT 6.0001: Python", "categoria": "aprendizaje", "url": "https://ocw.mit.edu/courses/6-0001-introduction-to-computer-science-and-programming-in-python-fall-2016/", "dondeVer": "MIT OCW / YouTube", "duracionMin": 45, "etiquetas": ["tecnologia", "ia"], "energia": "alta", "compania": ["solo"], "aprenderas": "Python y pensamiento computacional con clases reales del MIT", "descripcion": "Las clases grabadas del MIT con notas y tareas, gratis y a tu ritmo." },
  { "id": "doc-dw-economia", "titulo": "DW Documental: economía y poder", "categoria": "documental", "url": "https://www.youtube.com/@DWDocumental/videos", "dondeVer": "YouTube (DW Documental)", "duracionMin": 42, "etiquetas": ["negocios", "historia"], "energia": "media", "compania": ["solo", "pareja"], "descripcion": "Documentales alemanes doblados al español sobre economía global y geopolítica." },
  { "id": "doc-ted-playlist-ia", "titulo": "TED: playlist sobre Inteligencia Artificial", "categoria": "documental", "url": "https://www.ted.com/playlists/310/talks_on_artificial_intelligen", "dondeVer": "TED.com (subtítulos en español)", "duracionMin": 45, "etiquetas": ["ia", "tecnologia"], "energia": "media", "compania": ["solo"], "descripcion": "Varias charlas cortas que juntas forman un documental sobre el futuro de la IA." },
  { "id": "doc-archive-nasa", "titulo": "Archivo histórico de la NASA", "categoria": "documental", "url": "https://archive.org/details/nasa", "dondeVer": "Internet Archive", "duracionMin": 30, "etiquetas": ["ciencia", "historia"], "energia": "baja", "compania": ["solo", "familia"], "descripcion": "Material original de las misiones Apollo y la carrera espacial." },
  { "id": "doc-rtve-documentales", "titulo": "Documentales RTVE (Documaster)", "categoria": "documental", "url": "https://www.rtve.es/play/videos/documenta2/", "dondeVer": "RTVE Play", "duracionMin": 50, "etiquetas": ["historia", "ciencia", "cultura"], "energia": "baja", "compania": ["solo", "pareja", "familia"], "descripcion": "Documentales de la BBC y europeos doblados al español en la TV pública." }
]
```

- [ ] **Step 3: Validar que ambos JSON parsean**

Run: `node -e "const f=require('./client/src/catalog/fuentes.json'), c=require('./client/src/catalog/contenido.json'); console.log('fuentes:', f.length, 'contenido:', c.length)"`
Expected: `fuentes: 44 contenido: 27` (o los conteos reales; lo importante es que parsea sin error).

- [ ] **Step 4: Commit**

```bash
git add client/src/catalog
git commit -m "feat: catalogo curado de fuentes gratuitas legales y contenido recomendable"
```

---

### Task 5: Motor de recomendación — moods y puntuación

**Files:**
- Create: `client/src/engine/moods.js`, `client/src/engine/recomendar.js`
- Test: `client/src/engine/recomendar.test.js`

**Interfaces:**
- Produces:
  - `MOODS: Record<string, { nombre: string, emoji: string, generos: number[], antesDe?: number }>` con claves: `risa, tension, lagrimas, mente-volada, nostalgia, accion, romance, terror, documental` (moods.js; `generos` son IDs de género de TMDB).
  - `puntuar(item, criterios): number` y `recomendar(items, criterios, limite = 10): Array<item & { puntaje: number }>` (recomendar.js).
  - Forma de `item`: `{ id, titulo, generos?: number[], anio?: number, rating?: number, duracionMin?: number, etiquetas?: string[], energia?: string, compania?: string[], categoria?: string }`.
  - Forma de `criterios`: `{ mood?, tiempoMin?, energia?, compania?, intereses?: string[], vistos?: string[] }`.

- [ ] **Step 1: Crear `client/src/engine/moods.js`**

```js
// IDs de género oficiales de TMDB.
export const MOODS = {
  risa: { nombre: 'Risa', emoji: '😂', generos: [35] },
  tension: { nombre: 'Tensión', emoji: '😰', generos: [53, 9648] },
  lagrimas: { nombre: 'Lágrimas', emoji: '😭', generos: [18] },
  'mente-volada': { nombre: 'Mente volada', emoji: '🤯', generos: [878, 9648] },
  nostalgia: { nombre: 'Nostalgia', emoji: '🥹', generos: [10751, 12], antesDe: 2005 },
  accion: { nombre: 'Acción', emoji: '💥', generos: [28, 12] },
  romance: { nombre: 'Romance', emoji: '❤️', generos: [10749, 35] },
  terror: { nombre: 'Terror', emoji: '👻', generos: [27] },
  documental: { nombre: 'Documental', emoji: '🎓', generos: [99] },
};
```

- [ ] **Step 2: Escribir tests que fallan — `client/src/engine/recomendar.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { puntuar, recomendar } from './recomendar.js';

const comedia = { id: 'a', titulo: 'Comedia', generos: [35], rating: 7.5 };
const drama = { id: 'b', titulo: 'Drama', generos: [18], rating: 7.5 };

describe('puntuar', () => {
  it('da más puntos cuando los géneros coinciden con el mood', () => {
    expect(puntuar(comedia, { mood: 'risa' })).toBeGreaterThan(puntuar(drama, { mood: 'risa' }));
  });

  it('penaliza fuerte los ítems ya vistos', () => {
    expect(puntuar(comedia, { mood: 'risa', vistos: ['a'] })).toBeLessThan(puntuar(drama, { mood: 'risa' }));
  });

  it('penaliza ítems que no caben en el tiempo disponible', () => {
    const corto = { id: 'c', titulo: 'Corto', duracionMin: 30 };
    const largo = { id: 'd', titulo: 'Largo', duracionMin: 180 };
    expect(puntuar(corto, { tiempoMin: 60 })).toBeGreaterThan(puntuar(largo, { tiempoMin: 60 }));
  });

  it('premia coincidencia de intereses con etiquetas', () => {
    const conIa = { id: 'e', titulo: 'IA', etiquetas: ['ia'] };
    const sinIa = { id: 'f', titulo: 'Otro', etiquetas: ['cultura'] };
    expect(puntuar(conIa, { intereses: ['ia'] })).toBeGreaterThan(puntuar(sinIa, { intereses: ['ia'] }));
  });

  it('premia coincidencia de energía y compañía', () => {
    const grupal = { id: 'g', titulo: 'Grupal', energia: 'alta', compania: ['amigos'] };
    const solitario = { id: 'h', titulo: 'Solo', energia: 'baja', compania: ['solo'] };
    const criterios = { energia: 'alta', compania: 'amigos' };
    expect(puntuar(grupal, criterios)).toBeGreaterThan(puntuar(solitario, criterios));
  });

  it('premia películas antiguas cuando el mood es nostalgia', () => {
    const vieja = { id: 'i', titulo: 'Vieja', generos: [10751], anio: 1995 };
    const nueva = { id: 'j', titulo: 'Nueva', generos: [10751], anio: 2023 };
    expect(puntuar(vieja, { mood: 'nostalgia' })).toBeGreaterThan(puntuar(nueva, { mood: 'nostalgia' }));
  });
});

describe('recomendar', () => {
  it('ordena por puntaje descendente y respeta el límite', () => {
    const items = [drama, comedia, { id: 'x', titulo: 'Nada', generos: [] }];
    const r = recomendar(items, { mood: 'risa' }, 2);
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe('a');
    expect(r[0].puntaje).toBeGreaterThanOrEqual(r[1].puntaje);
  });

  it('no muta la lista original', () => {
    const items = [drama, comedia];
    recomendar(items, { mood: 'risa' });
    expect(items[0].id).toBe('b');
  });
});
```

- [ ] **Step 3: Verificar que fallan**

Run: `npm test -w client`
Expected: FAIL — no existe `./recomendar.js`.

- [ ] **Step 4: Implementar `client/src/engine/recomendar.js`**

```js
import { MOODS } from './moods.js';

export function puntuar(item, criterios = {}) {
  let puntos = 0;
  const mood = criterios.mood ? MOODS[criterios.mood] : null;

  if (mood) {
    const coincidencias = (item.generos ?? []).filter((g) => mood.generos.includes(g)).length;
    puntos += coincidencias * 3;
    if (mood.antesDe && item.anio && item.anio < mood.antesDe) puntos += 2;
  }
  if (criterios.intereses?.length && item.etiquetas?.length) {
    puntos += item.etiquetas.filter((e) => criterios.intereses.includes(e)).length * 3;
  }
  if (typeof item.rating === 'number') puntos += item.rating / 2;
  if (criterios.tiempoMin && item.duracionMin) {
    puntos += item.duracionMin <= criterios.tiempoMin ? 1 : -4;
  }
  if (criterios.energia && item.energia === criterios.energia) puntos += 2;
  if (criterios.compania && item.compania?.includes(criterios.compania)) puntos += 2;
  if (criterios.vistos?.includes(item.id)) puntos -= 10;
  return puntos;
}

export function recomendar(items, criterios = {}, limite = 10) {
  return items
    .map((item) => ({ ...item, puntaje: puntuar(item, criterios) }))
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, limite);
}
```

- [ ] **Step 5: Verificar que pasan**

Run: `npm test -w client`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/engine
git commit -m "feat: motor de recomendacion con moods y puntuacion, con tests"
```

---

### Task 6: Motor — planificador de franjas y mezcla de categorías

**Files:**
- Create: `client/src/engine/planificador.js`
- Test: `client/src/engine/planificador.test.js`

**Interfaces:**
- Consumes: nada (funciones puras).
- Produces:
  - `intercalarCategorias(items): items[]` — reordena alternando la propiedad `categoria` (round-robin).
  - `planificarFranjas(items, tiempoTotalMin, franjas): Array<{ franja: string, presupuesto: number, items: item[], minutosUsados: number }>` — `franjas` es `[{ nombre, proporcion }]`; usa `duracionMin` (30 si falta) y nunca excede el presupuesto de cada franja.
  - `FRANJAS_DIA: [{ nombre: 'Mañana', proporcion: 0.35 }, { nombre: 'Tarde', proporcion: 0.40 }, { nombre: 'Noche', proporcion: 0.25 }]`.

- [ ] **Step 1: Escribir tests que fallan — `client/src/engine/planificador.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { intercalarCategorias, planificarFranjas, FRANJAS_DIA } from './planificador.js';

describe('intercalarCategorias', () => {
  it('alterna categorías en vez de agruparlas', () => {
    const items = [
      { id: 1, categoria: 'video' },
      { id: 2, categoria: 'video' },
      { id: 3, categoria: 'podcast' },
      { id: 4, categoria: 'podcast' },
    ];
    const r = intercalarCategorias(items);
    expect(r.map((x) => x.categoria)).toEqual(['video', 'podcast', 'video', 'podcast']);
  });
});

describe('planificarFranjas', () => {
  const franjas = [
    { nombre: 'Mañana', proporcion: 0.5 },
    { nombre: 'Tarde', proporcion: 0.5 },
  ];

  it('nunca excede el presupuesto de cada franja', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, duracionMin: 60 }));
    const r = planificarFranjas(items, 240, franjas);
    for (const bloque of r) {
      expect(bloque.minutosUsados).toBeLessThanOrEqual(bloque.presupuesto);
    }
  });

  it('no repite ítems entre franjas', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i, duracionMin: 60 }));
    const r = planificarFranjas(items, 240, franjas);
    const ids = r.flatMap((b) => b.items.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('usa 30 min como duración por defecto', () => {
    const r = planificarFranjas([{ id: 1 }], 60, [{ nombre: 'Única', proporcion: 1 }]);
    expect(r[0].minutosUsados).toBe(30);
  });

  it('FRANJAS_DIA suma proporciones 1.0', () => {
    const suma = FRANJAS_DIA.reduce((acc, f) => acc + f.proporcion, 0);
    expect(suma).toBeCloseTo(1.0);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -w client`
Expected: FAIL — no existe `./planificador.js`.

- [ ] **Step 3: Implementar `client/src/engine/planificador.js`**

```js
export const FRANJAS_DIA = [
  { nombre: 'Mañana', proporcion: 0.35 },
  { nombre: 'Tarde', proporcion: 0.4 },
  { nombre: 'Noche', proporcion: 0.25 },
];

export function intercalarCategorias(items) {
  const grupos = new Map();
  for (const item of items) {
    const clave = item.categoria ?? 'otros';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(item);
  }
  const listas = [...grupos.values()];
  const resultado = [];
  for (let i = 0; listas.some((l) => i < l.length); i++) {
    for (const lista of listas) {
      if (i < lista.length) resultado.push(lista[i]);
    }
  }
  return resultado;
}

export function planificarFranjas(items, tiempoTotalMin, franjas) {
  const bloques = franjas.map((f) => ({
    franja: f.nombre,
    presupuesto: Math.floor(tiempoTotalMin * f.proporcion),
    items: [],
    minutosUsados: 0,
  }));
  const pendientes = [...items];
  for (const bloque of bloques) {
    for (let i = 0; i < pendientes.length; ) {
      const duracion = pendientes[i].duracionMin ?? 30;
      if (bloque.minutosUsados + duracion <= bloque.presupuesto) {
        bloque.items.push(pendientes[i]);
        bloque.minutosUsados += duracion;
        pendientes.splice(i, 1);
      } else {
        i++;
      }
    }
  }
  return bloques;
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npm test -w client`
Expected: PASS (todos los tests de engine).

- [ ] **Step 5: Commit**

```bash
git add client/src/engine
git commit -m "feat: planificador de franjas horarias con mezcla de categorias"
```

---

### Task 7: Cliente base — Vite, shell de la app, API, contexto y Ajustes

**Files:**
- Create: `client/vite.config.js`, `client/index.html`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/styles.css`, `client/src/lib/api.js`, `client/src/context/ConfigContext.jsx`, `client/src/components/Chips.jsx`, `client/src/modules/ajustes/Ajustes.jsx`

**Interfaces:**
- Consumes: rutas del servidor de Tasks 2-3.
- Produces:
  - `api(ruta, opciones?): Promise<json>` — `fetch` a `/api${ruta}`; en error lanza `Error` con `.codigo` y `.status` (lib/api.js).
  - `tmdb(ruta: string, params?: object): Promise<json>` y `omdb(params: object): Promise<json>` (lib/api.js).
  - `useConfig(): { config: { region, tieneTmdb, tieneOmdb } | null, recargar(): Promise<void> }` (ConfigContext.jsx).
  - `<Chips opciones={[{clave, etiqueta}]} seleccion={string|string[]} onCambio multiple?={bool} />` (Chips.jsx).
  - Clases CSS globales: `.tarjeta`, `.boton`, `.chip`, `.chip-activo`, `.cuadricula`, `.aviso`, `.insignia` (styles.css).

- [ ] **Step 1: Crear `client/vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 2: Crear `client/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mi Centro de Entretenimiento</title>
  </head>
  <body>
    <div id="raiz"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Crear `client/src/lib/api.js`**

```js
export async function api(ruta, opciones) {
  const r = await fetch(`/api${ruta}`, opciones && {
    method: opciones.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(json.mensaje || `Error ${r.status}`);
    error.codigo = json.error;
    error.status = r.status;
    throw error;
  }
  return json;
}

export function tmdb(ruta, params = {}) {
  const q = new URLSearchParams(params).toString();
  return api(`/tmdb/${ruta}${q ? `?${q}` : ''}`);
}

export function omdb(params) {
  return api(`/omdb?${new URLSearchParams(params)}`);
}
```

- [ ] **Step 4: Crear `client/src/context/ConfigContext.jsx`**

```jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';

const Contexto = createContext({ config: null, recargar: async () => {} });

export function ProveedorConfig({ children }) {
  const [config, setConfig] = useState(null);
  const recargar = useCallback(async () => {
    try {
      setConfig(await api('/config'));
    } catch {
      setConfig({ region: 'MX', tieneTmdb: false, tieneOmdb: false, sinServidor: true });
    }
  }, []);
  useEffect(() => { recargar(); }, [recargar]);
  return <Contexto.Provider value={{ config, recargar }}>{children}</Contexto.Provider>;
}

export function useConfig() {
  return useContext(Contexto);
}
```

- [ ] **Step 5: Crear `client/src/components/Chips.jsx`**

```jsx
export default function Chips({ opciones, seleccion, onCambio, multiple = false }) {
  const activo = (clave) => (multiple ? seleccion.includes(clave) : seleccion === clave);
  const alternar = (clave) => {
    if (!multiple) return onCambio(clave);
    onCambio(activo(clave) ? seleccion.filter((x) => x !== clave) : [...seleccion, clave]);
  };
  return (
    <div className="chips">
      {opciones.map((o) => (
        <button
          key={o.clave}
          type="button"
          className={activo(o.clave) ? 'chip chip-activo' : 'chip'}
          onClick={() => alternar(o.clave)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Crear `client/src/styles.css`**

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
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--fondo);
  color: var(--texto);
  font-family: 'Segoe UI', system-ui, sans-serif;
}

#raiz { display: flex; min-height: 100vh; }

.lateral {
  width: 230px;
  flex-shrink: 0;
  background: var(--panel);
  border-right: 1px solid var(--borde);
  padding: 20px 12px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.lateral h1 { font-size: 18px; color: var(--acento); margin: 0 8px 20px; }

.lateral button {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: var(--texto-suave);
  font-size: 15px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.lateral button:hover { background: var(--panel-2); color: var(--texto); }
.lateral button.activo { background: var(--acento); color: white; font-weight: 600; }

.contenido { flex: 1; padding: 28px 36px; max-width: 1200px; }
.contenido h2 { margin-top: 0; }

.tarjeta {
  background: var(--panel);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  padding: 16px;
}

.cuadricula {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }

.chip {
  background: var(--panel-2);
  border: 1px solid var(--borde);
  color: var(--texto);
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
}

.chip-activo { background: var(--acento); border-color: var(--acento); font-weight: 600; }

.boton {
  background: var(--acento);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.boton:disabled { opacity: 0.5; cursor: wait; }
.boton-secundario { background: var(--panel-2); border: 1px solid var(--borde); }

.aviso {
  background: #3a2a00;
  border: 1px solid var(--acento-2);
  color: #ffd98a;
  padding: 10px 16px;
  border-radius: var(--radio);
  margin-bottom: 16px;
  font-size: 14px;
}

.insignia {
  display: inline-block;
  background: var(--panel-2);
  border: 1px solid var(--borde);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  margin-right: 6px;
  color: var(--texto-suave);
}

.insignia-imdb { border-color: #f5c518; color: #f5c518; }
.insignia-rt { border-color: #fa320a; color: #fa6a4d; }

.poster { width: 100%; border-radius: 8px; aspect-ratio: 2/3; object-fit: cover; background: var(--panel-2); }

input, select {
  background: var(--panel-2);
  border: 1px solid var(--borde);
  color: var(--texto);
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 15px;
}

label { display: block; margin: 14px 0 6px; color: var(--texto-suave); font-size: 14px; }

a { color: #6fb3ff; }
.texto-suave { color: var(--texto-suave); font-size: 14px; }
```

- [ ] **Step 7: Crear `client/src/modules/ajustes/Ajustes.jsx`**

```jsx
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const REGIONES = [
  ['MX', 'México'], ['ES', 'España'], ['AR', 'Argentina'], ['CO', 'Colombia'],
  ['CL', 'Chile'], ['PE', 'Perú'], ['US', 'Estados Unidos'],
];

export default function Ajustes() {
  const { config, recargar } = useConfig();
  const [tmdbKey, setTmdbKey] = useState('');
  const [omdbKey, setOmdbKey] = useState('');
  const [region, setRegion] = useState(config?.region ?? 'MX');
  const [estado, setEstado] = useState('');
  const [prueba, setPrueba] = useState(null);

  const guardar = async () => {
    setEstado('guardando');
    await api('/config', { method: 'PUT', body: { tmdbKey, omdbKey, region } });
    await recargar();
    setTmdbKey('');
    setOmdbKey('');
    setEstado('guardado');
  };

  const probar = async () => {
    setEstado('probando');
    setPrueba(await api('/config/probar', { method: 'POST', body: {} }));
    setEstado('');
  };

  return (
    <div>
      <h2>⚙️ Ajustes</h2>
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <h3>Región</h3>
        <p className="texto-suave">Define qué plataformas se muestran y el idioma/país de los datos de TMDB.</p>
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONES.map(([clave, nombre]) => <option key={clave} value={clave}>{nombre}</option>)}
        </select>

        <h3 style={{ marginTop: 24 }}>API keys gratuitas</h3>
        <p className="texto-suave">
          Sin keys la app funciona con el catálogo curado, pero sin pósters, ratings ni "dónde ver" en vivo.
          Obtenerlas toma ~5 minutos y no piden tarjeta:
        </p>
        <ol className="texto-suave">
          <li>TMDB: crea cuenta en <a href="https://www.themoviedb.org/signup" target="_blank" rel="noreferrer">themoviedb.org</a> y pide tu key en <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">Ajustes → API</a>.</li>
          <li>OMDb: pide tu key gratis en <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer">omdbapi.com/apikey.aspx</a> (plan FREE, 1000 consultas/día).</li>
        </ol>
        <label>API key de TMDB {config?.tieneTmdb && '✅ (ya configurada)'}</label>
        <input type="password" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} placeholder="Pégala aquí" style={{ width: '100%' }} />
        <label>API key de OMDb {config?.tieneOmdb && '✅ (ya configurada)'}</label>
        <input type="password" value={omdbKey} onChange={(e) => setOmdbKey(e.target.value)} placeholder="Pégala aquí" style={{ width: '100%' }} />
        <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
          <button className="boton" onClick={guardar} disabled={estado === 'guardando'}>Guardar</button>
          <button className="boton boton-secundario" onClick={probar} disabled={estado === 'probando'}>Probar conexión</button>
        </div>
        {estado === 'guardado' && <p>✅ Guardado.</p>}
        {prueba && (
          <p>
            TMDB: {prueba.tmdb ? '✅ funciona' : '❌ falla'} · OMDb: {prueba.omdb ? '✅ funciona' : '❌ falla'}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Crear `client/src/App.jsx` y `client/src/main.jsx`**

`client/src/App.jsx` (los módulos aún no creados se agregan en sus tareas; por ahora solo Ajustes y marcadores):

```jsx
import { useState } from 'react';
import { useConfig } from './context/ConfigContext.jsx';
import Ajustes from './modules/ajustes/Ajustes.jsx';

const SECCIONES = [
  ['fuentes', '📺 Fuentes'],
  ['cine', '🎬 Noche de Cine'],
  ['semanal', '🗓️ Modo Netflix'],
  ['maraton', '🍿 Maratón'],
  ['aprendizaje', '🧠 Aprendizaje'],
  ['queveo', '🎲 ¿Qué veo?'],
  ['ajustes', '⚙️ Ajustes'],
];

const EN_CONSTRUCCION = (nombre) => () => <p>Sección «{nombre}» en construcción…</p>;

const MODULOS = {
  fuentes: EN_CONSTRUCCION('Fuentes'),
  cine: EN_CONSTRUCCION('Noche de Cine'),
  semanal: EN_CONSTRUCCION('Modo Netflix'),
  maraton: EN_CONSTRUCCION('Maratón'),
  aprendizaje: EN_CONSTRUCCION('Aprendizaje'),
  queveo: EN_CONSTRUCCION('¿Qué veo?'),
  ajustes: Ajustes,
};

export default function App() {
  const [vista, setVista] = useState('fuentes');
  const { config } = useConfig();
  const Modulo = MODULOS[vista];
  return (
    <>
      <nav className="lateral">
        <h1>🎬 Mi Centro</h1>
        {SECCIONES.map(([clave, nombre]) => (
          <button key={clave} className={vista === clave ? 'activo' : ''} onClick={() => setVista(clave)}>
            {nombre}
          </button>
        ))}
      </nav>
      <main className="contenido">
        {config && !config.tieneTmdb && vista !== 'ajustes' && (
          <div className="aviso">
            ⚠️ Modo limitado: configura tus API keys gratuitas en <b>Ajustes</b> para ver pósters, ratings y dónde ver cada título.
          </div>
        )}
        <Modulo />
      </main>
    </>
  );
}
```

`client/src/main.jsx`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ProveedorConfig } from './context/ConfigContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('raiz')).render(
  <React.StrictMode>
    <ProveedorConfig>
      <App />
    </ProveedorConfig>
  </React.StrictMode>,
);
```

- [ ] **Step 9: Verificación manual**

Run: `npm run dev` (raíz). Se abre el navegador en `http://localhost:5173`.
Expected:
- Barra lateral oscura con las 7 secciones; aviso ámbar de "Modo limitado".
- En Ajustes: se puede cambiar región, pegar keys (si las tienes), Guardar muestra ✅ y el check "(ya configurada)"; "Probar conexión" responde.
- Detener con Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add client
git commit -m "feat: shell de la SPA con navegacion, contexto de config y pantalla de Ajustes"
```

---

### Task 8: Módulo 1 — Dashboard de Fuentes

**Files:**
- Create: `client/src/modules/fuentes/Fuentes.jsx`
- Modify: `client/src/App.jsx` (reemplazar el marcador `fuentes`)

**Interfaces:**
- Consumes: `fuentes.json` (Task 4), `useConfig()` (Task 7).

- [ ] **Step 1: Crear `client/src/modules/fuentes/Fuentes.jsx`**

```jsx
import { useMemo, useState } from 'react';
import fuentes from '../../catalog/fuentes.json';
import { useConfig } from '../../context/ConfigContext.jsx';

const CATEGORIAS = [
  ['peliculas', '🎬 Películas'], ['series', '📺 Series'], ['musica', '🎵 Música'],
  ['podcasts', '🎙️ Podcasts'], ['anime', '🇯🇵 Anime'], ['libros', '📚 Libros'],
  ['juegos', '🎮 Juegos'], ['documentales', '🎓 Documentales'],
  ['aprendizaje', '🧠 Aprendizaje'], ['torrents-legales', '🧲 Torrents legales'],
];

function disponibleEn(fuente, region) {
  return fuente.regiones === '*' || fuente.regiones.includes('*') || fuente.regiones.includes(region);
}

export default function Fuentes() {
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return fuentes.filter((f) =>
      disponibleEn(f, region) &&
      (!texto || f.nombre.toLowerCase().includes(texto) || f.mejorPara.toLowerCase().includes(texto)),
    );
  }, [region, busqueda]);

  return (
    <div>
      <h2>📺 Dashboard de Fuentes gratuitas</h2>
      <p className="texto-suave">
        Plataformas legales y gratuitas disponibles en tu región ({region}). Cada una con su consejo para usarla como sistema premium.
      </p>
      <input
        placeholder="Buscar plataforma…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: 320, marginBottom: 8 }}
      />
      {CATEGORIAS.map(([clave, titulo]) => {
        const grupo = visibles.filter((f) => f.categoria === clave);
        if (!grupo.length) return null;
        return (
          <section key={clave}>
            <h3>{titulo}</h3>
            <div className="cuadricula">
              {grupo.map((f) => (
                <div className="tarjeta" key={f.nombre}>
                  <h4 style={{ margin: '0 0 6px' }}>
                    <a href={f.url} target="_blank" rel="noreferrer">{f.nombre}</a>
                  </h4>
                  <p style={{ margin: '0 0 8px' }}>{f.mejorPara}</p>
                  <div>
                    <span className="insignia">{f.registro ? 'Con registro' : 'Sin registro'}</span>
                    <span className="insignia">{f.anuncios ? 'Con anuncios' : 'Sin anuncios'}</span>
                  </div>
                  <p className="texto-suave" style={{ marginBottom: 0 }}>💎 {f.consejoPremium}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Conectarlo en `client/src/App.jsx`**

Agregar el import y reemplazar el marcador:

```jsx
import Fuentes from './modules/fuentes/Fuentes.jsx';
// en MODULOS:
  fuentes: Fuentes,
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`
Expected: la sección Fuentes muestra las 10 categorías con tarjetas; el buscador filtra; al cambiar la región en Ajustes (p. ej. a ES) desaparecen las plataformas no disponibles (Tubi, ViX).

- [ ] **Step 4: Commit**

```bash
git add client/src
git commit -m "feat: modulo Dashboard de Fuentes con filtro por region y busqueda"
```

---

### Task 9: Módulo 2 — Noche de Cine (películas por mood con ratings y dónde ver)

**Files:**
- Create: `client/src/lib/peliculas.js`, `client/src/components/TarjetaPelicula.jsx`, `client/src/modules/cine/NocheDeCine.jsx`
- Modify: `client/src/App.jsx` (conectar `cine`)

**Interfaces:**
- Consumes: `tmdb()`, `omdb()`, `api()` (Task 7); `MOODS`, `recomendar()` (Task 5).
- Produces (lib/peliculas.js — la usan también Tasks 10-12):
  - `buscarPorMood(moodClave: string, paginas = 2): Promise<item[]>` — items con `{ id, titulo, anio, generos, rating, poster, resumen, duracionMin: 110, categoria: 'pelicula' }`.
  - `dondeVer(idPelicula: number, region: string): Promise<{ gratis: string[], suscripcion: string[], enlace: string|null }>`.
  - `ratingsDe(titulo: string, anio?: number): Promise<{ imdb, rottenTomatoes, fecha } | null>` — devuelve `null` si OMDb falla (nunca lanza).
  - `porQueTeGustara(item, moodClave): string` — frase en español generada por reglas.
  - `urlPoster(poster: string|null): string|null` — `https://image.tmdb.org/t/p/w342${poster}`.
  - `<TarjetaPelicula pelicula={...} region={...} extra?={nodo} />` — tarjeta con póster, insignias IMDb/RT, dónde ver y "por qué te va a gustar".

- [ ] **Step 1: Crear `client/src/lib/peliculas.js`**

```js
import { tmdb, omdb } from './api.js';
import { MOODS } from '../engine/moods.js';

const NOMBRES_GENERO = {
  28: 'acción', 12: 'aventura', 35: 'comedia', 18: 'drama', 53: 'suspenso',
  878: 'ciencia ficción', 9648: 'misterio', 10749: 'romance', 27: 'terror',
  99: 'documental', 10751: 'familiar', 16: 'animación', 80: 'crimen', 14: 'fantasía',
};

export function urlPoster(poster) {
  return poster ? `https://image.tmdb.org/t/p/w342${poster}` : null;
}

function aItem(p) {
  return {
    id: p.id,
    titulo: p.title,
    anio: p.release_date ? Number(p.release_date.slice(0, 4)) : undefined,
    generos: p.genre_ids ?? [],
    rating: p.vote_average,
    poster: p.poster_path,
    resumen: p.overview,
    duracionMin: 110,
    categoria: 'pelicula',
  };
}

export async function buscarPorMood(moodClave, paginas = 2) {
  const mood = MOODS[moodClave];
  const params = {
    with_genres: mood.generos.join('|'),
    sort_by: 'popularity.desc',
    'vote_count.gte': 300,
    include_adult: false,
  };
  if (mood.antesDe) params['primary_release_date.lte'] = `${mood.antesDe - 1}-12-31`;
  const respuestas = await Promise.all(
    Array.from({ length: paginas }, (_, i) => tmdb('discover/movie', { ...params, page: i + 1 })),
  );
  return respuestas.flatMap((r) => r.results ?? []).map(aItem);
}

export async function dondeVer(idPelicula, region) {
  try {
    const r = await tmdb(`movie/${idPelicula}/watch/providers`);
    const zona = r.results?.[region];
    const nombres = (lista) => (lista ?? []).map((p) => p.provider_name);
    return {
      gratis: [...new Set([...nombres(zona?.free), ...nombres(zona?.ads)])],
      suscripcion: nombres(zona?.flatrate),
      enlace: zona?.link ?? null,
    };
  } catch {
    return { gratis: [], suscripcion: [], enlace: null };
  }
}

export async function ratingsDe(titulo, anio) {
  try {
    const params = { t: titulo };
    if (anio) params.y = anio;
    return await omdb(params);
  } catch {
    return null;
  }
}

export function porQueTeGustara(item, moodClave) {
  const mood = MOODS[moodClave];
  const generos = (item.generos ?? [])
    .map((g) => NOMBRES_GENERO[g])
    .filter(Boolean)
    .slice(0, 2);
  const partes = [];
  if (generos.length) partes.push(`Combina ${generos.join(' y ')}`);
  if (typeof item.rating === 'number' && item.rating >= 7) partes.push(`con una calificación sólida de ${item.rating.toFixed(1)}/10`);
  if (mood) partes.push(`— justo lo que pide un mood de ${mood.nombre.toLowerCase()}`);
  if (mood?.antesDe && item.anio && item.anio < mood.antesDe) partes.push(`, y es un clásico de ${item.anio}`);
  return partes.length ? `${partes.join(' ')}.` : 'Una opción popular y bien valorada para hoy.';
}
```

- [ ] **Step 2: Crear `client/src/components/TarjetaPelicula.jsx`**

```jsx
import { urlPoster } from '../lib/peliculas.js';

export default function TarjetaPelicula({ pelicula, extra }) {
  const p = pelicula;
  return (
    <div className="tarjeta">
      {p.poster && <img className="poster" src={urlPoster(p.poster)} alt={`Póster de ${p.titulo}`} loading="lazy" />}
      <h4 style={{ margin: '10px 0 4px' }}>{p.titulo} {p.anio && <span className="texto-suave">({p.anio})</span>}</h4>
      <div style={{ margin: '6px 0' }}>
        {p.ratings?.imdb && <span className="insignia insignia-imdb">IMDb {p.ratings.imdb}</span>}
        {p.ratings?.rottenTomatoes && <span className="insignia insignia-rt">🍅 {p.ratings.rottenTomatoes}</span>}
        {!p.ratings?.imdb && typeof p.rating === 'number' && <span className="insignia">TMDB {p.rating.toFixed(1)}</span>}
      </div>
      {p.proveedores && (
        <p style={{ margin: '6px 0' }}>
          {p.proveedores.gratis.length > 0 && <>🆓 <b>{p.proveedores.gratis.join(', ')}</b></>}
          {p.proveedores.gratis.length === 0 && p.proveedores.suscripcion.length > 0 && <>💳 {p.proveedores.suscripcion.join(', ')}</>}
          {p.proveedores.gratis.length === 0 && p.proveedores.suscripcion.length === 0 && <span className="texto-suave">Sin streaming en tu región — prueba las fuentes del Dashboard</span>}
        </p>
      )}
      {p.porQue && <p className="texto-suave" style={{ marginBottom: 0 }}>💡 {p.porQue}</p>}
      {extra}
    </div>
  );
}
```

- [ ] **Step 3: Crear `client/src/modules/cine/NocheDeCine.jsx`**

```jsx
import { useState } from 'react';
import Chips from '../../components/Chips.jsx';
import TarjetaPelicula from '../../components/TarjetaPelicula.jsx';
import { MOODS } from '../../engine/moods.js';
import { recomendar } from '../../engine/recomendar.js';
import { buscarPorMood, dondeVer, ratingsDe, porQueTeGustara } from '../../lib/peliculas.js';
import { api } from '../../lib/api.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const OPCIONES_MOOD = Object.entries(MOODS).map(([clave, m]) => ({ clave, etiqueta: `${m.emoji} ${m.nombre}` }));

export default function NocheDeCine() {
  const { config } = useConfig();
  const [mood, setMood] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [principales, setPrincipales] = useState([]);
  const [respaldos, setRespaldos] = useState([]);

  const generar = async (moodElegido) => {
    setMood(moodElegido);
    setCargando(true);
    setError(null);
    try {
      const { valor: vistos } = await api('/datos/vistos').catch(() => ({ valor: [] }));
      const candidatas = await buscarPorMood(moodElegido, 2);
      const top = recomendar(candidatas, { mood: moodElegido, vistos: vistos ?? [] }, 13);
      const diez = await Promise.all(
        top.slice(0, 10).map(async (p) => ({
          ...p,
          proveedores: await dondeVer(p.id, config.region),
          ratings: await ratingsDe(p.titulo, p.anio),
          porQue: porQueTeGustara(p, moodElegido),
        })),
      );
      setPrincipales(diez);
      setRespaldos(top.slice(10));
    } catch (e) {
      setError(e.status === 503 ? 'Necesitas configurar tu API key de TMDB en Ajustes.' : `No pude generar la lista: ${e.message}`);
    } finally {
      setCargando(false);
    }
  };

  const marcarVista = async (id) => {
    const { valor } = await api('/datos/vistos').catch(() => ({ valor: [] }));
    const vistos = Array.isArray(valor) ? valor : [];
    if (!vistos.includes(id)) await api('/datos/vistos', { method: 'PUT', body: [...vistos, id] });
    setPrincipales((lista) => lista.filter((p) => p.id !== id));
  };

  return (
    <div>
      <h2>🎬 Noche de Cine</h2>
      <p className="texto-suave">Elige tu mood de hoy y te doy 10 películas + 3 respaldos, con ratings y dónde verlas.</p>
      <Chips opciones={OPCIONES_MOOD} seleccion={mood} onCambio={generar} />
      {cargando && <p>Buscando películas para tu mood… 🍿</p>}
      {error && <div className="aviso">{error}</div>}
      {!cargando && principales.length > 0 && (
        <>
          <div className="cuadricula">
            {principales.map((p) => (
              <TarjetaPelicula
                key={p.id}
                pelicula={p}
                extra={<button className="chip" style={{ marginTop: 8 }} onClick={() => marcarVista(p.id)}>✔ Ya la vi</button>}
              />
            ))}
          </div>
          {respaldos.length > 0 && (
            <div className="tarjeta" style={{ marginTop: 20 }}>
              <h3 style={{ marginTop: 0 }}>🎯 Respaldos (por si ninguna convence)</h3>
              <ul>
                {respaldos.map((p) => <li key={p.id}>{p.titulo} {p.anio && `(${p.anio})`} — TMDB {p.rating?.toFixed(1)}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Conectarlo en `client/src/App.jsx`**

```jsx
import NocheDeCine from './modules/cine/NocheDeCine.jsx';
// en MODULOS:
  cine: NocheDeCine,
```

- [ ] **Step 5: Verificación manual**

Run: `npm run dev` (con keys configuradas en Ajustes).
Expected: al elegir un mood aparecen 10 tarjetas con póster, insignias IMDb/🍅 (las que OMDb encuentre), plataformas 🆓 según región, texto "💡 por qué te va a gustar" y lista de 3 respaldos. "Ya la vi" quita la tarjeta y esa película deja de aparecer en futuras listas. Sin keys: aviso claro pidiendo configurarlas.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat: modulo Noche de Cine con moods, ratings IMDb/RT y donde ver"
```

---

### Task 10: Módulo 6 — Botón «¿Qué veo?»

**Files:**
- Create: `client/src/modules/queveo/QueVeo.jsx`
- Modify: `client/src/App.jsx` (conectar `queveo`)

**Interfaces:**
- Consumes: `MOODS`, `recomendar()` (Task 5); `buscarPorMood`, `dondeVer`, `porQueTeGustara` (Task 9); `contenido.json` (Task 4).

- [ ] **Step 1: Crear `client/src/modules/queveo/QueVeo.jsx`**

```jsx
import { useState } from 'react';
import Chips from '../../components/Chips.jsx';
import TarjetaPelicula from '../../components/TarjetaPelicula.jsx';
import contenido from '../../catalog/contenido.json';
import { MOODS } from '../../engine/moods.js';
import { recomendar } from '../../engine/recomendar.js';
import { buscarPorMood, dondeVer, porQueTeGustara } from '../../lib/peliculas.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const PASOS = [
  { clave: 'mood', titulo: '¿Cuál es tu mood?', opciones: Object.entries(MOODS).map(([clave, m]) => ({ clave, etiqueta: `${m.emoji} ${m.nombre}` })) },
  { clave: 'tiempo', titulo: '¿Cuánto tiempo tienes?', opciones: [
    { clave: '30', etiqueta: '30 min' }, { clave: '60', etiqueta: '1 hora' },
    { clave: '120', etiqueta: '2 horas' }, { clave: '240', etiqueta: 'Toda la tarde' },
  ] },
  { clave: 'energia', titulo: '¿Cuánta energía tienes?', opciones: [
    { clave: 'baja', etiqueta: '🔋 Poca (algo relajado)' }, { clave: 'media', etiqueta: '🔋🔋 Normal' },
    { clave: 'alta', etiqueta: '🔋🔋🔋 Mucha (algo intenso)' },
  ] },
  { clave: 'compania', titulo: '¿Con quién estás?', opciones: [
    { clave: 'solo', etiqueta: '🧍 Solo' }, { clave: 'pareja', etiqueta: '💑 En pareja' },
    { clave: 'familia', etiqueta: '👨‍👩‍👧 Familia' }, { clave: 'amigos', etiqueta: '👯 Amigos' },
  ] },
];

const SECCIONES_RESULTADO = [
  ['pelicula', '🎬 3 Películas'], ['video', '📹 3 Videos'], ['podcast', '🎙️ 3 Podcasts'],
  ['juego', '🎮 3 Juegos'], ['documental', '🎓 3 Documentales'],
];

export default function QueVeo() {
  const { config } = useConfig();
  const [respuestas, setRespuestas] = useState({});
  const [paso, setPaso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const responder = async (valor) => {
    const nuevas = { ...respuestas, [PASOS[paso].clave]: valor };
    setRespuestas(nuevas);
    if (paso < PASOS.length - 1) return setPaso(paso + 1);
    await generar(nuevas);
  };

  const generar = async (r) => {
    setCargando(true);
    const criterios = {
      mood: r.mood,
      tiempoMin: Number(r.tiempo),
      energia: r.energia,
      compania: r.compania,
    };
    const porCategoria = (cat) => recomendar(contenido.filter((c) => c.categoria === cat), criterios, 3);
    let peliculas = [];
    try {
      const candidatas = await buscarPorMood(r.mood, 1);
      const top = recomendar(candidatas, criterios, 3);
      peliculas = await Promise.all(top.map(async (p) => ({
        ...p,
        proveedores: await dondeVer(p.id, config.region),
        porQue: porQueTeGustara(p, r.mood),
      })));
    } catch { /* sin TMDB: seguimos con el resto */ }
    setResultado({
      pelicula: peliculas,
      video: porCategoria('video'),
      podcast: porCategoria('podcast'),
      juego: porCategoria('juego'),
      documental: porCategoria('documental'),
    });
    setCargando(false);
  };

  const reiniciar = () => { setRespuestas({}); setPaso(0); setResultado(null); };

  if (cargando) return <p>Pensando en tu combinación perfecta… 🎲</p>;

  if (resultado) {
    return (
      <div>
        <h2>🎲 Tu menú de hoy</h2>
        <button className="boton boton-secundario" onClick={reiniciar}>↺ Volver a empezar</button>
        {SECCIONES_RESULTADO.map(([cat, titulo]) => (
          <section key={cat}>
            <h3>{titulo}</h3>
            {resultado[cat].length === 0 && <p className="texto-suave">Sin resultados (¿faltan las API keys para películas?).</p>}
            <div className="cuadricula">
              {resultado[cat].map((item) =>
                cat === 'pelicula' ? (
                  <TarjetaPelicula key={item.id} pelicula={item} />
                ) : (
                  <div className="tarjeta" key={item.id}>
                    <h4 style={{ margin: '0 0 6px' }}><a href={item.url} target="_blank" rel="noreferrer">{item.titulo}</a></h4>
                    <p style={{ margin: '0 0 6px' }}>{item.descripcion}</p>
                    <span className="insignia">📍 {item.dondeVer}</span>
                    <span className="insignia">⏱️ {item.duracionMin} min</span>
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const actual = PASOS[paso];
  return (
    <div>
      <h2>🎲 ¿Qué veo hoy?</h2>
      <p className="texto-suave">Pregunta {paso + 1} de {PASOS.length}</p>
      <h3>{actual.titulo}</h3>
      <Chips opciones={actual.opciones} seleccion={respuestas[actual.clave] ?? null} onCambio={responder} />
    </div>
  );
}
```

- [ ] **Step 2: Conectarlo en `client/src/App.jsx`**

```jsx
import QueVeo from './modules/queveo/QueVeo.jsx';
// en MODULOS:
  queveo: QueVeo,
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`
Expected: wizard de 4 preguntas con chips; al terminar muestra 5 secciones (3 películas con póster/proveedores, 3 videos, 3 podcasts, 3 juegos, 3 documentales) coherentes con energía/compañía elegidas (p. ej. con "amigos" aparecen juegos multijugador). Sin keys: películas vacías con nota, resto funciona.

- [ ] **Step 4: Commit**

```bash
git add client/src
git commit -m "feat: modulo Que veo con wizard de mood, tiempo, energia y compania"
```

---

### Task 11: Módulo 3 — Modo Netflix Semanal

**Files:**
- Create: `client/src/engine/canales.js`, `client/src/modules/semanal/ModoNetflix.jsx`
- Modify: `client/src/App.jsx` (conectar `semanal`)

**Interfaces:**
- Consumes: `buscarPorMood`, `dondeVer` (Task 9); `recomendar` (Task 5); `contenido.json`; `api('/datos/plan-semanal')` (Task 2).
- Produces:
  - `CANALES: Array<{ dia, nombre, mood, etiquetas: string[] }>` (canales.js) — 7 canales temáticos.
  - Plan persistido con forma `{ generado: string(ISO), dias: [{ dia, nombre, items: [{ titulo, tipo, dondeVer, url?, busqueda }] }] }`.

- [ ] **Step 1: Crear `client/src/engine/canales.js`**

```js
export const CANALES = [
  { dia: 'Lunes', nombre: '😂 Lunes de Risa', mood: 'risa', etiquetas: ['humor'] },
  { dia: 'Martes', nombre: '😰 Martes de Tensión', mood: 'tension', etiquetas: ['psicologia'] },
  { dia: 'Miércoles', nombre: '🎓 Miércoles Documental', mood: 'documental', etiquetas: ['ciencia', 'historia'] },
  { dia: 'Jueves', nombre: '🥹 Jueves Retro', mood: 'nostalgia', etiquetas: ['historia', 'cultura'] },
  { dia: 'Viernes', nombre: '💥 Viernes de Acción', mood: 'accion', etiquetas: ['tecnologia'] },
  { dia: 'Sábado', nombre: '🤯 Sábado de Mente Volada', mood: 'mente-volada', etiquetas: ['ia', 'ciencia'] },
  { dia: 'Domingo', nombre: '😭 Domingo de Sofá', mood: 'lagrimas', etiquetas: ['cultura', 'musica'] },
];
```

- [ ] **Step 2: Crear `client/src/modules/semanal/ModoNetflix.jsx`**

```jsx
import { useEffect, useState } from 'react';
import contenido from '../../catalog/contenido.json';
import { CANALES } from '../../engine/canales.js';
import { recomendar } from '../../engine/recomendar.js';
import { buscarPorMood, dondeVer } from '../../lib/peliculas.js';
import { api } from '../../lib/api.js';
import { useConfig } from '../../context/ConfigContext.jsx';

function busquedaPara(titulo, plataforma) {
  const q = encodeURIComponent(`${titulo} ver gratis ${plataforma ?? ''}`.trim());
  return { texto: `${titulo} ver gratis`, url: `https://www.google.com/search?q=${q}` };
}

export default function ModoNetflix() {
  const { config } = useConfig();
  const [plan, setPlan] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/datos/plan-semanal').then((r) => setPlan(r.valor)).catch(() => {});
  }, []);

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      const dias = await Promise.all(CANALES.map(async (canal) => {
        const items = [];
        try {
          const candidatas = await buscarPorMood(canal.mood, 1);
          const [peli] = recomendar(candidatas, { mood: canal.mood }, 1 + Math.floor(Math.random() * 5)).slice(-1);
          if (peli) {
            const prov = await dondeVer(peli.id, config.region);
            const plataforma = prov.gratis[0] ?? prov.suscripcion[0];
            items.push({
              titulo: `${peli.titulo}${peli.anio ? ` (${peli.anio})` : ''}`,
              tipo: 'Película',
              dondeVer: plataforma ?? 'Busca en tus fuentes gratuitas',
              busqueda: busquedaPara(peli.titulo, plataforma),
            });
          }
        } catch { /* sin TMDB: el día lleva solo contenido curado */ }
        const [extra] = recomendar(contenido, { intereses: canal.etiquetas }, 1);
        if (extra) {
          items.push({
            titulo: extra.titulo,
            tipo: extra.categoria === 'podcast' ? 'Podcast' : extra.categoria === 'juego' ? 'Juego' : 'Video/Documental',
            dondeVer: extra.dondeVer,
            url: extra.url,
            busqueda: busquedaPara(extra.titulo, extra.dondeVer),
          });
        }
        return { dia: canal.dia, nombre: canal.nombre, items };
      }));
      const nuevoPlan = { generado: new Date().toISOString(), dias };
      setPlan(nuevoPlan);
      await api('/datos/plan-semanal', { method: 'PUT', body: nuevoPlan });
    } catch (e) {
      setError(`No pude generar la parrilla: ${e.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <h2>🗓️ Modo Netflix: tu parrilla semanal</h2>
      <p className="texto-suave">Canales temáticos por día, como una programación de TV hecha para ti. Se guarda hasta que la regeneres.</p>
      <button className="boton" onClick={generar} disabled={cargando}>
        {cargando ? 'Programando tu semana…' : plan ? '↺ Regenerar semana' : '✨ Generar mi semana'}
      </button>
      {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
      {plan && (
        <>
          <p className="texto-suave" style={{ marginTop: 10 }}>Generada el {new Date(plan.generado).toLocaleDateString('es-MX')}</p>
          <div className="cuadricula" style={{ marginTop: 8 }}>
            {plan.dias.map((d) => (
              <div className="tarjeta" key={d.dia}>
                <h4 style={{ margin: '0 0 10px' }}>{d.nombre}</h4>
                {d.items.length === 0 && <p className="texto-suave">Sin sugerencias (revisa tus API keys).</p>}
                {d.items.map((item, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div><span className="insignia">{item.tipo}</span> <b>{item.titulo}</b></div>
                    <div className="texto-suave">
                      📍 {item.dondeVer} · {item.url
                        ? <a href={item.url} target="_blank" rel="noreferrer">abrir</a>
                        : <a href={item.busqueda.url} target="_blank" rel="noreferrer">buscar «{item.busqueda.texto}»</a>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Conectarlo en `client/src/App.jsx`**

```jsx
import ModoNetflix from './modules/semanal/ModoNetflix.jsx';
// en MODULOS:
  semanal: ModoNetflix,
```

- [ ] **Step 4: Verificación manual**

Run: `npm run dev`
Expected: botón "Generar mi semana" produce 7 tarjetas (Lunes-Domingo) con 1 película + 1 contenido curado cada una, plataforma o enlace de búsqueda. Al recargar la página, la parrilla persiste; "Regenerar semana" crea otra distinta.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "feat: modulo Modo Netflix con parrilla semanal persistente de 7 canales"
```

---

### Task 12: Módulo 4 — Maratón de Fin de Semana

**Files:**
- Create: `client/src/modules/maraton/Maraton.jsx`
- Modify: `client/src/App.jsx` (conectar `maraton`)

**Interfaces:**
- Consumes: `recomendar` (Task 5); `intercalarCategorias`, `planificarFranjas`, `FRANJAS_DIA` (Task 6); `buscarPorMood` (Task 9); `contenido.json`.

- [ ] **Step 1: Crear `client/src/modules/maraton/Maraton.jsx`**

```jsx
import { useState } from 'react';
import Chips from '../../components/Chips.jsx';
import contenido from '../../catalog/contenido.json';
import { recomendar } from '../../engine/recomendar.js';
import { intercalarCategorias, planificarFranjas, FRANJAS_DIA } from '../../engine/planificador.js';
import { buscarPorMood } from '../../lib/peliculas.js';

const INTERESES = [
  ['negocios', '💼 Negocios'], ['ia', '🤖 IA'], ['tecnologia', '💻 Tecnología'],
  ['ciencia', '🔬 Ciencia'], ['historia', '📜 Historia'], ['idiomas', '🗣️ Idiomas'],
  ['psicologia', '🧠 Psicología'], ['cultura', '🌎 Cultura'], ['humor', '😂 Humor'],
].map(([clave, etiqueta]) => ({ clave, etiqueta }));

const EMOJI_FRANJA = { 'Mañana': '🌅', 'Tarde': '☀️', 'Noche': '🌙' };

export default function Maraton() {
  const [horas, setHoras] = useState(6);
  const [intereses, setIntereses] = useState([]);
  const [bloques, setBloques] = useState(null);
  const [cargando, setCargando] = useState(false);

  const generar = async () => {
    setCargando(true);
    let candidatos = recomendar(contenido, { intereses }, 25);
    try {
      const pelis = await buscarPorMood('mente-volada', 1);
      candidatos = [...candidatos, ...recomendar(pelis, {}, 4)];
    } catch { /* sin TMDB: maratón solo con contenido curado */ }
    setBloques(planificarFranjas(intercalarCategorias(candidatos), horas * 60, FRANJAS_DIA));
    setCargando(false);
  };

  return (
    <div>
      <h2>🍿 Maratón de Fin de Semana</h2>
      <label>¿Cuántas horas tienes disponibles?</label>
      <input type="number" min="1" max="16" value={horas} onChange={(e) => setHoras(Number(e.target.value))} style={{ width: 100 }} /> horas
      <label>¿Qué te interesa? (elige varios)</label>
      <Chips opciones={INTERESES} seleccion={intereses} onCambio={setIntereses} multiple />
      <button className="boton" onClick={generar} disabled={cargando || horas < 1}>
        {cargando ? 'Armando tu maratón…' : '✨ Armar mi maratón'}
      </button>
      {bloques && (
        <div className="cuadricula" style={{ marginTop: 20 }}>
          {bloques.map((b) => (
            <div className="tarjeta" key={b.franja}>
              <h3 style={{ marginTop: 0 }}>{EMOJI_FRANJA[b.franja]} {b.franja}</h3>
              <p className="texto-suave">{b.minutosUsados} de {b.presupuesto} min planificados</p>
              {b.items.length === 0 && <p className="texto-suave">Franja libre — descansa o improvisa.</p>}
              {b.items.map((item) => (
                <div key={item.id} style={{ marginBottom: 10 }}>
                  <span className="insignia">{item.categoria}</span> <b>{item.titulo}</b>
                  <div className="texto-suave">⏱️ {item.duracionMin ?? 30} min{item.dondeVer ? ` · 📍 ${item.dondeVer}` : ''}
                    {item.url && <> · <a href={item.url} target="_blank" rel="noreferrer">abrir</a></>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Conectarlo en `client/src/App.jsx`**

```jsx
import Maraton from './modules/maraton/Maraton.jsx';
// en MODULOS:
  maraton: Maraton,
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`
Expected: con 6 horas e intereses "IA + Ciencia", genera 3 franjas (Mañana/Tarde/Noche) con mezcla de categorías (película, podcast, juego, aprendizaje), cada franja sin exceder su presupuesto de minutos. Cambiar horas a 2 reduce visiblemente los ítems.

- [ ] **Step 4: Commit**

```bash
git add client/src
git commit -m "feat: modulo Maraton con horario por franjas segun horas e intereses"
```

---

### Task 13: Módulo 5 — Curador de Aprendizaje

**Files:**
- Create: `client/src/modules/aprendizaje/Curador.jsx`
- Modify: `client/src/App.jsx` (conectar `aprendizaje`)

**Interfaces:**
- Consumes: `recomendar` (Task 5); `contenido.json`; `api('/datos/plan-aprendizaje')`.

- [ ] **Step 1: Crear `client/src/modules/aprendizaje/Curador.jsx`**

```jsx
import { useEffect, useState } from 'react';
import Chips from '../../components/Chips.jsx';
import contenido from '../../catalog/contenido.json';
import { recomendar } from '../../engine/recomendar.js';
import { api } from '../../lib/api.js';

const INTERESES = [
  ['negocios', '💼 Negocios'], ['ia', '🤖 IA'], ['tecnologia', '💻 Tecnología'],
  ['ciencia', '🔬 Ciencia'], ['historia', '📜 Historia'], ['idiomas', '🗣️ Idiomas'],
  ['psicologia', '🧠 Psicología'],
].map(([clave, etiqueta]) => ({ clave, etiqueta }));

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const CATEGORIAS_VALIDAS = ['aprendizaje', 'podcast', 'video', 'documental'];

export default function Curador() {
  const [intereses, setIntereses] = useState([]);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api('/datos/plan-aprendizaje').then((r) => setPlan(r.valor)).catch(() => {});
  }, []);

  const generar = async () => {
    const candidatos = contenido.filter(
      (c) => CATEGORIAS_VALIDAS.includes(c.categoria) && (c.duracionMin ?? 30) <= 45,
    );
    const mejores = recomendar(candidatos, { intereses }, DIAS.length);
    const nuevoPlan = {
      generado: new Date().toISOString(),
      intereses,
      sesiones: DIAS.map((dia, i) => ({ dia, item: mejores[i] ?? null })),
    };
    setPlan(nuevoPlan);
    await api('/datos/plan-aprendizaje', { method: 'PUT', body: nuevoPlan }).catch(() => {});
  };

  return (
    <div>
      <h2>🧠 Curador de Aprendizaje</h2>
      <p className="texto-suave">Sustituye la TV de fondo: un plan semanal de sesiones de menos de 45 minutos según tus intereses.</p>
      <Chips opciones={INTERESES} seleccion={intereses} onCambio={setIntereses} multiple />
      <button className="boton" onClick={generar} disabled={intereses.length === 0}>
        ✨ Generar plan semanal
      </button>
      {plan && (
        <div style={{ marginTop: 20 }}>
          {plan.sesiones.map(({ dia, item }) => (
            <div className="tarjeta" key={dia} style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 6px' }}>{dia}</h4>
              {!item ? <p className="texto-suave">Día libre.</p> : (
                <>
                  <div><b><a href={item.url} target="_blank" rel="noreferrer">{item.titulo}</a></b></div>
                  <div style={{ margin: '6px 0' }}>
                    <span className="insignia">⏱️ {item.duracionMin} min</span>
                    <span className="insignia">📍 {item.dondeVer}</span>
                  </div>
                  <p className="texto-suave" style={{ margin: 0 }}>
                    🎯 Qué aprenderás: {item.aprenderas ?? item.descripcion}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Conectarlo en `client/src/App.jsx`**

```jsx
import Curador from './modules/aprendizaje/Curador.jsx';
// en MODULOS:
  aprendizaje: Curador,
```

Al terminar esta tarea ya no debe quedar ningún marcador `EN_CONSTRUCCION` en `App.jsx`; eliminar la constante.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`
Expected: al elegir "IA + Negocios" y generar, aparecen 5 tarjetas (Lunes-Viernes) con sesiones ≤45 min, cada una con "🎯 Qué aprenderás". El plan persiste al recargar.

- [ ] **Step 4: Commit**

```bash
git add client/src
git commit -m "feat: modulo Curador de Aprendizaje con plan semanal de sesiones cortas"
```

---

### Task 14: Instalación amigable, README y publicación en GitHub (github.com/fjhr)

**Files:**
- Create: `Iniciar.bat`, `README.md`

**Interfaces:**
- Consumes: scripts raíz de Task 1.

- [ ] **Step 1: Crear `Iniciar.bat`**

```bat
@echo off
chcp 65001 >nul
title Mi Centro de Entretenimiento
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  ❌ Necesitas instalar Node.js primero.
  echo     Descargalo gratis de: https://nodejs.org/es
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo  📦 Primera vez: instalando dependencias, esto tarda 1-2 minutos...
  call npm install
)
echo  🎬 Iniciando Mi Centro de Entretenimiento...
echo     El navegador se abrira solo. Para cerrar la app, cierra esta ventana.
call npm run dev
```

- [ ] **Step 2: Crear `README.md`**

````markdown
# 🎬 Mi Centro de Entretenimiento

Dashboard personal de entretenimiento **gratis, legal y en español**. Corre en tu laptop y convierte las mejores fuentes gratuitas (Tubi, Pluto TV, Internet Archive, Epic Games, Khan Academy…) en un sistema premium con:

- 📺 **Dashboard de Fuentes** — plataformas gratuitas por categoría (películas, series, música, podcasts, anime, libros, juegos, documentales, aprendizaje y torrents legales), con consejos para usarlas como servicio de paga.
- 🎬 **Noche de Cine** — elige tu mood y recibe 10 películas con ratings reales de IMDb y Rotten Tomatoes, dónde verlas gratis en tu país y 3 respaldos.
- 🗓️ **Modo Netflix** — parrilla semanal de 7 "canales" temáticos generada para ti.
- 🍿 **Maratón** — dile cuántas horas tienes y arma tu horario de mañana/tarde/noche.
- 🧠 **Curador de Aprendizaje** — plan semanal de sesiones de <45 min según tus intereses.
- 🎲 **¿Qué veo?** — 4 preguntas (mood, tiempo, energía, compañía) y te da 3 películas + 3 videos + 3 podcasts + 3 juegos + 3 documentales.

> Solo fuentes legales. Los torrents incluidos son de dominio público / Creative Commons (Internet Archive, distros Linux).

## Requisitos

- [Node.js](https://nodejs.org/es) 18 o superior (gratis).

## Instalación y uso (Windows)

1. Descarga o clona este repositorio.
2. **Doble clic en `Iniciar.bat`.** La primera vez instala todo solo (1-2 min) y abre el navegador.

En cualquier sistema: `npm install` y luego `npm start`.

## API keys gratuitas (recomendado)

La app funciona sin configurar nada, pero con dos keys gratuitas (5 minutos, sin tarjeta) se enciende por completo: pósters, ratings IMDb/Rotten Tomatoes y "dónde ver" en tu país.

1. **TMDB**: crea cuenta en [themoviedb.org](https://www.themoviedb.org/signup) y pide tu key en *Ajustes → API*.
2. **OMDb**: pide tu key FREE en [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx).
3. Abre la app → **⚙️ Ajustes** → pega las keys → *Guardar* → *Probar conexión*.

Las keys se guardan solo en tu equipo (`server/data/`, fuera de git).

## Nota si usas OneDrive

Si clonaste el proyecto dentro de una carpeta sincronizada por OneDrive, excluye `node_modules`, `server/cache` y `server/data` de la sincronización (o mueve el proyecto fuera de OneDrive) para evitar lentitud.

## Tecnología

Node.js + Express (proxy con caché a TMDB/OMDb, datos en JSON) · React + Vite · Vitest.

```bash
npm test   # tests del motor de recomendación, planificador y servidor
```
````

- [ ] **Step 3: Verificación final completa**

Run: `npm test`
Expected: PASS (server + client).

Run: doble clic en `Iniciar.bat` (o `npm start`).
Expected: navegador abre en `http://localhost:5173`, las 6 secciones + Ajustes funcionan según las verificaciones de las tareas 7-13.

- [ ] **Step 4: Commit**

```bash
git add Iniciar.bat README.md
git commit -m "docs: README en espanol e Iniciar.bat de doble clic"
```

- [ ] **Step 5: Publicar en el GitHub personal del usuario (github.com/fjhr)**

Verificar si está instalado el CLI de GitHub: `gh --version`.

Si `gh` está disponible y autenticado como `fjhr`:

```bash
gh repo create fjhr/mi-centro-entretenimiento --public --source=. --push
```

Si `gh` no está disponible, indicar al usuario estos pasos (no inventar credenciales):

```bash
# 1. Crear el repo vacío "mi-centro-entretenimiento" en https://github.com/new (cuenta fjhr)
# 2. Luego:
git remote add origin https://github.com/fjhr/mi-centro-entretenimiento.git
git branch -M main
git push -u origin main
```

Expected: el repositorio queda visible en `https://github.com/fjhr/mi-centro-entretenimiento` con todo el código y el README renderizado en español.

