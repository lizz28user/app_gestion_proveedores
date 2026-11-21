import { normalizarClaveColumna, parseNumeroSeguro } from "./agenda-cruce";
import type { ScheduledArrival } from "@/app/(app)/garita/registro-de-llegada/scheduled-arrivals";

/** Filas del Reporte IKF del último cruce procesado en el Dashboard (borrador). */
export const LS_REPORTE_KEY = "portal-proveedores:cruce:reporte";

/** Datos del último cruce: fecha de la agenda (desde el nombre del archivo) y archivos usados. */
export const LS_CRUCE_META_KEY = "portal-proveedores:cruce:meta";

/**
 * IKF asignado a Garita: se fija SOLO al presionar "Guardar dashboard".
 * Registro de llegada, Panel general y Gestión de recepción leen de aquí.
 */
export const LS_GARITA_KEY = "portal-proveedores:garita:ikf-asignado";
export const EVENTO_GARITA = "garita-ikf-asignado";

export type MetaCruce = {
  fechaAgenda: string | null;
  archivoAgenda: string | null;
  archivoReporte: string | null;
  procesadoEn: string;
};

/** Proveedor que se atiende en una hora (para el resumen al pasar el puntero). */
export type ProveedorHora = { nombre: string; lpns: number; unidades: number };

/** LPN y proveedores agendados por hora de inicio de cita (del cruce Agenda × IKF). */
export type LpnsHora = {
  hora: string;
  lpns: number;
  proveedores: number;
  /** Ausente en asignaciones guardadas antes de este cambio. */
  detalle?: ProveedorHora[];
};

export type IkfAsignado = {
  filas: Fila[];
  fechaAgenda: string | null;
  fechaIkf: string | null;
  archivoAgenda: string | null;
  archivoReporte: string | null;
  asignadoEn: string;
  /** Ausente en asignaciones hechas antes de este cambio. */
  lpnsPorHora?: LpnsHora[];
  totalLpns?: number;
};

const LS_CRUCE_RESULTADO_KEY = "portal-proveedores:cruce:resultado";

/**
 * Agrupa los proveedores del cruce por la hora de su cita: suma sus LPN (enteros)
 * y cuenta proveedores. Es el mismo criterio del "Horario hora a hora" del Dashboard.
 */
