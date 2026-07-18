import { describe, it, expect, vi } from 'vitest';

vi.mock('./api.js', () => ({
  tmdb: vi.fn(),
  omdb: vi.fn(),
}));

const { tmdb, omdb } = await import('./api.js');
const { ratingsDe, dondeVer, porQueTeGustara } = await import('./peliculas.js');

describe('ratingsDe', () => {
  it('devuelve la respuesta de omdb() cuando se resuelve', async () => {
    const payload = { Title: 'The Matrix', imdbRating: '8.7' };
    omdb.mockResolvedValueOnce(payload);
    const resultado = await ratingsDe('The Matrix', 1999);
    expect(resultado).toEqual(payload);
  });

  it('devuelve null cuando omdb() rechaza, sin lanzar', async () => {
    omdb.mockRejectedValueOnce(new Error('falla de red'));
    await expect(ratingsDe('Título inexistente', 2020)).resolves.toBeNull();
  });
});

describe('dondeVer', () => {
  it('devuelve valores vacíos cuando tmdb() rechaza, sin lanzar', async () => {
    tmdb.mockRejectedValueOnce(new Error('falla de red'));
    await expect(dondeVer(1, 'MX')).resolves.toEqual({ gratis: [], suscripcion: [], enlace: null });
  });
});

describe('porQueTeGustara', () => {
  it('devuelve una cadena en español no vacía que menciona el mood', () => {
    const item = { generos: [35], rating: 7.8, anio: 1999 };
    const resultado = porQueTeGustara(item, 'risa');
    expect(typeof resultado).toBe('string');
    expect(resultado.length).toBeGreaterThan(0);
    expect(resultado.toLowerCase()).toContain('risa');
  });
});
