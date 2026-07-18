# Diseño: Reproductor integrado + streaming legal (Etapa 1)

**Fecha:** 2026-07-18
**Estado:** Aprobado por el usuario (diseño conversacional)
**Proyecto:** Mi Centro de Entretenimiento — https://github.com/fjhr/mi-centro-entretenimiento

## Contexto

Primera de cuatro etapas para una experiencia de reproducción estilo Hayase **legal**. Etapas siguientes (fuera de esta spec): (2) UX estilo Hayase — continuar viendo, progreso por episodio, biblioteca; (3) anime legal con metadatos AniList; (4) fuentes parametrizables legales avanzadas. Esta etapa construye la base de reproducción sobre la que se montan las demás.

**Límite firme del proyecto:** nada de agregadores de indexadores de contenido con copyright (FMHY/r/Piracy). El streaming de torrents se restringe a orígenes que pasen una validación de allowlist administrada por el usuario; Internet Archive es legal por construcción.

## Alcance

Reproducir **dentro de la app**:
1. El catálogo de **Internet Archive** buscado desde la propia app (stream HTTP directo o su torrent con webseed).
2. **URLs HTTP(S) y magnets/`.torrent`** cuyo origen pase la validación de allowlist.

WebTorrent corre en el servidor (Node), se conecta a peers + webseeds y transmite al navegador por HTTP range hacia un `<video>` estándar.

**Fuera de alcance en esta etapa:** continuar viendo / progreso / biblioteca / calendario (Etapa 2); AniList (Etapa 3); catálogos parametrizables avanzados más allá de la allowlist de hosts (Etapa 4).

## Modelo de validación legal

Pieza central. Un magnet "pelado" (solo infohash + trackers públicos) **no tiene origen verificable** y por tanto se rechaza. `validarOrigen(origen, allowlist)` (lógica pura en `server/lib/origen.js`) clasifica el `origen` y devuelve `{ ok: boolean, tipo, motivo? }`:

- **Internet Archive** — identificador (`^[A-Za-z0-9._-]+$` resuelto vía API) o URL cuyo host sea `archive.org`/`*.archive.org` → `ok:true, tipo:'ia'`. Siempre permitido.
- **URL HTTP(S) directa** — `ok:true, tipo:'http'` solo si el host ∈ allowlist; si no, `ok:false, motivo:'host-no-permitido'`.
- **Magnet** (`magnet:?...`) — se parsean los parámetros `ws`/`xs` (webseed) y `tr` (trackers). `ok:true, tipo:'torrent'` solo si:
  - existe un webseed cuyo host ∈ allowlist, **o**
  - algún tracker pertenece a un origen de confianza (`bt.archive.org`, o host ∈ allowlist).
  - En cualquier otro caso `ok:false, motivo:'origen-no-verificable'`.
- **`.torrent` por URL** — `ok:true, tipo:'torrent-url'` solo si el host de la URL ∈ allowlist; si no, `ok:false, motivo:'host-no-permitido'`.
- Cualquier otra cosa → `ok:false, motivo:'formato-no-soportado'`.

La allowlist (`allowlist: string[]` de hosts) se guarda en `server/data/config.json` y se edita desde Ajustes. `archive.org`, `*.archive.org` y `bt.archive.org` están implícitos y no se pueden quitar. Comparación de hosts normalizada (minúsculas, sin puerto, coincidencia por sufijo de dominio para `*.archive.org`).

## Componentes

### Servidor

Nueva dependencia: `webtorrent` (Node, ESM).

- **`lib/origen.js`** — `validarOrigen(origen, allowlist)` puro y testeable. Sin dependencias de red. Exporta también `hostPermitido(host, allowlist)`.
- **`lib/torrentes.js`** — envoltura del cliente WebTorrent: `agregar(origen)` (devuelve `{ id, archivos:[{ indice, nombre, longitud, reproducible }] }`), `obtenerArchivo(id, indice)` (devuelve un handle con `createReadStream({ start, end })` y `length`), `cerrar(id)`. Límite de torrents activos simultáneos (p. ej. 3); expulsa el más antiguo al superar el límite. Los datos se guardan en un directorio temporal gitignored (`server/cache/torrentes/`, override por `DIR_TORRENTES`).
- **`routes/reproductor.js`** — proxy a la API de Internet Archive, usando `conCache`:
  - `GET /api/reproductor/ia/buscar?q=` → `advancedsearch.php` (JSON), devuelve `[{ identificador, titulo, anio, tipo, miniatura }]`.
  - `GET /api/reproductor/ia/:id` → `metadata/:id`, devuelve `{ titulo, descripcion, archivos:[{ nombre, formato, url, esVideo, esAudio }], torrent:url|null, subtitulos:[{ idioma, url }] }`.
