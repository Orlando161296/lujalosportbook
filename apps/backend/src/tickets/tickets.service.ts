import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImpresoraService } from '../impresion/impresora.service';
import { renderTicket, DatosTicket, JugadaTicket } from './ticket.render';

/** Lo que hace falta saber de una jugada para calcularle el cobro. */
interface JugadaCruda {
  tablaId: number;
  tabla: string;
  ejemplarId: number;
  numero: number;
  ejemplar: string;
  monto: number;
}

/**
 * El bolsillo de una carrera, resuelto de una sola pasada.
 *
 * Sirve para las dos cifras del ticket que dependen del estado del remate y
 * no del ticket en sí: la PROPORCIÓN (contra el total) y lo que cobra cada
 * jugada (contra su tabla).
 */
interface BolsilloCarrera {
  /** Por tabla: lo que se lleva el ganador de esa tabla, y si ya cerró. */
  porTabla: Map<number, { aRepartir: number; cerrada: boolean }>;
  /** Jugado activo + pote de todas las tablas: la base de PROPORCIÓN. */
  total: number;
  /** Ejemplares ganadores. Vacío mientras la carrera no tenga resultado. */
  ganadores: Set<number>;
}

/**
 * Emisión de tickets.
 *
 * El ticket nace cuando el cliente entrega la plata, no cuando se genera el
 * cobro: un cobro que nadie pagó no consume numeración, así que la serie
 * queda sin huecos y es auditable de corrido.
 *
 * La impresión sale por ImpresoraService, contra el ancho de papel que tenga
 * configurada la PC (58 mm hoy, 80 mm si el local cambia de máquina). Sin
 * impresora configurada el ticket se escribe en el log completo: el remate
 * puede seguir cobrando aunque la térmica esté desenchufada.
 */
@Injectable()
export class TicketsService {
  private readonly log = new Logger('Ticket');

  constructor(
    private readonly prisma: PrismaService,
    private readonly impresora: ImpresoraService,
  ) {}

