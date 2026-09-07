// Aplica las migraciones pendientes a la base al arrancar.
//
// Por qué existe: la app instalada no lleva el CLI de Prisma —son 100 MB de
// engines por plataforma— ni tiene forma de correr `prisma migrate deploy`.
// Pero cada actualización que toque el esquema necesita que la base del local
// se ponga al día SOLA, sin que nadie abra una terminal. Este runner hace lo
// mínimo de `migrate deploy`: mira qué falta en `_prisma_migrations`, corre el
// `migration.sql` de cada carpeta pendiente y la anota.
//
// Limitaciones asumidas: parte el SQL por `;`, así que una migración con un
// `;` dentro de un literal de texto no funcionaría. Las migraciones de esquema
// que genera Prisma no tienen eso; una migración de datos compleja habría que
// revisarla a mano.

import { createHash, randomUUID } from 'node:crypto';
import { copyFile, readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { PrismaClient } from '@prisma/client';

const TABLA = '_prisma_migrations';

/** La ruta del archivo .db, si `DATABASE_URL` apunta a uno absoluto. */
function rutaDeBase(): string | null {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.startsWith('file:')) return null;
  const ruta = url.slice('file:'.length);
  return isAbsolute(ruta) ? ruta : null; // en desarrollo es `./dev.db`: sin respaldo
}

/** Quita las líneas de comentario y parte en sentencias ejecutables. */
function sentenciasDe(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function aplicarMigracionesPendientes(
  prisma: PrismaClient,
  dirMigraciones: string,
  log: (m: string) => void,
): Promise<string[]> {
  let carpetas: string[];
  try {
    const entradas = await readdir(dirMigraciones, { withFileTypes: true });
    // El nombre arranca con timestamp, así que ordenar alfabéticamente es
    // ordenar cronológicamente.
    carpetas = entradas.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch {
    log('Sin carpeta de migraciones; se asume la base al día.');
    return [];
  }
  if (carpetas.length === 0) return [];

  // La tabla de control, con la misma forma que la de Prisma. `IF NOT EXISTS`
  // por si la base viene de una instalación anterior a que Prisma la manejara.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${TABLA}" (
      "id"                    TEXT PRIMARY KEY NOT NULL,
      "checksum"              TEXT NOT NULL,
      "finished_at"           DATETIME,
      "migration_name"        TEXT NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        DATETIME,
      "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);

  const filas = await prisma.$queryRawUnsafe<{ migration_name: string }[]>(
    `SELECT migration_name FROM "${TABLA}" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  const hechas = new Set(filas.map((f) => f.migration_name));
  const pendientes = carpetas.filter((c) => !hechas.has(c));
  if (pendientes.length === 0) return [];

  log(`Migraciones pendientes: ${pendientes.join(', ')}`);

  // Respaldo antes de tocar nada, y sólo cuando hay algo que aplicar.
  const base = rutaDeBase();
  if (base) {
    const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    try {
      await copyFile(base, `${base}.respaldo-${sello}`);
      log(`Respaldo en ${base}.respaldo-${sello}`);
    } catch (causa) {
      log(`No se pudo respaldar (${(causa as Error).message}); se continúa igual.`);
    }
  }

  for (const nombre of pendientes) {
    const sql = await readFile(join(dirMigraciones, nombre, 'migration.sql'), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const id = randomUUID();

    // Todo en una transacción: si algo falla, la base queda como estaba.
    // `defer_foreign_keys` deja las validaciones de clave foránea para el
    // commit, que es lo que necesita el patrón «tabla nueva + copiar + borrar»
    // que Prisma usa para cambiar columnas en SQLite.
    await prisma.$transaction(
      async (tx) => {
        try {
          await tx.$executeRawUnsafe('PRAGMA defer_foreign_keys=ON');
        } catch {
          /* algunos drivers no dejan PRAGMA en transacción; el patrón igual
             funciona porque `promociones` no tiene claves foráneas entrantes */
        }
        for (const sentencia of sentenciasDe(sql)) {
          await tx.$executeRawUnsafe(sentencia);
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO "${TABLA}"
             (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES (?, ?, ?, current_timestamp, current_timestamp, 1)`,
          id, checksum, nombre,
        );
      },
      { timeout: 60_000 },
    );
    log(`Aplicada ${nombre}`);
  }

  return pendientes;
}
