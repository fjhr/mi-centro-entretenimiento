const UMBRAL_VISTO = 0.9;

export function actualizarProgreso(datos, { origen, indice, posicionSeg, duracionSeg, titulo, poster }) {
  const ahora = new Date().toISOString();
  const existente = datos[origen];
  const vistoPrevio = existente?.archivos?.[indice]?.visto ?? false;
  const vistoNuevo = duracionSeg > 0 && posicionSeg / duracionSeg >= UMBRAL_VISTO ? true : vistoPrevio;
  const cruzoUmbral = !vistoPrevio && vistoNuevo;

  const entrada = {
    titulo: titulo ?? existente?.titulo ?? '',
    poster: poster ?? existente?.poster ?? null,
    guardado: existente?.guardado ?? false,
    primeraVez: existente?.primeraVez ?? ahora,
    ultimaVez: ahora,
    archivos: {
      ...existente?.archivos,
      [indice]: { posicionSeg, duracionSeg, visto: vistoNuevo, ultimaVez: ahora },
    },
  };

  return { datos: { ...datos, [origen]: entrada }, visto: cruzoUmbral };
}

export function alternarGuardado(datos, origen, guardado, meta = {}) {
  const ahora = new Date().toISOString();
  const existente = datos[origen];
  const entrada = {
    titulo: meta.titulo ?? existente?.titulo ?? '',
    poster: meta.poster ?? existente?.poster ?? null,
    guardado,
    primeraVez: existente?.primeraVez ?? ahora,
    ultimaVez: existente?.ultimaVez ?? ahora,
    archivos: existente?.archivos ?? {},
  };
  return { ...datos, [origen]: entrada };
}

export function alternarVisto(datos, origen, indice, visto) {
  const existente = datos[origen];
  if (!existente) return datos;
  const ahora = new Date().toISOString();
  const archivoExistente = existente.archivos[indice] ?? { posicionSeg: 0, duracionSeg: 0 };
  return {
    ...datos,
    [origen]: {
      ...existente,
      ultimaVez: ahora,
      archivos: { ...existente.archivos, [indice]: { ...archivoExistente, visto, ultimaVez: ahora } },
    },
  };
}

export function limpiarHistorial(datos) {
  const resultado = {};
  for (const [origen, entrada] of Object.entries(datos)) {
    if (entrada.guardado) resultado[origen] = entrada;
  }
  return resultado;
}

function archivosDe(entrada) {
  return Object.values(entrada.archivos ?? {});
}

function aLista(datos, filtro) {
  return Object.entries(datos)
    .filter(([, entrada]) => filtro(entrada))
    .sort((a, b) => new Date(b[1].ultimaVez) - new Date(a[1].ultimaVez))
    .map(([origen, entrada]) => ({ origen, ...entrada }));
}

export function continuarViendo(datos) {
  return aLista(datos, (e) => archivosDe(e).some((a) => a.duracionSeg > 0 && a.posicionSeg > 0 && a.posicionSeg / a.duracionSeg < UMBRAL_VISTO));
}

export function guardados(datos) {
  return aLista(datos, (e) => e.guardado);
}

export function historial(datos) {
  return aLista(datos, (e) => archivosDe(e).some((a) => a.posicionSeg > 0));
}
