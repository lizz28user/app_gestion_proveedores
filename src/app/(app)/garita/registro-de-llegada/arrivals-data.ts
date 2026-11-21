export type HomologationStatus = "Vigente" | "Vencida" | "No homologado";

export type ArrivalStatus = "Puntual" | "Tardanza" | "Anticipado";

export type Arrival = {
  ruc: string;
  proveedor: string;
  fecha: string;
  horaSolicitada: string;
  unidadesEstimadas: string;
  llegada: string;
  estadoLlegada: ArrivalStatus;
  conductor: string;
  licencia: string;
  placa: string;
  homologacion: HomologationStatus;
};

export type ArrivalRow = {
  ruc: string;
  proveedor: string;
  fecha?: string;
  horaSolicitada: string;
  unidadesEstimadas?: string;
  llegada?: string;
  estadoLlegada?: ArrivalStatus;
  conductor?: string;
  licencia?: string;
  placa?: string;
  homologacion?: HomologationStatus;
};

export const HOMOLOGATION_OPTIONS: HomologationStatus[] = [
  "Vigente",
  "Vencida",
  "No homologado",
];

export const ARRIVAL_STATUS_OPTIONS: ArrivalStatus[] = [
  "Puntual",
  "Tardanza",
  "Anticipado",
];

export const EXTRA_ARRIVALS_STORAGE_KEY = "portal-proveedores:llegadas-extra";
