function normalizarHost(host) {
  return (host || '').toLowerCase().split(':')[0];
}

export function esInternetArchive(host) {
  const h = (host || '').toLowerCase().split(':')[0];
  return h === 'archive.org' || h.endsWith('.archive.org');
}

export function hostPermitido(host, allowlist = []) {
  if (!host) return false;
  if (esInternetArchive(host)) return true;
  const h = normalizarHost(host);
  return allowlist.map((x) => normalizarHost(x)).includes(h);
}

function hostDeUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function hostsDeMagnet(magnet, clave) {
  const params = new URLSearchParams(magnet.slice('magnet:?'.length));
  return params.getAll(clave).map(hostDeUrl).filter(Boolean);
}

export function validarOrigen(origen, allowlist = []) {
  const texto = (origen || '').trim();
  if (!texto) return { ok: false, motivo: 'formato-no-soportado' };

  if (texto.startsWith('magnet:?')) {
    const hosts = [...hostsDeMagnet(texto, 'ws'), ...hostsDeMagnet(texto, 'xs'), ...hostsDeMagnet(texto, 'tr')];
    if (hosts.some((h) => hostPermitido(h, allowlist))) return { ok: true, tipo: 'torrent' };
    return { ok: false, motivo: 'origen-no-verificable' };
  }

  if (/^https?:\/\//i.test(texto)) {
    const host = hostDeUrl(texto);
    if (!host) return { ok: false, motivo: 'formato-no-soportado' };

    // Archive.org URLs always return 'ia' type
    if (esInternetArchive(host)) return { ok: true, tipo: 'ia' };

    if (!hostPermitido(host, allowlist)) return { ok: false, motivo: 'host-no-permitido' };
    return texto.toLowerCase().split('?')[0].endsWith('.torrent')
      ? { ok: true, tipo: 'torrent-url' }
      : { ok: true, tipo: 'http' };
  }

  if (/^[A-Za-z0-9._-]+$/.test(texto)) return { ok: true, tipo: 'ia' };

  return { ok: false, motivo: 'formato-no-soportado' };
}
