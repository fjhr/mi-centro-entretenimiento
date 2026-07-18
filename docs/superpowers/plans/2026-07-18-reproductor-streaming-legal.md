# Plan de Implementación: Reproductor integrado + streaming legal (Etapa 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproducir dentro de "Mi Centro de Entretenimiento" contenido de Internet Archive y orígenes (URLs/magnets/.torrent) que pasen una validación de allowlist, con WebTorrent en el servidor transmitiendo por HTTP range a un `<video>` estándar.

**Architecture:** Se añade al servidor Express existente: `lib/origen.js` (validación pura), `lib/torrentes.js` (envoltura de WebTorrent con límite de torrents activos), `routes/reproductor.js` (proxy búsqueda/metadatos de Internet Archive con la caché existente) y `routes/stream.js` (validar origen, streaming con range, subtítulos SRT→VTT, cierre). En el cliente React: módulo `Reproducir`, componente `Reproductor` (`<video>`), helpers `lib/reproductor.js`, y una tarjeta de allowlist en Ajustes. La allowlist vive en `server/data/config.json`.

**Tech Stack:** Node ≥18 ESM, Express 4, `webtorrent` (nuevo), React 18, Vite 5, Vitest, Supertest.

## Global Constraints

- **Todo en español:** UI, mensajes de error del servidor, README, commits (sin acentos en el mensaje de commit está bien).
- **Validación no removible:** el streaming de torrents/URLs SOLO procede si `validarOrigen` aprueba el origen contra la allowlist actual; `archive.org`, `*.archive.org` y `bt.archive.org` son de confianza implícita e inamovibles. Un magnet sin webseed/tracker de host permitido se rechaza.
- **Express 4** (rutas nuevas montadas en `crearApp()` ANTES de los estáticos de `client/dist` y del handler 404 JSON).
- **Puertos:** servidor 3001, Vite 5173 (proxy `/api`→3001).
- **Persistencia/caché:** `server/data/` (config, gitignored, override `DIR_DATOS`), `server/cache/` (override `DIR_CACHE`), datos de torrents en `server/cache/torrentes/` (override `DIR_TORRENTES`, gitignored).
- **Errores al cliente:** siempre JSON en español, siguiendo el patrón existente.
- **Config:** las API keys nunca llegan al navegador; `GET /api/config` sigue devolviendo solo `{ region, tieneTmdb, tieneOmdb }` MÁS ahora `allowlist: string[]` (la allowlist no es secreta).
- **Commits frecuentes**, formato `feat:`/`test:`/`chore:`/`docs:`.

## Estructura de archivos

Nuevos:
- `server/lib/origen.js` — validación pura de orígenes.
- `server/lib/torrentes.js` — envoltura de WebTorrent.
- `server/routes/reproductor.js` — proxy Internet Archive.
- `server/routes/stream.js` — streaming, subtítulos, cierre.
- `server/test/origen.test.js`, `server/test/stream.test.js`.
- `client/src/lib/reproductor.js` — helpers de cliente.
- `client/src/components/Reproductor.jsx` — `<video>`.
- `client/src/modules/reproducir/Reproducir.jsx` — sección de búsqueda IA + pegar origen.

Modificados:
- `server/lib/almacen.js` — `allowlist` en config por defecto.
- `server/routes/config.js` — GET incluye `allowlist`; PUT acepta `allowlist`.
- `server/index.js` — montar rutas nuevas.
- `server/package.json` — dependencia `webtorrent`.
- `client/src/App.jsx` — sección "Reproducir".
- `client/src/modules/ajustes/Ajustes.jsx` — tarjeta allowlist.

---

### Task 1: Validación de origen (`lib/origen.js`)

**Files:**
- Create: `server/lib/origen.js`
- Test: `server/test/origen.test.js`

**Interfaces:**
- Produces:
  - `hostPermitido(host: string, allowlist: string[]): boolean` — true si `host` (normalizado: minúsculas, sin puerto) es `archive.org`, termina en `.archive.org`, es `bt.archive.org`, o ∈ allowlist (comparación exacta de host en minúsculas).
  - `validarOrigen(origen: string, allowlist: string[]): { ok: boolean, tipo?: 'ia'|'http'|'torrent'|'torrent-url', motivo?: 'host-no-permitido'|'origen-no-verificable'|'formato-no-soportado' }`.
  - Reglas: URL host `archive.org`/`*.archive.org` → `{ok:true,tipo:'ia'}`. Identificador IA (`^[A-Za-z0-9._-]+$`, sin esquema) → `{ok:true,tipo:'ia'}`. URL http(s) a `.torrent` → `torrent-url` si host permitido, si no `host-no-permitido`. URL http(s) normal → `http` si host permitido, si no `host-no-permitido`. `magnet:?...` → `torrent` si algún `ws`/`xs` tiene host permitido o algún `tr` tiene host permitido; si no `origen-no-verificable`. Otro → `formato-no-soportado`.

