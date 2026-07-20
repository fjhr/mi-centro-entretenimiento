# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Mi Centro de Entretenimiento**: dashboard personal de entretenimiento gratis, publicado en https://github.com/fjhr/mi-centro-entretenimiento. Monorepo npm workspaces con `server/` (Express 4, ESM) y `client/` (React 18 + Vite 5).

**Regla dura del proyecto:** todo lo de cara al usuario va en español (UI, mensajes de error del servidor, README, commits).

## Comandos

```bash
npm run dev          # desarrollo: servidor (3001) + Vite con recarga (5173, proxy /api→3001)
npm start            # producción: build del cliente + Express sirve client/dist en http://localhost:3001
npm test             # toda la suite (server + client)
npm test -w server   # solo servidor (supertest + vitest)
npm test -w client   # solo cliente (motor y libs, vitest)

# Un solo archivo de test:
npx vitest run test/rutas.test.js        # desde server/
npx vitest run src/engine/recomendar.test.js  # desde client/
```

`Iniciar.bat` es el lanzador de doble clic para el usuario final (equivale a `npm start`).

## Arquitectura

### Servidor (`server/`) — proxy con caché y persistencia JSON

- `index.js` exporta `crearApp()` (no hace `listen` si `NODE_ENV === 'test'`). Orden de montaje importante: routers `/api/*` → estáticos de `client/dist` (si existe) → handler 404 JSON → handler de errores de 4 argumentos. Todo error al cliente es JSON en español.
- `lib/almacen.js`: `leerJson/guardarJson` sobre `server/data/` (gitignored; override con `DIR_DATOS` en tests) y `obtenerConfig()` → `{ tmdbKey, omdbKey, region }`. Las API keys viven SOLO en `server/data/config.json`; `GET /api/config` devuelve únicamente `{ region, tieneTmdb, tieneOmdb }` — nunca las keys.
- `lib/cache.js`: `conCache(clave, ttlMs, obtener)` — caché en disco (`server/cache/`, override `DIR_CACHE`); si `obtener` falla y hay caché vencida, la devuelve como respaldo (degradación elegante). Las claves de caché NUNCA incluyen la API key.
- `routes/tmdb.js`: comodín Express 4 (`GET /*` + `req.params[0]` — no migrar a Express 5 sin rehacer esto). Valida la ruta con `/^[A-Za-z0-9_/]+$/` (anti-SSRF), inyecta `api_key` y `language` (es-ES si región ES, si no es-MX), caché 12 h. Sin key → `503 { error: 'falta-key' }`.
- `routes/omdb.js`: igual patrón, caché 7 días, extrae `{ imdb, rottenTomatoes, titulo, fecha }`.
- `routes/datos.js`: persistencia genérica `GET/PUT /api/datos/:nombre` (nombre validado `/^[a-z0-9-]+$/`); GET responde `{ valor }` (null si no existe). La usan los planes semanales, de aprendizaje y el historial `vistos`.

### Cliente (`client/src/`)

- `lib/api.js`: `api(ruta, opciones)` → fetch a `/api...`; en error lanza `Error` con `.codigo` y `.status` (los módulos detectan `status === 503` para pedir configurar keys). Helpers `tmdb()` y `omdb()`.
- `engine/` — lógica pura testeada (aquí van los tests obligatorios): `moods.js` (mood → géneros TMDB), `recomendar.js` (`puntuar`/`recomendar` con pesos fijos), `planificador.js` (`intercalarCategorias` round-robin + `planificarFranjas` con presupuesto por franja), `canales.js` (7 canales temáticos).
- `lib/peliculas.js`: capa TMDB/OMDb del cliente. Contratos que los módulos asumen: `dondeVer` y `ratingsDe` NUNCA lanzan (devuelven vacío/null); `buscarPorMood` SÍ propaga (para que la UI muestre el aviso de keys). Los ratings OMDb se consultan con `tituloOriginal` (el título localizado de TMDB no matchea en OMDb).
- `catalog/`: `fuentes.json` (44 plataformas; `regiones` es `"*"` o array que puede contener `"*"`) y `contenido.json` (27 ítems con `etiquetas/energia/compania/duracionMin` que consume el motor).
- `modules/`: un directorio por módulo (fuentes, cine, semanal, maraton, aprendizaje, queveo, ajustes), registrados en el mapa `MODULOS` de `App.jsx` (navegación por estado, sin router). `ConfigContext` provee `useConfig()` con región y flags de keys.
- Patrón de degradación en módulos: la llamada TMDB va en `try/catch` vacío y el contenido curado se calcula fuera, para que sin keys/red todo siga funcionando.

