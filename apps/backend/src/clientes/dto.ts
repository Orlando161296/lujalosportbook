import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

// Las condiciones VIP (nivel, crédito, tasa preferencial, trato en el cobro)
// son parte del cliente y no una tabla aparte: el operador las consulta en el
// mismo momento en que le está cobrando.
class CamposCliente {
  @IsOptional() @IsString() nombrePizarra?: string | null;
  @IsOptional() @IsString() telefono?: string | null;
  @IsOptional() @IsString() notas?: string | null;
  @IsOptional() @IsBoolean() activo?: boolean;

  @IsOptional() @IsBoolean() esVip?: boolean;
  @IsOptional() @IsString() nivel?: string | null;
  @IsOptional() @IsNumber() limiteCreditoBs?: number;
  @IsOptional() @IsNumber() tasaPreferencial?: number | null;
  @IsOptional() @IsNumber() descuentoPct?: number;

  @IsOptional() @IsBoolean() puedeCreditoEnRemate?: boolean;
  @IsOptional() @IsBoolean() descontarDeudaDelPremio?: boolean;
  @IsOptional() @IsBoolean() puedePagarUsd?: boolean;
  @IsOptional() @IsBoolean() resaltadoEnPizarra?: boolean;
}

export class CrearClienteDto extends CamposCliente {
  @IsString()
  @MinLength(1)
  nombre: string;
}

export class ActualizarClienteDto extends CamposCliente {
  @IsOptional()
  @IsString()
  nombre?: string;
}
