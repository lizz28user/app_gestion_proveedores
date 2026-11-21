export type ReceptionStatus = "avance" | "finalizada";

export type ReceptionResult =
  | "sin-rechazo"
  | "rechazo-parcial"
  | "rechazo-total";

export type Incidencia = {
  id: string;
  tipo: string;
  ocSku: string;
  cantidadAfectada: number;
  descripcion: string;
  evidencia: string | null;
};

export type Reception = {
  id: string;
  arrivalKey: string;
  ruc: string;
  proveedor: string;
  fecha: string;
  horaSolicitada: string;
  horaLlegada: string;
  unidadesEstimadas?: string;
  estadoLlegada?: string;
  conductor: string;
  licencia: string;
  placa: string;
  homologacion: string;
  puerta: string | null;
  operarioResponsable: string | null;
  /** Hora en que empezó la descarga (botón "Inicio de descarga"). */
  horaInicioDescarga?: string | null;
  /** Hora en que terminó la descarga (botón "Fin de descarga"). */
  horaFin: string | null;
  /** true: presenta incidencias · false: no presenta · null/undefined: sin responder. */
  presentaIncidencias?: boolean | null;
  estado: ReceptionStatus;
  createdAt: string;
  updatedAt: string;
  incidencias: Incidencia[];
  resultado: ReceptionResult | null;
  aceptadas: number;
  rechazadas: number;
  evaluadas: number;
};

export type NaveId = "nave1" | "nave2";

export type Nave = {
  id: NaveId;
  nombre: string;
  /** Primera y última puerta de la nave (la numeración sigue de una nave a la otra). */
  desde: number;
  hasta: number;
};

export const NAVES: Nave[] = [
  { id: "nave1", nombre: "Nave 1", desde: 1, hasta: 34 },
  { id: "nave2", nombre: "Nave 2", desde: 35, hasta: 60 },
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Puertas de una nave: P01…P34 en la Nave 1 y P35…P60 en la Nave 2. */
export function puertasDeNave(nave: Nave): string[] {
  return Array.from({ length: nave.hasta - nave.desde + 1 }, (_, i) => `P${pad2(nave.desde + i)}`);
}

/** Número de una puerta ("P35" → 35). */
export function numeroDePuerta(puerta: string): number {
  return Number(puerta.replace(/\D/g, ""));
}

/** Puertas 2 a 12 (Nave 1): inactivas por el momento (temporal). */
export function puertaInactiva(puerta: string): boolean {
  const n = numeroDePuerta(puerta);
  return n >= 2 && n <= 12;
}

export const PUERTAS = NAVES.flatMap(puertasDeNave);

/** "P35 · Nave 2" */
export function etiquetaPuerta(puerta: string): string {
  const n = numeroDePuerta(puerta);
  const nave = NAVES.find((x) => n >= x.desde && n <= x.hasta);
  return nave ? `${puerta} · ${nave.nombre}` : puerta;
}

/** Puertas que se pueden asignar a una recepción (excluye las inactivas). */
export const PUERTAS_ASIGNABLES = PUERTAS.filter((p) => !puertaInactiva(p));

export const OPERARIOS = [
  "Operario 1", "Operario 2", "Operario 3", "Operario 4", "Operario 5",
  "Operario 6", "Operario 7", "Operario 8", "Operario 9", "Operario 10",
];

export const TIPOS_INCIDENCIA = [
  "Daño de empaque",
  "Producto vencido",
  "Falta de unidades",
  "Producto incorrecto",
  "Etiquetado erróneo",
  "Otro",
];

export const RECEPTION_STATUS_CLASSES: Record<ReceptionStatus, string> = {
  avance:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  finalizada:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export const RECEPTION_STATUS_ICONS: Record<ReceptionStatus, string> = {
  avance: "↻",
  finalizada: "✓",
};

export const RESULT_CLASSES: Record<ReceptionResult, string> = {
  "sin-rechazo": "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  "rechazo-parcial": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "rechazo-total": "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

export const RESULT_LABELS: Record<ReceptionResult, string> = {
  "sin-rechazo": "Sin rechazo",
  "rechazo-parcial": "Rechazo parcial",
  "rechazo-total": "Rechazo total",
};

export const RECEPTION_STATUS_LABELS: Record<ReceptionStatus, string> = {
  avance: "Procesando",
  finalizada: "Finalizada",
};

export const PENDIENTE_LABEL = "Pendiente";
