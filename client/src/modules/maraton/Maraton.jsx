import { useState } from 'react';
import Chips from '../../components/Chips.jsx';
import contenido from '../../catalog/contenido.json';
import { recomendar } from '../../engine/recomendar.js';
import { intercalarCategorias, planificarFranjas, FRANJAS_DIA } from '../../engine/planificador.js';
import { buscarPorMood } from '../../lib/peliculas.js';

const INTERESES = [
  ['negocios', '💼 Negocios'], ['ia', '🤖 IA'], ['tecnologia', '💻 Tecnología'],
  ['ciencia', '🔬 Ciencia'], ['historia', '📜 Historia'], ['idiomas', '🗣️ Idiomas'],
  ['psicologia', '🧠 Psicología'], ['cultura', '🌎 Cultura'], ['humor', '😂 Humor'],
].map(([clave, etiqueta]) => ({ clave, etiqueta }));

const EMOJI_FRANJA = { 'Mañana': '🌅', 'Tarde': '☀️', 'Noche': '🌙' };

export default function Maraton() {
  const [horas, setHoras] = useState(6);
  const [intereses, setIntereses] = useState([]);
  const [bloques, setBloques] = useState(null);
  const [cargando, setCargando] = useState(false);

  const generar = async () => {
    setCargando(true);
    let candidatos = recomendar(contenido, { intereses }, 25);
    try {
      const pelis = await buscarPorMood('mente-volada', 1);
      candidatos = [...candidatos, ...recomendar(pelis, {}, 4)];
    } catch { /* sin TMDB: maratón solo con contenido curado */ }
    setBloques(planificarFranjas(intercalarCategorias(candidatos), horas * 60, FRANJAS_DIA));
    setCargando(false);
  };

  return (
    <div>
      <h2>🍿 Maratón de Fin de Semana</h2>
      <label>¿Cuántas horas tienes disponibles?</label>
      <input type="number" min="1" max="16" value={horas} onChange={(e) => setHoras(Number(e.target.value))} style={{ width: 100 }} /> horas
      <label>¿Qué te interesa? (elige varios)</label>
      <Chips opciones={INTERESES} seleccion={intereses} onCambio={setIntereses} multiple />
      <button className="boton" onClick={generar} disabled={cargando || horas < 1}>
        {cargando ? 'Armando tu maratón…' : '✨ Armar mi maratón'}
      </button>
      {bloques && (
        <div className="cuadricula" style={{ marginTop: 20 }}>
          {bloques.map((b) => (
            <div className="tarjeta" key={b.franja}>
              <h3 style={{ marginTop: 0 }}>{EMOJI_FRANJA[b.franja]} {b.franja}</h3>
              <p className="texto-suave">{b.minutosUsados} de {b.presupuesto} min planificados</p>
              {b.items.length === 0 && <p className="texto-suave">Franja libre — descansa o improvisa.</p>}
              {b.items.map((item) => (
                <div key={item.id} style={{ marginBottom: 10 }}>
                  <span className="insignia">{item.categoria}</span> <b>{item.titulo}</b>
                  <div className="texto-suave">⏱️ {item.duracionMin ?? 30} min{item.dondeVer ? ` · 📍 ${item.dondeVer}` : ''}
                    {item.url && <> · <a href={item.url} target="_blank" rel="noreferrer">abrir</a></>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
