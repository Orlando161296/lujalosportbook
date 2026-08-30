import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

class CrearHipodromoDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsOptional() @IsString() ciudad?: string;

  // Cuántas tablas lleva cada carrera acá. Hoy son tres en todos lados, pero
  // es del hipódromo y no del sistema: la jornada las crea leyendo este valor.
  @IsOptional() @IsInt() @IsPositive() tablasPorCarrera?: number;

  @IsOptional() @IsBoolean() disponibleParaRemate?: boolean;
}

class ActualizarHipodromoDto {
  @IsOptional() @IsString() nombre?: string;
  @IsOptional() @IsString() ciudad?: string;
  @IsOptional() @IsInt() @IsPositive() tablasPorCarrera?: number;
  @IsOptional() @IsBoolean() disponibleParaRemate?: boolean;
  @IsOptional() @IsBoolean() activo?: boolean;
}

// Catálogo fijo — se registra una vez por hipódromo (admin).
@Controller('hipodromos')
export class HipodromosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.hipodromo.findMany({ orderBy: { nombre: 'asc' } });
  }

  @Post()
  crear(@Body() dto: CrearHipodromoDto) {
    return this.prisma.hipodromo.create({ data: dto });
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarHipodromoDto) {
    return this.prisma.hipodromo.update({ where: { id }, data: dto });
  }
}
