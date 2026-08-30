import { useState, useEffect } from 'react';
import { Entrada } from './index';

/**
 * Campo de fecha que NO usa `<input type="date">`.
 *
 * El input nativo abre el calendario de GTK, y dentro del webview de Tauri
 * sobre Wayland ese popup bloquea el hilo de la interfaz: la ventana entera
 * se congela al tocar el campo. No hay forma de afinarlo desde acá, así que
 * la salida es no invocarlo nunca.
 *
 * Se teclea dd/mm/aaaa, que es como el operador dice la fecha en voz alta, y
 * los dos atajos cubren el 99% de los casos reales: la jornada se crea el
 * mismo día o el anterior a la noche que se remata.
 *
 * Hacia afuera sigue hablando ISO (aaaa-mm-dd), igual que el input nativo,
 * para no tocar a quien lo usa.
 */
export function CampoFecha({
  value, onChange, className = '',
}: { value: string; onChange: (iso: string) => void; className?: string }) {
  const [texto, setTexto] = useState(() => isoAVisible(value));
  const [error, setError] = useState<string | null>(null);

  // Si la fecha cambia desde afuera (los atajos, o un reset del formulario),
  // el texto tiene que seguirla.
  useEffect(() => { setTexto(isoAVisible(value)); }, [value]);

  function confirmar(escrito: string) {
    const iso = visibleAIso(escrito);
    if (!iso) {
      setError('Escribí la fecha como dd/mm/aaaa');
      return;
    }
    setError(null);
    onChange(iso);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex gap-1.5">
        <Entrada
          className="flex-1"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={texto}
          error={error}
          onChange={(e) => {
            setTexto(formatearMientrasEscribe(e.target.value));
            setError(null);
          }}
          onBlur={(e) => confirmar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirmar((e.target as HTMLInputElement).value);
            }
          }}
        />
        <button
          type="button"
          onClick={() => onChange(desplazada(0))}
          className="rounded border border-borde-fuerte px-2.5 text-[11px] font-bold
            uppercase tracking-wider hover:bg-hueso"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => onChange(desplazada(1))}
          className="rounded border border-borde-fuerte px-2.5 text-[11px] font-bold
            uppercase tracking-wider hover:bg-hueso"
        >
          Mañana
        </button>
      </div>
    </div>
  );
}

/** Fecha civil local desplazada N días, en ISO. Nunca pasa por UTC. */
function desplazada(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

const dos = (n: number) => String(n).padStart(2, '0');

function isoAVisible(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/**
 * dd/mm/aaaa → ISO, o null si no es una fecha real. Verifica que el día
 * exista de verdad: «31/02/2026» tiene formato válido y no es una fecha, y
 * dejarla pasar crearía la jornada en marzo sin que nadie lo note.
 */
function visibleAIso(texto: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1) return null;
  const d = new Date(anio, mes - 1, dia);
  if (d.getFullYear() !== anio || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return `${anio}-${dos(mes)}-${dos(dia)}`;
}

/** Mete las barras solo mientras se teclea, para no pelear con el cursor. */
function formatearMientrasEscribe(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
