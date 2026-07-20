import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api.js', () => ({ api: vi.fn() }));
const { api } = await import('./api.js');
const { buscarAnime, obtenerAnime, obtenerCalendario, obtenerTendencias, fuentesLegalesDe } = await import('./anilist.js');

beforeEach(() => { api.mockReset(); api.mockResolvedValue({}); });

describe('helpers HTTP de anilist', () => {
  it('buscarAnime codifica el query', async () => {
    await buscarAnime('one piece');
    expect(api).toHaveBeenCalledWith('/anilist/buscar?q=one%20piece');
  });

  it('obtenerAnime usa el id en la ruta', async () => {
    await obtenerAnime(42);
    expect(api).toHaveBeenCalledWith('/anilist/42');
  });

  it('obtenerCalendario y obtenerTendencias llaman a sus rutas', async () => {
    await obtenerCalendario();
    await obtenerTendencias();
    expect(api).toHaveBeenNthCalledWith(1, '/anilist/calendario');
    expect(api).toHaveBeenNthCalledWith(2, '/anilist/tendencias');
  });
});

describe('fuentesLegalesDe', () => {
  it('incluye plataformas globales y genera un enlace de búsqueda', () => {
    const r = fuentesLegalesDe('Naruto', 'MX');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.url.startsWith('https://www.google.com/search?q='))).toBe(true);
    expect(r.some((x) => x.nombre === 'RetroCrush')).toBe(true);
  });

  it('respeta restricción regional (Tivify solo en España)', () => {
    expect(fuentesLegalesDe('Naruto', 'ES').some((x) => x.nombre === 'Tivify')).toBe(true);
    expect(fuentesLegalesDe('Naruto', 'MX').some((x) => x.nombre === 'Tivify')).toBe(false);
  });
});
