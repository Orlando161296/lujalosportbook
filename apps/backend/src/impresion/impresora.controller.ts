import { Body, Controller, Get, Put } from '@nestjs/common';
import { ImpresoraService } from './impresora.service';
import { GuardarImpresoraDto } from './dto';

/**
 * La impresora, configurable desde la pantalla.
 *
 * Vive acá y no en `tickets` porque no es una propiedad del ticket sino de la
 * máquina: el ticket se maqueta igual salga por donde salga.
 */
@Controller('impresora')
export class ImpresoraController {
  constructor(private readonly impresora: ImpresoraService) {}

  @Get()
  estado() {
    return this.impresora.estado();
  }

  /**
   * Las impresoras que ya tiene la máquina, para elegir de una lista en vez
   * de escribir una ruta. Nunca falla: si no se pudo preguntar, la lista
   * vuelve vacía y la pantalla ofrece escribirla a mano.
   */
  @Get('detectadas')
  detectadas() {
    return this.impresora.detectar();
  }

  @Put()
  guardar(@Body() dto: GuardarImpresoraDto) {
    this.impresora.guardar(dto);
    return this.impresora.estado();
  }
}
