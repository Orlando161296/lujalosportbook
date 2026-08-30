import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { EjemplaresService } from './ejemplares.service';
import { CrearEjemplarDto, RenombrarEjemplarDto } from './dto';
import { CurrentUser } from '../common/current-user.decorator';

@Controller()
export class EjemplaresController {
  constructor(private readonly ejemplares: EjemplaresService) {}

  @Get('carreras/:carreraId/ejemplares')
  listar(@Param('carreraId', ParseIntPipe) carreraId: number) {
    return this.ejemplares.listar(carreraId);
  }

  @Post('carreras/:carreraId/ejemplares')
  crear(@Param('carreraId', ParseIntPipe) carreraId: number, @Body() dto: CrearEjemplarDto) {
    return this.ejemplares.crear(carreraId, dto);
  }

  // Corrección de tipeo. No es una acción de negocio: no mueve plata ni
  // estados, por eso no lleva el usuario ni emite un evento propio.
  @Patch('ejemplares/:id')
  renombrar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenombrarEjemplarDto,
  ) {
    return this.ejemplares.renombrar(id, dto);
  }

  @Patch('ejemplares/:id/retirar')
  retirar(@Param('id', ParseIntPipe) id: number, @CurrentUser() usuario: { id: number }) {
    return this.ejemplares.retirar(id, usuario.id);
  }

  @Patch('ejemplares/:id/reponer')
  reponer(@Param('id', ParseIntPipe) id: number) {
    return this.ejemplares.reponer(id);
  }
}
