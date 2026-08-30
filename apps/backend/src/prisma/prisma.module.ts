import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global para no tener que re-importar PrismaModule en cada módulo de
// recurso — todos los services de la app usan la misma conexión SQLite.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
