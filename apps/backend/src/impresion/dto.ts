import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { DestinoImpresora } from './impresora.config';

/**
 * Lo que manda la pantalla de Configuración.
 *
 * Todo es opcional: la pantalla guarda de a partes —elegir la impresora es
 * una acción, cambiar el ancho es otra— y lo que no viene se deja como
 * estaba. El rango real lo termina de aplicar `normalizar` en la config; acá
 * se rechaza lo que directamente no tiene forma de valor válido.
 */
export class GuardarImpresoraDto {
  @IsOptional() @IsIn(['log', 'usb', 'red'])
  destino?: DestinoImpresora;

  // Los dos únicos anchos que el render sabe maquetar (32 y 48 columnas).
  @IsOptional() @IsIn([58, 80])
  anchoMm?: number;

  @IsOptional() @IsString()
  ruta?: string | null;

  @IsOptional() @IsString()
  host?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(65535)
  puerto?: number;

  @IsOptional() @IsBoolean()
  corta?: boolean;

  // Más de 20 líneas de avance es medio metro de papel por ticket.
  @IsOptional() @IsInt() @Min(0) @Max(20)
  avance?: number;
}
