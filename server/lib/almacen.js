import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

function dirDatos() {
  return process.env.DIR_DATOS || path.join(aqui, '..', 'data');
}

export function leerJson(nombre, porDefecto) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dirDatos(), `${nombre}.json`), 'utf8'));
  } catch {
    return porDefecto;
  }
}

export function guardarJson(nombre, valor) {
  fs.mkdirSync(dirDatos(), { recursive: true });
  fs.writeFileSync(path.join(dirDatos(), `${nombre}.json`), JSON.stringify(valor, null, 2));
}

const CONFIG_POR_DEFECTO = { tmdbKey: '', omdbKey: '', region: 'MX', allowlist: [] };

export function obtenerConfig() {
  return { ...CONFIG_POR_DEFECTO, ...leerJson('config', {}) };
}