- [ ] **Step 1: Escribir el test que falla — `server/test/origen.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { hostPermitido, validarOrigen } from '../lib/origen.js';

const ALLOW = ['jamendo.com', 'miservidor.local'];

describe('hostPermitido', () => {
  it('acepta archive.org y subdominios siempre', () => {
    expect(hostPermitido('archive.org', [])).toBe(true);
    expect(hostPermitido('ia800000.us.archive.org', [])).toBe(true);
    expect(hostPermitido('bt.archive.org', [])).toBe(true);
  });
  it('acepta hosts de la allowlist sin importar mayúsculas/puerto', () => {
    expect(hostPermitido('JAMENDO.com', ALLOW)).toBe(true);
    expect(hostPermitido('miservidor.local', ALLOW)).toBe(true);
  });
  it('rechaza hosts fuera de la lista', () => {
    expect(hostPermitido('ejemplo-pirata.net', ALLOW)).toBe(false);
  });
});

describe('validarOrigen', () => {
  it('acepta identificador de Internet Archive', () => {
    expect(validarOrigen('night_of_the_living_dead', ALLOW)).toEqual({ ok: true, tipo: 'ia' });
  });
  it('acepta URL de archive.org', () => {
    expect(validarOrigen('https://archive.org/details/algo', ALLOW).tipo).toBe('ia');
  });
  it('acepta URL http de host permitido', () => {
    expect(validarOrigen('https://jamendo.com/pista.mp3', ALLOW)).toEqual({ ok: true, tipo: 'http' });
  });
  it('rechaza URL http de host no permitido', () => {
    expect(validarOrigen('https://ejemplo-pirata.net/v.mp4', ALLOW)).toEqual({ ok: false, motivo: 'host-no-permitido' });
  });
  it('acepta .torrent de host permitido', () => {
    expect(validarOrigen('https://miservidor.local/x.torrent', ALLOW)).toEqual({ ok: true, tipo: 'torrent-url' });
  });
  it('acepta magnet con webseed de host permitido', () => {
    const m = 'magnet:?xt=urn:btih:abc&ws=https://miservidor.local/pelicula.mp4';
    expect(validarOrigen(m, ALLOW)).toEqual({ ok: true, tipo: 'torrent' });
  });
  it('acepta magnet con tracker de archive.org', () => {
    const m = 'magnet:?xt=urn:btih:abc&tr=' + encodeURIComponent('udp://bt.archive.org:6969');
    expect(validarOrigen(m, ALLOW)).toEqual({ ok: true, tipo: 'torrent' });
  });
  it('rechaza magnet pelado (sin webseed ni tracker permitido)', () => {
    const m = 'magnet:?xt=urn:btih:abc&tr=' + encodeURIComponent('udp://tracker.publico.net:80');
    expect(validarOrigen(m, ALLOW)).toEqual({ ok: false, motivo: 'origen-no-verificable' });
  });
  it('rechaza basura', () => {
    expect(validarOrigen('cualquier cosa rara', ALLOW)).toEqual({ ok: false, motivo: 'formato-no-soportado' });
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -w server`
Expected: FAIL — no existe `../lib/origen.js`.

- [ ] **Step 3: Implementar `server/lib/origen.js`**

```js
const CONFIABLES = ['archive.org', 'bt.archive.org'];

function normalizarHost(host) {
  return (host || '').toLowerCase().split(':')[0];
}

export function hostPermitido(host, allowlist = []) {
  const h = normalizarHost(host);
  if (!h) return false;
  if (h === 'archive.org' || h.endsWith('.archive.org') || CONFIABLES.includes(h)) return true;
  return allowlist.map((x) => normalizarHost(x)).includes(h);
}

function hostDeUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function hostsDeMagnet(magnet, clave) {
  const params = new URLSearchParams(magnet.slice('magnet:?'.length));
  return params.getAll(clave).map(hostDeUrl).filter(Boolean);
}

export function validarOrigen(origen, allowlist = []) {
  const texto = (origen || '').trim();
  if (!texto) return { ok: false, motivo: 'formato-no-soportado' };

  if (texto.startsWith('magnet:?')) {
    const hosts = [...hostsDeMagnet(texto, 'ws'), ...hostsDeMagnet(texto, 'xs'), ...hostsDeMagnet(texto, 'tr')];
    if (hosts.some((h) => hostPermitido(h, allowlist))) return { ok: true, tipo: 'torrent' };
    return { ok: false, motivo: 'origen-no-verificable' };
  }

  if (/^https?:\/\//i.test(texto)) {
    const host = hostDeUrl(texto);
    if (!host) return { ok: false, motivo: 'formato-no-soportado' };
    if (!hostPermitido(host, allowlist)) return { ok: false, motivo: 'host-no-permitido' };
    return texto.toLowerCase().split('?')[0].endsWith('.torrent')
      ? { ok: true, tipo: 'torrent-url' }
      : { ok: true, tipo: 'http' };
  }

  if (/^[A-Za-z0-9._-]+$/.test(texto)) return { ok: true, tipo: 'ia' };

  return { ok: false, motivo: 'formato-no-soportado' };
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -w server`
Expected: PASS (todos los tests de origen).

- [ ] **Step 5: Commit**

```bash
git add server/lib/origen.js server/test/origen.test.js
git commit -m "feat: validacion de origen legal por allowlist con tests"
```

---

### Task 2: Allowlist en config (`almacen.js` + `routes/config.js`)

**Files:**
- Modify: `server/lib/almacen.js`, `server/routes/config.js`
- Test: `server/test/rutas.test.js` (añadir casos)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `obtenerConfig()` ahora devuelve `{ tmdbKey, omdbKey, region, allowlist }` (allowlist `string[]`, defecto `[]`). `GET /api/config` incluye `allowlist`. `PUT /api/config` acepta `allowlist: string[]` (reemplaza la lista; solo strings no vacíos, normalizados a minúsculas y recortados).

- [ ] **Step 1: Escribir tests que fallan — añadir a `server/test/rutas.test.js`**

Agregar dentro del `describe` existente:

```js
  it('GET /api/config incluye allowlist (vacía por defecto)', async () => {
    const r = await request(app).get('/api/config');
    expect(r.body.allowlist).toEqual([]);
  });

  it('PUT /api/config guarda la allowlist normalizada', async () => {
    await request(app).put('/api/config').send({ allowlist: ['  Jamendo.com ', '', 'MI.local'] });
    const r = await request(app).get('/api/config');
    expect(r.body.allowlist).toEqual(['jamendo.com', 'mi.local']);
  });
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -w server`
Expected: FAIL — `allowlist` es `undefined`.

- [ ] **Step 3: Actualizar `server/lib/almacen.js`**

