import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import createTorrent from 'create-torrent';
import WebTorrent from 'webtorrent';

process.env.DIR_TORRENTES = fs.mkdtempSync(path.join(os.tmpdir(), 'tor-'));
const { agregar, obtenerArchivo, cerrar, _destruirCliente } = await import('../lib/torrentes.js');

// Prepara un archivo y su .torrent con webseed apuntando a un sembrador local.
const dirFuente = fs.mkdtempSync(path.join(os.tmpdir(), 'src-'));
const archivo = path.join(dirFuente, 'saludo.txt');
fs.writeFileSync(archivo, 'hola mundo '.repeat(1000));

function crearTorrentBuffer() {
  return new Promise((resolve, reject) => {
    createTorrent(archivo, (err, torrent) => (err ? reject(err) : resolve(torrent)));
  });
}

const sembrador = new WebTorrent();

afterAll(async () => {
  await new Promise((r) => sembrador.destroy(r));
  await _destruirCliente();
});

describe('torrentes', () => {
  it('agrega un torrent y lista sus archivos', async () => {
    const buffer = await crearTorrentBuffer();
    await new Promise((resolve) => sembrador.seed(archivo, resolve));
    const { id, archivos } = await agregar(buffer);
    expect(id).toMatch(/^[a-f0-9]{40}$/i);
    expect(archivos[0].nombre).toBe('saludo.txt');
    expect(archivos[0].reproducible).toBe(false);
    const handle = await obtenerArchivo(id, 0);
    expect(handle.length).toBeGreaterThan(0);
    await cerrar(id);
  }, 30000);

  it('evict el torrent mas antiguo al superar MAX_ACTIVOS y reutiliza uno activo sin descargas', async () => {
    // Torrents creados a partir de .torrent buffers ya tienen metadata completa:
    // agregar() resuelve al leer el buffer, sin necesidad de peers ni descargas.
    const dirFuente2 = fs.mkdtempSync(path.join(os.tmpdir(), 'src2-'));
    const rutas = [0, 1, 2, 3].map((i) => {
      const p = path.join(dirFuente2, `archivo-${i}.txt`);
      fs.writeFileSync(p, `contenido distinto numero ${i} `.repeat(500));
      return p;
    });
    const buffers = await Promise.all(
      rutas.map((p) => new Promise((resolve, reject) => {
        createTorrent(p, (err, torrent) => (err ? reject(err) : resolve(torrent)));
      }))
    );

    const resultados = [];
    for (const buf of buffers) {
      resultados.push(await agregar(buf));
    }

    // El primero (mas antiguo) debe haber sido evictado al agregar el cuarto (MAX_ACTIVOS = 3).
    expect(await obtenerArchivo(resultados[0].id, 0)).toBeNull();
    expect(await obtenerArchivo(resultados[3].id, 0)).not.toBeNull();
    expect(await obtenerArchivo(resultados[1].id, 0)).not.toBeNull();
    expect(await obtenerArchivo(resultados[2].id, 0)).not.toBeNull();

    // Reutilizacion: volver a agregar un buffer aun activo devuelve el mismo id, sin evictar mas.
    const reutilizado = await agregar(buffers[1]);
    expect(reutilizado.id).toBe(resultados[1].id);
    expect(await obtenerArchivo(resultados[2].id, 0)).not.toBeNull();
    expect(await obtenerArchivo(resultados[3].id, 0)).not.toBeNull();

    await cerrar(resultados[1].id);
    await cerrar(resultados[2].id);
    await cerrar(resultados[3].id);
  }, 30000);
});
