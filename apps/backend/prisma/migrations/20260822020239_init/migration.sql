-- CreateTable
CREATE TABLE "taquillas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "taquillaId" INTEGER,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "puedeAnularJugadasPropias" BOOLEAN NOT NULL DEFAULT true,
    "puedeAnularJugadasDeOtros" BOOLEAN NOT NULL DEFAULT false,
    "puedeCambiarTasa" BOOLEAN NOT NULL DEFAULT false,
    "puedeCerrarCarrera" BOOLEAN NOT NULL DEFAULT false,
    "puedeVerResumen" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "usuarios_taquillaId_fkey" FOREIGN KEY ("taquillaId") REFERENCES "taquillas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hipodromos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT,
    "tablasPorCarrera" INTEGER NOT NULL DEFAULT 3,
    "disponibleParaRemate" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "jornadas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hipodromoId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL,
    "cantidadCarreras" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'planificada',
    "cerradaEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jornadas_hipodromoId_fkey" FOREIGN KEY ("hipodromoId") REFERENCES "hipodromos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasas_cambio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vigenteDesde" DATETIME NOT NULL,
    "valorBsPorUsd" DECIMAL NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "bloqueada" BOOLEAN NOT NULL DEFAULT false,
    "registradoPorId" INTEGER NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasas_cambio_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "carreras" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hipodromoId" INTEGER NOT NULL,
    "jornadaId" INTEGER,
    "fecha" DATETIME NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'planificada',
    "creadoPorId" INTEGER NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL,
    CONSTRAINT "carreras_hipodromoId_fkey" FOREIGN KEY ("hipodromoId") REFERENCES "hipodromos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "carreras_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "jornadas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "carreras_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ejemplares" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "carreraId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "retiradoEn" DATETIME,
    "retiradoPorId" INTEGER,
    CONSTRAINT "ejemplares_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carreras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "colores_numero" (
    "numero" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "colorHex" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "tablas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "carreraId" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "poteCasa" DECIMAL NOT NULL DEFAULT 0,
    "comisionPct" DECIMAL NOT NULL DEFAULT 30,
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "cerradaEn" DATETIME,
    "cerradaPorId" INTEGER,
    CONSTRAINT "tablas_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carreras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "carrera_ganadores" (
    "carreraId" INTEGER NOT NULL,
    "ejemplarId" INTEGER NOT NULL,

    PRIMARY KEY ("carreraId", "ejemplarId"),
    CONSTRAINT "carrera_ganadores_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carreras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "carrera_ganadores_ejemplarId_fkey" FOREIGN KEY ("ejemplarId") REFERENCES "ejemplares" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "nombrePizarra" TEXT,
    "telefono" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoPorId" INTEGER NOT NULL,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "esVip" BOOLEAN NOT NULL DEFAULT false,
    "nivel" TEXT,
    "limiteCreditoBs" DECIMAL NOT NULL DEFAULT 0,
    "tasaPreferencial" DECIMAL,
    "descuentoPct" DECIMAL NOT NULL DEFAULT 0,
    "puedeCreditoEnRemate" BOOLEAN NOT NULL DEFAULT false,
    "descontarDeudaDelPremio" BOOLEAN NOT NULL DEFAULT true,
    "puedePagarUsd" BOOLEAN NOT NULL DEFAULT false,
    "resaltadoEnPizarra" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "clientes_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" INTEGER NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "taquillaId" INTEGER,
    "totalBs" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'Bs',
    "tasaAplicada" DECIMAL NOT NULL,
    "impresoEn" DATETIME,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tickets_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carreras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tickets_taquillaId_fkey" FOREIGN KEY ("taquillaId") REFERENCES "taquillas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "jugadas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tablaId" INTEGER NOT NULL,
    "ejemplarId" INTEGER NOT NULL,
    "clienteId" INTEGER,
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
    CONSTRAINT "jugadas_tablaId_fkey" FOREIGN KEY ("tablaId") REFERENCES "tablas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jugadas_ejemplarId_fkey" FOREIGN KEY ("ejemplarId") REFERENCES "ejemplares" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jugadas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jugadas_taquillaId_fkey" FOREIGN KEY ("taquillaId") REFERENCES "taquillas" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jugadas_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "jugadas_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cobros" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "carreraId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL NOT NULL,
    "moneda" TEXT NOT NULL,
    "tasaAplicada" DECIMAL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "pagadoEn" DATETIME,
    "pagadoPorId" INTEGER,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cobros_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cobros_carreraId_fkey" FOREIGN KEY ("carreraId") REFERENCES "carreras" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cobro_jugadas" (
    "cobroId" INTEGER NOT NULL,
    "jugadaId" INTEGER NOT NULL,
    "montoCubierto" DECIMAL NOT NULL,

    PRIMARY KEY ("cobroId", "jugadaId"),
    CONSTRAINT "cobro_jugadas_cobroId_fkey" FOREIGN KEY ("cobroId") REFERENCES "cobros" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cobro_jugadas_jugadaId_fkey" FOREIGN KEY ("jugadaId") REFERENCES "jugadas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "taquillas_nombre_key" ON "taquillas"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "hipodromos_nombre_key" ON "hipodromos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "jornadas_hipodromoId_fecha_key" ON "jornadas"("hipodromoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "carreras_hipodromoId_fecha_numero_key" ON "carreras"("hipodromoId", "fecha", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ejemplares_carreraId_numero_key" ON "ejemplares"("carreraId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "tablas_carreraId_etiqueta_key" ON "tablas"("carreraId", "etiqueta");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_numero_key" ON "tickets"("numero");

-- CreateIndex
CREATE INDEX "jugadas_tablaId_ejemplarId_idx" ON "jugadas"("tablaId", "ejemplarId");
