import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ErrorApi } from '../lib/api';
import { useSesion } from '../lib/estado';
import { Boton, Campo, Casilla, Entrada, Etiqueta, Selector } from '../ui';
import logo from '../assets/logo-lujalo.png';

export function Login() {
  const entrar = useSesion((s) => s.entrar);
  const [usuario, setUsuario] = useState('admin');
  const [clave, setClave] = useState('');
  const [taquillaId, setTaquillaId] = useState<number | ''>('');
  const [recordar, setRecordar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si todavía no hay taquillas cargadas (instalación nueva), el campo se
  // deshabilita solo en vez de bloquear el ingreso: el admin tiene que poder
  // entrar justamente para crearlas.
  const taquillas = useQuery({ queryKey: ['taquillas'], queryFn: api.taquillas.listar });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { usuario: u } = await api.auth.entrar(
        usuario.trim(), clave, taquillaId === '' ? undefined : taquillaId,
      );
      const taq = taquillas.data?.find((t) => t.id === taquillaId) ?? null;
      entrar(u, taq);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full w-full bg-negro">
      <aside className="relative flex w-[44%] max-w-[560px] flex-col justify-end gap-8
        overflow-hidden border-r-[3px] border-magenta bg-gradient-to-br from-carbon to-negro p-11">
        {/* El difuminado con los colores de marca — amarillo, naranja, rojo y
            magenta — es lo que hace que la pantalla se reconozca de lejos. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30 blur-2xl"
          style={{
            background: `
              radial-gradient(circle at 74% 18%, #FFD22E, transparent 46%),
              radial-gradient(circle at 22% 34%, #F58220, transparent 52%),
              radial-gradient(circle at 88% 62%, #E01B22, transparent 50%),
              radial-gradient(circle at 34% 88%, #C41E6B, transparent 56%)`,
          }}
        />
        <img src={logo} alt="Centro Hípico Sportsbook Lujalo" className="relative w-full max-w-[414px]" />
        <p className="relative font-display text-[40px] leading-[1.05] tracking-[-0.02em] text-hueso">
          CENTRO HÍPICO<br />
          <span className="text-amarillo">SPORTSBOOK</span><br />
          LUJALO
        </p>
      </aside>

      <form onSubmit={enviar} className="flex flex-1 flex-col justify-center gap-5 bg-hueso px-14 py-16">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.02em]">Acceso al sistema</h1>
          <p className="mt-0.5 text-base text-gris">Módulo de Remate</p>
        </div>

        <Campo>
          <Etiqueta>Usuario</Etiqueta>
          <Entrada
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </Campo>

        <Campo>
          <Etiqueta>Contraseña</Etiqueta>
          <Entrada
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password"
          />
        </Campo>

        <Campo>
          <Etiqueta>Taquilla</Etiqueta>
          <Selector
            value={taquillaId}
            disabled={!taquillas.data?.length}
            onChange={(e) => setTaquillaId(Number((e.target as HTMLSelectElement).value) || '')}
          >
            <option value="">
              {taquillas.data?.length ? 'Sin taquilla' : 'Todavía no hay taquillas cargadas'}
            </option>
            {taquillas.data?.filter((t) => t.activa).map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </Selector>
        </Campo>

        {error && (
          <p role="alert" className="rounded border border-rojo bg-rojo/5 px-3 py-2 text-sm
            font-semibold text-rojo">
            {error}
          </p>
        )}

        <div className="mt-1 flex items-center gap-4">
          <button
            type="submit"
            disabled={enviando || !usuario.trim()}
            className="inline-flex items-center gap-2 rounded border border-amarillo bg-amarillo
              px-7 py-2.5 text-base font-bold text-negro transition
              hover:brightness-105 active:translate-y-px disabled:opacity-40"
          >
            {enviando ? 'Entrando…' : 'Ingresar'}
            <kbd className="rounded border border-current px-1 font-mono text-[11px] opacity-70">⏎</kbd>
          </button>
          <Casilla marcada={recordar} onCambio={setRecordar}>Recordar usuario</Casilla>
        </div>

        <p className="mt-1.5 border-t border-borde pt-3.5 text-[13px] text-gris">
          v1.0 · La tasa del día se configura al iniciar la jornada.
        </p>
      </form>
    </div>
  );
}

/** Botón suelto para cerrar sesión, usado desde la barra superior. */
export function BotonSalir() {
  const salir = useSesion((s) => s.salir);
  return (
    <Boton
      tono="fantasma"
      onClick={() => {
        api.auth.salir().catch(() => undefined);
        salir();
      }}
    >
      Salir
    </Boton>
  );
}
