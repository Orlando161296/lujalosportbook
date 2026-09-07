import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { aplicarMigracionesPendientes } from './prisma/migrador';

// En producción esto corre como sidecar de Tauri (ver stack técnico: sin
// Docker, backend embebido, arrancado y cerrado junto con la app). El
// puerto queda fijo para que el cliente (ambas ventanas) siempre lo
// encuentre en localhost, y sea también lo único que hay que abrir en el
// firewall el día que se sume una segunda PC en la LAN.
const PUERTO = process.env.PUERTO ? Number(process.env.PUERTO) : 3210;

// Embebido (sidecar de Tauri) el Rust pasa NODE_ENV=production. Ahí se corta
// el log de arranque de Nest —unas 70 líneas mapeando rutas— que en una PC
// con disco lento cuesta un tramo perceptible del inicio y que nadie va a
// leer: la ventana de la taquilla no espera menos por verlas.
const EMBEBIDO = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { origin: '*' }, // TODO: restringir a los orígenes reales al pasar a multi-PC
    logger: EMBEBIDO ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Poner la base al día ANTES de atender: una actualización que agregue una
  // columna la aplica sola, sin que nadie abra una terminal en el local. Las
  // carpetas de migración viajan al lado de `dist/` (ver empaquetar.js). Si
  // falla, se sigue: es peor no arrancar que arrancar con una función nueva a
  // medias, y quedó el respaldo.
  const log = new Logger('Migrador');
  try {
    const prisma = app.get(PrismaService);
    await prisma.$connect();
    const aplicadas = await aplicarMigracionesPendientes(
      prisma,
      join(__dirname, '..', 'prisma', 'migrations'),
      (m) => log.log(m),
    );
    if (aplicadas.length === 0) log.log('Base al día.');
  } catch (causa) {
    log.error(`No se pudieron aplicar migraciones: ${(causa as Error).message}`);
  }

  await app.listen(PUERTO, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Backend Lujalo escuchando en http://0.0.0.0:${PUERTO}`);
}
bootstrap();
