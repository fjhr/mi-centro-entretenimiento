import { api } from './api.js';

export function obtenerBiblioteca() {
  return api('/biblioteca');
}

export function guardarProgreso({ origen, indice, posicionSeg, duracionSeg, titulo, poster }) {
  return api('/biblioteca/progreso', { method: 'PUT', body: { origen, indice, posicionSeg, duracionSeg, titulo, poster } });
}

export function alternarGuardado(origen, guardado, meta = {}) {
  return api('/biblioteca/guardado', { method: 'PUT', body: { origen, guardado, ...meta } });
}

export function alternarVisto(origen, indice, visto) {
  return api('/biblioteca/visto', { method: 'PUT', body: { origen, indice, visto } });
}

export function limpiarHistorial() {
  return api('/biblioteca/historial', { method: 'DELETE' });
}
