import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { mkdir, writeFile, unlink, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { carpetaDeDatos } from '../impresion/impresora.config';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

/** Lo que llega de multer. Se declara acá para no depender de @types/multer. */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Formatos que el televisor muestra sin sorpresas.
 *
 * La lista es blanca y no negra a propósito: lo que se sube termina servido
 * por el backend y pintado a pantalla completa en el salón, así que la
 * pregunta correcta es «¿qué permitimos?» y no «¿qué prohibimos?». Se deja
 * afuera el SVG, que es un documento con scripts adentro y no una imagen.
 */
const TIPOS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * 8 MB. Es holgado para un aviso de 1920 px de ancho y frena la foto sacada
 * del teléfono sin achicar, que son 20 MB y tardan en cargar en el TV.
 *
 * Es el límite que se le explica al usuario. El controller tiene además un
 * techo más alto para que multer no bufferice cualquier cosa en memoria; ese
 * no rechaza avisos, sólo corta lo que nunca fue uno.
 */
const MAXIMO_BYTES = 8 * 1024 * 1024;

/**
 * Las imágenes del pie de la pizarra.
 *
 * Los archivos van a disco y la base guarda sólo la ficha. Un .db con
 * binarios adentro engorda rápido y el respaldo diario —que es lo único que
 * salva una jornada perdida— se vuelve lento justo cuando más se necesita.
 *
 * La carpeta se resuelve por entorno porque en desarrollo el backend corre
 * desde apps/backend y en producción como sidecar de Tauri, con otro
 * directorio de trabajo.
 */
@Injectable()
export class PromocionesService {
  private readonly log = new Logger('Promociones');
  // Cuelga de la carpeta de datos común —la misma de la base y la config de
  // la impresora— para que instalada quede en el AppData del usuario y no en
  // Archivos de Programa, que es de sólo lectura.
  private readonly carpeta = resolve(
    process.env.PROMOCIONES_DIR?.trim() || join(carpetaDeDatos(), 'promociones'),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventsGateway,
  ) {}

  /**
   * Todas, incluidas las bajadas: la pantalla de administración necesita ver
   * las inactivas para poder volver a levantarlas.
   */
  listar() {
    return this.prisma.promocion.findMany({
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
  }

  /** Sólo lo que el televisor tiene que rotar. */
  activas() {
    return this.prisma.promocion.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
  }

  async subir(archivo: ArchivoSubido | undefined) {
    if (!archivo) throw new BadRequestException('No llegó ningún archivo.');

    const extension = TIPOS[archivo.mimetype];
    if (!extension) {
      throw new BadRequestException(
        `Formato no admitido (${archivo.mimetype}). Se aceptan JPG, PNG, WEBP y GIF.`,
      );
    }
    if (archivo.size > MAXIMO_BYTES) {
      const mb = (archivo.size / 1024 / 1024).toFixed(1);
      throw new BadRequestException(`La imagen pesa ${mb} MB y el máximo son 8 MB.`);
    }

    // El nombre en disco lo inventa el backend. El que trae el navegador es
    // texto del usuario y puede traer barras o «..»: usado como ruta, saca
    // el archivo de la carpeta. El original se guarda aparte, sólo para
    // mostrarlo.
    const nombreEnDisco = `${randomUUID()}${extension}`;

    await mkdir(this.carpeta, { recursive: true });
    await writeFile(join(this.carpeta, nombreEnDisco), archivo.buffer);

    // Al final de la fila: lo que se sube hoy no se cuela adelante de lo que
    // ya está rotando.
    const ultima = await this.prisma.promocion.findFirst({ orderBy: { orden: 'desc' } });

    const creada = await this.prisma.promocion.create({
      data: {
        archivo: nombreEnDisco,
        nombre: archivo.originalname.slice(0, 120),
        mime: archivo.mimetype,
        bytes: archivo.size,
        orden: (ultima?.orden ?? 0) + 1,
      },
    });

    this.eventos.promocionesCambiaron();
    this.log.log(`Alta «${creada.nombre}» (${(archivo.size / 1024).toFixed(0)} KB)`);
    return creada;
  }

  /** Bajar o volver a subir una sin perder el archivo. */
  async cambiarActiva(id: number, activa: boolean) {
    await this.buscar(id);
    const promocion = await this.prisma.promocion.update({ where: { id }, data: { activa } });
    this.eventos.promocionesCambiaron();
    return promocion;
  }

  async borrar(id: number) {
    const promocion = await this.buscar(id);

    // Primero la fila y después el archivo: si el borrado del archivo falla
    // —permisos, disco— queda un huérfano en la carpeta, que no molesta a
    // nadie. Al revés dejaría una ficha apuntando a un archivo que no está,
    // y eso sí rompe la pizarra.
    await this.prisma.promocion.delete({ where: { id } });
    await unlink(join(this.carpeta, promocion.archivo)).catch((causa) => {
      this.log.warn(`Ficha ${id} borrada, pero quedó el archivo: ${(causa as Error).message}`);
    });

    this.eventos.promocionesCambiaron();
    this.log.log(`Baja «${promocion.nombre}»`);
  }

  /**
   * El archivo listo para responder, ya resuelto contra la carpeta.
   *
   * La ruta se arma con el nombre que generó `subir`, nunca con algo que
   * venga de la petición: el cliente manda un id numérico y la traducción a
   * archivo la hace la base.
   */
  async archivoDe(id: number) {
    const promocion = await this.buscar(id);
    const ruta = join(this.carpeta, promocion.archivo);
    try {
      await stat(ruta);
    } catch {
      throw new NotFoundException('La imagen ya no está en el disco.');
    }
    return { flujo: createReadStream(ruta), mime: promocion.mime };
  }

  private async buscar(id: number) {
    const promocion = await this.prisma.promocion.findUnique({ where: { id } });
    if (!promocion) throw new NotFoundException('Promoción no encontrada');
    return promocion;
  }
}
