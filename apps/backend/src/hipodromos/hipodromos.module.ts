import { Module } from '@nestjs/common';
import { HipodromosController } from './hipodromos.controller';

@Module({
  controllers: [HipodromosController],
})
export class HipodromosModule {}
