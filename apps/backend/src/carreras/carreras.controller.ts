import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CarrerasService } from './carreras.service';
import { CrearCarreraDto, CambiarEstadoCarreraDto, RegistrarResultadoDto } from './dto';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('carreras')
export class CarrerasController {
  constructor(private readonly carreras: CarrerasService) {}

  @Get()
  listar(@Query('fecha') fecha?: string) {
    return this.carreras.listar(fecha);
  }

  @Post()
  crear(@Body() dto: CrearCarreraDto, @CurrentUser() usuario: { id: number }) {
    return this.carreras.crear(dto, usuario.id);
  }

  @Get(':id/pizarra')
  pizarra(@Param('id', ParseIntPipe) id: number) {
    return this.carreras.pizarra(id);
  }

  @Patch(':id/estado')
  cambiarEstado(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstadoCarreraDto) {
    return this.carreras.cambiarEstado(id, dto);
  }

  @Post(':id/resultado')
  registrarResultado(@Param('id', ParseIntPipe) id: number, @Body() dto: RegistrarResultadoDto) {
    return this.carreras.registrarResultado(id, dto);
  }
}
