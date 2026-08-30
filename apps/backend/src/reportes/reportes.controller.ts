import { Controller, Get, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rangoDelDia } from '../common/fechas';

// Pantalla del resumen del día. Las tres cifras de arriba son tres bolsillos
// distintos y confundirlos es el error caro: lo que rematan los clientes, lo
// que juega la casa con los caballos que nadie pujó, y el pote que la casa
// agrega encima.
@Controller('reportes')
export class ReportesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * El cierre de una jornada.
   *
   * Es por JORNADA y no por fecha civil: dos hipódromos que corren el mismo
   * día son dos cierres distintos, y sumarlos en una sola pantalla daba
   * cifras que no cuadraban con ninguna de las dos cajas. Sin `jornadaId` se
   * resume la que esté abierta, que es con la que se está trabajando.
   *
   * `fecha` queda como escape para mirar un día completo sin importar la
   * jornada; es lo que había antes y sigue sirviendo para revisar hacia
   * atrás.
   */
  @Get('resumen-dia')
  async resumenDia(
    @Query('jornadaId') jornadaId?: string,
    @Query('fecha') fecha?: string,
  ) {
    const jornada = jornadaId
      ? await this.prisma.jornada.findUnique({ where: { id: Number(jornadaId) } })
      : fecha
        ? null
        : await this.prisma.jornada.findFirst({ where: { estado: 'abierta' } });

    // Sin jornada ni fecha no hay nada que resumir: devolver el día de hoy
    // "por si acaso" mostraría cifras de una jornada que el operador no
    // eligió, que es justo lo que esta pantalla tiene que dejar de hacer.
    if (!jornada && !fecha) return this.vacio();

    const { desde, hasta } = rangoDelDia(
      jornada ? jornada.fecha : (fecha as string),
    );

    const carreras = await this.prisma.carrera.findMany({
      where: jornada
        ? { jornadaId: jornada.id }
        : { fecha: { gte: desde, lt: hasta } },
      orderBy: { numero: 'asc' },
      include: {
        hipodromo: true,
        ganadores: true,
        tablas: {
          include: {
            jugadas: {
              where: { estado: 'activa' },
              include: { taquilla: true },
            },
          },
        },
      },
    });

    const porCarrera = carreras.map((c) => {
      const jugadas = c.tablas.flatMap((t) => t.jugadas);
      const rematado = jugadas
        .filter((j) => !j.esCasa)
        .reduce((s, j) => s + Number(j.monto), 0);
      const casa = jugadas
        .filter((j) => j.esCasa)
        .reduce((s, j) => s + Number(j.monto), 0);
      const pote = c.tablas.reduce((s, t) => s + Number(t.poteCasa), 0);

      // Lo que se paga: por tabla, (jugado + pote) menos la comisión.
      const aPagar = c.tablas.reduce((s, t) => {
        const jugadoTabla = t.jugadas.reduce((x, j) => x + Number(j.monto), 0);
        const bolsillo = jugadoTabla + Number(t.poteCasa);
        return s + Math.round(bolsillo * (1 - Number(t.comisionPct) / 100));
      }, 0);

      return {
        carreraId: c.id,
        numero: c.numero,
        estado: c.estado,
        corrida: c.ganadores.length > 0,
        rematado,
        casa,
        pote,
        aPagar: c.ganadores.length > 0 ? aPagar : null,
        retieneCasa: c.ganadores.length > 0 ? rematado + casa + pote - aPagar : null,
      };
    });

    // Desglose por taquilla: es lo que permite cuadrar la caja de cada puesto
    // al cierre, y por eso Jugada guarda desde dónde se registró.
    const porTaquilla = new Map<string, number>();
    for (const c of carreras) {
      for (const t of c.tablas) {
        for (const j of t.jugadas) {
          if (j.esCasa) continue;
          const nombre = j.taquilla?.nombre ?? 'Sin taquilla';
          porTaquilla.set(nombre, (porTaquilla.get(nombre) ?? 0) + Number(j.monto));
        }
      }
    }

    const tasaVigente = await this.prisma.tasaCambio.findFirst({
      where: { vigenteDesde: { lte: new Date() } },
      orderBy: { vigenteDesde: 'desc' },
    });

    const totalRematado = porCarrera.reduce((s, c) => s + c.rematado, 0);
    const totalCasa = porCarrera.reduce((s, c) => s + c.casa, 0);
    const totalPote = porCarrera.reduce((s, c) => s + c.pote, 0);

    return {
      fecha: desde.toISOString(),
      jornadaId: jornada?.id ?? null,
      hipodromo: carreras[0]?.hipodromo?.nombre ?? null,
      carreras: carreras.length,
      corridas: porCarrera.filter((c) => c.corrida).length,
      totalRematado,
      totalCasa,
      totalPote,
      totalMovido: totalRematado + totalCasa + totalPote,
      totalPagado: porCarrera.reduce((s, c) => s + (c.aPagar ?? 0), 0),
      retieneCasa: porCarrera.reduce((s, c) => s + (c.retieneCasa ?? 0), 0),
      tasaVigente,
      porCarrera,
      porTaquilla: [...porTaquilla.entries()]
        .map(([nombre, monto]) => ({ nombre, monto }))
        .sort((a, b) => b.monto - a.monto),
    };
  }

  /** Mismo shape, todo en cero: la pantalla lo detecta por `jornadaId`. */
  private async vacio() {
    return {
      fecha: null,
      jornadaId: null,
      hipodromo: null,
      carreras: 0,
      corridas: 0,
      totalRematado: 0,
      totalCasa: 0,
      totalPote: 0,
      totalMovido: 0,
      totalPagado: 0,
      retieneCasa: 0,
      tasaVigente: await this.prisma.tasaCambio.findFirst({
        where: { vigenteDesde: { lte: new Date() } },
        orderBy: { vigenteDesde: 'desc' },
      }),
      porCarrera: [] as never[],
      porTaquilla: [] as { nombre: string; monto: number }[],
    };
  }
}
