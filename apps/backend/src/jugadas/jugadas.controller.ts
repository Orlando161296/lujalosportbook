import { Body, Controller, Delete, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { JugadasService } from './jugadas.service';
import { UpsertJugadaDto } from './dto';
import { CurrentUser } from '../common/current-user.decorator';

// Ver contrato API: https://claude.ai/code/artifact/b1f88c21-871c-4d3b-9d87-8b82e3ff7144
@Controller()
export class JugadasController {
  constructor(private readonly jugadas: JugadasService) {}

  // El endpoint central del "mecanismo rápido de edición": upsert, un solo
  // verbo para "jugar" y para "cambiar de postor" sobre el mismo número.
  @Put('tablas/:tablaId/jugadas/:ejemplarId')
  upsert(
    @Param('tablaId', ParseIntPipe) tablaId: number,
    @Param('ejemplarId', ParseIntPipe) ejemplarId: number,
    @Body() dto: UpsertJugadaDto,
    @CurrentUser() usuario: { id: number },
  ) {
    return this.jugadas.upsert(tablaId, ejemplarId, dto, usuario.id);
  }

  @Delete('tablas/:tablaId/jugadas/:ejemplarId')
  anular(
    @Param('tablaId', ParseIntPipe) tablaId: number,
    @Param('ejemplarId', ParseIntPipe) ejemplarId: number,
    @CurrentUser() usuario: { id: number },
  ) {
    return this.jugadas.anularManual(tablaId, ejemplarId, usuario.id);
  }

  @Get('jugadas')
  historial(
    @Query('carrera_id') carreraId?: string,
    @Query('cliente_id') clienteId?: string,
  ) {
    return this.jugadas.historial(
      carreraId ? Number(carreraId) : undefined,
      clienteId ? Number(clienteId) : undefined,
    );
  }
}
