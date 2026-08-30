import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';

@Module({
  controllers: [ClientesController],
})
export class ClientesModule {}