### Reproductor / streaming legal (Etapa 1)

- `server/lib/origen.js`: `validarOrigen(origen, allowlist)` / `hostPermitido` — guardarraíl legal. `archive.org`/`*.archive.org`/`bt.archive.org` de confianza implícita; magnet solo pasa con webseed/tracker de host permitido. NO removible.
- `server/lib/torrentes.js`: envoltura de WebTorrent (cliente único perezoso, `MAX_ACTIVOS=3`, datos en `server/cache/torrentes/`).
- `server/routes/reproductor.js`: proxy búsqueda/metadatos de Internet Archive (con `conCache`).
- `server/routes/stream.js`: `POST /torrent` (valida origen), `GET /torrent/:id/:indice` (HTTP range → 206), `GET /subtitulo` (SRT→VTT), `DELETE /torrent/:id`.
- Cliente: `modules/reproducir/`, `components/Reproductor.jsx`, `lib/reproductor.js`; allowlist editable en Ajustes; `config.allowlist` en `GET/PUT /api/config`.

### Biblioteca / continuar viendo (Etapa 2)

- `server/lib/biblioteca.js`: lógica pura sobre un único store `{ [origen]: { titulo, poster, guardado, archivos: { [indice]: { posicionSeg, duracionSeg, visto } } } }`. `actualizarProgreso` marca `visto` automático al 90%; un override manual (`alternarVisto`) no se revierte por progreso posterior bajo el umbral. `continuarViendo`/`guardados`/`historial` son selectores puros, no colecciones separadas.
- `server/routes/biblioteca.js`: `GET /api/biblioteca` (las tres listas + `entradas` crudo), `PUT /progreso`, `PUT /guardado`, `PUT /visto`, `DELETE /historial`.
- Cliente: `lib/biblioteca.js` (helpers HTTP); `Reproductor.jsx` es autosuficiente — dado `fuente.origen/titulo/poster`, reanuda posición, autoguarda cada 10s (+pausa/cierre/beforeunload) y expone marcar-visto, sin que el módulo padre gestione persistencia. `resolverIA`/`resolverTorrentOrigen`/`pareceIdentificadorIA` en `lib/reproductor.js` traducen cualquier `origen` guardado de vuelta a una fuente reproducible. `modules/inicio/Inicio.jsx` es la pantalla de arranque.

### Anime con AniList (Etapa 3)

- `server/routes/anilist.js`: proxy con caché al GraphQL público de AniList (`/buscar`, `/:id`, `/calendario`, `/tendencias`). Las rutas literales van ANTES que `/:id` en el archivo — si no, Express les daría prioridad al parámetro. Nunca reproduce nada; solo metadatos.
- `client/src/lib/anilist.js`: helpers HTTP + `fuentesLegalesDe(titulo, region)`, que filtra `catalog/fuentes.json` (categoría `anime`) y genera enlaces de búsqueda de Google (mismo patrón que `busquedaPara` de `ModoNetflix.jsx`).
- `client/src/components/FichaAnime.jsx`: componente autosuficiente (como `Reproductor.jsx`) — dado `{anime, region, episodioInicial?, episodioFijo?}`, gestiona guardar/visto/apertura de fuente por sí solo. Al abrir una fuente registra progreso con `duracionSeg:1200, posicionSeg:1` (nunca `1/1`) para no disparar el umbral automático de "visto" del 90% (Etapa 2). Reutilizado en `modules/anime/Anime.jsx`, la pestaña Anime de `modules/reproducir/Reproducir.jsx`, e `Inicio.jsx` (orígenes `anilist:` muestran la ficha en vez de abrir el reproductor de video).

