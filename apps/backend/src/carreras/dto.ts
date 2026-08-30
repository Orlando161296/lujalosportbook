import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CrearCarreraDto {
  @IsInt()
  hipodromoId: number;

  @IsDateString()
  fecha: string;

  @IsInt()
  numero: number;

  @IsOptional()
  @IsString()
  nombre?: string;
}

export class CambiarEstadoCarreraDto {
  @IsIn(['planificada', 'abierta', 'cerrada'])
  estado: 'planificada' | 'abierta' | 'cerrada';
}

export class RegistrarResultadoDto {
  @IsArray()
  @ArrayMinSize(1) // 1 fila normalmente, 2+ si hay empate
  @IsInt({ each: true })
  ejemplaresGanadores: number[];
}
