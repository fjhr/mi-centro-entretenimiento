import { Router } from 'express';
import { leerJson, guardarJson } from '../lib/almacen.js';

const router = Router();
const NOMBRE_VALIDO = /^[a-z0-9-]+$/;

router.get('/:nombre', (req, res) => {
  if (!NOMBRE_VALIDO.test(req.params.nombre)) return res.status(400).json({ error: 'nombre-invalido' });
  res.json({ valor: leerJson(`datos-${req.params.nombre}`, null) });
});

router.put('/:nombre', (req, res) => {
  if (!NOMBRE_VALIDO.test(req.params.nombre)) return res.status(400).json({ error: 'nombre-invalido' });
  guardarJson(`datos-${req.params.nombre}`, req.body);
  res.json({ ok: true });
});

export default router;
