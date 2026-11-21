export type ScheduledArrival = {
  ruc: string;
  proveedor: string;
  horaSolicitada: string;
  unidadesEstimadas: string;
};

// Datos de EJEMPLO. En produccion, esta lista se genera desde el reporte IKF
// de citas (GARITA/IKF Reporte Citas B2B ...xls), que no se sube al repositorio.
export const SCHEDULE_DATE = "2026-11-07";

export const SCHEDULED_ARRIVALS: ScheduledArrival[] = [
  { ruc: "20000000011", proveedor: "LABORATORIO EJEMPLO UNO S.A.C.", horaSolicitada: "07:00", unidadesEstimadas: "12000" },
  { ruc: "20000000022", proveedor: "DISTRIBUIDORA EJEMPLO DOS S.A.", horaSolicitada: "08:00", unidadesEstimadas: "4500" },
  { ruc: "20000000033", proveedor: "FARMA EJEMPLO TRES S.R.L.", horaSolicitada: "09:00", unidadesEstimadas: "800" },
];