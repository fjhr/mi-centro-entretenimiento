import { urlPoster } from '../lib/peliculas.js';

export default function TarjetaPelicula({ pelicula, extra }) {
  const p = pelicula;
  return (
    <div className="tarjeta">
      {p.poster && <img className="poster" src={urlPoster(p.poster)} alt={`Póster de ${p.titulo}`} loading="lazy" />}
      <h4 style={{ margin: '10px 0 4px' }}>{p.titulo} {p.anio && <span className="texto-suave">({p.anio})</span>}</h4>
      <div style={{ margin: '6px 0' }}>
        {p.ratings?.imdb && <span className="insignia insignia-imdb">IMDb {p.ratings.imdb}</span>}
        {p.ratings?.rottenTomatoes && <span className="insignia insignia-rt">🍅 {p.ratings.rottenTomatoes}</span>}
        {!p.ratings?.imdb && typeof p.rating === 'number' && <span className="insignia">TMDB {p.rating.toFixed(1)}</span>}
      </div>
      {p.proveedores && (
        <p style={{ margin: '6px 0' }}>
          {p.proveedores.gratis.length > 0 && <>🆓 <b>{p.proveedores.gratis.join(', ')}</b></>}
          {p.proveedores.gratis.length === 0 && p.proveedores.suscripcion.length > 0 && <>💳 {p.proveedores.suscripcion.join(', ')}</>}
          {p.proveedores.gratis.length === 0 && p.proveedores.suscripcion.length === 0 && <span className="texto-suave">Sin streaming en tu región — prueba las fuentes del Dashboard</span>}
        </p>
      )}
      {p.porQue && <p className="texto-suave" style={{ marginBottom: 0 }}>💡 {p.porQue}</p>}
      {extra}
    </div>
  );
}
