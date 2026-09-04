import { io, Socket } from 'socket.io-client';

// Implementa las reglas del protocolo de eventos:
// https://claude.ai/code/artifact/79d683a8-9b63-4f8f-8712-62ea8b6424bc
//
// - El socket NUNCA es la fuente inicial de verdad: cada pantalla debe
//   llamar primero a `hidratarCarrera(carreraId)` (GET /carreras/:id/pizarra
//   por REST) y solo DESPUÉS suscribirse acá. Así una reconexión (ej. la TV
//   se reinicia a mitad de carrera) no se queda con estado viejo.
// - Los payloads que llegan son deltas — quien escuche cada evento decide
//   cómo mezclarlos con el estado ya hidratado.

const PUERTO_BACKEND = 3210; // mismo puerto fijo que usa el sidecar, ver apps/backend/src/main.ts

export const socket: Socket = io(`http://localhost:${PUERTO_BACKEND}`, {
  autoConnect: true,
  reconnection: true,
});

export function suscribirseACarrera(carreraId: number) {
  socket.emit('suscribirCarrera', carreraId);
}

export function desuscribirseDeCarrera(carreraId: number) {
  socket.emit('desuscribirCarrera', carreraId);
}

// Nombres de evento tal cual el protocolo — un solo lugar para no
// desalinearse por escribir el string a mano en cada componente.
export const EVENTOS = {
  jugadaActualizada: 'jugada:actualizada',
  jugadaAnulada: 'jugada:anulada',
  ejemplarRetirado: 'ejemplar:retirado',
  ejemplarRepuesto: 'ejemplar:repuesto',
  tablaPoteActualizado: 'tabla:pote_actualizado',
  tablaCerrada: 'tabla:cerrada',
  carreraGanadorAnunciado: 'carrera:ganador_anunciado',
  carreraEstadoCambiado: 'carrera:estado_cambiado',
  tasaActualizada: 'tasa:actualizada',
  cobroMarcadoPagado: 'cobro:marcado_pagado',
  pizarraCarreraCambiada: 'pizarra:carrera_cambiada',
  jornadaActivaCambiada: 'jornada:activa_cambiada',
  // Global, sin room: el televisor tiene que enterarse esté en la carrera
  // que esté, y quien sube el aviso está en la otra ventana o en otra PC.
  promocionesCambiaron: 'promociones:cambiaron',
} as const;