- **`routes/stream.js`**:
  - `POST /api/stream/torrent` `{ origen }` → valida con `validarOrigen` + allowlist actual; `400 { error:'origen-rechazado', motivo }` si falla; si pasa, `torrentes.agregar` y responde `{ id, archivos }`.
  - `GET /api/stream/torrent/:id/:indice` → transmite el archivo con soporte de **HTTP range** (`Accept-Ranges`, `206 Partial Content`, `Content-Range`); `Content-Type` por extensión. `404` si id/índice no existen.
  - `GET /api/stream/subtitulo?url=` → valida host contra allowlist/IA, descarga y, si es `.srt`, convierte a WebVTT (`text/vtt`); si ya es `.vtt` lo pasa tal cual.
  - `DELETE /api/stream/torrent/:id` → `torrentes.cerrar(id)`.
- **Config** — `obtenerConfig()` incorpora `allowlist: string[]` (defecto `[]`). Rutas nuevas montadas antes de los estáticos y el 404.

### Cliente

- **Módulo `modules/reproducir/Reproducir.jsx`** (nueva sección "🎬 Reproducir" en `App.jsx`):
  - Buscador de Internet Archive → rejilla de resultados (miniatura, título, año); clic abre el reproductor con ese ítem.
  - Campo "Pegar magnet, enlace .torrent o URL de video"; al enviar llama al servidor; si el origen se rechaza, muestra el motivo traducido en español (host no permitido / origen no verificable / formato no soportado).
- **`components/Reproductor.jsx`** — recibe una fuente resuelta (`{ tipo, urlDirecta? , torrentId?, archivos?, subtitulos? }`); renderiza `<video controls>` cuyo `src` es la URL directa (IA/HTTP) o `/api/stream/torrent/:id/:indice`; selector de archivo si el torrent trae varios; `<track kind="subtitles">` por cada subtítulo (vía `/api/stream/subtitulo`). Al desmontar, `DELETE` del torrent.
- **`lib/reproductor.js`** — helpers de cliente: `buscarIA(q)`, `abrirIA(id)`, `abrirOrigen(origen)`, `cerrarTorrent(id)`.
- **`modules/ajustes/Ajustes.jsx`** — nueva tarjeta "Fuentes permitidas (allowlist)": lista de hosts con agregar/quitar; explica en español que solo se reproducen orígenes de esta lista (más Internet Archive), y que un magnet sin webseed/tracker de un host permitido se rechazará.

## Flujo de datos

1. Usuario busca en IA → `buscarIA` → `/api/reproductor/ia/buscar` → resultados.
2. Clic en resultado → `abrirIA(id)` → `/api/reproductor/ia/:id` → si hay archivo de video directo, `<video src=urlDirecta>`; si se prefiere torrent, `POST /api/stream/torrent { origen: torrentUrl }` → `<video src=/api/stream/torrent/:id/:indice>`.
3. Pegar origen → `abrirOrigen(origen)` → `POST /api/stream/torrent` (o reproducción directa si es URL de video permitida) → validación → reproducción o error en español.
4. Cerrar reproductor → `DELETE /api/stream/torrent/:id`.

## Manejo de errores

- **Origen rechazado** → mensaje en español según `motivo`.
- **Sin peers/webseed** (torrent no arranca en N segundos) → aviso "No se encontró origen disponible para reproducir".
- **IA caído / sin resultados** → mensaje claro; el resto de la app sigue.
- **Range no soportado por el cliente** → se sirve el archivo completo (`200`) como respaldo.
- Errores del servidor siguen el patrón existente: JSON en español.

## Pruebas

- **`lib/origen.js`** (crítico, unitario): IA por identificador y por URL; URL http con host en/fuera de allowlist; magnet con webseed permitido (acepta), magnet pelado (rechaza `origen-no-verificable`), magnet con tracker `bt.archive.org` (acepta); `.torrent` con host permitido/no permitido; formato basura (rechaza). Normalización de host (mayúsculas, puerto, subdominio de archive.org).
- **`routes/stream.js`** (contrato, supertest): `POST` rechaza origen inválido con `400 origen-rechazado`; con un torrent de prueba diminuto (fixture local, p. ej. un archivo de texto empaquetado o el `.torrent` de un archivo pequeño servido localmente) acepta y `GET` responde `206` con `Content-Range` correcto ante una petición con `Range`. Conversión `.srt`→WebVTT.
- **Cliente**: verificación manual (buscar IA, reproducir directo, reproducir torrent con webseed, pegar magnet rechazado y ver el mensaje, editar allowlist).

## Notas de decisión

- **Server-side WebTorrent** (no en navegador) para alcanzar peers BitTorrent normales además de webseeds y usar un `<video>` estándar con range; los datos pasan por la laptop del usuario.
- **Validación no removible**: es lo que separa la herramienta de un cliente de piratería; se mantiene aunque el usuario administre la allowlist.
- La caché de torrents en disco no tiene límite de tamaño (riesgo aceptado, app local monousuario); sí hay límite de torrents *activos* simultáneos.
