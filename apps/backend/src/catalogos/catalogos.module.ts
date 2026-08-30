import {
  Body, ConflictException, Controller, Get, Module, NotFoundException,
  Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { sinClave } from '../common/sin-clave';
import { diaUtc } from '../common/fechas';
import { EventsModule } from '../events/events.module';
import { EventsGateway } from '../events/events.gateway';

/*
 * Catálogos que sostienen las pantallas de Configuración y el login. Van
 * juntos en un módulo porque son CRUD delgados sin regla de negocio propia:
 * separarlos en cuatro carpetas sería más ceremonia que código.
 */

class CrearTaquillaDto {
  @IsString() @MinLength(1) nombre: string;
}
class EditarTaquillaDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsBoolean() activa?: boolean;
}

@Controller('taquillas')
export class TaquillasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.taquilla.findMany({ orderBy: { nombre: 'asc' } });
  }

  @Post()
  crear(@Body() dto: CrearTaquillaDto) {
    return this.prisma.taquilla.create({ data: { nombre: dto.nombre } });
  }

  @Patch(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarTaquillaDto) {
    return this.prisma.taquilla.update({ where: { id }, data: dto });
  }
}

class CrearUsuarioDto {
  @IsString() @MinLength(1) nombre: string;
  @IsString() @MinLength(1) usuario: string;
  @IsString() @MinLength(1) password: string;
  @IsString() rol: string;
  @IsOptional() @IsInt() taquillaId?: number;
  @IsOptional() @IsBoolean() puedeAnularJugadasPropias?: boolean;
  @IsOptional() @IsBoolean() puedeAnularJugadasDeOtros?: boolean;
  @IsOptional() @IsBoolean() puedeCambiarTasa?: boolean;
  @IsOptional() @IsBoolean() puedeCerrarCarrera?: boolean;
  @IsOptional() @IsBoolean() puedeVerResumen?: boolean;
}

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar() {
    const usuarios = await this.prisma.usuario.findMany({
      include: { taquilla: true },
      orderBy: { nombre: 'asc' },
    });
    return usuarios.map(sinClave);
  }

  @Post()
  crear(@Body() dto: CrearUsuarioDto) {
    const { password, ...resto } = dto;
    // TODO: hashear con bcrypt cuando se implemente la auth definitiva.
    return this.prisma.usuario
      .create({ data: { ...resto, passwordHash: password } })
      .then(sinClave);
  }

  @Patch(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: Record<string, unknown>) {
    delete dto.passwordHash;
    return this.prisma.usuario.update({ where: { id }, data: dto }).then(sinClave);
  }
}

@Controller('colores-numero')
export class ColoresController {
  constructor(private readonly prisma: PrismaService) {}

  // Referencia fija del hipismo: el público reconoce al ejemplar por el color
  // de su gualdrapa antes que por el número. Se siembra, no se configura.
  @Get()
  listar() {
    return this.prisma.colorNumero.findMany({ orderBy: { numero: 'asc' } });
  }
}

class CrearJornadaDto {
  @IsInt() hipodromoId: number;
  @IsString() fecha: string;
  @IsInt() @IsPositive() cantidadCarreras: number;
}

