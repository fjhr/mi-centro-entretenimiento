import { useEffect, useRef, useState } from 'react';
import Reproductor from '../../components/Reproductor.jsx';
import FichaAnime from '../../components/FichaAnime.jsx';
import { obtenerBiblioteca, alternarGuardado, limpiarHistorial } from '../../lib/biblioteca.js';
import { resolverIA, resolverTorrentOrigen, pareceIdentificadorIA, cerrarTorrent } from '../../lib/reproductor.js';
import { useConfig } from '../../context/ConfigContext.jsx';

function progresoDe(item) {
  const archivos = Object.values(item.archivos ?? {});
  const activo = archivos.find((a) => a.duracionSeg > 0 && a.posicionSeg > 0) ?? archivos[0];
  if (!activo || !activo.duracionSeg) return 0;
  return Math.min(100, Math.round((activo.posicionSeg / activo.duracionSeg) * 100));
}

function episodioActivoDe(item) {
  const entradas = Object.entries(item.archivos ?? {});
  if (entradas.length === 0) return undefined;
  const [indice] = entradas.sort((a, b) => new Date(b[1].ultimaVez) - new Date(a[1].ultimaVez))[0];
  return Number(indice);
}

function TarjetaItem({ item, onAbrir, onGuardar }) {
  const pct = progresoDe(item);
  return (
    <div className="tarjeta tarjeta-mini">
      <div style={{ cursor: 'pointer' }} onClick={() => onAbrir(item)}>
        {item.poster
          ? <img className="poster" src={item.poster} alt={item.titulo} loading="lazy" />
          : <div className="poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎬</div>}
        {pct > 0 && (
          <div className="tarjeta-progreso"><div className="tarjeta-progreso-barra" style={{ width: `${pct}%` }} /></div>
        )}
      </div>
      <h4 style={{ margin: '8px 0 4px', cursor: 'pointer' }} onClick={() => onAbrir(item)}>{item.titulo || item.origen}</h4>
      <button className="chip" onClick={() => onGuardar(item)}>{item.guardado ? '✔ Guardada' : '💾 Guardar'}</button>
    </div>
  );
}

function Fila({ titulo, items, onAbrir, onGuardar, extra }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="fila-carrusel-titulo">{titulo}</h3>
        {extra}
      </div>
      <div className="fila-carrusel">
        {items.map((item) => <TarjetaItem key={item.origen} item={item} onAbrir={onAbrir} onGuardar={onGuardar} />)}
      </div>
    </section>
  );
}

export default function Inicio() {
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [biblio, setBiblio] = useState({ continuarViendo: [], guardados: [], historial: [] });
  const [fuente, setFuente] = useState(null);
  const [animeActivo, setAnimeActivo] = useState(null);
  const [error, setError] = useState(null);
  const torrentActivo = useRef(null);

  const cargar = () => obtenerBiblioteca().then(setBiblio).catch(() => {});
  useEffect(() => { cargar(); }, []);

  const limpiarTorrent = () => {
    if (torrentActivo.current) { cerrarTorrent(torrentActivo.current); torrentActivo.current = null; }
  };
  useEffect(() => () => limpiarTorrent(), []);

  const cerrarReproductor = () => { limpiarTorrent(); setFuente(null); cargar(); };

  const abrir = async (item) => {
    setError(null);
    if (item.origen.startsWith('anilist:')) {
      limpiarTorrent(); setFuente(null);
      setAnimeActivo(item);
      return;
    }
    setAnimeActivo(null);
    limpiarTorrent(); setFuente(null);
    try {
      const base = pareceIdentificadorIA(item.origen)
        ? await resolverIA(item.origen)
        : await resolverTorrentOrigen(item.origen);
      if (base.tipo === 'torrent') torrentActivo.current = base.id;
      setFuente({
        ...base,
        origen: item.origen,
        titulo: item.titulo || base.metaTitulo || item.origen,
        poster: item.poster ?? null,
      });
    } catch {
      setError('No se pudo reanudar este título.');
    }
  };

  const guardar = async (item) => {
    const nuevo = !item.guardado;
    try {
      await alternarGuardado(item.origen, nuevo, { titulo: item.titulo, poster: item.poster });
      cargar();
    } catch { /* deja el estado anterior visible en la próxima carga */ }
  };

  const limpiar = async () => {
    await limpiarHistorial().catch(() => {});
    cargar();
  };

  const destacado = biblio.continuarViendo[0];

  return (
    <div>
      {destacado && (
        <div className="hero" style={destacado.poster ? { backgroundImage: `linear-gradient(to top, var(--fondo), transparent 60%), url(${destacado.poster})` } : undefined}>
          <div className="hero-texto">
            <h2 style={{ margin: '0 0 8px' }}>{destacado.titulo || destacado.origen}</h2>
            <p className="texto-suave">Continuar viendo — {progresoDe(destacado)}% completado</p>
            <button className="boton" onClick={() => abrir(destacado)}>▶ Continuar</button>
          </div>
        </div>
      )}
      {!destacado && (
        <div>
          <h2>🏠 Inicio</h2>
          <p className="texto-suave">Aún no has empezado nada. Ve a <b>🎬 Reproducir</b> o <b>🎌 Anime</b> para descubrir algo.</p>
        </div>
      )}

      {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
      {fuente && <Reproductor fuente={fuente} onCerrar={cerrarReproductor} />}
      {animeActivo && (
        <div style={{ marginTop: 16 }}>
          <button className="chip" onClick={() => setAnimeActivo(null)}>✕ Cerrar</button>
          <FichaAnime
            anime={{
              id: Number(animeActivo.origen.slice('anilist:'.length)),
              titulo: animeActivo.titulo,
              portada: animeActivo.poster,
              episodios: null,
              anio: null,
              formato: null,
              estudio: null,
              generos: [],
            }}
            region={region}
            episodioInicial={episodioActivoDe(animeActivo)}
          />
        </div>
      )}

      <Fila titulo="Continuar viendo" items={biblio.continuarViendo} onAbrir={abrir} onGuardar={guardar} />
      <Fila titulo="Mi biblioteca" items={biblio.guardados} onAbrir={abrir} onGuardar={guardar} />
      <Fila
        titulo="Historial reciente" items={biblio.historial} onAbrir={abrir} onGuardar={guardar}
        extra={<button className="chip" onClick={limpiar}>🗑️ Limpiar historial</button>}
      />
    </div>
  );
}
