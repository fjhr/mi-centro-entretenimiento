# Diseño: Mi Centro de Entretenimiento

**Fecha:** 2026-07-17
**Estado:** ✅ Implementado y publicado el 2026-07-17 en https://github.com/fjhr/mi-centro-entretenimiento (33 tests, revisión final aprobada). Plan ejecutado: `docs/superpowers/plans/2026-07-17-mi-centro-entretenimiento.md`.

## Resumen

Aplicación local (laptop, Windows) de dashboard de entretenimiento personal, 100% en español, con 6 módulos que comparten un motor de recomendación y un catálogo curado de fuentes gratuitas y legales. Se ejecuta con un solo comando y el código se publica en el GitHub personal del usuario.

**Decisiones clave del usuario:**
- App local con servidor (no GitHub Pages estático).
- Usa API keys gratuitas: TMDB (catálogo, pósters, dónde ver) y OMDb (ratings IMDb y Rotten Tomatoes).
- Stack: Node.js + Express (backend) y React + Vite (frontend).
- Región configurable en Ajustes (México, España, cualquier código de país TMDB).
- SPA única con motor de recomendación compartido entre los 6 módulos.
- Solo fuentes legales. Torrents únicamente legales (Internet Archive, dominio público, Creative Commons). Sin indexadores de contenido con derechos de autor.

## Arquitectura

```
Entretenimiento/
├── server/          # Express: proxy con caché a TMDB/OMDb, persistencia JSON
│   ├── index.js
│   ├── routes/      # /api/tmdb/*, /api/omdb/*, /api/prefs, /api/planes
│   ├── cache/       # caché en disco de respuestas de APIs (gitignored)
│   └── data/        # preferencias, historial, planes generados (gitignored)
├── client/          # React + Vite: SPA con 6 secciones
│   └── src/
│       ├── modules/     # una carpeta por módulo
│       ├── engine/      # motor de recomendación compartido
│       ├── catalog/     # catálogo curado de plataformas (JSON versionado)
│       └── components/  # UI compartida (tarjetas, chips, parrillas)
├── docs/
└── .env             # TMDB_API_KEY, OMDB_API_KEY (gitignored, con .env.example)
```

- El **servidor** existe para: (1) ocultar las API keys, (2) cachear respuestas en disco (ahorra cuota de OMDb ~1000/día), (3) persistir datos del usuario en archivos JSON. Sin base de datos.
- El **cliente** es una SPA React con navegación por secciones (sin router complejo o con react-router simple).
- `npm run dev` en la raíz arranca servidor y cliente (concurrently).
- Idioma: toda la UI, datos curados y README en español. Peticiones a TMDB con `language=es-MX`/`es-ES` según región.

## Módulos

### 1. Dashboard de Fuentes
Catálogo curado (JSON versionado en el repo) de plataformas gratuitas por categoría: **Películas, Series, Música, Podcasts, Anime, Libros, Juegos, Documentales, Aprendizaje**. Por plataforma: nombre, URL, para qué es mejor, si requiere registro, regiones donde funciona, tiene anuncios o no, y un consejo "modo premium" (cómo sacarle el máximo provecho gratis). Se filtra por la región configurada. Incluye sección de torrents legales (Internet Archive, dominio público, Creative Commons).

### 2. Noche de Cine
El usuario elige un **mood** (chips: risa, tensión, lágrimas, mente volada, nostalgia, acción, romance, terror). Devuelve **10 películas** con: póster, ratings IMDb y Rotten Tomatoes (OMDb, cacheados), dónde verla (TMDB watch providers de la región, priorizando plataformas gratuitas), "por qué te va a gustar" (texto generado por reglas a partir de género + mood + rating + popularidad), y **3 opciones de respaldo**.

### 3. Modo Netflix Semanal
Genera una parrilla de **7 días** con "canales" temáticos (ej. Lunes de Risa, Miércoles Documental, Viernes de Estreno). Cada día: 2-3 ítems mezclando categorías, con la plataforma donde verlo y una búsqueda sugerida (query lista para copiar/abrir). Regenerable y persistente (se guarda el plan de la semana).

