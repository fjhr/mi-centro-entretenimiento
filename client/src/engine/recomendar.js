import { MOODS } from './moods.js';

export function puntuar(item, criterios = {}) {
  let puntos = 0;
  const mood = criterios.mood ? MOODS[criterios.mood] : null;

  if (mood) {
    const coincidencias = (item.generos ?? []).filter((g) => mood.generos.includes(g)).length;
    puntos += coincidencias * 3;
    if (mood.antesDe && item.anio && item.anio < mood.antesDe) puntos += 2;
  }
  if (criterios.intereses?.length && item.etiquetas?.length) {
    puntos += item.etiquetas.filter((e) => criterios.intereses.includes(e)).length * 3;
  }
  if (typeof item.rating === 'number') puntos += item.rating / 2;
  if (criterios.tiempoMin && item.duracionMin) {
    puntos += item.duracionMin <= criterios.tiempoMin ? 1 : -4;
  }
  if (criterios.energia && item.energia === criterios.energia) puntos += 2;
  if (criterios.compania && item.compania?.includes(criterios.compania)) puntos += 2;
  if (criterios.vistos?.includes(item.id)) puntos -= 10;
  return puntos;
}

export function recomendar(items, criterios = {}, limite = 10) {
  return items
    .map((item) => ({ ...item, puntaje: puntuar(item, criterios) }))
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, limite);
}
