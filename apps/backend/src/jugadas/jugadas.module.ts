import { Module } from '@nestjs/common';
import { JugadasController } from './jugadas.controller';
import { JugadasService } from './jugadas.service';

@Module({
  controllers: [JugadasController],
  providers: [JugadasService],
})
export class JugadasModule {}
