import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { bs, usd } from '../lib/formato';
import { Boton, Cargando, Panel, Pildora, Problema, Vacio } from '../ui';
import { useNavegacion } from '../lib/estado';

interface Resumen {
  /** null cuando no hay ninguna jornada abierta: no hay nada que resumir. */
  jornadaId: number | null;
  fecha: string | null;
  hipodromo: string | null;
  carreras: number;
  corridas: number;
  totalRematado: number;
  totalCasa: number;
  totalPote: number;
  totalMovido: number;
  totalPagado: number;
  retieneCasa: number;
  tasaVigente: { valorBsPorUsd: string } | null;
  porCarrera: {
    carreraId: number; numero: number; estado: string; corrida: boolean;
    rematado: number; casa: number; pote: number;
    aPagar: number | null; retieneCasa: number | null;
  }[];
  porTaquilla: { nombre: string; monto: number }[];
}

/**
 * Cierre de jornada. Las tres cifras de arriba son tres bolsillos distintos
 * y confundirlos es el error caro: lo que rematan los clientes, lo que juega
 * la casa con los caballos que nadie pujó, y el pote que agrega encima.
 */
export function ResumenDia() {
  const { irAConfig } = useNavegacion();
  const consulta = useQuery({
    queryKey: ['resumen-dia'],
    // Sin argumentos: el backend resume la jornada abierta. Antes esto era
    // por fecha civil, y dos hipódromos que corrían el mismo día se sumaban
    // en un solo cierre que no cuadraba con ninguna de las dos cajas.
    queryFn: () => api.reportes.resumenDia<Resumen>(),
    refetchInterval: 60_000,
  });

  if (consulta.isPending) return <Cargando que="el resumen" />;
  if (consulta.error) return <Problema error={consulta.error} reintentar={consulta.refetch} />;
  const r = consulta.data;

  // Un resumen en cero y un resumen de nada se ven igual en cifras, y no son
  // lo mismo: sin jornada abierta no hay caja que cuadrar todavía.
  if (r.jornadaId == null) {
    return (
      <Vacio
        titulo="No hay ninguna jornada abierta"
        detalle="El resumen es el cierre de una jornada. Abrí con cuál trabajar en Configuración › Carreras del día."
        accion={
          <Boton tono="principal" onClick={() => irAConfig('jornadas')}>
            Ir a Carreras del día
          </Boton>
        }
      />
    );
  }
  const tasa = r.tasaVigente ? Number(r.tasaVigente.valorBsPorUsd) : null;
  const maxTaquilla = Math.max(1, ...r.porTaquilla.map((t) => t.monto));

  return (
    <div className="barra-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
      <div className="flex items-end gap-4">
        <div>
          <h1 className="font-display text-[25px] tracking-[-0.02em]">Resumen del día</h1>
          <p className="text-[15px] text-gris">
            {r.hipodromo ?? 'Sin jornada'} · {r.corridas} de {r.carreras} carreras corridas
          </p>
        </div>
        <div className="flex-1" />
        <Boton>Imprimir</Boton>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Cifra titulo="Total rematado" valor={r.totalRematado} nota="Bs · jugadas de clientes" barra="border-amarillo" />
        <Cifra titulo="Jugó la casa" valor={r.totalCasa} nota="Bs · caballos devueltos" barra="border-magenta" color="text-magenta" />
        <Cifra titulo="Pote aportado" valor={r.totalPote} nota="Bs · adicional de la casa" barra="border-naranja" color="text-naranja" />
      </div>

      <div className="flex flex-1 gap-4">
        <Panel titulo="Por carrera" className="flex-1" cuerpoClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-carbon text-gris-claro">
                {['Carr.', 'Rematado Bs', 'Casa Bs', 'Pote Bs', 'Pagado Bs', 'Retiene casa'].map((h, i) => (
                  <th key={h} className={`px-2.5 py-2 text-[10.5px] uppercase tracking-[0.1em]
                    ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.porCarrera.map((c) => (
                <tr key={c.carreraId}
                  className={`border-b border-borde ${c.estado === 'abierta' ? 'outline outline-2 -outline-offset-2 outline-amarillo' : ''}`}>
                  <td className="px-2.5 py-1.5">
                    <span className="flex items-center gap-2">
                      <b className="plata">{c.numero}</b>
                      {c.estado === 'abierta' && <Pildora tono="no">En remate</Pildora>}
                      {!c.corrida && c.estado !== 'abierta' && <Pildora>Pendiente</Pildora>}
                    </span>
                  </td>
                  <td className="plata px-2.5 py-1.5 text-right font-bold">{bs(c.rematado)}</td>
                  <td className="plata px-2.5 py-1.5 text-right text-magenta">{bs(c.casa)}</td>
                  <td className="plata px-2.5 py-1.5 text-right">{bs(c.pote)}</td>
                  <td className="plata px-2.5 py-1.5 text-right">
                    {c.aPagar == null
                      ? <span className="font-semibold text-naranja">por pagar</span>
                      : bs(c.aPagar)}
                  </td>
                  <td className="plata px-2.5 py-1.5 text-right text-gris">
                    {c.retieneCasa == null ? '—' : bs(c.retieneCasa)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {r.porTaquilla.length > 0 && (
            <>
              <div className="border-t border-borde bg-hueso px-2.5 py-2">
                <span className="etiqueta">Por taquilla</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {r.porTaquilla.map((t) => (
                    <tr key={t.nombre} className="border-b border-borde">
                      <td className="px-2.5 py-1.5">{t.nombre}</td>
                      <td className="plata px-2.5 py-1.5 text-right font-bold">{bs(t.monto)}</td>
                      <td className="w-[170px] px-2.5 py-1.5">
                        <div className="h-1.5 overflow-hidden rounded bg-borde">
                          <div className="h-full bg-amarillo"
                            style={{ width: `${(t.monto / maxTaquilla) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Panel>

        <Panel titulo="Cuenta del día" className="w-[392px] flex-none self-start" cuerpoClassName="p-0">
          <div className="flex flex-col gap-2 p-3">
            <Linea texto="Rematado a clientes" valor={r.totalRematado} />
            <Linea texto="Jugado por la casa" valor={r.totalCasa} color="text-magenta" />
            <Linea texto="Pote aportado" valor={r.totalPote} color="text-naranja" />
            <div className="flex items-baseline justify-between border-t border-borde pt-2.5">
              <span className="etiqueta">Total movido</span>
              <div className="text-right">
                <div className="plata text-3xl font-bold leading-tight">{bs(r.totalMovido)}</div>
                {tasa && (
                  <div className="plata text-[12.5px] text-gris">
                    ≈ {usd(r.totalMovido, tasa)} · tasa {bs(tasa)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-borde bg-black/[0.02] p-3">
            <Linea texto="Pagado a ganadores" valor={r.totalPagado} />
            <Linea texto="Retuvo la casa" valor={r.retieneCasa} color="text-verde" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Cifra({
  titulo, valor, nota, barra, color = '',
}: { titulo: string; valor: number; nota: string; barra: string; color?: string }) {
  return (
    <div className={`tarjeta border-l-4 px-4 py-3.5 ${barra}`}>
      <span className="etiqueta">{titulo}</span>
      <div className={`plata text-[38px] font-bold leading-tight ${color}`}>{bs(valor)}</div>
      <span className="text-[13px] text-gris">{nota}</span>
    </div>
  );
}

function Linea({ texto, valor, color = '' }: { texto: string; valor: number; color?: string }) {
  return (
    <div className="flex justify-between text-[15px]">
      <span>{texto}</span>
      <b className={`plata ${color}`}>{bs(valor)}</b>
    </div>
  );
}
