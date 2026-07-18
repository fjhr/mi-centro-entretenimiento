import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DIR_DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-'));
const { crearApp } = await import('../index.js');
const { srtAVtt } = await import('../routes/stream.js');
const app = crearApp();

describe('srtAVtt', () => {
  it('convierte SRT a WebVTT', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nHola\n';
    const vtt = srtAVtt(srt);
    expect(vtt.startsWith('WEBVTT')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:02.500');
  });
});

describe('POST /api/stream/torrent validación', () => {
  it('rechaza un magnet pelado con 400 y motivo', async () => {
    const r = await request(app)
      .post('/api/stream/torrent')
      .send({ origen: 'magnet:?xt=urn:btih:abc&tr=udp%3A%2F%2Ftracker.publico.net%3A80' });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ error: 'origen-rechazado', motivo: 'origen-no-verificable' });
  });

  it('rechaza una URL de host no permitido', async () => {
    const r = await request(app).post('/api/stream/torrent').send({ origen: 'https://ejemplo-pirata.net/x.torrent' });
    expect(r.status).toBe(400);
    expect(r.body.motivo).toBe('host-no-permitido');
  });
});

describe('GET /api/stream/torrent/:id/:indice inexistente', () => {
  it('responde 404 si el torrent no existe', async () => {
    const r = await request(app).get('/api/stream/torrent/0000000000000000000000000000000000000000/0');
    expect(r.status).toBe(404);
  });
});
