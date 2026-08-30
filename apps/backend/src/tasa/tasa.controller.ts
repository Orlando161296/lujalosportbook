import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CurrentUser } from '../common/current-user.decorator';

class RegistrarTasaDto {
  @IsNumber()
  @IsPositive()
  valorBsPorUsd: number;

  /** 'manual' | 'api' — de dónde salió el valor, para poder auditarlo. */
  @IsOptional()
  @IsString()
  origen?: string;
}

// Registro de vigencia, no una fila fija por día — los administradores
// deciden la cadencia (puede cubrir un fin de semana entero, o cambiar
// varias veces el mismo día). Ver modelo de datos.
@Controller('tasa')
export class TasaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  @Get('vigente')
  async vigente() {
    return this.prisma.tasaCambio.findFirst({
      where: { vigenteDesde: { lte: new Date() } },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  // Cada cambio queda con usuario y hora: es lo que permite auditar por qué
  // un cobro del mediodía se calculó distinto a uno de la tarde.
  @Get('historial')
  historial() {
    return this.prisma.tasaCambio.findMany({
      orderBy: { vigenteDesde: 'desc' },
      take: 30,
      include: { registradoPor: { select: { usuario: true, nombre: true } } },
    });
  }

  @Post()
  async registrar(@Body() dto: RegistrarTasaDto, @CurrentUser() usuario: { id: number }) {
    const vigenteDesde = new Date();
    const tasa = await this.prisma.tasaCambio.create({
      data: {
        valorBsPorUsd: dto.valorBsPorUsd,
        origen: dto.origen ?? 'manual',
        vigenteDesde,
        registradoPorId: usuario.id,
      },
    });
    this.events.tasaActualizada({ valorBsPorUsd: dto.valorBsPorUsd.toString(), vigenteDesde });
    return tasa;
  }
}
