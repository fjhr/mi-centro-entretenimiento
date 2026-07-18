import { describe, it, expect } from 'vitest';
import { hostPermitido, validarOrigen } from '../lib/origen.js';

const ALLOW = ['jamendo.com', 'miservidor.local'];

describe('hostPermitido', () => {
  it('acepta archive.org y subdominios siempre', () => {
    expect(hostPermitido('archive.org', [])).toBe(true);
    expect(hostPermitido('ia800000.us.archive.org', [])).toBe(true);
    expect(hostPermitido('bt.archive.org', [])).toBe(true);
  });
  it('acepta hosts de la allowlist sin importar mayúsculas/puerto', () => {
    expect(hostPermitido('JAMENDO.com', ALLOW)).toBe(true);
    expect(hostPermitido('miservidor.local', ALLOW)).toBe(true);
  });
  it('rechaza hosts fuera de la lista', () => {
    expect(hostPermitido('ejemplo-pirata.net', ALLOW)).toBe(false);
  });
});

describe('validarOrigen', () => {
  it('acepta identificador de Internet Archive', () => {
    expect(validarOrigen('night_of_the_living_dead', ALLOW)).toEqual({ ok: true, tipo: 'ia' });
  });
  it('acepta URL de archive.org', () => {
    expect(validarOrigen('https://archive.org/details/algo', ALLOW).tipo).toBe('ia');
  });
  it('acepta URL http de host permitido', () => {
    expect(validarOrigen('https://jamendo.com/pista.mp3', ALLOW)).toEqual({ ok: true, tipo: 'http' });
  });
  it('rechaza URL http de host no permitido', () => {
    expect(validarOrigen('https://ejemplo-pirata.net/v.mp4', ALLOW)).toEqual({ ok: false, motivo: 'host-no-permitido' });
  });
  it('acepta .torrent de host permitido', () => {
    expect(validarOrigen('https://miservidor.local/x.torrent', ALLOW)).toEqual({ ok: true, tipo: 'torrent-url' });
  });
  it('acepta magnet con webseed de host permitido', () => {
    const m = 'magnet:?xt=urn:btih:abc&ws=https://miservidor.local/pelicula.mp4';
    expect(validarOrigen(m, ALLOW)).toEqual({ ok: true, tipo: 'torrent' });
  });
  it('rechaza magnet cuyo unico origen es un tracker (un tracker no fija el contenido)', () => {
    const m = 'magnet:?xt=urn:btih:abc&tr=' + encodeURIComponent('udp://bt.archive.org:6969');
    expect(validarOrigen(m, ALLOW)).toEqual({ ok: false, motivo: 'origen-no-verificable' });
  });
  it('rechaza magnet pelado (sin webseed ni tracker permitido)', () => {
    const m = 'magnet:?xt=urn:btih:abc&tr=' + encodeURIComponent('udp://tracker.publico.net:80');
    expect(validarOrigen(m, ALLOW)).toEqual({ ok: false, motivo: 'origen-no-verificable' });
  });
  it('rechaza basura', () => {
    expect(validarOrigen('cualquier cosa rara', ALLOW)).toEqual({ ok: false, motivo: 'formato-no-soportado' });
  });
});
