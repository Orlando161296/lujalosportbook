import { Module } from '@nestjs/common';
import { TablasController } from './tablas.controller';
import { TablasService } from './tablas.service';

@Module({
  controllers: [TablasController],
  providers: [TablasService],
  exports: [TablasService],
})
export class TablasModule {}
