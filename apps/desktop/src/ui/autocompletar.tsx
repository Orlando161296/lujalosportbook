import { forwardRef, useEffect, useRef, useState } from 'react';
import { Entrada } from './index';

export interface SugerenciaAuto {
  valor: string;
  /** Etiqueta corta al costado: de dónde salió la sugerencia. */
  detalle?: string;
}

/**
 * Campo de texto con sugerencias navegables por teclado.
 *
 * No usa `<datalist>`: la lista nativa la dibuja el sistema —en WebKitGTK
 * ignora el CSS y su manejo de teclas es propio— y su Enter chocaba con el
 * Enter que el remate ya usa para avanzar al campo siguiente. Dibujándola
 * nosotros, las dos cosas conviven: con una sugerencia marcada Enter la
 * acepta, y sin nada marcado Enter sigue la secuencia de carga.
 *
 * El campo NO se limita a las sugerencias: en el remate entra cualquier
 * apodo tecleado al vuelo. Son atajo, no validación.
 */
export const Autocompletar = forwardRef<HTMLInputElement, {
  valor: string;
  onCambio: (v: string) => void;
  sugerencias: SugerenciaAuto[];
  /** Enter sin sugerencia marcada: seguir la secuencia de carga. */
  onConfirmar: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}>(function Autocompletar(
  { valor, onCambio, sugerencias, onConfirmar, placeholder, disabled, className = '' },
  ref,
) {
  const [abierto, setAbierto] = useState(false);
  // -1 = nada marcado. Arranca así a propósito: si la primera sugerencia
  // viniera marcada, Enter aceptaría un nombre que el operador no eligió.
  const [marcado, setMarcado] = useState(-1);
  const caja = useRef<HTMLDivElement>(null);

  const q = valor.trim().toLowerCase();
  const filtradas = q
    ? sugerencias.filter((s) => s.valor.toLowerCase().includes(q) && s.valor.toLowerCase() !== q)
    : sugerencias;
  const visibles = filtradas.slice(0, 8);
  const mostrar = abierto && visibles.length > 0 && !disabled;

  // Cada vez que cambia lo tecleado, la marca vuelve a cero: la lista es
  // otra y mantener el índice marcaría a otra persona.
  useEffect(() => { setMarcado(-1); }, [valor]);

  useEffect(() => {
    if (!mostrar) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [mostrar]);

  function aceptar(i: number) {
    const s = visibles[i];
    if (!s) return;
    onCambio(s.valor);
    setAbierto(false);
    setMarcado(-1);
  }

  return (
    <div ref={caja} className={`relative ${className}`}>
      <Entrada
        ref={ref}
        className="w-full font-semibold"
        value={valor}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setAbierto(true)}
        onChange={(e) => { onCambio(e.target.value); setAbierto(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAbierto(true);
            setMarcado((i) => Math.min(i + 1, visibles.length - 1));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setMarcado((i) => Math.max(i - 1, -1));
            return;
          }
          if (e.key === 'Escape') {
            setAbierto(false);
            setMarcado(-1);
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            // Con algo marcado, Enter completa el nombre y se queda en el
            // campo: el operador ve qué eligió antes de seguir.
            if (mostrar && marcado >= 0) { aceptar(marcado); return; }
            setAbierto(false);
            onConfirmar();
          }
        }}
      />

      {mostrar && (
        <div className="barra-scroll absolute left-0 top-[calc(100%+3px)] z-40 max-h-[220px]
          w-full overflow-auto rounded border border-borde-fuerte bg-white py-1
          shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
          {visibles.map((s, i) => (
            <button
              key={s.valor}
              type="button"
              // `mousedown` y no `click`: el click llega después del blur
              // del input, que ya habría cerrado la lista.
              onMouseDown={(e) => { e.preventDefault(); aceptar(i); }}
              onMouseEnter={() => setMarcado(i)}
              className={`flex w-full items-baseline gap-2 px-2.5 py-1 text-left text-[15px]
                ${i === marcado ? 'bg-amarillo/35' : ''}`}
            >
              <span className="flex-1 truncate font-semibold">{s.valor}</span>
              {s.detalle && (
                <span className="whitespace-nowrap text-[10.5px] uppercase tracking-wider text-gris">
                  {s.detalle}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
