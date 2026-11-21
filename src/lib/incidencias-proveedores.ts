import { z } from "zod";

export const MOTIVOS_INCIDENCIA = [
  "No generó su cita",
  "Cita tardía",
  "Por límite cubierto",
  "Reprogramación",
] as const;

/** Motivo que se registra solo al guardar el Dashboard de citas. */
export const MOTIVO_SIN_CITA: MotivoIncidencia = "No generó su cita";

export const ESTADOS_INCIDENCIA = [
  "Pendiente",
  "En Proceso",
  "Resuelta",
] as const;

export type MotivoIncidencia = (typeof MOTIVOS_INCIDENCIA)[number];
export type EstadoIncidencia = (typeof ESTADOS_INCIDENCIA)[number];

export type IncidenciaProveedor = {
  id: string;
  fecha: string; // YYYY-MM-DD
  proveedor: string;
  motivo: MotivoIncidencia;
  observaciones: string;
  estado: EstadoIncidencia;
  fechaResolucion: string | null; // ISO
  /** "dashboard" si se generó al guardar el Dashboard de citas. */
  origen?: "manual" | "dashboard";
};

export const incidenciaSchema = z.object({
  fecha: z.string().min(1, "Selecciona la fecha de la incidencia."),
  proveedor: z.string().trim().min(1, "Ingresa el nombre del proveedor."),
  motivo: z.enum(MOTIVOS_INCIDENCIA),
  // Opcional: las incidencias creadas por el Dashboard se registran sin observaciones.
  observaciones: z.string().trim().max(500, "Máximo 500 caracteres."),
  estado: z.enum(ESTADOS_INCIDENCIA),
});

export type IncidenciaFormValues = z.infer<typeof incidenciaSchema>;

export const LS_INCIDENCIAS_KEY = "portal-proveedores:incidencias-proveedores";

const incidenciaGuardadaSchema = incidenciaSchema.extend({
  id: z.string(),
  fechaResolucion: z.string().nullable(),
  origen: z.enum(["manual", "dashboard"]).optional(),
});

function generarId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cargarIncidencias(): IncidenciaProveedor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_INCIDENCIAS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const incidencias: IncidenciaProveedor[] = [];
    for (const item of parsed) {
      const resultado = incidenciaGuardadaSchema.safeParse(item);
      if (!resultado.success) continue;
      // Las automáticas antiguas traían un texto fijo en observaciones: se deja vacío.
      const inc = resultado.data;
      if (inc.origen === "dashboard" && inc.observaciones.startsWith("Registrada al guardar el Dashboard")) {
        inc.observaciones = "";
      }
      incidencias.push(inc);
    }
    return incidencias;
  } catch {
    return [];
  }
}

export function guardarIncidencias(incidencias: IncidenciaProveedor[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_INCIDENCIAS_KEY, JSON.stringify(incidencias));
}

export function crearIncidencia(
  values: IncidenciaFormValues,
  existente?: IncidenciaProveedor | null
): IncidenciaProveedor {
  const resuelta = values.estado === "Resuelta";
  return {
    id: existente?.id ?? generarId(),
    fecha: values.fecha,
    proveedor: values.proveedor.trim(),
    motivo: values.motivo,
    observaciones: values.observaciones.trim(),
    estado: values.estado,
    fechaResolucion: resuelta
      ? (existente?.fechaResolucion ?? new Date().toISOString())
      : null,
    origen: existente?.origen ?? "manual",
  };
}

/** Alerta crítica: lleva 1 día o más sin resolverse. */
export function esCritica(
  incidencia: IncidenciaProveedor,
  ahora: Date = new Date()
): boolean {
  return incidencia.estado !== "Resuelta" && diasTranscurridos(incidencia, ahora) >= 1;
}

function claveProveedor(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

/**
 * Registra "No generó su cita" para los proveedores de la Agenda sin cita en el IKF.
 * Se llama al guardar el Dashboard de citas. No duplica: si ya existe una
 * incidencia del mismo proveedor, fecha y motivo, no se vuelve a crear.
 * Devuelve cuántas incidencias nuevas se registraron.
 */
export function registrarIncidenciasSinCita(
  proveedores: string[],
  fecha: string
): number {
  const actuales = cargarIncidencias();
  const existentes = new Set(
    actuales
      .filter((i) => i.fecha === fecha && i.motivo === MOTIVO_SIN_CITA)
      .map((i) => claveProveedor(i.proveedor))
  );

  const nuevas: IncidenciaProveedor[] = [];
  for (const proveedor of proveedores) {
    const clave = claveProveedor(proveedor);
    if (!clave || existentes.has(clave)) continue;
    existentes.add(clave);
    nuevas.push({
      id: generarId(),
      fecha,
      proveedor: proveedor.trim(),
      motivo: MOTIVO_SIN_CITA,
      observaciones: "",
      estado: "Pendiente",
      fechaResolucion: null,
      origen: "dashboard",
    });
  }

  if (nuevas.length > 0) guardarIncidencias([...nuevas, ...actuales]);
  return nuevas.length;
}

export function diasTranscurridos(
  incidencia: IncidenciaProveedor,
  ahora: Date = new Date()
): number {
  const inicio = new Date(`${incidencia.fecha}T00:00:00`);
  if (Number.isNaN(inicio.getTime())) return 0;
  const fin =
    incidencia.estado === "Resuelta" && incidencia.fechaResolucion
      ? new Date(incidencia.fechaResolucion)
      : ahora;
  if (Number.isNaN(fin.getTime())) return 0;
  return Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 86400000));
}

export function textoTranscurrido(
  incidencia: IncidenciaProveedor,
  ahora: Date = new Date()
): string {
  const dias = diasTranscurridos(incidencia, ahora);
  if (dias === 0) return "Mismo día";
  return `${dias} día${dias === 1 ? "" : "s"}`;
}

export function formatearFecha(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
