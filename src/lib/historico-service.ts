import type { Arrival } from "@/app/(app)/garita/registro-de-llegada/arrivals-data";

/**
 * Histórico de llegadas guardado en el navegador (localStorage).
 * Mantiene la misma interfaz que tenía el servicio anterior.
 */
export const HISTORICO_STORAGE_KEY = "llegadas-historico";

export type HistoricoArrival = Arrival & {
  id: string;
  /** Fecha y hora de guardado (ISO). */
  createdAt: string;
};

function leer(): HistoricoArrival[] {
  try {
    const raw = window.localStorage.getItem(HISTORICO_STORAGE_KEY);
    const lista: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? (lista as HistoricoArrival[]) : [];
  } catch {
    return [];
  }
}

function escribir(lista: HistoricoArrival[]): void {
  window.localStorage.setItem(HISTORICO_STORAGE_KEY, JSON.stringify(lista));
}

export async function guardarLlegadaHistorico(arrival: Arrival): Promise<string> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  escribir([...leer(), { ...arrival, id, createdAt: new Date().toISOString() }]);
  return id;
}

/** Borra un registro del histórico (solo Supervisor y Administrador lo ven en pantalla). */
export async function eliminarLlegadaHistorico(id: string): Promise<void> {
  escribir(leer().filter((item) => item.id !== id));
}

export async function obtenerLlegadasHistorico({
  fechaDesde,
  fechaHasta,
  ruc,
  estadoLlegada,
}: {
  fechaDesde?: string;
  fechaHasta?: string;
  ruc?: string;
  estadoLlegada?: string;
}): Promise<HistoricoArrival[]> {
  return leer()
    .filter((item) => {
      if (fechaDesde && !(item.fecha >= fechaDesde)) return false;
      if (fechaHasta && !(item.fecha <= fechaHasta)) return false;
      if (ruc && item.ruc !== ruc) return false;
      if (estadoLlegada && item.estadoLlegada !== estadoLlegada) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
