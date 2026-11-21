import type { Reception } from "./types";

export const RECEPCIONES_STORAGE_KEY = "portal-proveedores:recepciones";

export function loadRecepciones(): Reception[] {
  try {
    const raw = window.localStorage.getItem(RECEPCIONES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let reparado = false;
    const lista = (parsed as Reception[]).map((recepcion) => {
      const aceptadas = toSafeNumber(recepcion.aceptadas);
      const rechazadas = toSafeNumber(recepcion.rechazadas);
      const evaluadas = toSafeNumber(recepcion.evaluadas);
      const incidencias = Array.isArray(recepcion.incidencias)
        ? recepcion.incidencias
        : [];

      if (
        aceptadas !== recepcion.aceptadas ||
        rechazadas !== recepcion.rechazadas ||
        evaluadas !== recepcion.evaluadas ||
        incidencias !== recepcion.incidencias
      ) {
        reparado = true;
      }

      return { ...recepcion, aceptadas, rechazadas, evaluadas, incidencias };
    });

    if (reparado) saveRecepciones(lista);
    return lista;
  } catch {
    return [];
  }
}

export function saveRecepciones(lista: Reception[]): void {
  try {
    window.localStorage.setItem(RECEPCIONES_STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // Ignorar errores de almacenamiento.
  }
}

/** Borra la recepción vinculada a una llegada (mismo RUC, hora de cita y fecha). */
export function eliminarRecepcionDeLlegada(ruc: string, horaSolicitada: string, fecha: string): void {
  const lista = loadRecepciones();
  const restantes = lista.filter(
    (r) => !(r.ruc === ruc && r.horaSolicitada === horaSolicitada && (!r.fecha || r.fecha === fecha)),
  );
  if (restantes.length !== lista.length) saveRecepciones(restantes);
}

/**
 * Borra los datos de una recepción (puerta, operario, incidencias y resultado)
 * y la deja otra vez como pendiente. La llegada sigue registrada.
 */
export function reiniciarRecepcion(recepcion: Reception): Reception {
  return {
    ...recepcion,
    puerta: null,
    operarioResponsable: null,
    horaInicioDescarga: null,
    horaFin: null,
    presentaIncidencias: null,
    estado: "avance",
    incidencias: [],
    resultado: null,
    aceptadas: 0,
    rechazadas: 0,
    evaluadas: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Normaliza un valor desconocido a número seguro.
 * Sirve para reparar registros antiguos con datos corruptos.
 */
export function toSafeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