Cambiar la constante de config por defecto:

```js
const CONFIG_POR_DEFECTO = { tmdbKey: '', omdbKey: '', region: 'MX', allowlist: [] };
```

- [ ] **Step 4: Actualizar `server/routes/config.js`**

En el handler `GET '/'`, incluir `allowlist`:

```js
router.get('/', (req, res) => {
  const c = obtenerConfig();
  res.json({
    region: c.region,
    tieneTmdb: Boolean(c.tmdbKey),
    tieneOmdb: Boolean(c.omdbKey),
    allowlist: c.allowlist ?? [],
  });
});
```

En el handler `PUT '/'`, después de las asignaciones existentes de keys/region y antes de `guardarJson`:

```js
  if (Array.isArray(req.body?.allowlist)) {
    actual.allowlist = req.body.allowlist
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => x.trim().toLowerCase());
  }
```

- [ ] **Step 5: Verificar que pasan**

Run: `npm test -w server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/lib/almacen.js server/routes/config.js server/test/rutas.test.js
git commit -m "feat: allowlist configurable en config del servidor"
```

---

### Task 3: Proxy de Internet Archive (`routes/reproductor.js`)

**Files:**
- Create: `server/routes/reproductor.js`
- Modify: `server/index.js` (montar la ruta)
- Test: (verificación manual con curl; la lógica es un mapeo puro de la respuesta de IA, cubierto por el uso real)

**Interfaces:**
- Consumes: `conCache` de `lib/cache.js`.
- Produces:
  - `GET /api/reproductor/ia/buscar?q=` → `{ resultados: [{ identificador, titulo, anio, tipo, miniatura }] }`.
  - `GET /api/reproductor/ia/:id` → `{ titulo, descripcion, archivos: [{ nombre, formato, url, esVideo, esAudio }], torrent: string|null, subtitulos: [{ idioma, url }] }`.

- [ ] **Step 1: Implementar `server/routes/reproductor.js`**

```js
import { Router } from 'express';
import { conCache } from '../lib/cache.js';

const router = Router();
const UNA_HORA = 60 * 60 * 1000;
const IA = 'https://archive.org';

const EXT_VIDEO = ['.mp4', '.mkv', '.webm', '.ogv', '.m4v', '.mov'];
const EXT_AUDIO = ['.mp3', '.ogg', '.flac', '.m4a', '.wav'];
const EXT_SUB = ['.srt', '.vtt'];

const terminaEn = (nombre, exts) => exts.some((e) => nombre.toLowerCase().endsWith(e));

router.get('/ia/buscar', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'parametros', mensaje: 'Falta el término de búsqueda.' });
  const url = `${IA}/advancedsearch.php?q=${encodeURIComponent(q)}` +
    '&fl[]=identifier&fl[]=title&fl[]=year&fl[]=mediatype' +
    '&rows=40&page=1&output=json';
  try {
    const { valor } = await conCache(`ia-buscar:${q}`, UNA_HORA, async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Internet Archive respondió ${r.status}`);
      return r.json();
    });
    const resultados = (valor.response?.docs ?? []).map((d) => ({
      identificador: d.identifier,
      titulo: d.title ?? d.identifier,
      anio: d.year ?? null,
      tipo: d.mediatype ?? null,
      miniatura: `${IA}/services/img/${d.identifier}`,
    }));
    res.json({ resultados });
  } catch (error) {
    console.error('[ia-buscar]', error.message);
    res.status(502).json({ error: 'ia', mensaje: 'No se pudo buscar en Internet Archive.' });
  }
});

router.get('/ia/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return res.status(400).json({ error: 'id-invalido', mensaje: 'Identificador inválido.' });
  try {
    const { valor } = await conCache(`ia-meta:${id}`, UNA_HORA, async () => {
      const r = await fetch(`${IA}/metadata/${id}`);
      if (!r.ok) throw new Error(`Internet Archive respondió ${r.status}`);
      return r.json();
    });
    const lista = valor.files ?? [];
    const archivos = lista
      .filter((f) => terminaEn(f.name, EXT_VIDEO) || terminaEn(f.name, EXT_AUDIO))
      .map((f) => ({
        nombre: f.name,
        formato: f.format ?? '',
        url: `${IA}/download/${id}/${encodeURIComponent(f.name)}`,
        esVideo: terminaEn(f.name, EXT_VIDEO),
        esAudio: terminaEn(f.name, EXT_AUDIO),
      }));
    const torrentFile = lista.find((f) => f.name.toLowerCase().endsWith('_archive.torrent') || f.name.toLowerCase().endsWith('.torrent'));
    const subtitulos = lista
      .filter((f) => terminaEn(f.name, EXT_SUB))
      .map((f) => ({ idioma: 'sub', url: `${IA}/download/${id}/${encodeURIComponent(f.name)}` }));
    res.json({
      titulo: valor.metadata?.title ?? id,
      descripcion: Array.isArray(valor.metadata?.description) ? valor.metadata.description[0] : (valor.metadata?.description ?? ''),
      archivos,
      torrent: torrentFile ? `${IA}/download/${id}/${encodeURIComponent(torrentFile.name)}` : null,
      subtitulos,
    });
  } catch (error) {
    console.error('[ia-meta]', error.message);
    res.status(502).json({ error: 'ia', mensaje: 'No se pudo obtener el contenido de Internet Archive.' });
  }
});

