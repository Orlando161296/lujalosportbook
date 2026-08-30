import { Module } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ImpresionModule } from '../impresion/impresion.module';

@Module({
  imports: [PrismaModule, ImpresionModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
