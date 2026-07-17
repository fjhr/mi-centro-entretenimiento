import { tmdb, omdb } from './api.js';
import { MOODS } from '../engine/moods.js';

const NOMBRES_GENERO = {
  28: 'acción', 12: 'aventura', 35: 'comedia', 18: 'drama', 53: 'suspenso',
  878: 'ciencia ficción', 9648: 'misterio', 10749: 'romance', 27: 'terror',
  99: 'documental', 10751: 'familiar', 16: 'animación', 80: 'crimen', 14: 'fantasía',
};

export function urlPoster(poster) {
  return poster ? `https://image.tmdb.org/t/p/w342${poster}` : null;
}

function aItem(p) {
  return {
    id: p.id,
    titulo: p.title,
    anio: p.release_date ? Number(p.release_date.slice(0, 4)) : undefined,
    generos: p.genre_ids ?? [],
    rating: p.vote_average,
    poster: p.poster_path,
    resumen: p.overview,
    duracionMin: 110,
    categoria: 'pelicula',
  };
}

export async function buscarPorMood(moodClave, paginas = 2) {
  const mood = MOODS[moodClave];
  const params = {
    with_genres: mood.generos.join('|'),
    sort_by: 'popularity.desc',
    'vote_count.gte': 300,
    include_adult: false,
  };
  if (mood.antesDe) params['primary_release_date.lte'] = `${mood.antesDe - 1}-12-31`;
  const respuestas = await Promise.all(
    Array.from({ length: paginas }, (_, i) => tmdb('discover/movie', { ...params, page: i + 1 })),
  );
  return respuestas.flatMap((r) => r.results ?? []).map(aItem);
}

export async function dondeVer(idPelicula, region) {
  try {
    const r = await tmdb(`movie/${idPelicula}/watch/providers`);
    const zona = r.results?.[region];
    const nombres = (lista) => (lista ?? []).map((p) => p.provider_name);
    return {
      gratis: [...new Set([...nombres(zona?.free), ...nombres(zona?.ads)])],
      suscripcion: nombres(zona?.flatrate),
      enlace: zona?.link ?? null,
    };
  } catch {
    return { gratis: [], suscripcion: [], enlace: null };
  }
}

export async function ratingsDe(titulo, anio) {
  try {
    const params = { t: titulo };
    if (anio) params.y = anio;
    return await omdb(params);
  } catch {
    return null;
  }
}

export function porQueTeGustara(item, moodClave) {
  const mood = MOODS[moodClave];
  const generos = (item.generos ?? [])
    .map((g) => NOMBRES_GENERO[g])
    .filter(Boolean)
    .slice(0, 2);
  const partes = [];
  if (generos.length) partes.push(`Combina ${generos.join(' y ')}`);
  if (typeof item.rating === 'number' && item.rating >= 7) partes.push(`con una calificación sólida de ${item.rating.toFixed(1)}/10`);
  if (mood) partes.push(`— justo lo que pide un mood de ${mood.nombre.toLowerCase()}`);
  if (mood?.antesDe && item.anio && item.anio < mood.antesDe) partes.push(`, y es un clásico de ${item.anio}`);
  return partes.length ? `${partes.join(' ')}.` : 'Una opción popular y bien valorada para hoy.';
}
