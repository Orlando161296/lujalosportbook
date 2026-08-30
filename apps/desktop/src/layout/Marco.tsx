import type { ReactNode } from 'react';
import logo from '../assets/logo-lujalo.png';
import {
  useNavegacion, useSesion, puede,
  type PantallaRemate, type Seccion,
} from '../lib/estado';

/* ────────────────────────── Rail de juegos ──────────────────────────
   Nivel 1 de navegación. Arriba los JUEGOS: Remate es el único construido,
   los otros van punteados porque el sistema ya los contempla (el ticket
   imprime "Tipo de juego: REMATE" justamente por eso).

   Bajo la línea, lo TRANSVERSAL: la tasa del día, los hipódromos, las
   taquillas, los usuarios y los clientes sirven a todos los juegos por igual.
   Si vivieran dentro de Remate habría que duplicarlos el día que entre el
   segundo juego. */

const JUEGOS: { id: Seccion; ico: string; tag: string; listo: boolean }[] = [
  { id: 'remate', ico: 'RE', tag: 'Remate', listo: true },
  { id: 'ganadores', ico: 'GA', tag: 'Ganadores', listo: false },
  { id: 'tablasFijas', ico: 'TF', tag: 'T. fijas', listo: false },
  { id: 'cincoSeis', ico: '5y6', tag: '5 y 6', listo: false },
];

function ItemRail({
  ico, tag, activo, listo = true, onClick,
}: { ico: string; tag: string; activo: boolean; listo?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={listo ? onClick : undefined}
      disabled={!listo}
      title={listo ? tag : `${tag} — todavía no construido`}
      className={`flex w-12 flex-col items-center gap-px rounded-md border px-0 pb-1 pt-1.5
        transition-colors
        ${activo
          ? 'border-transparent bg-amarillo font-semibold text-negro'
          : listo
            ? 'border-transparent text-gris hover:bg-grafito hover:text-hueso'
            : 'cursor-default border-dashed border-humo text-humo'}`}
    >
      <span className="font-cond text-[15px] font-bold leading-none tracking-[0.04em]">{ico}</span>
      <span className="text-[8px] uppercase leading-[1.1] tracking-[0.05em]">{tag}</span>
    </button>
  );
}

function Rail() {
  const { seccion, irA } = useNavegacion();
  const { usuario, taquilla } = useSesion();
  const esAdmin = usuario?.rol === 'admin';

  return (
    <nav className="flex w-[62px] flex-none flex-col items-center gap-[3px] border-r
      border-black bg-carbon pb-3 pt-2.5">
      <div className="mb-2 grid h-[38px] w-[38px] place-items-center rounded-md bg-magenta
        font-display text-[15px] text-amarillo">
        L
      </div>

      <span className="my-0.5 text-[7.5px] uppercase tracking-[0.14em] text-humo">Juegos</span>
      {JUEGOS.map((j) => (
        <ItemRail
          key={j.id}
          ico={j.ico}
          tag={j.tag}
          listo={j.listo}
          activo={seccion === j.id}
          onClick={() => irA(j.id)}
        />
      ))}

      <div className="my-1.5 h-px w-[30px] bg-humo" />

      {/* Lo que el usuario no tiene permiso de ver no se muestra en gris:
          directamente no aparece. */}
      {puede(usuario, 'puedeVerResumen') && (
        <ItemRail ico="RD" tag="Resumen" activo={seccion === 'resumen'} onClick={() => irA('resumen')} />
      )}
      {esAdmin && (
        <ItemRail ico="CF" tag="Config" activo={seccion === 'config'} onClick={() => irA('config')} />
      )}

      <span className="mt-auto text-[9px] uppercase tracking-[0.16em] text-humo
        [writing-mode:vertical-rl] [transform:rotate(180deg)]">
        {taquilla?.nombre ?? usuario?.nombre ?? ''}
      </span>
    </nav>
  );
}

/* ──────────────────────── Pestañas del juego ────────────────────────
   Nivel 2. No es una lista fija del sistema: cada juego trae las suyas.
   5 y 6 no necesita "Ejemplares", necesita "Cuadro" y "Cierre". */

const PESTANAS_REMATE: { id: PantallaRemate; nombre: string }[] = [
  { id: 'tablero', nombre: 'Tablero' },
  { id: 'ejemplares', nombre: 'Ejemplares' },
  { id: 'cobros', nombre: 'Cobros' },
  { id: 'historial', nombre: 'Historial' },
];

export function PestanasRemate() {
  const { pantallaRemate, irARemate } = useNavegacion();
  return (
    <div className="flex gap-0.5 self-end">
      {PESTANAS_REMATE.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => irARemate(p.id)}
          className={`whitespace-nowrap rounded-t px-3.5 py-1.5 text-[14.5px] font-semibold
            border-b-2 transition-colors
            ${p.id === pantallaRemate
              ? 'border-amarillo bg-tinta text-amarillo'
              : 'border-transparent text-gris hover:text-hueso'}`}
        >
          {p.nombre}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────── Barra superior ──────────────────────────── */

export function BarraSuperior({
  titulo, pestanas, children,
}: { titulo?: ReactNode; pestanas?: ReactNode; children?: ReactNode }) {
  const { usuario } = useSesion();
  return (
    <header className="flex h-14 flex-none items-center gap-4 bg-carbon px-4 text-hueso">
      <span className="etiqueta !text-gris-claro">{usuario?.nombre ?? ''}</span>
      <span className="h-6 w-px bg-humo" />
      {titulo}
      {pestanas}
      <div className="flex-1" />
      {children}
    </header>
  );
}

/* ──────────────────────────── Armazón ──────────────────────────── */

export function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full bg-hueso">
      <Rail />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export { logo };
