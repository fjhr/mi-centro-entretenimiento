import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const dirTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'almacen-'));
process.env.DIR_DATOS = dirTemp;

const { leerJson, guardarJson, obtenerConfig } = await import('../lib/almacen.js');

describe('almacen', () => {
  beforeEach(() => {
    for (const f of fs.readdirSync(dirTemp)) fs.rmSync(path.join(dirTemp, f));
  });

  it('devuelve el valor por defecto si el archivo no existe', () => {
    expect(leerJson('no-existe', { a: 1 })).toEqual({ a: 1 });
  });

  it('guarda y lee un JSON', () => {
    guardarJson('prueba', { hola: 'mundo' });
    expect(leerJson('prueba', null)).toEqual({ hola: 'mundo' });
  });

  it('obtenerConfig aplica valores por defecto', () => {
    expect(obtenerConfig()).toEqual({ tmdbKey: '', omdbKey: '', region: 'MX' });
    guardarJson('config', { tmdbKey: 'abc', region: 'ES' });
    expect(obtenerConfig()).toEqual({ tmdbKey: 'abc', omdbKey: '', region: 'ES' });
  });
});
