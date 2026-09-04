import { Fragment, useMemo, useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErrorApi } from '../../lib/api';
import { bs, formatearMientrasEscribe, parsearMonto, usd } from '../../lib/formato';
import { useNavegacion, useSesion } from '../../lib/estado';
import { claveCarrera, totalesDeTabla, useCarrera } from '../../hooks/useCarrera';
import type { Cliente, ColorNumero, Ejemplar, Moneda } from '../../lib/tipos';
import {
  Boton, Campo, Cargando, Entrada, Etiqueta, Gualdrapa, Panel, Pildora, Problema, Segmentado, Vacio,
} from '../../ui';
import { Autocompletar } from '../../ui/autocompletar';
import { avisar } from '../../ui/avisos';
import { PanelCobros } from './PanelCobros';
import { ModalPremiar } from './ModalPremiar';


/**
 * Busca al cliente por lo que el operador tecleó. Es tolerante a propósito:
 * durante el remate se escribe rápido y de memoria, y exigir el nombre exacto
 * hacía que la jugada se rechazara por una tilde o una abreviatura.
 * Orden: coincidencia exacta, luego empieza-por, luego contiene — y sólo si
 * queda una sola candidata, para no jugarle plata al cliente equivocado.
 */
function buscarCliente(clientes: Cliente[], escrito: string): Cliente | undefined {
  const q = escrito.trim().toLowerCase();
  if (!q) return undefined;
  const nombres = (c: Cliente) => [c.nombrePizarra ?? '', c.nombre].map((n) => n.toLowerCase());

  const exacta = clientes.find((c) => nombres(c).includes(q));
  if (exacta) return exacta;

  const empieza = clientes.filter((c) => nombres(c).some((n) => n.startsWith(q)));
  if (empieza.length === 1) return empieza[0];

  const contiene = clientes.filter((c) => nombres(c).some((n) => n.includes(q)));
  return contiene.length === 1 ? contiene[0] : undefined;
}


