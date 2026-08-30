import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { HipodromosModule } from './hipodromos/hipodromos.module';
import { TasaModule } from './tasa/tasa.module';
import { CarrerasModule } from './carreras/carreras.module';
import { PizarraModule } from './pizarra/pizarra.module';
import { TicketsModule } from './tickets/tickets.module';
import { EjemplaresModule } from './ejemplares/ejemplares.module';
import { TablasModule } from './tablas/tablas.module';
import { JugadasModule } from './jugadas/jugadas.module';
import { ClientesModule } from './clientes/clientes.module';
import { CobrosModule } from './cobros/cobros.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    AuthModule,
    HipodromosModule,
    TasaModule,
    CarrerasModule,
    PizarraModule,
    TicketsModule,
    EjemplaresModule,
    TablasModule,
    JugadasModule,
    ClientesModule,
    CobrosModule,
    ReportesModule,
    CatalogosModule,
  ],
})
export class AppModule {}
