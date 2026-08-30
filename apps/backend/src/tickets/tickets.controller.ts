import {
  Controller, Get, HttpCode, Param, ParseIntPipe, Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { ImpresoraService, ImpresionFallida } from '../impresion/impresora.service';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly tickets: TicketsService,
    private readonly impresora: ImpresoraService,
  ) {}

  // Va ANTES de las rutas con :id — si no, Nest intenta resolver «impresora»
  // como el id de un ticket y responde un 400 de ParseIntPipe.
  //
  // La pantalla lo usa para rotular la previsualización con el ancho real y
  // para saber si el botón de imprimir tiene a dónde mandar el papel.
  @Get('impresora')
  estadoImpresora() {
    return this.impresora.estado();
  }

  // Texto plano, con el ancho exacto del papel: la app lo muestra en
  // monoespaciada y eso ES la previsualización. Sin HTML de por medio para
  // que no haya diferencia entre lo que se ve y lo que se imprime.
  @Get(':id/previsualizacion')
  async previsualizar(@Param('id', ParseIntPipe) id: number) {
    return { texto: await this.tickets.previsualizar(id) };
  }

  // Reimpresión: no crea nada, sólo vuelve a sacar el mismo papel. Por eso
  // es 200 y no 201.
  @Post(':id/imprimir')
  @HttpCode(200)
  async imprimir(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.tickets.imprimir(id);
      return { impreso: true };
    } catch (causa) {
      // Una impresora sin papel no es un error del cliente ni un bug del
      // servidor: es un recurso que no está. 503 con el motivo adentro, que
      // es lo que el operador necesita leer para ir a resolverlo.
      if (causa instanceof ImpresionFallida) {
        throw new ServiceUnavailableException(causa.message);
      }
      throw causa;
    }
  }
}
