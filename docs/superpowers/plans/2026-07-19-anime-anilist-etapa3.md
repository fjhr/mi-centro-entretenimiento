# Plan de Implementación: Anime legal con AniList (Etapa 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir descubrimiento de anime (calendario, tendencias, buscador con fichas ricas de AniList) a "Mi Centro de Entretenimiento", integrado con la biblioteca de la Etapa 2, sin reproducir nada dentro de la app.

**Architecture:** Un proxy con caché al GraphQL público de AniList (`server/routes/anilist.js`, mismo patrón que `reproductor.js`/`tmdb.js`) expone rutas REST simples. En el cliente, un componente compartido `FichaAnime.jsx` (autosuficiente como `Reproductor.jsx` de la Etapa 2 — gestiona su propio guardado/visto) se reutiliza en tres lugares: la nueva sección "🎌 Anime", la pestaña "Anime" de Reproducir, y la vista de Inicio cuando reanudas un origen `anilist:`. Nada de esto pasa por `validarOrigen`/WebTorrent: los botones "Ver en {fuente}" son enlaces de salida a sitios legales, siguiendo el mismo patrón de "búsqueda sugerida" que ya usa `ModoNetflix.jsx`.

**Tech Stack:** Node ≥18 ESM, Express 4, Vitest, Supertest, React 18.

## Global Constraints

- **Todo en español:** UI, mensajes de error del servidor.
- **AniList es solo metadatos, nunca reproducción:** ningún dato de AniList pasa por `validarOrigen`, WebTorrent o el reproductor de video. Los botones "Ver en {fuente}" abren pestañas nuevas a sitios externos.
- **Corrección del umbral automático (no negociable):** al registrar la apertura de un anime se usa `posicionSeg:1, duracionSeg:1200` (NUNCA `1/1`), para que la proporción quede muy por debajo del 90% y no se marque "visto" solo. Marcar visto es siempre una acción manual del usuario.
- **Orden de rutas Express:** en `server/routes/anilist.js`, las rutas de path literal (`/buscar`, `/calendario`, `/tendencias`) deben registrarse ANTES que la ruta paramétrica `/:id` — si no, Express intentaría interpretar "buscar"/"calendario"/"tendencias" como un id numérico y las tres rutas literales quedarían inalcanzables.
- **Caché:** vía `conCache` existente (`server/lib/cache.js`). 6h para búsqueda/ficha/tendencias, 1h para calendario.
- **Errores del servidor:** `502 { error:'anilist', mensaje:'No se pudo consultar AniList en este momento.' }` ante cualquier fallo de AniList; `400` con slug propio ante entrada inválida.
- **Montaje:** nueva ruta en `crearApp()` (`server/index.js`) en el grupo `/api/*`, antes de los estáticos y el 404.
- **Componentes autosuficientes:** `FichaAnime.jsx` gestiona `guardarProgreso`/`alternarGuardado`/`alternarVisto` internamente — los módulos que la usan (Anime.jsx, Reproducir.jsx, Inicio.jsx) no gestionan persistencia de biblioteca para anime.
- **Commits frecuentes**, formato `feat:`/`test:`/`docs:`.

## Estructura de archivos

Nuevos:
- `server/routes/anilist.js` — proxy AniList.
- `server/test/anilist.test.js`.
- `client/src/lib/anilist.js` — helpers HTTP + `fuentesLegalesDe`.
- `client/src/lib/anilist.test.js`.
- `client/src/components/FichaAnime.jsx` — ficha reutilizable con guardar/visto/ver-en-fuente.
- `client/src/modules/anime/Anime.jsx` — sección Calendario/Tendencias/Buscador.

Modificados:
- `client/src/catalog/fuentes.json` — 6 plataformas de anime nuevas.
- `server/index.js` — montar `/api/anilist`.
- `client/src/App.jsx` — sección "🎌 Anime".
- `client/src/modules/reproducir/Reproducir.jsx` — pestaña Anime.
- `client/src/modules/inicio/Inicio.jsx` — maneja orígenes `anilist:`.
- `README.md`, `CLAUDE.md`.

---

### Task 1: Ampliar el catálogo de fuentes de anime

**Files:**
- Modify: `client/src/catalog/fuentes.json`

**Interfaces:** ninguna nueva — mismo esquema que las entradas existentes de `categoria:'anime'`.

- [ ] **Step 1: Añadir 6 entradas al array de `client/src/catalog/fuentes.json`**

Insertar estos objetos (mismo formato que las entradas `categoria:'anime'` ya existentes en el archivo — mantener el resto del archivo intacto, solo añadir estos 6 elementos al array, en cualquier posición junto a las demás entradas de anime):

