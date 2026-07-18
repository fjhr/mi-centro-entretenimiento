import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

function rutaDe(clave) {
  const dir = process.env.DIR_CACHE || path.join(aqui, '..', 'cache');
  const hash = crypto.createHash('md5').update(clave).digest('hex');
  return { dir, ruta: path.join(dir, `${hash}.json`) };
}

function leerEntrada(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return null;
  }
}

export async function conCache(clave, ttlMs, obtener) {
  const { dir, ruta } = rutaDe(clave);
  const entrada = leerEntrada(ruta);
  if (entrada && Date.now() < entrada.exp) {
    return { valor: entrada.valor, deCache: true, fecha: entrada.fecha };
  }
  try {
    const valor = await obtener();
    const fecha = new Date().toISOString();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify({ exp: Date.now() + ttlMs, fecha, valor }));
    return { valor, deCache: false, fecha };
  } catch (error) {
    if (entrada) return { valor: entrada.valor, deCache: true, fecha: entrada.fecha };
    throw error;
  }
}
