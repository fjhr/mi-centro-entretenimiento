import { Router } from 'express';
import { conCache } from '../lib/cache.js';

const router = Router();
const UNA_HORA = 60 * 60 * 1000;
const IA = 'https://archive.org';

const EXT_VIDEO = ['.mp4', '.mkv', '.webm', '.ogv', '.m4v', '.mov'];
const EXT_AUDIO = ['.mp3', '.ogg', '.flac', '.m4a', '.wav'];
const EXT_SUB = ['.srt', '.vtt'];

const terminaEn = (nombre, exts) => exts.some((e) => nombre.toLowerCase().endsWith(e));

router.get('/ia/buscar', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'parametros', mensaje: 'Falta el término de búsqueda.' });
  const url = `${IA}/advancedsearch.php?q=${encodeURIComponent(q)}` +
    '&fl[]=identifier&fl[]=title&fl[]=year&fl[]=mediatype' +
    '&rows=40&page=1&output=json';
  try {
    const { valor } = await conCache(`ia-buscar:${q}`, UNA_HORA, async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Internet Archive respondió ${r.status}`);
      return r.json();
    });
    const resultados = (valor.response?.docs ?? []).map((d) => ({
      identificador: d.identifier,
      titulo: d.title ?? d.identifier,
      anio: d.year ?? null,
      tipo: d.mediatype ?? null,
      miniatura: `${IA}/services/img/${d.identifier}`,
    }));
    res.json({ resultados });
  } catch (error) {
    console.error('[ia-buscar]', error.message);
    res.status(502).json({ error: 'ia', mensaje: 'No se pudo buscar en Internet Archive.' });
  }
});

router.get('/ia/:id', async (req, res) => {
  const id = req.params.id;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return res.status(400).json({ error: 'id-invalido', mensaje: 'Identificador inválido.' });
  try {
    const { valor } = await conCache(`ia-meta:${id}`, UNA_HORA, async () => {
      const r = await fetch(`${IA}/metadata/${id}`);
      if (!r.ok) throw new Error(`Internet Archive respondió ${r.status}`);
      return r.json();
    });
    const lista = valor.files ?? [];
    const archivos = lista
      .filter((f) => terminaEn(f.name, EXT_VIDEO) || terminaEn(f.name, EXT_AUDIO))
      .map((f) => ({
        nombre: f.name,
        formato: f.format ?? '',
        url: `${IA}/download/${id}/${encodeURIComponent(f.name)}`,
        esVideo: terminaEn(f.name, EXT_VIDEO),
        esAudio: terminaEn(f.name, EXT_AUDIO),
      }));
    const torrentFile = lista.find((f) => f.name.toLowerCase().endsWith('_archive.torrent') || f.name.toLowerCase().endsWith('.torrent'));
    const subtitulos = lista
      .filter((f) => terminaEn(f.name, EXT_SUB))
      .map((f) => ({ idioma: 'sub', url: `${IA}/download/${id}/${encodeURIComponent(f.name)}` }));
    res.json({
      titulo: valor.metadata?.title ?? id,
      descripcion: Array.isArray(valor.metadata?.description) ? valor.metadata.description[0] : (valor.metadata?.description ?? ''),
      archivos,
      torrent: torrentFile ? `${IA}/download/${id}/${encodeURIComponent(torrentFile.name)}` : null,
      subtitulos,
    });
  } catch (error) {
    console.error('[ia-meta]', error.message);
    res.status(502).json({ error: 'ia', mensaje: 'No se pudo obtener el contenido de Internet Archive.' });
  }
});

export default router;