export default router;
```

- [ ] **Step 2: Montar en `server/index.js`**

Agregar el import y el `app.use` (antes de los estáticos y del 404):

```js
import reproductorRouter from './routes/reproductor.js';
// ...dentro de crearApp(), junto a los otros app.use('/api/...'):
  app.use('/api/reproductor', reproductorRouter);
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev -w server` en una terminal; en otra:
`curl "http://localhost:3001/api/reproductor/ia/buscar?q=night%20of%20the%20living%20dead"`
Expected: JSON con `resultados` no vacío. Luego con un identificador real de la respuesta:
`curl "http://localhost:3001/api/reproductor/ia/<identificador>"`
Expected: JSON con `archivos` (al menos un `esVideo:true`) y normalmente `torrent` no nulo. Detener el servidor.

- [ ] **Step 4: Commit**

```bash
git add server/routes/reproductor.js server/index.js
git commit -m "feat: proxy de busqueda y metadatos de Internet Archive"
```

---

### Task 4: Envoltura de WebTorrent (`lib/torrentes.js`)

**Files:**
- Modify: `server/package.json` (dependencia `webtorrent`)
- Create: `server/lib/torrentes.js`
- Test: `server/test/torrentes.test.js`

**Interfaces:**
- Produces (async, un único cliente WebTorrent perezoso por proceso):
  - `agregar(origen: string): Promise<{ id: string, archivos: [{ indice, nombre, longitud, reproducible }] }>` — `id` = infohash; añade el torrent (o lo reutiliza si ya existe); `reproducible` true para extensiones de video/audio.
  - `obtenerArchivo(id: string, indice: number): { length, tipoMime, crear(rango?: {start,end}): ReadableStream } | null` — null si no existe.
  - `cerrar(id: string): Promise<void>` — destruye el torrent y borra sus datos.
  - `MAX_ACTIVOS = 3` — al superar el límite, se destruye el torrent más antiguo (por orden de adición).
  - `_destruirCliente(): Promise<void>` — solo para tests (cierra el cliente y limpia).
- Datos en `process.env.DIR_TORRENTES || server/cache/torrentes`.

- [ ] **Step 1: Añadir dependencia en `server/package.json`**

Añadir a `dependencies`:

```json
    "webtorrent": "^2.5.1"
```

Luego instalar:

Run: `npm install`
Expected: instala `webtorrent` sin errores.

- [ ] **Step 2: Escribir el test que falla — `server/test/torrentes.test.js`**

Usa un `.torrent` de prueba diminuto generado en caliente con `create-torrent` (viene como dependencia transitiva de webtorrent) sobre un archivo temporal; siembra con un cliente y descarga con la envoltura. Si el sembrado P2P resulta inestable en CI, el test valida el camino de metadatos y `obtenerArchivo` sobre el torrent ya agregado.

```js
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import createTorrent from 'create-torrent';
import WebTorrent from 'webtorrent';

process.env.DIR_TORRENTES = fs.mkdtempSync(path.join(os.tmpdir(), 'tor-'));
const { agregar, obtenerArchivo, cerrar, _destruirCliente } = await import('../lib/torrentes.js');

// Prepara un archivo y su .torrent con webseed apuntando a un sembrador local.
const dirFuente = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
const archivo = path.join(dirFuente, 'saludo.txt');
fs.writeFileSync(archivo, 'hola mundo '.repeat(1000));

function crearTorrentBuffer() {
  return new Promise((resolve, reject) => {
    createTorrent(archivo, (err, torrent) => (err ? reject(err) : resolve(torrent)));
  });
}

const sembrador = new WebTorrent();

afterAll(async () => {
  await new Promise((r) => sembrador.destroy(r));
  await _destruirCliente();
});

describe('torrentes', () => {
  it('agrega un torrent y lista sus archivos', async () => {
    const buffer = await crearTorrentBuffer();
    await new Promise((resolve) => sembrador.seed(archivo, resolve));
    const { id, archivos } = await agregar(buffer);
    expect(id).toMatch(/^[a-f0-9]{40}$/i);
    expect(archivos[0].nombre).toBe('saludo.txt');
    expect(archivos[0].reproducible).toBe(false);
    const handle = obtenerArchivo(id, 0);
    expect(handle.length).toBeGreaterThan(0);
    await cerrar(id);
  }, 30000);
});
```

- [ ] **Step 3: Verificar que falla**

Run: `npm test -w server`
Expected: FAIL — no existe `../lib/torrentes.js`.

- [ ] **Step 4: Implementar `server/lib/torrentes.js`**

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const MAX_ACTIVOS = 3;

const EXT_REPRODUCIBLE = ['.mp4', '.mkv', '.webm', '.ogv', '.m4v', '.mov', '.mp3', '.ogg', '.flac', '.m4a', '.wav'];
const MIME = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
};

function dirDatos() {
  return process.env.DIR_TORRENTES || path.join(aqui, '..', 'cache', 'torrentes');
}
function ext(nombre) {
  return nombre.slice(nombre.lastIndexOf('.')).toLowerCase();
}

let clientePromesa = null;
const orden = []; // infohashes por orden de adición

async function cliente() {
  if (!clientePromesa) {
    clientePromesa = import('webtorrent').then(({ default: WebTorrent }) => new WebTorrent());
  }
  return clientePromesa;
}

export async function agregar(origen) {
  const wt = await cliente();
  const existente = wt.torrents.find((t) => t.infoHash && origen.toString().toLowerCase().includes(t.infoHash));
  const torrent = existente || await new Promise((resolve, reject) => {
    const t = wt.add(origen, { path: dirDatos() }, () => resolve(t));
    t.on('error', reject);
  });
  if (!orden.includes(torrent.infoHash)) {
    orden.push(torrent.infoHash);
    while (orden.length > MAX_ACTIVOS) {
      const viejo = orden.shift();
      const t = wt.torrents.find((x) => x.infoHash === viejo);
      if (t) t.destroy({ destroyStore: true });
    }
  }
  return {
    id: torrent.infoHash,
    archivos: torrent.files.map((f, i) => ({
      indice: i,
      nombre: f.name,
      longitud: f.length,
      reproducible: EXT_REPRODUCIBLE.includes(ext(f.name)),
    })),
  };
}

export function obtenerArchivo(id, indice) {
  if (!clientePromesa) return null;
  // clientePromesa ya resuelto en este punto de uso (tras agregar); acceso síncrono al cliente cacheado:
  const wt = obtenerArchivo._wt;
  const torrent = wt?.torrents.find((t) => t.infoHash === id);
  const archivo = torrent?.files?.[indice];
  if (!archivo) return null;
  return {
    length: archivo.length,
    tipoMime: MIME[ext(archivo.name)] || 'application/octet-stream',
    crear(rango) {
      return archivo.createReadStream(rango);
    },
  };
}

export async function cerrar(id) {
  const wt = await cliente();
  const t = wt.torrents.find((x) => x.infoHash === id);
  if (t) await new Promise((r) => t.destroy({ destroyStore: true }, r));
  const i = orden.indexOf(id);
  if (i >= 0) orden.splice(i, 1);
}

export async function _destruirCliente() {
  if (!clientePromesa) return;
  const wt = await clientePromesa;
  await new Promise((r) => wt.destroy(r));
  clientePromesa = null;
  obtenerArchivo._wt = null;
  orden.length = 0;
}

// Mantener una referencia síncrona al cliente para obtenerArchivo:
cliente().then((wt) => { obtenerArchivo._wt = wt; });
```

