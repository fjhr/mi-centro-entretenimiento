import { api } from './api.js';
import fuentes from '../catalog/fuentes.json';

export function buscarAnime(q) {
  return api(`/anilist/buscar?q=${encodeURIComponent(q)}`);
}

export function obtenerAnime(id) {
  return api(`/anilist/${id}`);
}

export function obtenerCalendario() {
  return api('/anilist/calendario');
}

export function obtenerTendencias() {
  return api('/anilist/tendencias');
}

function disponibleEn(fuente, region) {
  return fuente.regiones === '*' || fuente.regiones.includes('*') || fuente.regiones.includes(region);
}

export function fuentesLegalesDe(titulo, region) {
  return fuentes
    .filter((f) => f.categoria === 'anime' && disponibleEn(f, region))
    .map((f) => ({
      nombre: f.nombre,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${titulo} ${f.nombre} ver`)}`,
    }));
}