```json
  {
    "nombre": "Toei Animation (YouTube oficial)",
    "url": "https://www.youtube.com/@ToeiAnimation",
    "categoria": "anime",
    "mejorPara": "Episodios completos oficiales de Dragon Ball, One Piece, Sailor Moon y más, sub y doblado",
    "registro": false,
    "regiones": "*",
    "anuncios": true,
    "consejoPremium": "Sube contenido directo del estudio; revisa la sección 'Episodios completos' de cada canal regional."
  },
  {
    "nombre": "TMS Anime Latino",
    "url": "https://www.youtube.com/@TMSAnimeLatino",
    "categoria": "anime",
    "mejorPara": "Anime doblado al español latino, canal oficial con más de 1.3M de suscriptores",
    "registro": false,
    "regiones": "*",
    "anuncios": true,
    "consejoPremium": "Busca las listas de reproducción por serie completa en vez de navegar episodio por episodio."
  },
  {
    "nombre": "Anime Log",
    "url": "https://www.youtube.com/@AnimeLog",
    "categoria": "anime",
    "mejorPara": "Anime clásico de estudios japoneses subido gratis y legal por los propios estudios",
    "registro": false,
    "regiones": "*",
    "anuncios": true,
    "consejoPremium": "Varios estudios japoneses se unieron aquí para liberar catálogo histórico; ideal para clásicos difíciles de encontrar."
  },
  {
    "nombre": "Crunchyroll (YouTube oficial)",
    "url": "https://www.youtube.com/@Crunchyroll",
    "categoria": "anime",
    "mejorPara": "Episodios sueltos y adelantos gratis fuera de la app principal de Crunchyroll",
    "registro": false,
    "regiones": "*",
    "anuncios": true,
    "consejoPremium": "Bueno para probar series antes de decidir si vale la pena verlas completas en Crunchyroll."
  },
  {
    "nombre": "Tivify",
    "url": "https://www.tivify.tv",
    "categoria": "anime",
    "mejorPara": "Canales lineales 'Anime Visión' y 'Anime Visión Classics', gratis con anuncios",
    "registro": true,
    "regiones": ["ES"],
    "anuncios": true,
    "consejoPremium": "Solo disponible en España; revisa el canal 'Anime Visión Classics' para clásicos como Slayers o Ranma 1/2."
  },
  {
    "nombre": "Bilibili Global",
    "url": "https://www.bilibili.tv",
    "categoria": "anime",
    "mejorPara": "Anime con anuncios y catálogo internacional (cobertura real por país variable)",
    "registro": true,
    "regiones": "*",
    "anuncios": true,
    "consejoPremium": "Verifica disponibilidad real en tu país al entrar — la cobertura declarada es global pero varía en la práctica."
  }
```

- [ ] **Step 2: Validar que el JSON parsea y contar entradas de anime**

Run: `node -e "const f=require('./client/src/catalog/fuentes.json'); console.log('anime:', f.filter(x=>x.categoria==='anime').length, 'total:', f.length)"`
Expected: `anime: 10 total: <lo que había + 6>` (4 previas + 6 nuevas = 10).

- [ ] **Step 3: Commit**

```bash
git add client/src/catalog/fuentes.json
git commit -m "feat: ampliar catalogo de anime con 6 plataformas legales nuevas"
```

---

### Task 2: Proxy AniList (`server/routes/anilist.js`)

**Files:**
- Create: `server/routes/anilist.js`
- Modify: `server/index.js`
- Test: `server/test/anilist.test.js`

**Interfaces:**
- Consumes: `conCache` de `server/lib/cache.js`.
- Produces:
  - `GET /api/anilist/buscar?q=` → `{ resultados: [{ id, titulo, sinopsis, anio, formato, episodios, generos, estudio, portada }] }`; `400 { error:'parametros' }` si `q` vacío; `502 { error:'anilist' }` si falla.
  - `GET /api/anilist/:id` → `{ id, titulo, tituloIngles, sinopsis, episodios, anio, formato, estudio, generos, portada, estado }`; `400 { error:'id-invalido' }` si `id` no es entero positivo.
  - `GET /api/anilist/calendario` → `{ proximos: [{ id, titulo, portada, episodio, fechaEmision }] }` (fechaEmision ISO 8601) — forma deliberadamente más ligera (sin sinopsis), son recordatorios de episodio, no fichas completas.
  - `GET /api/anilist/tendencias` → `{ temporada: [...], siempre: [...] }`, mismo formato de ítem que `buscar` (incluye `sinopsis`).

- [ ] **Step 1: Escribir tests que fallan — `server/test/anilist.test.js`**

