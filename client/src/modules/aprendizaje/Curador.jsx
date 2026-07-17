import { useEffect, useState } from 'react';
import Chips from '../../components/Chips.jsx';
import contenido from '../../catalog/contenido.json';
import { recomendar } from '../../engine/recomendar.js';
import { api } from '../../lib/api.js';

const INTERESES = [
  ['negocios', '💼 Negocios'], ['ia', '🤖 IA'], ['tecnologia', '💻 Tecnología'],
  ['ciencia', '🔬 Ciencia'], ['historia', '📜 Historia'], ['idiomas', '🗣️ Idiomas'],
  ['psicologia', '🧠 Psicología'],
].map(([clave, etiqueta]) => ({ clave, etiqueta }));

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const CATEGORIAS_VALIDAS = ['aprendizaje', 'podcast', 'video', 'documental'];

export default function Curador() {
  const [intereses, setIntereses] = useState([]);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    api('/datos/plan-aprendizaje').then((r) => setPlan(r.valor)).catch(() => {});
  }, []);

  const generar = async () => {
    const candidatos = contenido.filter(
      (c) => CATEGORIAS_VALIDAS.includes(c.categoria) && (c.duracionMin ?? 30) <= 45,
    );
    const mejores = recomendar(candidatos, { intereses }, DIAS.length);
    const nuevoPlan = {
      generado: new Date().toISOString(),
      intereses,
      sesiones: DIAS.map((dia, i) => ({ dia, item: mejores[i] ?? null })),
    };
    setPlan(nuevoPlan);
    await api('/datos/plan-aprendizaje', { method: 'PUT', body: nuevoPlan }).catch(() => {});
  };

  return (
    <div>
      <h2>🧠 Curador de Aprendizaje</h2>
      <p className="texto-suave">Sustituye la TV de fondo: un plan semanal de sesiones de menos de 45 minutos según tus intereses.</p>
      <Chips opciones={INTERESES} seleccion={intereses} onCambio={setIntereses} multiple />
      <button className="boton" onClick={generar} disabled={intereses.length === 0}>
        ✨ Generar plan semanal
      </button>
      {plan && (
        <div style={{ marginTop: 20 }}>
          {plan.sesiones.map(({ dia, item }) => (
            <div className="tarjeta" key={dia} style={{ marginBottom: 12 }}>
              <h4 style={{ margin: '0 0 6px' }}>{dia}</h4>
              {!item ? <p className="texto-suave">Día libre.</p> : (
                <>
                  <div><b><a href={item.url} target="_blank" rel="noreferrer">{item.titulo}</a></b></div>
                  <div style={{ margin: '6px 0' }}>
                    <span className="insignia">⏱️ {item.duracionMin} min</span>
                    <span className="insignia">📍 {item.dondeVer}</span>
                  </div>
                  <p className="texto-suave" style={{ margin: 0 }}>
                    🎯 Qué aprenderás: {item.aprenderas ?? item.descripcion}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
