# Diseño: UX estilo Hayase (Etapa 2)

**Fecha:** 2026-07-19
**Estado:** Aprobado por el usuario (diseño conversacional)
**Proyecto:** Mi Centro de Entretenimiento — https://github.com/fjhr/mi-centro-entretenimiento

## Contexto

Segunda de cuatro etapas planeadas sobre la experiencia de reproducción tipo Hayase (Etapa 1: reproductor + streaming legal, ya en `main`). Esta etapa añade la capa de experiencia de usuario que hace que la app se sienta como un servicio de streaming real: continuar viendo, progreso por episodio, biblioteca personal, historial, y un refresco visual del sistema de diseño aplicado a toda la app. Etapas siguientes (fuera de esta spec): (3) anime legal con metadatos AniList; (4) fuentes parametrizables legales avanzadas.

## Alcance

1. **Continuar viendo** — resume automático de la posición de reproducción.
2. **Progreso y "visto"** — barra de progreso por archivo; marcado automático al 90% de duración; override manual.
3. **Mi biblioteca** — guardar/quitar títulos para volver a ellos.
4. **Historial** — lista cronológica de reproducciones, con opción de limpiar (conservando lo guardado).
5. **Pantalla de Inicio** — hero + filas horizontales estilo Netflix/Hayase que consumen lo anterior.
6. **Refresco visual** — nuevo sistema de diseño (paleta, tipografía, tarjetas con overlay de progreso, transiciones) aplicado a las 8 secciones existentes vía `styles.css` compartido.

**Fuera de alcance:** metadatos de AniList, catálogos parametrizables más allá de la allowlist de la Etapa 1, sincronización multi-dispositivo (la app sigue siendo local, un solo usuario).

## Modelo de datos: un único store de biblioteca

Un solo archivo `server/data/biblioteca.json` es la fuente de verdad; "Continuar viendo" e "Historial" son vistas calculadas sobre él, no colecciones separadas.

```
{
  "<origen-normalizado>": {
    "titulo": string,
    "poster": string | null,
    "guardado": boolean,
    "primeraVez": string (ISO),
    "ultimaVez": string (ISO),
    "archivos": {
      "<indice>": {
        "posicionSeg": number,
        "duracionSeg": number,
        "visto": boolean,
        "ultimaVez": string (ISO)
      }
    }
  }
}
```

- **Clave del registro:** el `origen` tal como se abrió (identificador de Internet Archive, o el magnet/URL pegado), normalizado (recortado; sin cambios de mayúsculas para no romper magnets sensibles a mayúsculas). Reutiliza el concepto de `origen` ya validado por `validarOrigen` en la Etapa 1.
- **Progreso por archivo:** cada `indice` de archivo dentro de un origen lleva su propia posición y estado `visto`, para que un torrent con varios episodios muestre cuáles ya se vieron.
- **"Visto" automático:** cuando `posicionSeg / duracionSeg >= 0.9`, `visto` pasa a `true` en la siguiente actualización de progreso. El usuario puede alternarlo manualmente en cualquier momento (override explícito, no se revierte solo).
- **Selectores** (funciones puras, no hay endpoints nuevos por vista):
  - `continuarViendo(datos)` → orígenes con al menos un archivo con `0 < posicionSeg/duracionSeg < 0.9`, ordenados por `ultimaVez` descendente.
  - `guardados(datos)` → orígenes con `guardado: true`, ordenados por `ultimaVez` descendente.
  - `historial(datos)` → todos los orígenes con algún archivo con `posicionSeg > 0`, ordenados por `ultimaVez` descendente.

## Backend

- **`server/lib/biblioteca.js`** — lógica pura: `actualizarProgreso(datos, {origen, indice, posicionSeg, duracionSeg, titulo, poster})` (crea el registro si no existe; aplica el umbral del 90% para `visto`; actualiza `ultimaVez`/`primeraVez`), `alternarGuardado(datos, origen, guardado)`, `alternarVisto(datos, origen, indice, visto)` (override manual), `limpiarHistorial(datos)` (elimina archivos con `posicionSeg` reseteado a 0 para orígenes no guardados; conserva por completo los registros con `guardado: true`), y los tres selectores de arriba. Todas reciben/devuelven el objeto `datos` completo — sin I/O — para ser testeables sin disco.
- **`server/routes/biblioteca.js`** — persiste vía `leerJson`/`guardarJson` de `lib/almacen.js` bajo la clave `biblioteca` (mismo mecanismo que ya usan los planes semanales):
  - `GET /api/biblioteca` → `{ continuarViendo: [...], guardados: [...], historial: [...] }` (aplica los tres selectores sobre el store completo).
  - `PUT /api/biblioteca/progreso` `{origen, indice, posicionSeg, duracionSeg, titulo, poster}` → `{ ok:true, visto: boolean }` (informa si este update cruzó el umbral del 90%, para que el cliente pueda mostrar una confirmación).
  - `PUT /api/biblioteca/guardado` `{origen, guardado, titulo?, poster?}` → `{ ok:true }` (permite guardar algo que aún no tiene progreso, ej. desde la rejilla de resultados sin haberlo abierto).
  - `PUT /api/biblioteca/visto` `{origen, indice, visto}` → `{ ok:true }`.
  - `DELETE /api/biblioteca/historial` → `{ ok:true }`.
  - Validación de entrada: `origen` no vacío, `indice`/`posicionSeg`/`duracionSeg` numéricos ≥0. Errores en español, mismo patrón que el resto del servidor.

