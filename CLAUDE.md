# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Mi Centro de Entretenimiento**: dashboard personal de entretenimiento gratis y legal, 100% en español, publicado en https://github.com/fjhr/mi-centro-entretenimiento. Monorepo npm workspaces con `server/` (Express 4, ESM) y `client/` (React 18 + Vite 5).

**Regla dura del proyecto:** todo lo de cara al usuario va en español (UI, mensajes de error del servidor, README, commits). Solo fuentes legales en los catálogos; torrents únicamente de dominio público/Creative Commons.

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

### Tests

33 tests: servidor (contratos supertest: config no expone keys, path traversal, 503 falta-key, caché TTL/respaldo, errores en español) y cliente (motor de recomendación, planificador, contratos de peliculas.js con `vi.mock`). Los tests de servidor usan `mkdtemp` + `DIR_DATOS`/`DIR_CACHE`; seguir ese patrón de aislamiento.

## Documentación de diseño

- Spec: `docs/superpowers/specs/2026-07-17-mi-centro-entretenimiento-design.md`
- Plan de implementación ejecutado: `docs/superpowers/plans/2026-07-17-mi-centro-entretenimiento.md`
- Ledger de progreso y hallazgos aceptados: `.superpowers/sdd/progress.md` (gitignored)

## Notas operativas

- El repo vive bajo OneDrive: `node_modules/`, `server/cache/` y `server/data/` están gitignored y conviene excluirlos de la sincronización.
- Riesgos aceptados en la revisión final: vulnerabilidades `npm audit` del stack dev de Vite (por eso `npm start` sirve el build, no el dev server), caché en disco sin límite de tamaño, historial `vistos` consumido solo por Noche de Cine.
