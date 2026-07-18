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
