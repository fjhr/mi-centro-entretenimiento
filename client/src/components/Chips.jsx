export default function Chips({ opciones, seleccion, onCambio, multiple = false }) {
  const activo = (clave) => (multiple ? seleccion.includes(clave) : seleccion === clave);
  const alternar = (clave) => {
    if (!multiple) return onCambio(clave);
    onCambio(activo(clave) ? seleccion.filter((x) => x !== clave) : [...seleccion, clave]);
  };
  return (
    <div className="chips">
      {opciones.map((o) => (
        <button
          key={o.clave}
          type="button"
          className={activo(o.clave) ? 'chip chip-activo' : 'chip'}
          onClick={() => alternar(o.clave)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
