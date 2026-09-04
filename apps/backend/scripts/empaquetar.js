// Arma el backend para que viaje adentro del instalador.
//
// La app instalada no tiene repo, ni terminal, ni Node en el sistema: todo lo
// que el backend necesita para arrancar tiene que estar dentro del .msi. Este
// script deja esa carpeta lista y el `tauri build` la empaqueta como recurso.
//
// Se corre EN LA MÁQUINA DESTINO y no se puede versionar el resultado: el
// motor de consultas de Prisma es un binario por plataforma
// (`query_engine-windows.dll.node` en Windows, un `.so` en Linux), así que un
// node_modules copiado de otro sistema operativo no arranca.

const { execFileSync } = require('node:child_process');
const { cpSync, existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync } = require('node:fs');
const { isAbsolute, join, resolve } = require('node:path');

const raiz = resolve(__dirname, '..');
const destino = resolve(raiz, '../desktop/src-tauri/recursos/backend');

const paso = (t) => console.log(`\n\x1b[1m▸ ${t}\x1b[0m`);
// `shell: true` SÓLO para lo que se resuelve por PATH: en Windows `npm` y
// `npx` son .cmd y execFile no los ejecuta sin shell.
//
// Para una ruta absoluta va apagado. Con shell, execFile arma la línea de
// comando como TEXTO y no como lista de argumentos, así que
// `C:\Program Files\nodejs\node.exe` se parte en el espacio y Windows
// responde «"C:\Program" no se reconoce como un comando interno o externo».
const correr = (cmd, args, cwd = raiz, env = {}) =>
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32' && !isAbsolute(cmd),
    env: { ...process.env, ...env },
  });

paso('Limpiando la carpeta de recursos');
rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });

// ANTES de compilar, no después. Los tipos del cliente generado son lo que
// hace que `prisma.promocion` exista para TypeScript: en un clon recién bajado
// —o en uno cuyo cliente quedó de antes de la última migración— `nest build`
// falla con «Property 'promocion' does not exist on type 'PrismaService'», que
// no da ninguna pista de que lo que falta es generar. El `prisma generate` de
// más abajo es otro: ese es para la copia empaquetada.
paso('Cliente de Prisma del árbol de desarrollo');
correr('npx', ['prisma', 'generate']);

paso('Compilando el backend');
correr('npm', ['run', 'build']);
if (!existsSync(join(raiz, 'dist', 'main.js'))) {
  throw new Error('No quedó dist/main.js — revisá rootDir en tsconfig.json');
}
cpSync(join(raiz, 'dist'), join(destino, 'dist'), { recursive: true });

// De prisma/ van SÓLO el schema y las migraciones. La carpeta tiene también
// el dev.db de la máquina que compila —con la plata real del local— y sus
// respaldos: copiarla entera metía la base de producción adentro del
// instalador, para que viajara a cualquier PC donde se instale.
mkdirSync(join(destino, 'prisma'), { recursive: true });
copyFileSync(join(raiz, 'prisma', 'schema.prisma'), join(destino, 'prisma', 'schema.prisma'));
cpSync(join(raiz, 'prisma', 'migrations'), join(destino, 'prisma', 'migrations'), { recursive: true });

// Sólo las dependencias de producción, y en una instalación aparte: hacer
// `npm prune` sobre el árbol de desarrollo dejaría la máquina sin poder
// compilar de nuevo hasta reinstalar.
paso('Instalando dependencias de producción');
copyFileSync(join(raiz, 'package.json'), join(destino, 'package.json'));
copyFileSync(join(raiz, 'package-lock.json'), join(destino, 'package-lock.json'));
correr('npm', ['ci', '--omit=dev', '--ignore-scripts'], destino);

// El CLI de Prisma es devDependency, así que no está en la carpeta de
// producción: se usa el del árbol de desarrollo apuntando al schema ya
// copiado. Prisma resuelve el node_modules desde la ubicación del schema
// hacia arriba, así que el cliente y el motor quedan dentro del paquete.
//
// Hace falta generarlo a mano porque el `npm ci` de arriba fue con
// `--ignore-scripts`: sin eso, el postinstall de Prisma corre antes de que el
// schema esté copiado y falla.
const schema = join(destino, 'prisma', 'schema.prisma');
// El CLI se invoca por su ruta —no con `npx`— para poder correrlo DESDE la
// carpeta empaquetada usando el binario del árbol de desarrollo.
const prismaCli = join(raiz, 'node_modules', 'prisma', 'build', 'index.js');

paso('Generando el cliente de Prisma');
// Con cwd en la carpeta empaquetada, y no en apps/backend. Prisma anota en el
// cliente generado la ruta del .env que encuentra al generar, relativa a la
// carpeta de salida: generando desde apps/backend quedaba
// `../../../../../../../backend/.env`, una ruta que se escapa del paquete y
// apunta al .env de la máquina que compiló. En esa máquina el backend
// empaquetado levantaba la configuración de desarrollo sin que nada lo dijera.
// Desde acá no hay ningún .env que encontrar y la ruta queda nula.
correr(process.execPath, [prismaCli, 'generate', `--schema=${schema}`], destino);

// La base ya migrada y sembrada viaja como plantilla. El Rust la copia al
// AppData del usuario la primera vez que se abre la app: así el instalador no
// necesita llevar el CLI de Prisma ni correr migraciones en la PC del local.
paso('Base plantilla (migrada y sembrada)');
const plantilla = join(destino, 'plantilla.db');
const urlPlantilla = `file:${plantilla}`;
correr(process.execPath, [prismaCli, 'migrate', 'deploy', `--schema=${schema}`], destino, { DATABASE_URL: urlPlantilla });
// El seed sí va desde apps/backend: se ejecuta con ts-node, que es
// devDependency y sólo está en el árbol de desarrollo.
correr('npx', ['prisma', 'db', 'seed'], raiz, { DATABASE_URL: urlPlantilla });

// El runtime de Node, para no exigirlo instalado en la PC del local.
paso('Runtime de Node');
const nodeDestino = join(destino, process.platform === 'win32' ? 'node.exe' : 'node');
copyFileSync(process.execPath, nodeDestino);

writeFileSync(join(destino, 'LEEME.txt'),
  'Generado por scripts/empaquetar.js. No editar a mano ni versionar:\n'
  + 'el motor de Prisma es un binario propio de este sistema operativo.\n');

paso('Listo');
console.log(`  ${destino}`);
console.log('  Ahora:  cd ../desktop && npm run tauri build\n');
