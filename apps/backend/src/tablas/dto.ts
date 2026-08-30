import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CrearTablaDto {
  @IsString()
  @MinLength(1)
  etiqueta: string;
}

export class ActualizarPoteDto {
  @IsNumber()
  @IsPositive()
  poteCasa: number;
}
