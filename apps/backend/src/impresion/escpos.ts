// ESC/POS: los bytes que entiende una térmica.
//
// El protocolo es el mismo en 58 y en 80 mm —cambia el papel, no el juego de
// comandos—, así que acá no hay nada del ancho: eso vive en el render.
//
// Lo escribimos a mano en vez de traer una librería porque son ocho comandos
// contados y el backend viaja embebido como sidecar de la app Tauri: cada
// dependencia es peso en el instalador y una cosa más que puede romperse en
// una PC sin internet.

const ESC = 0x1b;
const GS = 0x1d;

/** Reinicia la impresora: limpia formato y buffer de la impresión anterior. */
export const INICIALIZAR = Buffer.from([ESC, 0x40]);

/**
 * Selecciona la tabla de caracteres PC850 (Multilingüe).
 *
 * `ESC t 2`. Es la que trae acentos, «», · y °, que es exactamente lo que el
 * ticket usa. Sin este comando la impresora arranca en PC437 (inglés) y
 * «HIPÓDROMO» sale «HIPìDROMO».
 */
export const TABLA_PC850 = Buffer.from([ESC, 0x74, 0x02]);

/** `ESC a n` — 0 izquierda, 1 centro, 2 derecha. */
export const alinear = (n: 0 | 1 | 2) => Buffer.from([ESC, 0x61, n]);

/** `ESC d n` — avanza n líneas. */
export const avanzar = (n: number) =>
  Buffer.from([ESC, 0x64, Math.max(0, Math.min(255, Math.round(n)))]);

/**
 * `GS V 66 n` — corte parcial dejando n líneas de avance antes.
 *
 * Deja un puentecito de papel sin cortar para que el ticket no se caiga al
 * piso. Las 58 mm baratas suelen no traer guillotina: ahí este comando se
 * ignora en el mejor caso, así que el servicio sólo lo manda si está
 * configurado que la impresora corta.
 */
export const CORTAR = Buffer.from([GS, 0x56, 0x42, 0x00]);

/**
 * De Unicode a PC850.
 *
 * Sólo los caracteres que el ticket puede llegar a contener: los acentos y
 * la eñe de los nombres de ejemplares y clientes —que los teclea el operador
 * y pueden ser cualquier cosa— y los signos del propio formato (· « » °).
 */
const PC850: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85,
  'å': 0x86, 'ç': 0x87, 'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b,
  'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'Å': 0x8f, 'É': 0x90, 'ô': 0x93,
  'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97, 'ÿ': 0x98, 'Ö': 0x99,
  'Ü': 0x9a, 'ø': 0x9b, '£': 0x9c, 'Ø': 0x9d, '×': 0x9e,
  'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5,
  'ª': 0xa6, 'º': 0xa7, '¿': 0xa8, '®': 0xa9, '¬': 0xaa, '½': 0xab,
  '¼': 0xac, '¡': 0xad, '«': 0xae, '»': 0xaf,
  'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7, '©': 0xb8, '¢': 0xbd, '¥': 0xbe,
  'ã': 0xc6, 'Ã': 0xc7, 'ð': 0xd0, 'Ð': 0xd1, 'Ê': 0xd2, 'Ë': 0xd3,
  'È': 0xd4, 'ı': 0xd5, 'Í': 0xd6, 'Î': 0xd7, 'Ï': 0xd8,
  'Ì': 0xde, 'Ó': 0xe0, 'ß': 0xe1, 'Ô': 0xe2, 'Ò': 0xe3, 'õ': 0xe4,
  'Õ': 0xe5, 'µ': 0xe6, 'þ': 0xe7, 'Þ': 0xe8, 'Ú': 0xe9, 'Û': 0xea,
  'Ù': 0xeb, 'ý': 0xec, 'Ý': 0xed, '¯': 0xee, '´': 0xef,
  '±': 0xf1, '¾': 0xf2, '¶': 0xf3, '§': 0xf4, '÷': 0xf6, '¸': 0xf7,
  '°': 0xf8, '¨': 0xf9, '·': 0xfa, '¹': 0xfb, '³': 0xfc, '²': 0xfd,
};

/**
 * Último recurso para lo que PC850 no tiene.
 *
 * Preferimos un ticket legible con la tilde perdida antes que un carácter
 * fantasma: los tres primeros salen de escribir en Word y pegar, y llegan
 * más seguido de lo que uno esperaría.
 */
const EQUIVALENCIAS: Record<string, string> = {
  '—': '-', '–': '-', '‑': '-',
  '“': '"', '”': '"', '„': '"', '‘': "'", '’': "'",
  '…': '...', '€': 'EUR', '\t': ' ',
};

/** Quita la tilde de una letra que PC850 no tenga: «ǎ» → «a». */
const sinTilde = (c: string) =>
  c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Codifica el texto del ticket a PC850, byte a byte.
 *
 * Todo lo que no exista en la tabla se degrada —equivalencia, sin tilde, y
 * como último recurso «?»— en vez de romper la impresión: el papel tiene que
 * salir aunque un cliente se llame «Müller-Ştefan».
 */
export function codificarPC850(texto: string): Buffer {
  const bytes: number[] = [];

  for (const caracter of texto.replace(/\r\n/g, '\n')) {
    const codigo = caracter.codePointAt(0)!;

    if (codigo === 0x0a) { bytes.push(0x0a); continue; }
    if (codigo < 0x20) continue;             // control: no va al papel
    if (codigo < 0x7f) { bytes.push(codigo); continue; }  // ASCII imprimible

    const directo = PC850[caracter];
    if (directo !== undefined) { bytes.push(directo); continue; }

    const equivalente = EQUIVALENCIAS[caracter] ?? sinTilde(caracter);
    for (const c of equivalente) {
      const b = PC850[c] ?? (c.codePointAt(0)! < 0x7f ? c.codePointAt(0)! : undefined);
      bytes.push(b ?? 0x3f);                 // '?'
    }
  }

  return Buffer.from(bytes);
}
