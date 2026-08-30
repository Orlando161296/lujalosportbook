-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jugadas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tablaId" INTEGER NOT NULL,
    "ejemplarId" INTEGER NOT NULL,
    "clienteId" INTEGER,
    "apodo" TEXT,
    "esCasa" BOOLEAN NOT NULL DEFAULT false,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "taquillaId" INTEGER,
    "ticketId" INTEGER,
    "registradaPorId" INTEGER NOT NULL,
    "registradaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" DATETIME,
    "actualizadaPorId" INTEGER,
    "anuladaEn" DATETIME,
    "anuladaPorId" INTEGER,
    "anuladaPorRetiro" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "jugadas_tablaId_fkey" FOREIGN KEY ("tablaId") REFERENCES "tablas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jugadas_ejemplarId_fkey" FOREIGN KEY ("ejemplarId") REFERENCES "ejemplares" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jugadas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jugadas_taquillaId_fkey" FOREIGN KEY ("taquillaId") REFERENCES "taquillas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jugadas_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jugadas_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_jugadas" ("actualizadaEn", "actualizadaPorId", "anuladaEn", "anuladaPorId", "apodo", "clienteId", "ejemplarId", "esCasa", "estado", "id", "moneda", "monto", "registradaEn", "registradaPorId", "tablaId", "taquillaId", "ticketId") SELECT "actualizadaEn", "actualizadaPorId", "anuladaEn", "anuladaPorId", "apodo", "clienteId", "ejemplarId", "esCasa", "estado", "id", "moneda", "monto", "registradaEn", "registradaPorId", "tablaId", "taquillaId", "ticketId" FROM "jugadas";
DROP TABLE "jugadas";
ALTER TABLE "new_jugadas" RENAME TO "jugadas";
CREATE INDEX "jugadas_tablaId_ejemplarId_idx" ON "jugadas"("tablaId", "ejemplarId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