@Controller('jornadas')
export class JornadasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  @Get()
  listar() {
    return this.prisma.jornada.findMany({
      include: { hipodromo: true, carreras: { orderBy: { numero: 'asc' } } },
      orderBy: { fecha: 'desc' },
    });
  }

  /**
   * Con qué jornada se está trabajando ahora mismo.
   *
   * Es la que está `abierta`, y hay como mucho una: activar otra exige
   * cerrar la anterior a mano (ver `activar`). Antes esto no existía y la
   * taquilla elegía sola la primera carrera abierta que encontrara en TODA
   * la base — una jornada vieja sin cerrar se ganaba la selección y ponía al
   * operador a rematar en el día equivocado.
   *
   * Vive en la base y no en memoria —a diferencia de la carrera de la
   * pizarra— porque no es una preferencia de la sesión: es el día de trabajo
   * en curso, y tiene que seguir siendo el mismo después de reiniciar la
   * app en medio del remate.
   */
  @Get('activa')
  activa() {
    return this.prisma.jornada.findFirst({
      where: { estado: 'abierta' },
      include: { hipodromo: true, carreras: { orderBy: { numero: 'asc' } } },
    });
  }

  // Crear la jornada crea también sus carreras vacías: es lo que espera el
  // administrador cuando dice "hoy corren seis".
  @Post()
  async crear(@Body() dto: CrearJornadaDto) {
    const fecha = diaUtc(dto.fecha);

    // Se valida antes de escribir. Planificar varios días de corrido lleva a
    // repetir una fecha sin querer, y el choque contra el índice único salía
    // como «Internal server error»: el operador no tenía forma de saber que
    // el problema era la fecha ni que la jornada ya estaba creada.
    const hipodromo = await this.prisma.hipodromo.findUnique({
      where: { id: dto.hipodromoId },
    });
    if (!hipodromo) throw new NotFoundException('Ese hipódromo no existe');

    const repetida = await this.prisma.jornada.findFirst({
      where: { hipodromoId: dto.hipodromoId, fecha },
    });
    if (repetida) {
      const dia = dto.fecha.split('-').reverse().join('/');
      throw new ConflictException(
        `Ya hay una jornada de ${hipodromo.nombre} para el ${dia}. ` +
        'Buscala en la lista de abajo en vez de crearla de nuevo.',
      );
    }

    const jornada = await this.prisma.jornada.create({
      data: {
        hipodromoId: dto.hipodromoId,
        fecha,
        cantidadCarreras: dto.cantidadCarreras,
        estado: 'planificada',
      },
    });

    for (let numero = 1; numero <= dto.cantidadCarreras; numero++) {
      const carrera = await this.prisma.carrera.create({
        data: {
          hipodromoId: dto.hipodromoId,
          jornadaId: jornada.id,
          fecha,
          numero,
          estado: 'planificada',
          creadoPorId: 1, // TODO: usuario real cuando exista el guard de sesión
        },
      });
      // Las tablas se crean acá y no al abrir la carrera: la cantidad es del
      // hipódromo, y el operador no debería tener que armarlas a mano.
      for (let t = 1; t <= hipodromo.tablasPorCarrera; t++) {
        await this.prisma.tabla.create({
          data: { carreraId: carrera.id, etiqueta: `T${t}` },
        });
      }
    }

    return this.prisma.jornada.findUniqueOrThrow({
      where: { id: jornada.id },
      include: { hipodromo: true, carreras: true },
    });
  }

  /**
   * Pone esta jornada como la de trabajo.
   *
   * Exige que no haya otra abierta y no la cierra sola: cerrar una jornada
   * es el gesto con el que se da por terminado el día —el resumen queda
   * congelado ahí— y no puede ser el efecto secundario de haber elegido la
   * siguiente en un desplegable.
   */
  @Patch(':id/activar')
  async activar(@Param('id', ParseIntPipe) id: number) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id },
      include: { hipodromo: true },
    });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada.estado === 'cerrada') {
      throw new ConflictException('Esa jornada ya está cerrada: no se puede volver a abrir.');
    }

    const abierta = await this.prisma.jornada.findFirst({
      where: { estado: 'abierta', id: { not: id } },
      include: { hipodromo: true },
    });
    if (abierta) {
      // El mensaje nombra la jornada que estorba: el operador tiene que
      // saber cuál cerrar sin ponerse a buscarla en la lista.
      const dia = abierta.fecha.toISOString().slice(0, 10).split('-').reverse().join('/');
      throw new ConflictException(
        `Ya hay una jornada abierta: ${dia} · ${abierta.hipodromo?.nombre ?? ''}. ` +
        'Cerrala antes de activar esta.',
      );
    }

    const activada = await this.prisma.jornada.update({
      where: { id },
      data: { estado: 'abierta' },
      include: { hipodromo: true, carreras: { orderBy: { numero: 'asc' } } },
    });
    this.events.jornadaActivaCambiada({ jornadaId: activada.id });
    return activada;
  }

  @Patch(':id/cerrar')
  async cerrar(@Param('id', ParseIntPipe) id: number) {
    const cerrada = await this.prisma.jornada.update({
      where: { id },
      data: { estado: 'cerrada', cerradaEn: new Date() },
    });
    // Cerrar la jornada activa deja al sistema sin ninguna: la taquilla
    // tiene que enterarse para dejar de ofrecer sus carreras.
    this.events.jornadaActivaCambiada({ jornadaId: null });
    return cerrada;
  }
}

@Module({
  // EventsModule: activar o cerrar una jornada se anuncia por socket, para
  // que la taquilla y la pizarra no queden ofreciendo carreras de otra.
  imports: [PrismaModule, EventsModule],
  controllers: [TaquillasController, UsuariosController, ColoresController, JornadasController],
})
export class CatalogosModule {}
