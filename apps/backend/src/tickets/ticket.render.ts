// Render del ticket térmico.
//
// El formato NO es una decisión de implementación: replica el ticket del
// wireframe que los dueños ya aprobaron, campo por campo y en su orden.
// Cualquier cambio acá cambia lo que el cliente recibe en la mano, así que
// se toca sólo con el wireframe actualizado delante.
//
// El ancho es parámetro y no constante porque el local imprime hoy en una
// térmica de 58 mm y puede pasarse a una de 80 mm sin avisar: el mismo
// ticket tiene que salir bien en las dos. Todo se construye contra el número
// de columnas, así que la previsualización en pantalla es exactamente lo que
// va a salir en papel en cualquiera de los dos anchos.

/** Fuente A (12 dots de ancho): 384 dots de papel útil / 12 = 32 columnas. */
export const ANCHO_58MM = 32;
/** Fuente A: 576 dots de papel útil / 12 = 48 columnas. */
export const ANCHO_80MM = 48;

/**
 * Columnas de una térmica según el papel que carga.
 *
 * Sólo se contemplan los dos formatos que existen en el mercado local; ante
 * cualquier otro valor se cae a 58 mm, que es el angosto: un ticket armado
 * para 32 columnas entra en un papel de 80 mm (queda con margen a la
 * derecha), pero uno de 48 columnas en 58 mm se corta y pierde los montos.
 */
export function columnasDeMm(mm: number): number {
  return mm >= 80 ? ANCHO_80MM : ANCHO_58MM;
}

