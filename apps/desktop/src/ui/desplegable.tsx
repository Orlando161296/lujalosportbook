import { useEffect, useRef, useState } from 'react';

export interface OpcionDesplegable {
  valor: number;
  etiqueta: string;
  detalle?: string;
}

/**
 * Desplegable propio, sin `<select>` nativo.
 *
 * El nativo dibuja su lista con el widget del sistema: en WebKitGTK ese
 * popup ignora buena parte del CSS del `<select>`, así que sobre la barra
 * oscura quedaba texto claro sobre fondo blanco del sistema y un hover
 * negro encima. No es afinable desde la app — la única salida es dibujar la
 * lista nosotros.
 *
 * Se maneja con teclado: ↑↓ recorren, Enter elige, Esc cierra.
 */
export function Desplegable({
  valor, opciones, onCambio, vacio = 'Sin opciones', className = '',
}: {
  valor: number | null;
  opciones: OpcionDesplegable[];
  onCambio: (valor: number) => void;
  vacio?: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  const elegida = opciones.find((o) => o.valor === valor);

  // Cerrar al tocar fuera. Sin esto el panel queda flotando sobre el
  // tablero y tapa las jugadas.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  // Al abrir, el cursor arranca sobre la opción activa y no en la primera.
  useEffect(() => {
    if (abierto) setMarcado(Math.max(0, opciones.findIndex((o) => o.valor === valor)));
  }, [abierto, valor, opciones]);

  function elegir(i: number) {
    const o = opciones[i];
    if (!o) return;
    onCambio(o.valor);
    setAbierto(false);
  }

  return (
    <div ref={caja} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !abierto) { e.preventDefault(); setAbierto(true); }
        }}
        className="flex min-h-[30px] w-full items-center gap-2 rounded border border-humo
          bg-grafito px-3 py-1 text-left text-base text-hueso hover:border-gris
          focus:outline-none focus:ring-[3px] focus:ring-amarillo/40"
      >
        <span className="flex-1 truncate">{elegida?.etiqueta ?? vacio}</span>
        <span className={`text-[10px] text-gris-claro transition-transform
          ${abierto ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {abierto && (
        <div
          role="listbox"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setAbierto(false); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); setMarcado((i) => Math.min(i + 1, opciones.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setMarcado((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); elegir(marcado); }
          }}
          ref={(el) => el?.focus()}
          className="barra-scroll absolute left-0 top-[calc(100%+4px)] z-50 max-h-[320px]
            min-w-full overflow-auto rounded border border-humo bg-carbon py-1
            shadow-[0_12px_28px_rgba(0,0,0,0.45)] focus:outline-none"
        >
          {opciones.length === 0 && (
            <div className="px-3 py-2 text-sm text-gris">{vacio}</div>
          )}
          {opciones.map((o, i) => {
            const activa = o.valor === valor;
            return (
              <button
                key={o.valor}
                type="button"
                role="option"
                aria-selected={activa}
                onMouseEnter={() => setMarcado(i)}
                onClick={() => elegir(i)}
                className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[15px]
                  ${i === marcado ? 'bg-humo' : ''}
                  ${activa ? 'text-amarillo font-semibold' : 'text-hueso'}`}
              >
                <span className="flex-1 truncate">{o.etiqueta}</span>
                {o.detalle && (
                  <span className="whitespace-nowrap text-[11px] uppercase tracking-wider text-gris-claro">
                    {o.detalle}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
