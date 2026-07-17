import { useState } from 'react';
import { useConfig } from './context/ConfigContext.jsx';
import Ajustes from './modules/ajustes/Ajustes.jsx';
import Fuentes from './modules/fuentes/Fuentes.jsx';
import NocheDeCine from './modules/cine/NocheDeCine.jsx';
import QueVeo from './modules/queveo/QueVeo.jsx';

const SECCIONES = [
  ['fuentes', '📺 Fuentes'],
  ['cine', '🎬 Noche de Cine'],
  ['semanal', '🗓️ Modo Netflix'],
  ['maraton', '🍿 Maratón'],
  ['aprendizaje', '🧠 Aprendizaje'],
  ['queveo', '🎲 ¿Qué veo?'],
  ['ajustes', '⚙️ Ajustes'],
];

const EN_CONSTRUCCION = (nombre) => () => <p>Sección «{nombre}» en construcción…</p>;

const MODULOS = {
  fuentes: Fuentes,
  cine: NocheDeCine,
  semanal: EN_CONSTRUCCION('Modo Netflix'),
  maraton: EN_CONSTRUCCION('Maratón'),
  aprendizaje: EN_CONSTRUCCION('Aprendizaje'),
  queveo: QueVeo,
  ajustes: Ajustes,
};

export default function App() {
  const [vista, setVista] = useState('fuentes');
  const { config } = useConfig();
  const Modulo = MODULOS[vista];
  return (
    <>
      <nav className="lateral">
        <h1>🎬 Mi Centro</h1>
        {SECCIONES.map(([clave, nombre]) => (
          <button key={clave} className={vista === clave ? 'activo' : ''} onClick={() => setVista(clave)}>
            {nombre}
          </button>
        ))}
      </nav>
      <main className="contenido">
        {config && !config.tieneTmdb && vista !== 'ajustes' && (
          <div className="aviso">
            ⚠️ Modo limitado: configura tus API keys gratuitas en <b>Ajustes</b> para ver pósters, ratings y dónde ver cada título.
          </div>
        )}
        <Modulo />
      </main>
    </>
  );
}
