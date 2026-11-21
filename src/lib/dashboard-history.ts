import type { ResultadoCruce } from "./agenda-cruce";
import type { CitasProveedor } from "./citas-del-dia";

const LS_DASHBOARDS_KEY = "portal-proveedores:dashboards-guardados";

export type DashboardGuardado = {
  id: string;
  guardadoEn: string; // ISO
  resultado: ResultadoCruce;
  /** Fecha de las citas del Reporte IKF (yyyy-mm-dd). Ausente en guardados antiguos. */
  fechaCitas?: string | null;
  /** Citas únicas por proveedor del Reporte IKF. Ausente en guardados antiguos. */
  citasPorProveedor?: CitasProveedor[];
};

export type DatosExtraDashboard = {
  fechaCitas: string | null;
  citasPorProveedor: CitasProveedor[];
};

function generarId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function esDashboardGuardado(value: unknown): value is DashboardGuardado {
  if (typeof value !== "object" || value === null) return false;
  const registro = value as Record<string, unknown>;
  if (typeof registro.id !== "string") return false;
  if (typeof registro.guardadoEn !== "string") return false;
  if (typeof registro.resultado !== "object" || registro.resultado === null) {
    return false;
  }
  const resultado = registro.resultado as Record<string, unknown>;
  return (
    typeof resultado.fechaProceso === "string" &&
    typeof resultado.totalCitasDistintas === "number" &&
    typeof resultado.proveedoresSinCita === "number" &&
    Array.isArray(resultado.proveedoresAgenda) &&
    Array.isArray(resultado.proveedoresRanking)
  );
}

export function cargarDashboards(): DashboardGuardado[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_DASHBOARDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(esDashboardGuardado)
      .sort((a, b) => b.guardadoEn.localeCompare(a.guardadoEn));
  } catch {
    return [];
  }
}

export function guardarDashboard(
  resultado: ResultadoCruce,
  extra?: DatosExtraDashboard,
): DashboardGuardado {
  if (typeof window === "undefined") {
    throw new Error("No se puede guardar el dashboard sin acceso al almacenamiento.");
  }

  const entrada: DashboardGuardado = {
    id: generarId(),
    guardadoEn: new Date().toISOString(),
    resultado,
    fechaCitas: extra?.fechaCitas ?? null,
    citasPorProveedor: extra?.citasPorProveedor ?? [],
  };

  const actuales = cargarDashboards();
  window.localStorage.setItem(
    LS_DASHBOARDS_KEY,
    JSON.stringify([entrada, ...actuales])
  );

  return entrada;
}

export function eliminarDashboard(id: string): DashboardGuardado[] {
  const restantes = cargarDashboards().filter((item) => item.id !== id);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LS_DASHBOARDS_KEY, JSON.stringify(restantes));
  }
  return restantes;
}

export function formatearFechaGuardado(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatearFechaCorta(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
