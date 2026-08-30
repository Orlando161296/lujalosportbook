import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ModalTicket } from './ModalTicket';
import { bs, usd } from '../../lib/formato';
import type { Cobro, Moneda } from '../../lib/tipos';
import { Boton, Monto, Pildora, Segmentado } from '../../ui';
import { avisar } from '../../ui/avisos';

/**
 * El cobro es el corazón operativo de la pantalla: nadie paga número por
 * número durante el remate, se cobra en bloque unos minutos antes de que
 * corran. Por eso cada tarjeta abre TODAS las jugadas del cliente con su
 * ejemplar y tabla — el operador canta el total sin buscar en el tablero.
 */
function nombre(c: Cobro) {
  // El apodo va antes que el fallback numérico: un cobro de un postor sin
  // registrar no tiene clienteId, y «Cliente null» no le sirve a nadie.
  return (
    c.cliente?.nombrePizarra || c.cliente?.nombre || c.apodo || `Cobro ${c.id}`
  );
}

export function PanelCobros({ carreraId, tasa }: { carreraId: number; tasa: number | null }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState<number | null>(null);
  // Ticket que se está mirando. Sólo se abre desde los chips de «ya
  // pagaron»: cobrar imprime y sigue, sin ventana de por medio. En el remate
  // se cobra en tanda y un diálogo por cliente obliga a cerrarlo con el
  // siguiente ya esperando.
  const [ticketAbierto, setTicketAbierto] = useState<{ id: number; numero: number } | null>(null);
  const [monedaPago, setMonedaPago] = useState<Record<number, Moneda>>({});

  const cobros = useQuery({
    queryKey: ['cobros', carreraId],
    queryFn: () => api.cobros.listar(carreraId),
  });

  const generar = useMutation({
    mutationFn: () => api.cobros.generar(carreraId),
    onSuccess: (nuevos) => {
      qc.invalidateQueries({ queryKey: ['cobros', carreraId] });
      avisar.exito(`${nuevos.length} cobros generados`, 'Uno por cliente, con todas sus jugadas.');
    },
    onError: (e) => avisar.error('No se generaron los cobros',
      e instanceof Error ? e.message : 'Error inesperado.'),
  });

  const pagar = useMutation({
    mutationFn: (id: number) => api.cobros.marcarPagado(id),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['cobros', carreraId] });
      if (c.tipo === 'reembolso') {
        avisar.exito(`Devuelto ${bs(c.monto)} Bs`, nombre(c));
        return;
      }
      // El ticket nace con el pago y sale por la térmica solo. Lo único que
      // hace falta en pantalla es el número, para poder cantarlo y para
      // encontrarlo después en «Ya pagaron».
      const numero = c.ticket ? ` · ticket N° ${String(c.ticket.numero).padStart(6, '0')}` : '';
      avisar.exito(`Cobrado ${bs(c.monto)} Bs${numero}`, nombre(c));

      // Que el papel no salga no cancela el cobro, pero el cliente está
      // parado esperándolo: sin la ventana del ticket de por medio, este
      // aviso es lo único que separa al operador de entregarlo sin nada.
      if (c.ticket?.errorImpresion) {
        avisar.error(
          `El ticket N° ${String(c.ticket.numero).padStart(6, '0')} no se imprimió`,
          `${c.ticket.errorImpresion}. El cobro quedó registrado: reimprimí desde «Ya pagaron» cuando lo resuelvas.`,
        );
      }
    },
    onError: (e) => avisar.error('No se marcó como pagado',
      e instanceof Error ? e.message : 'Error inesperado.'),
  });

  const { pendientes, pagados, falta, cobrado, porDevolver, aDevolver } = useMemo(() => {
    const todos = cobros.data ?? [];
    const apuestas = todos.filter((c) => c.tipo === 'cobro_apuesta');
    const pend = apuestas.filter((c) => !c.pagado);
    const pag = apuestas.filter((c) => c.pagado);
    // Los reembolsos nacen solos cuando se retira un caballo que ya estaba
    // cobrado. Antes se consultaban y no se dibujaban en ningún lado: la
    // plata quedaba registrada como "a devolver" y el operador no se
    // enteraba nunca. Van arriba y aparte porque son plata que SALE.
    const dev = todos.filter((c) => c.tipo === 'reembolso' && !c.pagado);
    return {
      pendientes: pend.sort((a, b) => Number(b.monto) - Number(a.monto)),
      pagados: pag,
      falta: pend.reduce((s, c) => s + Number(c.monto), 0),
      cobrado: pag.reduce((s, c) => s + Number(c.monto), 0),
      porDevolver: dev.sort((a, b) => Number(b.monto) - Number(a.monto)),
      aDevolver: dev.reduce((s, c) => s + Number(c.monto), 0),
    };
  }, [cobros.data]);


  return (
    <section className="tarjeta flex w-[280px] flex-none flex-col overflow-hidden xl:w-[308px]">
      <header className="flex items-baseline justify-between bg-carbon px-3 py-2">
        <span className="etiqueta !text-amarillo">Por cobrar</span>
        <span className="text-xs text-gris">toca = pagó</span>
      </header>

      <div className="barra-scroll min-h-0 flex-1 overflow-auto">
        {cobros.isPending && <p className="p-4 text-center text-sm text-gris">Cargando cobros…</p>}

        {/* Devoluciones por caballo retirado. Primero en la lista a
            propósito: es plata que sale de la caja y el que la espera está
            parado en la taquilla. */}
        {porDevolver.length > 0 && (
          <div className="border-b-2 border-naranja">
            <header className="flex items-baseline justify-between bg-naranja/15 px-3 py-1.5">
              <span className="etiqueta !text-naranja">
                A devolver · {porDevolver.length}
              </span>
              <Monto valor={aDevolver} sufijo="Bs" className="text-sm font-bold text-naranja" />
            </header>
            {porDevolver.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 border-t border-naranja/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{nombre(c)}</div>
                  <div className="text-[11.5px] text-gris">caballo retirado</div>
                </div>
                <Monto valor={c.monto} className="text-[17px] font-bold" />
                <Boton
                  tono="confirmar"
                  disabled={pagar.isPending}
                  onClick={() => pagar.mutate(c.id)}
                >
                  Devolver
                </Boton>
              </div>
            ))}
          </div>
        )}

        {!cobros.isPending && pendientes.length === 0 && pagados.length === 0
          && porDevolver.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-5 text-center">
            <p className="text-sm leading-snug text-gris">
              Todavía no se generó el cobro de esta carrera. Se hace en bloque, unos minutos
              antes de que corran.
            </p>
            <Boton
              tono="oscuro"
              disabled={generar.isPending}
              onClick={() => generar.mutate()}
            >
              {generar.isPending ? 'Generando…' : 'Generar cobros'}
            </Boton>
          </div>
        )}

        {pendientes.map((c, i) => {
          const desplegado = abierto === c.id || (abierto === null && i === 0);
          const mon = monedaPago[c.id] ?? 'Bs';
          return (
            <article
              key={c.id}
              className={desplegado
                ? 'border-b-2 border-amarillo bg-amarillo/10'
                : 'border-b border-borde'}
            >
              <button
                type="button"
                onClick={() => setAbierto(desplegado ? -1 : c.id)}
                className="flex w-full items-baseline justify-between px-3 py-2 text-left"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  {nombre(c)}
                  {c.cliente?.esVip && <Pildora tono="vip">VIP</Pildora>}
                </span>
                <Monto valor={c.monto} className="text-[19px] font-bold" />
              </button>

              {desplegado && (
                <>
                  <div className="flex items-center gap-2 px-3 pb-2">
                    <span className="etiqueta">Paga en</span>
                    <Segmentado
                      className="flex-1"
                      valor={mon}
                      onCambio={(v) => setMonedaPago((m) => ({ ...m, [c.id]: v }))}
                      opciones={[
                        { valor: 'Bs' as Moneda, etiqueta: 'Bs' },
                        { valor: 'USD' as Moneda, etiqueta: 'USD' },
                      ]}
                    />
                    {tasa && (
                      <span className="plata text-xs text-gris">≈ {usd(c.monto, tasa)}</span>
                    )}
                  </div>
                  <div className="flex gap-2 px-3 pb-2.5">
                    <Boton
                      tono="confirmar"
                      className="flex-1"
                      disabled={pagar.isPending}
                      onClick={() => pagar.mutate(c.id)}
                    >
                      Marcar pagado
                    </Boton>
                    <Boton
                      disabled
                      title="El ticket se emite al marcar el cobro como pagado"
                    >⎙</Boton>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <footer className="flex-none">
        <div className="bg-carbon px-3 py-2.5 text-hueso">
          <div className="flex items-baseline justify-between">
            <span className="etiqueta">Falta por cobrar</span>
            {tasa && <span className="plata text-xs text-gris">≈ {usd(falta, tasa)}</span>}
          </div>
          <Monto valor={falta} sufijo="Bs" className="text-[27px] font-bold text-amarillo" />
        </div>

        <div className="border-t border-humo bg-tinta px-3 py-2 text-gris-claro">
          <div className="flex items-baseline justify-between">
            <span className="etiqueta !text-verde">Ya pagaron · {pagados.length}</span>
            <Monto valor={cobrado} sufijo="Bs" className="text-sm font-bold" />
          </div>
          {pagados.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {pagados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!c.ticket}
                  title={c.ticket
                    ? `Ver el ticket N° ${String(c.ticket.numero).padStart(6, '0')}`
                    : 'Este cobro no tiene ticket'}
                  onClick={() => c.ticket && setTicketAbierto({ id: c.ticket.id, numero: c.ticket.numero })}
                  className="flex items-center gap-1.5 rounded-sm border border-verde px-2
                    py-0.5 text-xs hover:bg-verde/20 disabled:opacity-50"
                >
                  {nombre(c)}
                  <span className="plata text-[11px] text-verde">{bs(c.monto)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[11.5px] text-gris">
            Toca el chip para ver o reimprimir · <b className="text-gris-claro">F3</b> reimprime el último
          </p>
        </div>
      </footer>

      {ticketAbierto && (
        <ModalTicket
          ticketId={ticketAbierto.id}
          numero={ticketAbierto.numero}
          onCerrar={() => setTicketAbierto(null)}
        />
      )}
    </section>
  );
}
