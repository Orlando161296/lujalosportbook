import { Module } from '@nestjs/common';
import { CarrerasController } from './carreras.controller';
import { CarrerasService } from './carreras.service';
import { TablasModule } from '../tablas/tablas.module';

@Module({
  imports: [TablasModule],
  controllers: [CarrerasController],
  providers: [CarrerasService],
})
export class CarrerasModule {}
