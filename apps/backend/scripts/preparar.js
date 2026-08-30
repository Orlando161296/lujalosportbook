// Deja la máquina lista para arrancar: .env, base y datos iniciales.
//
// Existe porque el repo, a propósito, no lleva ni el .env ni el .db —el
// primero puede tener rutas de impresora propias de cada PC, y el segundo es
// la plata del local—, así que un clon recién bajado no arranca solo. En vez
// de una lista de cuatro comandos en el README que hay que seguir sin
// equivocarse, es `npm run preparar`.
//
// Se escribe en Node y no como script de shell porque la máquina destino es
// Windows: `cp` y `&&` encadenados no existen igual en PowerShell.

const { existsSync, copyFileSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { join } = require('node:path');

const raiz = join(__dirname, '..');
const paso = (t) => console.log(`\n\x1b[1m▸ ${t}\x1b[0m`);

const correr = (cmd) => execSync(cmd, { cwd: raiz, stdio: 'inherit' });

paso('Archivo .env');
const env = join(raiz, '.env');
if (existsSync(env)) {
  console.log('  Ya existe, se respeta como está.');
} else {
  copyFileSync(join(raiz, '.env.example'), env);
  console.log('  Creado a partir de .env.example.');
  console.log('  Si vas a conectar la térmica, ajustá ahí IMPRESORA_*.');
}

paso('Cliente de Prisma');
correr('npx prisma generate');

// `deploy` y no `dev`: aplica las migraciones existentes sin preguntar nada
// ni intentar crear migraciones nuevas, que es lo que hace falta en una
// máquina que sólo va a correr el sistema.
paso('Base de datos');
correr('npx prisma migrate deploy');

paso('Datos iniciales');
correr('npx prisma db seed');

console.log('\n\x1b[32m✓ Listo.\x1b[0m Arrancá con:  npm run start:dev');
console.log('  Usuario: admin · Clave: lujalo2026\n');
