import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const REGIONES = [
  ['MX', 'México'], ['ES', 'España'], ['AR', 'Argentina'], ['CO', 'Colombia'],
  ['CL', 'Chile'], ['PE', 'Perú'], ['US', 'Estados Unidos'],
];

export default function Ajustes() {
  const { config, recargar } = useConfig();
  const [tmdbKey, setTmdbKey] = useState('');
  const [omdbKey, setOmdbKey] = useState('');
  const [region, setRegion] = useState(config?.region ?? 'MX');
  const [estado, setEstado] = useState('');
  const [prueba, setPrueba] = useState(null);

  const guardar = async () => {
    setEstado('guardando');
    await api('/config', { method: 'PUT', body: { tmdbKey, omdbKey, region } });
    await recargar();
    setTmdbKey('');
    setOmdbKey('');
    setEstado('guardado');
  };

  const probar = async () => {
    setEstado('probando');
    setPrueba(await api('/config/probar', { method: 'POST', body: {} }));
    setEstado('');
  };

  return (
    <div>
      <h2>⚙️ Ajustes</h2>
      <div className="tarjeta" style={{ maxWidth: 560 }}>
        <h3>Región</h3>
        <p className="texto-suave">Define qué plataformas se muestran y el idioma/país de los datos de TMDB.</p>
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          {REGIONES.map(([clave, nombre]) => <option key={clave} value={clave}>{nombre}</option>)}
        </select>

        <h3 style={{ marginTop: 24 }}>API keys gratuitas</h3>
        <p className="texto-suave">
          Sin keys la app funciona con el catálogo curado, pero sin pósters, ratings ni "dónde ver" en vivo.
          Obtenerlas toma ~5 minutos y no piden tarjeta:
        </p>
        <ol className="texto-suave">
          <li>TMDB: crea cuenta en <a href="https://www.themoviedb.org/signup" target="_blank" rel="noreferrer">themoviedb.org</a> y pide tu key en <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">Ajustes → API</a>.</li>
          <li>OMDb: pide tu key gratis en <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer">omdbapi.com/apikey.aspx</a> (plan FREE, 1000 consultas/día).</li>
        </ol>
        <label>API key de TMDB {config?.tieneTmdb && '✅ (ya configurada)'}</label>
        <input type="password" value={tmdbKey} onChange={(e) => setTmdbKey(e.target.value)} placeholder="Pégala aquí" style={{ width: '100%' }} />
        <label>API key de OMDb {config?.tieneOmdb && '✅ (ya configurada)'}</label>
        <input type="password" value={omdbKey} onChange={(e) => setOmdbKey(e.target.value)} placeholder="Pégala aquí" style={{ width: '100%' }} />
        <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
          <button className="boton" onClick={guardar} disabled={estado === 'guardando'}>Guardar</button>
          <button className="boton boton-secundario" onClick={probar} disabled={estado === 'probando'}>Probar conexión</button>
        </div>
        {estado === 'guardado' && <p>✅ Guardado.</p>}
        {prueba && (
          <p>
            TMDB: {prueba.tmdb ? '✅ funciona' : '❌ falla'} · OMDb: {prueba.omdb ? '✅ funciona' : '❌ falla'}
          </p>
        )}
      </div>
    </div>
  );
}
