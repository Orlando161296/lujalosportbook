import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { bs } from '../lib/formato';

/* ─────────────────────────── Botón ───────────────────────────
   Jerarquía, no variantes sueltas: amarillo es la acción principal y hay una
   sola por pantalla; verde confirma plata que sale; rojo destruye o cierra
   algo que no se deshace. */

type TonoBoton = 'principal' | 'confirmar' | 'destructivo' | 'secundario' | 'oscuro' | 'fantasma';

const TONOS: Record<TonoBoton, string> = {
  principal: 'bg-amarillo border-amarillo text-negro font-bold hover:brightness-105',
  confirmar: 'bg-verde border-verde text-white font-bold hover:brightness-110',
  destructivo: 'bg-rojo border-rojo text-white font-bold hover:brightness-110',
  secundario: 'bg-white border-borde-fuerte text-tinta hover:bg-hueso',
  oscuro: 'bg-carbon border-carbon text-hueso hover:brightness-125',
  fantasma: 'bg-transparent border-humo text-gris-claro hover:text-hueso hover:border-gris',
};

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  tono?: TonoBoton;
  atajo?: string;
  ancho?: boolean;
}

export function Boton({
  tono = 'secundario', atajo, ancho, className = '', children, ...resto
}: PropsBoton) {
  return (
    <button
      type="button"
      {...resto}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded
        border px-3.5 py-1.5 text-sm font-semibold tracking-[0.02em]
        transition-[filter,transform] duration-100 active:translate-y-px
        disabled:opacity-40 disabled:pointer-events-none
        ${TONOS[tono]} ${ancho ? 'w-full' : ''} ${className}`}
    >
      {children}
      {atajo && (
        <kbd className="rounded border border-current px-1 font-mono text-[11px] opacity-70">
          {atajo}
        </kbd>
      )}
    </button>
  );
}

/* ─────────────────────────── Campos ─────────────────────────── */

export function Etiqueta({ children }: { children: ReactNode }) {
  return <span className="etiqueta">{children}</span>;
}

export function Campo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1.5 ${className}`}>{children}</label>;
}

interface PropsEntrada extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  grande?: boolean;
}

// Reenvía la ref para que el formulario de remate pueda mover el foco de un
// campo al siguiente con Enter: el operador carga sin soltar el teclado y
// cada clic para reubicarse cuesta una puja.
export const Entrada = forwardRef<HTMLInputElement, PropsEntrada>(function Entrada(
  { error, grande, className = '', ...resto },
  ref,
) {
  return (
    <>
      <input
        ref={ref}
        {...resto}
        className={`min-h-[38px] rounded border bg-white px-3 py-2 text-tinta
          placeholder:text-gris focus:outline-none
          disabled:bg-[#EFEBE2] disabled:text-gris
          ${grande ? 'plata text-3xl font-bold py-1' : 'text-base'}
          ${error
            ? 'border-rojo focus:ring-[3px] focus:ring-rojo/20'
            : 'border-borde-fuerte focus:border-carbon focus:ring-[3px] focus:ring-amarillo/40'}
          ${className}`}
      />
      {error && <span className="text-[12.5px] text-rojo">{error}</span>}
    </>
  );
});

export function Selector({
  className = '', children, ...resto
}: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...(resto as object)}
      className={`min-h-[38px] rounded border border-borde-fuerte bg-white px-3 py-2
        text-base text-tinta focus:border-carbon focus:outline-none
        focus:ring-[3px] focus:ring-amarillo/40 ${className}`}
    >
      {children}
    </select>
  );
}

