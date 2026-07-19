import { describe, it, expect } from 'vitest';
import {
  actualizarProgreso, alternarGuardado, alternarVisto, limpiarHistorial,
  continuarViendo, guardados, historial,
} from '../lib/biblioteca.js';

describe('actualizarProgreso', () => {
  it('crea una entrada nueva con el archivo indicado', () => {
    const { datos, visto } = actualizarProgreso({}, { origen: 'peli1', indice: 0, posicionSeg: 30, duracionSeg: 600, titulo: 'Peli', poster: 'p.jpg' });
    expect(datos.peli1.titulo).toBe('Peli');
    expect(datos.peli1.poster).toBe('p.jpg');
    expect(datos.peli1.guardado).toBe(false);
    expect(datos.peli1.archivos[0]).toMatchObject({ posicionSeg: 30, duracionSeg: 600, visto: false });
    expect(visto).toBe(false);
  });

  it('marca visto automáticamente al cruzar el 90% y lo informa', () => {
    let r = actualizarProgreso({}, { origen: 'p', indice: 0, posicionSeg: 100, duracionSeg: 600 });
    expect(r.visto).toBe(false);
    r = actualizarProgreso(r.datos, { origen: 'p', indice: 0, posicionSeg: 550, duracionSeg: 600 });
    expect(r.datos.p.archivos[0].visto).toBe(true);
    expect(r.visto).toBe(true);
  });

  it('no vuelve a informar visto:true si ya estaba visto', () => {
    let r = actualizarProgreso({}, { origen: 'p', indice: 0, posicionSeg: 590, duracionSeg: 600 });
    expect(r.visto).toBe(true);
    r = actualizarProgreso(r.datos, { origen: 'p', indice: 0, posicionSeg: 595, duracionSeg: 600 });
    expect(r.visto).toBe(false);
    expect(r.datos.p.archivos[0].visto).toBe(true);
  });

  it('actualizar un archivo no pisa el progreso de otros archivos del mismo origen', () => {
    let r = actualizarProgreso({}, { origen: 's', indice: 0, posicionSeg: 100, duracionSeg: 600 });
    r = actualizarProgreso(r.datos, { origen: 's', indice: 1, posicionSeg: 50, duracionSeg: 500 });
    expect(r.datos.s.archivos[0].posicionSeg).toBe(100);
    expect(r.datos.s.archivos[1].posicionSeg).toBe(50);
  });

  it('no pisa guardado ni titulo/poster existentes si no se pasan de nuevo', () => {
    let r = actualizarProgreso({}, { origen: 'g', indice: 0, posicionSeg: 10, duracionSeg: 600, titulo: 'T', poster: 'x.jpg' });
    r = { ...r, datos: alternarGuardado(r.datos, 'g', true) };
    r = actualizarProgreso(r.datos, { origen: 'g', indice: 0, posicionSeg: 20, duracionSeg: 600 });
    expect(r.datos.g.guardado).toBe(true);
    expect(r.datos.g.titulo).toBe('T');
    expect(r.datos.g.poster).toBe('x.jpg');
  });
});

describe('alternarGuardado', () => {
  it('crea la entrada si no existe', () => {
    const datos = alternarGuardado({}, 'nuevo', true, { titulo: 'N', poster: null });
    expect(datos.nuevo).toMatchObject({ guardado: true, titulo: 'N', archivos: {} });
  });

  it('alterna guardado sin tocar el progreso existente', () => {
    let r = actualizarProgreso({}, { origen: 'x', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    const datos = alternarGuardado(r.datos, 'x', true);
    expect(datos.x.guardado).toBe(true);
    expect(datos.x.archivos[0].posicionSeg).toBe(5);
  });
});

describe('alternarVisto', () => {
  it('no hace nada si el origen nunca tuvo progreso', () => {
    const datos = alternarVisto({}, 'fantasma', 0, true);
    expect(datos).toEqual({});
  });

  it('marca visto manualmente y no se revierte con progreso posterior bajo el umbral', () => {
    let r = actualizarProgreso({}, { origen: 'm', indice: 0, posicionSeg: 10, duracionSeg: 600 });
    let datos = alternarVisto(r.datos, 'm', 0, true);
    expect(datos.m.archivos[0].visto).toBe(true);
    const r2 = actualizarProgreso(datos, { origen: 'm', indice: 0, posicionSeg: 20, duracionSeg: 600 });
    expect(r2.datos.m.archivos[0].visto).toBe(true);
  });
});

describe('limpiarHistorial', () => {
  it('elimina por completo los orígenes no guardados y conserva los guardados', () => {
    let r = actualizarProgreso({}, { origen: 'a', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    r = actualizarProgreso(r.datos, { origen: 'b', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    let datos = alternarGuardado(r.datos, 'b', true);
    datos = limpiarHistorial(datos);
    expect(datos.a).toBeUndefined();
    expect(datos.b).toBeDefined();
    expect(datos.b.archivos[0].posicionSeg).toBe(5);
  });
});

describe('selectores', () => {
  function construir() {
    let datos = {};
    ({ datos } = actualizarProgreso(datos, { origen: 'medio', indice: 0, posicionSeg: 100, duracionSeg: 600, titulo: 'Medio' }));
    ({ datos } = actualizarProgreso(datos, { origen: 'terminado', indice: 0, posicionSeg: 590, duracionSeg: 600, titulo: 'Terminado' }));
    datos = alternarGuardado(datos, 'guardado-sin-ver', true, { titulo: 'Guardado' });
    return datos;
  }

  it('continuarViendo excluye lo terminado y lo nunca empezado', () => {
    const r = continuarViendo(construir());
    expect(r.map((x) => x.origen)).toEqual(['medio']);
  });

  it('guardados solo incluye guardado:true', () => {
    const r = guardados(construir());
    expect(r.map((x) => x.origen)).toEqual(['guardado-sin-ver']);
  });

  it('historial incluye cualquier progreso, incluido lo terminado', () => {
    const r = historial(construir());
    expect(r.map((x) => x.origen).sort()).toEqual(['medio', 'terminado']);
  });

  it('ordena por ultimaVez descendente', () => {
    let datos = {};
    ({ datos } = actualizarProgreso(datos, { origen: 'viejo', indice: 0, posicionSeg: 5, duracionSeg: 100 }));
    datos.viejo.ultimaVez = '2020-01-01T00:00:00.000Z';
    ({ datos } = actualizarProgreso(datos, { origen: 'nuevo', indice: 0, posicionSeg: 5, duracionSeg: 100 }));
    datos.nuevo.ultimaVez = '2026-01-01T00:00:00.000Z';
    expect(historial(datos).map((x) => x.origen)).toEqual(['nuevo', 'viejo']);
  });
});