```js
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'anilist-cache-'));
const { crearApp } = await import('../index.js');
const app = crearApp();

function respuestaAniList(data) {
  return { ok: true, status: 200, json: async () => ({ data }) };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('GET /api/anilist/buscar', () => {
  it('rechaza búsqueda vacía', async () => {
    const r = await request(app).get('/api/anilist/buscar');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('parametros');
  });

  it('mapea resultados al formato en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      Page: { media: [{
        id: 1, title: { romaji: 'Naruto', english: 'Naruto' }, startDate: { year: 2002 },
        format: 'TV', episodes: 220, genres: ['Action'],
        studios: { nodes: [{ name: 'Pierrot' }] }, coverImage: { large: 'https://x/p.jpg' },
      }] },
    })));
    const r = await request(app).get('/api/anilist/buscar?q=naruto');
    expect(r.status).toBe(200);
    expect(r.body.resultados[0]).toMatchObject({ id: 1, titulo: 'Naruto', anio: 2002, episodios: 220, estudio: 'Pierrot' });
  });

  it('responde 502 en español si AniList falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const r = await request(app).get('/api/anilist/buscar?q=algo-sin-cache-previa');
    expect(r.status).toBe(502);
    expect(r.body.error).toBe('anilist');
  });
});

describe('GET /api/anilist/:id', () => {
  it('rechaza id inválido', async () => {
    const r = await request(app).get('/api/anilist/abc');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('id-invalido');
  });

  it('devuelve la ficha completa y limpia HTML de la sinopsis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      Media: {
        id: 99, title: { romaji: 'Bleach', english: 'Bleach' },
        description: '<b>Sinopsis</b> de prueba', episodes: 366, startDate: { year: 2004 },
        format: 'TV', genres: ['Action'], studios: { nodes: [{ name: 'Pierrot' }] },
        coverImage: { large: 'https://x/b.jpg' }, status: 'FINISHED',
      },
    })));
    const r = await request(app).get('/api/anilist/99');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: 99, titulo: 'Bleach', sinopsis: 'Sinopsis de prueba', estado: 'FINISHED' });
  });
});

describe('GET /api/anilist/calendario', () => {
  it('mapea próximos episodios con fecha ISO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      Page: { airingSchedules: [{
        episode: 5, airingAt: 1700000000,
        media: { id: 7, title: { romaji: 'One Piece' }, coverImage: { large: 'https://x/o.jpg' } },
      }] },
    })));
    const r = await request(app).get('/api/anilist/calendario');
    expect(r.status).toBe(200);
    expect(r.body.proximos[0]).toMatchObject({ id: 7, titulo: 'One Piece', episodio: 5 });
    expect(r.body.proximos[0].fechaEmision).toBe(new Date(1700000000 * 1000).toISOString());
  });
});

describe('GET /api/anilist/tendencias', () => {
  it('devuelve temporada y siempre por separado', async () => {
    const mediaFalso = {
      id: 1, title: { romaji: 'X' }, startDate: { year: 2026 }, format: 'TV',
      episodes: 12, genres: [], studios: { nodes: [] }, coverImage: { large: null },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      temporada: { media: [mediaFalso] },
      siempre: { media: [mediaFalso] },
    })));
    const r = await request(app).get('/api/anilist/tendencias');
    expect(r.status).toBe(200);
    expect(r.body.temporada).toHaveLength(1);
    expect(r.body.siempre).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test -w server`
Expected: FAIL — no existe `../routes/anilist.js`.

- [ ] **Step 3: Implementar `server/routes/anilist.js`**

**Importante:** las rutas de path literal (`/buscar`, `/calendario`, `/tendencias`) van ANTES que `/:id` en este archivo — si no, Express intentaría matchear "buscar"/"calendario"/"tendencias" contra el parámetro `:id`.

```js
import { Router } from 'express';
import { conCache } from '../lib/cache.js';

const router = Router();
const SEIS_HORAS = 6 * 60 * 60 * 1000;
const UNA_HORA = 60 * 60 * 1000;
const ENDPOINT = 'https://graphql.anilist.co';

async function consultarAniList(query, variables) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await r.json();
  if (!r.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || `AniList respondió ${r.status}`);
  }
  return json.data;
}

function limpiarHtml(texto) {
  return (texto || '').replace(/<[^>]+>/g, '').trim();
}

function mapMedia(m) {
  return {
    id: m.id,
    titulo: m.title?.romaji || m.title?.english || `Anime ${m.id}`,
    sinopsis: limpiarHtml(m.description),
    anio: m.startDate?.year ?? null,
    formato: m.format ?? null,
    episodios: m.episodes ?? null,
    generos: m.genres ?? [],
    estudio: m.studios?.nodes?.[0]?.name ?? null,
    portada: m.coverImage?.large ?? null,
  };
}

function temporadaActual() {
  const ahora = new Date();
  const mes = ahora.getMonth();
  let season;
  if (mes === 11 || mes <= 1) season = 'WINTER';
  else if (mes <= 4) season = 'SPRING';
  else if (mes <= 7) season = 'SUMMER';
  else season = 'FALL';
  return { season, year: ahora.getFullYear() };
}

const QUERY_BUSCAR = `
  query ($search: String) {
    Page(page: 1, perPage: 24) {
      media(search: $search, type: ANIME) {
        id title { romaji english } description(asHtml: false) startDate { year } format episodes genres
        studios(isMain: true) { nodes { name } } coverImage { large }
      }
    }
  }
`;

router.get('/buscar', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'parametros', mensaje: 'Falta el término de búsqueda.' });
  try {
    const { valor } = await conCache(`anilist-buscar:${q}`, SEIS_HORAS, async () => {
      const data = await consultarAniList(QUERY_BUSCAR, { search: q });
      return data.Page.media;
    });
    res.json({ resultados: valor.map(mapMedia) });
  } catch (error) {
    console.error('[anilist-buscar]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

const QUERY_CALENDARIO = `
  query ($inicio: Int, $fin: Int) {
    Page(page: 1, perPage: 50) {
      airingSchedules(airingAt_greater: $inicio, airingAt_lesser: $fin, sort: TIME) {
        episode airingAt
        media { id title { romaji english } coverImage { large } }
      }
    }
  }
