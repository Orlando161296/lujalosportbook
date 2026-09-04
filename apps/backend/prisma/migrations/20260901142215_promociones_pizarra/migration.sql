-- CreateTable
CREATE TABLE "promociones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "archivo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "promociones_archivo_key" ON "promociones"("archivo");
