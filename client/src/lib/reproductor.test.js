import { describe, it, expect } from 'vitest';
import { urlStream, urlSubtitulo, MOTIVOS } from './reproductor.js';

describe('helpers de reproductor', () => {
  it('construye la URL de streaming', () => {
    expect(urlStream('abc', 2)).toBe('/api/stream/torrent/abc/2');
  });
  it('codifica la URL del subtítulo', () => {
    expect(urlSubtitulo('https://x/y z.srt')).toBe('/api/stream/subtitulo?url=https%3A%2F%2Fx%2Fy%20z.srt');
  });
  it('traduce los motivos de rechazo al español', () => {
    expect(MOTIVOS['origen-no-verificable']).toMatch(/verific/i);
    expect(MOTIVOS['host-no-permitido']).toMatch(/permit/i);
  });
});
