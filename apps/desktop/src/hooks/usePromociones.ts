import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { socket, EVENTOS } from '../lib/socket';

export const CLAVE_PROMOCIONES = ['promociones', 'activas'] as const;

/**
 * Los avisos que rota el pie de la pizarra.
 *
 * Escucha el evento global en vez de consultar cada tanto: el televisor
 * queda encendido todo el día y una consulta periódica sería tráfico
 * constante para algo que cambia una vez por semana. Cuando alguien sube o
 * baja un aviso desde Configuración, el backend avisa y esto se rehace.
 *
 * `staleTime` alto por la misma razón; el que manda es el evento.
 */
export function usePromociones() {
  const qc = useQueryClient();

  const consulta = useQuery({
    queryKey: CLAVE_PROMOCIONES,
    queryFn: api.promociones.activas,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const refrescar = () => qc.invalidateQueries({ queryKey: CLAVE_PROMOCIONES });
    socket.on(EVENTOS.promocionesCambiaron, refrescar);
    // Una reconexión pudo perderse el cambio mientras estuvo caída.
    socket.on('connect', refrescar);
    return () => {
      socket.off(EVENTOS.promocionesCambiaron, refrescar);
      socket.off('connect', refrescar);
    };
  }, [qc]);

  return consulta.data ?? [];
}
