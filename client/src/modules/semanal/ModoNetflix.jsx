import { useEffect, useState } from 'react';
import contenido from '../../catalog/contenido.json';
import { CANALES } from '../../engine/canales.js';
import { recomendar } from '../../engine/recomendar.js';
import { buscarPorMood, dondeVer } from '../../lib/peliculas.js';
import { api } from '../../lib/api.js';
import { useConfig } from '../../context/ConfigContext.jsx';

function busquedaPara(titulo, plataforma) {
  const q = encodeURIComponent(`${titulo} ver gratis ${plataforma ?? ''}`.trim());
  return { texto: `${titulo} ver gratis`, url: `https://www.google.com/search?q=${q}` };
}

export default function ModoNetflix() {
  const { config } = useConfig();
  const [plan, setPlan] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/datos/plan-semanal').then((r) => setPlan(r.valor)).catch(() => {});
  }, []);

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      const dias = await Promise.all(CANALES.map(async (canal) => {
        const items = [];
        try {
          const candidatas = await buscarPorMood(canal.mood, 1);
          const [peli] = recomendar(candidatas, { mood: canal.mood }, 1 + Math.floor(Math.random() * 5)).slice(-1);
          if (peli) {
            const prov = await dondeVer(peli.id, config.region);
            const plataforma = prov.gratis[0] ?? prov.suscripcion[0];
            items.push({
              titulo: `${peli.titulo}${peli.anio ? ` (${peli.anio})` : ''}`,
              tipo: 'Película',
              dondeVer: plataforma ?? 'Busca en tus fuentes gratuitas',
              busqueda: busquedaPara(peli.titulo, plataforma),
            });
          }
        } catch { /* sin TMDB: el día lleva solo contenido curado */ }
        const [extra] = recomendar(contenido, { intereses: canal.etiquetas }, 1);
        if (extra) {
          items.push({
            titulo: extra.titulo,
            tipo: extra.categoria === 'podcast' ? 'Podcast' : extra.categoria === 'juego' ? 'Juego' : 'Video/Documental',
            dondeVer: extra.dondeVer,
            url: extra.url,
            busqueda: busquedaPara(extra.titulo, extra.dondeVer),
          });
        }
        return { dia: canal.dia, nombre: canal.nombre, items };
      }));
      const nuevoPlan = { generado: new Date().toISOString(), dias };
      setPlan(nuevoPlan);
      await api('/datos/plan-semanal', { method: 'PUT', body: nuevoPlan });
    } catch (e) {
      setError(`No pude generar la parrilla: ${e.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div>
      <h2>🗓️ Modo Netflix: tu parrilla semanal</h2>
      <p className="texto-suave">Canales temáticos por día, como una programación de TV hecha para ti. Se guarda hasta que la regeneres.</p>
      <button className="boton" onClick={generar} disabled={cargando}>
        {cargando ? 'Programando tu semana…' : plan ? '↺ Regenerar semana' : '✨ Generar mi semana'}
      </button>
      {error && <div className="aviso" style={{ marginTop: 12 }}>{error}</div>}
      {plan && (
        <>
          <p className="texto-suave" style={{ marginTop: 10 }}>Generada el {new Date(plan.generado).toLocaleDateString('es-MX')}</p>
          <div className="cuadricula" style={{ marginTop: 8 }}>
            {plan.dias.map((d) => (
              <div className="tarjeta" key={d.dia}>
                <h4 style={{ margin: '0 0 10px' }}>{d.nombre}</h4>
                {d.items.length === 0 && <p className="texto-suave">Sin sugerencias (revisa tus API keys).</p>}
                {d.items.map((item, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div><span className="insignia">{item.tipo}</span> <b>{item.titulo}</b></div>
                    <div className="texto-suave">
                      📍 {item.dondeVer} · {item.url
                        ? <a href={item.url} target="_blank" rel="noreferrer">abrir</a>
                        : <a href={item.busqueda.url} target="_blank" rel="noreferrer">buscar «{item.busqueda.texto}»</a>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
