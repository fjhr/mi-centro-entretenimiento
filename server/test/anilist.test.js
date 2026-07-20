import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'anilist-cache-'));
const { crearApp } = await import('../index.js');
const app = crearApp();

function respuestaAniList(data) {
  return { ok: true, status: 200, json: async () => ({ data }) };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('GET /api/anilist/buscar', () => {
  it('rechaza búsqueda vacía', async () => {
    const r = await request(app).get('/api/anilist/buscar');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('parametros');
  });

  it('mapea resultados al formato en español', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      Page: { media: [{
        id: 1, title: { romaji: 'Naruto', english: 'Naruto' }, startDate: { year: 2002 },
        format: 'TV', episodes: 220, genres: ['Action'],
        studios: { nodes: [{ name: 'Pierrot' }] }, coverImage: { large: 'https://x/p.jpg' },
      }] },
    })));
    const r = await request(app).get('/api/anilist/buscar?q=naruto');
    expect(r.status).toBe(200);
    expect(r.body.resultados[0]).toMatchObject({ id: 1, titulo: 'Naruto', anio: 2002, episodios: 220, estudio: 'Pierrot' });
  });

  it('responde 502 en español si AniList falla', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    const r = await request(app).get('/api/anilist/buscar?q=algo-sin-cache-previa');
    expect(r.status).toBe(502);
    expect(r.body.error).toBe('anilist');
  });
});

describe('GET /api/anilist/:id', () => {
  it('rechaza id inválido', async () => {
    const r = await request(app).get('/api/anilist/abc');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('id-invalido');
  });

  it('devuelve la ficha completa y limpia HTML de la sinopsis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      Media: {
        id: 99, title: { romaji: 'Bleach', english: 'Bleach' },
        description: '<b>Sinopsis</b> de prueba', episodes: 366, startDate: { year: 2004 },
        format: 'TV', genres: ['Action'], studios: { nodes: [{ name: 'Pierrot' }] },
        coverImage: { large: 'https://x/b.jpg' }, status: 'FINISHED',
      },
    })));
    const r = await request(app).get('/api/anilist/99');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ id: 99, titulo: 'Bleach', sinopsis: 'Sinopsis de prueba', estado: 'FINISHED' });
  });
});

describe('GET /api/anilist/calendario', () => {
  it('mapea próximos episodios con fecha ISO', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      Page: { airingSchedules: [{
        episode: 5, airingAt: 1700000000,
        media: { id: 7, title: { romaji: 'One Piece' }, coverImage: { large: 'https://x/o.jpg' } },
      }] },
    })));
    const r = await request(app).get('/api/anilist/calendario');
    expect(r.status).toBe(200);
    expect(r.body.proximos[0]).toMatchObject({ id: 7, titulo: 'One Piece', episodio: 5 });
    expect(r.body.proximos[0].fechaEmision).toBe(new Date(1700000000 * 1000).toISOString());
  });
});

describe('GET /api/anilist/tendencias', () => {
  it('devuelve temporada y siempre por separado', async () => {
    const mediaFalso = {
      id: 1, title: { romaji: 'X' }, startDate: { year: 2026 }, format: 'TV',
      episodes: 12, genres: [], studios: { nodes: [] }, coverImage: { large: null },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuestaAniList({
      temporada: { media: [mediaFalso] },
      siempre: { media: [mediaFalso] },
    })));
    const r = await request(app).get('/api/anilist/tendencias');
    expect(r.status).toBe(200);
    expect(r.body.temporada).toHaveLength(1);
    expect(r.body.siempre).toHaveLength(1);
  });
});
