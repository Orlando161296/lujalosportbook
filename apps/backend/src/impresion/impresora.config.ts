// Configuración de la impresora.
//
// No vive en la base porque es una propiedad de LA PC, no del negocio: si el
// local suma una segunda máquina con otra térmica, cada una necesita la suya,
// y una fila en SQLite compartida diría lo mismo para las dos.
//
// Pero tampoco vive ya en el .env. Esto se instala como programa nativo, y
// ahí no hay repo donde editar un archivo ni terminal donde reiniciar nada:
// se configura desde Configuración › Impresora y se guarda en un JSON al
// lado de la base. El .env quedó como semilla —lo que se lea de ahí la
// primera vez— para que las instalaciones que ya andan no cambien de
// comportamiento al actualizar.
//
// Orden de precedencia: archivo guardado > variables de entorno > defaults.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ANCHO_58MM, ANCHO_80MM, columnasDeMm } from '../tickets/ticket.render';

/**
 * La carpeta de datos de esta instalación: base, avisos y config de máquina.
 *
 * En desarrollo es `apps/backend/datos`. Instalado, el Rust de Tauri le pasa
 * el `AppData` del usuario por entorno, que es el único lugar de Windows
 * donde un programa puede escribir sin permisos de administrador. Un solo
 * lugar para todo lo que hay que respaldar.
 */
export function carpetaDeDatos(): string {
  return resolve(process.env.LUJALO_DATOS_DIR?.trim() || join(process.cwd(), 'datos'));
}

const rutaArchivo = () => join(carpetaDeDatos(), 'impresora.json');

/** Lo que se puede guardar. `columnas` no: sale del ancho, no se elige. */
export type ConfigGuardable = Omit<ConfigImpresora, 'columnas'>;

/**
 * A dónde salen los bytes.
 *
 * - `log`   — al log del backend, sin papel. Es el modo de desarrollo y el
 *             que queda si nadie configuró nada: nunca falla y deja ver el
 *             ticket completo.
 * - `usb`   — a un archivo de dispositivo o a una impresora compartida:
 *             `/dev/usb/lp0` en Linux, `\\localhost\TICKETERA` en Windows,
 *             `/dev/ttyUSB0` si la térmica entra por adaptador serie.
 * - `red`   — a una impresora con puerto Ethernet, por el 9100 (RAW).
 */
export type DestinoImpresora = 'log' | 'usb' | 'red';

export interface ConfigImpresora {
  destino: DestinoImpresora;
  /** 58 o 80. Lo que decide cuántas columnas entra el render. */
  anchoMm: number;
  columnas: number;
  /** Ruta del dispositivo o del recurso compartido, si `destino` es `usb`. */
  ruta: string | null;
  host: string | null;
  puerto: number;
  /**
   * Si la impresora trae guillotina. Las 58 mm de gama baja —la que hay hoy
   * en el local— no la traen: se corta a mano contra la barra dentada, y
   * mandar el comando de corte a una que no lo tiene puede dejarla colgada.
   */
  corta: boolean;
  /**
   * Líneas en blanco al final. Sin guillotina son imprescindibles: el
   * cabezal está unos centímetros por dentro de la barra de corte, y sin
   * avance el cliente se lleva el ticket sin el pie.
   */
  avance: number;
  /** Milisegundos de espera antes de dar la impresión por perdida. */
  timeoutMs: number;
}

