import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { bs, fechaCorta } from '../../lib/formato';
import { useNavegacion, useSesion } from '../../lib/estado';
import { BarraSuperior, Marco, PestanasRemate } from '../../layout/Marco';
import { Login, BotonSalir } from '../../pantallas/Login';
import { Tablero } from '../../pantallas/remate/Tablero';
import { Ejemplares } from '../../pantallas/remate/Ejemplares';
import { Historial } from '../../pantallas/remate/Historial';
import { ResumenDia } from '../../pantallas/ResumenDia';
import { Configuracion } from '../../pantallas/config/Configuracion';
import { Boton, Vacio } from '../../ui';
import { Desplegable } from '../../ui/desplegable';
import { BotonCerrarCarrera } from '../../pantallas/remate/BotonCerrarCarrera';
import { avisar } from '../../ui/avisos';
import { socket, EVENTOS } from '../../lib/socket';

export function TaquillaApp() {
  const usuario = useSesion((s) => s.usuario);
  const { seccion } = useNavegacion();

  if (!usuario) return <Login />;

  return (
    <Marco>
      {seccion === 'remate' && <Remate />}
      {seccion === 'resumen' && (
        <>
          <BarraSuperior titulo={<span className="text-[17px] font-semibold">Resumen del día</span>}>
            <BotonSalir />
          </BarraSuperior>
          <ResumenDia />
        </>
      )}
      {seccion === 'config' && (
        <>
          <BarraSuperior titulo={<span className="text-[17px] font-semibold">Configuración</span>}>
            <BotonSalir />
          </BarraSuperior>
          <Configuracion />
        </>
      )}
      {['ganadores', 'tablasFijas', 'cincoSeis'].includes(seccion) && (
        <>
          <BarraSuperior titulo={<span className="text-[17px] font-semibold">Próximamente</span>} />
          <Vacio
            titulo="Este juego todavía no está construido"
            detalle="El sistema ya lo contempla — el ticket imprime «Tipo de juego» justamente por eso — pero por ahora sólo funciona Remate."
          />
        </>
      )}
    </Marco>
  );
}

/** El juego Remate: barra con selector de carrera + sus cuatro pantallas. */
function Remate() {
  const { pantallaRemate, carreraId, elegirCarrera, irAConfig } = useNavegacion();

  // Se trabaja sobre la jornada abierta, no sobre toda la base. Antes esto
  // pedía TODAS las carreras de TODAS las jornadas y elegía sola la primera
  // `abierta` que encontrara: una jornada vieja sin cerrar se ganaba la
  // selección y ponía al operador a rematar en el día equivocado.
  const qc = useQueryClient();
  const jornada = useQuery({ queryKey: ['jornada-activa'], queryFn: api.jornadas.activa });
  const tasa = useQuery({ queryKey: ['tasa'], queryFn: api.tasa.vigente });

  // Abrir o cerrar una jornada se anuncia a todos los clientes: si se hizo
  // desde otra ventana —o desde la segunda PC el día que exista— esta tiene
  // que dejar de ofrecer las carreras de la jornada anterior en el acto.
  useEffect(() => {
    const alCambiar = () => {
      qc.invalidateQueries({ queryKey: ['jornada-activa'] });
      qc.invalidateQueries({ queryKey: ['resumen-dia'] });
    };
    socket.on(EVENTOS.jornadaActivaCambiada, alCambiar);
    socket.on('connect', alCambiar);
    return () => {
      socket.off(EVENTOS.jornadaActivaCambiada, alCambiar);
      socket.off('connect', alCambiar);
    };
  }, [qc]);

  const carreras = jornada.data?.carreras ?? [];

  // Dentro de la jornada elegida sí se adelanta a la carrera en remate: eso
  // no es decidir el día de trabajo, es no hacerle buscar en el desplegable
  // la que ya está corriendo. Y si la carrera elegida no es de esta jornada
  // —quedó de la anterior— se suelta, para no rematar fuera de la jornada.
  useEffect(() => {
    if (!carreras.length) {
      if (carreraId != null) elegirCarrera(null);
      return;
    }
    if (carreraId != null && carreras.some((c) => c.id === carreraId)) return;
    const abierta = carreras.find((c) => c.estado === 'abierta');
    elegirCarrera((abierta ?? carreras[0]).id);
  }, [jornada.data, carreraId, elegirCarrera]);

  const actual = carreras.find((c) => c.id === carreraId);

  // Lo que el operador elige acá es lo que se ve en el TV. Se anuncia al
  // backend, que avisa por socket a la ventana de la pizarra — antes esa
  // ventana adivinaba sola cuál mostrar y quedaba desfasada.
  useEffect(() => {
    if (carreraId == null) return;
    api.pizarra.mostrar(carreraId).catch(() => {
      // Que el TV no siga a la taquilla no puede frenar el remate: el
      // operador sigue trabajando y el aviso saldría en cada cambio.
    });
  }, [carreraId]);

  if (!jornada.isPending && !jornada.data) {
    return (
      <>
        <BarraSuperior
          pestanas={<PestanasRemate />}
          titulo={<span className="text-[17px] font-semibold">Remate</span>}
        >
          <BotonSalir />
        </BarraSuperior>
        <Vacio
          titulo="No hay ninguna jornada abierta"
          detalle="Elegí con cuál trabajar en Configuración › Carreras del día. Mientras no haya una jornada abierta, el remate no tiene carreras que ofrecer."
          accion={
            <Boton tono="principal" onClick={() => irAConfig('jornadas')}>
              Ir a Carreras del día
            </Boton>
          }
        />
      </>
    );
  }

  return (
    <>
      <BarraSuperior
        pestanas={<PestanasRemate />}
        titulo={
          <div className="flex items-center gap-3">
            {/* Con qué jornada se está trabajando, sin tener que ir a
                Configuración a confirmarlo. Va antes que la carrera porque
                es el dato que enmarca a todo lo demás: rematar la carrera 1
                del día equivocado es un error caro y silencioso. */}
            <div className="flex flex-col leading-tight">
              <span className="etiqueta !text-gris-claro">Jornada</span>
              <span className="text-[13px] font-semibold text-amarillo">
                {jornada.data
                  ? `${fechaCorta(jornada.data.fecha)} · ${jornada.data.hipodromo?.nombre ?? ''}`
                  : '—'}
              </span>
            </div>
            <span className="h-6 w-px bg-humo" />
            <Desplegable
              className="w-[290px]"
              valor={carreraId}
              vacio="Sin carreras"
              onCambio={(id) => elegirCarrera(id)}
              // El hipódromo sale de la jornada y no de cada carrera: una
              // jornada ES un hipódromo y una fecha, así que todas comparten
              // el mismo. Además `/jornadas/activa` no anida el hipódromo
              // dentro de cada carrera, y leerlo de ahí dejaba el desplegable
              // diciendo «Carrera 1 — » con el nombre en blanco.
              opciones={carreras.map((c) => ({
                valor: c.id,
                etiqueta: `Carrera ${c.numero}`,
                detalle: c.estado,
              }))}
            />
            {actual && (
              <span className={`rounded-sm px-2.5 py-1 text-[11px] font-bold uppercase
                tracking-[0.12em] ${actual.estado === 'abierta' ? 'bg-rojo text-white' : 'bg-humo text-gris-claro'}`}>
                {actual.estado}
              </span>
            )}
          </div>
        }
      >
        <div className="flex flex-col leading-tight">
          <span className="etiqueta">USD hoy</span>
          <span className="plata text-[17px] font-bold text-amarillo">
            {tasa.data ? bs(tasa.data.valorBsPorUsd) : '—'}
          </span>
        </div>
        <span className="h-6 w-px bg-humo" />
        <BotonCerrarCarrera carreraId={carreraId} />
        <Boton tono="fantasma" onClick={() => abrirPizarra()}>Pizarra ↗</Boton>
        <BotonSalir />
      </BarraSuperior>

      {pantallaRemate === 'tablero' && <Tablero />}
      {pantallaRemate === 'ejemplares' && <Ejemplares />}
      {pantallaRemate === 'historial' && <Historial />}
      {pantallaRemate === 'cobros' && (
        <Vacio
          titulo="El cobro vive en el tablero"
          detalle="Está a la derecha de la pantalla de remate, junto al tablero, para que el operador no tenga que cambiar de vista mientras cobra."
        />
      )}
    </>
  );
}