### Sistema de diseño (rediseño visual 2026-07-20)

Rediseño aplicado directamente sobre `client/src/styles.css` (vía skill `frontend-design`, no pasó por el flujo formal spec→plan→SDD; sin ledger ni commit de diseño propio). Cambia nombres de variables CSS — **cualquier código nuevo debe usar los nombres actuales, no los de las Etapas 0-3**:

- Tokens: `--bg`/`--surface`/`--surface-glass` (superficies), `--ink`/`--ink-muted` (texto), `--accent` (coral `#FF6B4A`, reemplaza el rojo `--acento` de antes), `--accent-2` (periwinkle `#7C9CFF`, para progreso/foco), `--radius`/`--radius-sm`/`--radius-pill`, `--fuente-display` (Space Grotesk) / `--fuente-cuerpo` (Inter).
- Fuentes cargadas por `<link>` a Google Fonts en `client/index.html` (requiere red la primera vez; el navegador las cachea después). Si el proyecto alguna vez necesita funcionar 100% offline, esto habría que revisarlo.
- El Hero de `Inicio.jsx` ya NO es un solo `<div className="hero">` con `background-image` — ahora son 3 capas: `.hero-backdrop` (imagen desenfocada absoluta), `.hero-scrim` (degradado), `.hero-panel` (vidrio con `backdrop-filter: blur`, contiene el texto). Cualquier otro módulo que quiera un hero similar debe replicar esta estructura de 3 capas, no un solo div.
- El resto de módulos (Fuentes, Reproducir, Anime, etc.) no se tocaron — heredan el nuevo look automáticamente porque comparten las clases `.tarjeta`/`.chip`/`.boton`/`.poster` ya existentes.

### Tests

104 tests (68 servidor + 36 cliente): servidor (contratos supertest: config no expone keys, path traversal, 503 falta-key, caché TTL/respaldo, errores en español, contratos de AniList) y cliente (motor de recomendación, planificador, contratos de peliculas.js con `vi.mock`). Los tests de servidor usan `mkdtemp` + `DIR_DATOS`/`DIR_CACHE`; seguir ese patrón de aislamiento.

## Documentación de diseño

Specs y planes de cada etapa (todos en `docs/superpowers/`, patrón `YYYY-MM-DD-<tema>[-design].md`):

- **Etapa 0** (base): `specs/2026-07-17-mi-centro-entretenimiento-design.md` · `plans/2026-07-17-mi-centro-entretenimiento.md`
- **Etapa 1** (reproductor/streaming legal): `specs/2026-07-18-reproductor-streaming-legal-design.md` · `plans/2026-07-18-reproductor-streaming-legal.md`
- **Etapa 2** (biblioteca/continuar viendo): `specs/2026-07-19-ux-hayase-etapa2-design.md` · `plans/2026-07-19-ux-hayase-etapa2.md`
- **Etapa 3** (anime/AniList): `specs/2026-07-19-anime-anilist-etapa3-design.md` · `plans/2026-07-19-anime-anilist-etapa3.md`
- El rediseño visual (2026-07-20) no tiene spec/plan propio — ver sección "Sistema de diseño" arriba.

Ledger de progreso y hallazgos aceptados de la ejecución SDD: `.superpowers/sdd/progress.md` (gitignored).

## Notas operativas

- El repo vive bajo OneDrive: `node_modules/`, `server/cache/` y `server/data/` están gitignored y conviene excluirlos de la sincronización.
- Riesgos aceptados en la revisión final: vulnerabilidades `npm audit` del stack dev de Vite (por eso `npm start` sirve el build, no el dev server), caché en disco sin límite de tamaño, historial `vistos` consumido solo por Noche de Cine.
