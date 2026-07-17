import express from 'express';
import configRouter from './routes/config.js';
import datosRouter from './routes/datos.js';

export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/config', configRouter);
  app.use('/api/datos', datosRouter);
  return app;
}

const PUERTO = process.env.PUERTO || 3001;
if (process.env.NODE_ENV !== 'test') {
  crearApp().listen(PUERTO, () => {
    console.log(`Servidor de Mi Centro de Entretenimiento en http://localhost:${PUERTO}`);
  });
}