export function Tablero() {
  const carreraId = useNavegacion((s) => s.carreraId);
  const { usuario } = useSesion();
  const qc = useQueryClient();
  const { data: carrera, isPending, error, refetch } = useCarrera(carreraId);

  const colores = useQuery({ queryKey: ['colores'], queryFn: api.colores.listar });
  const clientes = useQuery({ queryKey: ['clientes'], queryFn: api.clientes.listar });

  // Formulario de alta. Vive acá y no en un componente aparte porque el
  // operador lo usa como una sola secuencia de teclado: número → monto →
  // jugador → Enter, sin soltar las manos.
  const [monto, setMonto] = useState('');
  const [moneda, setMoneda] = useState<Moneda>('Bs');
  const [jugador, setJugador] = useState('');
  const [esCasa, setEsCasa] = useState(false);
  const [numero, setNumero] = useState('');
  const [tablaIdx, setTablaIdx] = useState(0);
  const [premiando, setPremiando] = useState(false);
  // El retiro tiene su propio campo: compartirlo con el número de la jugada
  // hacía que escribir en uno cambiara el otro sin que se notara.
  const [numeroRetiro, setNumeroRetiro] = useState('');

  // El foco se mueve a mano por los tres campos. Enter encadena N° → Monto →
  // Jugador y sólo graba en el último; antes Enter en cualquiera disparaba la
  // jugada incompleta y el operador tenía que ir con el mouse.
  //
  // El monto va antes que el jugador porque el rematador canta primero la
  // cifra y después a quién se la adjudica: así el operador teclea en el
  // mismo orden en que escucha, sin retener el número en la cabeza.
  const refNumero = useRef<HTMLInputElement>(null);
  const refJugador = useRef<HTMLInputElement>(null);
  const refMonto = useRef<HTMLInputElement>(null);

  // Alt+1/2/3 cambia de tabla sin soltar el teclado. Alt y no F1-F3 porque
  // F3 ya está anunciado para reimprimir el último ticket, y no sueltos
  // porque el operador está escribiendo números todo el tiempo.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const i = Number(e.key) - 1;
      if (!Number.isInteger(i) || i < 0 || i >= (carrera?.tablas.length ?? 0)) return;
      e.preventDefault();
      setTablaIdx(i);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [carrera?.tablas.length]);

  const porNumero = useMemo(
    () => new Map((colores.data ?? []).map((c: ColorNumero) => [c.numero, c])),
    [colores.data],
  );
  const totales = useMemo(() => totalesDeTabla(carrera), [carrera]);
  const tasa = carrera?.tasaVigente ? Number(carrera.tasaVigente.valorBsPorUsd) : null;

  // Quiénes ya vienen jugando en ESTA carrera. En el remate el mismo postor
  // se reparte entre las tres tablas, así que al cargar en la segunda su
  // apodo tiene que estar a un par de teclas — antes el desplegable sólo
  // sugería clientes registrados y los apodos del día no aparecían nunca.
  const sugerenciasJugador = useMemo(() => {
    const enCarrera = new Set<string>();
    for (const t of carrera?.tablas ?? []) {
      for (const j of t.jugadas) {
        if (j.estado !== 'activa' || j.esCasa) continue;
        const n = j.cliente?.nombrePizarra || j.cliente?.nombre || j.apodo;
        if (n) enCarrera.add(n);
      }
    }
    // Primero los que ya juegan en esta carrera —es lo que el operador va a
    // repetir— y después el padrón de registrados.
    const lista = [...enCarrera]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((valor) => ({ valor, detalle: 'jugando' }));

    for (const c of clientes.data ?? []) {
      const n = c.nombrePizarra || c.nombre;
      if (!enCarrera.has(n)) lista.push({ valor: n, detalle: c.esVip ? 'vip' : 'cliente' });
    }
    return lista;
  }, [carrera, clientes.data]);

  /** Índice rápido de la jugada activa de cada (tabla, ejemplar). */
  const jugadaDe = useMemo(() => {
    const m = new Map<string, { monto: string; cliente: string; esCasa: boolean }>();
    for (const t of carrera?.tablas ?? []) {
      for (const j of t.jugadas) {
        if (j.estado !== 'activa') continue;
        m.set(`${t.id}:${j.ejemplarId}`, {
          monto: j.monto,
          cliente: j.esCasa
            ? 'LA CASA'
            : (j.cliente?.nombrePizarra || j.cliente?.nombre || j.apodo || '—'),
          esCasa: j.esCasa,
        });
      }
    }
    return m;
  }, [carrera]);

  const ganadores = useMemo(
    () => new Set((carrera?.ganadores ?? []).map((g) => g.ejemplarId)),
    [carrera],
  );

  const registrar = useMutation({
    mutationFn: async () => {
      if (!carrera) throw new ErrorApi(0, 'Sin carrera activa.');
      const tabla = carrera.tablas[tablaIdx];
      const ejemplar = carrera.ejemplares.find((e) => e.numero === Number(numero));
      if (!tabla) throw new ErrorApi(400, 'Elegí una tabla.');
      if (!ejemplar) throw new ErrorApi(400, `No hay ejemplar con el número ${numero}.`);
      if (ejemplar.estado === 'retirado') throw new ErrorApi(400, 'Ese ejemplar está retirado.');

      // `parsearMonto` distingue el punto de miles del punto decimal: con el
      // parseo anterior «12.50» entraba como 1250.
      const valor = parsearMonto(monto);
      if (!Number.isFinite(valor) || valor <= 0) throw new ErrorApi(400, 'El monto tiene que ser mayor que cero.');

      // No registrar a nadie no puede frenar la jugada. Si lo tecleado
      // coincide con un cliente cargado se usa ese —así conserva sus
      // condiciones VIP, su crédito y su tasa preferencial—; si no, lo
      // tecleado ES el postor, y viaja como apodo. Un desconocido ya no es
      // un error: es el caso normal del remate.
      let clienteId: number | undefined;
      let apodo: string | undefined;
      let nombre = 'LA CASA';
      if (!esCasa) {
        if (!jugador.trim()) {
          throw new ErrorApi(400, 'Poné quién se lo lleva: un cliente o un apodo.');
        }
        const cli = buscarCliente(clientes.data ?? [], jugador);
        if (cli) {
          clienteId = cli.id;
          nombre = cli.nombrePizarra || cli.nombre;
        } else {
          apodo = jugador.trim();
          // El backend normaliza y devuelve la forma canónica, pero el aviso
          // de éxito se arma acá: se muestra igual que va a verse en la
          // pizarra para que el operador confirme de un vistazo.
          nombre = apodo.toUpperCase();
        }
      }
      await api.jugadas.registrar(tabla.id, ejemplar.id, { clienteId, apodo, esCasa, monto: valor, moneda });
      return { nombre, valor, ejemplar, etiqueta: tabla.etiqueta };
    },
    onSuccess: ({ nombre, valor, ejemplar, etiqueta }) => {
      if (carreraId) qc.invalidateQueries({ queryKey: claveCarrera(carreraId) });
      avisar.exito(
        `${ejemplar.numero} ${ejemplar.nombre} · ${bs(valor)} ${moneda}`,
        `${nombre} · tabla ${etiqueta}`,
      );
      // Formulario en blanco después de cada jugada. `esCasa` también se
      // baja: si quedara marcado, la jugada siguiente se le anotaría a la
      // casa sin que el operador lo pida, y eso es plata mal asignada.
      // La tabla NO se toca — se sigue cargando en la misma hasta que el
      // operador decida cambiarla con alt+1/2/3.
      setMonto('');
      setNumero('');
      setJugador('');
      setEsCasa(false);
      // Y el foco vuelve al principio de la secuencia, listo para el
      // siguiente caballo sin tocar el mouse.
      refNumero.current?.focus();
    },
    onError: (e) => avisar.error(
      'No se registró la jugada',
      e instanceof Error ? e.message : 'Error inesperado.',
    ),
  });

  const retirar = useMutation({
    mutationFn: async (numeroEj: number) => {
      const ej = carrera?.ejemplares.find((e) => e.numero === numeroEj);
      if (!ej) throw new ErrorApi(400, `No hay ejemplar con el número ${numeroEj}.`);
      if (ej.estado === 'retirado') throw new ErrorApi(400, `${ej.nombre} ya estaba retirado.`);
      await api.ejemplares.retirar(ej.id);
      return ej;
    },
    onSuccess: (ej) => {
      if (carreraId) qc.invalidateQueries({ queryKey: claveCarrera(carreraId) });
      // Retirar un caballo genera el reembolso de lo que ya se había
      // cobrado, y reponerlo lo borra: en los dos casos cambia la lista de
      // cobros. Sin esto el bloque «A devolver» no aparecía hasta cambiar
      // de pestaña, que es cuando la consulta se volvía a montar.
      qc.invalidateQueries({ queryKey: ['cobros', carreraId] });
      avisar.info(`Retirado ${ej.numero} ${ej.nombre}`, 'Sus jugadas quedaron anuladas.');
      setNumeroRetiro('');
    },
    onError: (e) => avisar.error(
      'No se pudo retirar',
      e instanceof Error ? e.message : 'Error inesperado.',
    ),
  });

  // El pote lo decide la casa por tabla y entra en el bolsillo que se
  // reparte: `(tabla + pote) × 0,7`. El endpoint existía desde el principio
  // y ninguna pantalla lo llamaba, así que no había forma de cargarlo.
  const guardarPote = useMutation({
    mutationFn: ({ tablaId, valor }: { tablaId: number; valor: number }) =>
      api.tablas.actualizarPote(tablaId, valor),
    onSuccess: (_r, { valor }) => {
      if (carreraId) qc.invalidateQueries({ queryKey: claveCarrera(carreraId) });
      avisar.exito(`Pote en ${bs(valor)} Bs`, 'Entra en lo que cobra el ganador');
    },
    onError: (e) => avisar.error(
      'No se guardó el pote',
      e instanceof Error ? e.message : 'Error inesperado.',
    ),
  });

  if (carreraId == null) {
    return (
      <Vacio
        titulo="No hay carrera en remate"
        detalle="Elegí la carrera del día desde Configuración › Carreras del día para empezar a rematar."
      />
    );
  }
  if (isPending) return <Cargando que="la carrera" />;
  if (error) return <Problema error={error} reintentar={refetch} />;
  if (!carrera) return null;

  const ejemplarPorNumero = (n: number) => carrera.ejemplares.find((e) => e.numero === n);
  const ejemplarElegido = numero ? ejemplarPorNumero(Number(numero)) : undefined;

  return (
    <div className="flex min-h-0 flex-1 gap-3.5 p-3.5">
      {/* ── Izquierda: alta de jugada, retiro y ganador ──
          Scrollea por su cuenta: la ventana puede ser más baja que el diseño
          (una laptop de 768 px, por ejemplo) y el botón de crear jugada no
          puede quedar nunca fuera del borde. */}
      <div className="barra-scroll flex w-[262px] flex-none flex-col gap-3 overflow-y-auto pr-0.5 xl:w-[296px]">
        <Panel titulo="Nueva jugada" className="flex-none" cuerpoClassName="p-3 flex flex-col gap-3">
          {/* El orden es el del remate cantado: primero se sabe QUÉ caballo
              está en juego, después quién se lo lleva y recién al final en
              cuánto cerró. Enter avanza de campo y sólo graba en el último,
              así la carga entera es una tirada de teclado sin soltar. */}
          <div className="flex gap-3">
            <Campo className="w-[84px]">
              <Etiqueta>N°</Etiqueta>
              <Entrada
                grande
                autoFocus
                ref={refNumero}
                inputMode="numeric"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  refMonto.current?.focus();
                }}
                className="text-center"
                style={
                  ejemplarElegido && porNumero.get(ejemplarElegido.numero)
                    ? {
                        background: porNumero.get(ejemplarElegido.numero)!.colorHex,
                        color: porNumero.get(ejemplarElegido.numero)!.textoHex,
                      }
                    : undefined
                }
              />
            </Campo>
            <Campo className="flex-1">
              <div className="flex items-baseline justify-between">
                <Etiqueta>Tablas</Etiqueta>
                <span className="text-[10.5px] text-gris">alt+1·2·3</span>
              </div>
              <Segmentado
                alto="h-[52px]"
                valor={tablaIdx}
                onCambio={setTablaIdx}
                opciones={carrera.tablas.map((t, i) => ({ valor: i, etiqueta: t.etiqueta }))}
              />
            </Campo>
          </div>

          {/* El nombre confirma que el número tecleado es el caballo que el
              rematador cantó, antes de escribir el resto. */}
          <p className="-mt-1 truncate font-display text-sm">
            {ejemplarElegido
              ? ejemplarElegido.nombre
              : <span className="font-sans text-[13px] text-gris">Escribí el número del caballo</span>}
          </p>

          <Campo>
            <div className="flex items-baseline justify-between">
              <Etiqueta>Monto</Etiqueta>
              <Segmentado
                valor={moneda}
                onCambio={setMoneda}
                opciones={[{ valor: 'Bs' as Moneda, etiqueta: 'Bs' }, { valor: 'USD' as Moneda, etiqueta: '$' }]}
                className="!border-0 text-xs"
              />
            </div>
            {/* El separador de miles se pone en el propio campo mientras se
                teclea: es donde el operador está mirando cuando canta el
                monto en voz alta. El cursor se reubica a mano porque cada
                punto insertado lo correría solo. */}
            <Entrada
              grande
              ref={refMonto}
              inputMode="decimal"
              value={monto}
              placeholder="0,00"
              onChange={(e) => {
                const campo = e.target;
                const r = formatearMientrasEscribe(campo.value, campo.selectionStart ?? campo.value.length);
                setMonto(r.texto);
                // Después del re-render de React, no antes: si se hiciera
                // acá el valor todavía sería el viejo.
                requestAnimationFrame(() => campo.setSelectionRange(r.cursor, r.cursor));
              }}
              onKeyDown={(e) => {
                // El punto es separador de miles y lo pone el formateador
                // solo; el decimal es la coma. Pero en el teclado numérico
                // la tecla que cae a mano es el punto, así que se traduce
                // acá en vez de dejar al operador sin forma de escribir
                // céntimos.
                if (e.key === '.') {
                  e.preventDefault();
                  const campo = e.target as HTMLInputElement;
                  const i = campo.selectionStart ?? campo.value.length;
                  const conComa = campo.value.slice(0, i) + ',' + campo.value.slice(campo.selectionEnd ?? i);
                  const r = formatearMientrasEscribe(conComa, i + 1);
                  setMonto(r.texto);
                  requestAnimationFrame(() => campo.setSelectionRange(r.cursor, r.cursor));
                  return;
                }
                if (e.key !== 'Enter') return;
                // Con LA CASA marcada el campo Jugador está deshabilitado y no
                // acepta foco: no hay a dónde seguir y la jugada se graba acá.
                if (esCasa) registrar.mutate();
                else refJugador.current?.focus();
              }}
            />
            {tasa && moneda === 'Bs' && monto && Number.isFinite(parsearMonto(monto)) && (
              <span className="plata text-[13px] text-gris">
                ≈ {usd(parsearMonto(monto) || 0, tasa)}
              </span>
            )}
          </Campo>

          <Campo>
            <Etiqueta>Jugador</Etiqueta>
            <div className="flex gap-1.5">
              <Autocompletar
                ref={refJugador}
                className="flex-1"
                valor={esCasa ? 'LA CASA' : jugador}
                disabled={esCasa}
                placeholder="Nombre o apodo"
                sugerencias={sugerenciasJugador}
                // En mayúsculas desde la primera tecla: es como se va a ver
                // en el tablero y en el TV.
                onCambio={(v) => setJugador(v.toUpperCase())}
                // Último campo de la cadena: Enter sin sugerencia marcada ya
                // no pasa a otro campo, graba la jugada.
                onConfirmar={() => registrar.mutate()}
              />
              <button
                type="button"
                onClick={() => setEsCasa((v) => !v)}
                title="El caballo se lo queda la casa"
                className={`rounded border px-2 text-[10.5px] font-bold uppercase tracking-wider
                  ${esCasa ? 'border-magenta bg-magenta text-white' : 'border-magenta text-magenta'}`}
              >
                Casa
              </button>
            </div>
          </Campo>

          <Boton
            tono="principal"
            ancho
            atajo="⏎"
            className="py-2.5 text-base"
            disabled={registrar.isPending}
            onClick={() => registrar.mutate()}
          >
            {registrar.isPending ? 'Registrando…' : 'Crear jugada'}
          </Boton>
        </Panel>

        <Panel titulo="Retiro de caballo" className="flex-none" cuerpoClassName="p-3 flex gap-2">
          <Entrada
            className="flex-1 text-sm"
            inputMode="numeric"
            placeholder="N° del ejemplar"
            value={numeroRetiro}
            onChange={(e) => setNumeroRetiro(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && numeroRetiro && retirar.mutate(Number(numeroRetiro))}
          />
          <Boton
            tono="destructivo"
            disabled={!numeroRetiro || retirar.isPending}
            onClick={() => retirar.mutate(Number(numeroRetiro))}
          >
            Retirar
          </Boton>
        </Panel>

        <Panel
          titulo="Ganador"
          className="flex-none border-2 border-verde"
          cuerpoClassName="p-3 flex flex-col gap-2.5"
        >
          {ganadores.size === 0 ? (
            <p className="text-[13px] leading-snug text-gris">
              Todavía sin resultado. Se marca al confirmar la premiación.
            </p>
          ) : (
            [...ganadores].map((id) => {
              const e = carrera.ejemplares.find((x) => x.id === id);
              const c = e && porNumero.get(e.numero);
              return e ? (
                <div key={id} className="flex items-center gap-3">
                  <Gualdrapa
                    numero={e.numero}
                    color={c?.colorHex ?? '#F58220'}
                    texto={c?.textoHex ?? '#111'}
                    tam={38}
                  />
                  <span className="flex-1 truncate font-display text-lg">{e.nombre}</span>
                </div>
              ) : null;
            })
          )}
          <Boton
            tono="confirmar"
            ancho
            className="py-2.5 text-base"
            // Se premia DESPUÉS de cerrar, no antes: mientras haya una tabla
            // abierta todavía puede entrar una puja que cambie el reparto.
            // La condición estaba al revés y se desactivaba justo cuando
            // hacía falta.
            disabled={carrera.tablas.some((t) => t.estado === 'abierta')}
            title={carrera.tablas.some((t) => t.estado === 'abierta')
              ? 'Cerrá la carrera antes de premiar'
              : undefined}
            onClick={() => setPremiando(true)}
          >
            Premiar ganador…
          </Boton>
        </Panel>
      </div>

      {/* ── Centro: el tablero ── */}
      <Panel className="min-w-0 flex-1" cuerpoClassName="p-0 flex-1 min-h-0 overflow-hidden">
        <TablaRemate
          carrera={carrera}
          totales={totales}
          jugadaDe={jugadaDe}
          ganadores={ganadores}
          porNumero={porNumero}
          tablaIdx={tablaIdx}
          onPote={(tablaId, valor) => guardarPote.mutate({ tablaId, valor })}
          onElegir={(n, idx) => {
            setNumero(String(n));
            // Tocar una celda de T2 elige el caballo Y la tabla: es el gesto
            // completo, y deja el formulario pidiendo sólo jugador y monto.
            if (idx != null) setTablaIdx(idx);
            refJugador.current?.focus();
          }}
        />
      </Panel>

      {/* ── Derecha: cobros ── */}
      <PanelCobros carreraId={carrera.id} tasa={tasa} />

      {premiando && (
        <ModalPremiar
          carrera={carrera}
          totales={totales}
          porNumero={porNumero}
          onCerrar={() => setPremiando(false)}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── La tabla ─────────────────────────────
   Va como <table> real y no como grid de divs: son nueve columnas que tienen
   que alinear entre encabezado, filas y totales, y la tabla lo hace sola. */

function TablaRemate({
  carrera, totales, jugadaDe, ganadores, porNumero, onElegir, tablaIdx, onPote,
}: {
  carrera: NonNullable<ReturnType<typeof useCarrera>['data']>;
  totales: ReturnType<typeof totalesDeTabla>;
  jugadaDe: Map<string, { monto: string; cliente: string; esCasa: boolean }>;
  ganadores: Set<number>;
  porNumero: Map<number, ColorNumero>;
  /** El índice de tabla llega sólo cuando se tocó una celda de esa tabla. */
  onElegir: (numero: number, tablaIdx?: number) => void;
  /** Para teñir la columna sobre la que se está cargando. */
  tablaIdx: number;
  onPote: (tablaId: number, valor: number) => void;
}) {
  return (
    <div className="barra-scroll h-full overflow-auto">
      <table className="w-full table-fixed text-[13.5px]" style={{ height: '100%' }}>
        <colgroup>
          {/* Anchos fijos salvo el nombre del ejemplar, que se queda con lo que
              sobre: es el dato que el operador busca de un vistazo y el que no
              puede aparecer cortado. */}
          <col style={{ width: 34 }} />
          <col />
          {carrera.tablas.map((t) => (
            <Fragment key={t.id}>
              <col style={{ width: 70 }} />
              <col style={{ width: 76 }} />
            </Fragment>
          ))}
          <col style={{ width: 36 }} />
        </colgroup>

        <thead className="sticky top-0 z-10">
          <tr className="bg-carbon text-gris-claro">
            <th className="px-1 py-1.5 text-center text-[10.5px] uppercase tracking-[0.1em]">N°</th>
            <th className="px-2 py-1.5 text-left text-[10.5px] uppercase tracking-[0.1em]">Ejemplar</th>
            {carrera.tablas.map((t) => (
              <Fragment key={t.id}>
                <th className="border-l-2 border-humo px-2 py-1.5 text-right
                  text-[10.5px] uppercase tracking-[0.1em]">{t.etiqueta}</th>
                <th className="px-2 py-1.5 text-left text-[10.5px]
                  uppercase tracking-[0.1em]">Cliente</th>
              </Fragment>
            ))}
            <th className="border-l-2 border-humo px-1 py-1.5 text-center text-[10.5px]
              uppercase tracking-[0.1em]">Gana</th>
          </tr>
        </thead>

        <tbody>
          {carrera.ejemplares.map((e: Ejemplar) => {
            const color = porNumero.get(e.numero);
            const retirado = e.estado === 'retirado';
            const gana = ganadores.has(e.id);
            return (
              <tr
                key={e.id}
                className={`h-7 cursor-pointer border-b border-borde
                  ${gana ? 'bg-amarillo/20 outline outline-2 -outline-offset-2 outline-amarillo' : ''}
                  ${retirado ? 'bg-rojo/5' : 'hover:bg-amarillo/10'}`}
              >
                <td
                  onClick={() => !retirado && onElegir(e.numero)}
                  className="p-0 text-center font-display text-[13px]"
                  style={{
                    background: retirado ? '#CFC8BA' : (color?.colorHex ?? '#F58220'),
                    color: retirado ? '#7a7770' : (color?.textoHex ?? '#111'),
                    boxShadow: color?.colorHex.toUpperCase() === '#FFFFFF'
                      ? 'inset 0 0 0 1px rgba(0,0,0,.22)' : undefined,
                  }}
                >
                  {e.numero}
                </td>
                <td
                  onClick={() => !retirado && onElegir(e.numero)}
                  className={`truncate px-2 font-display text-[13.5px]
                  ${retirado ? 'text-gris line-through' : ''}`}>
                  {e.nombre}
                </td>

                {retirado ? (
                  <td colSpan={carrera.tablas.length * 2 + 1}
                    className="border-l-2 border-borde px-2 text-[11.5px] font-semibold text-rojo">
                    Retirado · sus jugadas quedaron anuladas
                  </td>
                ) : (
                  <>
                    {carrera.tablas.map((t, idx) => {
                      const j = jugadaDe.get(`${t.id}:${e.id}`);
                      // Tocar cualquiera de las dos celdas de esta tabla es
                      // decir «este caballo, en esta tabla»: el formulario
                      // queda pidiendo sólo jugador y monto.
                      const elegirCelda = () => onElegir(e.numero, idx);
                      const resaltada = idx === tablaIdx;
                      return (
                        <Fragment key={t.id}>
                          <td
                            onClick={elegirCelda}
                            title={`${e.numero} ${e.nombre} · tabla ${t.etiqueta}`}
                            className={`plata border-l-2 border-borde px-2 text-right
                              hover:bg-amarillo/25
                              ${resaltada ? 'bg-amarillo/[0.07]' : ''}
                              ${j?.esCasa ? 'font-semibold text-magenta' : ''}
                              ${gana ? 'font-bold' : ''}
                              ${!j ? 'text-borde-fuerte' : ''}`}>
                            {j ? bs(j.monto) : '—'}
                          </td>
                          <td
                            onClick={elegirCelda}
                            title={`${e.numero} ${e.nombre} · tabla ${t.etiqueta}`}
                            className={`truncate px-2 text-[11.5px] hover:bg-amarillo/25
                              ${resaltada ? 'bg-amarillo/[0.07]' : ''}
                              ${j?.esCasa ? 'font-semibold text-magenta' : 'text-humo'}
                              ${gana ? 'font-semibold text-tinta' : ''}
                              ${!j ? 'text-borde-fuerte' : ''}`}>
                            {j?.cliente ?? 'sin puja'}
                          </td>
                        </Fragment>
                      );
                    })}
                    <td className={`border-l-2 border-borde text-center text-[15px]
                      ${gana ? 'text-verde' : 'text-borde-fuerte'}`}>
                      {gana ? '◉' : '○'}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
          {/* Fila elástica: empuja los totales al pie sin estirar las de datos. */}
          <tr style={{ height: '100%' }}>
            <td colSpan={carrera.tablas.length * 2 + 3} />
          </tr>
        </tbody>

        <tfoot>
          <tr className="bg-hueso">
            <th colSpan={2} className="border-t-2 border-carbon px-2 py-1.5 text-left
              text-[11px] uppercase tracking-[0.08em] text-humo">
              Pote de la casa
            </th>
            {totales.map((t) => (
              <td key={t.tabla.id} colSpan={2}
                className="border-l-2 border-borde-fuerte border-t-2 border-t-carbon
                  px-1 py-1">
                <CeldaPote
                  valor={t.pote}
                  onGuardar={(v) => onPote(t.tabla.id, v)}
                />
              </td>
            ))}
            <td className="border-t-2 border-carbon" />
          </tr>
          <tr className="bg-carbon text-hueso">
            <th colSpan={2} className="px-2 py-2 text-left text-[11px] uppercase
              tracking-[0.08em] text-gris-claro">
              Cobra el ganador
            </th>
            {totales.map((t) => (
              <td key={t.tabla.id} colSpan={2}
                className="border-l-2 border-humo px-2.5 py-1.5 text-right leading-tight">
                <div className="plata text-[17px] font-bold text-amarillo">{bs(t.alGanador)}</div>
                <div className="plata text-[10.5px] text-gris">
                  de {bs(t.bolsillo)} · casa {bs(t.retieneCasa)}
                </div>
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export { Pildora };

/**
 * Celda editable del pote de una tabla.
 *
 * Se escribe con el mismo formateo que el monto de la jugada, y se guarda al
 * salir del campo o con Enter — no en cada tecla, que dispararía un PATCH
 * por dígito. Mientras no se está editando muestra el valor guardado, para
 * que el pie del tablero se siga leyendo como una fila de totales.
 */
function CeldaPote({ valor, onGuardar }: { valor: number; onGuardar: (v: number) => void }) {
  const [texto, setTexto] = useState<string | null>(null);
  const editando = texto !== null;

  function confirmar() {
    if (texto === null) return;
    const v = texto.trim() === '' ? 0 : parsearMonto(texto);
    setTexto(null);
    // Sin cambio real no se manda nada: evita un PATCH y un aviso por cada
    // vez que el operador entra y sale del campo sin tocar nada.
    if (Number.isFinite(v) && v >= 0 && v !== valor) onGuardar(v);
  }

  return (
    <input
      inputMode="decimal"
      value={editando ? texto : (valor ? bs(valor) : '')}
      placeholder="0"
      title="Pote que pone la casa en esta tabla"
      onFocus={() => setTexto(valor ? bs(valor) : '')}
      onChange={(e) => {
        const campo = e.target;
        const r = formatearMientrasEscribe(campo.value, campo.selectionStart ?? campo.value.length);
        setTexto(r.texto);
        requestAnimationFrame(() => campo.setSelectionRange(r.cursor, r.cursor));
      }}
      onBlur={confirmar}
      onKeyDown={(e) => {
        // Mismo remapeo que en el monto de la jugada: la tecla del punto
        // escribe la coma decimal.
        if (e.key === '.') {
          e.preventDefault();
          const campo = e.target as HTMLInputElement;
          const i = campo.selectionStart ?? campo.value.length;
          const conComa = campo.value.slice(0, i) + ',' + campo.value.slice(campo.selectionEnd ?? i);
          const r = formatearMientrasEscribe(conComa, i + 1);
          setTexto(r.texto);
          requestAnimationFrame(() => campo.setSelectionRange(r.cursor, r.cursor));
          return;
        }
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setTexto(null);
      }}
      className={`plata w-full rounded border px-1.5 py-0.5 text-right font-bold
        text-naranja focus:outline-none focus:ring-[3px] focus:ring-amarillo/40
        ${editando ? 'border-carbon bg-white' : 'border-transparent bg-transparent hover:border-borde-fuerte'}`}
    />
  );
}
