import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaquillaApp } from './windows/Taquilla/TaquillaApp';
import { PizarraApp } from './windows/Pizarra/PizarraApp';
import { Avisos } from './ui/avisos';
import './index.css';

// La misma app sirve a las dos ventanas de Tauri (mismo index.html, ver
// tauri.conf.json) — cuál se renderiza depende del label de la ventana, no
// de una URL ni de una build distinta.
//
// Fuera de Tauri (npm run dev en el navegador, para iterar la UI sin
// recompilar Rust) se usa ?ventana=pizarra, que además permite abrir las dos
// interfaces en dos pestañas y verlas hablar por socket.
function ventanaActual(): 'taquilla' | 'pizarra' {
  const porUrl = new URLSearchParams(location.search).get('ventana');
  if (porUrl === 'pizarra' || porUrl === 'taquilla') return porUrl;

  const interno = (window as { __TAURI_INTERNALS__?: { metadata?: { currentWindow?: { label?: string } } } })
    .__TAURI_INTERNALS__;
  return interno?.metadata?.currentWindow?.label === 'pizarra' ? 'pizarra' : 'taquilla';
}

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      // Todo corre en localhost contra un sidecar: reintentar una vez alcanza,
      // y un error tiene que verse rápido en vez de quedar girando.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const Raiz = ventanaActual() === 'pizarra' ? PizarraApp : TaquillaApp;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={cliente}>
      <Raiz />
      <Avisos />
    </QueryClientProvider>
  </React.StrictMode>,
);
