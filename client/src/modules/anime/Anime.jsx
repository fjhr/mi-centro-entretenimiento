import { useEffect, useState } from 'react';
import FichaAnime from '../../components/FichaAnime.jsx';
import { obtenerCalendario, obtenerTendencias, buscarAnime } from '../../lib/anilist.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const PANELES = [
  ['calendario', '📅 Calendario'],
  ['tendencias', '🔥 Tendencias'],
  ['buscador', '🔎 Buscador'],
];

export default function Anime() {
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [panel, setPanel] = useState('calendario');
  const [calendario, setCalendario] = useState([]);
  const [tendenciasTemporada, setTendenciasTemporada] = useState([]);
  const [tendenciasSiempre, setTendenciasSiempre] = useState([]);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [errorBuscador, setErrorBuscador] = useState(null);

  useEffect(() => {
    if (panel === 'calendario' && calendario.length === 0) {
      setCargando(true); setError(null);
      obtenerCalendario()
        .then((r) => setCalendario(r.proximos))
        .catch(() => setError('No se pudo consultar AniList en este momento.'))
        .finally(() => setCargando(false));
    }
    if (panel === 'tendencias' && tendenciasTemporada.length === 0) {
      setCargando(true); setError(null);
      obtenerTendencias()
        .then((r) => { setTendenciasTemporada(r.temporada); setTendenciasSiempre(r.siempre); })
        .catch(() => setError('No se pudo consultar AniList en este momento.'))
        .finally(() => setCargando(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const buscar = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setCargando(true); setErrorBuscador(null);
    try {
      const r = await buscarAnime(q);
      setResultados(r.resultados);
    } catch {
      setErrorBuscador('No se pudo buscar en AniList.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <h2>🎌 Anime</h2>
      <p className="texto-suave">Descubre anime con fichas de AniList y ábrelo en tu plataforma legal favorita.</p>
      <div className="chips">
        {PANELES.map(([clave, nombre]) => (
          <button key={clave} className={panel === clave ? 'chip chip-activo' : 'chip'} onClick={() => setPanel(clave)}>
            {nombre}
          </button>
        ))}
      </div>

      {cargando && <p className="texto-suave">Cargando…</p>}

      {panel === 'calendario' && !cargando && (
        <>
          {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
          <div className="cuadricula" style={{ marginTop: 16 }}>
            {calendario.map((item) => (
              <FichaAnime
                key={`${item.id}-${item.episodio}`}
                anime={{ id: item.id, titulo: item.titulo, portada: item.portada, episodios: null, anio: null, formato: null, estudio: null, generos: [] }}
                region={region}
                episodioInicial={item.episodio}
                episodioFijo
              />
            ))}
          </div>
        </>
      )}

      {panel === 'tendencias' && !cargando && (
        <>
          {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
          <h3 style={{ marginTop: 16 }}>Esta temporada</h3>
          <div className="cuadricula">
            {tendenciasTemporada.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
          </div>
          <h3 style={{ marginTop: 16 }}>Populares de siempre</h3>
          <div className="cuadricula">
            {tendenciasSiempre.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
          </div>
        </>
      )}

      {panel === 'buscador' && (
        <>
          <form onSubmit={buscar} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input placeholder="Buscar anime…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
            <button className="boton">Buscar</button>
          </form>
          {errorBuscador && <div className="aviso" style={{ marginTop: 12 }}>{errorBuscador}</div>}
          <div className="cuadricula" style={{ marginTop: 16 }}>
            {resultados.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
          </div>
        </>
      )}
    </div>
  );
}