`;

router.get('/calendario', async (req, res) => {
  try {
    const { valor } = await conCache('anilist-calendario', UNA_HORA, async () => {
      const inicio = Math.floor(Date.now() / 1000);
      const fin = inicio + 7 * 24 * 60 * 60;
      const data = await consultarAniList(QUERY_CALENDARIO, { inicio, fin });
      return data.Page.airingSchedules;
    });
    res.json({
      proximos: valor.map((s) => ({
        id: s.media.id,
        titulo: s.media.title?.romaji || s.media.title?.english || `Anime ${s.media.id}`,
        portada: s.media.coverImage?.large ?? null,
        episodio: s.episode,
        fechaEmision: new Date(s.airingAt * 1000).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[anilist-calendario]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

const QUERY_TENDENCIAS = `
  query ($season: MediaSeason, $seasonYear: Int) {
    temporada: Page(page: 1, perPage: 20) {
      media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english } description(asHtml: false) startDate { year } format episodes genres
        studios(isMain: true) { nodes { name } } coverImage { large }
      }
    }
    siempre: Page(page: 1, perPage: 20) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english } description(asHtml: false) startDate { year } format episodes genres
        studios(isMain: true) { nodes { name } } coverImage { large }
      }
    }
  }
`;

router.get('/tendencias', async (req, res) => {
  try {
    const { valor } = await conCache('anilist-tendencias', SEIS_HORAS, async () => {
      const { season, year } = temporadaActual();
      return consultarAniList(QUERY_TENDENCIAS, { season, seasonYear: year });
    });
    res.json({
      temporada: valor.temporada.media.map(mapMedia),
      siempre: valor.siempre.media.map(mapMedia),
    });
  } catch (error) {
    console.error('[anilist-tendencias]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

const QUERY_MEDIA = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id title { romaji english } description(asHtml: false) episodes
      startDate { year } format genres studios(isMain: true) { nodes { name } }
      coverImage { large } status
    }
  }
`;

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id-invalido', mensaje: 'Identificador de AniList inválido.' });
  try {
    const { valor } = await conCache(`anilist-media:${id}`, SEIS_HORAS, async () => {
      const data = await consultarAniList(QUERY_MEDIA, { id });
      return data.Media;
    });
    res.json({
      id: valor.id,
      titulo: valor.title?.romaji || valor.title?.english || `Anime ${valor.id}`,
      tituloIngles: valor.title?.english ?? null,
      sinopsis: limpiarHtml(valor.description),
      episodios: valor.episodes ?? null,
      anio: valor.startDate?.year ?? null,
      formato: valor.format ?? null,
      estudio: valor.studios?.nodes?.[0]?.name ?? null,
      generos: valor.genres ?? [],
      portada: valor.coverImage?.large ?? null,
      estado: valor.status ?? null,
    });
  } catch (error) {
    console.error('[anilist-media]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

export default router;
```

- [ ] **Step 4: Montar en `server/index.js`**

Añadir el import junto a los otros routers y el `app.use` en el mismo grupo `/api/*` (antes de los estáticos y el 404):

```js
import anilistRouter from './routes/anilist.js';
// junto a los otros app.use('/api/...', ...):
  app.use('/api/anilist', anilistRouter);
```

- [ ] **Step 5: Verificar que pasan**

Run: `npm test -w server`
Expected: PASS (todos, incluidos los nuevos de anilist).

- [ ] **Step 6: Commit**

```bash
git add server/routes/anilist.js server/index.js server/test/anilist.test.js
git commit -m "feat: proxy con cache de AniList (buscar, ficha, calendario, tendencias)"
```

---

### Task 3: Helpers de cliente AniList (`client/src/lib/anilist.js`)

**Files:**
- Create: `client/src/lib/anilist.js`
- Test: `client/src/lib/anilist.test.js`

**Interfaces:**
- Consumes: `api()` de `client/src/lib/api.js`; `client/src/catalog/fuentes.json` (con las 6 entradas de la Task 1 ya presentes).
- Produces:
  - `buscarAnime(q: string): Promise<{resultados:[...]}>`.
  - `obtenerAnime(id: number|string): Promise<{...}>`.
  - `obtenerCalendario(): Promise<{proximos:[...]}>`.
  - `obtenerTendencias(): Promise<{temporada:[...], siempre:[...]}>`.
  - `fuentesLegalesDe(titulo: string, region: string): Array<{ nombre: string, url: string }>` — filtra `fuentes.json` por `categoria==='anime'` y disponibilidad regional (mismo criterio que usa `Fuentes.jsx`: `'*'`, array con `'*'`, o array que incluye la región exacta); `url` es una búsqueda de Google con el título + nombre de la plataforma (mismo patrón que `busquedaPara` en `ModoNetflix.jsx`).

- [ ] **Step 1: Escribir el test que falla — `client/src/lib/anilist.test.js`**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api.js', () => ({ api: vi.fn() }));
const { api } = await import('./api.js');
const { buscarAnime, obtenerAnime, obtenerCalendario, obtenerTendencias, fuentesLegalesDe } = await import('./anilist.js');

beforeEach(() => { api.mockReset(); api.mockResolvedValue({}); });

describe('helpers HTTP de anilist', () => {
  it('buscarAnime codifica el query', async () => {
    await buscarAnime('one piece');
    expect(api).toHaveBeenCalledWith('/anilist/buscar?q=one%20piece');
  });

  it('obtenerAnime usa el id en la ruta', async () => {
    await obtenerAnime(42);
    expect(api).toHaveBeenCalledWith('/anilist/42');
  });

  it('obtenerCalendario y obtenerTendencias llaman a sus rutas', async () => {
    await obtenerCalendario();
    await obtenerTendencias();
    expect(api).toHaveBeenNthCalledWith(1, '/anilist/calendario');
    expect(api).toHaveBeenNthCalledWith(2, '/anilist/tendencias');
  });
});

describe('fuentesLegalesDe', () => {
  it('incluye plataformas globales y genera un enlace de búsqueda', () => {
    const r = fuentesLegalesDe('Naruto', 'MX');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.url.startsWith('https://www.google.com/search?q='))).toBe(true);
    expect(r.some((x) => x.nombre === 'RetroCrush')).toBe(true);
  });

  it('respeta restricción regional (Tivify solo en España)', () => {
    expect(fuentesLegalesDe('Naruto', 'ES').some((x) => x.nombre === 'Tivify')).toBe(true);
    expect(fuentesLegalesDe('Naruto', 'MX').some((x) => x.nombre === 'Tivify')).toBe(false);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npm test -w client`
Expected: FAIL — no existe `./anilist.js`.

- [ ] **Step 3: Implementar `client/src/lib/anilist.js`**

```js
import { api } from './api.js';
import fuentes from '../catalog/fuentes.json';

export function buscarAnime(q) {
  return api(`/anilist/buscar?q=${encodeURIComponent(q)}`);
}

export function obtenerAnime(id) {
  return api(`/anilist/${id}`);
}

export function obtenerCalendario() {
  return api('/anilist/calendario');
}

export function obtenerTendencias() {
  return api('/anilist/tendencias');
}

function disponibleEn(fuente, region) {
  return fuente.regiones === '*' || fuente.regiones.includes('*') || fuente.regiones.includes(region);
}

export function fuentesLegalesDe(titulo, region) {
  return fuentes
    .filter((f) => f.categoria === 'anime' && disponibleEn(f, region))
    .map((f) => ({
      nombre: f.nombre,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${titulo} ${f.nombre} ver`)}`,
    }));
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npm test -w client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/anilist.js client/src/lib/anilist.test.js
git commit -m "feat: helpers de cliente para AniList y fuentesLegalesDe, con tests"
```

---

### Task 4: Componente compartido `FichaAnime.jsx`

**Files:**
- Create: `client/src/components/FichaAnime.jsx`

**Interfaces:**
- Consumes: `fuentesLegalesDe` (Task 3); `guardarProgreso`, `alternarGuardado`, `alternarVisto` de `client/src/lib/biblioteca.js` (ya existentes, Etapa 2).
- Produces: `<FichaAnime anime={{id, titulo, tituloIngles?, sinopsis?, episodios, anio, formato, estudio, generos}} region episodioInicial?={number} episodioFijo?={boolean} />`. `episodioInicial` fija el valor inicial del campo de episodio (por defecto `1` si se omite); `episodioFijo` (por defecto `false`) oculta el campo editable cuando es `true` — se usa desde el panel Calendario, donde el episodio ya viene determinado y no tiene sentido cambiarlo. Cuando se reanuda desde Inicio, `episodioInicial` se pasa (con el último episodio activo) pero SIN `episodioFijo`, para que el campo siga editable (el usuario puede querer avanzar al siguiente episodio). Componente autosuficiente: no requiere que el padre gestione biblioteca. `origen` interno siempre `anilist:${anime.id}`.

Este componente no tiene test dedicado (no hay tests de componentes React en el proyecto — se verifica manualmente al final de la Task 5).

- [ ] **Step 1: Implementar `client/src/components/FichaAnime.jsx`**

```jsx
import { useState } from 'react';
import { fuentesLegalesDe } from '../lib/anilist.js';
import { guardarProgreso, alternarGuardado, alternarVisto } from '../lib/biblioteca.js';

const DURACION_NOMINAL_SEG = 1200;

export default function FichaAnime({ anime, region, episodioInicial, episodioFijo = false }) {
  const [episodio, setEpisodio] = useState(episodioInicial ?? 1);
  const [guardado, setGuardado] = useState(false);
  const [visto, setVisto] = useState(false);
  const origen = `anilist:${anime.id}`;

  const abrirFuente = () => {
    guardarProgreso({
      origen,
      indice: episodio,
      posicionSeg: 1,
      duracionSeg: DURACION_NOMINAL_SEG,
      titulo: anime.titulo,
      poster: anime.portada,
    }).catch(() => {});
  };

  const alternarGuardadoLocal = () => {
    const nuevo = !guardado;
    setGuardado(nuevo);
    alternarGuardado(origen, nuevo, { titulo: anime.titulo, poster: anime.portada }).catch(() => setGuardado(!nuevo));
  };

  const marcarVisto = () => {
    const nuevo = !visto;
    setVisto(nuevo);
    alternarVisto(origen, episodio, nuevo).catch(() => setVisto(!nuevo));
  };

  const plataformas = fuentesLegalesDe(anime.titulo, region);

  return (
    <div className="tarjeta">
      {anime.portada
        ? <img className="poster" src={anime.portada} alt={anime.titulo} loading="lazy" />
        : <div className="poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎌</div>}
      <h4 style={{ margin: '8px 0 2px' }}>{anime.titulo}</h4>
      <span className="texto-suave">
        {anime.formato ?? ''}{anime.anio ? ` · ${anime.anio}` : ''}{anime.episodios ? ` · ${anime.episodios} episodios` : ''}
      </span>
      {anime.estudio && <div className="texto-suave">{anime.estudio}</div>}
      {anime.generos?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {anime.generos.slice(0, 3).map((g) => <span key={g} className="insignia">{g}</span>)}
        </div>
      )}
      {anime.sinopsis && (
        <p className="texto-suave" style={{ marginTop: 6 }}>
          {anime.sinopsis.slice(0, 220)}{anime.sinopsis.length > 220 ? '…' : ''}
        </p>
      )}

      {!episodioFijo && (
        <div style={{ marginTop: 8 }}>
          <label style={{ margin: 0 }}>Episodio</label>
          <input
            type="number" min="1" max={anime.episodios || undefined} value={episodio}
            onChange={(e) => setEpisodio(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 80 }}
          />
        </div>
      )}

      {plataformas.length === 0 && (
        <p className="texto-suave" style={{ marginTop: 8 }}>No hay plataformas de anime configuradas para tu región.</p>
      )}
      {plataformas.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {plataformas.map((f) => (
            <a key={f.nombre} className="chip" href={f.url} target="_blank" rel="noreferrer" onClick={abrirFuente}>
              ▶ Ver en {f.nombre}
            </a>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button className={guardado ? 'chip chip-activo' : 'chip'} onClick={alternarGuardadoLocal}>
          {guardado ? '✔ Guardada' : '💾 Guardar'}
        </button>
        <button className={visto ? 'chip chip-activo' : 'chip'} onClick={marcarVisto}>
          {visto ? '✔ Visto' : '○ Marcar como visto'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/FichaAnime.jsx
git commit -m "feat: componente FichaAnime autosuficiente (guardar, visto, ver en fuente)"
```

---

### Task 5: Sección "🎌 Anime" + navegación

**Files:**
- Create: `client/src/modules/anime/Anime.jsx`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: `obtenerCalendario`, `obtenerTendencias`, `buscarAnime` (Task 3); `<FichaAnime>` (Task 4); `useConfig()` (ya existente).

- [ ] **Step 1: Implementar `client/src/modules/anime/Anime.jsx`**

```jsx
import { useEffect, useState } from 'react';
import FichaAnime from '../../components/FichaAnime.jsx';
import { obtenerCalendario, obtenerTendencias, buscarAnime } from '../../lib/anilist.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const PANELES = [
  ['calendario', '📅 Calendario'],
  ['tendencias', '🔥 Tendencias'],
  ['buscador', '🔎 Buscador'],
];

export default function Anime() {
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [panel, setPanel] = useState('calendario');
  const [calendario, setCalendario] = useState([]);
  const [tendenciasTemporada, setTendenciasTemporada] = useState([]);
  const [tendenciasSiempre, setTendenciasSiempre] = useState([]);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (panel === 'calendario' && calendario.length === 0) {
      setCargando(true); setError(null);
      obtenerCalendario()
        .then((r) => setCalendario(r.proximos))
        .catch(() => setError('No se pudo consultar AniList en este momento.'))
        .finally(() => setCargando(false));
    }
    if (panel === 'tendencias' && tendenciasTemporada.length === 0) {
      setCargando(true); setError(null);
      obtenerTendencias()
        .then((r) => { setTendenciasTemporada(r.temporada); setTendenciasSiempre(r.siempre); })
        .catch(() => setError('No se pudo consultar AniList en este momento.'))
        .finally(() => setCargando(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const buscar = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setCargando(true); setError(null);
    try {
      const r = await buscarAnime(q);
      setResultados(r.resultados);
    } catch {
      setError('No se pudo buscar en AniList.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <h2>🎌 Anime</h2>
      <p className="texto-suave">Descubre anime con fichas de AniList y ábrelo en tu plataforma legal favorita.</p>
      <div className="chips">
        {PANELES.map(([clave, nombre]) => (
          <button key={clave} className={panel === clave ? 'chip chip-activo' : 'chip'} onClick={() => setPanel(clave)}>
            {nombre}
          </button>
        ))}
      </div>

      {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
      {cargando && <p className="texto-suave">Cargando…</p>}

      {panel === 'calendario' && !cargando && (
        <div className="cuadricula" style={{ marginTop: 16 }}>
          {calendario.map((item) => (
            <FichaAnime
              key={`${item.id}-${item.episodio}`}
              anime={{ id: item.id, titulo: item.titulo, portada: item.portada, episodios: null, anio: null, formato: null, estudio: null, generos: [] }}
              region={region}
              episodioInicial={item.episodio}
              episodioFijo
            />
          ))}
        </div>
      )}

      {panel === 'tendencias' && !cargando && (
        <>
          <h3 style={{ marginTop: 16 }}>Esta temporada</h3>
          <div className="cuadricula">
            {tendenciasTemporada.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
          </div>
          <h3 style={{ marginTop: 16 }}>Populares de siempre</h3>
          <div className="cuadricula">
            {tendenciasSiempre.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
          </div>
        </>
      )}

      {panel === 'buscador' && (
        <>
          <form onSubmit={buscar} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input placeholder="Buscar anime…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
            <button className="boton">Buscar</button>
          </form>
          <div className="cuadricula" style={{ marginTop: 16 }}>
            {resultados.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Conectar en `client/src/App.jsx`**

Añadir el import, una entrada en `SECCIONES` (después de `['reproducir', '🎬 Reproducir']`) y el mapeo en `MODULOS`:

```jsx
import Anime from './modules/anime/Anime.jsx';
// en SECCIONES, tras la entrada de 'reproducir':
  ['anime', '🎌 Anime'],
// en MODULOS:
  anime: Anime,
```

- [ ] **Step 3: Verificar tests y build**

Run: `npm test -w client`
Expected: PASS.

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso.

- [ ] **Step 4: Verificación manual**

Run: `npm run dev` (raíz).
Expected: nueva sección "🎌 Anime"; panel Calendario carga próximos episodios; panel Tendencias muestra temporada actual + populares de siempre; buscar "Naruto" en el buscador trae resultados con ficha completa; clic en "Ver en {fuente}" abre pestaña nueva a una búsqueda de Google y el botón "💾 Guardar" cambia a "✔ Guardada"; "✔ Marcar como visto" alterna. Detener.

- [ ] **Step 5: Commit**

```bash
git add client/src/modules/anime client/src/App.jsx
git commit -m "feat: seccion Anime con calendario, tendencias y buscador de AniList"
```

---

### Task 6: Pestaña "Anime" en Reproducir

**Files:**
- Modify: `client/src/modules/reproducir/Reproducir.jsx`

**Interfaces:**
- Consumes: `buscarAnime` (Task 3); `<FichaAnime>` (Task 4); `useConfig()` (ya existente, no estaba importado en este archivo).

- [ ] **Step 1: Reescribir `client/src/modules/reproducir/Reproducir.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import FichaAnime from '../../components/FichaAnime.jsx';
import { resolverIA, resolverTorrentOrigen, cerrarTorrent, MOTIVOS, buscarIA } from '../../lib/reproductor.js';
import { alternarGuardado } from '../../lib/biblioteca.js';
import { buscarAnime } from '../../lib/anilist.js';
import { useConfig } from '../../context/ConfigContext.jsx';

export default function Reproducir() {
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [pestana, setPestana] = useState('ia');

  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fuente, setFuente] = useState(null);
  const [origen, setOrigen] = useState('');
  const [guardados, setGuardados] = useState({});
  const torrentActivo = useRef(null);

  const [qAnime, setQAnime] = useState('');
  const [resultadosAnime, setResultadosAnime] = useState([]);
  const [cargandoAnime, setCargandoAnime] = useState(false);

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

  const buscarAnimeForm = async (e) => {
    e?.preventDefault();
    if (!qAnime.trim()) return;
    setCargandoAnime(true); setError(null);
    try {
      const r = await buscarAnime(qAnime);
      setResultadosAnime(r.resultados);
    } catch {
      setError('No se pudo buscar en AniList.');
    } finally {
      setCargandoAnime(false);
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
      <div className="chips">
        <button className={pestana === 'ia' ? 'chip chip-activo' : 'chip'} onClick={() => setPestana('ia')}>Internet Archive</button>
        <button className={pestana === 'anime' ? 'chip chip-activo' : 'chip'} onClick={() => setPestana('anime')}>🎌 Anime</button>
      </div>

      {pestana === 'ia' && (
        <>
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
        </>
      )}

      {pestana === 'anime' && (
        <>
          <p className="texto-suave">Busca anime con fichas de AniList y ábrelo en tu plataforma legal favorita.</p>

          <form onSubmit={buscarAnimeForm} style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Buscar anime…" value={qAnime} onChange={(e) => setQAnime(e.target.value)} style={{ flex: 1 }} />
            <button className="boton" disabled={cargandoAnime}>{cargandoAnime ? 'Buscando…' : 'Buscar'}</button>
          </form>

          {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}

          {resultadosAnime.length > 0 && (
            <div className="cuadricula" style={{ marginTop: 16 }}>
              {resultadosAnime.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
            </div>
          )}
        </>
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
Expected: en Reproducir aparecen dos pestañas; "Internet Archive" funciona igual que antes; "🎌 Anime" busca en AniList y muestra fichas con "Ver en {fuente}"/"Guardar"/"Marcar como visto". El error de una pestaña no rompe la otra. Detener.

- [ ] **Step 4: Commit**

```bash
git add client/src/modules/reproducir/Reproducir.jsx
git commit -m "feat: pestana Anime en Reproducir junto a Internet Archive"
```

---

### Task 7: Inicio.jsx maneja orígenes `anilist:`

**Files:**
- Modify: `client/src/modules/inicio/Inicio.jsx`

**Interfaces:**
- Consumes: `<FichaAnime>` (Task 4); `useConfig()` (ya existente en el proyecto, no estaba importado en este archivo).

- [ ] **Step 1: Reescribir `client/src/modules/inicio/Inicio.jsx`**

```jsx
import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import FichaAnime from '../../components/FichaAnime.jsx';
import { obtenerBiblioteca, alternarGuardado, limpiarHistorial } from '../../lib/biblioteca.js';
import { resolverIA, resolverTorrentOrigen, pareceIdentificadorIA, cerrarTorrent } from '../../lib/reproductor.js';
import { useConfig } from '../../context/ConfigContext.jsx';

function progresoDe(item) {
  const archivos = Object.values(item.archivos ?? {});
  const activo = archivos.find((a) => a.duracionSeg > 0 && a.posicionSeg > 0) ?? archivos[0];
  if (!activo || !activo.duracionSeg) return 0;
  return Math.min(100, Math.round((activo.posicionSeg / activo.duracionSeg) * 100));
}

function episodioActivoDe(item) {
  const entradas = Object.entries(item.archivos ?? {});
  if (entradas.length === 0) return undefined;
  const [indice] = entradas.sort((a, b) => new Date(b[1].ultimaVez) - new Date(a[1].ultimaVez))[0];
  return Number(indice);
}

function TarjetaItem({ item, onAbrir, onGuardar }) {
  const pct = progresoDe(item);
  return (
    <div className="tarjeta tarjeta-mini">
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
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [biblio, setBiblio] = useState({ continuarViendo: [], guardados: [], historial: [] });
  const [fuente, setFuente] = useState(null);
  const [animeActivo, setAnimeActivo] = useState(null);
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
    setError(null);
    if (item.origen.startsWith('anilist:')) {
      limpiarTorrent(); setFuente(null);
      setAnimeActivo(item);
      return;
    }
    setAnimeActivo(null);
    limpiarTorrent(); setFuente(null);
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
          <p className="texto-suave">Aún no has empezado nada. Ve a <b>🎬 Reproducir</b> o <b>🎌 Anime</b> para descubrir algo.</p>
        </div>
      )}

      {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
      {fuente && <Reproductor fuente={fuente} onCerrar={cerrarReproductor} />}
      {animeActivo && (
        <div style={{ marginTop: 16 }}>
          <button className="chip" onClick={() => setAnimeActivo(null)}>✕ Cerrar</button>
          <FichaAnime
            anime={{
              id: Number(animeActivo.origen.slice('anilist:'.length)),
              titulo: animeActivo.titulo,
              portada: animeActivo.poster,
              episodios: null,
              anio: null,
              formato: null,
              estudio: null,
              generos: [],
            }}
            region={region}
            episodioInicial={episodioActivoDe(animeActivo)}
          />
        </div>
      )}

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

- [ ] **Step 2: Verificar tests y build**

Run: `npm test -w client`
Expected: PASS.

Run: `npx vite build` (dentro de `client/`)
Expected: build exitoso.

- [ ] **Step 3: Verificación manual**

Run: `npm run dev` (raíz).
Expected: abrir un anime desde Anime/Reproducir, cerrar sección, volver a Inicio → aparece en "Continuar viendo"/"Historial reciente"; clic en esa tarjeta muestra la ficha con "Ver en {fuente}" (no intenta abrir el reproductor de video); "✕ Cerrar" la oculta. Un origen de Internet Archive/torrent sigue abriendo el `<Reproductor>` normalmente. Detener.

- [ ] **Step 4: Commit**

```bash
git add client/src/modules/inicio/Inicio.jsx
git commit -m "feat: Inicio muestra fichas de anime en vez de intentar reproducirlas"
```

---

### Task 8: Documentación y verificación final

**Files:**
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:** —

- [ ] **Step 1: Añadir sección al `README.md`**

Insertar después de la sección "🏠 Inicio — continuar viendo y biblioteca" existente:

```markdown
## 🎌 Anime — descubrimiento con AniList

Calendario de próximos episodios, tendencias de temporada y un buscador con fichas ricas (sinopsis, estudio, géneros), todo con datos de [AniList](https://anilist.co). Como AniList y las plataformas de anime no ofrecen streams reproducibles, "Ver en {fuente}" abre la plataforma legal en una pestaña nueva — Crunchyroll, RetroCrush, AnimeOnegai, Pluto TV Anime, canales oficiales de YouTube (Toei, TMS Anime Latino, Anime Log, Crunchyroll), Tivify (España) y Bilibili Global, según tu región. Se guarda automáticamente en tu biblioteca al abrir una fuente; marcar como visto es siempre manual.
```

- [ ] **Step 2: Añadir sección al `CLAUDE.md`**

Insertar después de la sección "Biblioteca / continuar viendo (Etapa 2)" existente:

```markdown
### Anime con AniList (Etapa 3)

- `server/routes/anilist.js`: proxy con caché al GraphQL público de AniList (`/buscar`, `/:id`, `/calendario`, `/tendencias`). Las rutas literales van ANTES que `/:id` en el archivo — si no, Express les daría prioridad al parámetro. Nunca reproduce nada; solo metadatos.
- `client/src/lib/anilist.js`: helpers HTTP + `fuentesLegalesDe(titulo, region)`, que filtra `catalog/fuentes.json` (categoría `anime`) y genera enlaces de búsqueda de Google (mismo patrón que `busquedaPara` de `ModoNetflix.jsx`).
- `client/src/components/FichaAnime.jsx`: componente autosuficiente (como `Reproductor.jsx`) — dado `{anime, region, episodioInicial?, episodioFijo?}`, gestiona guardar/visto/apertura de fuente por sí solo. Al abrir una fuente registra progreso con `duracionSeg:1200, posicionSeg:1` (nunca `1/1`) para no disparar el umbral automático de "visto" del 90% (Etapa 2). Reutilizado en `modules/anime/Anime.jsx`, la pestaña Anime de `modules/reproducir/Reproducir.jsx`, e `Inicio.jsx` (orígenes `anilist:` muestran la ficha en vez de abrir el reproductor de video).
```

- [ ] **Step 3: Verificación final completa**

Run: `npm test` (raíz)
Expected: PASS — server (anilist + toda la suite previa) y client (anilist + toda la suite previa).

Run: `npm start` y recorrer manualmente: sección Anime (calendario/tendencias/buscador), pestaña Anime en Reproducir, un anime guardado aparece en Inicio y su tarjeta muestra la ficha (no el reproductor).

- [ ] **Step 4: Commit y push**

```bash
git add README.md CLAUDE.md
git commit -m "docs: documentar seccion Anime y AniList (Etapa 3)"
git push
```
