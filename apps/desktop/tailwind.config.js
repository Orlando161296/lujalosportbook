/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidad visual del centro hípico. Los nombres son los que usa el
        // dueño al hablar del sistema, no los genéricos de Tailwind.
        negro: '#0B0B0D',
        carbon: '#1C1C22',
        tinta: '#16161A',
        grafito: '#2A2A31',
        humo: '#3A3A44',
        gris: { DEFAULT: '#8A8794', claro: '#B9B5C0' },
        amarillo: '#FFD22E',
        naranja: '#F58220',
        rojo: '#E01B22',
        magenta: '#C41E6B',
        verde: '#2F7D3A',
        hueso: '#F5F2EC',
        borde: { DEFAULT: '#E2DDD3', fuerte: '#CFC8BA' },
        // Paleta afinada de la pizarra pública (Hi-Fi aprobado por los dueños)
        pizarra: {
          campo: '#cf4bb8',
          marco: '#8f2f7c',
          marcoOsc: '#6b1f5c',
          amarillo: '#fbe96b',
          crema: '#fffdf0',
          durazno: '#f7cba4',
          oliva: '#7a5b0a',
          rosa: '#f0c8e6',
        },
      },
      fontFamily: {
        display: ['Archivo Black', 'system-ui', 'sans-serif'],
        ui: ['Barlow Semi Condensed', 'system-ui', 'sans-serif'],
        cond: ['Barlow Condensed', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
