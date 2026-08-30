import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { TablasService } from './tablas.service';
import { CrearTablaDto, ActualizarPoteDto } from './dto';
import { CurrentUser } from '../common/current-user.decorator';

@Controller()
export class TablasController {
  constructor(private readonly tablas: TablasService) {}

  @Get('carreras/:carreraId/tablas')
  listar(@Param('carreraId', ParseIntPipe) carreraId: number) {
    return this.tablas.listar(carreraId);
  }

  @Post('carreras/:carreraId/tablas')
  crear(@Param('carreraId', ParseIntPipe) carreraId: number, @Body() dto: CrearTablaDto) {
    return this.tablas.crear(carreraId, dto);
  }

  @Patch('tablas/:id/pote')
  actualizarPote(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarPoteDto) {
    return this.tablas.actualizarPote(id, dto);
  }

  @Patch('tablas/:id/cerrar')
  cerrar(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: { id: number }) {
    return this.tablas.cerrar(id, usuario.id);
  }
}