/** Trae al frente la ventana de la pizarra sin salir del remate. */
async function abrirPizarra() {
  try {
    const { getAllWebviewWindows, WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const ventanas = await getAllWebviewWindows();
    const pizarra = ventanas.find((v) => v.label === 'pizarra');

    // Existe todavía: sólo hay que traerla al frente.
    if (pizarra) {
      await pizarra.show();
      await pizarra.setFocus();
      return;
    }

    // Cerrarla la destruye, y entonces deja de aparecer en la lista. Antes
    // el botón no hacía nada en ese caso —ni abría ni avisaba— y la única
    // salida era reiniciar la app en medio de la jornada. Se vuelve a crear
    // con la misma configuración que le da el Rust al arrancar.
    const { availableMonitors, currentMonitor } = await import('@tauri-apps/api/window');
    const monitores = await availableMonitors();
    const actual = await currentMonitor();
    // El monitor de la pizarra es cualquiera que no sea donde está la
    // taquilla; si hay uno solo, se abre como ventana común y movible.
    const propio = monitores.find((m) => m.name !== actual?.name);

    const nueva = new WebviewWindow('pizarra', {
      url: 'index.html',
      title: 'Lujalo — Pizarra Pública',
      width: propio ? propio.size.width : 1024,
      height: propio ? propio.size.height : 640,
      x: propio ? propio.position.x : 60,
      y: propio ? propio.position.y : 60,
      decorations: !propio,
      skipTaskbar: !!propio,
      resizable: !propio,
      fullscreen: !!propio,
      visible: true,
    });

    await new Promise<void>((listo, falla) => {
      nueva.once('tauri://created', () => listo());
      nueva.once('tauri://error', (e) => falla(new Error(String(e.payload))));
    });
    await nueva.setFocus();
    avisar.exito('Pizarra reabierta', propio ? 'En la segunda pantalla' : 'Como ventana');
  } catch (e) {
    // Fuera de Tauri (navegador, durante el desarrollo de UI) no hay
    // ventanas y esto falla siempre: ahí no molesta con un aviso.
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      avisar.error('No se pudo abrir la pizarra', e instanceof Error ? e.message : 'Error inesperado.');
    }
  }
}
