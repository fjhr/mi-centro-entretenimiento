import { describe, it, expect, beforeEach, vi } from 'vitest';
import { urlStream, urlSubtitulo, MOTIVOS, pareceIdentificadorIA, resolverIA, resolverTorrentOrigen } from './reproductor.js';

vi.mock('./api.js', () => ({ api: vi.fn() }));
const { api } = await import('./api.js');

beforeEach(() => { api.mockReset(); });

describe('helpers de reproductor', () => {
  it('construye la URL de streaming', () => {
    expect(urlStream('abc', 2)).toBe('/api/stream/torrent/abc/2');
  });
  it('codifica la URL del subtítulo', () => {
    expect(urlSubtitulo('https://x/y z.srt')).toBe('/api/stream/subtitulo?url=https%3A%2F%2Fx%2Fy%20z.srt');
  });
  it('traduce los motivos de rechazo al español', () => {
    expect(MOTIVOS['origen-no-verificable']).toMatch(/verific/i);
    expect(MOTIVOS['host-no-permitido']).toMatch(/permit/i);
  });
});

describe('pareceIdentificadorIA', () => {
  it('reconoce un identificador simple de Internet Archive', () => {
    expect(pareceIdentificadorIA('night_of_the_living_dead')).toBe(true);
  });
  it('rechaza magnets y URLs', () => {
    expect(pareceIdentificadorIA('magnet:?xt=urn:btih:abc')).toBe(false);
    expect(pareceIdentificadorIA('https://archive.org/details/x')).toBe(false);
  });
});

describe('resolverIA', () => {
  it('devuelve tipo directo cuando hay un archivo de video', async () => {
    api.mockResolvedValueOnce({ titulo: 'Peli', archivos: [{ esVideo: true, esAudio: false, url: 'https://a/x.mp4' }], torrent: null, subtitulos: [] });
    const r = await resolverIA('id1');
    expect(r).toMatchObject({ tipo: 'directo', url: 'https://a/x.mp4', metaTitulo: 'Peli' });
  });

  it('lanza error con motivo sin-reproducibles si no hay video/audio ni torrent', async () => {
    api.mockResolvedValueOnce({ titulo: 'Vacío', archivos: [], torrent: null, subtitulos: [] });
    await expect(resolverIA('id2')).rejects.toMatchObject({ motivo: 'sin-reproducibles' });
  });
});

describe('resolverTorrentOrigen', () => {
  it('devuelve tipo torrent cuando hay al menos un archivo reproducible', async () => {
    api.mockResolvedValueOnce({ id: 'abc', archivos: [{ indice: 0, reproducible: true, nombre: 'x.mp4' }] });
    const r = await resolverTorrentOrigen('magnet:?xt=urn:btih:abc&ws=https://x/y.mp4');
    expect(r).toMatchObject({ tipo: 'torrent', id: 'abc' });
  });

  it('cierra el torrent y lanza sin-reproducibles si ningún archivo es reproducible', async () => {
    api.mockResolvedValueOnce({ id: 'abc', archivos: [{ indice: 0, reproducible: false, nombre: 'x.txt' }] });
    api.mockResolvedValueOnce({ ok: true });
    await expect(resolverTorrentOrigen('magnet:?xt=urn:btih:abc&ws=https://x/y')).rejects.toMatchObject({ motivo: 'sin-reproducibles' });
    expect(api).toHaveBeenCalledWith('/stream/torrent/abc', { method: 'DELETE' });
  });
});
