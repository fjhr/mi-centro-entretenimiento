import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'biblioteca-'));
const { crearApp } = await import('../index.js');
const app = crearApp();

describe('GET /api/biblioteca', () => {
  it('devuelve las tres listas vacías y entradas vacío cuando no hay nada', async () => {
    const r = await request(app).get('/api/biblioteca');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ continuarViendo: [], guardados: [], historial: [], entradas: {} });
  });
});

describe('PUT /api/biblioteca/progreso', () => {
  it('guarda progreso y aparece en GET', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({
      origen: 'peli1', indice: 0, posicionSeg: 30, duracionSeg: 600, titulo: 'Peli', poster: 'p.jpg',
    });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, visto: false });
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.entradas.peli1.archivos['0']).toMatchObject({ posicionSeg: 30, duracionSeg: 600 });
    expect(g.body.continuarViendo.map((x) => x.origen)).toEqual(['peli1']);
  });

  it('informa visto:true al cruzar el 90%', async () => {
    await request(app).put('/api/biblioteca/progreso').send({ origen: 'p2', indice: 0, posicionSeg: 10, duracionSeg: 100 });
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: 'p2', indice: 0, posicionSeg: 95, duracionSeg: 100 });
    expect(r.body.visto).toBe(true);
  });

  it('rechaza origen vacío', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: '', indice: 0, posicionSeg: 1, duracionSeg: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('origen-invalido');
  });

  it('rechaza indice no entero', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: 'x', indice: 'a', posicionSeg: 1, duracionSeg: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('indice-invalido');
  });

  it('rechaza posicionSeg negativa', async () => {
    const r = await request(app).put('/api/biblioteca/progreso').send({ origen: 'x', indice: 0, posicionSeg: -1, duracionSeg: 10 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('posicion-invalida');
  });
});

describe('PUT /api/biblioteca/guardado', () => {
  it('guarda y aparece en guardados', async () => {
    const r = await request(app).put('/api/biblioteca/guardado').send({ origen: 'g1', guardado: true, titulo: 'G1' });
    expect(r.status).toBe(200);
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.guardados.map((x) => x.origen)).toContain('g1');
  });

  it('rechaza guardado no booleano', async () => {
    const r = await request(app).put('/api/biblioteca/guardado').send({ origen: 'g2', guardado: 'si' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('guardado-invalido');
  });
});

describe('PUT /api/biblioteca/visto', () => {
  it('rechaza visto no booleano', async () => {
    const r = await request(app).put('/api/biblioteca/visto').send({ origen: 'x', indice: 0, visto: 'si' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('visto-invalido');
  });

  it('marca visto sobre un origen existente', async () => {
    await request(app).put('/api/biblioteca/progreso').send({ origen: 'v1', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    const r = await request(app).put('/api/biblioteca/visto').send({ origen: 'v1', indice: 0, visto: true });
    expect(r.status).toBe(200);
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.entradas.v1.archivos['0'].visto).toBe(true);
  });
});

describe('DELETE /api/biblioteca/historial', () => {
  it('limpia lo no guardado y conserva lo guardado', async () => {
    await request(app).put('/api/biblioteca/progreso').send({ origen: 'temp', indice: 0, posicionSeg: 5, duracionSeg: 100 });
    await request(app).put('/api/biblioteca/guardado').send({ origen: 'perm', guardado: true });
    const r = await request(app).delete('/api/biblioteca/historial');
    expect(r.status).toBe(200);
    const g = await request(app).get('/api/biblioteca');
    expect(g.body.entradas.temp).toBeUndefined();
    expect(g.body.entradas.perm).toBeDefined();
  });
});
