import { Module } from '@nestjs/common';
import { ImpresoraService } from './impresora.service';

@Module({
  providers: [ImpresoraService],
  exports: [ImpresoraService],
})
export class ImpresionModule {}
