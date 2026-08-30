import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Boton, Cargando, Problema } from '../../ui';
import { avisar } from '../../ui/avisos';

/**
 * Previsualización e impresión del ticket.
 *
 * El backend devuelve el texto ya armado contra las columnas reales del
 * papel que tenga configurada esta PC —32 en la térmica de 58 mm que usa el
 * local, 48 si algún día se pasa a una de 80 mm— y acá se muestra en
 * monoespaciada sin tocarlo. Eso hace que lo que se ve en pantalla sea
 * exactamente lo que sale impreso.
 *
 * Por eso el ancho se lee del backend en vez de escribirlo acá: el día que
 * cambien de impresora, esta pantalla ya dice la verdad sin recompilar.
 */
export function ModalTicket({
  ticketId, numero, onCerrar,
}: { ticketId: number; numero: number; onCerrar: () => void }) {
  const vista = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.tickets.previsualizar(ticketId),
  });

  // No cambia mientras la app está abierta —es el .env de la máquina—, así
  // que no tiene sentido volver a pedirlo cada vez que se abre un ticket.
  const impresora = useQuery({
    queryKey: ['impresora'],
    queryFn: () => api.tickets.impresora(),
    staleTime: Infinity,
  });

  // Reimprimir no consume numeración ni toca la base: es el mismo
  // comprobante saliendo otra vez, para cuando la térmica estaba sin papel
  // al cobrar o el cliente perdió el suyo.
  const imprimir = useMutation({
    mutationFn: () => api.tickets.imprimir(ticketId),
    onSuccess: () => avisar.exito(`Ticket N° ${String(numero).padStart(6, '0')} enviado a la impresora`),
    // El backend responde 503 con el motivo adentro —sin papel, apagada, mal
    // configurada—: eso es justo lo que el operador necesita leer para ir a
    // resolverlo, así que se muestra tal cual en vez de un «falló».
    onError: (e) => avisar.error(
      'No se pudo imprimir',
      e instanceof Error ? e.message : 'Error inesperado.',
    ),
  });

  const hayImpresora = impresora.data?.conectada ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-negro/70 p-6"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-full w-[520px] flex-col overflow-hidden rounded bg-hueso"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-baseline justify-between bg-carbon px-4 py-2.5 text-hueso">
          <span className="etiqueta !text-amarillo">
            Ticket N° {String(numero).padStart(6, '0')}
          </span>
          <span className="text-xs text-gris">
            {impresora.data
              ? `${impresora.data.anchoMm} mm · ${impresora.data.columnas} columnas`
              : '—'}
          </span>
        </header>

        <div className="barra-scroll min-h-0 flex-1 overflow-auto bg-white p-4">
          {vista.isPending && <Cargando que="el ticket" />}
          {vista.error && <Problema error={vista.error} reintentar={vista.refetch} />}
          {vista.data && (
            // `pre` con monoespaciada: cualquier otra fuente rompería la
            // alineación de columnas que el backend calculó por caracteres.
            <pre className="whitespace-pre font-mono text-[12px] leading-[1.35] text-tinta">
              {vista.data.texto}
            </pre>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-borde px-4 py-3">
          <p className="text-[12px] leading-snug text-gris">
            {hayImpresora
              ? `Sale por la térmica de ${impresora.data!.anchoMm} mm${
                  impresora.data!.corta ? '' : ' · cortar a mano'}.`
              : 'No hay impresora configurada: el ticket queda en el registro del servidor. Esto es la vista previa del papel.'}
          </p>
          <div className="flex gap-2">
            <Boton
              onClick={() => imprimir.mutate()}
              disabled={!hayImpresora || imprimir.isPending || !vista.data}
              title={hayImpresora
                ? 'Volver a sacar este ticket por la térmica'
                : 'No hay impresora configurada en esta PC'}
            >
              {imprimir.isPending ? 'Imprimiendo…' : 'Imprimir'}
            </Boton>
            <Boton tono="oscuro" onClick={onCerrar}>Cerrar</Boton>
          </div>
        </footer>
      </div>
    </div>
  );
}
