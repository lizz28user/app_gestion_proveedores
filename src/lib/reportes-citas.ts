import { z } from "zod";
import type { DashboardGuardado } from "./dashboard-history";
import { isoLocal } from "./utils";

/* ═══════════════ Top de proveedores ═══════════════
 * Fuente: los dashboards guardados en el Dashboard de citas.
 * - Si hay varios guardados del mismo día, se usa el más reciente.
 * - Se agrupa por proveedor (por día o por semana) contando citas únicas.
 * - Regla estricta: solo proveedores con MÁS de 1 cita en el periodo.
 * - Orden: de mayor a menor cantidad de citas (empate: alfabético).
 */

export type Periodo = "dia" | "semana";

export type FilaTop = {
  clave: string;
  proveedor: string;
  citas: number;
  unidades: number;
  dias: number; // días del periodo en que tuvo citas
};

export type OpcionPeriodo = { clave: string; etiqueta: string; dias: string[] };

type DiaCitas = Map<string, { proveedor: string; citas: Set<string>; unidades: number }>;

/** Fecha de las citas de un dashboard guardado (yyyy-mm-dd). */
export function fechaDeDashboard(d: DashboardGuardado): string {
  return (d.fechaCitas ?? d.resultado.fechaProceso ?? d.guardadoEn).slice(0, 10);
}

/** Un dashboard por día: el guardado más reciente de cada fecha de citas. */
export function dashboardsPorDia(dashboards: DashboardGuardado[]): Map<string, DashboardGuardado> {
  const porDia = new Map<string, DashboardGuardado>();
  for (const d of dashboards) {
    const fecha = fechaDeDashboard(d);
    const actual = porDia.get(fecha);
    if (!actual || d.guardadoEn > actual.guardadoEn) porDia.set(fecha, d);
  }
  return porDia;
}

function citasDelDia(d: DashboardGuardado, fecha: string): DiaCitas {
  const mapa: DiaCitas = new Map();
  if (d.citasPorProveedor && d.citasPorProveedor.length > 0) {
    for (const p of d.citasPorProveedor) {
      mapa.set(p.clave, {
        proveedor: p.proveedor,
        citas: new Set(p.citas.map((c) => `${fecha}|${c}`)),
        unidades: p.unidades,
      });
    }
    return mapa;
  }
  // Guardados antiguos: solo traen el ranking del día (proveedores con más de 1 cita).
  for (const r of d.resultado.proveedoresRanking) {
    mapa.set(r.proveedorNormalizado, {
      proveedor: r.proveedor,
      citas: new Set(Array.from({ length: r.citasDistintas }, (_, i) => `${fecha}|${i}`)),
      unidades: r.unidadesEstimadas,
    });
  }
  return mapa;
}

/** Lunes de la semana de una fecha (yyyy-mm-dd). */
export function inicioSemana(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`);
  const dia = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - dia);
  return isoLocal(d);
}

function corta(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}

/** Periodos disponibles (días o semanas) con dashboards guardados, del más reciente al más antiguo. */
export function periodosDisponibles(dashboards: DashboardGuardado[], periodo: Periodo): OpcionPeriodo[] {
  const dias = [...dashboardsPorDia(dashboards).keys()].sort().reverse();
  if (periodo === "dia") {
    return dias.map((dia) => {
      const nombre = new Date(`${dia}T12:00:00`).toLocaleDateString("es-PE", { weekday: "long" });
      return { clave: dia, etiqueta: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${corta(dia)}`, dias: [dia] };
    });
  }
  const semanas = new Map<string, string[]>();
  for (const dia of dias) {
    const lunes = inicioSemana(dia);
    semanas.set(lunes, [...(semanas.get(lunes) ?? []), dia]);
  }
  return [...semanas.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([lunes, diasSemana]) => {
      const domingo = new Date(`${lunes}T12:00:00`);
      domingo.setDate(domingo.getDate() + 6);
      return {
        clave: lunes,
        etiqueta: `Semana del ${corta(lunes)} al ${corta(isoLocal(domingo))} · ${diasSemana.length} día${diasSemana.length === 1 ? "" : "s"}`,
        dias: diasSemana.sort(),
      };
    });
}

