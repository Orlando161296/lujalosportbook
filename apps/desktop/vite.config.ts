import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config estándar de Vite para Tauri: puerto fijo (coincide con
// tauri.conf.json → build.devUrl) y sin limpiar la pantalla para no
// perder los logs de Rust en `tauri dev`.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
