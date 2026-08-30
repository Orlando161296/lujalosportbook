import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { TicketsService } from '../tickets/tickets.service';

// El "menú rápido de cobro": nadie paga número por número durante el
// remate en vivo — esto corre como evento masivo ~2 minutos antes de la
// carrera, agrupando por postor —cliente registrado o apodo— todas sus
// jugadas activas de las 3 tablas a la vez. Ver modelo de datos y
// protocolo de eventos.
@Injectable()
export class CobrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly tickets: TicketsService,
  ) {}

  async listar(carreraId: number) {
    const cobros = await this.prisma.cobro.findMany({
      where: { carreraId },
      include: {
        cliente: true,
        jugadasCubiertas: { include: { jugada: { include: { ticket: true } } } },
      },
      orderBy: { creadoEn: 'asc' },
    });

    // El ticket cuelga de las jugadas, no del cobro. Se sube al nivel del
    // cobro acá para que la pantalla pueda ofrecer la reimpresión sin tener
    // que recorrer las jugadas por su cuenta.
    return cobros.map((c) => {
      const ticket = c.jugadasCubiertas.find((cj) => cj.jugada.ticket)?.jugada.ticket ?? null;
      return { ...c, ticket };
    });
  }

  // Agrupa en un Cobro por postor todas las jugadas activas de esa carrera
  // que todavía no están cubiertas por ningún cobro_apuesta.
  async generar(carreraId: number) {
    const jugadas = await this.prisma.jugada.findMany({
      where: {
        estado: 'activa',
        tabla: { carreraId },
        cobrosJugada: { none: {} }, // sin ningún cobro todavía (ni apuesta ni reembolso)
        esCasa: false, // los caballos devueltos se los quedó la casa: no hay a quién cobrarle
      },
      include: { cliente: true },
    });

    // Se agrupa por postor, y un postor es o un cliente registrado o un
    // apodo. Van en el mismo Map con la clave prefijada para que un cliente
    // con id 7 y un apodo que fuera «7» no se pisen. El alcance del apodo es
    // esta carrera y nada más: `jugadas` ya viene filtrada por carreraId, así
    // que «BARBA NEGRA» de la carrera siguiente arma su propio cobro.
    type Postor = { clienteId: number | null; apodo: string | null };
    const porPostor = new Map<string, { postor: Postor; jugadas: typeof jugadas }>();

    for (const jugada of jugadas) {
      // `esCasa: false` ya las excluyó; lo que queda tiene cliente o apodo.
      // Si no tuviera ninguno sería una fila inconsistente: saltearla acá
      // significaría no cobrarle a nadie, así que mejor no inventar un cobro.
      const clave =
        jugada.clienteId !== null
          ? `cli:${jugada.clienteId}`
          : jugada.apodo !== null
            ? `apo:${jugada.apodo}`
            : null;
      if (clave === null) continue;

      const entrada = porPostor.get(clave) ?? {
        postor: { clienteId: jugada.clienteId, apodo: jugada.clienteId === null ? jugada.apodo : null },
        jugadas: [] as typeof jugadas,
      };
      entrada.jugadas.push(jugada);
      porPostor.set(clave, entrada);
    }

    const cobrosCreados = [];
    for (const { postor, jugadas: jugadasDelPostor } of porPostor.values()) {
      const monto = jugadasDelPostor.reduce((acc, j) => acc + Number(j.monto), 0);
      const moneda = jugadasDelPostor[0].moneda; // asume una sola moneda por cobro; ver supuesto abierto en el modelo
      const cobro = await this.prisma.cobro.create({
        data: {
          clienteId: postor.clienteId,
          apodo: postor.apodo,
          carreraId,
          tipo: 'cobro_apuesta',
          monto,
          moneda,
          jugadasCubiertas: {
            create: jugadasDelPostor.map((j) => ({ jugadaId: j.id, montoCubierto: j.monto })),
          },
        },
      });
      cobrosCreados.push(cobro);
    }
    return cobrosCreados;
  }

  async marcarPagado(cobroId: number, usuarioId: number) {
    const cobro = await this.prisma.cobro.findUnique({ where: { id: cobroId } });
    if (!cobro) throw new NotFoundException('Cobro no encontrado');

    const actualizado = await this.prisma.cobro.update({
      where: { id: cobroId },
      data: { pagado: true, pagadoEn: new Date(), pagadoPorId: usuarioId },
    });

    // El ticket se emite acá y no al generar el cobro: el número nace
    // cuando la plata entra, así la serie no deja huecos por cobros que
    // nadie pagó. Los reembolsos no llevan ticket (el service los ignora).
    const ticket = await this.tickets.emitirParaCobro(cobroId, usuarioId);

    this.events.cobroMarcadoPagado(cobro.carreraId, {
      clienteId: cobro.clienteId,
      apodo: cobro.apodo,
      cobroId,
      tipo: cobro.tipo,
      pagadoEn: actualizado.pagadoEn!,
    });
    return { ...actualizado, ticket };
  }
}
