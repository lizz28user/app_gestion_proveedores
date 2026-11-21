/**
 * Extrae la fecha de la agenda desde el nombre del archivo.
 *
 * Formatos aceptados (con o sin texto alrededor, p. ej. "Agenda-14.11.xlsx",
 * "Agenda CD40 14.11 xlsx.xlsx", "Agenda-14-11-2026.xlsx", "Agenda_2026-11-14.xlsx"):
 *   - aaaa-mm-dd · aaaa_mm_dd · aaaa.mm.dd
 *   - dd-mm-aaaa · dd.mm.aaaa · dd_mm_aaaa · dd/mm/aaaa · dd-mm-aa
 *   - ddmmaaaa (8 dígitos seguidos, como en el reporte IKF)
 *   - dd.mm · dd-mm · dd_mm (sin año: se usa el año más cercano a hoy)
 *
 * Devuelve la fecha en formato aaaa-mm-dd, o null si no se encontró una fecha válida.
 */
export function fechaDesdeNombreArchivo(nombre: string, hoy: Date = new Date()): string | null {
  // Sin extensión(es) y sin la palabra "xlsx" suelta que a veces queda en el nombre.
  const base = nombre
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/\b(xlsx|xls|csv)\b/gi, " ");

  const intentos: Array<() => string | null> = [
    // aaaa-mm-dd
    () => {
      const m = base.match(/(?<!\d)(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/);
      return m ? armar(+m[1], +m[2], +m[3]) : null;
    },
    // dd-mm-aaaa / dd-mm-aa
    () => {
      const m = base.match(/(?<!\d)(\d{1,2})[-_./](\d{1,2})[-_./](\d{4}|\d{2})(?!\d)/);
      if (!m) return null;
      const anio = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      return armar(anio, +m[2], +m[1]);
    },
    // ddmmaaaa
    () => {
      const m = base.match(/(?<!\d)(\d{2})(\d{2})(20\d{2})(?!\d)/);
      return m ? armar(+m[3], +m[2], +m[1]) : null;
    },
    // dd.mm sin año
    () => {
      const m = base.match(/(?<!\d)(\d{1,2})[-_./](\d{1,2})(?![-_./]?\d)/);
      if (!m) return null;
      const dia = +m[1];
      const mes = +m[2];
      // Año más cercano a hoy (sirve en cambio de año: "02.01" cargado el 30/12).
      const candidatos = [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1]
        .map((anio) => armar(anio, mes, dia))
        .filter((f): f is string => f !== null);
      if (candidatos.length === 0) return null;
      return candidatos.sort(
        (a, b) => Math.abs(Date.parse(a) - hoy.getTime()) - Math.abs(Date.parse(b) - hoy.getTime()),
      )[0];
    },
  ];

  for (const intento of intentos) {
    const fecha = intento();
    if (fecha) return fecha;
  }
  return null;
}

/** Arma aaaa-mm-dd validando que la fecha exista (sin 31/02, etc.). */
function armar(anio: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 2000 || anio > 2100) return null;
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** "2026-11-14" → "sábado 14/11/2026" */
export function formatearFechaAgenda(iso: string | null | undefined): string {
  if (!iso) return "";
  const fecha = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dia = fecha.toLocaleDateString("es-PE", { weekday: "long" });
  const corta = fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${dia} ${corta}`;
}
