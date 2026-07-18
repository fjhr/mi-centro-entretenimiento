import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DIR_CACHE = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-'));

const { conCache } = await import('../lib/cache.js');

describe('conCache', () => {
  it('llama a obtener la primera vez y usa caché la segunda', async () => {
    let llamadas = 0;
    const obtener = async () => { llamadas++; return { n: llamadas }; };
    const a = await conCache('clave-a', 60_000, obtener);
    const b = await conCache('clave-a', 60_000, obtener);
    expect(a).toMatchObject({ valor: { n: 1 }, deCache: false });
    expect(b).toMatchObject({ valor: { n: 1 }, deCache: true });
    expect(llamadas).toBe(1);
  });

  it('con TTL vencido vuelve a llamar a obtener', async () => {
    let llamadas = 0;
    const obtener = async () => { llamadas++; return llamadas; };
    await conCache('clave-b', -1, obtener);
    await conCache('clave-b', -1, obtener);
    expect(llamadas).toBe(2);
  });

  it('si obtener falla, devuelve la caché vencida como respaldo', async () => {
    await conCache('clave-c', -1, async () => 'viejo');
    const r = await conCache('clave-c', -1, async () => { throw new Error('sin internet'); });
    expect(r).toMatchObject({ valor: 'viejo', deCache: true });
  });

  it('si obtener falla y no hay caché, propaga el error', async () => {
    await expect(conCache('clave-d', 60_000, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
