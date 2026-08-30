// Formato de plata, en un solo lugar. Venezuela usa punto de miles y coma
// decimal; escribirlo a mano en cada pantalla es cómo se cuelan los errores
// que el operador canta en voz alta.

/**
 * 75800 -> "75.800" · 12500.5 -> "12.500,50".
 *
 * Los céntimos se muestran sólo cuando existen. Antes truncaba siempre a
 * enteros, así que una puja con decimales se veía redondeada en el tablero,
 * en la pizarra y en el cobro mientras la base guardaba otro número — y lo
 * que el operador canta en voz alta es lo que lee en pantalla.
 *
 * Un monto redondo sigue viéndose limpio, que es lo que necesita el TV.
 */
export function bs(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0);
  if (!Number.isFinite(n)) return '—';
  const tieneCentimos = Math.abs(n % 1) > 1e-9;
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: tieneCentimos ? 2 : 0,
    maximumFractionDigits: tieneCentimos ? 2 : 0,
  }).format(n);
}

/**
 * Lee lo que el operador tecleó en un campo de monto.
 *
 * Venezuela usa punto de miles y coma decimal, pero en el teclado numérico
 * el separador que cae a mano es el punto. Sin distinguir los dos casos,
 * «12.50» se interpretaba como 1250 —el punto se borraba como separador de
 * miles— y la jugada se cargaba por cien veces su valor.
 *
 * La regla: la coma siempre es decimal. Un punto solo es de miles si lo
 * siguen exactamente tres dígitos («1.500» son mil quinientos); con uno o
 * dos dígitos detrás es decimal («12.50» son doce con cincuenta).
 *
 * Devuelve NaN si no hay un número válido, para que el llamador avise.
 */
/**
 * Formatea lo que el operador está escribiendo, sin pelearle al cursor.
 *
 * IMPORTANTE: esta función se realimenta con su propia salida. El input es
 * controlado, así que en cada tecla recibe el texto YA formateado más el
 * carácter nuevo. Por eso el punto se trata siempre como separador de miles
 * —es el que ella misma puso— y nunca como decimal: interpretarlo como coma
 * hacía que «1.000» volviera a entrar como «1,000» y se truncara a «1,00»,
 * dejando el campo trabado al quinto dígito.
 *
 * El decimal es la coma. La tecla del punto se remapea a coma en el
 * `onKeyDown` del campo, así que el teclado numérico sigue sirviendo.
 *
 * Devuelve además dónde tiene que quedar el cursor: se cuenta cuántos
 * dígitos había antes de la posición original y se lo reubica después del
 * mismo dígito en el texto ya formateado.
 */
export function formatearMientrasEscribe(
  texto: string,
  cursor: number,
): { texto: string; cursor: number } {
  // Los puntos son separadores de miles y se descartan; se vuelven a poner
  // más abajo según corresponda al largo final.
  let limpio = texto.replace(/\./g, '').replace(/[^\d,]/g, '');

  // Una sola coma, y a lo sumo dos decimales detrás.
  const primeraComa = limpio.indexOf(',');
  if (primeraComa !== -1) {
    limpio =
      limpio.slice(0, primeraComa + 1) +
      limpio.slice(primeraComa + 1).replace(/,/g, '').slice(0, 2);
  }

  const digitosAntes = texto.slice(0, cursor).replace(/[^\d]/g, '').length;

  const [entero, decimales] = limpio.split(',');
  const conMiles = entero.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const salida = decimales !== undefined ? `${conMiles},${decimales}` : conMiles;

  // Escribiendo al final —el caso normal— el cursor va al final y listo.
  // Contar dígitos ahí daría mal: con «40.000,» lo dejaría antes de la coma
  // y el decimal siguiente se metería entre los miles.
  if (cursor >= texto.length) return { texto: salida, cursor: salida.length };

  // Editando en el medio: después del mismo dígito que tenía delante.
  let vistos = 0;
  let nuevoCursor = salida.length;
  for (let i = 0; i < salida.length; i++) {
    if (/\d/.test(salida[i])) vistos++;
    if (vistos === digitosAntes) { nuevoCursor = i + 1; break; }
  }
  if (digitosAntes === 0) nuevoCursor = 0;

  return { texto: salida, cursor: nuevoCursor };
}

export function parsearMonto(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '');
  if (!limpio) return NaN;

  if (limpio.includes(',')) {
    return Number(limpio.replace(/\./g, '').replace(',', '.'));
  }

  const puntos = limpio.split('.').length - 1;
  if (puntos === 1) {
    const decimales = limpio.split('.')[1];
    // Tres dígitos detrás del único punto: es separador de miles.
    if (decimales.length === 3) return Number(limpio.replace('.', ''));
    return Number(limpio);
  }

  // Varios puntos sólo pueden ser separadores de miles.
  return Number(limpio.replace(/\./g, ''));
}

/** 52500 -> "52.500,00". Para tickets y cobros, donde sí van los céntimos. */
export function bsExacto(valor: number | string | null | undefined): string {
  const n = typeof valor === 'string' ? Number(valor) : (valor ?? 0);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Equivalencia en dólares a la tasa del día. */
export function usd(montoBs: number | string, tasa: number | string | null | undefined): string {
  const t = typeof tasa === 'string' ? Number(tasa) : tasa;
  const m = typeof montoBs === 'string' ? Number(montoBs) : montoBs;
  if (!t || !Number.isFinite(t) || t === 0 || !Number.isFinite(m)) return '—';
  return `$${new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(m / t)}`;
}

export function hora(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

export function fechaCorta(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
}

export function fechaLarga(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso)
    .toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase();
}

/**
 * Reparto confirmado por el dueño: el ganador se lleva lo jugado en la tabla
 * más el pote, y la casa retiene su comisión de ese bolsillo.
 * Se calcula también en el backend; acá se repite sólo para pintar el
 * estimado en vivo mientras se remata, sin ir al servidor en cada puja.
 */
export function repartoDeTabla(totalJugado: number, pote: number, comisionPct: number) {
  const bolsillo = totalJugado + pote;
  const retieneCasa = Math.round(bolsillo * (comisionPct / 100));
  return { bolsillo, alGanador: bolsillo - retieneCasa, retieneCasa };
}
