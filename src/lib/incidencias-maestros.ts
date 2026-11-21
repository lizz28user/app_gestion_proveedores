import { z } from "zod";

/** Incidencias de datos maestros: errores de un producto en ERP/SAP (EAN, descripción…). */
export const ESTADOS_INCIDENCIA_MAESTRO = ["Pendiente", "En Proceso", "Resuelta"] as const;
export type EstadoIncidenciaMaestro = (typeof ESTADOS_INCIDENCIA_MAESTRO)[number];

/** Motivos sugeridos (el usuario puede escribir otro). */
export const MOTIVOS_SUGERIDOS = [
  "Error de EAN",
  "Descripción incorrecta",
  "MP incorrecto",
  "Unidades por pallet incorrectas",
  "Carga Titan incorrecta",
  "Producto duplicado",
] as const;

export type IncidenciaMaestro = {
  id: string;
  fechaRegistro: string; // ISO con hora
  sku: string;
  descripcion: string;
  motivo: string;
  estado: EstadoIncidenciaMaestro;
  fechaResolucion: string | null; // ISO
  registradoPor: string;
};

export const incidenciaMaestroSchema = z.object({
  sku: z.string().trim().min(1, "Ingresa el SKU."),
  motivo: z.string().trim().min(3, "Describe el motivo del error."),
  estado: z.enum(ESTADOS_INCIDENCIA_MAESTRO),
});

export type IncidenciaMaestroForm = z.infer<typeof incidenciaMaestroSchema>;

const LS_KEY = "portal-proveedores:incidencias-maestros";

const guardadaSchema = z.object({
  id: z.string(),
  fechaRegistro: z.string(),
  sku: z.string(),
  descripcion: z.string(),
  motivo: z.string(),
  estado: z.enum(ESTADOS_INCIDENCIA_MAESTRO),
  fechaResolucion: z.string().nullable(),
  registradoPor: z.string().default(""),
});

export function cargarIncidenciasMaestro(): IncidenciaMaestro[] {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const lista: unknown = JSON.parse(raw);
    if (!Array.isArray(lista)) return [];
    return lista.flatMap((item) => {
      const r = guardadaSchema.safeParse(item);
      return r.success ? [r.data] : [];
    });
  } catch {
    return [];
  }
}

export function guardarIncidenciasMaestro(lista: IncidenciaMaestro[]): void {
  window.localStorage.setItem(LS_KEY, JSON.stringify(lista));
}

export function generarId(prefijo: string): string {
  const aleatorio =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefijo}-${Date.now().toString(36)}-${aleatorio}`;
}

/** Días completos desde el registro hasta hoy (o hasta la resolución). */
export function diasTranscurridos(incidencia: IncidenciaMaestro, ahora: Date = new Date()): number {
  const inicio = new Date(incidencia.fechaRegistro).getTime();
  const fin =
    incidencia.estado === "Resuelta" && incidencia.fechaResolucion
      ? new Date(incidencia.fechaResolucion).getTime()
      : ahora.getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return 0;
  return Math.max(0, Math.floor((fin - inicio) / 86_400_000));
}

/** Crítica: lleva 1 día o más sin resolverse. */
export function esCritica(incidencia: IncidenciaMaestro, ahora: Date = new Date()): boolean {
  return incidencia.estado !== "Resuelta" && diasTranscurridos(incidencia, ahora) >= 1;
}
