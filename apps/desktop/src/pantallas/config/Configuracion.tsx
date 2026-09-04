import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { bs, fechaCorta, hora } from '../../lib/formato';
import { useNavegacion, type PantallaConfig } from '../../lib/estado';
import {
  Boton, Campo, Casilla, Cargando, Entrada, Etiqueta, Panel, Pildora, Problema, Selector, Vacio,
} from '../../ui';
import { CampoFecha } from '../../ui/campo-fecha';
import { avisar } from '../../ui/avisos';

const SECCIONES: { id: PantallaConfig; nombre: string }[] = [
  { id: 'tasa', nombre: 'Tasa del día' },
  { id: 'usuarios', nombre: 'Usuarios y roles' },
  { id: 'hipodromos', nombre: 'Hipódromos' },
  { id: 'jornadas', nombre: 'Carreras del día' },
  { id: 'impresora', nombre: 'Impresora' },
  { id: 'clientes', nombre: 'Clientes VIP' },
  { id: 'taquillas', nombre: 'Taquillas' },
  { id: 'promociones', nombre: 'Pizarra · avisos' },
];

export function Configuracion() {
  const { pantallaConfig, irAConfig } = useNavegacion();
  return (
    <div className="flex min-h-0 flex-1">
      <nav className="w-[216px] flex-none border-r border-borde bg-[#EDE9E0] py-4">
        <div className="etiqueta px-4.5 pb-2.5 pl-[18px]">Configuración</div>
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => irAConfig(s.id)}
            className={`block w-full border-l-[3px] px-[18px] py-2 text-left text-[15px]
              ${s.id === pantallaConfig
                ? 'border-amarillo bg-carbon font-bold text-amarillo'
                : 'border-transparent hover:bg-black/5'}`}
          >
            {s.nombre}
          </button>
        ))}
      </nav>

      <div className="barra-scroll min-h-0 flex-1 overflow-auto p-7">
        {pantallaConfig === 'tasa' && <Tasa />}
        {pantallaConfig === 'usuarios' && <Usuarios />}
        {pantallaConfig === 'hipodromos' && <Hipodromos />}
        {pantallaConfig === 'jornadas' && <Jornadas />}
        {pantallaConfig === 'impresora' && <Impresora />}
        {pantallaConfig === 'clientes' && <Clientes />}
        {pantallaConfig === 'taquillas' && <Taquillas />}
        {pantallaConfig === 'promociones' && <Promociones />}
      </div>
    </div>
  );
}

function Titulo({ texto, nota }: { texto: string; nota?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-[27px] tracking-[-0.02em]">{texto}</h1>
      {nota && <p className="text-[15px] text-gris">{nota}</p>}
    </div>
  );
}

/* ─────────────────────────── Tasa del día ─────────────────────────── */

