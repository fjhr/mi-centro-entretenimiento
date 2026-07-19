import { Router } from 'express';
import { leerJson, guardarJson } from '../lib/almacen.js';
import {
  actualizarProgreso, alternarGuardado, alternarVisto, limpiarHistorial,
  continuarViendo, guardados, historial,
} from '../lib/biblioteca.js';

const router = Router();

function obtenerDatos() {
  return leerJson('biblioteca', {});
}

router.get('/', (req, res) => {
  const datos = obtenerDatos();
  res.json({
    continuarViendo: continuarViendo(datos),
    guardados: guardados(datos),
    historial: historial(datos),
    entradas: datos,
  });
});

router.put('/progreso', (req, res) => {
  const { origen, indice, posicionSeg, duracionSeg, titulo, poster } = req.body ?? {};
  if (typeof origen !== 'string' || !origen.trim()) {
    return res.status(400).json({ error: 'origen-invalido', mensaje: 'Falta el origen.' });
  }
  if (!Number.isInteger(indice) || indice < 0) {
    return res.status(400).json({ error: 'indice-invalido', mensaje: 'Índice de archivo inválido.' });
  }
  if (typeof posicionSeg !== 'number' || posicionSeg < 0 || typeof duracionSeg !== 'number' || duracionSeg < 0) {
    return res.status(400).json({ error: 'posicion-invalida', mensaje: 'Posición o duración inválida.' });
  }
  const { datos, visto } = actualizarProgreso(obtenerDatos(), { origen: origen.trim(), indice, posicionSeg, duracionSeg, titulo, poster });
  guardarJson('biblioteca', datos);
  res.json({ ok: true, visto });
});

router.put('/guardado', (req, res) => {
  const { origen, guardado, titulo, poster } = req.body ?? {};
  if (typeof origen !== 'string' || !origen.trim()) {
    return res.status(400).json({ error: 'origen-invalido', mensaje: 'Falta el origen.' });
  }
  if (typeof guardado !== 'boolean') {
    return res.status(400).json({ error: 'guardado-invalido', mensaje: 'Falta indicar si se guarda o quita.' });
  }
  const datos = alternarGuardado(obtenerDatos(), origen.trim(), guardado, { titulo, poster });
  guardarJson('biblioteca', datos);
  res.json({ ok: true });
});

router.put('/visto', (req, res) => {
  const { origen, indice, visto } = req.body ?? {};
  if (typeof origen !== 'string' || !origen.trim()) {
    return res.status(400).json({ error: 'origen-invalido', mensaje: 'Falta el origen.' });
  }
  if (!Number.isInteger(indice) || indice < 0) {
    return res.status(400).json({ error: 'indice-invalido', mensaje: 'Índice de archivo inválido.' });
  }
  if (typeof visto !== 'boolean') {
    return res.status(400).json({ error: 'visto-invalido', mensaje: 'Falta indicar el estado de visto.' });
  }
  const datos = alternarVisto(obtenerDatos(), origen.trim(), indice, visto);
  guardarJson('biblioteca', datos);
  res.json({ ok: true });
});

router.delete('/historial', (req, res) => {
  guardarJson('biblioteca', limpiarHistorial(obtenerDatos()));
  res.json({ ok: true });
});

export default router;
