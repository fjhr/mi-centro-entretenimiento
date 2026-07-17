import { Router } from 'express';
import { obtenerConfig } from '../lib/almacen.js';
import { conCache } from '../lib/cache.js';

const router = Router();
const DOCE_HORAS = 12 * 60 * 60 * 1000;

router.get('/*', async (req, res) => {
  const c = obtenerConfig();
  if (!c.tmdbKey) {
    return res.status(503).json({ error: 'falta-key', mensaje: 'Configura tu API key de TMDB en Ajustes.' });
  }
  const params = new URLSearchParams(req.query);
  params.set('api_key', c.tmdbKey);
  if (!params.has('language')) params.set('language', c.region === 'ES' ? 'es-ES' : 'es-MX');
  const url = `https://api.themoviedb.org/3/${req.params[0]}?${params}`;
  try {
    const { valor } = await conCache(url, DOCE_HORAS, async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`TMDB respondió ${r.status}`);
      return r.json();
    });
    res.json(valor);
  } catch (error) {
    res.status(502).json({ error: 'tmdb', mensaje: error.message });
  }
});

export default router;
