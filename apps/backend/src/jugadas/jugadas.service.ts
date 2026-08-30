import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { UpsertJugadaDto } from './dto';
import { normalizarApodo } from '../common/apodos';

// El mecanismo rápido de edición acordado con el usuario: NO hay estados de
// puja (puja_activa/superada/confirmada) — se descartaron explícitamente
// por confundir a los dueños del negocio. En su lugar, cada (tabla, ejemplar)
// tiene como máximo una fila 'activa', y "superar una puja" es EDITAR esa
// misma fila, no crear una nueva. Ver modelo de datos y contrato API.
@Injectable()
export class JugadasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async upsert(tablaId: number, ejemplarId: number, dto: UpsertJugadaDto, usuarioId: number) {
    const tabla = await this.prisma.tabla.findUnique({ where: { id: tablaId } });
    if (!tabla) throw new NotFoundException('Tabla no encontrada');
    if (tabla.estado !== 'abierta') {
      throw new BadRequestException('La tabla ya está cerrada, no admite más jugadas');
    }

    const ejemplar = await this.prisma.ejemplar.findUnique({ where: { id: ejemplarId } });
    if (!ejemplar) throw new NotFoundException('Ejemplar no encontrado');
    if (ejemplar.carreraId !== tabla.carreraId) {
      // Invariante del modelo: el ejemplar debe pertenecer a la misma carrera que la tabla.
      throw new BadRequestException('Ese ejemplar no pertenece a la carrera de esta tabla');
    }
    if (ejemplar.estado === 'retirado') {
      throw new BadRequestException('Ese ejemplar está retirado, no se puede jugar');
    }

    // Detrás de una jugada hay exactamente una de tres cosas: un cliente
    // registrado, un postor identificado sólo por su apodo, o la casa.
    // Registrar a alguien no puede ser condición para jugarle: en pleno
    // remate no hay tiempo, y el apodo ya es la referencia que usa el
    // rematador. Lo que sí no puede pasar es que vengan dos a la vez y no
    // se sepa a quién cobrarle.
    const esCasa = dto.esCasa === true;
    const apodo = normalizarApodo(dto.apodo);

    if (esCasa && (dto.clienteId != null || apodo != null)) {
      throw new BadRequestException('Una jugada de la casa no lleva postor');
    }
    if (!esCasa && dto.clienteId != null && apodo != null) {
      throw new BadRequestException(
        'Elegí una sola cosa: el cliente registrado o el apodo, no las dos',
      );
    }
    if (!esCasa && dto.clienteId == null && apodo == null) {
      throw new BadRequestException('Falta el postor de la jugada');
    }

    const cliente =
      dto.clienteId != null
        ? await this.prisma.cliente.findUnique({ where: { id: dto.clienteId } })
        : null;
    if (dto.clienteId != null && !cliente) throw new NotFoundException('Cliente no encontrado');

    const existente = await this.prisma.jugada.findFirst({
      where: { tablaId, ejemplarId, estado: 'activa' },
    });

    const comun = {
      clienteId: cliente?.id ?? null,
      apodo,
      esCasa,
      monto: dto.monto,
      moneda: dto.moneda,
      taquillaId: dto.taquillaId ?? null,
    };

    const jugada = existente
      ? await this.prisma.jugada.update({
          where: { id: existente.id },
          data: { ...comun, actualizadaEn: new Date(), actualizadaPorId: usuarioId },
        })
      : await this.prisma.jugada.create({
          data: { ...comun, tablaId, ejemplarId, estado: 'activa', registradaPorId: usuarioId },
        });

    // La primera puja es lo que pone la carrera en remate. Igual que el
    // cierre, el estado se deduce del hecho y no de que alguien se acuerde
    // de cambiarlo a mano.
    const carrera = await this.prisma.carrera.findUniqueOrThrow({
      where: { id: tabla.carreraId },
    });
    if (carrera.estado === 'planificada') {
      await this.prisma.carrera.update({
        where: { id: carrera.id },
        data: { estado: 'abierta' },
      });
      this.events.carreraEstadoCambiado(carrera.id, {
        estado: 'abierta',
        cambiadoEn: new Date(),
      });
    }

    this.events.jugadaActualizada(tabla.carreraId, {
      tablaId,
      ejemplarId,
      numero: ejemplar.numero,
      // La pizarra muestra el nombre corto, que es el que entra en el TV.
      // Para el postor sin registrar ese nombre es su apodo, que ya viene
      // normalizado en mayúsculas justamente para el TV.
      clienteNombre: esCasa
        ? 'LA CASA'
        : (cliente ? (cliente.nombrePizarra ?? cliente.nombre) : apodo!),
      monto: dto.monto.toString(),
      moneda: dto.moneda,
      actualizadaEn: jugada.actualizadaEn ?? jugada.registradaEn,
    });

    return jugada;
  }

  // Anulación manual — corrección de un error de carga. Distinta del retiro
  // de ejemplar, que anula en cascada desde EjemplaresService.
  async anularManual(tablaId: number, ejemplarId: number, usuarioId: number) {
    const jugada = await this.prisma.jugada.findFirst({
      where: { tablaId, ejemplarId, estado: 'activa' },
    });
    if (!jugada) throw new NotFoundException('No hay jugada activa para ese número en esa tabla');

    const tabla = await this.prisma.tabla.findUniqueOrThrow({ where: { id: tablaId } });

    await this.prisma.jugada.update({
      where: { id: jugada.id },
      data: { estado: 'anulada', anuladaEn: new Date(), anuladaPorId: usuarioId },
    });

    this.events.jugadaAnulada(tabla.carreraId, { tablaId, ejemplarId, jugadaId: jugada.id });
  }

  async historial(carreraId?: number, clienteId?: number) {
    return this.prisma.jugada.findMany({
      where: { ...(carreraId ? { tabla: { carreraId } } : {}), ...(clienteId ? { clienteId } : {}) },
      include: { ejemplar: true, cliente: true, tabla: true },
      orderBy: { registradaEn: 'desc' },
    });
  }
}