  /**
   * Emite el ticket de un cobro ya pagado. Idempotente: si ese cobro ya
   * tiene ticket devuelve el mismo, porque reimprimir no puede gastar un
   * número nuevo ni duplicar el comprobante de una jugada.
   *
   * Devuelve el ticket con `errorImpresion` adentro. Que el papel no haya
   * salido NO es motivo para fallar la petición —la plata ya entró y el
   * número ya se gastó—, pero quien cobra tiene que enterarse en el acto:
   * el cliente está parado esperando su comprobante y nadie va a mirar el
   * log del servidor.
   */
  async emitirParaCobro(cobroId: number, usuarioId: number) {
    const cobro = await this.prisma.cobro.findUnique({
      where: { id: cobroId },
      include: {
        cliente: true,
        carrera: { include: { hipodromo: true } },
        jugadasCubiertas: {
          include: { jugada: { include: { ejemplar: true, tabla: true, ticket: true } } },
        },
      },
    });
    if (!cobro) throw new NotFoundException('Cobro no encontrado');

    // Un reembolso es plata que sale: no es el comprobante de una jugada y
    // no lleva ticket.
    if (cobro.tipo !== 'cobro_apuesta') return null;

    const yaEmitido = cobro.jugadasCubiertas.find((cj) => cj.jugada.ticketId != null);
    if (yaEmitido) {
      const previo = await this.prisma.ticket.findUniqueOrThrow({
        where: { id: yaEmitido.jugada.ticketId! },
      });
      // No se reimprime solo: el papel de este cobro ya salió una vez. Si
      // hace falta otra copia es un gesto explícito del operador.
      return { ...previo, errorImpresion: null };
    }

    const jugadas = cobro.jugadasCubiertas.map((cj) => cj.jugada);
    const taquillaId = jugadas.find((j) => j.taquillaId != null)?.taquillaId ?? null;

    const tasa = await this.prisma.tasaCambio.findFirst({
      where: { vigenteDesde: { lte: new Date() } },
      orderBy: { vigenteDesde: 'desc' },
    });

    // La numeración es correlativa única y no se reinicia nunca: un número
    // identifica un ticket sin necesidad de la fecha ni de la taquilla.
    // Va en transacción porque leer el máximo y escribir el siguiente tienen
    // que ser un solo paso.
    const ticket = await this.prisma.$transaction(async (tx) => {
      const ultimo = await tx.ticket.findFirst({ orderBy: { numero: 'desc' } });
      const numero = (ultimo?.numero ?? 0) + 1;

      const creado = await tx.ticket.create({
        data: {
          numero,
          carreraId: cobro.carreraId,
          clienteId: cobro.clienteId,
          apodo: cobro.apodo,
          taquillaId,
          totalBs: cobro.monto,
          moneda: cobro.moneda,
          tasaAplicada: tasa?.valorBsPorUsd ?? 0,
          emitidoPorId: usuarioId,
          impresoEn: new Date(),
        },
      });

      await tx.jugada.updateMany({
        where: { id: { in: jugadas.map((j) => j.id) } },
        data: { ticketId: creado.id },
      });

      return creado;
    });

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    const taquilla = taquillaId
      ? await this.prisma.taquilla.findUnique({ where: { id: taquillaId } })
      : null;

    // Se calcula DESPUÉS de escribir las jugadas: recién ahí el bolsillo de
    // la carrera incluye las de este ticket, que es contra lo que se mide
    // tanto la proporción como lo que cobraría cada una.
    const bolsillo = await this.bolsillo(cobro.carreraId);

    const datos: DatosTicket = {
      numero: ticket.numero,
      emitidoEn: ticket.impresoEn ?? ticket.creadoEn,
      hipodromo: cobro.carrera.hipodromo?.nombre ?? '—',
      carreraNumero: cobro.carrera.numero,
      cliente: cobro.cliente?.nombrePizarra ?? cobro.cliente?.nombre ?? cobro.apodo ?? '—',
      taquilla: taquilla?.nombre ?? null,
      operador: usuario?.nombre ?? '—',
      moneda: cobro.moneda,
      tasaAplicada: tasa ? Number(tasa.valorBsPorUsd) : null,
      totalBs: Number(cobro.monto),
      proporcionPct: this.proporcionPct(bolsillo, Number(cobro.monto)),
      jugadas: this.jugadasDelTicket(
        jugadas.map((j) => ({
          tablaId: j.tablaId,
          tabla: j.tabla.etiqueta,
          ejemplarId: j.ejemplarId,
          numero: j.ejemplar.numero,
          ejemplar: j.ejemplar.nombre,
          monto: Number(j.monto),
        })),
        bolsillo,
      ),
    };

    // El ticket ya está emitido y la plata ya se cobró: si la impresora está
    // sin papel o desenchufada eso NO puede tumbar la petición ni gastar el
    // número de nuevo. Sube como dato, no como excepción, para que la
    // taquilla lo muestre y el operador reimprima cuando lo resuelva.
    let errorImpresion: string | null = null;
    try {
      await this.impresora.imprimir(renderTicket(datos, this.impresora.columnas));
    } catch (causa) {
      errorImpresion = (causa as Error).message;
      this.log.error(`Ticket ${ticket.numero} emitido pero NO impreso: ${errorImpresion}`);
    }

    return { ...ticket, errorImpresion };
  }

  /**
   * El bolsillo de la carrera: lo que hay para repartir en cada tabla y el
   * total sobre el que se mide la proporción.
   *
   * `aRepartir` de una tabla es `(jugado activo + pote) × (1 − comisión)` —
   * la misma fórmula de TablasService.calcularARepartir, resuelta acá para
   * las tres tablas de una sola vez en lugar de una consulta por jugada.
   *
   * Sólo cuentan las jugadas activas: un ejemplar retirado saca las suyas
   * del reparto, y tanto la proporción como el pago se mueven con él.
   */
  private async bolsillo(carreraId: number): Promise<BolsilloCarrera> {
    const tablas = await this.prisma.tabla.findMany({
      where: { carreraId },
      select: {
        id: true,
        estado: true,
        poteCasa: true,
        comisionPct: true,
        jugadas: { where: { estado: 'activa' }, select: { monto: true } },
      },
    });
    const ganadores = await this.prisma.carreraGanador.findMany({
      where: { carreraId },
      select: { ejemplarId: true },
    });

    const porTabla = new Map<number, { aRepartir: number; cerrada: boolean }>();
    let total = 0;

    for (const t of tablas) {
      const jugado = t.jugadas.reduce((s, j) => s + Number(j.monto), 0);
      // El pote entra porque forma parte del bolsillo que se reparte: el
      // ganador se lleva `(tabla + pote) × 0,7`, así que dejarlo afuera daría
      // una proporción sobre una bolsa que no es la que se paga.
      const bolsa = jugado + Number(t.poteCasa);
      total += bolsa;
      porTabla.set(t.id, {
        aRepartir: bolsa * (1 - Number(t.comisionPct) / 100),
        cerrada: t.estado === 'cerrada',
      });
    }

    return { porTabla, total, ganadores: new Set(ganadores.map((g) => g.ejemplarId)) };
  }

