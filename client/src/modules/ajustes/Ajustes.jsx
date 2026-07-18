import { useState, useEffect } from 'react';
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
  const [error, setError] = useState('');
  const [hosts, setHosts] = useState(config?.allowlist ?? []);
  const [nuevoHost, setNuevoHost] = useState('');

  const guardar = async () => {
    setError('');
    setEstado('guardando');
    try {
      await api('/config', { method: 'PUT', body: { tmdbKey, omdbKey, region } });
      await recargar();
      setTmdbKey('');
      setOmdbKey('');
      setEstado('guardado');
    } catch {
      setError('No se pudo guardar la configuración.');
      setEstado('');
    }
  };

  const probar = async () => {
    setError('');
    setEstado('probando');
    try {
      setPrueba(await api('/config/probar', { method: 'POST', body: {} }));
    } catch {
      setError('No se pudo probar la conexión.');
    } finally {
      setEstado('');
    }
  };

  const guardarAllowlist = async (lista) => {
    setHosts(lista);
    await api('/config', { method: 'PUT', body: { allowlist: lista } });
    await recargar();
  };
  const agregarHost = () => {
    const h = nuevoHost.trim().toLowerCase();
    if (h && !hosts.includes(h)) guardarAllowlist([...hosts, h]);
    setNuevoHost('');
  };
  const quitarHost = (h) => guardarAllowlist(hosts.filter((x) => x !== h));

  useEffect(() => { if (config?.allowlist) setHosts(config.allowlist); }, [config?.allowlist]);

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
        {error && <div className="aviso">{error}</div>}
        {prueba && (
          <p>
            TMDB: {prueba.tmdb ? '✅ funciona' : '❌ falla'} · OMDb: {prueba.omdb ? '✅ funciona' : '❌ falla'}
          </p>
        )}
      </div>
      <div className="tarjeta" style={{ maxWidth: 560, marginTop: 20 }}>
        <h3>Fuentes permitidas (allowlist)</h3>
        <p className="texto-suave">
          Solo se reproducen orígenes de esta lista, más Internet Archive (siempre permitido).
          Agrega hosts de fuentes legales que tengas derecho a usar. Un magnet sin webseed o tracker
          de un host permitido se rechazará.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="ejemplo: jamendo.com" value={nuevoHost}
            onChange={(e) => setNuevoHost(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && agregarHost()} style={{ flex: 1 }} />
          <button className="boton" onClick={agregarHost}>Agregar</button>
        </div>
        <ul style={{ marginTop: 12, paddingLeft: 0, listStyle: 'none' }}>
          <li className="texto-suave" style={{ marginBottom: 6 }}>archive.org · bt.archive.org (siempre permitidos)</li>
          {hosts.map((h) => (
            <li key={h} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span>{h}</span>
              <button className="chip" onClick={() => quitarHost(h)}>Quitar</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
