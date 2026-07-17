import { Router } from 'express';
import { obtenerConfig } from '../lib/almacen.js';
import { conCache } from '../lib/cache.js';

const router = Router();
const DOCE_HORAS = 12 * 60 * 60 * 1000;

router.get('/*', async (req, res) => {
  // Validar ruta de TMDB (prevenir SSRF/path-traversal) ANTES de cualquier otra validación
  const rutaTmdb = req.params[0];
  if (!/^[A-Za-z0-9_/]+$/.test(rutaTmdb)) {
    return res.status(400).json({ error: 'ruta-invalida', mensaje: 'Ruta de TMDB inválida.' });
  }

  const c = obtenerConfig();
  if (!c.tmdbKey) {
    return res.status(503).json({ error: 'falta-key', mensaje: 'Configura tu API key de TMDB en Ajustes.' });
  }

  const params = new URLSearchParams(req.query);
  if (!params.has('language')) params.set('language', c.region === 'ES' ? 'es-ES' : 'es-MX');

  // Cache key sin la API key
  const clave = `tmdb:${rutaTmdb}?${params.toString()}`;
  params.set('api_key', c.tmdbKey);
  const url = `https://api.themoviedb.org/3/${rutaTmdb}?${params}`;

  try {
    const { valor } = await conCache(clave, DOCE_HORAS, async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`TMDB respondió ${r.status}`);
      return r.json();
    });
    res.json(valor);
  } catch (error) {
    console.error('[tmdb]', error.message);
    res.status(502).json({ error: 'tmdb', mensaje: 'No se pudo consultar TMDB en este momento.' });
  }
});

export default router;
