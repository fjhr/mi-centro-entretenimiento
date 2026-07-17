export async function api(ruta, opciones) {
  const r = await fetch(`/api${ruta}`, opciones && {
    method: opciones.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(json.mensaje || `Error ${r.status}`);
    error.codigo = json.error;
    error.status = r.status;
    throw error;
  }
  return json;
}

export function tmdb(ruta, params = {}) {
  const q = new URLSearchParams(params).toString();
  return api(`/tmdb/${ruta}${q ? `?${q}` : ''}`);
}

export function omdb(params) {
  return api(`/omdb?${new URLSearchParams(params)}`);
}
