import { useState } from 'react';
import Chips from '../../components/Chips.jsx';
import TarjetaPelicula from '../../components/TarjetaPelicula.jsx';
import { MOODS } from '../../engine/moods.js';
import { recomendar } from '../../engine/recomendar.js';
import { buscarPorMood, dondeVer, ratingsDe, porQueTeGustara } from '../../lib/peliculas.js';
import { api } from '../../lib/api.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const OPCIONES_MOOD = Object.entries(MOODS).map(([clave, m]) => ({ clave, etiqueta: `${m.emoji} ${m.nombre}` }));

export default function NocheDeCine() {
  const { config } = useConfig();
  const [mood, setMood] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [principales, setPrincipales] = useState([]);
  const [respaldos, setRespaldos] = useState([]);

  const generar = async (moodElegido) => {
    setMood(moodElegido);
    setCargando(true);
    setError(null);
    try {
      const { valor: vistos } = await api('/datos/vistos').catch(() => ({ valor: [] }));
      const candidatas = await buscarPorMood(moodElegido, 2);
      const top = recomendar(candidatas, { mood: moodElegido, vistos: vistos ?? [] }, 13);
      const diez = await Promise.all(
        top.slice(0, 10).map(async (p) => ({
          ...p,
          proveedores: await dondeVer(p.id, config?.region ?? 'MX'),
          ratings: await ratingsDe(p.tituloOriginal ?? p.titulo, p.anio),
          porQue: porQueTeGustara(p, moodElegido),
        })),
      );
      setPrincipales(diez);
      setRespaldos(top.slice(10));
    } catch (e) {
      setError(e.status === 503 ? 'Necesitas configurar tu API key de TMDB en Ajustes.' : `No pude generar la lista: ${e.message}`);
    } finally {
      setCargando(false);
    }
  };

  const marcarVista = async (id) => {
    const { valor } = await api('/datos/vistos').catch(() => ({ valor: [] }));
    const vistos = Array.isArray(valor) ? valor : [];
    if (!vistos.includes(id)) await api('/datos/vistos', { method: 'PUT', body: [...vistos, id] });
    setPrincipales((lista) => lista.filter((p) => p.id !== id));
  };

  return (
    <div>
      <h2>🎬 Noche de Cine</h2>
      <p className="texto-suave">Elige tu mood de hoy y te doy 10 películas + 3 respaldos, con ratings y dónde verlas.</p>
      <Chips opciones={OPCIONES_MOOD} seleccion={mood} onCambio={generar} />
      {cargando && <p>Buscando películas para tu mood… 🍿</p>}
      {error && <div className="aviso">{error}</div>}
      {!cargando && principales.length > 0 && (
        <>
          <div className="cuadricula">
            {principales.map((p) => (
              <TarjetaPelicula
                key={p.id}
                pelicula={p}
                extra={<button className="chip" style={{ marginTop: 8 }} onClick={() => marcarVista(p.id)}>✔ Ya la vi</button>}
              />
            ))}
          </div>
          {respaldos.length > 0 && (
            <div className="tarjeta" style={{ marginTop: 20 }}>
              <h3 style={{ marginTop: 0 }}>🎯 Respaldos (por si ninguna convence)</h3>
              <ul>
                {respaldos.map((p) => <li key={p.id}>{p.titulo} {p.anio && `(${p.anio})`} — TMDB {p.rating?.toFixed(1)}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