/** Bs con separador de miles y SIEMPRE dos decimales: es un comprobante. */
export function montoBs(valor: number | string): string {
  const n = typeof valor === 'string' ? Number(valor) : valor;
  if (!Number.isFinite(n)) return '0,00';
  const [ent, dec] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** dd/mm/aa hh:mm — el año va en dos dígitos, como en el wireframe. */
const fechaHora = (d: Date) =>
  `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${dos(d.getFullYear() % 100)} ` +
  `${dos(d.getHours())}:${dos(d.getMinutes())}`;

/** Las primitivas de maquetado, atadas al ancho del papel que toque. */
function cajaDe(ancho: number) {
  const linea = (c = '-') => c.repeat(ancho);

  const centrar = (t: string) => {
    const s = t.slice(0, ancho);
    return ' '.repeat(Math.max(0, Math.floor((ancho - s.length) / 2))) + s;
  };

  /** Etiqueta a la izquierda, valor pegado al margen derecho. */
  const par = (etiqueta: string, valor: string) => {
    const libre = ancho - etiqueta.length - valor.length;
    if (libre < 1) return `${etiqueta}\n${valor.padStart(ancho)}`;
    return etiqueta + ' '.repeat(libre) + valor;
  };

  /**
   * Igual que `par`, pero recorta el valor a lo que quede libre en vez de
   * empujarlo a una segunda línea. Para los textos largos y sin formato
   * —nombre del hipódromo, del cliente— donde perder la cola es preferible
   * a partir el bloque de cabecera en dos.
   */
  const parRecortado = (etiqueta: string, valor: string) =>
    par(etiqueta, valor.slice(0, Math.max(0, ancho - etiqueta.length - 1)));

  /** Parte un texto en líneas del ancho del papel, sin cortar palabras. */
  const parrafo = (texto: string): string[] => {
    const lineas: string[] = [];
    let actual = '';
    for (const palabra of texto.split(/\s+/).filter(Boolean)) {
      if (!actual.length) actual = palabra;
      else if (actual.length + 1 + palabra.length <= ancho) actual += ` ${palabra}`;
      else {
        lineas.push(actual);
        actual = palabra;
      }
    }
    if (actual.length) lineas.push(actual);
    return lineas;
  };

  return { linea, centrar, par, parRecortado, parrafo };
}

export interface JugadaTicket {
  tabla: string;
  numero: number;
  ejemplar: string;
  monto: number;
  /**
   * Lo que cobra el dueño de esta jugada si su ejemplar gana:
   * `(jugado en la tabla + pote) × (1 − comisión)`, dividido entre los
   * ganadores si hubo empate. Ojo: NO depende de lo que pagó por la jugada
   * —el ganador se lleva el bolsillo entero de su tabla—, así que dos
   * jugadas del mismo ticket no se suman: sólo cobra la que gane.
   * null si la tabla no se pudo resolver.
   */
  cobraSiGana: number | null;
  /** La tabla ya cerró: la cifra de arriba es definitiva, no estimada. */
  tablaCerrada: boolean;
  /** null mientras la carrera no tenga resultado registrado. */
  gano: boolean | null;
}

export interface DatosTicket {
  numero: number;
  emitidoEn: Date;
  hipodromo: string;
  carreraNumero: number;
  cliente: string;
  taquilla: string | null;
  operador: string;
  moneda: string;
  tasaAplicada: number | null;
  totalBs: number;
  /** Qué fracción del total rematado de la carrera representa este ticket. */
  proporcionPct: number | null;
  jugadas: JugadaTicket[];
}

export function renderTicket(d: DatosTicket, ancho: number = ANCHO_58MM): string {
  const { linea, centrar, par, parRecortado, parrafo } = cajaDe(ancho);
  // En 32 columnas la etiqueta y el monto se pelean el renglón: con seis
  // dígitos de premio, «si gana cobra (est.)» ya no entra y `par` partiría
  // la línea en dos. Angosto se abrevia.
  const angosto = ancho < ANCHO_80MM;
  const l: string[] = [];

  l.push(centrar('SPORTBOOK LUJALO'));

  // Taquilla y operador van juntos si entran, y en dos renglones si no. En
  // 32 columnas «Taquilla 1 · Operador Administrador» se pasaba de largo y
  // `centrar` lo cortaba a cuchillo: el papel salía con «Operador A», que no
  // identifica a nadie — y el operador impreso es justamente lo que hace del
  // ticket un comprobante rastreable.
  //
  // El nombre de la taquilla no se prefija si ya se llama «Taquilla algo»:
  // el operador la bautiza desde Configuración y «Taquilla Taquilla 1» es lo
  // que salía cuando lo hacía.
  const taquilla = d.taquilla
    ? (/^taquilla\b/i.test(d.taquilla.trim()) ? d.taquilla : `Taquilla ${d.taquilla}`)
    : null;
  const operador = `Operador ${d.operador}`;
  const juntos = [taquilla, operador].filter(Boolean).join(' · ');

  if (juntos.length <= ancho) {
    l.push(centrar(juntos));
  } else {
    if (taquilla) l.push(centrar(taquilla));
    l.push(centrar(operador));
  }
  l.push(linea('='));

  // El tipo de juego encabeza el bloque a propósito: el sistema ya contempla
  // Ganadores, Tablas Fijas y 5 y 6, y el papel no puede quedar ambiguo el
  // día que convivan dos juegos en la misma taquilla.
  l.push(par('TIPO DE JUEGO', 'REMATE'));
  l.push(parRecortado('HIPÓDROMO', d.hipodromo));
  l.push(par('N° DE CARRERA', String(d.carreraNumero)));
  l.push(par('TICKET', String(d.numero).padStart(6, '0')));
  l.push(par('FECHA', fechaHora(d.emitidoEn)));
  l.push(parRecortado('CLIENTE', d.cliente));
  l.push(linea());

  l.push(par('N° EJEMPLAR / TABLA', 'MONTO'));
  l.push(linea());

  // Una línea por jugada: «7 ABSOLUTO · T1» a la izquierda, monto a la
  // derecha. Un ticket agrupa TODAS las jugadas que el cliente se llevó en
  // la carrera — por eso el modelo tiene un Ticket con muchas Jugada.
  //
  // Debajo de cada una va lo que cobra si ese ejemplar gana. Es el dato que
  // el cliente pregunta apenas recibe el papel, y tenerlo impreso evita que
  // el operador lo recalcule de memoria en medio del remate.
  const hayResultado = d.jugadas.some((j) => j.gano != null);
  let algunaAbierta = false;

  for (const j of d.jugadas) {
    const monto = montoBs(j.monto);
    const espacio = ancho - monto.length - 1;
    // Lo que se recorta es el NOMBRE, nunca el renglón entero: el número y
    // la tabla son los dos datos con los que se identifica la jugada al
    // cobrar, y en 32 columnas un ejemplar de nombre largo se comía el
    // «· T2» y dejaba el ticket sin decir en qué tabla se jugó.
    const fijo = `${j.numero} ` + ` · ${j.tabla}`;
    const nombre = j.ejemplar.slice(0, Math.max(1, espacio - fijo.length));
    l.push(`${`${j.numero} ${nombre} · ${j.tabla}`.padEnd(espacio)} ${monto}`);

    if (j.cobraSiGana == null) continue;
    if (!j.tablaCerrada) algunaAbierta = true;

    if (j.gano === false) {
      l.push(par('  no cobra', '-'));
    } else {
      // El «GANÓ» va en el renglón del cobro y no en el del ejemplar: en el
      // del ejemplar compite por espacio con el nombre y el monto, y al
      // recortarse quedaba un «** GANÓ» pegado a la cifra.
      //
      // Con la tabla abierta el bolsillo todavía puede subir: la cifra es
      // una estimación al momento de emitir, y el papel tiene que decirlo.
      const etiqueta = j.gano
        ? '  ** GANÓ ** cobra'
        : j.tablaCerrada
          ? angosto ? '  si gana' : '  si gana cobra'
          : angosto ? '  si gana (est.)' : '  si gana cobra (est.)';
      l.push(par(etiqueta, montoBs(j.cobraSiGana)));
    }
  }

  l.push(linea());
  l.push(par('MONTO JUGADO', `${montoBs(d.totalBs)} Bs`));
  if (d.proporcionPct != null) {
    l.push(par('PROPORCIÓN', `${d.proporcionPct.toFixed(2).replace('.', ',')} %`));
  }
  // La tasa queda congelada en el papel: si el cliente pagó en dólares, la
  // divisa no se recalcula después con otra tasa (Ticket.tasaAplicada).
  l.push(par(
    'PAGÓ EN',
    d.tasaAplicada ? `${d.moneda} · tasa ${montoBs(d.tasaAplicada)}` : d.moneda,
  ));
  l.push(par('TOTAL A PAGAR', `${montoBs(d.totalBs)} Bs`));

  // Con el resultado ya cantado el ticket deja de ser una promesa y pasa a
  // ser el comprobante de cuánto hay que entregarle: ahí sí se suma, porque
  // se sabe qué jugadas ganaron de verdad.
  if (hayResultado) {
    const cobra = d.jugadas
      .filter((j) => j.gano)
      .reduce((s, j) => s + (j.cobraSiGana ?? 0), 0);
    l.push(linea());
    l.push(par('TOTAL A COBRAR', `${montoBs(cobra)} Bs`));
  }

  l.push(linea('='));

  // Sin resultado, los «si gana» son escenarios excluyentes entre sí. Un
  // cliente con dos jugadas los sumaría, y el número que se armaría en la
  // cabeza no existe: el ganador se lleva el bolsillo de UNA tabla.
  if (!hayResultado && d.jugadas.some((j) => j.cobraSiGana != null)) {
    l.push(...parrafo(
      'Los montos de «si gana» no se suman: se cobra sólo por la jugada que gane.',
    ));
    if (algunaAbierta) {
      l.push(...parrafo(
        'Los marcados (est.) son estimados al momento de emitir: la tabla sigue abierta y el bolsillo puede subir.',
      ));
    }
    l.push(linea('='));
  }

  // El correlativo es lo que se busca en el historial y lo que el cliente
  // presenta para cobrar: por eso se repite al pie.
  l.push(...parrafo(`${String(d.numero).padStart(6, '0')} · conserve este ticket para el cobro`).map(centrar));
  l.push(...parrafo('válido solo para la carrera indicada').map(centrar));
  l.push('');
  return l.join('\n');
}
