import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CrearEjemplarDto {
  // No hay caballo 0 ni negativo; sin el mínimo, un número inválido llegaba
  // hasta la base y fallaba recién ahí.
  @IsInt()
  @Min(1)
  numero: number;

  @IsString()
  @MinLength(1)
  nombre: string;
}

export class RenombrarEjemplarDto {
  @IsString()
  @MinLength(1)
  nombre: string;
}
