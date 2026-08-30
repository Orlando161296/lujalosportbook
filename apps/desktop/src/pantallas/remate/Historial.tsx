import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { bs, hora } from '../../lib/formato';
import { useNavegacion } from '../../lib/estado';
import { useCarrera } from '../../hooks/useCarrera';
import type { ColorNumero, Jugada } from '../../lib/tipos';
import { Boton, Cargando, Entrada, Gualdrapa, Panel, Pildora, Problema, Segmentado, Vacio } from '../../ui';

type Filtro = 'todas' | 'activas' | 'anuladas' | 'casa';

/** Sólo consulta. Acá no se edita nada: responde «¿qué pasó con esta jugada?». */
export function Historial() {
  const carreraId = useNavegacion((s) => s.carreraId);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');

  const jugadas = useQuery({
    queryKey: ['jugadas', carreraId],
    queryFn: () => api.jugadas.listar(carreraId ? { carreraId } : {}),
  });
  const colores = useQuery({ queryKey: ['colores'], queryFn: api.colores.listar });

  // El resultado vive a nivel de carrera (`CarreraGanador`), no de la jugada:
  // sin cruzarlo acá, el historial contestaba «qué se jugó» pero no «cómo
  // terminó», que es la mitad de la pregunta que el operador viene a hacer.
  const { data: carrera } = useCarrera(carreraId);
  const ganadores = useMemo(
    () => new Set((carrera?.ganadores ?? []).map((g) => g.ejemplarId)),
    [carrera],
  );
  const hayResultado = ganadores.size > 0;

  const porNumero = useMemo(
    () => new Map((colores.data ?? []).map((c: ColorNumero) => [c.numero, c])),
    [colores.data],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (jugadas.data ?? []).filter((j: Jugada) => {
      if (filtro === 'activas' && j.estado !== 'activa') return false;
      if (filtro === 'anuladas' && j.estado !== 'anulada') return false;
      if (filtro === 'casa' && !j.esCasa) return false;
      if (!q) return true;
      const cliente = j.esCasa ? 'la casa' : (j.cliente?.nombrePizarra || j.cliente?.nombre || j.apodo || '');
      return (
        cliente.toLowerCase().includes(q) ||
        (j.ejemplar?.nombre ?? '').toLowerCase().includes(q) ||
        String(j.ticketId ?? '').includes(q)
      );
    });
  }, [jugadas.data, filtro, busqueda]);

  const resumen = useMemo(() => ({
    cantidad: filtradas.length,
    jugado: filtradas.filter((j) => j.estado === 'activa' && !j.esCasa)
      .reduce((s, j) => s + Number(j.monto), 0),
    casa: filtradas.filter((j) => j.esCasa && j.estado === 'activa')
      .reduce((s, j) => s + Number(j.monto), 0),
    anuladas: filtradas.filter((j) => j.estado === 'anulada').length,
  }), [filtradas]);

  if (jugadas.isPending) return <Cargando que="el historial" />;
  if (jugadas.error) return <Problema error={jugadas.error} reintentar={jugadas.refetch} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-[25px] tracking-[-0.02em]">Historial de jugadas</h1>
        <p className="text-[15px] text-gris">Quién jugó qué, cuándo, en qué taquilla y cómo terminó.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2.5">
        <Entrada
          className="min-w-[220px] flex-1"
          placeholder="ticket, cliente o ejemplar…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Segmentado
          valor={filtro}
          onCambio={setFiltro}
          opciones={[
            { valor: 'todas' as Filtro, etiqueta: 'Todas' },
            { valor: 'activas' as Filtro, etiqueta: 'Activas' },
            { valor: 'anuladas' as Filtro, etiqueta: 'Anuladas' },
            { valor: 'casa' as Filtro, etiqueta: 'Casa' },
          ]}
        />
        <Boton tono="fantasma" className="!border-borde-fuerte !text-tinta">Exportar</Boton>
      </div>

      <Panel className="min-h-0 flex-1" cuerpoClassName="p-0 min-h-0 flex-1 overflow-hidden">
        {filtradas.length === 0 ? (
          <Vacio
            titulo="Sin jugadas que mostrar"
            detalle={busqueda ? 'Probá con otro nombre o número de ticket.' : 'Todavía no se registró ninguna jugada en esta carrera.'}
          />
        ) : (
          <div className="barra-scroll h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-carbon text-gris-claro">
                  {['Hora', 'Ticket', 'Ejemplar', 'Cliente', 'Tabla', 'Monto Bs', 'Estado'].map((h, i) => (
                    <th key={h} className={`px-2.5 py-2 text-[10.5px] uppercase tracking-[0.1em]
                      ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((j) => {
                  const c = j.ejemplar ? porNumero.get(j.ejemplar.numero) : undefined;
                  const anulada = j.estado === 'anulada';
                  return (
                    <tr key={j.id} className={`border-b border-borde
                      ${anulada ? 'bg-rojo/[0.06]' : j.esCasa ? 'bg-magenta/[0.06]' : ''}`}>
                      <td className="plata px-2.5 py-1.5">{hora(j.registradaEn)}</td>
                      <td className="plata px-2.5 py-1.5">
                        {j.ticketId ? String(j.ticketId).padStart(6, '0') : <span className="text-gris">—</span>}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className="flex items-center gap-2">
                          {j.ejemplar && (
                            <Gualdrapa
                              numero={j.ejemplar.numero}
                              color={c?.colorHex ?? '#CFC8BA'}
                              texto={c?.textoHex ?? '#111'}
                              tam={20}
                              apagada={anulada}
                            />
                          )}
                          <span className={`font-display text-[13px] ${anulada ? 'text-gris line-through' : ''}`}>
                            {j.ejemplar?.nombre ?? '—'}
                          </span>
                        </span>
                      </td>
                      <td className={`px-2.5 py-1.5 ${j.esCasa ? 'font-semibold text-magenta' : ''}`}>
                        {j.esCasa ? 'LA CASA' : (j.cliente?.nombrePizarra || j.cliente?.nombre || j.apodo || '—')}
                      </td>
                      <td className="px-2.5 py-1.5">{j.tabla?.etiqueta ?? '—'}</td>
                      <td className={`plata px-2.5 py-1.5 text-right ${anulada ? 'text-gris' : 'font-bold'}`}>
                        {bs(j.monto)}
                      </td>
                      <td className="px-2.5 py-1.5">
                        {/* Mientras no haya resultado la jugada sólo puede
                            estar activa; una vez premiada la carrera, lo que
                            importa es si ese número salió o no. */}
                        {anulada ? <Pildora tono="no">Anulada</Pildora>
                          : !hayResultado ? (
                            j.esCasa ? <Pildora tono="casa">Casa</Pildora>
                              : <Pildora tono="ok">Activa</Pildora>
                          ) : ganadores.has(j.ejemplarId) ? (
                            <span className="flex items-center gap-1.5">
                              <Pildora tono="ok">Ganó</Pildora>
                              {j.esCasa && <Pildora tono="casa">Casa</Pildora>}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Pildora tono="neutro">Perdió</Pildora>
                              {j.esCasa && <Pildora tono="casa">Casa</Pildora>}
                            </span>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="flex flex-wrap items-baseline gap-7">
        <Dato titulo="Jugadas" valor={String(resumen.cantidad)} />
        <Dato titulo="Jugado" valor={`${bs(resumen.jugado)} Bs`} />
        <Dato titulo="De la casa" valor={`${bs(resumen.casa)} Bs`} color="text-magenta" />
        <Dato titulo="Anuladas" valor={String(resumen.anuladas)} color="text-rojo" />
      </div>

      <p className="text-[13px] leading-snug text-gris">
        Una jugada <b className="text-tinta">nunca se borra</b>: cambia de estado. Una anulada por
        retiro conserva su ticket y su monto, porque el reembolso hay que poder rastrearlo.
      </p>
    </div>
  );
}

function Dato({ titulo, valor, color = '' }: { titulo: string; valor: string; color?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="etiqueta">{titulo}</span>
      <b className={`plata text-lg ${color}`}>{valor}</b>
    </span>
  );
}
