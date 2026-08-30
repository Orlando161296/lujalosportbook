import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { TablasService } from '../tablas/tablas.service';
import { CrearCarreraDto, CambiarEstadoCarreraDto, RegistrarResultadoDto } from './dto';

@Injectable()
export class CarrerasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly tablas: TablasService,
  ) {}

  listar(fecha?: string) {
    return this.prisma.carrera.findMany({
      where: fecha ? { fecha: new Date(fecha) } : {},
      include: { hipodromo: true },
      orderBy: [{ fecha: 'asc' }, { numero: 'asc' }],
    });
  }

  async crear(dto: CrearCarreraDto, usuarioId: number) {
    return this.prisma.carrera.create({
      data: {
        hipodromoId: dto.hipodromoId,
        fecha: new Date(dto.fecha),
        numero: dto.numero,
        nombre: dto.nombre,
        creadoPorId: usuarioId,
      },
    });
  }

  async cambiarEstado(id: number, dto: CambiarEstadoCarreraDto) {
    const carrera = await this.prisma.carrera.update({
      where: { id },
      data: { estado: dto.estado },
    });
    this.events.carreraEstadoCambiado(id, { estado: dto.estado, cambiadoEn: new Date() });
    return carrera;
  }

  // El snapshot completo que usa cualquier ventana para hidratarse al
  // conectar o reconectar, ANTES de suscribirse a la room del socket.
  // Ver protocolo de eventos: "el socket nunca es la fuente inicial de verdad".
  async pizarra(id: number) {
    const carrera = await this.prisma.carrera.findUnique({
      where: { id },
      include: {
        hipodromo: true,
        ejemplares: { orderBy: { numero: 'asc' } },
        tablas: {
          orderBy: { etiqueta: 'asc' },
          include: { jugadas: { where: { estado: 'activa' }, include: { cliente: true } } },
        },
        ganadores: { include: { ejemplar: true } },
      },
    });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    const tasaVigente = await this.prisma.tasaCambio.findFirst({
      where: { vigenteDesde: { lte: new Date() } },
      orderBy: { vigenteDesde: 'desc' },
    });

    return { ...carrera, tasaVigente };
  }

  // Registra el resultado UNA vez para la carrera (comparte las 3 tablas) y
  // calcula el pago de cada tabla — ver "por qué carrera:ganador_anunciado
  // lleva pagos como lista" en el protocolo de eventos.
  async registrarResultado(carreraId: number, dto: RegistrarResultadoDto) {
    const carrera = await this.prisma.carrera.findUnique({ where: { id: carreraId } });
    if (!carrera) throw new NotFoundException('Carrera no encontrada');

    // Validar ANTES de escribir: si algún ejemplar no pertenece a esta
    // carrera no debe quedar ningún ganador a medio registrar.
    const ejemplaresGanadores = await this.prisma.ejemplar.findMany({
      where: { id: { in: dto.ejemplaresGanadores }, carreraId },
    });
    if (ejemplaresGanadores.length !== dto.ejemplaresGanadores.length) {
      throw new BadRequestException('Algún ejemplar ganador no existe en esta carrera');
    }

    // SQLite no soporta `skipDuplicates` en createMany (Prisma lo tipa como
    // `never` con este connector), así que se hace upsert sobre la PK
    // compuesta — mismo efecto idempotente si se reenvía el resultado.
    for (const ejemplarId of dto.ejemplaresGanadores) {
      await this.prisma.carreraGanador.upsert({
        where: { carreraId_ejemplarId: { carreraId, ejemplarId } },
        create: { carreraId, ejemplarId },
        update: {},
      });
    }

    const tablas = await this.prisma.tabla.findMany({ where: { carreraId } });
    const cantidadGanadores = dto.ejemplaresGanadores.length;
    // clienteId va nullable porque el ganador puede ser un caballo que nadie
    // pujó y se quedó la casa: ahí no hay a quién pagarle, pero el pago igual
    // tiene que aparecer para cuadrar el resumen del día ("Ganó la casa por
    // sus jugadas", wireframe 6c).
    const pagos: {
      tablaId: number; etiqueta: string; ejemplarId: number;
      clienteId: number | null; esCasa: boolean;
      clienteNombre: string; montoPago: string;
    }[] = [];

    for (const tabla of tablas) {
      const aRepartir = await this.tablas.calcularARepartir(tabla.id);
      const pagoPorEjemplar = aRepartir / cantidadGanadores;

      for (const ejemplarId of dto.ejemplaresGanadores) {
        const jugada = await this.prisma.jugada.findFirst({
          where: { tablaId: tabla.id, ejemplarId, estado: 'activa' },
          include: { cliente: true },
        });
        if (!jugada) continue; // nadie jugó ese número en esta tabla puntual

        pagos.push({
          tablaId: tabla.id,
          etiqueta: tabla.etiqueta,
          ejemplarId,
          clienteId: jugada.clienteId,
          esCasa: jugada.esCasa,
          // El apodo entra en la cadena: en el remate la mayoría de los
          // postores no está registrada, y sin él un ganador como «BARBA
          // NEGRA» salía anunciado como LA CASA — es decir, el sistema decía
          // que el premio se lo quedaba el local en vez de pagarlo.
          clienteNombre: jugada.esCasa
            ? 'LA CASA'
            : (jugada.cliente?.nombrePizarra ?? jugada.cliente?.nombre
               ?? jugada.apodo ?? 'LA CASA'),
          montoPago: pagoPorEjemplar.toFixed(2),
        });
      }
    }

    this.events.carreraGanadorAnunciado(carreraId, {
      ganadores: ejemplaresGanadores.map((e) => ({ ejemplarId: e.id, numero: e.numero })),
      pagos,
    });

    return { ganadores: ejemplaresGanadores, pagos };
  }
}
