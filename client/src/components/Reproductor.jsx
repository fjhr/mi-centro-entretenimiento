import { useEffect, useRef, useState } from 'react';
import { urlStream, urlSubtitulo } from '../lib/reproductor.js';
import { obtenerBiblioteca, guardarProgreso, alternarVisto } from '../lib/biblioteca.js';

const INTERVALO_GUARDADO_MS = 10_000;

export default function Reproductor({ fuente, onCerrar }) {
  const [indice, setIndice] = useState(0);
  const [visto, setVisto] = useState(false);
  const videoRef = useRef(null);
  const resumeAplicado = useRef(false);

  useEffect(() => { setIndice(0); resumeAplicado.current = false; }, [fuente]);

  const reproducibles = fuente?.tipo === 'torrent'
    ? fuente.archivos.filter((a) => a.reproducible)
    : [];
  const indiceActivo = !fuente
    ? 0
    : fuente.tipo === 'directo'
      ? 0
      : (reproducibles[indice] ?? fuente.archivos[0])?.indice ?? 0;
  const src = !fuente
    ? null
    : fuente.tipo === 'directo'
      ? fuente.url
      : urlStream(fuente.id, indiceActivo);

  // Al cambiar de fuente/archivo activo: buscar progreso guardado y estado de "visto".
  useEffect(() => {
    if (!fuente) return;
    let cancelado = false;
    obtenerBiblioteca().then((biblio) => {
      if (cancelado) return;
      const archivo = biblio.entradas?.[fuente.origen]?.archivos?.[indiceActivo];
      setVisto(archivo?.visto ?? false);
      const video = videoRef.current;
      if (!video || !archivo || archivo.posicionSeg <= 0) return;
      const aplicarResume = () => {
        if (resumeAplicado.current) return;
        resumeAplicado.current = true;
        if (archivo.posicionSeg < video.duration) video.currentTime = archivo.posicionSeg;
      };
      if (video.readyState >= 1) aplicarResume();
      else video.addEventListener('loadedmetadata', aplicarResume, { once: true });
    }).catch(() => {});
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, indiceActivo]);

  const guardarAhora = () => {
    const video = videoRef.current;
    if (!fuente || !video || !video.duration || Number.isNaN(video.duration)) return;
    guardarProgreso({
      origen: fuente.origen,
      indice: indiceActivo,
      posicionSeg: video.currentTime,
      duracionSeg: video.duration,
      titulo: fuente.titulo,
      poster: fuente.poster,
    }).then((r) => { if (r?.visto) setVisto(true); }).catch(() => {});
  };

  // Autoguardado periódico mientras hay una fuente activa.
  useEffect(() => {
    if (!fuente) return;
    const id = setInterval(guardarAhora, INTERVALO_GUARDADO_MS);
    window.addEventListener('beforeunload', guardarAhora);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', guardarAhora);
      guardarAhora();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente, indiceActivo]);

  const alternarVistoManual = () => {
    if (!fuente) return;
    const nuevo = !visto;
    setVisto(nuevo);
    alternarVisto(fuente.origen, indiceActivo, nuevo).catch(() => setVisto(!nuevo));
  };

  const cerrar = () => {
    guardarAhora();
    onCerrar?.();
  };

  if (!fuente) return null;

  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>▶️ Reproduciendo</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={visto ? 'chip chip-activo' : 'chip'} onClick={alternarVistoManual}>
            {visto ? '✔ Visto' : '○ Marcar como visto'}
          </button>
          {onCerrar && <button className="chip" onClick={cerrar}>✕ Cerrar</button>}
        </div>
      </div>
      <video
        key={src}
        ref={videoRef}
        className="poster"
        style={{ width: '100%', aspectRatio: '16/9', height: 'auto', background: '#000' }}
        src={src}
        controls
        autoPlay
        onPause={guardarAhora}
      >
        {(fuente.subtitulos ?? []).map((s, i) => (
          <track key={i} kind="subtitles" src={urlSubtitulo(s.url)} label={s.idioma || `Subtítulo ${i + 1}`} default={i === 0} />
        ))}
      </video>
      {reproducibles.length > 1 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {reproducibles.map((a, i) => (
            <button key={a.indice} className={i === indice ? 'chip chip-activo' : 'chip'} onClick={() => setIndice(i)}>
              {a.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