export function lpnsPorHoraDelCruce(): LpnsHora[] {
  try {
    const raw = window.localStorage.getItem(LS_CRUCE_RESULTADO_KEY);
    if (!raw) return [];
    const resultado = JSON.parse(raw) as {
      proveedoresAgenda?: {
        horaInicio: string | null;
        lpns: number | null;
        proveedorOriginal: string;
        totalUnidadesEstimadas?: number;
      }[];
    };
    const porHora = new Map<string, LpnsHora & { detalle: ProveedorHora[] }>();
    for (const p of resultado.proveedoresAgenda ?? []) {
      const hora = normalizarHora(p.horaInicio)?.slice(0, 2);
      if (!hora) continue; // proveedores sin cita: no tienen hora
      const lpns = Math.round(p.lpns ?? 0);
      const actual = porHora.get(hora) ?? { hora, lpns: 0, proveedores: 0, detalle: [] };
      actual.lpns += lpns;
      actual.proveedores += 1;
      actual.detalle.push({
        nombre: p.proveedorOriginal,
        lpns,
        unidades: Math.round(p.totalUnidadesEstimadas ?? 0),
      });
      porHora.set(hora, actual);
    }
    return [...porHora.values()]
      .map((h) => ({ ...h, detalle: h.detalle.sort((a, b) => b.lpns - a.lpns || a.nombre.localeCompare(b.nombre)) }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  } catch {
    return [];
  }
}

export function cargarMetaCruce(): MetaCruce | null {
  try {
    const raw = window.localStorage.getItem(LS_CRUCE_META_KEY);
    return raw ? (JSON.parse(raw) as MetaCruce) : null;
  } catch {
    return null;
  }
}

export function guardarMetaCruce(meta: MetaCruce | null): void {
  try {
    if (meta) window.localStorage.setItem(LS_CRUCE_META_KEY, JSON.stringify(meta));
    else window.localStorage.removeItem(LS_CRUCE_META_KEY);
  } catch {
    // Sin persistencia si localStorage no está disponible.
  }
}

/**
 * Toma el IKF del último cruce y lo deja como fuente principal de Garita.
 * Devuelve lo asignado, o null si no hay un IKF procesado.
 */
export function asignarIkfAGarita(): IkfAsignado | null {
  try {
    const raw = window.localStorage.getItem(LS_REPORTE_KEY);
    if (!raw) return null;
    const filas: unknown = JSON.parse(raw);
    if (!Array.isArray(filas) || filas.length === 0) return null;
    const meta = cargarMetaCruce();
    const lpnsPorHora = lpnsPorHoraDelCruce();
    const asignado: IkfAsignado = {
      filas: filas as Fila[],
      fechaAgenda: meta?.fechaAgenda ?? null,
      fechaIkf: agruparCitasPorProveedor(filas as Fila[]).fecha,
      archivoAgenda: meta?.archivoAgenda ?? null,
      archivoReporte: meta?.archivoReporte ?? null,
      asignadoEn: new Date().toISOString(),
      lpnsPorHora,
      totalLpns: lpnsPorHora.reduce((suma, h) => suma + h.lpns, 0),
    };
    window.localStorage.setItem(LS_GARITA_KEY, JSON.stringify(asignado));
    window.dispatchEvent(new Event(EVENTO_GARITA));
    return asignado;
  } catch {
    return null;
  }
}

/**
 * Asignaciones guardadas antes de existir el detalle no traen los nombres por hora:
 * se completan con el último cruce o, si no está, con las citas del propio IKF.
 */
function completarDetalle(dato: IkfAsignado): LpnsHora[] | undefined {
  const horas = dato.lpnsPorHora;
  if (!horas || horas.every((h) => h.detalle && h.detalle.length > 0)) return horas;

  const delCruce = new Map(lpnsPorHoraDelCruce().map((h) => [h.hora, h.detalle ?? []]));
  const delIkf = new Map<string, ProveedorHora[]>();
  for (const cita of agruparCitasPorProveedor(dato.filas).citas) {
    const hora = cita.horaSolicitada.slice(0, 2);
    const lista = delIkf.get(hora) ?? [];
    lista.push({ nombre: cita.proveedor, lpns: 0, unidades: Math.round(Number(cita.unidadesEstimadas) || 0) });
    delIkf.set(hora, lista);
  }

  return horas.map((h) => {
    if (h.detalle && h.detalle.length > 0) return h;
    const cruce = delCruce.get(h.hora);
    const ikf = (delIkf.get(h.hora) ?? []).sort((a, b) => b.unidades - a.unidades);
    return { ...h, detalle: cruce && cruce.length > 0 ? cruce : ikf };
  });
}

/** IKF asignado a Garita (o null si todavía no se guardó ningún dashboard). */
export function cargarIkfAsignado(): IkfAsignado | null {
  try {
    const raw = window.localStorage.getItem(LS_GARITA_KEY);
    if (!raw) return null;
    const dato = JSON.parse(raw) as IkfAsignado;
    if (!Array.isArray(dato.filas) || dato.filas.length === 0) return null;
    return { ...dato, lpnsPorHora: completarDetalle(dato) };
  } catch {
    return null;
  }
}

export type CitasDelReporte = {
  /** Fecha de las citas en formato ISO (yyyy-mm-dd), o null si no se pudo leer. */
  fecha: string | null;
  /** Una fila por proveedor: primera hora de cita del día y suma de unidades. */
  citas: ScheduledArrival[];
  /** Número de citas distintas del reporte. */
  totalCitas: number;
  /** Citas distintas por hora de inicio ("07" → 5, "08" → 9…), ordenadas por hora. */
  porHora: { hora: string; citas: number; unidades: number }[];
};

type Fila = Record<string, unknown>;

function campo(fila: Fila, ...alias: string[]): unknown {
  for (const nombre of alias) {
    const clave = normalizarClaveColumna(nombre);
    if (clave in fila) return fila[clave];
  }
  return undefined;
}

/** Convierte "07:00", "7:00:00" o una fracción de día de Excel (0.2916…) a "HH:MM". */
export function normalizarHora(valor: unknown): string | null {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const minutos = Math.round((valor % 1) * 24 * 60);
    const h = Math.floor(minutos / 60) % 24;
    const m = minutos % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const coincide = String(valor).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!coincide) return null;
  return `${coincide[1].padStart(2, "0")}:${coincide[2]}`;
}

/** Convierte "16-11-2026", "16/11/2026" o un número de serie de Excel a "2026-11-16". */
export function normalizarFecha(valor: unknown): string | null {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const ms = Math.round((valor - 25569) * 86400 * 1000);
    const fecha = new Date(ms);
    return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString().slice(0, 10);
  }
  const texto = String(valor).trim();
  const dmy = texto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

/**
 * Agrupa las filas del Reporte IKF (una por orden de compra) en una fila por
 * proveedor, con su primera hora de cita y la suma de unidades estimadas.
 */
export function agruparCitasPorProveedor(filas: Fila[]): CitasDelReporte {
  const porRuc = new Map<string, ScheduledArrival & { minutos: number }>();
  const citas = new Set<string>();
  const fechas = new Map<string, number>();
  // Por hora: citas distintas y unidades (una cita puede tener varias OC).
  const citasPorHora = new Map<string, Set<string>>();
  const unidadesPorHora = new Map<string, number>();

  for (const fila of filas) {
    const ruc = String(campo(fila, "RUC Proveedor", "RUC") ?? "").trim();
    const proveedor = String(campo(fila, "Nombre Proveedor", "Proveedor") ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!ruc || !proveedor) continue;

    const numeroCita = String(campo(fila, "Número de Cita") ?? "").trim();
    if (numeroCita) citas.add(numeroCita);

    const fecha = normalizarFecha(campo(fila, "Fecha Cita", "Fecha"));
    if (fecha) fechas.set(fecha, (fechas.get(fecha) ?? 0) + 1);

    const hora = normalizarHora(campo(fila, "Hora Inicio")) ?? "00:00";
    const [h, m] = hora.split(":").map(Number);
    const minutos = h * 60 + m;
    const unidades = parseNumeroSeguro(campo(fila, "Unidades Estimadas"));

    const horaClave = hora.slice(0, 2);
    if (!citasPorHora.has(horaClave)) citasPorHora.set(horaClave, new Set());
    citasPorHora.get(horaClave)!.add(numeroCita || `${ruc}-${hora}`);
    unidadesPorHora.set(horaClave, (unidadesPorHora.get(horaClave) ?? 0) + unidades);

    const actual = porRuc.get(ruc);
    if (!actual) {
      porRuc.set(ruc, {
        ruc,
        proveedor,
        horaSolicitada: hora,
        unidadesEstimadas: String(unidades),
        minutos,
      });
    } else {
      actual.unidadesEstimadas = String(
        Math.round((Number(actual.unidadesEstimadas) + unidades) * 100) / 100,
      );
      if (minutos < actual.minutos) {
        actual.minutos = minutos;
        actual.horaSolicitada = hora;
      }
    }
  }

  // La fecha del reporte es la que más se repite.
  const fecha =
    [...fechas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    fecha,
    totalCitas: citas.size,
    porHora: [...citasPorHora.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hora, set]) => ({
        hora,
        citas: set.size,
        unidades: Math.round(unidadesPorHora.get(hora) ?? 0),
      })),
    citas: [...porRuc.values()]
      .sort((a, b) => a.minutos - b.minutos || a.proveedor.localeCompare(b.proveedor))
      .map(({ minutos: _minutos, ...cita }) => cita),
  };
}