/** Ranking del periodo: proveedores con más de 1 cita, de mayor a menor. */
export function construirTop(dashboards: DashboardGuardado[], dias: string[]): FilaTop[] {
  const porDia = dashboardsPorDia(dashboards);
  const acumulado = new Map<string, { proveedor: string; citas: Set<string>; unidades: number; dias: Set<string> }>();

  for (const dia of dias) {
    const d = porDia.get(dia);
    if (!d) continue;
    for (const [clave, info] of citasDelDia(d, dia)) {
      const actual = acumulado.get(clave) ?? { proveedor: info.proveedor, citas: new Set<string>(), unidades: 0, dias: new Set<string>() };
      info.citas.forEach((c) => actual.citas.add(c));
      actual.unidades += info.unidades;
      actual.dias.add(dia);
      acumulado.set(clave, actual);
    }
  }

  return [...acumulado.entries()]
    .map(([clave, a]) => ({ clave, proveedor: a.proveedor, citas: a.citas.size, unidades: Math.round(a.unidades), dias: a.dias.size }))
    .filter((f) => f.citas > 1)
    .sort((a, b) => b.citas - a.citas || a.proveedor.localeCompare(b.proveedor));
}

/* ═══════════════ Reportes de recepción ═══════════════ */

export const TIPOS_REPORTE = [
  "Faltante de mercadería",
  "Mercadería dañada",
  "Exceso de mercadería",
  "Producto incorrecto",
  "Vencimiento corto",
  "Documentación incompleta",
  "Otro",
] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export const ESTADOS_REPORTE = ["Pendiente", "En Proceso", "Resuelta"] as const;
export type EstadoReporte = (typeof ESTADOS_REPORTE)[number];

export type ReporteRecepcion = {
  id: string;
  fechaRegistro: string; // ISO
  fechaCita: string; // yyyy-mm-dd
  proveedor: string;
  tipo: TipoReporte;
  descripcion: string;
  estado: EstadoReporte;
  fechaResolucion: string | null;
};

export const reporteSchema = z.object({
  fechaCita: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona la fecha de la cita."),
  proveedor: z.string().trim().min(2, "Ingresa el proveedor."),
  tipo: z.enum(TIPOS_REPORTE),
  descripcion: z.string().trim().min(5, "Describe lo ocurrido (mínimo 5 caracteres)."),
  estado: z.enum(ESTADOS_REPORTE),
});
export type ReporteForm = z.infer<typeof reporteSchema>;

const LS_REPORTES = "portal-proveedores:reportes-recepcion";

export function cargarReportes(): ReporteRecepcion[] {
  try {
    const raw = window.localStorage.getItem(LS_REPORTES);
    const lista: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? (lista as ReporteRecepcion[]).filter((r) => r && typeof r.id === "string") : [];
  } catch {
    return [];
  }
}

export function guardarReportes(lista: ReporteRecepcion[]): void {
  window.localStorage.setItem(LS_REPORTES, JSON.stringify(lista));
}

/** Días completos desde el registro hasta hoy (o hasta la resolución). */
export function diasReporte(r: ReporteRecepcion, ahora: Date = new Date()): number {
  const inicio = new Date(r.fechaRegistro).getTime();
  const fin = r.estado === "Resuelta" && r.fechaResolucion ? new Date(r.fechaResolucion).getTime() : ahora.getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return 0;
  return Math.max(0, Math.floor((fin - inicio) / 86_400_000));
}

export function reporteCritico(r: ReporteRecepcion, ahora: Date = new Date()): boolean {
  return r.estado !== "Resuelta" && diasReporte(r, ahora) >= 1;
}
