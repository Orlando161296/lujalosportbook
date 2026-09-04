// Cliente REST. Un solo lugar que sabe la URL del backend y cómo se ve un
// error, para que ninguna pantalla arme fetch a mano.
import type {
  Carrera, Cliente, Cobro, ColorNumero, Ejemplar, EstadoImpresora, Hipodromo, Jornada, Jugada, Moneda, Pizarra, Promocion, ResultadoCarrera, Tabla, Taquilla, TasaCambio, Usuario, Ticket,
} from './tipos';

// Mismo puerto fijo que usa el sidecar (ver apps/backend/src/main.ts): es lo
// único que hay que abrir en el firewall el día que se sume una segunda PC.
const BASE = `http://localhost:${3210}`;

/** Error de negocio del backend, ya con el mensaje que se le muestra al operador. */
export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + ruta, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    // El backend corre como sidecar en la misma máquina: si no responde, se
    // cayó el proceso. Es un mensaje distinto a "la operación falló".
    throw new ErrorApi(0, 'No hay conexión con el servidor local.');
  }
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    const mensaje = Array.isArray(cuerpo?.message)
      ? cuerpo.message.join('. ')
      : (cuerpo?.message ?? `Error ${res.status}`);
    throw new ErrorApi(res.status, mensaje);
  }
  if (res.status === 204) return undefined as T;

  // Cuerpo vacío = null, sin reventar.
  //
  // Nest responde 200 con el cuerpo VACÍO cuando el handler devuelve null
  // —no «null» ni un 204—, y `res.json()` sobre eso lanza «Unexpected end of
  // JSON input». Le pasaba a `GET /jornadas/activa` mientras no hubiera
  // ninguna abierta, que es justo el estado de una instalación recién hecha:
  // la pantalla de Remate mostraba un error de conexión en lugar del vacío
  // que invita a abrir la jornada.
  const texto = await res.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

