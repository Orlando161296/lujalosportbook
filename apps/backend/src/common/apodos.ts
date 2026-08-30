// Un apodo es lo único que identifica al postor cuando no está registrado:
// «Silla Roja», «Barba Negra». Se teclea al vuelo, en medio del remate, y
// el mismo postor va a aparecer escrito distinto entre una puja y la
// siguiente — "silla roja", "SILLA  ROJA", "Silla Rója". Si esas variantes
// no colapsan a la misma clave, al cobrar le salen tres cobros separados a
// la misma persona, y eso es plata mal contada.
//
// Por eso el apodo se guarda YA normalizado: la forma normalizada es a la
// vez lo que se muestra en la pizarra y la clave con la que se agrupa.

/**
 * Forma canónica de un apodo: sin acentos, sin espacios de más, en
 * mayúsculas. Las mayúsculas no son decoración — la pizarra del TV se lee
 * a varios metros y ya muestra todo así.
 *
 * Devuelve `null` si lo tecleado no tiene contenido real, para que el
 * llamador lo trate igual que un campo vacío.
 */
export function normalizarApodo(escrito: string | null | undefined): string | null {
  if (escrito == null) return null;
  const limpio = escrito
    .normalize('NFD')
    // Descarta los diacríticos que NFD dejó sueltos: «Rója» y «Roja» son
    // el mismo postor y tienen que caer en la misma clave.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return limpio.length > 0 ? limpio : null;
}

// Tope de largo: entra en la columna CLIENTE del tablero y en la pizarra
// sin romper el renglón. Lo que se pasa se corta al guardar, no al mostrar,
// para que la clave de agrupación sea siempre la misma cadena.
export const LARGO_MAXIMO_APODO = 40;
