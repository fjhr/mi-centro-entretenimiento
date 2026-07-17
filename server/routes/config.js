import { Router } from 'express';
import { obtenerConfig, guardarJson } from '../lib/almacen.js';

const router = Router();

router.get('/', (req, res) => {
  const c = obtenerConfig();
  res.json({ region: c.region, tieneTmdb: Boolean(c.tmdbKey), tieneOmdb: Boolean(c.omdbKey) });
});

router.put('/', (req, res) => {
  const actual = obtenerConfig();
  const { tmdbKey, omdbKey, region } = req.body || {};
  if (typeof tmdbKey === 'string' && tmdbKey.trim()) actual.tmdbKey = tmdbKey.trim();
  if (typeof omdbKey === 'string' && omdbKey.trim()) actual.omdbKey = omdbKey.trim();
  if (typeof region === 'string' && region.trim()) actual.region = region.trim().toUpperCase();
  guardarJson('config', actual);
  res.json({ ok: true });
});

router.post('/probar', async (req, res) => {
  const c = obtenerConfig();
  const resultado = { tmdb: false, omdb: false };
  try {
    const r = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${c.tmdbKey}`);
    resultado.tmdb = r.ok;
  } catch { /* sin internet: queda en false */ }
  try {
    const r = await fetch(`https://www.omdbapi.com/?apikey=${c.omdbKey}&i=tt0111161`);
    resultado.omdb = (await r.json()).Response === 'True';
  } catch { /* sin internet: queda en false */ }
  res.json(resultado);
});

export default router;
