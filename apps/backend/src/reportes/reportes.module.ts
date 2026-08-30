import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';

@Module({
  controllers: [ReportesController],
})
export class ReportesModule {}
