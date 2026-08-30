import { Fragment, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { bs } from '../../lib/formato';
import { claveCarrera, totalesDeTabla } from '../../hooks/useCarrera';
import type { ColorNumero, Jugada, Pizarra } from '../../lib/tipos';
import { Boton, Casilla, Gualdrapa } from '../../ui';
import { avisar } from '../../ui/avisos';

/**
 * Premiar es el único momento irreversible de la app: marca el ganador y
 * cierra la carrera. Por eso es un modal sobre el tablero y no una pantalla
 * aparte — al operador no le tiene que quedar fácil llegar por accidente.
 *
 * Las tres tablas comparten UN ganador porque el resultado de la carrera es
 * un hecho físico único; lo que cambia por tabla es cuánto se paga.
 */
export function ModalPremiar({
  carrera, totales, porNumero, onCerrar,
}: {
  carrera: Pizarra;
  totales: ReturnType<typeof totalesDeTabla>;
  porNumero: Map<number, ColorNumero>;
  onCerrar: () => void;
}) {
  const qc = useQueryClient();
  const [elegidos, setElegidos] = useState<number[]>(
    carrera.ganadores.map((g) => g.ejemplarId),
  );
  const [imprimir, setImprimir] = useState(true);
  const [mostrarEnPizarra, setMostrarEnPizarra] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const confirmar = useMutation({
    mutationFn: () => api.carreras.registrarResultado(carrera.id, elegidos),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: claveCarrera(carrera.id) });
      qc.invalidateQueries({ queryKey: ['cobros', carrera.id] });
      avisar.exito(
        `Carrera ${carrera.numero} premiada`,
        `${res.ganadores.map((g) => `${g.numero} ${g.nombre}`).join(', ')} · ${res.pagos.length} pagos`,
      );
      onCerrar();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo registrar el resultado.'),
  });

  const activos = carrera.ejemplares.filter((e) => e.estado === 'activo');

  /** Cómo se nombra al dueño de una jugada, con apodo incluido. */
  const dueno = (j: Jugada) =>
    j.esCasa ? 'LA CASA' : (j.cliente?.nombrePizarra || j.cliente?.nombre || j.apodo || '—');

  /**
   * El reparto tabla por tabla.
   *
   * Lo de cada tabla se divide entre la cantidad de ganadores, tengan dueño
   * o no: si empataron dos y en esta tabla sólo se vendió uno de ellos, ese
   * cobra su mitad y la otra queda para la casa.
   *
   * Por eso `retiene` se calcula como el bolsillo MENOS lo que se paga, y no
   * como la comisión sola: con un empate la casa se queda además con la
   * parte del ganador que nadie compró, y sumar sólo comisiones dejaba un
   * hueco —en un empate de dos, 21.000 Bs— que no aparecía en ningún lado.
   */
  const reparto = totales.map((t) => {
    // Sin redondear a entero: el backend paga `aRepartir / ganadores` con dos
    // decimales, y redondear acá hacía que la pantalla y el pago difirieran.
    const porGanador = elegidos.length ? t.alGanador / elegidos.length : 0;
    const filas = elegidos.map((ejId) => ({
      ejemplar: carrera.ejemplares.find((e) => e.id === ejId),
      jugada: t.tabla.jugadas.find((j) => j.ejemplarId === ejId && j.estado === 'activa'),
    }));
    const conDueno = filas.filter((f) => f.jugada);
    const pagado = porGanador * conDueno.length;
    return { ...t, porGanador, filas, conDueno, pagado, retiene: t.bolsillo - pagado };
  });

  const totalAPagar = reparto.reduce((s, r) => s + r.pagado, 0);
  const totalRetiene = reparto.reduce((s, r) => s + r.retiene, 0);
  const totalBolsillo = reparto.reduce((s, r) => s + r.bolsillo, 0);

  /**
   * Lo mismo, pero por persona: es lo que se entrega en ventanilla.
   *
   * Un ganador que jugó el mismo caballo en las tres tablas cobra tres veces
   * —una por tabla—, y el desglose por tabla obligaba al operador a sumarlo
   * de cabeza con el cliente enfrente.
   */
  const porPersona = [...reparto
    .flatMap((r) => r.conDueno.map((f) => ({ nombre: dueno(f.jugada!), monto: r.porGanador })))
    .reduce((m, x) => m.set(x.nombre, (m.get(x.nombre) ?? 0) + x.monto), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-negro/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-premiar"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      <div className="tarjeta max-h-[92vh] w-[860px] max-w-full overflow-y-auto border-0 shadow-2xl barra-scroll">
        <header className="flex items-center justify-between bg-carbon px-4 py-3">
          <h2 id="titulo-premiar" className="font-display text-[19px] text-hueso">
            PREMIAR GANADOR · CARRERA {carrera.numero}
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-lg text-gris">✕</button>
        </header>

        <div className="border-b border-borde bg-verde/10 px-4 py-3">
          <p className="etiqueta mb-2">Marcá el ejemplar que ganó</p>
          <div className="flex flex-wrap gap-1.5">
            {activos.map((e) => {
              const c = porNumero.get(e.numero);
              const marcado = elegidos.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setElegidos((prev) =>
                    prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id])}
                  className={`flex items-center gap-2 rounded border-2 px-2 py-1
                    ${marcado ? 'border-verde bg-white' : 'border-borde bg-white/60 hover:border-borde-fuerte'}`}
                >
                  <Gualdrapa
                    numero={e.numero}
                    color={c?.colorHex ?? '#F58220'}
                    texto={c?.textoHex ?? '#111'}
                    tam={22}
                  />
                  <span className="font-display text-[13px]">{e.nombre}</span>
                </button>
              );
            })}
          </div>
          {elegidos.length > 1 && (
            <p className="mt-2 text-[13px] font-semibold text-naranja">
              Empate de {elegidos.length}: lo de cada tabla se divide en partes iguales.
            </p>
          )}
        </div>

        {/* Lo que se entrega en ventanilla, primero y en grande. Un ganador
            que jugó el mismo caballo en las tres tablas cobra tres veces, y
            el desglose por tabla obligaba a sumarlo de cabeza con el cliente
            enfrente. */}
        {porPersona.length > 0 && (
          <div className="border-b border-borde px-4 pt-3">
            <span className="etiqueta">Se le paga a cada quien</span>
            <div className="mt-2 flex flex-wrap gap-2 pb-3">
              {porPersona.map(([nombre, monto]) => (
                <div
                  key={nombre}
                  className={`flex min-w-[160px] flex-col rounded border px-3 py-2
                    ${nombre === 'LA CASA'
                      ? 'border-magenta bg-magenta/10'
                      : 'border-verde bg-verde/10'}`}
                >
                  <span className="text-[13px] font-semibold">{nombre}</span>
                  <span className="plata text-[22px] font-bold leading-tight">{bs(monto)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-4 pt-3">
          <span className="etiqueta">De dónde sale · tabla por tabla</span>
        </div>
        <div className="px-4 pb-1 pt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-carbon text-gris-claro">
                <th className="px-2.5 py-1.5 text-left text-[10.5px] uppercase tracking-[0.1em]">Tabla</th>
                <th className="px-2.5 py-1.5 text-left text-[10.5px] uppercase tracking-[0.1em]">N°</th>
                <th className="px-2.5 py-1.5 text-left text-[10.5px] uppercase tracking-[0.1em]">Ganador</th>
                <th className="px-2.5 py-1.5 text-right text-[10.5px] uppercase tracking-[0.1em]">Jugó Bs</th>
                <th className="px-2.5 py-1.5 text-right text-[10.5px] uppercase tracking-[0.1em]">Cobra Bs</th>
              </tr>
            </thead>
            <tbody>
              {reparto.map((r) => (
                <Fragment key={r.tabla.id}>
                  {/* Encabezado de la tabla: de cuánto se parte y en cuántos.
                      Es la cuenta que el operador tiene que poder rehacer
                      mirando la pantalla, sin confiar en el resultado. */}
                  <tr className="border-b border-borde bg-hueso">
                    <td className="px-2.5 py-1.5 font-bold">{r.tabla.etiqueta}</td>
                    <td colSpan={2} className="px-2.5 py-1.5 text-[13px] text-gris">
                      bolsillo {bs(r.bolsillo)} − casa {Number(r.tabla.comisionPct)}%
                      {' '}= <b className="text-tinta">{bs(r.alGanador)}</b>
                      {elegidos.length > 1 && <> ÷ {elegidos.length} empatados</>}
                    </td>
                    <td className="px-2.5 py-1.5" />
                    <td className="plata px-2.5 py-1.5 text-right text-[13px] text-gris">
                      {elegidos.length ? `${bs(r.porGanador)} c/u` : '—'}
                    </td>
                  </tr>

                  {r.filas.map((f) => (
                    <tr key={`${r.tabla.id}-${f.ejemplar?.id}`} className="border-b border-borde">
                      <td className="px-2.5 py-1.5" />
                      <td className="plata px-2.5 py-1.5 font-bold">{f.ejemplar?.numero}</td>
                      <td className="px-2.5 py-1.5">
                        {f.jugada
                          ? <span className="font-semibold">{dueno(f.jugada)}</span>
                          : <span className="text-gris">nadie compró este número acá</span>}
                      </td>
                      <td className="plata px-2.5 py-1.5 text-right">
                        {f.jugada ? bs(f.jugada.monto) : '—'}
                      </td>
                      <td className={`plata px-2.5 py-1.5 text-right text-[15px] font-bold
                        ${f.jugada ? '' : 'text-gris'}`}>
                        {f.jugada ? bs(r.porGanador) : '—'}
                      </td>
                    </tr>
                  ))}

                  {/* La parte que no tiene a quién pagarse queda para la casa,
                      y se dice acá para que el total de abajo cuadre a la
                      vista y no parezca que se perdió plata. */}
                  {r.retiene > r.retieneCasa && (
                    <tr className="border-b border-borde">
                      <td className="px-2.5 py-1.5" />
                      <td colSpan={3} className="px-2.5 py-1.5 text-[13px] text-magenta">
                        queda para la casa: {bs(r.retieneCasa)} de comisión
                        {' '}+ {bs(r.retiene - r.retieneCasa)} del empatado sin dueño
                      </td>
                      <td className="plata px-2.5 py-1.5 text-right text-[13px] font-bold text-magenta">
                        {bs(r.retiene)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* La cuenta cierra a la vista: pagado + retenido = el bolsillo de
            las tres tablas. Antes «la casa retiene» sumaba sólo comisiones, y
            en un empate donde alguno de los ganadores no se había vendido
            faltaba plata que no aparecía por ningún lado. */}
        <div className="flex items-end gap-5 border-t border-borde px-4 py-3">
          <p className="max-w-[38ch] flex-1 text-[13.5px] leading-snug text-gris">
            El bolsillo es lo jugado en cada tabla más el pote; de ahí la casa
            retiene su comisión y el resto se reparte entre los ganadores.
            {elegidos.length > 1 && (
              <> Con {elegidos.length} empatados, lo de cada tabla se divide
              en {elegidos.length} partes iguales.</>
            )}
          </p>
          <div className="text-right">
            <span className="etiqueta">Total a pagar</span>
            <div className="plata text-4xl font-bold leading-tight">{bs(totalAPagar)}</div>
          </div>
          <div className="text-right text-[13px] leading-snug text-gris">
            <div>bolsillo <span className="plata text-tinta">{bs(totalBolsillo)}</span></div>
            <div>− se paga <span className="plata text-tinta">{bs(totalAPagar)}</span></div>
            <div className="border-t border-borde pt-0.5">
              retiene la casa{' '}
              <span className="plata font-bold text-magenta">{bs(totalRetiene)}</span>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mx-4 mb-2 rounded border border-rojo bg-rojo/5 px-3 py-2
            text-sm font-semibold text-rojo">
            {error}
          </p>
        )}

        <footer className="flex items-center gap-4 border-t border-borde px-4 py-3">
          <Casilla marcada={imprimir} onCambio={setImprimir}>Imprimir comprobantes</Casilla>
          <Casilla marcada={mostrarEnPizarra} onCambio={setMostrarEnPizarra}>
            Mostrar el ganador en la pizarra
          </Casilla>
          <div className="flex-1" />
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton
            tono="confirmar"
            className="px-4 py-2.5 text-[15px]"
            disabled={elegidos.length === 0 || confirmar.isPending}
            onClick={() => confirmar.mutate()}
          >
            {confirmar.isPending ? 'Confirmando…' : 'Confirmar premiación y cerrar carrera'}
          </Boton>
        </footer>
      </div>
    </div>
  );
}
