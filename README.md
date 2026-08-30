# Lujalo Sportsbook

Sistema de remate hípico del Centro Hípico Sportsbook Lujalo. Aplicación de
escritorio local (Tauri 2 + React) con backend NestJS embebido como sidecar y
base SQLite. Sin Docker, sin nube: corre en la PC del local.

- [Diseño de las vistas](https://claude.ai/code/artifact/84736d4f-df0e-4c8b-b4fa-bd017b095b07) — las pantallas a tamaño real, la paleta, la tipografía y el muestrario de componentes.
- [Modelo de datos](https://claude.ai/code/artifact/98fe9ca1-7701-47a8-83eb-4834f005fba2)
- [Protocolo de eventos Socket.IO](https://claude.ai/code/artifact/79d683a8-9b63-4f8f-8712-62ea8b6424bc)
- [Contrato API REST](https://claude.ai/code/artifact/b1f88c21-871c-4d3b-9d87-8b82e3ff7144)

## Estructura

```
apps/
  backend/     NestJS — API REST + Gateway Socket.IO + Prisma/SQLite
  desktop/     Tauri 2 + React — ventana Taquilla + ventana Pizarra
```

## La impresora

El local imprime en una térmica de **58 mm** (32 columnas) y puede pasarse a
una de 80 mm (48 columnas) sin tocar código: es el `.env`, y el ticket se
remaqueta solo. Ver `.env.example` para las opciones completas.

```bash
IMPRESORA_DESTINO=usb          # log | usb | red
IMPRESORA_ANCHO_MM=58          # 58 u 80
IMPRESORA_RUTA=/dev/usb/lp0    # Windows: \\localhost\TICKETERA
```

Sin configurar nada el ticket sale por el log del backend y el remate igual
puede cobrar: una impresora sin papel **nunca** tumba la emisión, porque para
cuando falla la plata ya se recibió y el correlativo ya se gastó. Queda el
botón «Imprimir» del ticket para volver a sacarlo.

Ante la duda el ancho es 58: un ticket angosto entra en papel de 80 mm, al
revés se cortan los montos.

## Cómo arrancar

```bash
# Backend
cd apps/backend
npm install
npm run preparar          # .env + base + admin y colores de gualdrapa
npm run start:dev

# Escritorio (en otra terminal)
cd apps/desktop
npm install
npm run tauri dev
```

`npm run preparar` existe porque el repo no versiona ni el `.env` ni el
`.db` —el primero lleva la ruta de la impresora de cada PC, el segundo es la
plata del local—, así que un clon recién bajado no arranca solo. Es
idempotente: si ya hay `.env` lo respeta.

### Compilar la app de escritorio en Windows

`npm install` **no alcanza** para `npm run tauri dev`: Tauri compila un
binario nativo. Se instala una vez, en este orden —Rust necesita el
compilador de C++ ya presente para configurarse bien:

1. **Visual Studio Build Tools 2022** — en el instalador, marcar la carga de
   trabajo **«Desarrollo para el escritorio con C++»**. Es lo que trae
   `link.exe` y el Windows SDK. Es la parte pesada (varios GB).
2. **Rust**, desde <https://rustup.rs>. En Windows el toolchain por defecto
   ya es `stable-msvc`, que es el que hace falta. Verificar con
   `rustc -Vv`: la línea `host` tiene que decir `x86_64-pc-windows-msvc`.
   Si dijera `-gnu`, corregir con `rustup default stable-msvc`.
3. **WebView2** — ya viene con Windows 11 y con Windows 10 actualizado. Si
   falta, el «Evergreen Bootstrapper» de Microsoft.

Después, con el backend corriendo en otra terminal:

```bash
cd apps/desktop
npm install
npm run tauri dev
```

La primera compilación baja y construye unos cientos de crates: tarda
bastante y no vuelve a pasar. `npm run tauri build` genera el instalador
`.msi`/`.nsis` en `src-tauri/target/release/bundle/`.

**Si sólo se quiere ver la interfaz**, `npm run dev` la sirve en el navegador
sin nada de lo anterior: `?ventana=taquilla` y `?ventana=pizarra` abren cada
una en su pestaña. El backend sí hace falta en los dos casos.

Usuario inicial: **admin** / **lujalo2026**. Todo lo demás —hipódromos,
taquillas, clientes, jornadas y la tasa del día— se carga desde las pantallas
de Configuración; el seeder no siembra datos de ejemplo a propósito, para que
la base arranque limpia.

Para iterar la interfaz sin recompilar Rust, `npm run dev` sirve la app en el
navegador: `?ventana=taquilla` y `?ventana=pizarra` abren cada interfaz en su
pestaña, y se ven hablar por socket entre sí.

## Reglas de negocio que el código da por sentadas

Están acá porque no se deducen leyendo el modelo, y equivocarse cuesta plata.

- **Reparto.** El ganador se lleva lo jugado en su tabla más el pote, y la casa
  retiene el 30% de ese bolsillo: `(tabla + pote) × 0,7`. La comisión sale del
  total, no sólo de lo apostado.
- **La `PROPORCIÓN` del ticket se mide contra el bolsillo, no contra lo
  jugado.** La base es lo apostado en las tres tablas *más* el pote que la
  casa haya asignado a cada una. El pote entra porque es parte de lo que se
  reparte —el ganador se lleva `(tabla + pote) × 0,7`—, y dejarlo afuera
  daría un porcentaje sobre una bolsa que no es la que se paga: en un caso
  real la diferencia fue de 42,00 % a 32,35 %.
- **Con qué jornada se trabaja lo elige el operador, no el sistema.** La
  jornada activa es la que está `abierta`, y hay como mucho una: el remate
  sólo ofrece sus carreras y el resumen sólo cuenta las suyas. Abrir otra
  exige cerrar la anterior a mano, porque cerrar una jornada es dar por
  terminado el día —el resumen queda congelado ahí— y no puede ser el efecto
  secundario de elegir la siguiente en un desplegable. Antes no existía la
  noción: la taquilla pedía todas las carreras de todas las jornadas y se
  quedaba con la primera `abierta` que encontraba, así que una jornada vieja
  sin cerrar ponía al operador a rematar en el día equivocado.

- **El resumen es de una jornada, no de una fecha.** Dos hipódromos que
  corren el mismo día son dos cierres distintos, y sumarlos daba cifras que
  no cuadraban con ninguna de las dos cajas.

- **Lo que el ticket dice que se cobra depende de la TABLA, no de la
  jugada.** El dueño del ejemplar ganador se lleva el bolsillo entero de su
  tabla —`(tabla + pote) × 0,7`—, no una parte proporcional a lo que pagó.
  Por eso los «si gana cobra» de un ticket con varias jugadas **no se suman**
  (son escenarios excluyentes: gana un caballo) y por eso un postor solo en
  su tabla cobra menos de lo que puso: la comisión sale igual. El papel lo
  aclara, porque es la primera cuenta que el cliente hace en el mostrador.
  Mientras la tabla siga abierta la cifra va marcada `(est.)`: el bolsillo
  todavía puede subir.

- **La pizarra es sólo montos.** En el TV nunca aparece cuánto termina cobrando
  el ganador ni el porcentaje que retiene la casa. Eso vive únicamente en la
  pantalla del operador.
- **Una puja no crea una fila nueva: edita la existente.** Mientras el
  rematador sigue ofreciendo un número hay como máximo una jugada `activa` por
  (tabla, ejemplar). Es el `PUT /tablas/:id/jugadas/:ejemplarId` como upsert.
- **Un caballo sin postor no pasa a la casa automáticamente.** Queda vacío. La
  casa lo toma sólo si el operador lo marca (`Jugada.esCasa`, sin cliente).
- **Los colores de gualdrapa son referencia fija del hipismo**, no decisión de
  diseño: el público reconoce al ejemplar por su color antes que por el número.
  Viven sembrados en `colores_numero`.
- **Un ejemplar retirado no se borra: se marca.** Retirarlo anula sus jugadas
  en cascada y genera el reembolso sólo si ya se le había cobrado al cliente.
- **El resultado es un hecho único de la carrera**, compartido por las tres
  tablas (`CarreraGanador` vive a nivel de carrera). Lo que cambia por tabla es
  cuánto se paga. Si hay empate, se divide en partes iguales.
- **La fecha de una jornada es una fecha civil local**, no un instante. Se
  guarda como medianoche UTC de ese día (ver `common/fechas.ts`); calcularla en
  UTC haría desaparecer del resumen la jornada de la noche justo mientras se
  remata.

## Navegación

Dos niveles, y la separación es deliberada:

- **Rail izquierdo: los juegos.** Remate es el único construido. Ganadores,
  Tablas Fijas y 5 y 6 aparecen punteados porque el sistema ya los contempla —
  el ticket imprime «Tipo de juego» justamente por eso.
- **Bajo la línea: lo transversal.** Resumen del día y Configuración no son de
  ningún juego: la tasa, los hipódromos, las taquillas, los usuarios y los
  clientes sirven a todos por igual. La jornada con la que se trabaja se abre
  en Configuración › Carreras del día, y manda sobre las otras dos pantallas. Meterlos dentro de Remate obligaría a
  duplicarlos el día que entre el segundo juego.
- **Pestañas dentro del juego:** Tablero · Ejemplares · Cobros · Historial.
  No son fijas del sistema: 5 y 6 no necesitará «Ejemplares», necesitará
  «Cuadro» y «Cierre».

## Qué falta

- **Auth real.** `POST /auth/login` no compara la clave y no emite sesión;
  `CurrentUser` tiene un fallback de desarrollo que devuelve el usuario 1. Es
  lo primero a cerrar antes de que esto toque plata de verdad.
- **Probar el driver contra la impresora real.** El ESC/POS está escrito y
  verificado byte a byte, pero todavía no se enchufó a la térmica del local:
  falta confirmar que esa máquina acepta `ESC t 2` (PC850) para los acentos,
  y a qué dispositivo aparece cuando se conecta.
- **Empaquetado Windows.** Falta compilar el backend como sidecar y reponer
  `bundle.externalBin` en `tauri.conf.json` (se quitó para poder correr en
  desarrollo). Los íconos de `src-tauri/icons/` son un placeholder: hay que
  reemplazarlos por la identidad real.
- **Tipo de juego en las jugadas.** `Jugada` y `Ticket` no guardan a qué juego
  pertenecen. Hoy no molesta porque sólo existe Remate, pero el día que entre
  el segundo el resumen no va a poder separarlos. Es una columna.
- **Los otros juegos.** Ganadores, Tablas Fijas y 5 y 6.
