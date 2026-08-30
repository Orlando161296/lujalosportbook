import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { socket, suscribirseACarrera, desuscribirseDeCarrera, EVENTOS } from '../lib/socket';
import type { Pizarra } from '../lib/tipos';

export const claveCarrera = (id: number) => ['carrera', id] as const;

/**
 * Hidrata la carrera por REST y la mantiene viva por socket.
 *
 * El orden importa y es el del protocolo: primero el snapshot completo, y
 * recién después la suscripción. Al revés, una reconexión (la TV que se
 * reinicia a mitad de carrera) se quedaría con estado viejo pegado.
 *
 * Los eventos traen deltas, pero acá se invalida la consulta entera en vez de
 * parchear el objeto a mano: durante un remate llegan pocos eventos por
 * segundo y una relectura local cuesta milisegundos, mientras que un parche
 * mal hecho deja la pizarra mintiendo sin que nadie se entere.
 */
export function useCarrera(carreraId: number | null) {
  const qc = useQueryClient();

  const consulta = useQuery({
    queryKey: carreraId ? claveCarrera(carreraId) : ['carrera', 'ninguna'],
    queryFn: () => api.carreras.pizarra(carreraId!),
    enabled: carreraId != null,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (carreraId == null) return;
    suscribirseACarrera(carreraId);

    const refrescar = () => {
      qc.invalidateQueries({ queryKey: claveCarrera(carreraId) });
    };

    const eventos = [
      EVENTOS.jugadaActualizada, EVENTOS.jugadaAnulada,
      EVENTOS.ejemplarRetirado, EVENTOS.ejemplarRepuesto,
      EVENTOS.tablaPoteActualizado, EVENTOS.tablaCerrada,
      EVENTOS.carreraGanadorAnunciado, EVENTOS.carreraEstadoCambiado,
      EVENTOS.tasaActualizada, EVENTOS.cobroMarcadoPagado,
    ];
    eventos.forEach((e) => socket.on(e, refrescar));

    // Una reconexión puede haberse perdido eventos mientras estuvo caída:
    // se vuelve a pedir el snapshot en vez de confiar en lo que hay en pantalla.
    socket.on('connect', () => {
      suscribirseACarrera(carreraId);
      refrescar();
    });

    return () => {
      eventos.forEach((e) => socket.off(e, refrescar));
      socket.off('connect');
      desuscribirseDeCarrera(carreraId);
    };
  }, [carreraId, qc]);

  return consulta;
}

/** Totales por tabla, derivados del snapshot: nunca se guardan en estado. */
export function totalesDeTabla(pizarra: Pizarra | undefined) {
  if (!pizarra) return [];
  return pizarra.tablas.map((tabla) => {
    const activas = tabla.jugadas.filter((j) => j.estado === 'activa');
    const totalJugado = activas.reduce((acc, j) => acc + Number(j.monto), 0);
    const pote = Number(tabla.poteCasa);
    const comision = Number(tabla.comisionPct);
    const bolsillo = totalJugado + pote;
    const retieneCasa = Math.round(bolsillo * (comision / 100));
    return {
      tabla,
      totalJugado,
      pote,
      bolsillo,
      retieneCasa,
      alGanador: bolsillo - retieneCasa,
    };
  });
}
