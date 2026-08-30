import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { LARGO_MAXIMO_APODO } from '../common/apodos';

export class UpsertJugadaDto {
  // Opcional porque un caballo que nadie pujó se lo puede quedar la casa, y
  // ahí no hay cliente detrás (ver `esCasa` y el resumen del día).
  @IsOptional()
  @IsInt()
  clienteId?: number;

  // Alternativa al cliente registrado: el postor entra sólo con su apodo,
  // que es como lo conoce el rematador. Ver `normalizarApodo`.
  @IsOptional()
  @IsString()
  @MaxLength(LARGO_MAXIMO_APODO)
  apodo?: string;

  @IsOptional()
  @IsBoolean()
  esCasa?: boolean;

  // Dos decimales: es plata, y más precisión que eso no existe en caja.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;

  @IsIn(['Bs', 'USD'])
  moneda: 'Bs' | 'USD';

  @IsOptional()
  @IsInt()
  taquillaId?: number;
}
