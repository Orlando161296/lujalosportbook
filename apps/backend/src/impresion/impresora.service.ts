import { Injectable, Logger } from '@nestjs/common';
import { writeFile, unlink } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  INICIALIZAR, TABLA_PC850, alinear, avanzar, CORTAR, codificarPC850,
} from './escpos';
import { ConfigImpresora, leerConfigImpresora } from './impresora.config';

/** Falla de impresión, con el destino adentro para que el mensaje sirva. */
export class ImpresionFallida extends Error {
  constructor(readonly destino: string, causa: unknown) {
    super(`No se pudo imprimir en ${destino}: ${(causa as Error)?.message ?? causa}`);
    this.name = 'ImpresionFallida';
  }
}

/**
 * El driver de la térmica.
 *
 * Toma el texto que arma el render y lo pone en el papel. Todo lo que sabe
 * del ticket es que es texto plano ya maquetado al ancho correcto: el
 * formato es problema de ticket.render, el papel es problema de acá.
 *
 * Los tres destinos (log, USB/compartida, red) se resuelven con Node pelado
 * —`fs` y `net`—, sin dependencias nativas. Eso importa porque el backend se
 * empaqueta como sidecar de la app Tauri: un módulo compilado obligaría a
 * cruzar-compilar para Windows cada vez que se arme el instalador.
 */
@Injectable()
export class ImpresoraService {
  private readonly log = new Logger('Impresora');
  readonly config: ConfigImpresora;

  constructor() {
    this.config = leerConfigImpresora();
    this.log.log(
      `Destino ${this.config.destino} · ${this.config.anchoMm} mm · ` +
      `${this.config.columnas} columnas` +
      (this.config.destino === 'usb' ? ` · ${this.config.ruta ?? 'SIN RUTA'}` : '') +
      (this.config.destino === 'red' ? ` · ${this.config.host}:${this.config.puerto}` : ''),
    );
  }

  /** Las columnas contra las que hay que maquetar el ticket. */
  get columnas(): number {
    return this.config.columnas;
  }

  /**
   * Manda un ticket ya maquetado al papel.
   *
   * Lanza ImpresionFallida si el papel no salió. Quien llama decide qué hace
   * con eso: la emisión del ticket NO se cae por una impresora sin papel
   * —la plata ya se cobró y el número ya se gastó—, pero el botón de
   * reimprimir sí tiene que avisarle al operador.
   */
  async imprimir(texto: string): Promise<void> {
    const bytes = this.armar(texto);

    switch (this.config.destino) {
      case 'log':
        // Sin impresora configurada el ticket va al log completo, no un
        // «no se pudo»: así el local puede operar y cobrar aunque la
        // térmica esté desenchufada, que es como se trabajó hasta hoy.
        this.log.log(`\n${texto}`);
        return;

      case 'usb':
        return this.aDispositivo(bytes);

      case 'red':
        return this.aRed(bytes);
    }
  }

  /** El ticket envuelto en los comandos de la impresora. */
  private armar(texto: string): Buffer {
    const partes = [
      INICIALIZAR,
      TABLA_PC850,
      alinear(0),
      codificarPC850(texto.endsWith('\n') ? texto : `${texto}\n`),
      avanzar(this.config.avance),
    ];
    if (this.config.corta) partes.push(CORTAR);
    return Buffer.concat(partes);
  }

  /**
   * Escribe al dispositivo: `/dev/usb/lp0`, `/dev/ttyUSB0` o el nombre UNC
   * de una impresora compartida en Windows (`\\localhost\TICKETERA`).
   *
   * En Windows la térmica se comparte desde Impresoras y dispositivos y se
   * escribe al recurso compartido: es la vía que no necesita un driver
   * nativo ni permisos de administrador.
   */
  private async aDispositivo(bytes: Buffer): Promise<void> {
    const ruta = this.config.ruta;
    if (!ruta) {
      throw new ImpresionFallida(
        'USB',
        new Error('falta IMPRESORA_RUTA en el .env (p. ej. /dev/usb/lp0)'),
      );
    }
    try {
      // 'w' y no 'a': un dispositivo de caracteres no tiene posición donde
      // agregar, y para el recurso compartido de Windows es la única forma
      // que abre un trabajo de impresión nuevo.
      await writeFile(ruta, bytes, { flag: 'w' });
    } catch (causa) {
      // Un recurso compartido de impresora en Windows no es un archivo:
      // según cómo esté publicada la cola, abrirlo para escribir falla. El
      // camino que sí funciona siempre es volcar a un temporal y copiarlo en
      // binario al compartido, que es lo que hace el `copy /b` de toda la
      // vida. Se intenta primero lo directo porque cuando anda evita el
      // rebote por disco.
      if (process.platform === 'win32' && ruta.startsWith('\\\\')) {
        return this.aCompartidoWindows(ruta, bytes);
      }
      throw new ImpresionFallida(ruta, causa);
    }
  }

