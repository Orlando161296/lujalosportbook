// Seeder mínimo: solo el usuario administrador.
//
// Todo lo demás (hipódromos, taquillas, jornadas, clientes, tasa del día) se
// carga desde las pantallas de Configuración — ese es justamente el flujo que
// describen los wireframes 5a–5e. Sembrar datos de ejemplo acá solo taparía
// esas pantallas y dejaría la base sucia antes del primer uso real.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: reemplazar por un hash real (bcrypt/argon2) al implementar la auth
// definitiva. Hoy CurrentUser tiene un fallback de desarrollo y no se
// verifica la clave, así que esto todavía no protege nada.
const CLAVE_INICIAL = 'lujalo2026';

// Colores de gualdrapa del estándar internacional del hipismo. Son referencia
// fija del deporte, no configuración del negocio: por eso van sembrados y no
// se cargan desde una pantalla. Se editan sólo si un hipódromo usa otro orden.
const GUALDRAPAS: [number, string, string, string][] = [
  [1, 'Rojo', '#D32027', '#FFFFFF'],
  [2, 'Blanco', '#FFFFFF', '#111111'],
  [3, 'Azul', '#1B4FA0', '#FFFFFF'],
  [4, 'Amarillo', '#F5C518', '#111111'],
  [5, 'Verde', '#167C3C', '#FFFFFF'],
  [6, 'Negro', '#16161A', '#FFFFFF'],
  [7, 'Naranja', '#F07C11', '#111111'],
  [8, 'Rosado', '#F2A0C0', '#111111'],
  [9, 'Turquesa', '#3FBFC8', '#111111'],
  [10, 'Morado', '#6B3FA0', '#FFFFFF'],
  [11, 'Gris', '#A8A6A1', '#111111'],
  [12, 'Verde limón', '#B9D93C', '#111111'],
  [13, 'Marrón', '#7A5230', '#FFFFFF'],
  [14, 'Vinotinto', '#6E1B2E', '#FFFFFF'],
];

async function main() {
  for (const [numero, nombre, colorHex, textoHex] of GUALDRAPAS) {
    await prisma.colorNumero.upsert({
      where: { numero },
      update: { nombre, colorHex, textoHex },
      create: { numero, nombre, colorHex, textoHex },
    });
  }

  const admin = await prisma.usuario.upsert({
    where: { usuario: 'admin' },
    update: {},
    create: {
      nombre: 'Administrador',
      usuario: 'admin',
      passwordHash: CLAVE_INICIAL,
      rol: 'admin',
      // El admin arranca con todos los permisos; los operadores se crean
      // desde la pantalla de Usuarios y roles con los suyos.
      puedeAnularJugadasPropias: true,
      puedeAnularJugadasDeOtros: true,
      puedeCambiarTasa: true,
      puedeCerrarCarrera: true,
      puedeVerResumen: true,
    },
  });

  console.log(
    `Seed listo. Usuario administrador '${admin.usuario}' (clave inicial: ${CLAVE_INICIAL}).`,
  );
  console.log(`${GUALDRAPAS.length} colores de gualdrapa sembrados.`);
  console.log('El resto de la configuración se carga desde la app.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
