import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'rutas-'));

const { crearApp } = await import('../index.js');
const app = crearApp();

describe('rutas de config y datos', () => {
  it('GET /api/config no expone las keys', async () => {
    const r = await request(app).get('/api/config');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ region: 'MX', tieneTmdb: false, tieneOmdb: false });
  });

  it('PUT /api/config guarda keys y region', async () => {
    await request(app).put('/api/config').send({ tmdbKey: 'k1', region: 'es' });
    const r = await request(app).get('/api/config');
    expect(r.body).toEqual({ region: 'ES', tieneTmdb: true, tieneOmdb: false });
  });

  it('GET/PUT /api/datos/:nombre persiste JSON arbitrario', async () => {
    const vacio = await request(app).get('/api/datos/plan-semanal');
    expect(vacio.body).toEqual({ valor: null });
    await request(app).put('/api/datos/plan-semanal').send({ dias: [1, 2] });
    const r = await request(app).get('/api/datos/plan-semanal');
    expect(r.body).toEqual({ valor: { dias: [1, 2] } });
  });

  it('rechaza nombres de datos inválidos (path traversal)', async () => {
    const r = await request(app).get('/api/datos/..%2Fconfig');
    expect(r.status).toBe(400);
  });

  it('responde 404 en español para rutas inexistentes', async () => {
    const r = await request(app).get('/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: 'no-encontrado', mensaje: 'Ruta no encontrada.' });
  });

  it('responde 400 en español ante JSON malformado', async () => {
    const r = await request(app)
      .put('/api/datos/prueba')
      .set('Content-Type', 'application/json')
      .send('{ esto no es json');
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'servidor', mensaje: 'Error interno del servidor.' });
  });
});
