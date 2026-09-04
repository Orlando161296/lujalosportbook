import { Module } from '@nestjs/common';
import { ImpresoraService } from './impresora.service';
import { ImpresoraController } from './impresora.controller';

@Module({
  controllers: [ImpresoraController],
  providers: [ImpresoraService],
  exports: [ImpresoraService],
})
export class ImpresionModule {}
