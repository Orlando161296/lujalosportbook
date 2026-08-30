import { Module } from '@nestjs/common';
import { PizarraController } from './pizarra.controller';
import { PizarraService } from './pizarra.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [PizarraController],
  providers: [PizarraService],
})
export class PizarraModule {}
