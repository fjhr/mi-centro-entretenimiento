import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ProveedorConfig } from './context/ConfigContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('raiz')).render(
  <React.StrictMode>
    <ProveedorConfig>
      <App />
    </ProveedorConfig>
  </React.StrictMode>,
);
