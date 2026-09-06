-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_promociones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL DEFAULT 'imagen',
    "archivo" TEXT,
    "texto" TEXT,
    "nombre" TEXT NOT NULL,
    "mime" TEXT,
    "bytes" INTEGER,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_promociones" ("activa", "archivo", "bytes", "creadoEn", "id", "mime", "nombre", "orden") SELECT "activa", "archivo", "bytes", "creadoEn", "id", "mime", "nombre", "orden" FROM "promociones";
DROP TABLE "promociones";
ALTER TABLE "new_promociones" RENAME TO "promociones";
CREATE UNIQUE INDEX "promociones_archivo_key" ON "promociones"("archivo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
