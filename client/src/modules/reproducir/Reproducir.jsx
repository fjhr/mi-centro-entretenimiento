import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import FichaAnime from '../../components/FichaAnime.jsx';
import { resolverIA, resolverTorrentOrigen, cerrarTorrent, MOTIVOS, buscarIA } from '../../lib/reproductor.js';
import { alternarGuardado } from '../../lib/biblioteca.js';
import { buscarAnime } from '../../lib/anilist.js';
import { useConfig } from '../../context/ConfigContext.jsx';

export default function Reproducir() {
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [pestana, setPestana] = useState('ia');

  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fuente, setFuente] = useState(null);
  const [origen, setOrigen] = useState('');
  const [guardados, setGuardados] = useState({});
  const torrentActivo = useRef(null);

  const [qAnime, setQAnime] = useState('');
  const [resultadosAnime, setResultadosAnime] = useState([]);
  const [cargandoAnime, setCargandoAnime] = useState(false);
  const [errorAnime, setErrorAnime] = useState(null);

  const limpiarTorrent = () => {
    if (torrentActivo.current) { cerrarTorrent(torrentActivo.current); torrentActivo.current = null; }
  };
  useEffect(() => () => limpiarTorrent(), []);

  const buscar = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setCargando(true); setError(null);
    try {
      const { resultados } = await buscarIA(q);
      setResultados(resultados);
    } catch (err) {
      setError('No se pudo buscar en Internet Archive.');
    } finally {
      setCargando(false);
    }
  };

  const buscarAnimeForm = async (e) => {
    e?.preventDefault();
    if (!qAnime.trim()) return;
    setCargandoAnime(true); setErrorAnime(null);
    try {
      const r = await buscarAnime(qAnime);
      setResultadosAnime(r.resultados);
    } catch {
      setErrorAnime('No se pudo buscar en AniList.');
    } finally {
      setCargandoAnime(false);
    }
  };

  const cerrarReproductor = () => { limpiarTorrent(); setFuente(null); };

  const reproducirIA = async (resultado) => {
    setError(null); cerrarReproductor();
    try {
      const base = await resolverIA(resultado.identificador);
      if (base.tipo === 'torrent') torrentActivo.current = base.id;
      setFuente({
        ...base,
        origen: resultado.identificador,
        titulo: resultado.titulo || base.metaTitulo || resultado.identificador,
        poster: resultado.miniatura ?? null,
      });
    } catch (err) {
      setError(err.motivo === 'sin-reproducibles' ? 'Este elemento no tiene archivos reproducibles.' : 'No se pudo abrir el contenido.');
    }
  };

  const reproducirOrigen = async (e) => {
    e?.preventDefault();
    if (!origen.trim()) return;
    const valor = origen.trim();
    setError(null); cerrarReproductor();
    try {
      const base = await resolverTorrentOrigen(valor);
      torrentActivo.current = base.id;
      setFuente({ ...base, origen: valor, titulo: valor, poster: null });
    } catch (err) {
      setError(
        err.motivo === 'sin-reproducibles'
          ? 'Este torrent no tiene archivos reproducibles.'
          : MOTIVOS[err.motivo || err.codigo] || 'No se pudo abrir el origen. Revisa que esté en tu lista de fuentes permitidas (Ajustes).',
      );
    }
  };

  const alternarGuardadoResultado = async (resultado) => {
    const nuevo = !guardados[resultado.identificador];
    setGuardados((g) => ({ ...g, [resultado.identificador]: nuevo }));
    try {
      await alternarGuardado(resultado.identificador, nuevo, { titulo: resultado.titulo, poster: resultado.miniatura });
    } catch {
      setGuardados((g) => ({ ...g, [resultado.identificador]: !nuevo }));
    }
  };

  return (
    <div>
      <h2>🎬 Reproducir</h2>
      <div className="chips">
        <button className={pestana === 'ia' ? 'chip chip-activo' : 'chip'} onClick={() => setPestana('ia')}>Internet Archive</button>
        <button className={pestana === 'anime' ? 'chip chip-activo' : 'chip'} onClick={() => setPestana('anime')}>🎌 Anime</button>
      </div>

      {pestana === 'ia' && (
        <>
          <p className="texto-suave">Busca en Internet Archive o pega un origen permitido. Solo se reproducen fuentes de tu lista permitida (Ajustes) e Internet Archive.</p>

          <form onSubmit={buscar} style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Buscar en Internet Archive…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
            <button className="boton" disabled={cargando}>{cargando ? 'Buscando…' : 'Buscar'}</button>
          </form>

          <form onSubmit={reproducirOrigen} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input placeholder="Pegar magnet, enlace .torrent o URL de video…" value={origen} onChange={(e) => setOrigen(e.target.value)} style={{ flex: 1 }} />
            <button className="boton boton-secundario">Reproducir origen</button>
          </form>

          {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}

          {fuente && <Reproductor fuente={fuente} onCerrar={cerrarReproductor} />}

          {resultados.length > 0 && (
            <div className="cuadricula" style={{ marginTop: 16 }}>
              {resultados.map((r) => (
                <div className="tarjeta" key={r.identificador}>
                  <img
                    className="poster" src={r.miniatura} alt={r.titulo} loading="lazy"
                    style={{ aspectRatio: '1', objectFit: 'cover', cursor: 'pointer' }}
                    onClick={() => reproducirIA(r)}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <h4 style={{ margin: '8px 0 2px', cursor: 'pointer' }} onClick={() => reproducirIA(r)}>{r.titulo}</h4>
                  <span className="texto-suave">{r.tipo}{r.anio ? ` · ${r.anio}` : ''}</span>
                  <div style={{ marginTop: 8 }}>
                    <button className="chip" onClick={() => alternarGuardadoResultado(r)}>
                      {guardados[r.identificador] ? '✔ Guardada' : '💾 Guardar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pestana === 'anime' && (
        <>
          <p className="texto-suave">Busca anime con fichas de AniList y ábrelo en tu plataforma legal favorita.</p>

          <form onSubmit={buscarAnimeForm} style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Buscar anime…" value={qAnime} onChange={(e) => setQAnime(e.target.value)} style={{ flex: 1 }} />
            <button className="boton" disabled={cargandoAnime}>{cargandoAnime ? 'Buscando…' : 'Buscar'}</button>
          </form>

          {errorAnime && <div className="aviso" style={{ marginTop: 12 }}>{errorAnime}</div>}

          {resultadosAnime.length > 0 && (
            <div className="cuadricula" style={{ marginTop: 16 }}>
              {resultadosAnime.map((a) => <FichaAnime key={a.id} anime={a} region={region} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
