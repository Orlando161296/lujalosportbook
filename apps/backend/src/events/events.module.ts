import { Global, Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

// Global por la misma razón que PrismaModule: casi todos los módulos de
// recurso necesitan emitir algún evento después de escribir.
@Global()
@Module({
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
