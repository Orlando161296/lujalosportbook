// Configuración de la impresora, leída del entorno.
//
// Vive en el .env y no en la base porque es una propiedad de LA PC, no del
// negocio: si mañana el local suma una segunda máquina con otra impresora,
// cada una necesita la suya, y una fila en SQLite compartida diría lo mismo
// para las dos. El día que haya que cambiarla desde Configuración, esto pasa
// a ser una tabla y el resto del código no se entera.

import { ANCHO_58MM, ANCHO_80MM, columnasDeMm } from '../tickets/ticket.render';

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