/** Citas únicas de un proveedor en un reporte IKF (para el Top de proveedores). */
export type CitasProveedor = {
  /** RUC si existe; si no, el nombre en mayúsculas. Sirve para agrupar entre días. */
  clave: string;
  proveedor: string;
  ruc: string | null;
  citas: string[];
  unidades: number;
};

/** Agrupa las filas del Reporte IKF por proveedor con sus números de cita únicos. */
export function citasPorProveedor(filas: Fila[]): CitasProveedor[] {
  const mapa = new Map<string, CitasProveedor & { set: Set<string> }>();
  for (const fila of filas) {
    const ruc = String(campo(fila, "RUC Proveedor", "RUC") ?? "").trim() || null;
    const proveedor = String(campo(fila, "Nombre Proveedor", "Proveedor") ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const numeroCita = String(campo(fila, "Número de Cita") ?? "")
      .trim()
      .replace(/^0+(\d)/, "$1")
      .replace(/\.0+$/, "");
    if (!proveedor || !numeroCita) continue;
    const clave = ruc ?? proveedor.toUpperCase();
    const actual =
      mapa.get(clave) ??
      { clave, proveedor, ruc, citas: [], unidades: 0, set: new Set<string>() };
    actual.set.add(numeroCita);
    actual.unidades += parseNumeroSeguro(campo(fila, "Unidades Estimadas"));
    mapa.set(clave, actual);
  }
  return [...mapa.values()].map(({ set, ...resto }) => ({
    ...resto,
    citas: [...set],
    unidades: Math.round(resto.unidades),
  }));
}

/** Lee el reporte IKF guardado y devuelve fecha + citas por proveedor (o null). */
export function cargarCitasPorProveedor(): { fecha: string | null; proveedores: CitasProveedor[] } | null {
  try {
    const raw = window.localStorage.getItem(LS_REPORTE_KEY);
    if (!raw) return null;
    const filas: unknown = JSON.parse(raw);
    if (!Array.isArray(filas) || filas.length === 0) return null;
    return {
      fecha: agruparCitasPorProveedor(filas as Fila[]).fecha,
      proveedores: citasPorProveedor(filas as Fila[]),
    };
  } catch {
    return null;
  }
}

/** Orden de compra de un proveedor según el Reporte IKF. */
export type OrdenCompraIkf = {
  oc: string;
  numeroCita: string;
  horaInicio: string | null;
  unidades: number;
};

/** OCs del proveedor (por RUC) en el IKF asignado a Garita, sin repetir. */
export function ocsDelProveedor(ruc: string): OrdenCompraIkf[] {
  try {
    const filas = cargarIkfAsignado()?.filas;
    if (!filas) return [];
    const rucBuscado = ruc.trim();
    const porOc = new Map<string, OrdenCompraIkf>();
    for (const fila of filas as Fila[]) {
      if (String(campo(fila, "RUC Proveedor", "RUC") ?? "").trim() !== rucBuscado) continue;
      const oc = String(campo(fila, "Orden de Compra", "OC") ?? "")
        .trim()
        .replace(/\.0+$/, "");
      if (!oc) continue;
      const actual = porOc.get(oc);
      const unidades = parseNumeroSeguro(campo(fila, "Unidades Estimadas"));
      if (actual) {
        actual.unidades += unidades;
      } else {
        porOc.set(oc, {
          oc,
          numeroCita: String(campo(fila, "Número de Cita") ?? "").trim(),
          horaInicio: normalizarHora(campo(fila, "Hora Inicio")),
          unidades,
        });
      }
    }
    return [...porOc.values()]
      .map((o) => ({ ...o, unidades: Math.round(o.unidades) }))
      .sort((a, b) => a.oc.localeCompare(b.oc, "es", { numeric: true }));
  } catch {
    return [];
  }
}

/**
 * Citas que usa Garita: las del IKF asignado al guardar el Dashboard (o null si no hay).
 * La fecha es la de la agenda (nombre del archivo); si no se detectó, la del IKF.
 */
export function cargarCitasDelReporte(): (CitasDelReporte & { asignado: IkfAsignado }) | null {
  const asignado = cargarIkfAsignado();
  if (!asignado) return null;
  const resultado = agruparCitasPorProveedor(asignado.filas);
  if (resultado.citas.length === 0) return null;
  return {
    ...resultado,
    fecha: asignado.fechaAgenda ?? resultado.fecha,
    asignado,
  };
}
