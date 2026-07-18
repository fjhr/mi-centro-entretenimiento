import { Router } from 'express';
import { validarOrigen } from '../lib/origen.js';
import { obtenerConfig } from '../lib/almacen.js';
import { agregar, obtenerArchivo, cerrar } from '../lib/torrentes.js';

const router = Router();

export function srtAVtt(texto) {
  const cuerpo = texto.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${cuerpo}`;
}

router.post('/torrent', async (req, res) => {
  const origen = (req.body?.origen || '').toString();
  const { allowlist } = obtenerConfig();
  const v = validarOrigen(origen, allowlist);
  if (!v.ok) return res.status(400).json({ error: 'origen-rechazado', motivo: v.motivo });
  try {
    const info = await agregar(origen);
    res.json(info);
  } catch (error) {
    console.error('[stream-torrent]', error.message);
    res.status(502).json({ error: 'torrent', mensaje: 'No se pudo abrir el torrent.' });
  }
});

router.get('/torrent/:id/:indice', async (req, res) => {
  const archivo = await obtenerArchivo(req.params.id, Number(req.params.indice));
  if (!archivo) return res.status(404).json({ error: 'no-encontrado', mensaje: 'Recurso no disponible.' });
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', archivo.tipoMime);
  const rango = req.headers.range;
  if (rango) {
    const m = /bytes=(\d*)-(\d*)/.exec(rango);
    let start = m && m[1] ? Number(m[1]) : 0;
    let end = Math.min(m && m[2] ? Number(m[2]) : archivo.length - 1, archivo.length - 1);
    if (m && !m[1] && m[2]) {
      // Forma sufijo: bytes=-N (los ultimos N bytes)
      start = Math.max(0, archivo.length - Number(m[2]));
      end = archivo.length - 1;
    }
    if (start >= archivo.length || start > end) {
      res.setHeader('Content-Range', `bytes */${archivo.length}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${archivo.length}`);
    res.setHeader('Content-Length', end - start + 1);
    archivo.crear({ start, end }).pipe(res);
  } else {
    res.status(200);
    res.setHeader('Content-Length', archivo.length);
    archivo.crear().pipe(res);
  }
});

router.get('/subtitulo', async (req, res) => {
  const url = (req.query.url || '').toString();
  const { allowlist } = obtenerConfig();
  const v = validarOrigen(url, allowlist);
  if (!v.ok || (v.tipo !== 'http' && v.tipo !== 'ia')) {
    return res.status(400).json({ error: 'origen-rechazado', motivo: v.motivo || 'formato-no-soportado' });
  }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Subtítulo respondió ${r.status}`);
    const texto = await r.text();
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send(url.toLowerCase().split('?')[0].endsWith('.vtt') ? texto : srtAVtt(texto));
  } catch (error) {
    console.error('[subtitulo]', error.message);
    res.status(502).json({ error: 'subtitulo', mensaje: 'No se pudo cargar el subtítulo.' });
  }
});

router.delete('/torrent/:id', async (req, res) => {
  await cerrar(req.params.id);
  res.json({ ok: true });
});

export default router;