  /** Qué fracción del bolsillo de la carrera representa este ticket. */
  private proporcionPct(bolsillo: BolsilloCarrera, monto: number): number | null {
    if (bolsillo.total <= 0) return null;
    return (monto / bolsillo.total) * 100;
  }

  /**
   * Le agrega a cada jugada lo que cobra si su ejemplar gana.
   *
   * El pago del remate NO es proporcional a lo que se pagó por la jugada: el
   * dueño del ejemplar ganador se lleva el bolsillo entero de SU tabla. Por
   * eso la cifra sale de la tabla y no del monto, y por eso dos jugadas del
   * mismo ticket no se suman mientras no haya resultado — son escenarios
   * excluyentes.
   *
   * Con empate el bolsillo se divide en partes iguales entre los ganadores,
   * igual que en CarrerasService.registrarResultado.
   */
  private jugadasDelTicket(
    jugadas: JugadaCruda[],
    bolsillo: BolsilloCarrera,
  ): JugadaTicket[] {
    const hayResultado = bolsillo.ganadores.size > 0;
    const divisor = hayResultado ? bolsillo.ganadores.size : 1;

    return jugadas.map((j) => {
      const tabla = bolsillo.porTabla.get(j.tablaId);
      return {
        tabla: j.tabla,
        numero: j.numero,
        ejemplar: j.ejemplar,
        monto: j.monto,
        cobraSiGana: tabla ? tabla.aRepartir / divisor : null,
        tablaCerrada: tabla?.cerrada ?? false,
        gano: hayResultado ? bolsillo.ganadores.has(j.ejemplarId) : null,
      };
    });
  }

  /** El texto tal cual va al papel, al ancho que tenga la impresora. */
  async previsualizar(ticketId: number): Promise<string> {
    return renderTicket(await this.datosDe(ticketId), this.impresora.columnas);
  }

  /**
   * Reimprime un ticket ya emitido — el botón «Imprimir» de la pantalla.
   *
   * No consume numeración ni toca la base: es el mismo comprobante saliendo
   * otra vez, para cuando la impresora estaba sin papel al cobrar o el
   * cliente perdió el suyo. A diferencia de la emisión, acá el error SÍ sube:
   * el operador apretó el botón y tiene que enterarse de que no salió.
   */
  async imprimir(ticketId: number): Promise<void> {
    const datos = await this.datosDe(ticketId);
    await this.impresora.imprimir(renderTicket(datos, this.impresora.columnas));
  }

  /** Reconstruye el ticket desde la base, listo para renderizar. */
  private async datosDe(ticketId: number): Promise<DatosTicket> {
    const t = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        cliente: true,
        taquilla: true,
        emitidoPor: true,
        carrera: { include: { hipodromo: true } },
        jugadas: { include: { ejemplar: true, tabla: true } },
      },
    });
    if (!t) throw new NotFoundException('Ticket no encontrado');

    const bolsillo = await this.bolsillo(t.carreraId);

    return {
      numero: t.numero,
      emitidoEn: t.impresoEn ?? t.creadoEn,
      hipodromo: t.carrera.hipodromo?.nombre ?? '—',
      carreraNumero: t.carrera.numero,
      cliente: t.cliente?.nombrePizarra ?? t.cliente?.nombre ?? t.apodo ?? '—',
      taquilla: t.taquilla?.nombre ?? null,
      operador: t.emitidoPor?.nombre ?? '—',
      moneda: t.moneda,
      tasaAplicada: t.tasaAplicada ? Number(t.tasaAplicada) : null,
      totalBs: Number(t.totalBs),
      proporcionPct: this.proporcionPct(bolsillo, Number(t.totalBs)),
      jugadas: this.jugadasDelTicket(
        t.jugadas.map((j) => ({
          tablaId: j.tablaId,
          tabla: j.tabla.etiqueta,
          ejemplarId: j.ejemplarId,
          numero: j.ejemplar.numero,
          ejemplar: j.ejemplar.nombre,
          monto: Number(j.monto),
        })),
        bolsillo,
      ),
    };
  }
}