- [ ] **Step 5: Verificar que pasa**

Run: `npm test -w server`
Expected: PASS (test de torrentes; puede tardar). Si el sembrado P2P local falla en el entorno, reportar como DONE_WITH_CONCERNS y dejar el test que valida `agregar`/`obtenerArchivo` con el `.torrent` (metadatos), que no requiere descarga completa.

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/lib/torrentes.js server/test/torrentes.test.js
git commit -m "feat: envoltura de WebTorrent con limite de torrentes activos"
```

> Nota para el ejecutor: el acceso síncrono a `obtenerArchivo._wt` funciona porque `obtenerArchivo` solo se invoca desde la ruta de streaming DESPUÉS de que `agregar` (async) ya resolvió el cliente. Si en revisión se juzga frágil, sustituir `obtenerArchivo` por `async obtenerArchivo(id, indice)` que haga `await cliente()`; en ese caso, ajustar la ruta de streaming de la Task 5 para usar `await`. Preferir la versión async si hay cualquier duda.

---

### Task 5: Rutas de streaming (`routes/stream.js`)

**Files:**
- Create: `server/routes/stream.js`
- Modify: `server/index.js` (montar la ruta)
- Test: `server/test/stream.test.js`

**Interfaces:**
- Consumes: `validarOrigen` (Task 1), `obtenerConfig` (Task 2), `agregar`/`obtenerArchivo`/`cerrar` (Task 4).
- Produces:
  - `POST /api/stream/torrent` `{ origen }` → `400 { error:'origen-rechazado', motivo }` si `validarOrigen` falla; si pasa, `{ id, archivos }`.
  - `GET /api/stream/torrent/:id/:indice` → streaming con `Accept-Ranges: bytes`; ante `Range` responde `206` con `Content-Range`; sin `Range`, `200` con `Content-Length`. `404` si no existe.
  - `GET /api/stream/subtitulo?url=` → valida host (allowlist/IA); descarga; `.srt`→WebVTT (`text/vtt`); `.vtt` tal cual. `400`/`502` con JSON español en error.
  - `DELETE /api/stream/torrent/:id` → `{ ok: true }`.
  - `srtAVtt(texto: string): string` (exportado para test): antepone `WEBVTT\n\n` y reemplaza las comas de los timestamps por puntos.

- [ ] **Step 1: Escribir tests que fallan — `server/test/stream.test.js`**

```js
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DIR_DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-'));
const { crearApp } = await import('../index.js');
const { srtAVtt } = await import('../routes/stream.js');
const app = crearApp();

describe('srtAVtt', () => {
  it('convierte SRT a WebVTT', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nHola\n';
    const vtt = srtAVtt(srt);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:02.500');
  });
});

describe('POST /api/stream/torrent validación', () => {
  it('rechaza un magnet pelado con 400 y motivo', async () => {
    const r = await request(app)
      .post('/api/stream/torrent')
      .send({ origen: 'magnet:?xt=urn:btih:abc&tr=udp%3A%2F%2Ftracker.publico.net%3A80' });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'origen-rechazado', motivo: 'origen-no-verificable' });
  });

  it('rechaza una URL de host no permitido', async () => {
    const r = await request(app).post('/api/stream/torrent').send({ origen: 'https://ejemplo-pirata.net/x.torrent' });
    expect(r.status).toBe(400);
    expect(r.body.motivo).toBe('host-no-permitido');
  });
});