function Tasa() {
  const qc = useQueryClient();
  const vigente = useQuery({ queryKey: ['tasa'], queryFn: api.tasa.vigente });
  const historial = useQuery({ queryKey: ['tasa-historial'], queryFn: api.tasa.historial });
  const [valor, setValor] = useState('');

  const registrar = useMutation({
    mutationFn: () => api.tasa.registrar(Number(valor.replace(',', '.'))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasa'] });
      qc.invalidateQueries({ queryKey: ['tasa-historial'] });
      setValor('');
    },
  });

  return (
    <>
      <Titulo
        texto="Tasa del dólar del día"
        nota="Se aplica a todo el remate: montos, cobros y tickets de la jornada."
      />
      <Panel className="max-w-[760px]" cuerpoClassName="p-4 flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_220px] items-end gap-4">
          <Campo>
            <Etiqueta>Tasa de hoy (Bs por 1 USD)</Etiqueta>
            <Entrada
              grande
              inputMode="decimal"
              placeholder={vigente.data ? bs(vigente.data.valorBsPorUsd) : '0,00'}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </Campo>
          <Campo>
            <Etiqueta>Vigente desde</Etiqueta>
            <div className="plata flex min-h-[38px] items-center rounded border
              border-borde-fuerte bg-[#EFEBE2] px-3 text-gris">
              {vigente.data ? `${fechaCorta(vigente.data.vigenteDesde)} ${hora(vigente.data.vigenteDesde)}` : '—'}
            </div>
          </Campo>
        </div>
        <div className="flex justify-end border-t border-borde pt-3">
          <Boton
            tono="principal"
            disabled={!valor || registrar.isPending}
            onClick={() => registrar.mutate()}
          >
            {registrar.isPending ? 'Guardando…' : 'Guardar tasa del día'}
          </Boton>
        </div>
      </Panel>

      <Panel titulo="Historial de tasas" className="mt-5 max-w-[760px]" cuerpoClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-carbon text-gris-claro">
              <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Fecha</th>
              <th className="px-2.5 py-2 text-right text-[10.5px] uppercase tracking-[0.1em]">Tasa</th>
              <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Origen</th>
            </tr>
          </thead>
          <tbody>
            {(historial.data ?? []).map((t) => (
              <tr key={t.id} className="border-b border-borde">
                <td className="plata px-2.5 py-1.5">
                  {fechaCorta(t.vigenteDesde)} {hora(t.vigenteDesde)}
                </td>
                <td className="plata px-2.5 py-1.5 text-right font-bold">{bs(t.valorBsPorUsd)}</td>
                <td className="px-2.5 py-1.5 capitalize">{t.origen}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-borde px-3 py-2 text-[13px] text-gris">
          Cada cambio queda con usuario y hora: sirve para auditar los cobros del día.
        </p>
      </Panel>
    </>
  );
}

/* ─────────────────────────── Taquillas ─────────────────────────── */

function Taquillas() {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['taquillas'], queryFn: api.taquillas.listar });
  const [nombre, setNombre] = useState('');

  const crear = useMutation({
    mutationFn: () => api.taquillas.crear(nombre.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['taquillas'] }); setNombre(''); },
  });
  const alternar = useMutation({
    mutationFn: ({ id, activa }: { id: number; activa: boolean }) =>
      api.taquillas.editar(id, { activa }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taquillas'] }),
  });

  return (
    <>
      <Titulo texto="Taquillas" nota="Los puestos físicos. Cada jugada guarda desde cuál se registró." />
      <div className="flex max-w-[760px] gap-2.5">
        <Entrada
          className="flex-1"
          placeholder="Ej. Taquilla 01"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && nombre.trim() && crear.mutate()}
        />
        <Boton tono="oscuro" disabled={!nombre.trim()} onClick={() => crear.mutate()}>
          + Nueva taquilla
        </Boton>
      </div>
      <Panel className="mt-4 max-w-[760px]" cuerpoClassName="p-0">
        {lista.data?.length === 0 ? (
          <Vacio titulo="Todavía no hay taquillas" detalle="Creá al menos una para que los operadores puedan elegirla al entrar." />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {(lista.data ?? []).map((t) => (
                <tr key={t.id} className="border-b border-borde">
                  <td className="px-2.5 py-2 font-semibold">{t.nombre}</td>
                  <td className="px-2.5 py-2">
                    {t.activa ? <Pildora tono="ok">Activa</Pildora> : <Pildora>Inactiva</Pildora>}
                  </td>
                  <td className="px-2.5 py-2 text-right">
                    <Boton onClick={() => alternar.mutate({ id: t.id, activa: !t.activa })}>
                      {t.activa ? 'Desactivar' : 'Activar'}
                    </Boton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

/* ─────────────────────────── Hipódromos ─────────────────────────── */

function Hipodromos() {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['hipodromos'], queryFn: api.hipodromos.listar });
  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tablas, setTablas] = useState(3);

  const crear = useMutation({
    mutationFn: () => api.hipodromos.crear({
      nombre: nombre.trim(), ciudad: ciudad.trim() || null, tablasPorCarrera: tablas,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hipodromos'] });
      setNombre(''); setCiudad('');
    },
  });

  return (
    <>
      <Titulo
        texto="Hipódromos"
        nota="Se registran una vez; las carreras de cada jornada se abren en Carreras del día."
      />
      <div className="flex gap-5">
        <Panel className="flex-1" cuerpoClassName="p-0">
          {lista.data?.length === 0 ? (
            <Vacio titulo="Sin hipódromos cargados" detalle="Agregá el primero para poder abrir una jornada." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-carbon text-gris-claro">
                  <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Hipódromo</th>
                  <th className="px-2.5 py-2 text-right text-[10.5px] uppercase tracking-[0.1em]">Tablas / carrera</th>
                  <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(lista.data ?? []).map((h) => (
                  <tr key={h.id} className="border-b border-borde">
                    <td className="px-2.5 py-2">
                      <b>{h.nombre}</b>
                      {h.ciudad && <div className="text-[12.5px] text-gris">{h.ciudad}</div>}
                    </td>
                    <td className="plata px-2.5 py-2 text-right">{h.tablasPorCarrera}</td>
                    <td className="px-2.5 py-2">
                      {h.disponibleParaRemate
                        ? <Pildora tono="ok">Disponible</Pildora>
                        : <Pildora>Inactivo</Pildora>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel titulo="Nuevo hipódromo" className="w-[330px] flex-none self-start"
          cuerpoClassName="p-3 flex flex-col gap-3">
          <Campo><Etiqueta>Nombre</Etiqueta>
            <Entrada placeholder="Ej. La Rinconada" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo><Etiqueta>Ciudad / estado</Etiqueta>
            <Entrada placeholder="Caracas" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
          </Campo>
          <Campo><Etiqueta>Tablas por carrera</Etiqueta>
            <Entrada grande className="w-[88px] text-center" inputMode="numeric"
              value={tablas} onChange={(e) => setTablas(Math.max(1, Number(e.target.value) || 1))} />
          </Campo>
          <Boton tono="principal" ancho disabled={!nombre.trim() || crear.isPending}
            onClick={() => crear.mutate()}>
            Guardar hipódromo
          </Boton>
        </Panel>
      </div>
    </>
  );
}

/* ───────────────────────────── Impresora ───────────────────────────── */

/**
 * Estado de la térmica y su página de prueba.
 *
 * La configuración vive en el `.env` de cada PC y no acá: es una propiedad de
 * la máquina —qué impresora tiene enchufada y de cuántos milímetros— y no del
 * negocio. Lo que sí hace falta en pantalla es poder verla y probarla sin
 * emitir un ticket real, porque el correlativo no se reinicia nunca y ajustar
 * el papel a fuerza de cobros deja números gastados en el historial.
 */
function Impresora() {
  const estado = useQuery({ queryKey: ['impresora'], queryFn: api.tickets.impresora });

  const probar = useMutation({
    mutationFn: () => api.tickets.prueba(),
    onSuccess: () => avisar.exito('Página de prueba enviada',
      'Si no sale papel, revisá que la impresora esté encendida y con rollo.'),
    onError: (e) => avisar.error('No se pudo imprimir',
      e instanceof Error ? e.message : 'Error inesperado.'),
  });

  if (estado.isPending) return <Cargando que="la impresora" />;
  if (estado.error) return <Problema error={estado.error} reintentar={estado.refetch} />;
  const i = estado.data!;

  return (
    <>
      <Titulo
        texto="Impresora"
        nota="Se configura en el archivo .env de esta PC, no desde acá: es propiedad de la máquina."
      />

      <Panel className="max-w-[560px]" cuerpoClassName="p-0">
        <Dato etiqueta="Destino" valor={
          i.destino === 'log' ? 'Ninguna — el ticket sale por el registro del servidor'
          : i.destino === 'usb' ? `USB o compartida · ${i.donde}`
          : `Red · ${i.donde}`
        } />
        <Dato etiqueta="Papel" valor={`${i.anchoMm} mm · ${i.columnas} columnas`} />
        <Dato etiqueta="Corte" valor={i.corta ? 'Automático' : 'A mano'} />
      </Panel>

      <div className="mt-4 flex max-w-[560px] items-center gap-3">
        <Boton
          tono="principal"
          disabled={probar.isPending}
          onClick={() => probar.mutate()}
        >
          {probar.isPending ? 'Enviando…' : 'Imprimir página de prueba'}
        </Boton>
        <p className="flex-1 text-[13px] leading-snug text-gris">
          Saca una hoja con una regla de ancho y los acentos. Si el último
          número de la regla no entra, el papel configurado no es el real; si
          los acentos salen raros, la impresora no tomó la tabla de caracteres.
        </p>
      </div>

      {!i.conectada && (
        <p className="mt-4 max-w-[560px] text-[13px] font-semibold leading-snug text-naranja">
          No hay impresora configurada: los tickets se emiten igual y quedan en
          el historial, pero no sale papel. Para conectarla, poné
          IMPRESORA_DESTINO e IMPRESORA_RUTA en apps/backend/.env y reiniciá
          el servidor.
        </p>
      )}
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-borde px-4 py-2.5 last:border-0">
      <span className="etiqueta">{etiqueta}</span>
      <span className="text-right text-[15px] font-semibold">{valor}</span>
    </div>
  );
}

/* ─────────────────────── Carreras del día ─────────────────────── */

function Jornadas() {
  const qc = useQueryClient();
  const { elegirCarrera, irARemate } = useNavegacion();
  const jornadas = useQuery({ queryKey: ['jornadas'], queryFn: api.jornadas.listar });
  const hipodromos = useQuery({ queryKey: ['hipodromos'], queryFn: api.hipodromos.listar });

  const [hipodromoId, setHipodromoId] = useState<number | ''>('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  // Texto, y sólo número al confirmar — mismo motivo que en Ejemplares: con
  // la conversión en cada tecla, borrar el campo lo dejaba en 1 al instante
  // y lo que se tecleaba después se le pegaba detrás. Querías 8 carreras y
  // te quedaban 18, y no había forma de dejarlo vacío para escribir de cero.
  const [cantidadTexto, setCantidadTexto] = useState('6');
  const cantidad = Math.max(1, Number(cantidadTexto) || 1);
  // Qué jornada está desplegada. Las carreras se listan sólo de una: con
  // varias jornadas planificadas —y diez o doce carreras cada una— la
  // pantalla se volvía un rollo donde había que bajar para encontrar la de
  // hoy. Null hasta que se cargan: ahí se abre sola la que esté en trabajo.
  const [desplegada, setDesplegada] = useState<number | null>(null);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['jornadas'] });
    // La jornada activa manda sobre qué carreras ofrece el remate y sobre
    // qué resume el cierre: las tres vistas tienen que moverse juntas.
    qc.invalidateQueries({ queryKey: ['jornada-activa'] });
    qc.invalidateQueries({ queryKey: ['resumen-dia'] });
  };

  const crear = useMutation({
    mutationFn: () => api.jornadas.crear(Number(hipodromoId), fecha, cantidad),
    onSuccess: refrescar,
    onError: (e) => avisar.error('No se creó la jornada',
      e instanceof Error ? e.message : 'Error inesperado.'),
  });

  // Activar es el gesto que reemplaza a que el sistema eligiera solo. Falla
  // con 409 si ya hay otra abierta, y el mensaje del backend nombra cuál
  // cerrar: se muestra tal cual, porque es la instrucción que hay que seguir.
  const activar = useMutation({
    mutationFn: (id: number) => api.jornadas.activar(id),
    onSuccess: (j) => {
      refrescar();
      avisar.exito('Jornada abierta',
        `${fechaCorta(j.fecha)} · ${j.hipodromo?.nombre ?? ''}. El remate ya trabaja con sus carreras.`);
    },
    onError: (e) => avisar.error('No se pudo abrir la jornada',
      e instanceof Error ? e.message : 'Error inesperado.'),
  });

  const cerrar = useMutation({
    mutationFn: (id: number) => api.jornadas.cerrar(id),
    onSuccess: () => {
      refrescar();
      avisar.exito('Jornada cerrada', 'Ya podés abrir la siguiente.');
    },
    onError: (e) => avisar.error('No se pudo cerrar la jornada',
      e instanceof Error ? e.message : 'Error inesperado.'),
  });

  if (jornadas.isPending || hipodromos.isPending) return <Cargando que="las jornadas" />;
  if (jornadas.error) return <Problema error={jornadas.error} reintentar={jornadas.refetch} />;

  // La jornada abierta es con la que se está trabajando: es la que el
  // operador viene a ver, así que se despliega sola.
  const enTrabajo = (jornadas.data ?? []).find((j) => j.estado === 'abierta');
  const abierta = desplegada ?? enTrabajo?.id ?? null;

  return (
    <>
      <Titulo texto="Carreras del día" nota="Dos pasos y listo: cuántas carreras y en qué hipódromo." />

      <Panel className="max-w-[860px]" cuerpoClassName="p-4">
        {/* El ancho de cada columna es el que pide su control, no un reparto
            parejo: «Fecha» no es un campo sino tres —el dd/mm/aaaa más los
            atajos Hoy y Mañana—, y en 200 px los botones dejaban al campo sin
            lugar para la fecha. «Carreras» es lo contrario: un número de un
            dígito al que 140 px le sobraban de largo. */}
        <div className="grid grid-cols-[1fr_300px_92px_auto] items-end gap-4">
          <Campo><Etiqueta>Hipódromo</Etiqueta>
            <Selector value={hipodromoId}
              onChange={(e) => setHipodromoId(Number((e.target as HTMLSelectElement).value) || '')}>
              <option value="">Elegí uno…</option>
              {(hipodromos.data ?? []).filter((h) => h.disponibleParaRemate).map((h) => (
                <option key={h.id} value={h.id}>{h.nombre}</option>
              ))}
            </Selector>
          </Campo>
          <Campo><Etiqueta>Fecha</Etiqueta>
            <CampoFecha value={fecha} onChange={setFecha} />
          </Campo>
          <Campo><Etiqueta>Carreras</Etiqueta>
            <Entrada
              grande
              className="text-center"
              inputMode="numeric"
              value={cantidadTexto}
              onChange={(e) => setCantidadTexto(e.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={() => setCantidadTexto(String(cantidad))}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </Campo>
          <Boton tono="principal" className="h-[38px]"
            disabled={!hipodromoId || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? 'Creando…' : 'Crear jornada'}
          </Boton>
        </div>
        {(hipodromos.data ?? []).length === 0 && (
          <p className="mt-3 text-[13px] font-semibold text-naranja">
            Primero cargá un hipódromo: la jornada necesita saber cuántas tablas lleva cada carrera.
          </p>
        )}
      </Panel>

      <div className="mt-5 flex flex-col gap-4">
        {(jornadas.data ?? []).map((j) => (
          <Panel
            key={j.id}
            titulo={
              // Toda la cabecera es el interruptor: es el área grande y
              // obvia, y ahorra un chevron suelto que compita con los
              // botones de la derecha.
              <button
                type="button"
                onClick={() => setDesplegada(abierta === j.id ? -1 : j.id)}
                className="flex items-center gap-2 text-left"
              >
                <span className={`inline-block w-3 text-[11px] transition-transform
                  ${abierta === j.id ? 'rotate-90' : ''}`}>▶</span>
                {`${fechaCorta(j.fecha)} · ${j.hipodromo?.nombre ?? ''}`}
              </button>
            }
            extra={
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] text-gris-claro">{j.cantidadCarreras} carreras</span>
                {j.estado === 'abierta' && <Pildora tono="no">En trabajo</Pildora>}
                {j.estado === 'cerrada' && <Pildora tono="ok">Cerrada</Pildora>}
                {j.estado === 'abierta' ? (
                  <Boton
                    disabled={cerrar.isPending}
                    onClick={() => cerrar.mutate(j.id)}
                    title="Da por terminado el día: el resumen queda congelado y se puede abrir la siguiente"
                  >
                    Cerrar jornada
                  </Boton>
                ) : j.estado === 'planificada' ? (
                  <Boton
                    tono="principal"
                    disabled={activar.isPending}
                    onClick={() => activar.mutate(j.id)}
                    title="El remate y el resumen pasan a trabajar con esta jornada"
                  >
                    Trabajar esta
                  </Boton>
                ) : null}
              </div>
            }
            className="max-w-[860px]"
            cuerpoClassName={abierta === j.id ? 'p-3 flex flex-col gap-1.5' : 'hidden'}
          >
            {abierta === j.id && (j.carreras ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-hueso">
                <span className="plata w-7 text-center font-bold">{c.numero}</span>
                <span className="flex-1 text-[15px]">Carrera {c.numero}</span>
                {c.estado === 'abierta' ? <Pildora tono="no">En remate</Pildora>
                  : c.estado === 'cerrada' ? <Pildora tono="ok">Corrida</Pildora>
                  : <Pildora>Planificada</Pildora>}
                <Boton onClick={() => { elegirCarrera(c.id); irARemate('ejemplares'); }}>
                  Ejemplares
                </Boton>
                <Boton tono="principal" onClick={() => { elegirCarrera(c.id); irARemate('tablero'); }}>
                  Rematar ↗
                </Boton>
              </div>
            ))}
          </Panel>
        ))}
        {(jornadas.data ?? []).length === 0 && (
          <Vacio titulo="Todavía no hay jornadas" detalle="Creá la primera arriba para empezar a cargar ejemplares." />
        )}
      </div>
    </>
  );
}

/* ─────────────────────────── Clientes ─────────────────────────── */

function Clientes() {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['clientes'], queryFn: api.clientes.listar });
  const [form, setForm] = useState({
    nombre: '', nombrePizarra: '', telefono: '', esVip: false, nivel: '', limiteCreditoBs: 0,
  });

  const crear = useMutation({
    mutationFn: () => api.clientes.crear({
      ...form,
      nombrePizarra: form.nombrePizarra.trim() || null,
      telefono: form.telefono.trim() || null,
      nivel: form.nivel.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      setForm({ nombre: '', nombrePizarra: '', telefono: '', esVip: false, nivel: '', limiteCreditoBs: 0 });
    },
  });

  return (
    <>
      <Titulo
        texto="Clientes"
        nota="Estos nombres son los que autocompletan el campo Jugador del remate."
      />
      <div className="flex gap-5">
        <Panel className="flex-1" cuerpoClassName="p-0">
          {lista.data?.length === 0 ? (
            <Vacio titulo="Sin clientes cargados" detalle="El remate necesita al menos uno para poder registrar una jugada." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-carbon text-gris-claro">
                  <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Cliente</th>
                  <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Nivel</th>
                  <th className="px-2.5 py-2 text-right text-[10.5px] uppercase tracking-[0.1em]">Límite Bs</th>
                </tr>
              </thead>
              <tbody>
                {(lista.data ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-borde">
                    <td className="px-2.5 py-2">
                      <b>{c.nombrePizarra || c.nombre}</b>
                      <div className="text-[12.5px] text-gris">
                        {c.nombre}{c.telefono ? ` · ${c.telefono}` : ''}
                      </div>
                    </td>
                    <td className="px-2.5 py-2">
                      {c.esVip ? <Pildora tono="vip">{c.nivel || 'VIP'}</Pildora> : <Pildora>Normal</Pildora>}
                    </td>
                    <td className="plata px-2.5 py-2 text-right">{bs(c.limiteCreditoBs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel titulo="Nuevo cliente" className="w-[340px] flex-none self-start"
          cuerpoClassName="p-3 flex flex-col gap-3">
          <Campo><Etiqueta>Nombre en la pizarra</Etiqueta>
            <Entrada className="font-display" placeholder="JESUS" value={form.nombrePizarra}
              onChange={(e) => setForm({ ...form, nombrePizarra: e.target.value.toUpperCase() })} />
          </Campo>
          <Campo><Etiqueta>Nombre completo</Etiqueta>
            {/* El backend lo guarda en mayúsculas de todos modos; verlo así
                mientras se escribe evita que el nombre cambie solo al
                guardar. */}
            <Entrada placeholder="JESÚS MARCANO" value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })} />
          </Campo>
          <Campo><Etiqueta>Teléfono</Etiqueta>
            <Entrada placeholder="0414-…" value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </Campo>
          <Casilla marcada={form.esVip} onCambio={(v) => setForm({ ...form, esVip: v })}>
            Es cliente VIP
          </Casilla>
          {form.esVip && (
            <>
              <Campo><Etiqueta>Nivel</Etiqueta>
                <Entrada placeholder="Oro / Plata / Bronce" value={form.nivel}
                  onChange={(e) => setForm({ ...form, nivel: e.target.value })} />
              </Campo>
              <Campo><Etiqueta>Límite de crédito Bs</Etiqueta>
                <Entrada inputMode="numeric" value={form.limiteCreditoBs}
                  onChange={(e) => setForm({ ...form, limiteCreditoBs: Number(e.target.value) || 0 })} />
              </Campo>
            </>
          )}
          <Boton tono="principal" ancho disabled={!form.nombre.trim() || crear.isPending}
            onClick={() => crear.mutate()}>
            Guardar cliente
          </Boton>
        </Panel>
      </div>
    </>
  );
}

/* ─────────────────────────── Usuarios ─────────────────────────── */

const PERMISOS = [
  ['puedeAnularJugadasPropias', 'Anular jugadas propias'],
  ['puedeAnularJugadasDeOtros', 'Anular jugadas de otros'],
  ['puedeCambiarTasa', 'Cambiar la tasa del día'],
  ['puedeCerrarCarrera', 'Cerrar la carrera'],
  ['puedeVerResumen', 'Ver el resumen de la jornada'],
] as const;

function Usuarios() {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['usuarios'], queryFn: api.usuarios.listar });
  const taquillas = useQuery({ queryKey: ['taquillas'], queryFn: api.taquillas.listar });
  const [form, setForm] = useState<Record<string, unknown>>({
    nombre: '', usuario: '', password: '', rol: 'operador',
    puedeAnularJugadasPropias: true,
  });

  const crear = useMutation({
    mutationFn: () => api.usuarios.crear(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setForm({ nombre: '', usuario: '', password: '', rol: 'operador', puedeAnularJugadasPropias: true });
    },
  });

  return (
    <>
      <Titulo texto="Usuarios y roles" nota="El rol define la base; los permisos extra afinan caso por caso." />
      <div className="flex gap-5">
        <Panel className="flex-1" cuerpoClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-carbon text-gris-claro">
                <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Nombre / usuario</th>
                <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Rol</th>
                <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Taquilla</th>
                <th className="px-2.5 py-2 text-left text-[10.5px] uppercase tracking-[0.1em]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(lista.data ?? []).map((u) => (
                <tr key={u.id} className="border-b border-borde">
                  <td className="px-2.5 py-2">
                    <b>{u.nombre}</b>
                    <div className="text-[12.5px] text-gris">{u.usuario}</div>
                  </td>
                  <td className="px-2.5 py-2">
                    {u.rol === 'admin'
                      ? <span className="rounded-sm bg-carbon px-1.5 py-0.5 text-[10.5px]
                          font-bold uppercase tracking-wider text-amarillo">Admin</span>
                      : <Pildora>Operador</Pildora>}
                  </td>
                  <td className="px-2.5 py-2 text-gris">{u.taquilla?.nombre ?? '—'}</td>
                  <td className="px-2.5 py-2">
                    {u.activo ? <Pildora tono="ok">Activo</Pildora> : <Pildora tono="no">Suspendido</Pildora>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel titulo="Nuevo usuario" className="w-[376px] flex-none self-start"
          cuerpoClassName="p-3 flex flex-col gap-3">
          <Campo><Etiqueta>Nombre y apellido</Etiqueta>
            <Entrada value={String(form.nombre)} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo><Etiqueta>Usuario</Etiqueta>
              <Entrada value={String(form.usuario)} onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
            </Campo>
            <Campo><Etiqueta>Clave temporal</Etiqueta>
              <Entrada type="password" value={String(form.password)}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Campo>
          </div>
          <Campo><Etiqueta>Rol</Etiqueta>
            <Selector value={String(form.rol)}
              onChange={(e) => setForm({ ...form, rol: (e.target as HTMLSelectElement).value })}>
              <option value="operador">Operador — remata y cobra</option>
              <option value="admin">Administrador — todo el sistema</option>
            </Selector>
          </Campo>
          <Campo><Etiqueta>Taquilla asignada</Etiqueta>
            <Selector value={String(form.taquillaId ?? '')}
              onChange={(e) => setForm({
                ...form, taquillaId: Number((e.target as HTMLSelectElement).value) || undefined,
              })}>
              <option value="">Sin asignar</option>
              {(taquillas.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </Selector>
          </Campo>
          <div className="flex flex-col gap-2">
            <Etiqueta>Permisos extra</Etiqueta>
            {PERMISOS.map(([clave, texto]) => (
              <Casilla
                key={clave}
                marcada={form[clave] === true}
                onCambio={(v) => setForm({ ...form, [clave]: v })}
              >
                {texto}
              </Casilla>
            ))}
          </div>
          <Boton tono="principal" ancho
            disabled={!form.nombre || !form.usuario || !form.password || crear.isPending}
            onClick={() => crear.mutate()}>
            Crear usuario
          </Boton>
        </Panel>
      </div>
    </>
  );
}

/* ─────────────────────── Pizarra · avisos ─────────────────────── */

/**
 * Los avisos que rotan en el pie del televisor.
 *
 * Es la única pantalla de Configuración que administra archivos, y la usa
 * gente del local sin nadie técnico al lado: por eso el error de formato o
 * de tamaño se muestra tal cual lo manda el backend —«pesa 12,4 MB y el
 * máximo son 8 MB»— en vez de un «no se pudo» que obligue a adivinar.
 *
 * Bajar (`activa: false`) y borrar son cosas distintas a propósito: el
 * patrocinante que no renovó este mes puede volver el que viene, y su
 * imagen ya está cargada.
 */
function Promociones() {
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['promociones'], queryFn: api.promociones.listar });
  const [entrada, setEntrada] = useState<HTMLInputElement | null>(null);

  const refrescar = () => qc.invalidateQueries({ queryKey: ['promociones'] });

  const subir = useMutation({
    mutationFn: (archivo: File) => api.promociones.subir(archivo),
    onSuccess: () => { refrescar(); avisar.exito('Aviso cargado. Ya está en el televisor.'); },
    onError: (e: Error) => avisar.error(e.message),
  });
  const alternar = useMutation({
    mutationFn: ({ id, activa }: { id: number; activa: boolean }) =>
      api.promociones.cambiarActiva(id, activa),
    onSuccess: refrescar,
    onError: (e: Error) => avisar.error(e.message),
  });
  const borrar = useMutation({
    mutationFn: (id: number) => api.promociones.borrar(id),
    onSuccess: () => { refrescar(); avisar.exito('Aviso eliminado.'); },
    onError: (e: Error) => avisar.error(e.message),
  });

  const activas = (lista.data ?? []).filter((p) => p.activa).length;

  return (
    <>
      <Titulo
        texto="Pizarra · avisos"
        nota="Las imágenes que rotan en la franja de abajo del televisor. Se muestran una tras otra, en este orden."
      />

      <div className="flex max-w-[860px] items-center gap-2.5">
        <input
          ref={setEntrada}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) subir.mutate(archivo);
            // Se limpia para que subir DOS VECES el mismo archivo dispare el
            // change las dos veces: sin esto la segunda no hace nada y parece
            // que la pantalla se colgó.
            e.target.value = '';
          }}
        />
        <Boton tono="oscuro" disabled={subir.isPending} onClick={() => entrada?.click()}>
          {subir.isPending ? 'Subiendo…' : '+ Subir aviso'}
        </Boton>
        {/* La medida va acá y no en un instructivo aparte: es el dato que
            decide si el aviso se ve bien, y el momento de saberlo es antes de
            elegir el archivo. La franja es casi 10:1, así que una imagen de
            proporción común se recorta arriba y abajo para poder llenarla. */}
        <span className="text-[13px] text-gris">
          JPG, PNG, WEBP o GIF · hasta 8 MB · <b>1116 × 112 px</b> (franja larga y baja;
          otras proporciones se recortan arriba y abajo)
        </span>
      </div>

      {lista.isPending ? <Cargando /> : (
        <Panel className="mt-4 max-w-[860px]" cuerpoClassName="p-0">
          {lista.data?.length === 0 ? (
            <Vacio
              titulo="Todavía no hay avisos"
              detalle="Mientras no haya ninguno, el pie de la pizarra queda con el espacio reservado y vacío."
            />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(lista.data ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-borde">
                    <td className="w-[150px] px-2.5 py-2">
                      {/* Fondo a cuadros: casi todos los avisos vienen con
                          transparencia y sobre blanco no se ve dónde termina
                          la imagen. */}
                      <div
                        className="flex h-[52px] w-[130px] items-center justify-center overflow-hidden rounded border border-borde"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg,#e8e4da 25%,transparent 25%,transparent 75%,#e8e4da 75%),'
                            + 'linear-gradient(45deg,#e8e4da 25%,transparent 25%,transparent 75%,#e8e4da 75%)',
                          backgroundSize: '12px 12px',
                          backgroundPosition: '0 0, 6px 6px',
                        }}
                      >
                        <img
                          src={api.promociones.imagen(p.id)}
                          alt={p.nombre}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="font-semibold">{p.nombre}</div>
                      <div className="text-[13px] text-gris">
                        {(p.bytes / 1024).toFixed(0)} KB · {fechaCorta(p.creadoEn)}
                      </div>
                    </td>
                    <td className="px-2.5 py-2">
                      {p.activa ? <Pildora tono="ok">En el TV</Pildora> : <Pildora>Bajada</Pildora>}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Boton onClick={() => alternar.mutate({ id: p.id, activa: !p.activa })}>
                          {p.activa ? 'Bajar del TV' : 'Poner en el TV'}
                        </Boton>
                        {/* Confirmación porque el archivo se va del disco y no
                            hay papelera: para sacarlo un rato está «Bajar». */}
                        <Boton
                          tono="destructivo"
                          onClick={() => {
                            if (confirm(`¿Eliminar «${p.nombre}»? Se borra el archivo y no se puede deshacer.`)) {
                              borrar.mutate(p.id);
                            }
                          }}
                        >
                          Eliminar
                        </Boton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {activas === 0 && (lista.data?.length ?? 0) > 0 && (
        <p className="mt-3 max-w-[860px] text-[13px] text-gris">
          Todos los avisos están bajados: la franja del televisor se ve vacía.
        </p>
      )}
    </>
  );
}
