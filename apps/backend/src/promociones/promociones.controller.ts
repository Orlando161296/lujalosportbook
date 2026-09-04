import {
  Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, Patch,
  Post, StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PromocionesService, ArchivoSubido } from './promociones.service';
import { CambiarActivaDto } from './dto';

/**
 * Techo duro de multer, muy por encima del máximo del producto.
 *
 * Son dos límites con trabajos distintos. Los 8 MB de PromocionesService son
 * la regla del negocio, y la rechaza el service porque para entonces ya tiene
 * el archivo y puede decir cuánto pesaba de verdad: «pesa 12,4 MB y el máximo
 * son 8 MB», que es lo que le sirve a quien está subiendo. Este techo sólo
 * evita que una subida enorme se bufferice entera en memoria antes de llegar
 * a esa comprobación.
 *
 * Va holgado a propósito. Puesto en 8 MB, la foto sacada del teléfono sin
 * achicar —que es justamente el error que se comete en el local— moriría acá
 * con un «File too large» en inglés, sin el tamaño y sin decir qué hacer. Así
 * el rechazo normal lo sigue explicando el service y esto sólo ataja lo que
 * ya no es un aviso mal exportado sino un archivo que no tiene por qué entrar.
 */
const TECHO_BYTES = 32 * 1024 * 1024;

@Controller('promociones')
export class PromocionesController {
  constructor(private readonly promociones: PromocionesService) {}

  /** Para la pantalla de administración: todas, activas y bajadas. */
  @Get()
  listar() {
    return this.promociones.listar();
  }

  /** Para la pizarra: sólo lo que tiene que rotar en el televisor. */
  @Get('activas')
  activas() {
    return this.promociones.activas();
  }

  /**
   * Los bytes de la imagen.
   *
   * Se sirve por acá y no con archivos estáticos para que la única forma de
   * llegar a la carpeta sea por un id que existe en la base: no hay ninguna
   * ruta que venga del cliente y termine tocando el disco.
   */
  // El televisor rota estas imágenes todo el día: sin caché serían una
  // descarga por vuelta. El id no se reusa, así que una imagen distinta
  // siempre trae una URL nueva y el caché no puede quedar viejo.
  @Get(':id/imagen')
  @Header('Cache-Control', 'public, max-age=86400')
  async imagen(@Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    const { flujo, mime } = await this.promociones.archivoDe(id);
    return new StreamableFile(flujo, { type: mime });
  }

  @Post()
  @UseInterceptors(FileInterceptor('imagen', { limits: { fileSize: TECHO_BYTES } }))
  subir(@UploadedFile() imagen: ArchivoSubido) {
    return this.promociones.subir(imagen);
  }

  @Patch(':id')
  cambiarActiva(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarActivaDto) {
    return this.promociones.cambiarActiva(id, dto.activa);
  }

  @Delete(':id')
  @HttpCode(204)
  borrar(@Param('id', ParseIntPipe) id: number) {
    return this.promociones.borrar(id);
  }
}
