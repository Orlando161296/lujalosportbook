// Espejo de los modelos del backend. Los enums viajan como string porque
// SQLite no los soporta (ver nota en schema.prisma); acá se recuperan como
// uniones literales, que es lo que el código realmente necesita.

export type Rol = 'admin' | 'operador';
export type EstadoCarrera = 'planificada' | 'abierta' | 'cerrada';
export type EstadoEjemplar = 'activo' | 'retirado';
export type EstadoTabla = 'abierta' | 'cerrada';
export type EstadoJugada = 'activa' | 'anulada';
export type Moneda = 'Bs' | 'USD';
export type TipoCobro = 'cobro_apuesta' | 'pago_premio' | 'reembolso';

export interface Taquilla {
  id: number;
  nombre: string;
  activa: boolean;
}

export interface Usuario {
  id: number;
  nombre: string;
  usuario: string;
  rol: Rol;
  activo: boolean;
  taquillaId: number | null;
  taquilla?: Taquilla | null;
  puedeAnularJugadasPropias: boolean;
  puedeAnularJugadasDeOtros: boolean;
  puedeCambiarTasa: boolean;
  puedeCerrarCarrera: boolean;
  puedeVerResumen: boolean;
}

export interface Hipodromo {
  id: number;
  nombre: string;
  ciudad: string | null;
  tablasPorCarrera: number;
  disponibleParaRemate: boolean;
  activo: boolean;
}

export interface Jornada {
  id: number;
  hipodromoId: number;
  hipodromo?: Hipodromo;
  fecha: string;
  cantidadCarreras: number;
  estado: EstadoCarrera;
  carreras?: Carrera[];
}

export interface TasaCambio {
  id: number;
  vigenteDesde: string;
  valorBsPorUsd: string;
  origen: string;
  bloqueada: boolean;
  registradoPorId: number;
}

export interface ColorNumero {
  numero: number;
  nombre: string;
  colorHex: string;
  textoHex: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  nombrePizarra: string | null;
  telefono: string | null;
  notas: string | null;
  activo: boolean;
  esVip: boolean;
  nivel: string | null;
  limiteCreditoBs: string;
  tasaPreferencial: string | null;
  descuentoPct: string;
  puedeCreditoEnRemate: boolean;
  descontarDeudaDelPremio: boolean;
  puedePagarUsd: boolean;
  resaltadoEnPizarra: boolean;
}

export interface Ejemplar {
  id: number;
  carreraId: number;
  numero: number;
  nombre: string;
  estado: EstadoEjemplar;
  retiradoEn: string | null;
}

export interface Jugada {
  id: number;
  tablaId: number;
  ejemplarId: number;
  clienteId: number | null;
  cliente?: Cliente | null;
  // Postor sin registrar: el apodo con el que lo conoce el rematador, ya
  // normalizado en mayúsculas por el backend. Excluyente con `cliente`.
  apodo: string | null;
  esCasa: boolean;
  monto: string;
  moneda: Moneda;
  estado: EstadoJugada;
  taquillaId: number | null;
  ticketId: number | null;
  registradaEn: string;
  actualizadaEn: string | null;
  ejemplar?: Ejemplar;
  tabla?: Tabla;
}

export interface Tabla {
  id: number;
  carreraId: number;
  etiqueta: string;
  poteCasa: string;
  comisionPct: string;
  estado: EstadoTabla;
  jugadas?: Jugada[];
}

export interface CarreraGanador {
  carreraId: number;
  ejemplarId: number;
  ejemplar?: Ejemplar;
}

export interface Carrera {
  id: number;
  hipodromoId: number;
  hipodromo?: Hipodromo;
  jornadaId: number | null;
  fecha: string;
  numero: number;
  nombre: string | null;
  estado: EstadoCarrera;
}

/** Lo que devuelve GET /carreras/:id/pizarra: el snapshot de hidratación. */
export interface Pizarra extends Carrera {
  ejemplares: Ejemplar[];
  tablas: (Tabla & { jugadas: (Jugada & { cliente: Cliente | null })[] })[];
  ganadores: CarreraGanador[];
  tasaVigente: TasaCambio | null;
}

export interface Cobro {
  id: number;
  // Null cuando el cobro es de un postor que sólo dejó su apodo.
  clienteId: number | null;
  cliente?: Cliente | null;
  apodo: string | null;
  carreraId: number;
  tipo: TipoCobro;
  monto: string;
  moneda: Moneda;
  tasaAplicada: string | null;
  pagado: boolean;
  pagadoEn: string | null;
  // El ticket cuelga de las jugadas en el modelo; el backend lo sube al
  // nivel del cobro para que la pantalla pueda reimprimir sin recorrerlas.
  ticket?: Ticket | null;
}

export interface Ticket {
  id: number;
  numero: number;
  carreraId: number;
  clienteId: number | null;
  apodo: string | null;
  totalBs: string;
  moneda: Moneda;
  tasaAplicada: string | null;
  impresoEn: string | null;
  /**
   * Por qué no salió el papel, o null si salió.
   *
   * La emisión nunca falla por la impresora —la plata ya entró y el número
   * ya se gastó—, así que el problema viaja como dato: es lo único que le
   * avisa al operador que el cliente se está por ir sin comprobante.
   * Sólo viene al emitir; la reimpresión avisa por su propio error.
   */
  errorImpresion?: string | null;
}

/**
 * La térmica que tiene configurada esta PC.
 *
 * El local imprime hoy en 58 mm (32 columnas) y puede pasar a 80 mm (48) sin
 * más que cambiar el .env, así que la pantalla no puede dar por sentado
 * ninguno de los dos: lee el ancho de acá y rotula la vista previa con él.
 */
/** Una impresora que la máquina ya tiene, para elegirla de una lista. */
export interface ImpresoraDetectada {
  nombre: string;
  /** Lo que va en `ruta`. Null si todavía no se le puede escribir. */
  ruta: string | null;
  detalle: string;
  /** En Windows, sin compartir no hay forma de mandarle bytes. */
  listaParaUsar: boolean;
}

/** Lo que la pantalla manda al guardar. Todo opcional: se guarda de a partes. */
export interface CambiosImpresora {
  destino?: 'log' | 'usb' | 'red';
  anchoMm?: 58 | 80;
  ruta?: string | null;
  host?: string | null;
  puerto?: number;
  corta?: boolean;
  avance?: number;
}

export interface EstadoImpresora {
  destino: 'log' | 'usb' | 'red';
  anchoMm: number;
  columnas: number;
  corta: boolean;
  /** false cuando no hay impresora configurada y el ticket sale por el log. */
  conectada: boolean;
  /** La ruta o el host:puerto, para poder decir dónde falló. */
  donde: string | null;
}

export interface PagoGanador {
  tablaId: number;
  etiqueta: string;
  ejemplarId: number;
  clienteId: number | null;
  esCasa: boolean;
  clienteNombre: string;
  montoPago: string;
}

export interface ResultadoCarrera {
  ganadores: Ejemplar[];
  pagos: PagoGanador[];
}

/** Un aviso del pie de la pizarra, cargado desde Configuración. */
export interface Promocion {
  id: number;
  /** Nombre del archivo en disco. La pantalla no lo usa: se muestra `nombre`. */
  archivo: string;
  /** Con el que se subió, para poder reconocerlo en la lista. */
  nombre: string;
  mime: string;
  bytes: number;
  orden: number;
  /** Bajada sin borrar: no sale en el televisor pero el archivo sigue cargado. */
  activa: boolean;
  creadoEn: string;
}
