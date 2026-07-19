import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api.js', () => ({ api: vi.fn() }));
const { api } = await import('./api.js');
const {
  obtenerBiblioteca, guardarProgreso, alternarGuardado, alternarVisto, limpiarHistorial,
} = await import('./biblioteca.js');

beforeEach(() => { api.mockReset(); api.mockResolvedValue({ ok: true }); });

describe('helpers de biblioteca', () => {
  it('obtenerBiblioteca hace GET a /biblioteca', async () => {
    await obtenerBiblioteca();
    expect(api).toHaveBeenCalledWith('/biblioteca');
  });

  it('guardarProgreso hace PUT con el body exacto', async () => {
    await guardarProgreso({ origen: 'x', indice: 1, posicionSeg: 10, duracionSeg: 100, titulo: 'T', poster: 'p.jpg' });
    expect(api).toHaveBeenCalledWith('/biblioteca/progreso', {
      method: 'PUT',
      body: { origen: 'x', indice: 1, posicionSeg: 10, duracionSeg: 100, titulo: 'T', poster: 'p.jpg' },
    });
  });

  it('alternarGuardado hace PUT incluyendo meta opcional', async () => {
    await alternarGuardado('x', true, { titulo: 'T', poster: null });
    expect(api).toHaveBeenCalledWith('/biblioteca/guardado', {
      method: 'PUT',
      body: { origen: 'x', guardado: true, titulo: 'T', poster: null },
    });
  });

  it('alternarVisto hace PUT con origen/indice/visto', async () => {
    await alternarVisto('x', 2, false);
    expect(api).toHaveBeenCalledWith('/biblioteca/visto', { method: 'PUT', body: { origen: 'x', indice: 2, visto: false } });
  });

  it('limpiarHistorial hace DELETE', async () => {
    await limpiarHistorial();
    expect(api).toHaveBeenCalledWith('/biblioteca/historial', { method: 'DELETE' });
  });
});
