import { useState } from 'react';
import { fuentesLegalesDe } from '../lib/anilist.js';
import { guardarProgreso, alternarGuardado, alternarVisto } from '../lib/biblioteca.js';

const DURACION_NOMINAL_SEG = 1200;

export default function FichaAnime({ anime, region, episodioInicial, episodioFijo = false }) {
  const [episodio, setEpisodio] = useState(episodioInicial ?? 1);
  const [guardado, setGuardado] = useState(false);
  const [visto, setVisto] = useState(false);
  const origen = `anilist:${anime.id}`;

  const abrirFuente = () => {
    guardarProgreso({
      origen,
      indice: episodio,
      posicionSeg: 1,
      duracionSeg: DURACION_NOMINAL_SEG,
      titulo: anime.titulo,
      poster: anime.portada,
    }).catch(() => {});
  };

  const alternarGuardadoLocal = () => {
    const nuevo = !guardado;
    setGuardado(nuevo);
    alternarGuardado(origen, nuevo, { titulo: anime.titulo, poster: anime.portada }).catch(() => setGuardado(!nuevo));
  };

  const marcarVisto = () => {
    const nuevo = !visto;
    setVisto(nuevo);
    alternarVisto(origen, episodio, nuevo).catch(() => setVisto(!nuevo));
  };

  const plataformas = fuentesLegalesDe(anime.titulo, region);

  return (
    <div className="tarjeta">
      {anime.portada
        ? <img className="poster" src={anime.portada} alt={anime.titulo} loading="lazy" />
        : <div className="poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎌</div>}
      <h4 style={{ margin: '8px 0 2px' }}>{anime.titulo}</h4>
      <span className="texto-suave">
        {anime.formato ?? ''}{anime.anio ? ` · ${anime.anio}` : ''}{anime.episodios ? ` · ${anime.episodios} episodios` : ''}
      </span>
      {anime.estudio && <div className="texto-suave">{anime.estudio}</div>}
      {anime.generos?.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {anime.generos.slice(0, 3).map((g) => <span key={g} className="insignia">{g}</span>)}
        </div>
      )}
      {anime.sinopsis && (
        <p className="texto-suave" style={{ marginTop: 6 }}>
          {anime.sinopsis.slice(0, 220)}{anime.sinopsis.length > 220 ? '…' : ''}
        </p>
      )}

      {!episodioFijo && (
        <div style={{ marginTop: 8 }}>
          <label style={{ margin: 0 }}>Episodio</label>
          <input
            type="number" min="1" max={anime.episodios || undefined} value={episodio}
            onChange={(e) => setEpisodio(Math.max(1, Number(e.target.value) || 1))}
            style={{ width: 80 }}
          />
        </div>
      )}

      {plataformas.length === 0 && (
        <p className="texto-suave" style={{ marginTop: 8 }}>No hay plataformas de anime configuradas para tu región.</p>
      )}
      {plataformas.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {plataformas.map((f) => (
            <a key={f.nombre} className="chip" href={f.url} target="_blank" rel="noreferrer" onClick={abrirFuente}>
              ▶ Ver en {f.nombre}
            </a>
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button className={guardado ? 'chip chip-activo' : 'chip'} onClick={alternarGuardadoLocal}>
          {guardado ? '✔ Guardada' : '💾 Guardar'}
        </button>
        <button className={visto ? 'chip chip-activo' : 'chip'} onClick={marcarVisto}>
          {visto ? '✔ Visto' : '○ Marcar como visto'}
        </button>
      </div>
    </div>
  );
}
