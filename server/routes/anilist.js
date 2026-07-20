import { Router } from 'express';
import { conCache } from '../lib/cache.js';

const router = Router();
const SEIS_HORAS = 6 * 60 * 60 * 1000;
const UNA_HORA = 60 * 60 * 1000;
const ENDPOINT = 'https://graphql.anilist.co';

async function consultarAniList(query, variables) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await r.json();
  if (!r.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message || `AniList respondió ${r.status}`);
  }
  return json.data;
}

function limpiarHtml(texto) {
  return (texto || '').replace(/<[^>]+>/g, '').trim();
}

function mapMedia(m) {
  return {
    id: m.id,
    titulo: m.title?.romaji || m.title?.english || `Anime ${m.id}`,
    sinopsis: limpiarHtml(m.description),
    anio: m.startDate?.year ?? null,
    formato: m.format ?? null,
    episodios: m.episodes ?? null,
    generos: m.genres ?? [],
    estudio: m.studios?.nodes?.[0]?.name ?? null,
    portada: m.coverImage?.large ?? null,
  };
}

function temporadaActual() {
  const ahora = new Date();
  const mes = ahora.getMonth();
  let season;
  if (mes === 11 || mes <= 1) season = 'WINTER';
  else if (mes <= 4) season = 'SPRING';
  else if (mes <= 7) season = 'SUMMER';
  else season = 'FALL';
  return { season, year: ahora.getFullYear() };
}

const QUERY_BUSCAR = `
  query ($search: String) {
    Page(page: 1, perPage: 24) {
      media(search: $search, type: ANIME) {
        id title { romaji english } description(asHtml: false) startDate { year } format episodes genres
        studios(isMain: true) { nodes { name } } coverImage { large }
      }
    }
  }
`;

router.get('/buscar', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'parametros', mensaje: 'Falta el término de búsqueda.' });
  try {
    const { valor } = await conCache(`anilist-buscar:${q}`, SEIS_HORAS, async () => {
      const data = await consultarAniList(QUERY_BUSCAR, { search: q });
      return data.Page.media;
    });
    res.json({ resultados: valor.map(mapMedia) });
  } catch (error) {
    console.error('[anilist-buscar]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

const QUERY_CALENDARIO = `
  query ($inicio: Int, $fin: Int) {
    Page(page: 1, perPage: 50) {
      airingSchedules(airingAt_greater: $inicio, airingAt_lesser: $fin, sort: TIME) {
        episode airingAt
        media { id title { romaji english } coverImage { large } }
      }
    }
  }
`;

router.get('/calendario', async (req, res) => {
  try {
    const { valor } = await conCache('anilist-calendario', UNA_HORA, async () => {
      const inicio = Math.floor(Date.now() / 1000);
      const fin = inicio + 7 * 24 * 60 * 60;
      const data = await consultarAniList(QUERY_CALENDARIO, { inicio, fin });
      return data.Page.airingSchedules;
    });
    res.json({
      proximos: valor.map((s) => ({
        id: s.media.id,
        titulo: s.media.title?.romaji || s.media.title?.english || `Anime ${s.media.id}`,
        portada: s.media.coverImage?.large ?? null,
        episodio: s.episode,
        fechaEmision: new Date(s.airingAt * 1000).toISOString(),
      })),
    });
  } catch (error) {
    console.error('[anilist-calendario]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

const QUERY_TENDENCIAS = `
  query ($season: MediaSeason, $seasonYear: Int) {
    temporada: Page(page: 1, perPage: 20) {
      media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english } description(asHtml: false) startDate { year } format episodes genres
        studios(isMain: true) { nodes { name } } coverImage { large }
      }
    }
    siempre: Page(page: 1, perPage: 20) {
      media(type: ANIME, sort: POPULARITY_DESC) {
        id title { romaji english } description(asHtml: false) startDate { year } format episodes genres
        studios(isMain: true) { nodes { name } } coverImage { large }
      }
    }
  }
`;

router.get('/tendencias', async (req, res) => {
  try {
    const { valor } = await conCache('anilist-tendencias', SEIS_HORAS, async () => {
      const { season, year } = temporadaActual();
      return consultarAniList(QUERY_TENDENCIAS, { season, seasonYear: year });
    });
    res.json({
      temporada: valor.temporada.media.map(mapMedia),
      siempre: valor.siempre.media.map(mapMedia),
    });
  } catch (error) {
    console.error('[anilist-tendencias]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

const QUERY_MEDIA = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id title { romaji english } description(asHtml: false) episodes
      startDate { year } format genres studios(isMain: true) { nodes { name } }
      coverImage { large } status
    }
  }
`;

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id-invalido', mensaje: 'Identificador de AniList inválido.' });
  try {
    const { valor } = await conCache(`anilist-media:${id}`, SEIS_HORAS, async () => {
      const data = await consultarAniList(QUERY_MEDIA, { id });
      return data.Media;
    });
    res.json({
      id: valor.id,
      titulo: valor.title?.romaji || valor.title?.english || `Anime ${valor.id}`,
      tituloIngles: valor.title?.english ?? null,
      sinopsis: limpiarHtml(valor.description),
      episodios: valor.episodes ?? null,
      anio: valor.startDate?.year ?? null,
      formato: valor.format ?? null,
      estudio: valor.studios?.nodes?.[0]?.name ?? null,
      generos: valor.genres ?? [],
      portada: valor.coverImage?.large ?? null,
      estado: valor.status ?? null,
    });
  } catch (error) {
    console.error('[anilist-media]', error.message);
    res.status(502).json({ error: 'anilist', mensaje: 'No se pudo consultar AniList en este momento.' });
  }
});

export default router;
