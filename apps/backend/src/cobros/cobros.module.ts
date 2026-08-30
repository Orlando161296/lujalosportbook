import { Module } from '@nestjs/common';
import { CobrosController } from './cobros.controller';
import { CobrosService } from './cobros.service';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [TicketsModule],
  controllers: [CobrosController],
  providers: [CobrosService],
})
export class CobrosModule {}
