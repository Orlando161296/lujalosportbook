import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * El cliente de Prisma.
 *
 * La conexión NO se espera al arrancar. Antes `onModuleInit` hacía
 * `await this.$connect()`, y como Nest no termina de levantar hasta que todos
 * los módulos resolvieron su init, el puerto HTTP no abría hasta que el motor
 * de consultas de Prisma estaba listo —un par de segundos en la PC del
 * local—. El Rust de Tauri espera ese puerto para mostrar la ventana, así que
 * esos segundos eran pantalla en negro.
 *
 * Prisma abre la conexión sola en la primera consulta. Se dispara acá en
 * segundo plano, apenas la app quedó levantada, para que la primera petición
 * real —que llega cuando el operador ya está viendo la taquilla— la encuentre
 * hecha y no tenga que esperarla.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('Prisma');

  onApplicationBootstrap() {
    this.$connect()
      .then(() => this.log.log('Conexión a la base lista.'))
      .catch((causa) => this.log.error(`No se pudo conectar a la base: ${(causa as Error).message}`));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
