# 🎬 Mi Centro de Entretenimiento

Dashboard personal de entretenimiento **gratis**. Corre en tu laptop y convierte las mejores fuentes gratuitas (Tubi, Pluto TV, Internet Archive, Epic Games, Khan Academy…) en un sistema premium con:

- 📺 **Dashboard de Fuentes** — plataformas gratuitas por categoría (películas, series, música, podcasts, anime, libros, juegos, documentales, aprendizaje y torrents), con consejos para usarlas como servicio de paga.
- 🎬 **Noche de Cine** — elige tu mood y recibe 10 películas con ratings reales de IMDb y Rotten Tomatoes, dónde verlas gratis en tu país y 3 respaldos.
- 🗓️ **Modo Netflix** — parrilla semanal de 7 "canales" temáticos generada para ti.
- 🍿 **Maratón** — dile cuántas horas tienes y arma tu horario de mañana/tarde/noche.
- 🧠 **Curador de Aprendizaje** — plan semanal de sesiones de <45 min según tus intereses.
- 🎲 **¿Qué veo?** — 4 preguntas (mood, tiempo, energía, compañía) y te da 3 películas + 3 videos + 3 podcasts + 3 juegos + 3 documentales.

> Los torrents incluidos son de dominio público / Creative Commons (Internet Archive, distros Linux).

## 🎬 Reproducir (streaming legal)

Reproduce dentro de la app contenido de **Internet Archive** (búscalo en la sección Reproducir) y orígenes propios que agregues a tu **lista de fuentes permitidas** en Ajustes. Soporta URLs de video, enlaces `.torrent` y magnets **con webseed de un host permitido**, transmitiendo con WebTorrent mientras descarga.

El reproductor solo descarga desde webseeds (servidores HTTP permitidos), nunca del enjambre P2P anonimo.

> Por diseño, un magnet sin origen verificable (solo infohash y trackers públicos) se rechaza: la app reproduce Internet Archive y las fuentes legales que tú autorices, no es un buscador de contenido con copyright.

## 🏠 Inicio — continuar viendo y biblioteca

La pantalla de Inicio recuerda dónde te quedaste: reanuda automáticamente la posición de cualquier título, marca lo que ya viste (o márcalo tú manualmente), y te deja guardar tus favoritos en "Mi biblioteca". El historial se puede limpiar en cualquier momento sin perder lo guardado.

## 🎌 Anime — descubrimiento con AniList

Calendario de próximos episodios, tendencias de temporada y un buscador con fichas ricas (sinopsis, estudio, géneros), todo con datos de [AniList](https://anilist.co). Como AniList y las plataformas de anime no ofrecen streams reproducibles, "Ver en {fuente}" abre la plataforma legal en una pestaña nueva — Crunchyroll, RetroCrush, AnimeOnegai, Pluto TV Anime, canales oficiales de YouTube (Toei, TMS Anime Latino, Anime Log, Crunchyroll), Tivify (España) y Bilibili Global, según tu región. Al abrir una fuente se registra en tu historial automáticamente; guardarlo en tu biblioteca (💾) y marcarlo como visto (✔) siguen siendo acciones manuales.

## Requisitos

- [Node.js](https://nodejs.org/es) 18 o superior (gratis).

## Instalación y uso (Windows)

1. Descarga o clona este repositorio.
2. **Doble clic en `Iniciar.bat`.** La primera vez instala todo solo (1-2 min), compila la app y abre el navegador en [http://localhost:3001](http://localhost:3001) (modo producción).

En cualquier sistema: `npm install` y luego `npm start`.

Para desarrollo con recarga en vivo, usa `npm run dev` (disponible en [http://localhost:5173](http://localhost:5173)).

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
