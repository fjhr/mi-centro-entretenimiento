import { describe, it, expect } from 'vitest';
import { intercalarCategorias, planificarFranjas, FRANJAS_DIA } from './planificador.js';

describe('intercalarCategorias', () => {
  it('alterna categorías en vez de agruparlas', () => {
    const items = [
      { id: 1, categoria: 'video' },
      { id: 2, categoria: 'video' },
      { id: 3, categoria: 'podcast' },
      { id: 4, categoria: 'podcast' },
    ];
    const r = intercalarCategorias(items);
    expect(r.map((x) => x.categoria)).toEqual(['video', 'podcast', 'video', 'podcast']);
  });
});

describe('planificarFranjas', () => {
  const franjas = [
    { nombre: 'Mañana', proporcion: 0.5 },
    { nombre: 'Tarde', proporcion: 0.5 },
  ];

  it('nunca excede el presupuesto de cada franja', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, duracionMin: 60 }));
    const r = planificarFranjas(items, 240, franjas);
    for (const bloque of r) {
      expect(bloque.minutosUsados).toBeLessThanOrEqual(bloque.presupuesto);
    }
  });

  it('no repite ítems entre franjas', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: i, duracionMin: 60 }));
    const r = planificarFranjas(items, 240, franjas);
    const ids = r.flatMap((b) => b.items.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('usa 30 min como duración por defecto', () => {
    const r = planificarFranjas([{ id: 1 }], 60, [{ nombre: 'Única', proporcion: 1 }]);
    expect(r[0].minutosUsados).toBe(30);
  });

  it('FRANJAS_DIA suma proporciones 1.0', () => {
    const suma = FRANJAS_DIA.reduce((acc, f) => acc + f.proporcion, 0);
    expect(suma).toBeCloseTo(1.0);
  });
});
