import { useMemo, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { socket, EVENTOS } from '../../lib/socket';
import { bs, fechaLarga } from '../../lib/formato';
import { totalesDeTabla, useCarrera } from '../../hooks/useCarrera';
import type { ColorNumero, Jugada } from '../../lib/tipos';
import logo from '../../assets/logo-lujalo.png';

/**
 * Pizarra pública — 1920×1080 en el TV del salón.
 *
 * Regla que manda sobre todo lo demás: acá SÓLO van montos. Nunca cuánto
 * termina cobrando el ganador ni el porcentaje que retiene la casa; eso se
 * maneja internamente y sólo existe en la pantalla del operador.
 *
 * La carrera en pantalla no se elige acá: se toma la que esté 'abierta'. La
 * TV no tiene teclado.
 */
export function PizarraApp() {
  const qc = useQueryClient();

  // Lo que va en el TV lo decide el operador desde la taquilla. Antes esta
  // ventana elegía sola la primera carrera `abierta` y releía la lista cada
  // 20 segundos: cambiar de carrera en la taquilla no movía el TV hasta el
  // refresco siguiente, o nunca si la anterior seguía abierta.
  const enPizarra = useQuery({ queryKey: ['pizarra-carrera'], queryFn: api.pizarra.actual });

  // La pizarra no tiene cómo cerrarse: va sin bordes —no hay una X— y fuera
  // de la barra de tareas, así que en el TV no hay dónde hacer clic ni cómo
  // alternarla. Escape la cierra; el botón «Pizarra ↗» de la taquilla la
  // vuelve a abrir cuando haga falta.
  useEffect(() => {
    const alTecla = async (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      } catch {
        // En el navegador no hay ventana nativa que cerrar; se ignora para
        // que `npm run dev` siga sirviendo para mirar el diseño.
      }
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, []);

  // El anuncio llega a todos los clientes, no a la room de una carrera:
  // justamente dice de qué carrera hay que empezar a hablar.
  useEffect(() => {
    const alCambiar = () => qc.invalidateQueries({ queryKey: ['pizarra-carrera'] });
    socket.on(EVENTOS.pizarraCarreraCambiada, alCambiar);
    socket.on('connect', alCambiar);
    return () => {
      socket.off(EVENTOS.pizarraCarreraCambiada, alCambiar);
      socket.off('connect', alCambiar);
    };
  }, [qc]);

  // Hasta que el operador elija por primera vez, se cae al comportamiento
  // viejo para que el TV nunca quede en blanco.
  const carreras = useQuery({
    queryKey: ['carreras'],
    queryFn: api.carreras.listar,
    refetchInterval: 20_000,
  });
  const elegida = enPizarra.data?.carreraId
    ? carreras.data?.find((c) => c.id === enPizarra.data!.carreraId)
    : undefined;
  const enRemate =
    elegida ?? carreras.data?.find((c) => c.estado === 'abierta') ?? carreras.data?.[0];

  const { data: carrera } = useCarrera(enRemate?.id ?? null);
  const colores = useQuery({ queryKey: ['colores'], queryFn: api.colores.listar });

  const porNumero = useMemo(
    () => new Map((colores.data ?? []).map((c: ColorNumero) => [c.numero, c])),
    [colores.data],
  );
  const totales = useMemo(() => totalesDeTabla(carrera), [carrera]);

  const jugadaDe = useMemo(() => {
    const m = new Map<string, Jugada>();
    for (const t of carrera?.tablas ?? []) {
      for (const j of t.jugadas) if (j.estado === 'activa') m.set(`${t.id}:${j.ejemplarId}`, j);
    }
    return m;
  }, [carrera]);

  const ganadores = useMemo(
    () => new Set((carrera?.ganadores ?? []).map((g) => g.ejemplarId)),
    [carrera],
  );

  if (!carrera) {
    return (
      <div className="grid h-full place-items-center bg-negro font-display text-4xl text-amarillo">
        LUJALO SPORTSBOOK
        <PistaCerrar />
      </div>
    );
  }

  const tasa = carrera.tasaVigente ? Number(carrera.tasaVigente.valorBsPorUsd) : null;
  const totalCarreras = 6;
  const marco = 'border-2 border-pizarra-marco';

  return (
    <>
    <PistaCerrar />
    <Escalada>
    <div className="flex h-full w-full flex-col gap-3.5 bg-pizarra-campo p-4 font-ui">
      {/* ── Cabecera ── */}
      <header className="grid h-[118px] flex-none grid-cols-[auto_1fr_auto] items-stretch gap-4">
        <div className={`flex items-center justify-center bg-carbon px-5 ${marco}`}>
          <img src={logo} alt="Centro Hípico Sportsbook Lujalo" className="h-24 w-auto" />
        </div>

        <div className={`flex flex-col justify-center gap-1 bg-pizarra-amarillo px-6 ${marco}`}>
          <span className="font-display text-[42px] leading-none tracking-[0.01em] text-[#2a2a2a]">
            {carrera.hipodromo?.nombre ?? ''}
          </span>
          <span className="font-cond text-[22px] tracking-[0.1em] text-pizarra-oliva">
            {fechaLarga(carrera.fecha)} · JORNADA DE {totalCarreras} CARRERAS
          </span>
          <div className="mt-0.5 flex items-center gap-2">
            {Array.from({ length: totalCarreras }, (_, i) => {
              const n = i + 1;
              return (
                <span
                  key={n}
                  className="h-2 rounded-full"
                  style={{
                    width: n === carrera.numero ? 26 : 16,
                    background: n === carrera.numero
                      ? '#8f2f7c'
                      : n < carrera.numero ? '#7a5b0a' : 'rgba(122,91,10,.28)',
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-[130px_190px_170px] gap-2.5">
          <Caja fondo="#fff" titulo="CARRERA" tituloColor="#8f2f7c">
            <span className="font-display text-[44px] leading-[0.95] text-[#2a2a2a]">
              {carrera.numero}
            </span>
          </Caja>
          <Caja fondo="#8f2f7c" borde="#6b1f5c" titulo="ESTADO" tituloColor="#f0c8e6">
            <span className="font-display text-[30px] leading-tight text-pizarra-amarillo">
              {carrera.estado.toUpperCase()}
            </span>
          </Caja>
          <Caja fondo="#1C1C22" titulo="DÓLAR HOY" tituloColor="#b9b3a8">
            <span className="plata text-[28px] font-bold text-pizarra-amarillo">
              {tasa ? bs(tasa) : '—'}
            </span>
          </Caja>
        </div>
      </header>

      {/* ── Cuerpo ── */}
      <div
        className="grid min-h-0 flex-1 gap-x-3"
        style={{
          gridTemplateColumns: `1.15fr repeat(${carrera.tablas.length}, 1fr)`,
          gridTemplateRows: '38px 34px 1fr 62px',
        }}
      >
        <div className={`col-start-1 row-start-1 flex items-center justify-center
          bg-pizarra-amarillo font-display text-xl tracking-[0.06em] text-[#2a2a2a] ${marco}`}>
          EJEMPLAR
        </div>
        <div className={`col-start-1 row-start-2 border-t-0 bg-pizarra-amarillo ${marco}`} />
        <div
          className={`col-start-1 row-start-3 min-h-0 border-t-0 bg-white ${marco}`}
          style={{ display: 'grid', gridTemplateRows: `repeat(${carrera.ejemplares.length}, 1fr)` }}
        >
          {carrera.ejemplares.map((e) => {
            const c = porNumero.get(e.numero);
            const retirado = e.estado === 'retirado';
            const gana = ganadores.has(e.id);
            return (
              <div
                key={e.id}
                className="grid min-h-0 items-stretch border-b border-[#9a9a9a]"
                style={{
                  gridTemplateColumns: '56px 1fr',
                  background: retirado ? '#f2e2ee' : gana ? '#fff6c9' : '#fff',
                }}
              >
                <div
                  className="flex items-center justify-center border-r border-[#9a9a9a] font-display text-[25px]"
                  style={{
                    background: retirado ? '#cfc9b4' : (c?.colorHex ?? '#F58220'),
                    color: retirado ? '#7a7770' : (c?.textoHex ?? '#111'),
                    boxShadow: c?.colorHex.toUpperCase() === '#FFFFFF'
                      ? 'inset 0 0 0 1px rgba(0,0,0,.22)' : undefined,
                  }}
                >
                  {e.numero}
                </div>
                <div
                  className="flex items-center overflow-hidden text-ellipsis whitespace-nowrap px-3 text-[26px]"
                  style={{
                    fontWeight: gana ? 700 : 400,
                    color: retirado ? '#6b665e' : '#1a1a1a',
                    textDecoration: retirado ? 'line-through' : undefined,
                    textDecorationColor: '#8f2f7c',
                    textDecorationThickness: 3,
                  }}
                >
                  {e.nombre}
                </div>
              </div>
            );
          })}
        </div>

        {carrera.tablas.map((t, i) => {
          const col = i + 2;
          const tot = totales[i];
          return (
            <div key={t.id} className="contents">
              <div
                className={`row-start-1 flex items-center justify-center bg-pizarra-amarillo
                  font-display text-[19px] tracking-[0.06em] text-[#2a2a2a] ${marco}`}
                style={{ gridColumnStart: col }}
              >
                TABLA {t.etiqueta.replace(/\D/g, '') || t.etiqueta}
              </div>
              <div
                className={`row-start-2 grid grid-cols-[1fr_1.15fr] items-center border-t-0
                  bg-pizarra-durazno text-center font-cond text-lg font-bold
                  tracking-[0.08em] text-[#2a2a2a] ${marco}`}
                style={{ gridColumnStart: col }}
              >
                <div>MONTO</div><div>CLIENTE</div>
              </div>
              <div
                className={`row-start-3 min-h-0 border-t-0 bg-pizarra-crema ${marco}`}
                style={{
                  gridColumnStart: col,
                  display: 'grid',
                  gridTemplateRows: `repeat(${carrera.ejemplares.length}, 1fr)`,
                }}
              >
                {carrera.ejemplares.map((e) => {
                  const j = jugadaDe.get(`${t.id}:${e.id}`);
                  const retirado = e.estado === 'retirado';
                  const gana = ganadores.has(e.id);
                  const casa = j?.esCasa;
                  return (
                    <div
                      key={e.id}
                      className="grid min-h-0 grid-cols-[1fr_1.15fr] items-center border-b
                        border-[#cfc9b4] text-center"
                      style={{ background: retirado ? '#f2e2ee' : gana ? '#fff6c9' : undefined }}
                    >
                      <div
                        className="plata border-r border-[#cfc9b4] text-[25px]"
                        style={{
                          fontWeight: gana ? 700 : 400,
                          color: retirado ? '#8a857c' : casa ? '#8f2f7c' : '#1a1a1a',
                          textDecoration: retirado ? 'line-through' : undefined,
                        }}
                      >
                        {retirado ? '—' : j ? bs(j.monto) : '—'}
                      </div>
                      <div
                        className="overflow-hidden text-ellipsis whitespace-nowrap px-2 text-[22px]"
                        style={{
                          fontWeight: gana ? 700 : 400,
                          color: retirado ? '#8a857c' : casa ? '#8f2f7c' : j ? '#1a1a1a' : '#b9b3a8',
                        }}
                      >
                        {retirado ? '—'
                          : j ? (j.esCasa ? 'LA CASA' : (j.cliente?.nombrePizarra || j.cliente?.nombre || j.apodo))
                          : 'sin puja'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                className="row-start-4 grid grid-cols-[1fr_1fr_1.15fr] gap-1.5 pt-2"
                style={{ gridColumnStart: col }}
              >
                <Caja fondo="#fbe96b" titulo="TABLA" chico>
                  <span className="plata text-[22px] font-bold text-[#2a2a2a]">{bs(tot?.totalJugado ?? 0)}</span>
                </Caja>
                <Caja fondo="#fff" titulo="POTE CASA" chico>
                  <span className="plata text-[22px] font-bold text-[#2a2a2a]">{bs(tot?.pote ?? 0)}</span>
                </Caja>
                {/* A REPARTIR = tabla + pote. Lo que finalmente cobra el
                    ganador tras el 30% NO se muestra en el TV. */}
                <Caja fondo="#1C1C22" titulo="A REPARTIR" chico>
                  <span className="plata text-2xl font-bold text-pizarra-amarillo">
                    {bs(tot?.bolsillo ?? 0)}
                  </span>
                </Caja>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Pie ── */}
      <footer className="grid h-28 flex-none grid-cols-[1fr_430px_540px] gap-3">
        <div
          className={`flex items-center justify-center font-cond text-lg tracking-[0.1em]
            text-pizarra-marco ${marco}`}
          style={{
            background: 'repeating-linear-gradient(45deg,#1c1c22,#1c1c22 10px,#16161b 10px,#16161b 20px)',
          }}
        >
          [ ESPACIO PATROCINANTE ]
        </div>

        <div className={`flex flex-col bg-pizarra-amarillo ${marco}`}>
          <div className="flex min-h-0 flex-1 items-center justify-between border-b-2
            border-pizarra-marco px-4">
            <span className="font-cond text-xl leading-tight tracking-[0.1em] text-[#2a2a2a]">
              TOTAL<br />A COBRAR
            </span>
            <span className="plata text-[42px] font-bold text-[#2a2a2a]">
              {bs(totales.reduce((s, t) => s + t.totalJugado, 0))}
            </span>
          </div>
          <div className="flex flex-none items-baseline justify-between bg-carbon px-4 py-1
            text-pizarra-amarillo">
            <span className="font-cond text-[15px] tracking-[0.1em]">POTE DE LA CASA</span>
            <span className="plata text-[21px] font-bold">
              {bs(totales.reduce((s, t) => s + t.pote, 0))}
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-4 bg-white px-5 ${marco}`}>
          {ganadores.size === 0 ? (
            <span className="font-cond text-[22px] tracking-[0.14em] text-pizarra-marco">
              CARRERA EN REMATE
            </span>
          ) : (
            <>
              <span className="font-cond text-[22px] tracking-[0.14em] text-pizarra-marco">
                ¡GANADOR!
              </span>
              {[...ganadores].map((id) => {
                const e = carrera.ejemplares.find((x) => x.id === id);
                const c = e && porNumero.get(e.numero);
                return e ? (
                  <span key={id} className="flex items-center gap-3">
                    <span
                      className={`grid h-[60px] w-[60px] place-items-center font-display
                        text-[32px] ${marco}`}
                      style={{ background: c?.colorHex ?? '#F58220', color: c?.textoHex ?? '#111' }}
                    >
                      {e.numero}
                    </span>
                    <span className="font-display text-[34px] tracking-[0.02em] text-[#2a2a2a]">
                      {e.nombre}
                    </span>
                  </span>
                ) : null;
              })}
            </>
          )}
        </div>
      </footer>
    </div>
    </Escalada>
    </>
  );
}

function Caja({
  fondo, borde = '#8f2f7c', titulo, tituloColor = '#8f2f7c', chico, children,
}: {
  fondo: string; borde?: string; titulo: string; tituloColor?: string;
  chico?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ background: fondo, border: `2px solid ${borde}` }}
    >
      <span
        className={`font-cond tracking-[0.12em] ${chico ? 'text-sm tracking-[0.08em]' : 'text-base'}`}
        style={{ color: chico ? '#2a2a2a' : tituloColor }}
      >
        {titulo}
      </span>
      {children}
    </div>
  );
}

/** Medidas del diseño aprobado. Todo adentro está en píxeles contra esto. */
const ANCHO_DISENO = 1920;
const ALTO_DISENO = 1080;

/**
 * Encaja la pizarra en la pantalla que le toque, sin rediseñarla.
 *
 * El tablero está dibujado en píxeles fijos contra 1920×1080 —cabecera de
 * 118 px, tipografías de 42 px, pie de 112 px— porque las proporciones son
 * lo que lo hace legible desde el fondo del salón. En un monitor más chico
 * esos píxeles no entran y el contenido se desborda o se apila.
 *
 * En vez de volver relativa cada medida, se renderiza el diseño a su tamaño
 * nativo y se escala el conjunto con un solo `transform`. El resultado es
 * idéntico al aprobado, sólo que más chico o más grande: nada se reacomoda
 * ni cambia de proporción, que es justo lo que rompería la lectura a
 * distancia.
 *
 * Se usa `min` de los dos factores para que entre completo y no se recorte
 * ningún borde, y sobra franja arriba/abajo o a los lados si la pantalla no
 * es 16:9. Esa franja va del color del campo para que no se vea un marco.
 */
/**
 * «Esc para cerrar»: al abrir, y cada vez que alguien mueve el mouse.
 *
 * La pizarra es una pantalla de público, así que un cartel permanente sería
 * ruido en el salón. Pero mostrarlo sólo unos segundos al arrancar tampoco
 * sirve: quien abre la pizarra está mirando la taquilla en el otro monitor y
 * cuando voltea al televisor el cartel ya se fue.
 *
 * El mouse es la señal correcta: en el TV nadie lo toca en toda la jornada,
 * y el único momento en que aparece un puntero sobre esta pantalla es cuando
 * el operador vino a hacer algo con ella. Ahí la pista reaparece sola.
 */
function PistaCerrar() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mostrar = () => {
      setVisible(true);
      clearTimeout(t);
      t = setTimeout(() => setVisible(false), 12000);
    };
    mostrar();
    window.addEventListener('mousemove', mostrar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', mostrar);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed bottom-4 right-5 z-50 rounded-md
        border border-humo bg-negro/85 px-4 py-2 font-ui text-[17px] tracking-wide
        text-gris-claro transition-opacity duration-700
        ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <b className="text-amarillo">Esc</b> para cerrar esta pantalla
    </div>
  );
}

function Escalada({ children }: { children: ReactNode }) {
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const medir = () => {
      setEscala(Math.min(
        window.innerWidth / ANCHO_DISENO,
        window.innerHeight / ALTO_DISENO,
      ));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  return (
    <div className="grid h-full w-full place-items-center overflow-hidden bg-pizarra-campo">
      <div
        style={{
          width: ANCHO_DISENO,
          height: ALTO_DISENO,
          transform: `scale(${escala})`,
          // Sin esto el escalado dejaría el diseño anclado por el centro y
          // el contenedor seguiría reservando los 1920×1080 completos.
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
}
