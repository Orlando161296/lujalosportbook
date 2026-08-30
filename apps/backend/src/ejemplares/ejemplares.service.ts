import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CrearEjemplarDto, RenombrarEjemplarDto } from './dto';
import { enMayusculas } from '../common/texto';

@Injectable()
export class EjemplaresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  listar(carreraId: number) {
    return this.prisma.ejemplar.findMany({ where: { carreraId }, orderBy: { numero: 'asc' } });
  }

  // El número identifica al ejemplar dentro de la carrera y es único por
  // (carrera, número) en el modelo. Sin este chequeo, repetirlo hacía que
  // Prisma tirara P2002 y Nest lo devolviera como un 500 con el stack
  // entero: el operador veía un error ilegible en vez de enterarse de que
  // ese número ya estaba usado.
  async crear(carreraId: number, dto: CrearEjemplarDto) {
    const carrera = await this.prisma.carrera.findUnique({ where: { id: carreraId } });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    const repetido = await this.prisma.ejemplar.findUnique({
      where: { carreraId_numero: { carreraId, numero: dto.numero } },
    });
    if (repetido) {
      throw new BadRequestException(
        `El número ${dto.numero} ya lo tiene ${repetido.nombre} en esta carrera.`,
      );
    }

    return this.prisma.ejemplar.create({
      data: { carreraId, numero: dto.numero, nombre: enMayusculas(dto.nombre) },
    });
  }

  /**
   * Corregir el nombre de un ejemplar.
   *
   * Se permite siempre, incluso con la carrera cerrada: es el mismo caballo
   * y arreglar un tipeo no mueve un peso. Sin esto, un nombre mal escrito
   * quedaba impreso en los tickets y en el historial para siempre, porque
   * la única salida era borrar el ejemplar y con él sus jugadas.
   */
  async renombrar(ejemplarId: number, dto: RenombrarEjemplarDto) {
    const ejemplar = await this.prisma.ejemplar.findUnique({ where: { id: ejemplarId } });
    if (!ejemplar) throw new NotFoundException('Ejemplar no encontrado');

    const nombre = enMayusculas(dto.nombre);
    if (!nombre) throw new BadRequestException('El nombre no puede quedar vacío');
    if (nombre === ejemplar.nombre) return ejemplar;

    const actualizado = await this.prisma.ejemplar.update({
      where: { id: ejemplarId },
      data: { nombre },
    });

    // La pizarra muestra el nombre: si no se avisa, el TV sigue con el
    // viejo hasta que alguien recargue.
    this.events.ejemplarRepuesto(ejemplar.carreraId, {
      ejemplarId,
      numero: ejemplar.numero,
    });

    return actualizado;
  }

  // Retiro → reembolso automático, sin reimpresión (ver modelo de datos):
  // anula en cascada todas las jugadas activas de este ejemplar en
  // cualquier tabla, y genera un Cobro tipo 'reembolso' para las que ya
  // se habían cobrado. Esto saca esas jugadas del SUM que calcula "A
  // Repartir", así que el pago del ganador de cada tabla queda más chico
  // automáticamente la próxima vez que se calcule.
  async retirar(ejemplarId: number, usuarioId: number) {
    const ejemplar = await this.prisma.ejemplar.findUnique({ where: { id: ejemplarId } });
    if (!ejemplar) throw new NotFoundException('Ejemplar no encontrado');
    if (ejemplar.estado === 'retirado') throw new BadRequestException('Ese ejemplar ya está retirado');

    const jugadasActivas = await this.prisma.jugada.findMany({
      where: { ejemplarId, estado: 'activa' },
      include: { cobrosJugada: { include: { cobro: true } } },
    });

    const ahora = new Date();

    for (const jugada of jugadasActivas) {
      await this.prisma.jugada.update({
        where: { id: jugada.id },
        data: {
          estado: 'anulada',
          anuladaEn: ahora,
          anuladaPorId: usuarioId,
          anuladaPorRetiro: true,
        },
      });

      const yaSeHabiaCobrado = jugada.cobrosJugada.some(
        (cj) => cj.cobro.tipo === 'cobro_apuesta' && cj.cobro.pagado,
      );
      // Una jugada de la casa no se le cobró a nadie, así que tampoco hay
      // nada que reembolsar cuando el caballo se retira. Al postor por apodo
      // sí se le cobró, así que le corresponde su devolución igual que a un
      // cliente registrado.
      const hayAQuienDevolverle = jugada.clienteId !== null || jugada.apodo !== null;
      if (yaSeHabiaCobrado && hayAQuienDevolverle) {
        await this.prisma.cobro.create({
          data: {
            clienteId: jugada.clienteId,
            apodo: jugada.apodo,
            carreraId: ejemplar.carreraId,
            tipo: 'reembolso',
            monto: jugada.monto,
            moneda: jugada.moneda,
            pagado: false, // pendiente de devolver el efectivo en taquilla
            jugadasCubiertas: {
              create: [{ jugadaId: jugada.id, montoCubierto: jugada.monto }],
            },
          },
        });
      }

      const tabla = await this.prisma.tabla.findUniqueOrThrow({ where: { id: jugada.tablaId } });
      this.events.jugadaAnulada(tabla.carreraId, {
        tablaId: jugada.tablaId,
        ejemplarId,
        jugadaId: jugada.id,
      });
    }

    const actualizado = await this.prisma.ejemplar.update({
      where: { id: ejemplarId },
      data: { estado: 'retirado', retiradoEn: ahora, retiradoPorId: usuarioId },
    });

    this.events.ejemplarRetirado(ejemplar.carreraId, {
      ejemplarId,
      numero: ejemplar.numero,
      retiradoEn: ahora,
    });

    return actualizado;
  }

  // Reponer deshace el retiro entero, no sólo la marca del ejemplar. Antes
  // devolvía el caballo al campo pero dejaba sus jugadas anuladas y el
  // reembolso vivo: el operador que se equivocaba de número no tenía forma
  // de volver atrás desde la app, y en los papeles quedaba plata a devolver
  // por una carrera que igual se corrió.
  async reponer(ejemplarId: number) {
    const ejemplar = await this.prisma.ejemplar.findUnique({ where: { id: ejemplarId } });
    if (!ejemplar) throw new NotFoundException('Ejemplar no encontrado');
    if (ejemplar.estado !== 'retirado') {
      throw new BadRequestException('Ese ejemplar no está retirado');
    }

    // Sólo las que anuló ESTE retiro. Las que el operador anuló a mano son
    // una corrección suya y tienen que seguir anuladas.
    const anuladasPorRetiro = await this.prisma.jugada.findMany({
      where: { ejemplarId, estado: 'anulada', anuladaPorRetiro: true },
      include: { cobrosJugada: { include: { cobro: true } } },
    });

    const reembolsos = anuladasPorRetiro
      .flatMap((j) => j.cobrosJugada.map((cj) => cj.cobro))
      .filter((c) => c.tipo === 'reembolso');

    // Si ya se devolvió el efectivo, reponer el caballo no lo trae de vuelta
    // del bolsillo del cliente. Deshacerlo acá dejaría la caja descuadrada
    // sin que nadie se entere, así que se frena y lo resuelve una persona.
    const yaDevuelto = reembolsos.find((c) => c.pagado);
    if (yaDevuelto) {
      throw new BadRequestException(
        'No se puede reponer: ya se devolvió el dinero de las jugadas de este ' +
          'ejemplar. Volvé a cargarlas a mano si el caballo corre igual.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const idsReembolso = reembolsos.map((c) => c.id);
      if (idsReembolso.length > 0) {
        // El reembolso nunca se pagó, así que no deja rastro contable: se
        // borra en vez de anularse, igual que si el retiro no hubiera pasado.
        await tx.cobroJugada.deleteMany({ where: { cobroId: { in: idsReembolso } } });
        await tx.cobro.deleteMany({ where: { id: { in: idsReembolso } } });
      }

      await tx.jugada.updateMany({
        where: { id: { in: anuladasPorRetiro.map((j) => j.id) } },
        data: { estado: 'activa', anuladaEn: null, anuladaPorId: null, anuladaPorRetiro: false },
      });

      await tx.ejemplar.update({
        where: { id: ejemplarId },
        data: { estado: 'activo', retiradoEn: null, retiradoPorId: null },
      });
    });

    // Cada jugada revivida vuelve al tablero y a la pizarra por su cuenta:
    // el retiro las había sacado una por una con `jugada:anulada`.
    for (const jugada of anuladasPorRetiro) {
      const tabla = await this.prisma.tabla.findUniqueOrThrow({ where: { id: jugada.tablaId } });
      const cliente = jugada.clienteId
        ? await this.prisma.cliente.findUnique({ where: { id: jugada.clienteId } })
        : null;
      this.events.jugadaActualizada(tabla.carreraId, {
        tablaId: jugada.tablaId,
        ejemplarId,
        numero: ejemplar.numero,
        clienteNombre: jugada.esCasa
          ? 'LA CASA'
          : (cliente ? (cliente.nombrePizarra ?? cliente.nombre) : jugada.apodo!),
        monto: jugada.monto.toString(),
        moneda: jugada.moneda,
        actualizadaEn: new Date(),
      });
    }

    this.events.ejemplarRepuesto(ejemplar.carreraId, { ejemplarId, numero: ejemplar.numero });
    return this.prisma.ejemplar.findUniqueOrThrow({ where: { id: ejemplarId } });
  }
}