const numero = (v: string | undefined, porDefecto: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

const booleano = (v: string | undefined, porDefecto: boolean) =>
  v == null || v === '' ? porDefecto : ['1', 'true', 'si', 'sí'].includes(v.toLowerCase());

/**
 * Deja los valores en el rango que la impresora admite.
 *
 * Se aplica tanto a lo que viene del entorno como a lo que llega por HTTP:
 * un ancho de 72 mm o un avance de 900 líneas no tienen que poder guardarse,
 * vengan de donde vengan.
 */
function normalizar(v: Partial<ConfigGuardable>, base: ConfigImpresora): ConfigImpresora {
  const destino: DestinoImpresora =
    v.destino === 'usb' || v.destino === 'red' || v.destino === 'log' ? v.destino : base.destino;
  // 58 u 80 y nada más: son los dos anchos que el render sabe maquetar.
  const anchoMm = v.anchoMm == null ? base.anchoMm : (Number(v.anchoMm) >= 80 ? 80 : 58);

  return {
    destino,
    anchoMm,
    columnas: columnasDeMm(anchoMm),
    ruta: v.ruta === undefined ? base.ruta : (v.ruta?.trim() || null),
    host: v.host === undefined ? base.host : (v.host?.trim() || null),
    puerto: v.puerto == null ? base.puerto : numero(String(v.puerto), base.puerto),
    // El default del corte sigue al ancho —las 80 mm traen guillotina y las
    // 58 de gama baja no—, pero sólo mientras nadie lo haya elegido a mano.
    corta: v.corta == null ? anchoMm >= 80 : Boolean(v.corta),
    avance: v.avance == null ? base.avance : Math.min(20, Math.max(0, Number(v.avance) || 0)),
    timeoutMs: v.timeoutMs == null ? base.timeoutMs : numero(String(v.timeoutMs), base.timeoutMs),
  };
}

/**
 * La configuración que rige: el archivo si existe, el entorno si no.
 *
 * Se relee en cada impresión en vez de cachearse al arrancar. Es leer un
 * JSON de doscientos bytes —al lado de mandar bytes por USB no se nota— y a
 * cambio cambiar de impresora desde la pantalla surte efecto en el ticket
 * siguiente, sin reiniciar nada. Reiniciar el backend era justamente lo que
 * no se puede pedir en un programa instalado.
 */
export function configVigente(): ConfigImpresora {
  const delEntorno = leerConfigImpresora();
  try {
    const crudo = readFileSync(rutaArchivo(), 'utf8');
    return normalizar(JSON.parse(crudo) as Partial<ConfigGuardable>, delEntorno);
  } catch {
    // No existe todavía, o quedó ilegible. En los dos casos el entorno es la
    // respuesta correcta: es peor no imprimir que imprimir con lo anterior.
    return delEntorno;
  }
}

/** Guarda y devuelve cómo quedó. Crea la carpeta si es la primera vez. */
export function guardarConfigImpresora(parcial: Partial<ConfigGuardable>): ConfigImpresora {
  const efectiva = normalizar(parcial, configVigente());
  const { columnas: _columnas, ...guardable } = efectiva;
  mkdirSync(carpetaDeDatos(), { recursive: true });
  writeFileSync(rutaArchivo(), JSON.stringify(guardable, null, 2), 'utf8');
  return efectiva;
}

export function leerConfigImpresora(env: NodeJS.ProcessEnv = process.env): ConfigImpresora {
  const destinoCrudo = (env.IMPRESORA_DESTINO ?? 'log').toLowerCase();
  const destino: DestinoImpresora =
    destinoCrudo === 'usb' || destinoCrudo === 'red' ? destinoCrudo : 'log';

  // 58 salvo que digan lo contrario: es la que está enchufada hoy, y
  // equivocarse hacia el angosto sólo desperdicia papel — al revés, corta
  // los montos. Ver columnasDeMm.
  const anchoMm = numero(env.IMPRESORA_ANCHO_MM, 58) >= 80 ? 80 : 58;

  return {
    destino,
    anchoMm,
    columnas: columnasDeMm(anchoMm),
    ruta: env.IMPRESORA_RUTA?.trim() || null,
    host: env.IMPRESORA_HOST?.trim() || null,
    puerto: numero(env.IMPRESORA_PUERTO, 9100),
    corta: booleano(env.IMPRESORA_CORTA, anchoMm >= 80),
    avance: numero(env.IMPRESORA_AVANCE, 4),
    timeoutMs: numero(env.IMPRESORA_TIMEOUT_MS, 5000),
  };
}

export { ANCHO_58MM, ANCHO_80MM };