/** Selector segmentado: Bs/USD, T1/T2/T3. Siempre hay uno activo. */
export function Segmentado<T extends string | number>({
  opciones, valor, onCambio, alto = '', className = '',
}: {
  opciones: { valor: T; etiqueta: ReactNode }[];
  valor: T;
  onCambio: (v: T) => void;
  alto?: string;
  className?: string;
}) {
  return (
    <div className={`flex overflow-hidden rounded border border-borde-fuerte ${alto} ${className}`}>
      {opciones.map((o, i) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => onCambio(o.valor)}
          className={`flex-1 px-3 py-1.5 text-sm font-semibold transition-colors
            ${i > 0 ? 'border-l border-borde' : ''}
            ${o.valor === valor ? 'bg-carbon text-amarillo' : 'bg-white text-gris hover:bg-hueso'}`}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

export function Casilla({
  marcada, onCambio, children,
}: { marcada: boolean; onCambio: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => onCambio(e.target.checked)}
        className="h-[15px] w-[15px] flex-none accent-carbon"
      />
      {children}
    </label>
  );
}

/* ─────────────────────────── Estados ───────────────────────────
   Cada estado se lee por color Y por palabra: en taquilla hay gente que
   distingue mal el rojo del verde, y la pizarra se mira de lejos. */

type TonoPildora = 'neutro' | 'ok' | 'no' | 'pendiente' | 'vip' | 'casa';

const PILDORAS: Record<TonoPildora, string> = {
  neutro: 'bg-borde text-humo',
  ok: 'bg-verde text-white',
  no: 'bg-rojo text-white',
  pendiente: 'bg-naranja text-negro',
  vip: 'bg-amarillo text-negro',
  casa: 'bg-magenta text-white',
};

export function Pildora({ tono = 'neutro', children }: { tono?: TonoPildora; children: ReactNode }) {
  return (
    <span className={`whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10.5px]
      font-bold uppercase tracking-[0.09em] ${PILDORAS[tono]}`}>
      {children}
    </span>
  );
}

/* ─────────────────────────── Panel ─────────────────────────── */

export function Panel({
  titulo, extra, children, className = '', cuerpoClassName = 'p-3',
}: {
  titulo?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  cuerpoClassName?: string;
}) {
  return (
    <section className={`tarjeta flex min-h-0 flex-col overflow-hidden ${className}`}>
      {titulo && (
        <header className="flex items-center justify-between gap-2 border-b border-borde
          bg-carbon px-3 py-2">
          <span className="etiqueta !text-amarillo">{titulo}</span>
          {extra}
        </header>
      )}
      <div className={`min-h-0 ${cuerpoClassName}`}>{children}</div>
    </section>
  );
}

/* ─────────────────────── Gualdrapa y montos ───────────────────────
   El color de gualdrapa es referencia fija del hipismo, no decisión de
   diseño: el público reconoce al ejemplar por su color antes que por el
   número. Viene de la tabla colores_numero. */

export function Gualdrapa({
  numero, color, texto, tam = 24, apagada = false, className = '',
}: {
  numero: number;
  color: string;
  texto: string;
  tam?: number;
  apagada?: boolean;
  className?: string;
}) {
  const fondo = apagada ? '#CFC8BA' : color;
  return (
    <span
      title={`Ejemplar ${numero}`}
      style={{
        width: tam, height: tam, background: fondo, color: apagada ? '#7a7770' : texto,
        fontSize: Math.round(tam * 0.54),
        // El blanco desaparece sobre fondos claros: filete interno para que
        // el 2 siga siendo un bloque y no un hueco.
        boxShadow: fondo.toUpperCase() === '#FFFFFF' ? 'inset 0 0 0 1px rgba(0,0,0,.25)' : undefined,
      }}
      className={`inline-grid flex-none place-items-center rounded-sm font-display leading-none ${className}`}
    >
      {numero}
    </span>
  );
}

export function Monto({
  valor, className = '', sufijo,
}: { valor: number | string; className?: string; sufijo?: string }) {
  return (
    <span className={`plata ${className}`}>
      {bs(valor)}
      {sufijo && <span className="ml-1 text-[0.7em] font-normal text-gris">{sufijo}</span>}
    </span>
  );
}

/* ─────────────────────── Estados de carga ─────────────────────── */

export function Cargando({ que = 'los datos' }: { que?: string }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center text-gris">
      Cargando {que}…
    </div>
  );
}

export function Vacio({ titulo, detalle, accion }: {
  titulo: string; detalle?: string; accion?: ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <p className="font-display text-lg text-humo">{titulo}</p>
        {detalle && <p className="mt-1.5 text-sm leading-relaxed text-gris">{detalle}</p>}
        {accion && <div className="mt-4 flex justify-center">{accion}</div>}
      </div>
    </div>
  );
}

export function Problema({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  const mensaje = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <p className="font-semibold text-rojo">{mensaje}</p>
        {reintentar && (
          <div className="mt-4 flex justify-center">
            <Boton onClick={reintentar}>Reintentar</Boton>
          </div>
        )}
      </div>
    </div>
  );
}
