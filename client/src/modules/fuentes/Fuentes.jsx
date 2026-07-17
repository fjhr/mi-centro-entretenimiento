import { useMemo, useState } from 'react';
import fuentes from '../../catalog/fuentes.json';
import { useConfig } from '../../context/ConfigContext.jsx';

const CATEGORIAS = [
  ['peliculas', '🎬 Películas'], ['series', '📺 Series'], ['musica', '🎵 Música'],
  ['podcasts', '🎙️ Podcasts'], ['anime', '🇯🇵 Anime'], ['libros', '📚 Libros'],
  ['juegos', '🎮 Juegos'], ['documentales', '🎓 Documentales'],
  ['aprendizaje', '🧠 Aprendizaje'], ['torrents-legales', '🧲 Torrents legales'],
];

function disponibleEn(fuente, region) {
  return fuente.regiones === '*' || fuente.regiones.includes('*') || fuente.regiones.includes(region);
}

export default function Fuentes() {
  const { config } = useConfig();
  const region = config?.region ?? 'MX';
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return fuentes.filter((f) =>
      disponibleEn(f, region) &&
      (!texto || f.nombre.toLowerCase().includes(texto) || f.mejorPara.toLowerCase().includes(texto)),
    );
  }, [region, busqueda]);

  return (
    <div>
      <h2>📺 Dashboard de Fuentes gratuitas</h2>
      <p className="texto-suave">
        Plataformas legales y gratuitas disponibles en tu región ({region}). Cada una con su consejo para usarla como sistema premium.
      </p>
      <input
        placeholder="Buscar plataforma…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: 320, marginBottom: 8 }}
      />
      {CATEGORIAS.map(([clave, titulo]) => {
        const grupo = visibles.filter((f) => f.categoria === clave);
        if (!grupo.length) return null;
        return (
          <section key={clave}>
            <h3>{titulo}</h3>
            <div className="cuadricula">
              {grupo.map((f) => (
                <div className="tarjeta" key={f.nombre}>
                  <h4 style={{ margin: '0 0 6px' }}>
                    <a href={f.url} target="_blank" rel="noreferrer">{f.nombre}</a>
                  </h4>
                  <p style={{ margin: '0 0 8px' }}>{f.mejorPara}</p>
                  <div>
                    <span className="insignia">{f.registro ? 'Con registro' : 'Sin registro'}</span>
                    <span className="insignia">{f.anuncios ? 'Con anuncios' : 'Sin anuncios'}</span>
                  </div>
                  <p className="texto-suave" style={{ marginBottom: 0 }}>💎 {f.consejoPremium}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
