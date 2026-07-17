import { Router } from 'express';
import { obtenerConfig } from '../lib/almacen.js';
import { conCache } from '../lib/cache.js';

const router = Router();
const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

router.get('/', async (req, res) => {
  const c = obtenerConfig();
  if (!c.omdbKey) {
    return res.status(503).json({ error: 'falta-key', mensaje: 'Configura tu API key de OMDb en Ajustes.' });
  }
  const params = new URLSearchParams();
  for (const nombre of ['i', 't', 'y']) {
    if (req.query[nombre]) params.set(nombre, req.query[nombre]);
  }
  if (!params.has('i') && !params.has('t')) {
    return res.status(400).json({ error: 'parametros', mensaje: 'Se requiere i (imdbId) o t (título).' });
  }
  const clave = `omdb:${params.toString()}`;
  params.set('apikey', c.omdbKey);
  try {
    const { valor, fecha } = await conCache(clave, SIETE_DIAS, async () => {
      const r = await fetch(`https://www.omdbapi.com/?${params}`);
      const j = await r.json();
      if (j.Response !== 'True') throw new Error(j.Error || 'OMDb sin resultado');
      return j;
    });
    const rt = valor.Ratings?.find((x) => x.Source === 'Rotten Tomatoes')?.Value ?? null;
    res.json({
      imdb: valor.imdbRating && valor.imdbRating !== 'N/A' ? valor.imdbRating : null,
      rottenTomatoes: rt,
      titulo: valor.Title ?? null,
      fecha,
    });
  } catch (error) {
    res.status(502).json({ error: 'omdb', mensaje: error.message });
  }
});

export default router;