### 4. Maratón de Fin de Semana
Entradas: **horas disponibles** (número) e **intereses** (multiselección). Genera horario **mañana / tarde / noche** que mezcla películas, series, podcasts, juegos y sesiones de aprendizaje, ajustando duraciones reales al tiempo disponible (las duraciones vienen de TMDB o de estimaciones del catálogo curado).

### 5. Curador de Aprendizaje
Entradas: intereses (negocios, IA, tecnología, historia, idiomas, ciencia…). Genera **plan semanal** de sesiones de **menos de 45 minutos** usando fuentes gratuitas (YouTube, podcasts, cursos abiertos), con "qué vas a aprender" por sesión.

### 6. Botón «¿Qué veo?»
Flujo de 4 preguntas rápidas: **mood, tiempo disponible, energía, con quién estás**. Devuelve **3 películas + 3 videos + 3 podcasts + 3 juegos + 3 documentales**, cada uno con dónde encontrarlo y por qué encaja con las respuestas.

## Motor de recomendación compartido

Módulo central (`client/src/engine/` con lógica pura testeable) que recibe:

```
{ mood?, tiempoMin?, energia?, compania?, intereses?, categorias?, region }
```

y produce listas puntuadas combinando dos fuentes:
1. **Catálogo curado local** (plataformas, podcasts, juegos, recursos de aprendizaje con etiquetas de mood/interés/duración).
2. **TMDB discover** (películas/series/documentales por género, rating mínimo, época), enriquecido con ratings de OMDb bajo demanda.

Mapeo mood→géneros/etiquetas definido en un archivo de configuración. El historial guardado (lo ya recomendado/visto) penaliza repeticiones. Cada módulo llama al motor con parámetros distintos; los planificadores (módulos 3 y 4) añaden una capa de **distribución en franjas horarias**.

## Manejo de errores

- **Sin API keys o sin internet:** la app funciona en modo degradado con el catálogo curado y muestra un aviso claro de qué se pierde y cómo configurar las keys.
- **Cuota de OMDb agotada:** se muestran ratings cacheados con su fecha de captura.
- **TMDB sin providers para la región:** se ofrecen las plataformas gratuitas del catálogo curado con búsqueda sugerida como respaldo.

## Testing

- **Vitest** para la lógica de mayor riesgo: motor de recomendación (filtrado, puntuación, anti-repetición) y planificadores de horarios (distribución de franjas, respeto del tiempo disponible).
- Rutas del servidor: tests básicos de contrato (respuesta con/sin keys, caché).
- UI: verificación manual ejecutando la app.

## Fuera de alcance (v1)

- Recomendaciones con LLM/IA.
- Cuentas multiusuario o sincronización en la nube.
- Scraping de sitios sin API.
- Indexadores de torrents de contenido con copyright.
- Reproducción embebida de contenido (la app enlaza, no reproduce, salvo embeds triviales tipo YouTube si aportan).

## Instalación y ejecución amigables (requisito del usuario)

- **Arranque con doble clic:** un `Iniciar.bat` en la raíz que instala dependencias si faltan (`npm install` silencioso la primera vez), arranca servidor + cliente y abre el navegador automáticamente en la app. Alternativa técnica: `npm start` en la raíz hace lo mismo.
- **Configuración de API keys desde la propia app:** la pantalla de Ajustes permite pegar las keys de TMDB y OMDb con instrucciones paso a paso (enlaces directos a los formularios de registro) y un botón "Probar conexión". El servidor las guarda en un archivo de configuración local (gitignored); nunca se edita `.env` a mano.
- **Único prerequisito:** tener Node.js instalado; el README lo explica con capturas/enlace de descarga, y `Iniciar.bat` detecta su ausencia y muestra un mensaje claro en español.

## Notas operativas

- El proyecto vive en una carpeta sincronizada por OneDrive; se recomendará en el README excluir `node_modules/`, `server/cache/` y `server/data/` de la sincronización (o mover el repo fuera de OneDrive) para evitar conflictos y lentitud.
- Publicación: repositorio público en GitHub personal con README en español (requisitos, obtención de keys, instalación, uso).
