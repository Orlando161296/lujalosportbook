import { Injectable } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';

/**
 * Qué carrera está puesta en el TV.
 *
 * La pizarra elegía sola la primera carrera `abierta` y la releía cada 20
 * segundos. Con eso, cambiar de carrera en la taquilla no movía el TV: el
 * público seguía viendo la anterior hasta el siguiente refresco, o para
 * siempre si la anterior seguía abierta. Lo que va en la pantalla grande lo
 * decide el operador, y tiene que verse en el acto.
 *
 * El dato vive en memoria a propósito. El backend es un sidecar que arranca
 * y muere con la app, así que persistirlo no compraría nada: si se reinicia
 * todo, el operador vuelve a elegir la carrera igual. Lo único que tiene que
 * sobrevivir es cerrar y reabrir la ventana de la pizarra, y eso no toca al
 * backend.
 */
@Injectable()
export class PizarraService {
  private carreraId: number | null = null;

  constructor(private readonly events: EventsGateway) {}

  actual(): { carreraId: number | null } {
    return { carreraId: this.carreraId };
  }

  mostrar(carreraId: number | null) {
    // Reanunciar la misma carrera no es un cambio: emitir igual haría que
    // todas las ventanas revalidaran de gusto.
    if (this.carreraId === carreraId) return this.actual();
    this.carreraId = carreraId;
    this.events.pizarraCarreraCambiada({ carreraId });
    return this.actual();
  }
}
