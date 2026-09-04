import { IsBoolean } from 'class-validator';

export class CambiarActivaDto {
  @IsBoolean()
  activa: boolean;
}
