import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
export const MAX_ACTIVOS = 3;

const EXT_REPRODUCIBLE = ['.mp4', '.mkv', '.webm', '.ogv', '.m4v', '.mov', '.mp3', '.ogg', '.flac', '.m4a', '.wav'];
const MIME = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
};

function dirDatos() {
  return process.env.DIR_TORRENTES || path.join(aqui, '..', 'cache', 'torrentes');
}
function ext(nombre) {
  return nombre.slice(nombre.lastIndexOf('.')).toLowerCase();
}

let clientePromesa = null;
const orden = []; // infohashes por orden de adicion

async function cliente() {
  if (!clientePromesa) {
    clientePromesa = import('webtorrent').then(({ default: WebTorrent }) => new WebTorrent());
  }
  return clientePromesa;
}

export async function agregar(origen) {
  const wt = await cliente();
  const existente = wt.torrents.find((t) => t.infoHash && origen.toString().toLowerCase().includes(t.infoHash));
  const torrent = existente || await new Promise((resolve, reject) => {
    const t = wt.add(origen, { path: dirDatos() }, () => resolve(t));
    t.on('error', reject);
  });
  if (!orden.includes(torrent.infoHash)) {
    orden.push(torrent.infoHash);
    while (orden.length > MAX_ACTIVOS) {
      const viejo = orden.shift();
      const t = wt.torrents.find((x) => x.infoHash === viejo);
      if (t) t.destroy({ destroyStore: true });
    }
  }
  return {
    id: torrent.infoHash,
    archivos: torrent.files.map((f, i) => ({
      indice: i,
      nombre: f.name,
      longitud: f.length,
      reproducible: EXT_REPRODUCIBLE.includes(ext(f.name)),
    })),
  };
}

export async function obtenerArchivo(id, indice) {
  const wt = await cliente();
  const torrent = wt.torrents.find((t) => t.infoHash === id);
  const archivo = torrent?.files?.[indice];
  if (!archivo) return null;
  return {
    length: archivo.length,
    tipoMime: MIME[ext(archivo.name)] || 'application/octet-stream',
    crear(rango) {
      return archivo.createReadStream(rango);
    },
  };
}

export async function cerrar(id) {
  const wt = await cliente();
  const t = wt.torrents.find((x) => x.infoHash === id);
  if (t) await new Promise((r) => t.destroy({ destroyStore: true }, r));
  const i = orden.indexOf(id);
  if (i >= 0) orden.splice(i, 1);
}

export async function _destruirCliente() {
  if (!clientePromesa) return;
  const wt = await clientePromesa;
  await new Promise((r) => wt.destroy(r));
  clientePromesa = null;
  orden.length = 0;
}
