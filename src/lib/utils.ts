export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Fecha local como yyyy-mm-dd (sin desfase de zona horaria). */
export function isoLocal(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mes}-${dia}`;
}

export function todayIso() {
  return isoLocal(new Date());
}

export function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
}

export function computeArrivalStatus(
  llegada: string,
  solicitada: string,
): "Puntual" | "Tardanza" | "Anticipado" {
  const diff = toMinutes(llegada) - toMinutes(solicitada);

  if (diff < 0) {
    return "Anticipado";
  }

  if (diff <= 15) {
    return "Puntual";
  }

  return "Tardanza";
}

export function normalizeArrivalStatus(
  value: string | undefined,
): "Puntual" | "Tardanza" | "Anticipado" {
  if (value === "Puntual" || value === "Tardanza" || value === "Anticipado") {
    return value;
  }
  return "Puntual";
}

export function normalizeStatus(
  value: string,
): "Vigente" | "Vencida" | "No homologado" {
  if (value === "Vigente" || value === "Vencida" || value === "No homologado") {
    return value;
  }
  return "No homologado";
}

export const ARRIVAL_STATUS_CLASSES: Record<string, string> = {
  Puntual:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Tardanza:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Anticipado: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
};

export function getArrivalStatusBadge(
  llegada: string | undefined,
  solicitada: string | undefined,
): { status: string; className: string } {
  if (!llegada || !solicitada) {
    return { status: "Pendiente", className: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" };
  }

  const status = computeArrivalStatus(llegada, solicitada);
  return {
    status,
    className: ARRIVAL_STATUS_CLASSES[status] ?? ARRIVAL_STATUS_CLASSES.Puntual,
  };
}
