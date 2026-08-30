import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrearClienteDto, ActualizarClienteDto } from './dto';
import { enMayusculas } from '../common/texto';
import { CurrentUser } from '../common/current-user.decorator';

// Cualquier operador autorizado puede crear/editar clientes y marcarlos VIP
// — no está restringido a administración (ver reglas de negocio cerradas).
@Controller('clientes')
export class ClientesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  buscar(@Query('buscar') buscar?: string) {
    return this.prisma.cliente.findMany({
      where: buscar ? { nombre: { contains: buscar } } : {},
      orderBy: { nombre: 'asc' },
    });
  }

  @Post()
  crear(@Body() dto: CrearClienteDto, @CurrentUser() usuario: { id: number }) {
    return this.prisma.cliente.create({
      // El nombre se guarda como se muestra: en el tablero, en el TV y en el
      // cobro va en mayúsculas, así que no tiene sentido guardarlo de otra
      // forma y normalizar en cada pantalla.
      data: {
        ...dto,
        nombre: enMayusculas(dto.nombre),
        nombrePizarra: enMayusculas(dto.nombrePizarra),
        creadoPorId: usuario.id,
      },
    });
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarClienteDto) {
    return this.prisma.cliente.update({
      where: { id },
      data: {
        ...dto,
        // Sólo si vinieron: un PATCH que no toca el nombre no debe borrarlo.
        ...(dto.nombre !== undefined ? { nombre: enMayusculas(dto.nombre) } : {}),
        ...(dto.nombrePizarra !== undefined
          ? { nombrePizarra: enMayusculas(dto.nombrePizarra) }
          : {}),
      },
    });
  }
}
