/**
 * La fecha de una jornada es una fecha civil ("el domingo 17"), no un
 * instante: no tiene hora ni zona. Se guarda como medianoche UTC de ese día
 * civil, que es una representación sin ambigüedad, y se compara siempre así.
 *
 * El día civil es el LOCAL del centro hípico, no el UTC. En Venezuela (UTC−4)
 * una jornada de las 8 de la noche del 22 ya es 23 en UTC: si el resumen del
 * día se calculara en UTC, esa jornada no aparecería en "hoy" justo mientras
 * se está rematando, que es cuando más se mira la pantalla.
 */
export function diaUtc(fecha: string | Date): Date {
  if (typeof fecha === 'string') {
    // 'YYYY-MM-DD' viene de un <input type="date">: ya es una fecha civil,
    // se toma tal cual sin dejar que la zona la corra un día.
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    if (soloFecha) {
      const [, a, m, d] = soloFecha;
      return new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
    }
    fecha = new Date(fecha);
  }
  // Un Date (típicamente `new Date()`, "ahora") se lee en hora local: el día
  // que vive el operador es el que manda.
  return new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
}

/** Rango [desde, hasta) que cubre el día civil completo de `fecha`. */
export function rangoDelDia(fecha: string | Date): { desde: Date; hasta: Date } {
  const desde = diaUtc(fecha);
  return { desde, hasta: new Date(desde.getTime() + 24 * 60 * 60 * 1000) };
}
