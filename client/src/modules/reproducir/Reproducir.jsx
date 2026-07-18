import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import { buscarIA, abrirIA, abrirTorrent, cerrarTorrent, MOTIVOS } from '../../lib/reproductor.js';

export default function Reproducir() {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [fuente, setFuente] = useState(null);
  const [origen, setOrigen] = useState('');
  const torrentActivo = useRef(null);

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

  const cerrarReproductor = () => { limpiarTorrent(); setFuente(null); };

  const reproducirIA = async (id) => {
    setError(null); cerrarReproductor();
    try {
      const meta = await abrirIA(id);
      const video = meta.archivos.find((a) => a.esVideo) || meta.archivos.find((a) => a.esAudio);
      if (video) {
        setFuente({ tipo: 'directo', url: video.url, subtitulos: meta.subtitulos });
      } else if (meta.torrent) {
        const { id: tid, archivos } = await abrirTorrent(meta.torrent);
        const tieneReproducible = archivos.some((a) => a.reproducible);
        if (!tieneReproducible) {
          cerrarTorrent(tid);
          setError('Este torrent no tiene archivos reproducibles.');
        } else {
          torrentActivo.current = tid;
          setFuente({ tipo: 'torrent', id: tid, archivos, subtitulos: meta.subtitulos });
        }
      } else {
        setError('Este elemento no tiene archivos reproducibles.');
      }
    } catch (err) {
      setError('No se pudo abrir el contenido.');
    }
  };

  const reproducirOrigen = async (e) => {
    e?.preventDefault();
    if (!origen.trim()) return;
    setError(null); cerrarReproductor();
    try {
      const { id, archivos } = await abrirTorrent(origen.trim());
      const tieneReproducible = archivos.some((a) => a.reproducible);
      if (!tieneReproducible) {
        cerrarTorrent(id);
        setError('Este torrent no tiene archivos reproducibles.');
      } else {
        torrentActivo.current = id;
        setFuente({ tipo: 'torrent', id, archivos });
      }
    } catch (err) {
      setError(MOTIVOS[err.motivo || err.codigo] || 'No se pudo abrir el origen. Revisa que esté en tu lista de fuentes permitidas (Ajustes).');
    }
  };

  return (
    <div>
      <h2>🎬 Reproducir</h2>
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
            <div className="tarjeta" key={r.identificador} style={{ cursor: 'pointer' }} onClick={() => reproducirIA(r.identificador)}>
              <img className="poster" src={r.miniatura} alt={r.titulo} loading="lazy" style={{ aspectRatio: '1', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              <h4 style={{ margin: '8px 0 2px' }}>{r.titulo}</h4>
              <span className="texto-suave">{r.tipo}{r.anio ? ` · ${r.anio}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
