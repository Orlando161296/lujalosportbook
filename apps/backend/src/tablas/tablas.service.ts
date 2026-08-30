import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CrearTablaDto, ActualizarPoteDto } from './dto';

@Injectable()
export class TablasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  listar(carreraId: number) {
    return this.prisma.tabla.findMany({ where: { carreraId }, orderBy: { etiqueta: 'asc' } });
  }

  // Sin cantidad fija — hoy son 3 (T1/T2/T3) pero el modelo no lo asume.
  crear(carreraId: number, dto: CrearTablaDto) {
    return this.prisma.tabla.create({ data: { carreraId, etiqueta: dto.etiqueta } });
  }

  // El pote se carga en vivo durante el remate, según lo que diga la casa —
  // no es un valor fijado de antemano (ver modelo de datos).
  async actualizarPote(tablaId: number, dto: ActualizarPoteDto) {
    const tabla = await this.prisma.tabla.update({
      where: { id: tablaId },
      data: { poteCasa: dto.poteCasa },
    });
    const aRepartir = await this.calcularARepartir(tablaId);
    this.events.tablaPoteActualizado(tabla.carreraId, {
      tablaId,
      poteCasa: dto.poteCasa.toString(),
      aRepartirEstimado: aRepartir.toString(),
    });
    return tabla;
  }

  async cerrar(tablaId: number, usuarioId: number) {
    const tabla = await this.prisma.tabla.findUnique({ where: { id: tablaId } });
    if (!tabla) throw new NotFoundException('Tabla no encontrada');
    if (tabla.estado === 'cerrada') throw new BadRequestException('Esa tabla ya está cerrada');

    const actualizada = await this.prisma.tabla.update({
      where: { id: tablaId },
      data: { estado: 'cerrada', cerradaEn: new Date(), cerradaPorId: usuarioId },
    });
    this.events.tablaCerrada(tabla.carreraId, { tablaId, cerradaEn: actualizada.cerradaEn! });

    // El estado de la carrera se deduce de sus tablas, no se maneja aparte:
    // cerrada la última, la carrera está cerrada. Antes nadie escribía ese
    // campo nunca, así que la pizarra y la píldora de la barra superior
    // seguían diciendo «planificada» con el remate ya terminado.
    const abiertas = await this.prisma.tabla.count({
      where: { carreraId: tabla.carreraId, estado: 'abierta' },
    });
    if (abiertas === 0) {
      await this.prisma.carrera.update({
        where: { id: tabla.carreraId },
        data: { estado: 'cerrada' },
      });
      this.events.carreraEstadoCambiado(tabla.carreraId, {
        estado: 'cerrada',
        cambiadoEn: new Date(),
      });
    }

    return actualizada;
  }

  // (SUM(jugada.monto WHERE estado='activa') + poteCasa) × (1 − comisionPct/100)
  // — ver modelo de datos. Las jugadas 'anulada' (retiro) no aportan.
  async calcularARepartir(tablaId: number): Promise<number> {
    const tabla = await this.prisma.tabla.findUniqueOrThrow({ where: { id: tablaId } });
    const jugadas = await this.prisma.jugada.findMany({ where: { tablaId, estado: 'activa' } });
    const totalApostado = jugadas.reduce((acc, j) => acc + Number(j.monto), 0);
    const pote = Number(tabla.poteCasa);
    const comision = Number(tabla.comisionPct) / 100;
    return (totalApostado + pote) * (1 - comision);
  }
}
