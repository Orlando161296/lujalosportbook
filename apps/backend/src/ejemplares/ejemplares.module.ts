import { Module } from '@nestjs/common';
import { EjemplaresController } from './ejemplares.controller';
import { EjemplaresService } from './ejemplares.service';

@Module({
  controllers: [EjemplaresController],
  providers: [EjemplaresService],
})
export class EjemplaresModule {}
