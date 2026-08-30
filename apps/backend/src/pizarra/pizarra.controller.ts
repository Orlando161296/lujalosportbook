import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsInt, IsOptional } from 'class-validator';
import { PizarraService } from './pizarra.service';

class MostrarEnPizarraDto {
  // null = sacar la carrera del TV y dejarlo en espera.
  @IsOptional()
  @IsInt()
  carreraId?: number | null;
}

@Controller('pizarra')
export class PizarraController {
  constructor(private readonly pizarra: PizarraService) {}

  // La ventana de la pizarra lo consulta al abrir, antes de suscribirse:
  // mismo orden que el resto del protocolo, el snapshot primero.
  @Get('carrera')
  actual() {
    return this.pizarra.actual();
  }

  @Put('carrera')
  mostrar(@Body() dto: MostrarEnPizarraDto) {
    return this.pizarra.mostrar(dto.carreraId ?? null);
  }
}
