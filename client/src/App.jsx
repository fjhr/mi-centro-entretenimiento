import { useState } from 'react';
import { useConfig } from './context/ConfigContext.jsx';
import Inicio from './modules/inicio/Inicio.jsx';
import Ajustes from './modules/ajustes/Ajustes.jsx';
import Fuentes from './modules/fuentes/Fuentes.jsx';
import Reproducir from './modules/reproducir/Reproducir.jsx';
import Anime from './modules/anime/Anime.jsx';
import NocheDeCine from './modules/cine/NocheDeCine.jsx';
import QueVeo from './modules/queveo/QueVeo.jsx';
import ModoNetflix from './modules/semanal/ModoNetflix.jsx';
import Maraton from './modules/maraton/Maraton.jsx';
import Curador from './modules/aprendizaje/Curador.jsx';

const SECCIONES = [
  ['inicio', '🏠 Inicio'],
  ['fuentes', '📺 Fuentes'],
  ['reproducir', '🎬 Reproducir'],
  ['anime', '🎌 Anime'],
  ['cine', '🎬 Noche de Cine'],
  ['semanal', '🗓️ Modo Netflix'],
  ['maraton', '🍿 Maratón'],
  ['aprendizaje', '🧠 Aprendizaje'],
  ['queveo', '🎲 ¿Qué veo?'],
  ['ajustes', '⚙️ Ajustes'],
];

const MODULOS = {
  inicio: Inicio,
  fuentes: Fuentes,
  reproducir: Reproducir,
  anime: Anime,
  cine: NocheDeCine,
  semanal: ModoNetflix,
  maraton: Maraton,
  aprendizaje: Curador,
  queveo: QueVeo,
  ajustes: Ajustes,
};

export default function App() {
  const [vista, setVista] = useState('inicio');
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