  /** `copy /b temporal \\PC\COLA` — la vía de Windows para mandar RAW. */
  private async aCompartidoWindows(ruta: string, bytes: Buffer): Promise<void> {
    const temporal = join(tmpdir(), `lujalo-ticket-${Date.now()}.bin`);
    try {
      await writeFile(temporal, bytes);
      await new Promise<void>((resolver, rechazar) => {
        // execFile con los argumentos separados: la ruta sale del .env, pero
        // igual no se arma una línea de comandos que el shell reinterprete.
        execFile('cmd', ['/c', 'copy', '/b', temporal, ruta], (error, _salida, errSalida) => {
          if (error) rechazar(new Error(errSalida?.trim() || error.message));
          else resolver();
        });
      });
    } catch (causa) {
      throw new ImpresionFallida(ruta, causa);
    } finally {
      await unlink(temporal).catch(() => {});
    }
  }

  /** Impresora de red por el puerto RAW 9100. */
  private aRed(bytes: Buffer): Promise<void> {
    const { host, puerto, timeoutMs } = this.config;
    if (!host) {
      throw new ImpresionFallida('red', new Error('falta IMPRESORA_HOST en el .env'));
    }

    return new Promise<void>((resolver, rechazar) => {
      const socket = createConnection({ host, port: puerto });
      let terminado = false;

      const fallar = (causa: unknown) => {
        if (terminado) return;
        terminado = true;
        socket.destroy();
        rechazar(new ImpresionFallida(`${host}:${puerto}`, causa));
      };

      // Sin timeout una impresora apagada deja la petición colgada hasta el
      // timeout de TCP del sistema —minutos—, y el operador se queda mirando
      // el botón en medio del remate.
      socket.setTimeout(timeoutMs);
      socket.on('timeout', () => fallar(new Error(`sin respuesta en ${timeoutMs} ms`)));
      socket.on('error', fallar);

      socket.on('connect', () => {
        // El end() sólo se cierra cuando el buffer terminó de salir, así que
        // el 'close' de abajo ya implica que la impresora recibió todo.
        socket.end(bytes);
      });

      socket.on('close', (conError) => {
        if (terminado) return;
        terminado = true;
        if (conError) rechazar(new ImpresionFallida(`${host}:${puerto}`, new Error('conexión cortada')));
        else resolver();
      });
    });
  }

  /**
   * Página de prueba.
   *
   * Existe para poder verificar la térmica sin rematar una carrera y
   * cobrarle a alguien: el día que se conecta hay que probar el ancho, los
   * acentos y el avance del papel, y hacerlo emitiendo tickets reales gasta
   * correlativos que después quedan en el historial para siempre.
   */
  async imprimirPrueba(): Promise<void> {
    const { columnas, anchoMm, destino, corta } = this.config;
    const centro = (t: string) =>
      ' '.repeat(Math.max(0, Math.floor((columnas - t.length) / 2))) + t;
    const par = (a: string, b: string) =>
      a + ' '.repeat(Math.max(1, columnas - a.length - b.length)) + b;

    const l = [
      centro('SPORTBOOK LUJALO'),
      centro('PRUEBA DE IMPRESORA'),
      '='.repeat(columnas),
      par('PAPEL', `${anchoMm} mm`),
      par('COLUMNAS', String(columnas)),
      par('DESTINO', destino),
      par('CORTE', corta ? 'automatico' : 'a mano'),
      '-'.repeat(columnas),
      // La regla marca dónde termina el papel: si el último dígito no sale
      // completo, el ancho configurado no es el real de la impresora.
      centro('REGLA DE ANCHO'),
      Array.from({ length: columnas }, (_, i) => String((i + 1) % 10)).join(''),
      '-'.repeat(columnas),
      // Si acá salen símbolos raros, la impresora no tomó la tabla PC850.
      centro('ACENTOS'),
      'ÁÉÍÓÚ áéíóú ÑñÜü ¿¡ «»',
      'HIPÓDROMO · N° · PROPORCIÓN',
      '-'.repeat(columnas),
      par('MONTO', '1.234.567,89 Bs'),
      '='.repeat(columnas),
      centro('Si se lee todo, está lista.'),
      '',
    ];

    await this.imprimir(l.join('\n'));
  }

  /**
   * Qué impresora está configurada. La pantalla lo muestra para que el
   * operador sepa por qué el ticket sale angosto —o por qué no sale.
   */
  estado() {
    const { destino, anchoMm, columnas, ruta, host, puerto, corta } = this.config;
    return {
      destino,
      anchoMm,
      columnas,
      corta,
      conectada: destino !== 'log',
      donde: destino === 'usb' ? ruta : destino === 'red' ? `${host}:${puerto}` : null,
    };
  }
}
