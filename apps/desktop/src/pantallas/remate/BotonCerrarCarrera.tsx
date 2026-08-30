import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCarrera, claveCarrera } from '../../hooks/useCarrera';
import { avisar } from '../../ui/avisos';
import { Boton } from '../../ui';

/**
 * Cerrar la carrera es un solo gesto para el operador y dos cosas para el
 * sistema: dejar de aceptar pujas y armar lo que hay que cobrar.
 *
 * Vive en la barra superior, al lado del selector de carrera, y no dentro
 * del tablero: es una acción sobre la carrera entera, no sobre una jugada,
 * y desde acá está a la vista sin importar en qué pestaña esté el operador.
 *
 * Lee la carrera del mismo caché que el tablero (`useCarrera`), así que no
 * agrega una consulta y se entera solo cuando las tablas cambian de estado.
 */
export function BotonCerrarCarrera({ carreraId }: { carreraId: number | null }) {
  const qc = useQueryClient();
  const { data: carrera } = useCarrera(carreraId);

  const cerrar = useMutation({
    mutationFn: async () => {
      const abiertas = (carrera?.tablas ?? []).filter((t) => t.estado === 'abierta');
      for (const t of abiertas) await api.tablas.cerrar(t.id);
      // Se generan después de cerrar, nunca antes: una puja que entrara entre
      // ambos pasos quedaría fuera del cobro y se cobraría de menos.
      const cobros = await api.cobros.generar(carreraId!);
      return { cerradas: abiertas.length, cobros: cobros.length };
    },
    onSuccess: ({ cerradas, cobros }) => {
      if (carreraId) qc.invalidateQueries({ queryKey: claveCarrera(carreraId) });
      qc.invalidateQueries({ queryKey: ['cobros', carreraId] });
      avisar.exito(
        cobros === 1 ? '1 jugador por cobrar' : `${cobros} jugadores por cobrar`,
        cerradas > 0 ? `${cerradas} tablas cerradas` : 'Las tablas ya estaban cerradas',
      );
    },
    onError: (e) => avisar.error(
      'No se cerró la carrera',
      e instanceof Error ? e.message : 'Error inesperado.',
    ),
  });

  if (!carrera) return null;
  const abiertas = carrera.tablas.filter((t) => t.estado === 'abierta').length;

  // Ya cerrada: el botón se apaga en vez de desaparecer, para que el
  // operador vea que el cierre ocurrió y no lo busque. Sigue apretable
  // porque una jugada cargada antes de generar puede haber quedado sin
  // cobro, y regenerar sólo toma las que ningún cobro cubre.
  return (
    <Boton
      tono={abiertas > 0 ? 'destructivo' : 'fantasma'}
      disabled={cerrar.isPending}
      onClick={() => cerrar.mutate()}
      title={abiertas > 0
        ? 'Cierra las tablas y pasa a todos los que jugaron a Por cobrar'
        : 'La carrera ya está cerrada · vuelve a generar los cobros que falten'}
    >
      {cerrar.isPending
        ? 'Cerrando…'
        : abiertas > 0
          ? 'Cerrar carrera'
          : 'Carrera cerrada'}
    </Boton>
  );
}
