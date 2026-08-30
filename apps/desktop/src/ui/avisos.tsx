import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Avisos de operación. Van fijos a la ventana y por encima de todo: durante
 * el remate el operador no está mirando el formulario, está mirando al
 * rematador, y necesita confirmar de reojo que la jugada entró.
 *
 * Un aviso dentro del panel no sirve — si la ventana queda más alta que la
 * pantalla, el mensaje cae fuera del borde y el operador no se entera de que
 * hubo un error.
 */

export type TipoAviso = 'exito' | 'error' | 'info';

interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
  detalle?: string;
}

interface EstadoAvisos {
  avisos: Aviso[];
  mostrar: (tipo: TipoAviso, texto: string, detalle?: string) => void;
  cerrar: (id: number) => void;
}

let siguienteId = 1;

export const useAvisos = create<EstadoAvisos>((set) => ({
  avisos: [],
  mostrar: (tipo, texto, detalle) =>
    set((s) => ({
      // Como mucho tres a la vez: si se apilan más, el operador deja de leerlos.
      avisos: [...s.avisos, { id: siguienteId++, tipo, texto, detalle }].slice(-3),
    })),
  cerrar: (id) => set((s) => ({ avisos: s.avisos.filter((a) => a.id !== id) })),
}));

export const avisar = {
  exito: (texto: string, detalle?: string) => useAvisos.getState().mostrar('exito', texto, detalle),
  error: (texto: string, detalle?: string) => useAvisos.getState().mostrar('error', texto, detalle),
  info: (texto: string, detalle?: string) => useAvisos.getState().mostrar('info', texto, detalle),
};

const ESTILOS: Record<TipoAviso, { caja: string; marca: string; icono: string }> = {
  exito: { caja: 'border-verde bg-verde text-white', marca: 'bg-white/25', icono: '✓' },
  error: { caja: 'border-rojo bg-rojo text-white', marca: 'bg-white/25', icono: '!' },
  info: { caja: 'border-humo bg-carbon text-hueso', marca: 'bg-amarillo/25', icono: 'i' },
};

function Tarjeta({ aviso }: { aviso: Aviso }) {
  const cerrar = useAvisos((s) => s.cerrar);
  const estilo = ESTILOS[aviso.tipo];

  useEffect(() => {
    // El error se queda hasta que lo cierren: si algo no entró, el operador
    // tiene que poder leer por qué aunque haya mirado para otro lado.
    if (aviso.tipo === 'error') return;
    const t = setTimeout(() => cerrar(aviso.id), 2600);
    return () => clearTimeout(t);
  }, [aviso.id, aviso.tipo, cerrar]);

  return (
    <div
      role={aviso.tipo === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-[380px] items-start gap-3 rounded border-2 px-3.5 py-2.5
        shadow-lg ${estilo.caja}`}
    >
      <span className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full
        text-[13px] font-bold ${estilo.marca}`}>
        {estilo.icono}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-tight">{aviso.texto}</p>
        {aviso.detalle && <p className="mt-0.5 text-[13px] leading-snug opacity-90">{aviso.detalle}</p>}
      </div>
      <button
        type="button"
        onClick={() => cerrar(aviso.id)}
        aria-label="Cerrar aviso"
        className="-mr-1 flex-none px-1 text-lg leading-none opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}

export function Avisos() {
  const avisos = useAvisos((s) => s.avisos);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
      {avisos.map((a) => <Tarjeta key={a.id} aviso={a} />)}
    </div>
  );
}
