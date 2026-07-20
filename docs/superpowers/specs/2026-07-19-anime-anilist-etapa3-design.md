# Diseño: Anime legal con AniList (Etapa 3)

**Fecha:** 2026-07-19
**Estado:** Aprobado por el usuario (diseño conversacional)
**Proyecto:** Mi Centro de Entretenimiento — [github.com/fjhr/mi-centro-entretenimiento](https://github.com/fjhr/mi-centro-entretenimiento)

## Contexto

Tercera de cuatro etapas planeadas sobre la experiencia de reproducción tipo Hayase. Etapa 1 (reproductor + streaming legal) y Etapa 2 (continuar viendo, biblioteca, historial, pantalla de Inicio) ya están en `main`. Esta etapa añade descubrimiento de anime con metadatos ricos de AniList. Etapa 4 (fuentes parametrizables legales avanzadas) queda fuera de esta spec.

**Restricción de origen que define toda la arquitectura:** AniList es solo metadatos (GraphQL público, sin autenticación) — no ofrece streams ni webseeds. Las plataformas de anime legal ya catalogadas (Crunchyroll gratis, RetroCrush, AnimeOnegai, Pluto TV Anime) tampoco exponen una API de reproducción o búsqueda por título. Por tanto **esta etapa no reproduce anime dentro de la app**: el botón de ver abre la plataforma externa en una pestaña nueva, con una URL de búsqueda por título (mismo patrón de "búsqueda sugerida" que ya usa Modo Netflix en la Etapa 0). Nada de esto pasa por `validarOrigen`/WebTorrent — no es streaming, es un enlace de salida a un sitio legal.

## Alcance

1. Nueva sección **🎌 Anime**: calendario de próximos episodios, tendencias/populares, buscador con fichas ricas — todo vía AniList.
2. Pestaña "Anime" en el buscador de **🎬 Reproducir**, junto a la de Internet Archive existente.
3. Integración con biblioteca (Etapa 2): guardado automático al abrir una fuente externa + marcado de "visto" manual, reutilizando el mismo store de `server/data/biblioteca.json` sin cambios de esquema.
4. Ampliación del catálogo curado (`client/src/catalog/fuentes.json`, categoría `anime`) con 6 plataformas nuevas investigadas para esta etapa.

**Fuera de alcance:** reproducción de anime dentro de la app; sincronización con cuentas de AniList del usuario (listas personales, autenticación OAuth); fuentes parametrizables más allá de la allowlist ya existente (Etapa 4).

## Ampliación del catálogo de anime

Se añaden a `fuentes.json` (categoría `anime`), investigadas y aprobadas por el usuario:

|Plataforma|URL|Región|Notas|
|-|-|-|-|
|Toei Animation (YouTube oficial)|canal oficial|`*`|Dragon Ball, One Piece, Sailor Moon completos, sub y doblado|
|TMS Anime Latino (YouTube)|canal oficial|`*`|Doblaje latino, 1.3M suscriptores|
|Anime Log (YouTube)|canal oficial|`*`|Estudios japoneses clásicos, gratis y legal|
|Crunchyroll (YouTube oficial)|canal oficial|`*`|Episodios sueltos gratis fuera de la app de Crunchyroll|
|Tivify|[tivify.tv](https://www.tivify.tv)|`["ES"]`|Canales lineales "Anime Visión"/"Anime Visión Classics", gratis con anuncios|
|Bilibili Global|[bilibili.tv](https://www.bilibili.tv)|`*`|Cobertura internacional a confirmar por país en la práctica; se documenta la reserva en `consejoPremium`|

Mismo esquema que las entradas existentes (`nombre, url, categoria, mejorPara, registro, regiones, anuncios, consejoPremium`).

## Backend — proxy AniList

`server/routes/anilist.js`, usando `conCache` (igual que TMDB/OMDb/Internet Archive en etapas previas). Endpoint único de AniList: `POST https://graphql.anilist.co` con `query`+`variables` en el body — el proxy construye las queries GraphQL server-side y expone rutas REST simples al cliente:

- `GET /api/anilist/buscar?q=` → `{ resultados: [{ id, titulo, anio, formato, episodios, generos, estudio, portada }] }`. Caché 6h por término.
- `GET /api/anilist/:id` → ficha completa `{ id, titulo, tituloIngles, sinopsis, episodios, anio, formato, estudio, generos, portada, estado }`. Caché 6h. `id` validado como entero positivo.
- `GET /api/anilist/calendario` → próximos episodios en emisión los siguientes 7 días: `{ proximos: [{ id, titulo, portada, episodio, fechaEmision }] }`. Caché 1h (cambia más seguido que fichas).
- `GET /api/anilist/tendencias` → `{ temporada: [...], siempre: [...] }`, misma forma de ítem que `buscar`. Caché 6h.

Errores: AniList caído o con error GraphQL → `502 { error:'anilist', mensaje:'No se pudo consultar AniList en este momento.' }` (patrón idéntico a `reproductor.js`/`tmdb.js`); `id` inválido → `400`.

## Cliente

- `client/src/lib/anilist.js`: helpers HTTP (`buscarAnime`, `obtenerAnime`, `obtenerCalendario`, `obtenerTendencias`) + `fuentesLegalesDe(region)` — filtra `fuentes.json` por `categoria==='anime'` y disponibilidad regional, devolviendo `[{ nombre, urlBusqueda(titulo) }]` (para plataformas sin ruta de búsqueda conocida, `urlBusqueda` apunta a la home del sitio con el título como sugerencia de copiar/pegar, igual que el patrón ya usado en Modo Netflix).
- `client/src/modules/anime/Anime.jsx`: tres paneles (Calendario / Tendencias / Buscador). Cada ficha de anime (Tendencias/Buscador): portada, título, sinopsis, episodios, año, estudio, géneros, un campo numérico pequeño "Episodio" (valor por defecto `1`, máximo = `episodios` si el dato existe) junto a los botones "▶ Ver en {fuente}" por cada plataforma legal disponible en la región configurada, y botón "💾 Guardar". Las tarjetas del panel Calendario ya traen su propio número de episodio (`proximos[].episodio`) y no muestran el campo — se usa ese valor directamente.
- **Integración con biblioteca — corrección del umbral automático:** al hacer clic en cualquier "Ver en {fuente}" se abre la URL en pestaña nueva (`target="_blank"`) y se llama `guardarProgreso({ origen: 'anilist:' + id, indice: episodio, posicionSeg: 1, duracionSeg: 1200, titulo, poster })`, donde `episodio` es el valor del campo numérico (Tendencias/Buscador) o el de `proximos[].episodio` (Calendario) — en ambos casos un entero ≥1 provisto antes de abrir el enlace, nunca un valor implícito. Se usa una duración nominal de 1200s (20 min) en vez de valores 1/1, para que la proporción quede muy por debajo del umbral automático del 90% (Etapa 2) y el título aparezca en "Continuar viendo"/"Historial" **sin marcarse visto solo**. El botón "✔ Marcar como visto" (independiente) llama `alternarVisto(origen, indice, true)` — el único camino para marcar visto en esta etapa es manual, tal como se decidió.
- `client/src/modules/reproducir/Reproducir.jsx`: gana pestañas "Internet Archive" / "Anime"; la pestaña Anime reutiliza el componente de ficha/resultado de `Anime.jsx`.
- `client/src/modules/inicio/Inicio.jsx`: en `abrir(item)`, si `item.origen.startsWith('anilist:')`, en vez de intentar `resolverIA`/`resolverTorrentOrigen` (que fallarían — no es un origen de streaming), muestra directamente las fichas "Ver en {fuente}" para ese anime (recalculadas con `fuentesLegalesDe`), sin abrir el `<Reproductor>`.

## Manejo de errores

- AniList caído/sin resultados → aviso en español; el resto de la app sigue funcionando (patrón idéntico a Internet Archive caído en Etapa 1).
- Sin plataformas de anime disponibles en la región configurada → mensaje "No hay plataformas de anime configuradas para tu región." en vez de una lista vacía de botones.
- Guardado de progreso fallido tras abrir una fuente externa → silencioso (mismo patrón que el autoguardado de Etapa 2); no bloquea la navegación externa que ya ocurrió.

## Pruebas

- **`fuentesLegalesDe`** (unitario, cliente): filtra correctamente por región (`'*'`, array con región exacta, array sin ella); genera URL de búsqueda con el título codificado.
- **`server/routes/anilist.js`** (contrato, supertest): forma de respuesta de cada ruta con datos simulados/caché; `id` inválido → 400; fallo de AniList → 502 español.
- **Corrección del umbral**: test explícito de que `duracionSeg:1200, posicionSeg:1` no cruza el 90% (reutiliza `actualizarProgreso` de Etapa 2 sin cambios — es una prueba de integración de valores, no de código nuevo).
- **Cliente**: verificación manual (calendario carga, tendencias carga, buscar un anime conocido, abrir "Ver en {fuente}" abre pestaña nueva y aparece en Continuar viendo sin visto, marcar visto manualmente, pestaña Anime en Reproducir, tarjeta de anime en Inicio abre las fichas de fuente en vez de intentar reproducir).
