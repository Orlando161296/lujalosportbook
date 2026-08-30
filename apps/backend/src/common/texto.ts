/**
 * Nombre en la forma en que se muestra: MAYÚSCULAS, sin espacios de más.
 *
 * Los nombres se escriben a las apuradas mientras el rematador canta, y
 * entran de mil formas — «Relámpago», «RELAMPAGO», «  relámpago ». En el
 * tablero y en el TV eso se ve como tres caballos distintos, y el operador
 * duda justo cuando no puede dudar. Se normaliza al guardar y no al mostrar,
 * para que lo que está en la base sea lo que se lee en pantalla.
 *
 * A diferencia de los apodos, acá los acentos SE CONSERVAN: «RELÁMPAGO» es
 * el nombre del caballo y así va en la pizarra. Los apodos se despojan de
 * acentos porque son clave de agrupación al cobrar (ver `normalizarApodo`),
 * que es un problema distinto.
 */
export function enMayusculas(texto: string): string;
export function enMayusculas(texto: string | null | undefined): string | null;
export function enMayusculas(texto: string | null | undefined): string | null {
  if (texto == null) return null;
  const limpio = texto.replace(/\s+/g, ' ').trim().toUpperCase();
  return limpio.length > 0 ? limpio : null;
}
