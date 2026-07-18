import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'proxys-'));
process.env.DIR_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'proxys-cache-'));

const { crearApp } = await import('../index.js');
const app = crearApp();

describe('proxys sin API keys', () => {
  it('TMDB responde 503 falta-key en español', async () => {
    const r = await request(app).get('/api/tmdb/discover/movie');
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('falta-key');
    expect(r.body.mensaje).toContain('Ajustes');
  });

  it('OMDb responde 503 falta-key en español', async () => {
    const r = await request(app).get('/api/omdb?t=Matrix');
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('falta-key');
  });

  it('TMDB rechaza rutas con caracteres inválidos', async () => {
    const r = await request(app).get('/api/tmdb/..%2Fetc');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('ruta-invalida');
  });
});
