import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { avisar } from '../../ui/avisos';
import { useNavegacion } from '../../lib/estado';
import { claveCarrera, useCarrera } from '../../hooks/useCarrera';
import type { ColorNumero } from '../../lib/tipos';
import { Boton, Cargando, Entrada, Etiqueta, Gualdrapa, Panel, Pildora, Problema, Vacio } from '../../ui';

/**
 * Carga de ejemplares. La tabla ES el formulario: se escribe el nombre en la
 * celda y Tab baja de línea. Un formulario por caballo sería insoportable
 * cuando hay catorce y la primera carrera arranca en veinte minutos.
 */
export function Ejemplares() {
  const carreraId = useNavegacion((s) => s.carreraId);
  const qc = useQueryClient();
  const { data: carrera, isPending, error, refetch } = useCarrera(carreraId);
  const colores = useQuery({ queryKey: ['colores'], queryFn: api.colores.listar });

  const porNumero = useMemo(
    () => new Map((colores.data ?? []).map((c: ColorNumero) => [c.numero, c])),
    [colores.data],
  );

  // Se guarda como texto y sólo se convierte a número al confirmar. Con la
  // conversión en cada tecla, borrar el campo lo dejaba en 1 al instante y
  // después lo tecleado se le pegaba detrás: querías 7 y te quedaba 17. Y
  // con la cantidad en 1 la tabla mostraba una sola fila, así que al número
  // 7 no había dónde escribirlo.
  const [cantidadTexto, setCantidadTexto] = useState('14');
  const cantidad = Math.max(1, Number(cantidadTexto) || 1);
  const [borradores, setBorradores] = useState<Record<number, string>>({});
  const inputs = useRef<Record<number, HTMLInputElement | null>>({});

  // Sólo al cambiar de carrera. Antes dependía también de cuántos había
  // cargados, así que cada caballo que se daba de alta volvía a disparar el
  // efecto y pisaba el número que el operador había escrito: ponía 14,
  // cargaba uno, y el campo saltaba de vuelta a 8.
  useEffect(() => {
    if (carrera) setCantidadTexto(String(Math.max(carrera.ejemplares.length, 12)));
  }, [carrera?.id]);

  const crear = useMutation({
    mutationFn: ({ numero, nombre }: { numero: number; nombre: string }) =>
      api.ejemplares.crear(carreraId!, numero, nombre),
    onSuccess: () => carreraId && qc.invalidateQueries({ queryKey: claveCarrera(carreraId) }),
  });

  // Retirar genera el reembolso de lo ya cobrado y reponer lo borra: los
  // dos mueven la lista de cobros, no sólo la carrera.
  const refrescar = () => {
    if (!carreraId) return;
    qc.invalidateQueries({ queryKey: claveCarrera(carreraId) });
    qc.invalidateQueries({ queryKey: ['cobros', carreraId] });
  };

  // Un nombre mal tecleado quedaba impreso en tickets e historial para
  // siempre: la única salida era borrar el ejemplar y con él sus jugadas.
  const renombrar = useMutation({
    mutationFn: ({ id, nombre }: { id: number; nombre: string }) =>
      api.ejemplares.renombrar(id, nombre),
    onSuccess: refrescar,
    onError: (e) => avisar.error(
      'No se pudo corregir el nombre',
      e instanceof Error ? e.message : 'Error inesperado.',
    ),
  });

  const retirar = useMutation({
    mutationFn: (id: number) => api.ejemplares.retirar(id),
    onSuccess: refrescar,
  });

  const reponer = useMutation({
    mutationFn: (id: number) => api.ejemplares.reponer(id),
    onSuccess: refrescar,
  });

  if (carreraId == null) {
    return <Vacio titulo="No hay carrera elegida" detalle="Elegí una carrera en Configuración › Carreras del día." />;
  }
  if (isPending) return <Cargando que="los ejemplares" />;
  if (error) return <Problema error={error} reintentar={refetch} />;
  if (!carrera) return null;

  const cargados = carrera.ejemplares.length;
  const filas = Array.from({ length: Math.max(cantidad, cargados) }, (_, i) => i + 1);

  // Suelta el borrador de esa fila QUITANDO la clave, no vaciándola.
  //
  // La celda se pinta con `borradores[n] ?? e?.nombre`, y `??` sólo cae al
  // nombre guardado si el borrador es undefined: dejarlo en '' hacía que la
  // fila quedara en blanco después de guardar. El ejemplar estaba bien
  // grabado, pero el nombre desaparecía de la pantalla y ya no había qué
  // corregir — parecía que se hubiera perdido.
  const olvidarBorrador = (numero: number) =>
    setBorradores(({ [numero]: _descartado, ...resto }) => resto);

  function guardar(numero: number) {
    const nombre = (borradores[numero] ?? '').trim();
    const existente = carrera?.ejemplares.find((x) => x.numero === numero);

    // Sin borrador no hay nada que hacer. Vaciar el campo de un ejemplar ya
    // cargado tampoco lo borra: para sacarlo de la carrera está Retirar,
    // que anula sus jugadas y arma el reembolso.
    if (!nombre) {
      olvidarBorrador(numero);
      return;
    }

    if (existente) {
      if (nombre !== existente.nombre) renombrar.mutate({ id: existente.id, nombre });
    } else {
      crear.mutate({ numero, nombre });
    }
    olvidarBorrador(numero);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div className="flex items-end gap-7">
        <div>
          <h1 className="font-display text-[27px] tracking-[-0.02em]">
            Ejemplares · Carrera {carrera.numero}
          </h1>
          <p className="text-[15px] text-gris">{carrera.hipodromo?.nombre}</p>
        </div>
        <label className="flex flex-col gap-1.5">
          <Etiqueta>Ejemplares</Etiqueta>
          <div className="flex items-center gap-2.5">
            <Entrada
              grande
              className="w-[88px] text-center"
              inputMode="numeric"
              value={cantidadTexto}
              onChange={(e) => setCantidadTexto(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => setCantidadTexto(String(cantidad))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </div>
        </label>
        <div>
          <Etiqueta>Cargados</Etiqueta>
          <div className="flex items-baseline gap-1.5">
            <span className="plata text-[32px] font-bold text-naranja">{cargados}</span>
            <span className="text-base text-gris">de {filas.length}</span>
          </div>
        </div>
        <div className="flex-1" />
        <p className="max-w-[280px] text-right text-sm leading-snug text-gris">
          Escribí los nombres directo en la tabla · <b className="text-tinta">Tab</b> baja de línea
        </p>
      </div>

      <Panel className="min-h-0 flex-1" cuerpoClassName="p-0 min-h-0 flex-1 overflow-hidden">
        <div className="barra-scroll h-full overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-carbon text-gris-claro">
                <th className="w-[70px] px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">N°</th>
                <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Ejemplar</th>
                <th className="w-[150px] px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Estado</th>
                <th className="w-[130px] px-2.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {filas.map((n) => {
                const e = carrera.ejemplares.find((x) => x.numero === n);
                const c = porNumero.get(n);
                return (
                  <tr key={n} className="border-b border-borde">
                    <td className="px-2.5 py-1.5">
                      <Gualdrapa
                        numero={n}
                        color={c?.colorHex ?? '#CFC8BA'}
                        texto={c?.textoHex ?? '#7a7770'}
                        apagada={!e}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      {/* Siempre editable, esté cargado o no: la misma celda
                          sirve para dar de alta y para corregir un tipeo. */}
                      <input
                        ref={(el) => { inputs.current[n] = el; }}
                        value={borradores[n] ?? e?.nombre ?? ''}
                        placeholder="NOMBRE DEL EJEMPLAR…"
                        title={e ? 'Escribí para corregir el nombre' : undefined}
                        // En mayúsculas desde la primera tecla: es como
                        // se guarda y como se ve en el tablero y el TV.
                        onChange={(ev) => setBorradores((b) => ({ ...b, [n]: ev.target.value.toUpperCase() }))}
                        onBlur={() => guardar(n)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Escape') {
                            // Cancelar vuelve al nombre guardado, no a vacío.
                            olvidarBorrador(n);
                            (ev.target as HTMLInputElement).blur();
                            return;
                          }
                          if (ev.key === 'Enter' || ev.key === 'Tab') {
                            guardar(n);
                            if (ev.key === 'Enter') {
                              ev.preventDefault();
                              inputs.current[n + 1]?.focus();
                            }
                          }
                        }}
                        className={`w-full rounded border border-transparent bg-transparent px-2
                          py-1 font-display text-sm placeholder:font-ui placeholder:text-gris
                          hover:border-borde focus:border-carbon focus:bg-white focus:outline-none
                          ${e?.estado === 'retirado' ? 'text-gris line-through' : ''}`}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      {!e ? <span className="text-[13px] text-gris">sin cargar</span>
                        : e.estado === 'retirado' ? <Pildora tono="no">Retirado</Pildora>
                        : <Pildora tono="ok">Activo</Pildora>}
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      {e && (e.estado === 'retirado' ? (
                        <Boton onClick={() => reponer.mutate(e.id)}>Reponer</Boton>
                      ) : (
                        <Boton tono="destructivo" onClick={() => retirar.mutate(e.id)}>Retirar</Boton>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="text-[13px] leading-snug text-gris">
        Un ejemplar retirado <b className="text-tinta">no se borra</b>: se marca. Retirarlo anula
        sus jugadas en cascada y genera el reembolso si ya se le había cobrado al cliente.
      </p>
    </div>
  );
}
