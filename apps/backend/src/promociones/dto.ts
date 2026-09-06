import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * El texto de un aviso de cintillo. El tope de 200 no es de base —la columna
 * es libre— sino de pantalla: más que eso no se alcanza a leer en una vuelta
 * del cintillo y el que lo carga no se da cuenta hasta verlo en el televisor.
 */
export class TextoDto {
  @IsString()
  @IsNotEmpty({ message: 'El aviso no puede estar vacío.' })
  @MaxLength(200, { message: 'El aviso no puede pasar de 200 caracteres.' })
  texto: string;
}

/** Editar un aviso de texto ya cargado, sin borrarlo y volverlo a escribir. */
export class EditarTextoDto {
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El aviso no puede estar vacío.' })
  @MaxLength(200, { message: 'El aviso no puede pasar de 200 caracteres.' })
  texto?: string;
}
