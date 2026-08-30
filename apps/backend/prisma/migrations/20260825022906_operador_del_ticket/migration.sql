-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tickets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" INTEGER NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "clienteId" INTEGER,
    "apodo" TEXT,
    "taquillaId" INTEGER,
    "emitidoPorId" INTEGER,
    "totalBs" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'Bs',
    "tasaAplicada" DECIMAL NOT NULL,
    "impresoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tickets_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carreras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_taquillaId_fkey" FOREIGN KEY ("taquillaId") REFERENCES "taquillas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tickets_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "usuarios" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("apodo", "carreraId", "clienteId", "creadoEn", "id", "impresoEn", "moneda", "numero", "taquillaId", "tasaAplicada", "totalBs") SELECT "apodo", "carreraId", "clienteId", "creadoEn", "id", "impresoEn", "moneda", "numero", "taquillaId", "tasaAplicada", "totalBs" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
CREATE UNIQUE INDEX "tickets_numero_key" ON "tickets"("numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
