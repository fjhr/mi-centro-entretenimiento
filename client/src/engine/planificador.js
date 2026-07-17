export const FRANJAS_DIA = [
  { nombre: 'Mañana', proporcion: 0.35 },
  { nombre: 'Tarde', proporcion: 0.4 },
  { nombre: 'Noche', proporcion: 0.25 },
];

export function intercalarCategorias(items) {
  const grupos = new Map();
  for (const item of items) {
    const clave = item.categoria ?? 'otros';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(item);
  }
  const listas = [...grupos.values()];
  const resultado = [];
  for (let i = 0; listas.some((l) => i < l.length); i++) {
    for (const lista of listas) {
      if (i < lista.length) resultado.push(lista[i]);
    }
  }
  return resultado;
}

export function planificarFranjas(items, tiempoTotalMin, franjas) {
  const bloques = franjas.map((f) => ({
    franja: f.nombre,
    presupuesto: Math.floor(tiempoTotalMin * f.proporcion),
    items: [],
    minutosUsados: 0,
  }));
  const pendientes = [...items];
  for (const bloque of bloques) {
    for (let i = 0; i < pendientes.length; ) {
      const duracion = pendientes[i].duracionMin ?? 30;
      if (bloque.minutosUsados + duracion <= bloque.presupuesto) {
        bloque.items.push(pendientes[i]);
        bloque.minutosUsados += duracion;
        pendientes.splice(i, 1);
      } else {
        i++;
      }
    }
  }
  return bloques;
}
