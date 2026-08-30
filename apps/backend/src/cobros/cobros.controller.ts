import { Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CobrosService } from './cobros.service';
import { CurrentUser } from '../common/current-user.decorator';

@Controller()
export class CobrosController {
  constructor(private readonly cobros: CobrosService) {}

  @Get('carreras/:carreraId/cobros')
  listar(@Param('carreraId', ParseIntPipe) carreraId: number) {
    return this.cobros.listar(carreraId);
  }

  @Post('carreras/:carreraId/cobros/generar')
  generar(@Param('carreraId', ParseIntPipe) carreraId: number) {
    return this.cobros.generar(carreraId);
  }

  @Patch('cobros/:id/pagar')
  marcarPagado(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: { id: number }) {
    return this.cobros.marcarPagado(id, usuario.id);
  }
}
