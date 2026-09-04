import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Implementación del protocolo de eventos:
// https://claude.ai/code/artifact/79d683a8-9b63-4f8f-8712-62ea8b6424bc
//
// Reglas del protocolo, aplicadas acá:
// - El socket NUNCA recibe comandos de negocio, solo une/saca clientes de
//   rooms. Las acciones reales siempre entran por REST (ver los módulos de
//   recurso); son ellos los que llaman a los métodos emitX() de este
//   gateway después de persistir el cambio.
// - Rooms por carrera (`carrera:{id}`) + una room global `tasa`.
// - Los payloads son deltas, nunca el tablero completo — el cliente se
//   hidrata por REST (GET /carreras/:id/pizarra) antes de suscribirse.

function roomCarrera(carreraId: number) {
  return `carrera:${carreraId}`;
}

const ROOM_TASA = 'tasa';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } }) // ajustar origin real al pasar a multi-PC (ver stack técnico)
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  // --- Suscripción de rooms (lo único que el cliente le "pide" al socket) ---

  @SubscribeMessage('suscribirCarrera')
  onSuscribirCarrera(@MessageBody() carreraId: number, @ConnectedSocket() client: Socket) {
    client.join(roomCarrera(carreraId));
    client.join(ROOM_TASA);
  }

  @SubscribeMessage('desuscribirCarrera')
  onDesuscribirCarrera(@MessageBody() carreraId: number, @ConnectedSocket() client: Socket) {
    client.leave(roomCarrera(carreraId));
  }

  // --- Emisores, uno por evento del protocolo ---
  // Cada módulo de recurso llama a estos después de escribir en la base,
  // nunca antes (el evento siempre refleja un cambio ya persistido).

  jugadaActualizada(carreraId: number, payload: {
    tablaId: number; ejemplarId: number; numero: number;
    clienteNombre: string; monto: string; moneda: string; actualizadaEn: Date;
  }) {
    this.server.to(roomCarrera(carreraId)).emit('jugada:actualizada', payload);
  }

  jugadaAnulada(carreraId: number, payload: { tablaId: number; ejemplarId: number; jugadaId: number }) {
    this.server.to(roomCarrera(carreraId)).emit('jugada:anulada', payload);
  }

  ejemplarRetirado(carreraId: number, payload: { ejemplarId: number; numero: number; retiradoEn: Date }) {
    this.server.to(roomCarrera(carreraId)).emit('ejemplar:retirado', { carreraId, ...payload });
  }

  ejemplarRepuesto(carreraId: number, payload: { ejemplarId: number; numero: number }) {
    this.server.to(roomCarrera(carreraId)).emit('ejemplar:repuesto', { carreraId, ...payload });
  }

  tablaPoteActualizado(carreraId: number, payload: { tablaId: number; poteCasa: string; aRepartirEstimado: string }) {
    this.server.to(roomCarrera(carreraId)).emit('tabla:pote_actualizado', payload);
  }

  tablaCerrada(carreraId: number, payload: { tablaId: number; cerradaEn: Date }) {
    this.server.to(roomCarrera(carreraId)).emit('tabla:cerrada', payload);
  }

  carreraGanadorAnunciado(carreraId: number, payload: {
    ganadores: { ejemplarId: number; numero: number }[];
    pagos: {
      tablaId: number; etiqueta: string; ejemplarId: number;
      clienteId: number | null; esCasa: boolean;
      clienteNombre: string; montoPago: string;
    }[];
  }) {
    this.server.to(roomCarrera(carreraId)).emit('carrera:ganador_anunciado', { carreraId, ...payload });
  }

  carreraEstadoCambiado(carreraId: number, payload: { estado: string; cambiadoEn: Date }) {
    this.server.to(roomCarrera(carreraId)).emit('carrera:estado_cambiado', { carreraId, ...payload });
  }

  // Va a TODOS los clientes, no a la room de una carrera: justamente
  // anuncia de qué carrera hay que empezar a hablar, así que la ventana de
  // la pizarra todavía no está suscrita a la nueva.
  pizarraCarreraCambiada(payload: { carreraId: number | null }) {
    this.server.emit('pizarra:carrera_cambiada', payload);
  }

  // Como el de la pizarra, va a TODOS los clientes: cambia con qué jornada
  // se está trabajando, así que todas las ventanas tienen que revalidar sus
  // carreras y su resumen, estén en la room que estén.
  jornadaActivaCambiada(payload: { jornadaId: number | null }) {
    this.server.emit('jornada:activa_cambiada', payload);
  }

  tasaActualizada(payload: { valorBsPorUsd: string; vigenteDesde: Date }) {
    this.server.to(ROOM_TASA).emit('tasa:actualizada', payload);
  }

  // `clienteId` y `apodo` son excluyentes: el cobro es de un cliente
  // registrado o de un postor que sólo dejó su apodo.
  cobroMarcadoPagado(
    carreraId: number,
    payload: {
      clienteId: number | null;
      apodo: string | null;
      cobroId: number;
      tipo: string;
      pagadoEn: Date;
    },
  ) {
    this.server.to(roomCarrera(carreraId)).emit('cobro:marcado_pagado', { carreraId, ...payload });
  }

  /**
   * Cambió el material promocional del pie de la pizarra.
   *
   * Va a todas las ventanas y no a una room de carrera: el televisor tiene
   * que reaccionar sin importar qué carrera esté mostrando, y quien sube la
   * imagen está en otra máquina o en el otro monitor, sin forma de avisarle
   * a la pizarra que refresque.
   *
   * Sin payload a propósito: las imágenes son pocas y el cliente rehace el
   * GET. Mandar la lista por el socket obligaría a mantener dos formas de
   * armar lo mismo.
   */
  promocionesCambiaron() {
    this.server.emit('promociones:cambiaron');
  }
}
