import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';

const Contexto = createContext({ config: null, recargar: async () => {} });

export function ProveedorConfig({ children }) {
  const [config, setConfig] = useState(null);
  const recargar = useCallback(async () => {
    try {
      setConfig(await api('/config'));
    } catch {
      setConfig({ region: 'MX', tieneTmdb: false, tieneOmdb: false, sinServidor: true });
    }
  }, []);
  useEffect(() => { recargar(); }, [recargar]);
  return <Contexto.Provider value={{ config, recargar }}>{children}</Contexto.Provider>;
}

export function useConfig() {
  return useContext(Contexto);
}
