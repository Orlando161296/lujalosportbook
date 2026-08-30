import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// En producción esto corre como sidecar de Tauri (ver stack técnico: sin
// Docker, backend embebido, arrancado y cerrado junto con la app). El
// puerto queda fijo para que el cliente (ambas ventanas) siempre lo
// encuentre en localhost, y sea también lo único que hay que abrir en el
// firewall el día que se sume una segunda PC en la LAN.
const PUERTO = process.env.PUERTO ? Number(process.env.PUERTO) : 3210;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: { origin: '*' }, // TODO: restringir a los orígenes reales al pasar a multi-PC
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(PUERTO, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Backend Lujalo escuchando en http://0.0.0.0:${PUERTO}`);
}
bootstrap();
