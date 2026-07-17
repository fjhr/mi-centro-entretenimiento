import { useState } from 'react';
import Chips from '../../components/Chips.jsx';
import TarjetaPelicula from '../../components/TarjetaPelicula.jsx';
import contenido from '../../catalog/contenido.json';
import { MOODS } from '../../engine/moods.js';
import { recomendar } from '../../engine/recomendar.js';
import { buscarPorMood, dondeVer, porQueTeGustara } from '../../lib/peliculas.js';
import { useConfig } from '../../context/ConfigContext.jsx';

const PASOS = [
  { clave: 'mood', titulo: '¿Cuál es tu mood?', opciones: Object.entries(MOODS).map(([clave, m]) => ({ clave, etiqueta: `${m.emoji} ${m.nombre}` })) },
  { clave: 'tiempo', titulo: '¿Cuánto tiempo tienes?', opciones: [
    { clave: '30', etiqueta: '30 min' }, { clave: '60', etiqueta: '1 hora' },
    { clave: '120', etiqueta: '2 horas' }, { clave: '240', etiqueta: 'Toda la tarde' },
  ] },
  { clave: 'energia', titulo: '¿Cuánta energía tienes?', opciones: [
    { clave: 'baja', etiqueta: '🔋 Poca (algo relajado)' }, { clave: 'media', etiqueta: '🔋🔋 Normal' },
    { clave: 'alta', etiqueta: '🔋🔋🔋 Mucha (algo intenso)' },
  ] },
  { clave: 'compania', titulo: '¿Con quién estás?', opciones: [
    { clave: 'solo', etiqueta: '🧍 Solo' }, { clave: 'pareja', etiqueta: '💑 En pareja' },
    { clave: 'familia', etiqueta: '👨‍👩‍👧 Familia' }, { clave: 'amigos', etiqueta: '👯 Amigos' },
  ] },
];

const SECCIONES_RESULTADO = [
  ['pelicula', '🎬 3 Películas'], ['video', '📹 3 Videos'], ['podcast', '🎙️ 3 Podcasts'],
  ['juego', '🎮 3 Juegos'], ['documental', '🎓 3 Documentales'],
];

export default function QueVeo() {
  const { config } = useConfig();
  const [respuestas, setRespuestas] = useState({});
  const [paso, setPaso] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const responder = async (valor) => {
    const nuevas = { ...respuestas, [PASOS[paso].clave]: valor };
    setRespuestas(nuevas);
    if (paso < PASOS.length - 1) return setPaso(paso + 1);
    await generar(nuevas);
  };

  const generar = async (r) => {
    setCargando(true);
    const criterios = {
      mood: r.mood,
      tiempoMin: Number(r.tiempo),
      energia: r.energia,
      compania: r.compania,
    };
    const porCategoria = (cat) => recomendar(contenido.filter((c) => c.categoria === cat), criterios, 3);
    let peliculas = [];
    try {
      const candidatas = await buscarPorMood(r.mood, 1);
      const top = recomendar(candidatas, criterios, 3);
      peliculas = await Promise.all(top.map(async (p) => ({
        ...p,
        proveedores: await dondeVer(p.id, config.region),
        porQue: porQueTeGustara(p, r.mood),
      })));
    } catch { /* sin TMDB: seguimos con el resto */ }
    setResultado({
      pelicula: peliculas,
      video: porCategoria('video'),
      podcast: porCategoria('podcast'),
      juego: porCategoria('juego'),
      documental: porCategoria('documental'),
    });
    setCargando(false);
  };

  const reiniciar = () => { setRespuestas({}); setPaso(0); setResultado(null); };

  if (cargando) return <p>Pensando en tu combinación perfecta… 🎲</p>;

  if (resultado) {
    return (
      <div>
        <h2>🎲 Tu menú de hoy</h2>
        <button className="boton boton-secundario" onClick={reiniciar}>↺ Volver a empezar</button>
        {SECCIONES_RESULTADO.map(([cat, titulo]) => (
          <section key={cat}>
            <h3>{titulo}</h3>
            {resultado[cat].length === 0 && <p className="texto-suave">Sin resultados (¿faltan las API keys para películas?).</p>}
            <div className="cuadricula">
              {resultado[cat].map((item) =>
                cat === 'pelicula' ? (
                  <TarjetaPelicula key={item.id} pelicula={item} />
                ) : (
                  <div className="tarjeta" key={item.id}>
                    <h4 style={{ margin: '0 0 6px' }}><a href={item.url} target="_blank" rel="noreferrer">{item.titulo}</a></h4>
                    <p style={{ margin: '0 0 6px' }}>{item.descripcion}</p>
                    <span className="insignia">📍 {item.dondeVer}</span>
                    <span className="insignia">⏱️ {item.duracionMin} min</span>
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const actual = PASOS[paso];
  return (
    <div>
      <h2>🎲 ¿Qué veo hoy?</h2>
      <p className="texto-suave">Pregunta {paso + 1} de {PASOS.length}</p>
      <h3>{actual.titulo}</h3>
      <Chips opciones={actual.opciones} seleccion={respuestas[actual.clave] ?? null} onCambio={responder} />
    </div>
  );
}