## Frontend

- **`client/src/lib/biblioteca.js`** — helpers: `obtenerBiblioteca()`, `guardarProgreso({...})` (debounced/throttled a 10s por el llamador, ver abajo), `alternarGuardado(origen, guardado, meta?)`, `alternarVisto(origen, indice, visto)`, `limpiarHistorial()`.
- **`Reproductor.jsx` (modificado):** al montar una fuente, si existe progreso guardado para `(origen, indice)`, hace `video.currentTime = posicionGuardada` una vez que el video tiene metadatos cargados (evento `loadedmetadata`). Mientras reproduce, un intervalo de 10s llama a `guardarProgreso`; también se guarda en `pause`, en `beforeunload`, y al cerrar el reproductor (`onCerrar`). Se añade un botón "✔ Visto" que llama a `alternarVisto` (además del umbral automático del 90%, gestionado por el servidor en cada `guardarProgreso`).
- **Botón de guardar** en las tarjetas de resultados (Reproducir e Inicio): "💾 Guardar" / "✔ Guardada", llama a `alternarGuardado`.
- **Nueva sección `modules/inicio/Inicio.jsx`** (primera en `SECCIONES`, reemplaza "fuentes" como pantalla de arranque): hero con el título más reciente de `continuarViendo` (si existe) mostrando póster grande + botón "▶ Continuar"; debajo, tres filas horizontales deslizables ("Continuar viendo", "Mi biblioteca", "Historial reciente") de tarjetas con póster y una barra de progreso superpuesta (`archivo.posicionSeg/duracionSeg`); clic en una tarjeta abre el `Reproductor` directamente en ese origen/archivo. Botón "Limpiar historial" visible en la fila de historial.
- **Refresco visual (`styles.css`):** nuevas variables de color/tipografía/radio/sombra; las tarjetas existentes (`.tarjeta`) ganan soporte opcional para una barra de progreso superpuesta (`.tarjeta-progreso`); se añaden estilos de fila horizontal deslizable (`.fila-carrusel`) y hero (`.hero`). Los 8 módulos existentes heredan el refresco automáticamente al compartir las mismas clases; no se reescribe su marcado salvo donde una clase cambie de nombre.

## Manejo de errores

- Sin biblioteca previa (primer uso): `GET /api/biblioteca` devuelve las tres listas vacías; Inicio muestra un estado vacío en español invitando a explorar Reproducir.
- Fallo al guardar progreso (red/servidor caído): se reintenta en el siguiente ciclo de 10s; no bloquea la reproducción ni muestra error intrusivo (fallo silencioso con log en consola del navegador).
- `resume` a una posición mayor que la duración real del archivo (datos corruptos/desincronizados): se ignora el resume y se reproduce desde el inicio.

## Pruebas

- **`lib/biblioteca.js`** (crítico, unitario): creación de registro nuevo en `actualizarProgreso`; umbral 90% marca `visto` automáticamente; actualización no pisa `guardado` ni otros archivos del mismo origen; `alternarGuardado` crea registro si no existe; `alternarVisto` no se revierte por un `actualizarProgreso` posterior por debajo del umbral (el override manual persiste); `limpiarHistorial` resetea no-guardados y preserva guardados; los tres selectores (orden, filtrado por rango de progreso, filtrado por `guardado`).
- **`routes/biblioteca.js`** (contrato, supertest): cada ruta con payload válido/ inválido; `GET` refleja lo persistido tras un `PUT`.
- **Cliente:** verificación manual (reproducir algo, cerrar antes de terminar, reabrir y confirmar que reanuda; marcar visto manual; guardar/quitar de biblioteca; ver las filas en Inicio; limpiar historial y confirmar que lo guardado sobrevive).
