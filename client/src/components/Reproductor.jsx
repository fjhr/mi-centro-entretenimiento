import { useEffect, useState } from 'react';
import { urlStream, urlSubtitulo } from '../lib/reproductor.js';

export default function Reproductor({ fuente, onCerrar }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => { setIndice(0); }, [fuente]);

  if (!fuente) return null;

  const reproducibles = fuente.tipo === 'torrent'
    ? fuente.archivos.filter((a) => a.reproducible)
    : [];
  const src = fuente.tipo === 'directo'
    ? fuente.url
    : urlStream(fuente.id, (reproducibles[indice] ?? fuente.archivos[0]).indice);

  return (
    <div className="tarjeta" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>▶️ Reproduciendo</h3>
        {onCerrar && <button className="chip" onClick={onCerrar}>✕ Cerrar</button>}
      </div>
      <video
        key={src}
        className="poster"
        style={{ width: '100%', aspectRatio: '16/9', height: 'auto', background: '#000' }}
        src={src}
        controls
        autoPlay
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
