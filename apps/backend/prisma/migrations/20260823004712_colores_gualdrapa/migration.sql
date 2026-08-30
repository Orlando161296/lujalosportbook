/*
  Warnings:

  - Added the required column `nombre` to the `colores_numero` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_colores_numero" (
    "numero" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "textoHex" TEXT NOT NULL DEFAULT '#FFFFFF'
);
INSERT INTO "new_colores_numero" ("colorHex", "numero") SELECT "colorHex", "numero" FROM "colores_numero";
DROP TABLE "colores_numero";
ALTER TABLE "new_colores_numero" RENAME TO "colores_numero";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
