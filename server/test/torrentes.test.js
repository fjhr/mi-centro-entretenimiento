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
});
