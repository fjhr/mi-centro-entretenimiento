import express from 'express';
import configRouter from './routes/config.js';
import datosRouter from './routes/datos.js';

export function crearApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/config', configRouter);
  app.use('/api/datos', datosRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'no-encontrado', mensaje: 'Ruta no encontrada.' });
  });
  app.use((error, req, res, next) => {
    const status = error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: 'servidor', mensaje: 'Error interno del servidor.' });
  });

  return app;
}

const PUERTO = process.env.PUERTO || 3001;
if (process.env.NODE_ENV !== 'test') {
  crearApp().listen(PUERTO, () => {
    console.log(`Servidor de Mi Centro de Entretenimiento en http://localhost:${PUERTO}`);
  });
}