const get = <T>(r: string) => pedir<T>(r);
const post = <T>(r: string, cuerpo?: unknown) =>
  pedir<T>(r, { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const put = <T>(r: string, cuerpo?: unknown) =>
  pedir<T>(r, { method: 'PUT', body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const patch = <T>(r: string, cuerpo?: unknown) =>
  pedir<T>(r, { method: 'PATCH', body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const del = <T>(r: string) => pedir<T>(r, { method: 'DELETE' });

/**
 * Subida de archivo, por fuera de `pedir`.
 *
 * `pedir` fija `Content-Type: application/json` para todo, y en multipart eso
 * rompe la petición: el navegador tiene que poner el suyo con el `boundary`
 * que él mismo genera, y un Content-Type escrito a mano lo pisa y deja al
 * servidor sin poder separar las partes. Por eso este camino arma el fetch
 * aparte en vez de reusar el de siempre.
 */
async function subir<T>(ruta: string, formulario: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + ruta, { method: 'POST', body: formulario });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor local.');
  }
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new ErrorApi(res.status, cuerpo?.message ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    entrar: (usuario: string, clave: string, taquillaId?: number) =>
      post<{ usuario: Usuario }>('/auth/login', { usuario, clave, taquillaId }),
    salir: () => post<void>('/auth/logout'),
  },

  hipodromos: {
    listar: () => get<Hipodromo[]>('/hipodromos'),
    crear: (d: Partial<Hipodromo>) => post<Hipodromo>('/hipodromos', d),
    editar: (id: number, d: Partial<Hipodromo>) => patch<Hipodromo>(`/hipodromos/${id}`, d),
  },

  taquillas: {
    listar: () => get<Taquilla[]>('/taquillas'),
    crear: (nombre: string) => post<Taquilla>('/taquillas', { nombre }),
    editar: (id: number, d: Partial<Taquilla>) => patch<Taquilla>(`/taquillas/${id}`, d),
  },

  usuarios: {
    listar: () => get<Usuario[]>('/usuarios'),
    crear: (d: Record<string, unknown>) => post<Usuario>('/usuarios', d),
    editar: (id: number, d: Record<string, unknown>) => patch<Usuario>(`/usuarios/${id}`, d),
  },

  colores: {
    listar: () => get<ColorNumero[]>('/colores-numero'),
  },

  tasa: {
    vigente: () => get<TasaCambio | null>('/tasa/vigente'),
    registrar: (valorBsPorUsd: number, origen = 'manual') =>
      post<TasaCambio>('/tasa', { valorBsPorUsd, origen }),
    historial: () => get<TasaCambio[]>('/tasa/historial'),
  },

  jornadas: {
    listar: () => get<Jornada[]>('/jornadas'),
    crear: (hipodromoId: number, fecha: string, cantidadCarreras: number) =>
      post<Jornada>('/jornadas', { hipodromoId, fecha, cantidadCarreras }),
    // Con qué jornada se trabaja. null cuando no hay ninguna abierta: la
    // taquilla no adivina, muestra el vacío y manda a elegirla.
    activa: () => get<Jornada | null>('/jornadas/activa'),
    // Falla con 409 si ya hay otra abierta; el mensaje nombra cuál cerrar.
    activar: (id: number) => patch<Jornada>(`/jornadas/${id}/activar`),
    cerrar: (id: number) => patch<Jornada>(`/jornadas/${id}/cerrar`),
  },

  // Qué carrera está puesta en el TV. Lo decide el operador desde la
  // taquilla; la ventana de la pizarra lo consulta al abrir y después se
  // entera por socket.
  tickets: {
    // Texto plano al ancho que tenga configurada la térmica de esta PC
    // (32 columnas en 58 mm, 48 en 80 mm), tal cual saldría por el papel.
    previsualizar: (id: number) =>
      get<{ texto: string }>(`/tickets/${id}/previsualizacion`),
    // Qué impresora hay del otro lado. La pantalla lo necesita para rotular
    // la vista previa con el ancho real y para no ofrecer un botón de
    // imprimir que no tiene a dónde mandar el papel.
    impresora: () => get<EstadoImpresora>('/tickets/impresora'),
    // Reimprime uno ya emitido: no consume numeración ni toca la base.
    imprimir: (id: number) => post<{ impreso: true }>(`/tickets/${id}/imprimir`),
    // Página de prueba: verifica la térmica sin gastar un correlativo.
    prueba: () => post<{ impreso: true }>('/tickets/prueba'),
  },

  pizarra: {
    actual: () => get<{ carreraId: number | null }>('/pizarra/carrera'),
    mostrar: (carreraId: number | null) =>
      put<{ carreraId: number | null }>('/pizarra/carrera', { carreraId }),
  },

  carreras: {
    listar: () => get<Carrera[]>('/carreras'),
    crear: (d: Record<string, unknown>) => post<Carrera>('/carreras', d),
    pizarra: (id: number) => get<Pizarra>(`/carreras/${id}/pizarra`),
    cambiarEstado: (id: number, estado: Carrera['estado']) =>
      patch<Carrera>(`/carreras/${id}/estado`, { estado }),
    registrarResultado: (id: number, ejemplaresGanadores: number[]) =>
      post<ResultadoCarrera>(`/carreras/${id}/resultado`, { ejemplaresGanadores }),
  },

  tablas: {
    listar: (carreraId: number) => get<Tabla[]>(`/carreras/${carreraId}/tablas`),
    crear: (carreraId: number, etiqueta: string) =>
      post<Tabla>(`/carreras/${carreraId}/tablas`, { etiqueta }),
    actualizarPote: (id: number, poteCasa: number) =>
      patch<Tabla>(`/tablas/${id}/pote`, { poteCasa }),
    cerrar: (id: number) => patch<Tabla>(`/tablas/${id}/cerrar`),
  },

  ejemplares: {
    listar: (carreraId: number) => get<Ejemplar[]>(`/carreras/${carreraId}/ejemplares`),
    crear: (carreraId: number, numero: number, nombre: string) =>
      post<Ejemplar>(`/carreras/${carreraId}/ejemplares`, { numero, nombre }),
    renombrar: (id: number, nombre: string) =>
      patch<Ejemplar>(`/ejemplares/${id}`, { nombre }),
    retirar: (id: number) => patch<Ejemplar>(`/ejemplares/${id}/retirar`),
    reponer: (id: number) => patch<Ejemplar>(`/ejemplares/${id}/reponer`),
  },

  jugadas: {
    /** Upsert: crea o reemplaza la jugada activa de ese ejemplar en esa tabla. */
    registrar: (
      tablaId: number,
      ejemplarId: number,
      d: { clienteId?: number; apodo?: string; esCasa?: boolean; monto: number; moneda: Moneda },
    ) => put<Jugada>(`/tablas/${tablaId}/jugadas/${ejemplarId}`, d),
    anular: (tablaId: number, ejemplarId: number) =>
      del<void>(`/tablas/${tablaId}/jugadas/${ejemplarId}`),
    listar: (params: { carreraId?: number; clienteId?: number } = {}) => {
      // El backend los nombra en snake_case; se traduce acá y no en cada
      // pantalla, para que ninguna tenga que saberlo.
      const q = new URLSearchParams();
      if (params.carreraId != null) q.set('carrera_id', String(params.carreraId));
      if (params.clienteId != null) q.set('cliente_id', String(params.clienteId));
      return get<Jugada[]>(`/jugadas${q.toString() ? `?${q}` : ''}`);
    },
  },

  clientes: {
    listar: () => get<Cliente[]>('/clientes'),
    crear: (d: Record<string, unknown>) => post<Cliente>('/clientes', d),
    editar: (id: number, d: Record<string, unknown>) => patch<Cliente>(`/clientes/${id}`, d),
  },

  cobros: {
    listar: (carreraId: number) => get<Cobro[]>(`/carreras/${carreraId}/cobros`),
    generar: (carreraId: number) => post<Cobro[]>(`/carreras/${carreraId}/cobros/generar`),
    // Al pagar se emite el ticket, así que la respuesta lo trae: es el
    // momento exacto en que hay que ofrecer la impresión.
    marcarPagado: (id: number) =>
      patch<Cobro & { ticket: Ticket | null }>(`/cobros/${id}/pagar`),
  },

  reportes: {
    // Sin argumentos resume la jornada abierta. `fecha` queda como escape
    // para mirar un día completo hacia atrás, sin importar la jornada.
    resumenDia: <T = unknown>(opciones?: { jornadaId?: number; fecha?: string }) => {
      const q = opciones?.jornadaId != null ? `?jornadaId=${opciones.jornadaId}`
        : opciones?.fecha ? `?fecha=${opciones.fecha}`
        : '';
      return get<T>(`/reportes/resumen-dia${q}`);
    },
  },

  promociones: {
    /** Todas, incluidas las bajadas: es la lista de administración. */
    listar: () => get<Promocion[]>('/promociones'),
    /** Sólo las que el televisor rota. */
    activas: () => get<Promocion[]>('/promociones/activas'),
    /**
     * La URL de los bytes, para poner en un `<img src>`. No es una petición:
     * la imagen la pide el navegador solo, y el backend la manda con caché
     * porque en la pizarra se repite todo el día.
     */
    imagen: (id: number) => `${BASE}/promociones/${id}/imagen`,
    subir: (archivo: File) => {
      const f = new FormData();
      f.append('imagen', archivo, archivo.name);
      return subir<Promocion>('/promociones', f);
    },
    /** Bajar o volver a levantar sin perder el archivo. */
    cambiarActiva: (id: number, activa: boolean) =>
      patch<Promocion>(`/promociones/${id}`, { activa }),
    borrar: (id: number) => del<void>(`/promociones/${id}`),
  },
};
