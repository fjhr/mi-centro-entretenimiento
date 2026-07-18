import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import configRouter from './routes/config.js';
import datosRouter from './routes/datos.js';
import tmdbRouter from './routes/tmdb.js';
import omdbRouter from './routes/omdb.js';
import reproductorRouter from './routes/reproductor.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirDist = path.join(aqui, '..', 'client', 'dist');

export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/config', configRouter);
  app.use('/api/datos', datosRouter);
  app.use('/api/tmdb', tmdbRouter);
  app.use('/api/omdb', omdbRouter);
  app.use('/api/reproductor', reproductorRouter);

  if (fs.existsSync(dirDist)) {
    app.use(express.static(dirDist));
    app.get('/', (req, res) => res.sendFile(path.join(dirDist, 'index.html')));
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'no-encontrado', mensaje: 'Ruta no encontrada.' });
  });
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'json-invalido', mensaje: 'Cuerpo JSON inválido.' });
      return;
    }
    res.status(500).json({ error: 'servidor', mensaje: 'Error interno del servidor.' });
  });

  return app;
}

const PUERTO = process.env.PUERTO || 3001;
if (process.env.NODE_ENV !== 'test') {
  crearApp().listen(PUERTO, () => {
    console.log(`Servidor de Mi Centro de Entretenimiento en http://localhost:${PUERTO}`);
  });
}
