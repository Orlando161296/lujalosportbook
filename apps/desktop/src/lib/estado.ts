import { create } from 'zustand';
import type { Taquilla, Usuario } from './tipos';

// Navegación de dos niveles, tal como quedó en el diseño:
//   nivel 1 (rail)     = el juego, o lo transversal a todos
//   nivel 2 (pestañas) = las pantallas de ese juego
// No usamos router de URL: la app es de escritorio, no hay barra de
// direcciones ni historial que respetar, y así el estado vive en un solo sitio.

export type Juego = 'remate' | 'ganadores' | 'tablasFijas' | 'cincoSeis';
export type Seccion = Juego | 'resumen' | 'config';
export type PantallaRemate = 'tablero' | 'ejemplares' | 'cobros' | 'historial';
export type PantallaConfig =
  | 'tasa' | 'usuarios' | 'hipodromos' | 'jornadas' | 'clientes' | 'taquillas'
  | 'impresora';

interface EstadoNavegacion {
  seccion: Seccion;
  pantallaRemate: PantallaRemate;
  pantallaConfig: PantallaConfig;
  /** Carrera que se está rematando ahora mismo. null = ninguna elegida. */
  carreraId: number | null;
  irA: (seccion: Seccion) => void;
  irARemate: (pantalla: PantallaRemate) => void;
  irAConfig: (pantalla: PantallaConfig) => void;
  elegirCarrera: (id: number | null) => void;
}

export const useNavegacion = create<EstadoNavegacion>((set) => ({
  seccion: 'remate',
  pantallaRemate: 'tablero',
  pantallaConfig: 'tasa',
  carreraId: null,
  irA: (seccion) => set({ seccion }),
  irARemate: (pantallaRemate) => set({ seccion: 'remate', pantallaRemate }),
  irAConfig: (pantallaConfig) => set({ seccion: 'config', pantallaConfig }),
  elegirCarrera: (carreraId) => set({ carreraId }),
}));

interface EstadoSesion {
  usuario: Usuario | null;
  taquilla: Taquilla | null;
  entrar: (usuario: Usuario, taquilla: Taquilla | null) => void;
  salir: () => void;
}

export const useSesion = create<EstadoSesion>((set) => ({
  usuario: null,
  taquilla: null,
  entrar: (usuario, taquilla) => set({ usuario, taquilla }),
  salir: () => set({ usuario: null, taquilla: null }),
}));

/** Permisos: se consulta acá y no en cada pantalla, para no repetir la regla. */
export function puede(usuario: Usuario | null, permiso: keyof Usuario): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'admin') return true;
  return usuario[permiso] === true;
}
