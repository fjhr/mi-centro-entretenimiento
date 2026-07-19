import { api } from './api.js';

export const MOTIVOS = {
  'host-no-permitido': 'Ese host no está en tu lista de fuentes permitidas. Agrégalo en Ajustes si tienes derecho a usarlo.',
  'origen-no-verificable': 'No se pudo verificar el origen (un magnet necesita un webseed o tracker de una fuente permitida).',
  'formato-no-soportado': 'Formato no soportado. Usa un identificador de Internet Archive, una URL o un magnet/.torrent.',
};

export function buscarIA(q) {
  return api(`/reproductor/ia/buscar?q=${encodeURIComponent(q)}`);
}
export function abrirIA(id) {
  return api(`/reproductor/ia/${encodeURIComponent(id)}`);
}
export function abrirTorrent(origen) {
  return api('/stream/torrent', { method: 'POST', body: { origen } });
}
export function cerrarTorrent(id) {
  return api(`/stream/torrent/${id}`, { method: 'DELETE' }).catch(() => {});
}
export function urlStream(id, indice) {
  return `/api/stream/torrent/${id}/${indice}`;
}
export function urlSubtitulo(url) {
  return `/api/stream/subtitulo?url=${encodeURIComponent(url)}`;
}

const RE_ID_IA = /^[A-Za-z0-9._-]+$/;

export function pareceIdentificadorIA(origen) {
  return RE_ID_IA.test(origen);
}

function errorSinReproducibles() {
  return Object.assign(new Error('Sin archivos reproducibles'), { motivo: 'sin-reproducibles' });
}

export async function resolverIA(identificador) {
  const meta = await abrirIA(identificador);
  const video = meta.archivos.find((a) => a.esVideo) || meta.archivos.find((a) => a.esAudio);
  if (video) {
    return { tipo: 'directo', url: video.url, subtitulos: meta.subtitulos, metaTitulo: meta.titulo };
  }
  if (meta.torrent) {
    const { id, archivos } = await abrirTorrent(meta.torrent);
    if (!archivos.some((a) => a.reproducible)) {
      await cerrarTorrent(id);
      throw errorSinReproducibles();
    }
    return { tipo: 'torrent', id, archivos, subtitulos: meta.subtitulos, metaTitulo: meta.titulo };
  }
  throw errorSinReproducibles();
}

export async function resolverTorrentOrigen(origen) {
  const { id, archivos } = await abrirTorrent(origen);
  if (!archivos.some((a) => a.reproducible)) {
    await cerrarTorrent(id);
    throw errorSinReproducibles();
  }
  return { tipo: 'torrent', id, archivos };
}
