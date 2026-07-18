import { describe, it, expect } from 'vitest';
import { puntuar, recomendar } from './recomendar.js';

const comedia = { id: 'a', titulo: 'Comedia', generos: [35], rating: 7.5 };
const drama = { id: 'b', titulo: 'Drama', generos: [18], rating: 7.5 };

describe('puntuar', () => {
  it('da más puntos cuando los géneros coinciden con el mood', () => {
    expect(puntuar(comedia, { mood: 'risa' })).toBeGreaterThan(puntuar(drama, { mood: 'risa' }));
  });

  it('penaliza fuerte los ítems ya vistos', () => {
    expect(puntuar(comedia, { mood: 'risa', vistos: ['a'] })).toBeLessThan(puntuar(drama, { mood: 'risa' }));
  });

  it('penaliza ítems que no caben en el tiempo disponible', () => {
    const corto = { id: 'c', titulo: 'Corto', duracionMin: 30 };
    const largo = { id: 'd', titulo: 'Largo', duracionMin: 180 };
    expect(puntuar(corto, { tiempoMin: 60 })).toBeGreaterThan(puntuar(largo, { tiempoMin: 60 }));
  });

  it('premia coincidencia de intereses con etiquetas', () => {
    const conIa = { id: 'e', titulo: 'IA', etiquetas: ['ia'] };
    const sinIa = { id: 'f', titulo: 'Otro', etiquetas: ['cultura'] };
    expect(puntuar(conIa, { intereses: ['ia'] })).toBeGreaterThan(puntuar(sinIa, { intereses: ['ia'] }));
  });

  it('premia coincidencia de energía y compañía', () => {
    const grupal = { id: 'g', titulo: 'Grupal', energia: 'alta', compania: ['amigos'] };
    const solitario = { id: 'h', titulo: 'Solo', energia: 'baja', compania: ['solo'] };
    const criterios = { energia: 'alta', compania: 'amigos' };
    expect(puntuar(grupal, criterios)).toBeGreaterThan(puntuar(solitario, criterios));
  });

  it('premia películas antiguas cuando el mood es nostalgia', () => {
    const vieja = { id: 'i', titulo: 'Vieja', generos: [10751], anio: 1995 };
    const nueva = { id: 'j', titulo: 'Nueva', generos: [10751], anio: 2023 };
    expect(puntuar(vieja, { mood: 'nostalgia' })).toBeGreaterThan(puntuar(nueva, { mood: 'nostalgia' }));
  });
});

describe('recomendar', () => {
  it('ordena por puntaje descendente y respeta el límite', () => {
    const items = [drama, comedia, { id: 'x', titulo: 'Nada', generos: [] }];
    const r = recomendar(items, { mood: 'risa' }, 2);
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe('a');
    expect(r[0].puntaje).toBeGreaterThanOrEqual(r[1].puntaje);
  });

  it('no muta la lista original', () => {
    const items = [drama, comedia];
    recomendar(items, { mood: 'risa' });
    expect(items[0].id).toBe('b');
  });
});
