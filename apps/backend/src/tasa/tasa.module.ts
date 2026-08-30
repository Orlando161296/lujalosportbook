import { Module } from '@nestjs/common';
import { TasaController } from './tasa.controller';

@Module({
  controllers: [TasaController],
})
export class TasaModule {}