describe('GET /api/stream/torrent/:id/:indice inexistente', () => {
  it('responde 404 si el torrent no existe', async () => {
    const r = await request(app).get('/api/stream/torrent/0000000000000000000000000000000000000000/0');
    expect(r.status).toBe(404);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -w server`
Expected: FAIL — no existe `../routes/stream.js`.

- [ ] **Step 3: Implementar `server/routes/stream.js`**

```js
import { Router } from 'express';
import { validarOrigen } from '../lib/origen.js';
import { obtenerConfig } from '../lib/almacen.js';
import { agregar, obtenerArchivo, cerrar } from '../lib/torrentes.js';

const router = Router();

export function srtAVtt(texto) {
  const cuerpo = texto.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${cuerpo}`;
}

router.post('/torrent', async (req, res) => {
  const origen = (req.body?.origen || '').toString();
  const { allowlist } = obtenerConfig();
  const v = validarOrigen(origen, allowlist);
  if (!v.ok) return res.status(400).json({ error: 'origen-rechazado', motivo: v.motivo });
  try {
    const info = await agregar(origen);
    res.json(info);
  } catch (error) {
    console.error('[stream-torrent]', error.message);
    res.status(502).json({ error: 'torrent', mensaje: 'No se pudo abrir el torrent.' });
  }
});

router.get('/torrent/:id/:indice', (req, res) => {
  const archivo = obtenerArchivo(req.params.id, Number(req.params.indice));
  if (!archivo) return res.status(404).json({ error: 'no-encontrado', mensaje: 'Recurso no disponible.' });
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', archivo.tipoMime);
  const rango = req.headers.range;
  if (rango) {
    const m = /bytes=(\d*)-(\d*)/.exec(rango);
    const start = m && m[1] ? Number(m[1]) : 0;
    const end = m && m[2] ? Number(m[2]) : archivo.length - 1;
    if (start >= archivo.length || end >= archivo.length || start > end) {
      res.setHeader('Content-Range', `bytes */${archivo.length}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${archivo.length}`);
    res.setHeader('Content-Length', end - start + 1);
    archivo.crear({ start, end }).pipe(res);
  } else {
    res.status(200);
    res.setHeader('Content-Length', archivo.length);
    archivo.crear().pipe(res);
  }
});

router.get('/subtitulo', async (req, res) => {
  const url = (req.query.url || '').toString();
  const { allowlist } = obtenerConfig();
  const v = validarOrigen(url, allowlist);
  if (!v.ok || (v.tipo !== 'http' && v.tipo !== 'ia')) {
    return res.status(400).json({ error: 'origen-rechazado', motivo: v.motivo || 'formato-no-soportado' });
  }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Subtítulo respondió ${r.status}`);
    const texto = await r.text();
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send(url.toLowerCase().split('?')[0].endsWith('.vtt') ? texto : srtAVtt(texto));
  } catch (error) {
    console.error('[subtitulo]', error.message);
    res.status(502).json({ error: 'subtitulo', mensaje: 'No se pudo cargar el subtítulo.' });
  }
});

router.delete('/torrent/:id', async (req, res) => {
  await cerrar(req.params.id);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 4: Montar en `server/index.js`**

```js
import streamRouter from './routes/stream.js';
// dentro de crearApp(), junto a los otros app.use('/api/...'):
  app.use('/api/stream', streamRouter);
```

- [ ] **Step 5: Verificar que pasan**

Run: `npm test -w server`
Expected: PASS (srtAVtt, rechazos 400, 404).

- [ ] **Step 6: Verificación manual de streaming con range**

Con el servidor corriendo y un `.torrent` de Internet Archive (obtenido de `/api/reproductor/ia/:id`):
```bash
curl -s -X POST http://localhost:3001/api/stream/torrent -H "Content-Type: application/json" \
  -d '{"origen":"https://archive.org/download/<id>/<id>_archive.torrent"}'
# tomar el id devuelto y probar range:
curl -s -D - -o /dev/null -H "Range: bytes=0-1023" "http://localhost:3001/api/stream/torrent/<id>/0"
```
Expected: la segunda respuesta trae `HTTP/1.1 206 Partial Content` y `Content-Range: bytes 0-1023/...`. Detener el servidor.

- [ ] **Step 7: Commit**

```bash
git add server/routes/stream.js server/index.js server/test/stream.test.js
git commit -m "feat: rutas de streaming con range, subtitulos y cierre de torrent"
```

---

### Task 6: Helpers de cliente y componente Reproductor

**Files:**
- Create: `client/src/lib/reproductor.js`, `client/src/components/Reproductor.jsx`
- Test: `client/src/lib/reproductor.test.js`

**Interfaces:**
- Consumes: `api()` de `lib/api.js` (fetch a `/api...`, lanza `Error` con `.codigo`/`.status`).
- Produces:
  - `buscarIA(q: string): Promise<{ resultados: [...] }>`.
  - `abrirIA(id: string): Promise<{ titulo, descripcion, archivos, torrent, subtitulos }>`.
  - `abrirTorrent(origen: string): Promise<{ id, archivos }>` (POST /api/stream/torrent).
  - `cerrarTorrent(id: string): Promise<void>` (DELETE, ignora errores).
  - `urlStream(id, indice): string` = `/api/stream/torrent/${id}/${indice}`.
  - `urlSubtitulo(url): string` = `/api/stream/subtitulo?url=${encodeURIComponent(url)}`.
  - `MOTIVOS: Record<string,string>` — traducciones español de los motivos de rechazo.
  - `<Reproductor fuente={...} onCerrar?={fn} />` donde `fuente` es `{ tipo:'directo', url, subtitulos? }` o `{ tipo:'torrent', id, archivos, subtitulos? }`.

- [ ] **Step 1: Escribir el test que falla — `client/src/lib/reproductor.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { urlStream, urlSubtitulo, MOTIVOS } from './reproductor.js';

describe('helpers de reproductor', () => {
  it('construye la URL de streaming', () => {
    expect(urlStream('abc', 2)).toBe('/api/stream/torrent/abc/2');
  });
  it('codifica la URL del subtítulo', () => {
    expect(urlSubtitulo('https://x/y z.srt')).toBe('/api/stream/subtitulo?url=https%3A%2F%2Fx%2Fy%20z.srt');
  });
  it('traduce los motivos de rechazo al español', () => {
    expect(MOTIVOS['origen-no-verificable']).toMatch(/verific/i);
    expect(MOTIVOS['host-no-permitido']).toMatch(/permit/i);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -w client`
Expected: FAIL — no existe `./reproductor.js`.

- [ ] **Step 3: Implementar `client/src/lib/reproductor.js`**

```js
import { api } from './api.js';

export const MOTIVOS = {
  'host-no-permitido': 'Ese host no está en tu lista de fuentes permitidas. Agrégalo en Ajustes si tienes derecho a usarlo.',
  'origen-no-verificable': 'No se pudo verificar el origen (un magnet necesita un webseed o tracker de una fuente permitida).',
  'formato-no-soportado': 'Formato no soportado. Usa un identificador de Internet Archive, una URL o un magnet/.torrent.',
};

export function buscarIA(q) {
  return api(`/reproductor/ia/buscar?q=${encodeURIComponent(q)}`);
}
export function abrirIA(id) {
  return api(`/reproductor/ia/${encodeURIComponent(id)}`);
}
export function abrirTorrent(origen) {
  return api('/stream/torrent', { method: 'POST', body: { origen } });
}
export function cerrarTorrent(id) {
  return api(`/stream/torrent/${id}`, { method: 'DELETE' }).catch(() => {});
}
export function urlStream(id, indice) {
  return `/api/stream/torrent/${id}/${indice}`;
}
export function urlSubtitulo(url) {
  return `/api/stream/subtitulo?url=${encodeURIComponent(url)}`;
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -w client`
Expected: PASS.

- [ ] **Step 5: Implementar `client/src/components/Reproductor.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { urlStream, urlSubtitulo } from '../lib/reproductor.js';

export default function Reproductor({ fuente, onCerrar }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => { setIndice(0); }, [fuente]);

  if (!fuente) return null;

  const reproducibles = fuente.tipo === 'torrent'
    ? fuente.archivos.filter((a) => a.reproducible)
    : [];
  const src = fuente.tipo === 'directo'
    ? fuente.url
    : urlStream(fuente.id, (reproducibles[indice] ?? fuente.archivos[0]).indice);

  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>▶️ Reproduciendo</h3>
        {onCerrar && <button className="chip" onClick={onCerrar}>✕ Cerrar</button>}
      </div>
      <video
        key={src}
        className="poster"
        style={{ width: '100%', aspectRatio: '16/9', height: 'auto', background: '#000' }}
        src={src}
        controls
        autoPlay
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

- [ ] **Step 6: Verificar build**

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso.

- [ ] **Step 7: Commit**

```bash
git add client/src/lib/reproductor.js client/src/lib/reproductor.test.js client/src/components/Reproductor.jsx
git commit -m "feat: helpers de reproductor y componente de video con subtitulos"
```

---

### Task 7: Módulo Reproducir + navegación

**Files:**
- Create: `client/src/modules/reproducir/Reproducir.jsx`
- Modify: `client/src/App.jsx` (sección "Reproducir")

**Interfaces:**
- Consumes: `buscarIA`, `abrirIA`, `abrirTorrent`, `cerrarTorrent`, `MOTIVOS` (Task 6); `<Reproductor>` (Task 6).

- [ ] **Step 1: Implementar `client/src/modules/reproducir/Reproducir.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import { buscarIA, abrirIA, abrirTorrent, cerrarTorrent, MOTIVOS } from '../../lib/reproductor.js';

export default function Reproducir() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fuente, setFuente] = useState(null);
  const [origen, setOrigen] = useState('');
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

  const reproducirIA = async (id) => {
    setError(null); cerrarReproductor();
    try {
      const meta = await abrirIA(id);
      const video = meta.archivos.find((a) => a.esVideo) || meta.archivos.find((a) => a.esAudio);
      if (video) {
        setFuente({ tipo: 'directo', url: video.url, subtitulos: meta.subtitulos });
      } else if (meta.torrent) {
        const { id: tid, archivos } = await abrirTorrent(meta.torrent);
        torrentActivo.current = tid;
        setFuente({ tipo: 'torrent', id: tid, archivos, subtitulos: meta.subtitulos });
      } else {
        setError('Este elemento no tiene archivos reproducibles.');
      }
    } catch (err) {
      setError('No se pudo abrir el contenido.');
    }
  };

  const reproducirOrigen = async (e) => {
    e?.preventDefault();
    if (!origen.trim()) return;
    setError(null); cerrarReproductor();
    try {
      const { id, archivos } = await abrirTorrent(origen.trim());
      torrentActivo.current = id;
      setFuente({ tipo: 'torrent', id, archivos });
    } catch (err) {
      setError(MOTIVOS[err.motivo || err.codigo] || 'No se pudo abrir el origen. Revisa que esté en tu lista de fuentes permitidas (Ajustes).');
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
            <div className="tarjeta" key={r.identificador} style={{ cursor: 'pointer' }} onClick={() => reproducirIA(r.identificador)}>
              <img className="poster" src={r.miniatura} alt={r.titulo} loading="lazy" style={{ aspectRatio: '1', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              <h4 style={{ margin: '8px 0 2px' }}>{r.titulo}</h4>
              <span className="texto-suave">{r.tipo}{r.anio ? ` · ${r.anio}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Conectar en `client/src/App.jsx`**

Añadir el import, una entrada en `SECCIONES` y el mapeo en `MODULOS`:

```jsx
import Reproducir from './modules/reproducir/Reproducir.jsx';
// en SECCIONES, tras ['fuentes', '📺 Fuentes']:
  ['reproducir', '🎬 Reproducir'],
// en MODULOS:
  reproducir: Reproducir,
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev` (raíz).
Expected: nueva sección "🎬 Reproducir". Buscar "night of the living dead" → resultados con miniatura; clic reproduce (directo si hay MP4, si no vía torrent). Pegar un magnet pelado → aviso en español "No se pudo verificar el origen…". Pegar un `.torrent` de archive.org → reproduce. Detener.

- [ ] **Step 4: Commit**

```bash
git add client/src
git commit -m "feat: modulo Reproducir con busqueda IA y reproduccion de origenes permitidos"
```

---

### Task 8: Editor de allowlist en Ajustes

**Files:**
- Modify: `client/src/modules/ajustes/Ajustes.jsx`

**Interfaces:**
- Consumes: `api()`; `useConfig()` (ahora `config.allowlist`).

- [ ] **Step 1: Añadir la tarjeta de allowlist en `client/src/modules/ajustes/Ajustes.jsx`**

Dentro del componente, añadir estado y handlers (junto a los existentes):

```jsx
  const [hosts, setHosts] = useState(config?.allowlist ?? []);
  const [nuevoHost, setNuevoHost] = useState('');

  const guardarAllowlist = async (lista) => {
    setHosts(lista);
    await api('/config', { method: 'PUT', body: { allowlist: lista } });
    await recargar();
  };
  const agregarHost = () => {
    const h = nuevoHost.trim().toLowerCase();
    if (h && !hosts.includes(h)) guardarAllowlist([...hosts, h]);
    setNuevoHost('');
  };
  const quitarHost = (h) => guardarAllowlist(hosts.filter((x) => x !== h));
```

Y renderizar una tarjeta nueva después de la tarjeta de API keys, dentro del mismo contenedor:

```jsx
      <div className="tarjeta" style={{ maxWidth: 560, marginTop: 20 }}>
        <h3>Fuentes permitidas (allowlist)</h3>
        <p className="texto-suave">
          Solo se reproducen orígenes de esta lista, más Internet Archive (siempre permitido).
          Agrega hosts de fuentes legales que tengas derecho a usar. Un magnet sin webseed o tracker
          de un host permitido se rechazará.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="ejemplo: jamendo.com" value={nuevoHost}
            onChange={(e) => setNuevoHost(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarHost()} style={{ flex: 1 }} />
          <button className="boton" onClick={agregarHost}>Agregar</button>
        </div>
        <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: 'none' }}>
          <li className="texto-suave" style={{ marginBottom: 6 }}>archive.org · bt.archive.org (siempre permitidos)</li>
          {hosts.map((h) => (
            <li key={h} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span>{h}</span>
              <button className="chip" onClick={() => quitarHost(h)}>Quitar</button>
            </li>
          ))}
        </ul>
      </div>
```

Asegurar que `useState` está importado (ya lo está) y que `hosts` se sincroniza si `config` llega después: añadir tras los `useState`:

```jsx
  useEffect(() => { if (config?.allowlist) setHosts(config.allowlist); }, [config?.allowlist]);
```

(añadir `useEffect` al import de React si no está: `import { useState, useEffect } from 'react';`)

- [ ] **Step 2: Verificación manual**

Run: `npm run dev`
Expected: en Ajustes aparece "Fuentes permitidas"; agregar `jamendo.com` lo persiste (recargar la página lo mantiene); quitarlo también persiste. En Reproducir, una URL de un host recién agregado ya no se rechaza por `host-no-permitido`.

- [ ] **Step 3: Commit**

```bash
git add client/src/modules/ajustes/Ajustes.jsx
git commit -m "feat: editor de allowlist de fuentes permitidas en Ajustes"
```

---

### Task 9: Documentación y cierre

**Files:**
- Modify: `README.md`, `CLAUDE.md`, `.gitignore`

**Interfaces:** —

- [ ] **Step 1: Actualizar `.gitignore`**

Añadir (si no está ya cubierto por `server/cache/`): confirmar que `server/cache/` ya ignora `server/cache/torrentes/`. No requiere cambios si `server/cache/` está presente. Si se usa `DIR_TORRENTES` fuera de cache, añadir esa ruta. (Verificar; normalmente no hay cambios.)

- [ ] **Step 2: Actualizar `README.md`**

Añadir una sección tras la lista de módulos:

```markdown
## 🎬 Reproducir (streaming legal)

Reproduce dentro de la app contenido de **Internet Archive** (búscalo en la sección Reproducir) y orígenes propios que agregues a tu **lista de fuentes permitidas** en Ajustes. Soporta URLs de video, enlaces `.torrent` y magnets **con webseed/tracker de un host permitido**, transmitiendo con WebTorrent mientras descarga.

> Por diseño, un magnet sin origen verificable (solo infohash y trackers públicos) se rechaza: la app reproduce Internet Archive y las fuentes legales que tú autorices, no es un buscador de contenido con copyright.
```

- [ ] **Step 3: Actualizar `CLAUDE.md`**

Añadir bajo la sección de arquitectura del servidor y cliente un resumen de las piezas nuevas:

```markdown
### Reproductor / streaming legal (Etapa 1)

- `server/lib/origen.js`: `validarOrigen(origen, allowlist)` / `hostPermitido` — guardarraíl legal. `archive.org`/`*.archive.org`/`bt.archive.org` de confianza implícita; magnet solo pasa con webseed/tracker de host permitido. NO removible.
- `server/lib/torrentes.js`: envoltura de WebTorrent (cliente único perezoso, `MAX_ACTIVOS=3`, datos en `server/cache/torrentes/`).
- `server/routes/reproductor.js`: proxy búsqueda/metadatos de Internet Archive (con `conCache`).
- `server/routes/stream.js`: `POST /torrent` (valida origen), `GET /torrent/:id/:indice` (HTTP range → 206), `GET /subtitulo` (SRT→VTT), `DELETE /torrent/:id`.
- Cliente: `modules/reproducir/`, `components/Reproductor.jsx`, `lib/reproductor.js`; allowlist editable en Ajustes; `config.allowlist` en `GET/PUT /api/config`.
```

- [ ] **Step 4: Verificación final completa**

Run: `npm test` (raíz)
Expected: PASS (server + client, incluidos origen/stream/torrentes y reproductor).

Run: `npm start` y probar en el navegador la sección Reproducir end-to-end (buscar IA, reproducir, pegar origen permitido y rechazado, editar allowlist).

- [ ] **Step 5: Commit y push**

```bash
git add README.md CLAUDE.md .gitignore
git commit -m "docs: seccion Reproducir en README y CLAUDE"
git push
```
