"use client";

import * as XLSX from "xlsx";

/**
 * Motor de cruce interno: Agenda × Reporte de Citas × Maestro de Proveedores
 *
 * Lee los 3 archivos cargados por el usuario, normaliza nombres, cruza por
 * RUC (resuelto vía Maestro) y calcula indicadores LPN según el alcance.
 *
 * No hardcodea nombres de proveedores ni números de ejemplo: todo viene de
 * los archivos cargados.
 */

// ============================================================================
// 1. NORMALIZACIÓN DE NOMBRES
// ============================================================================

/**
 * Normaliza un nombre de proveedor para cruce:
 * - Mayúsculas
 * - Sin tildes/diacríticos
 * - & → espacio
 * - Sufijos societarios eliminados: S.A.C., S.A., S.R.L., SAC, SA, SRL, E.I.R.L., EIRL, S.A.S., S.C.E.
 * - Puntos, guiones, símbolos → espacio
 * - Espacios múltiples colapsados a uno
 * - Resultado trim
 */
export function normalizarNombre(nombre: string | undefined | null): string {
  if (!nombre) return "";
  let s = String(nombre).toUpperCase().trim();

  // Eliminar tildes/diacríticos
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Reemplazar & por espacio
  s = s.replace(/&/g, " ");

  // Eliminar sufijos societarios (con y sin puntos, con y sin espacios)
  const sufijos = [
    "S\\.?\\s*A\\.?\\s*C\\.?",   // S.A.C., S.A.C, SAC, S A C
    "S\\.?\\s*A\\.?",            // S.A., S.A, SA, S A
    "S\\.?\\s*R\\.?\\s*L\\.?",   // S.R.L., S.R.L, SRL, S R L
    "E\\.?\\s*I\\.?\\s*R\\.?\\s*L\\.?", // E.I.R.L., EIRL
    "EIRL",
    "S\\.?\\s*A\\.?\\s*S\\.?",   // S.A.S.
    "S\\.?\\s*C\\.?\\s*E\\.?",   // S.C.E.
    "S\\.?\\s*A\\.?\\s*C\\s*$",  // S.A.C al final sin punto
    "S\\.?\\s*A\\s*$",           // S.A al final sin punto
  ];
  for (const suf of sufijos) {
    const regex = new RegExp(`\\b${suf}\\b`, "g");
    s = s.replace(regex, " ");
  }

  // Eliminar puntos, guiones, símbolos sueltos
  s = s.replace(/[._-]/g, " ");

  // Colapsar espacios múltiples y trim
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Normaliza un número de cita para tratarlo como clave única:
 * - Trim
 * - Elimina ceros a la izquierda ("0123" → "123")
 * - Elimina decimales innecesarios ("123.0" → "123")
 */
export function normalizarNumeroCita(cita: string | number | null | undefined): string {
  if (cita == null) return "";
  return String(cita)
    .trim()
    .replace(/^0+(\d)/, "$1")
    .replace(/\.0+$/, "");
}

/**
 * Parsea un valor numérico desde texto. Devuelve 0 si no es parseable.
 */
export function parseNumeroSeguro(valor: unknown): number {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const s = String(valor).replace(/[^\d,\.-]/g, "").replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// ============================================================================
// 2. LECTURA DE ARCHIVOS EXCEL
// ============================================================================

export type FilaExcel = Record<string, unknown>;

/**
 * Normaliza el nombre de una columna para compararlo sin importar
 * mayúsculas, tildes ni espacios repetidos.
 */
export function normalizarClaveColumna(clave: string): string {
  return clave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Lee el primer campo disponible de una fila probando varios alias de columna.
 */
function obtenerCampo(fila: FilaExcel, ...alias: string[]): unknown {
  for (const nombre of alias) {
    const clave = normalizarClaveColumna(nombre);
    if (clave in fila) return fila[clave];
  }
  return undefined;
}

/**
 * Lee un archivo Excel (xls/xlsx/csv) y devuelve las filas como array de objetos.
 * Detecta automáticamente la fila de encabezados buscando una palabra clave.
 */
export async function leerExcelArchivo(
  file: File,
  opciones?: {
    palabraClaveEncabezados?: string; // Ej: "CD DESTINO", "NÚMERO DE CITA", "RUC"
    hoja?: number | string;
  }
): Promise<FilaExcel[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: "array" });

        const hojaNombre =
          wb.SheetNames[
            typeof opciones?.hoja === "number" ? opciones.hoja : 0
          ] ?? wb.SheetNames[0];
        const ws = wb.Sheets[hojaNombre!];

        const json = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: true,
        }) as unknown[][];

        if (!json || json.length === 0) {
          resolve([]);
          return;
        }

        // Detectar fila de encabezados por palabra clave
        let filaEnc = 0;
        if (opciones?.palabraClaveEncabezados) {
          const detectada = detectarFilaEncabezados(
            json,
            opciones.palabraClaveEncabezados
          );
          filaEnc = detectada >= 0 ? detectada : 0;
        }

        const encabezados = (json[filaEnc] ?? []) as unknown[];
        const filasDatos = json.slice(filaEnc + 1);

        const resultado: FilaExcel[] = [];
        for (const fila of filasDatos) {
          const obj: FilaExcel = {};
          for (let i = 0; i < encabezados.length; i++) {
            const clave = normalizarClaveColumna(
              String(encabezados[i] ?? `col_${i}`)
            );
            if (clave) {
              obj[clave] = fila?.[i];
            }
          }
          resultado.push(obj);
        }

        resolve(resultado);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Error al leer el archivo"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Detecta la fila de encabezados buscando una palabra clave en cualquiera de sus celdas.
 * Devuelve el índice de fila (base 0) o -1 si no se encuentra.
 */
export function detectarFilaEncabezados(
  filas: unknown[][],
  palabraClave: string
): number {
  const pk = palabraClave.toUpperCase();
  for (let r = 0; r < filas.length; r++) {
    const fila = filas[r] as unknown[];
    for (const celda of fila) {
      if (typeof celda === "string" && celda.toUpperCase().includes(pk)) {
        return r;
      }
    }
  }
  return -1;
}

// ============================================================================
// 3. TIPOS DE DATOS INTERNOS
// ============================================================================

export type FilaAgenda = {
  cdDestino: string;
  proveedorOriginal: string;
  proveedorNormalizado: string;
  ruc: string | null;
  unidSolicitadas: number;
  cantMpsCds: number;
  fr: number | null;
  filaOrigen: number;
};

export type FilaReporteCita = {
  numeroCita: string | number;
  proveedorOriginal: string;
  proveedorNormalizado: string;
  ruc: string | null;
  unidadesEstimadas: number;
  ordenCompra: string | null;
  fechaCita: string | null;
  horaInicio: string | null;
};

export type FilaMaestro = {
  proveedorOriginal: string;
  proveedorNormalizado: string;
  ruc: string;
};

export type ProveedorCruce = {
  proveedorOriginal: string;
  proveedorNormalizado: string;
  ruc: string | null;
  cdDestino: string;
  horaInicio: string | null;
  unidSolicitadas: number;
  cantMpsCds: number;
  fr: number | null;
  ratio: number | null;
  totalUnidadesEstimadas: number;
  numCitasDistintas: number;
  lpns: number | null;
  estado: "valido" | "pendiente" | "ambiguo";
  observaciones: string[];
  citaMatch: string | null;
};

export type RankingProveedor = {
  proveedor: string;
  proveedorNormalizado: string;
  citasDistintas: number;
  unidadesEstimadas: number;
};

export type ResultadoCruce = {
  fechaProceso: string;
  cdSeleccionado: string | null;
  proveedoresAgenda: ProveedorCruce[];
  totalProveedoresAgenda: number;
  proveedoresConCita: number;
  proveedoresSinCita: number;
  totalCitasDistintas: number;
  totalUnidadesEstimadas: number;
  avanceLpns: number;
  avanceLpnsPorcentaje: number;
  capacidadProveedores: number;
  proveedoresRanking: RankingProveedor[];
  rankingVacio: boolean;
  alertaCapacidadLpns: boolean;
  alertaCapacidadProveedores: boolean;
};

// ============================================================================
// 4. CONSTANTES
// ============================================================================

export const TOPE_LPNS = 26000;
export const CAPACIDAD_PROVEEDORES = 72;

// ============================================================================
// 5. LÓGICA DE CRUCE
// ============================================================================

export function ejecutarCruce(
  filasAgenda: FilaExcel[],
  filasReporte: FilaExcel[],
  filasMaestro: FilaExcel[],
  opciones?: {
    columnaAgenda?: {
      cdDestino?: string;
      proveedor?: string;
      ruc?: string;
      unidSolicitadas?: string;
      cantMpsCds?: string;
      fr?: string;
    };
    columnaReporte?: {
      numeroCita?: string;
      proveedor?: string;
      ruc?: string;
      unidadesEstimadas?: string;
      ordenCompra?: string;
      fechaCita?: string;
    };
    columnaMaestro?: {
      proveedor?: string;
      ruc?: string;
    };
    cdFiltro?: string;
  }
): ResultadoCruce {
  const colA = opciones?.columnaAgenda ?? {};
  const colR = opciones?.columnaReporte ?? {};
  const colM = opciones?.columnaMaestro ?? {};

  // ------------------------------------------------------------------
  // 1. Normalizar Agenda (base del cruce)
  // ------------------------------------------------------------------
  const agendaNormalizada: FilaAgenda[] = filasAgenda.map((f, i) => {
    const proveedorOrig = String(
      obtenerCampo(
        f,
        colA.proveedor ?? "DESPROVEEDOR",
        "PROVEEDOR"
      ) ?? ""
    ).trim();
    const rucOrig = obtenerCampo(f, colA.ruc ?? "RUC");
    const rucStr = rucOrig == null ? null : String(rucOrig).trim();

    return {
      cdDestino: String(
        obtenerCampo(f, colA.cdDestino ?? "CD DESTINO", "CD") ?? ""
      ).trim(),
      proveedorOriginal: proveedorOrig,
      proveedorNormalizado: normalizarNombre(proveedorOrig),
      ruc: rucStr,
      unidSolicitadas: parseNumeroSeguro(
        obtenerCampo(f, colA.unidSolicitadas ?? "Unid Solicitadas")
      ),
      cantMpsCds: parseNumeroSeguro(
        obtenerCampo(f, colA.cantMpsCds ?? "Cant de Mps CDs")
      ),
      fr: parseNumeroSeguro(obtenerCampo(f, colA.fr ?? "FR")) || null,
      filaOrigen: i,
    };
  });

  // Filtrar por CD si se especifica
  const agendaFiltrada = opciones?.cdFiltro
    ? agendaNormalizada.filter((a) => a.cdDestino === opciones.cdFiltro)
    : agendaNormalizada;

  // ------------------------------------------------------------------
  // 2. Normalizar Reporte de Citas
  // ------------------------------------------------------------------
  const reporteNormalizado: FilaReporteCita[] = filasReporte.map((f) => {
    const proveedorOrig = String(
      obtenerCampo(
        f,
        colR.proveedor ?? "Nombre Proveedor",
        "NOMBRE PROVEEDOR",
        "PROVEEDOR"
      ) ?? ""
    ).trim();
    const rucOrig = obtenerCampo(
      f,
      colR.ruc ?? "RUC Proveedor",
      "RUC PROVEEDOR",
      "RUC"
    );
    const rucStr = rucOrig == null ? null : String(rucOrig).trim();
    const numeroCita = obtenerCampo(
      f,
      colR.numeroCita ?? "Número de Cita",
      "NUMERO DE CITA",
      "CITA"
    );
    const ordenCompra = obtenerCampo(
      f,
      colR.ordenCompra ?? "Orden de Compra",
      "ORDEN DE COMPRA",
      "OC"
    );
    const fechaCita = obtenerCampo(
      f,
      colR.fechaCita ?? "Fecha Cita",
      "FECHA CITA",
      "FECHA"
    );
    const horaInicio = obtenerCampo(
      f,
      "Hora Inicio",
      "HORA INICIO",
      "Hora de Inicio",
      "HORA"
    );

    return {
      numeroCita:
        numeroCita == null
          ? ""
          : typeof numeroCita === "number"
            ? numeroCita
            : String(numeroCita),
      proveedorOriginal: proveedorOrig,
      proveedorNormalizado: normalizarNombre(proveedorOrig),
      ruc: rucStr,
      unidadesEstimadas: parseNumeroSeguro(
        obtenerCampo(
          f,
          colR.unidadesEstimadas ?? "Unidades Estimadas",
          "UNIDADES ESTIMADAS"
        )
      ),
      ordenCompra: ordenCompra == null ? null : String(ordenCompra),
      fechaCita: fechaCita == null ? null : String(fechaCita),
      horaInicio: horaInicio == null ? null : String(horaInicio),
    };
  });

  // Deduplicar citas por (proveedor, número de cita).
  // Cada combinación cuenta como UNA cita distinta y sus unidades estimadas
  // se suman una sola vez, sin importar cuántas filas traiga el reporte.
  const citasUnicas = new Map<
    string,
    {
      proveedor: string;
      proveedorNormalizado: string;
      numeroCita: string;
      unidadesEstimadas: number;
    }
  >();

  for (const fila of reporteNormalizado) {
    const numeroCita = normalizarNumeroCita(fila.numeroCita);
    const proveedorNormalizado =
      fila.proveedorNormalizado || normalizarNombre(fila.proveedorOriginal);
    if (!numeroCita || !proveedorNormalizado) continue;

    const clave = `${proveedorNormalizado}||${numeroCita}`;
    const existente = citasUnicas.get(clave);
    if (existente) {
      existente.unidadesEstimadas += fila.unidadesEstimadas;
    } else {
      citasUnicas.set(clave, {
        proveedor: fila.proveedorOriginal,
        proveedorNormalizado,
        numeroCita,
        unidadesEstimadas: fila.unidadesEstimadas,
      });
    }
  }

  const totalCitasDistintas = citasUnicas.size;

  // Agrupar las citas únicas por proveedor para el ranking.
  const rankingPorProveedor = new Map<
    string,
    {
      proveedor: string;
      proveedorNormalizado: string;
      citas: Set<string>;
      unidadesEstimadas: number;
    }
  >();

  for (const cita of citasUnicas.values()) {
    const entrada = rankingPorProveedor.get(cita.proveedorNormalizado);
    if (entrada) {
      entrada.citas.add(cita.numeroCita);
      entrada.unidadesEstimadas += cita.unidadesEstimadas;
    } else {
      rankingPorProveedor.set(cita.proveedorNormalizado, {
        proveedor: cita.proveedor,
        proveedorNormalizado: cita.proveedorNormalizado,
        citas: new Set([cita.numeroCita]),
        unidadesEstimadas: cita.unidadesEstimadas,
      });
    }
  }

  // Índice de reporte por RUC (para cruce rápido)
  const reportePorRuc = new Map<string, FilaReporteCita[]>();
  for (const fila of reporteNormalizado) {
    if (!fila.ruc) continue;
    if (!reportePorRuc.has(fila.ruc)) reportePorRuc.set(fila.ruc, []);
    reportePorRuc.get(fila.ruc)!.push(fila);
  }

  // Índice de reporte por nombre normalizado
  const reportePorNombre = new Map<string, FilaReporteCita[]>();
  for (const fila of reporteNormalizado) {
    const norm = fila.proveedorNormalizado;
    if (!reportePorNombre.has(norm)) reportePorNombre.set(norm, []);
    reportePorNombre.get(norm)!.push(fila);
  }

  // ------------------------------------------------------------------
  // 3. Normalizar Maestro de Proveedores
  // ------------------------------------------------------------------
  const maestroPorNombre = new Map<string, string[]>(); // norm → [ruc, ...]
  const maestroPorRuc = new Map<string, string>(); // ruc → nombre original
  for (const f of filasMaestro) {
    const nombreOrig = String(
      obtenerCampo(
        f,
        colM.proveedor ?? "PROVEEDOR",
        "Nombre Proveedor"
      ) ?? ""
    ).trim();
    const rucOrig = String(
      obtenerCampo(f, colM.ruc ?? "RUC", "RUC Proveedor") ?? ""
    ).trim();
    if (!nombreOrig || !rucOrig) continue;
    const norm = normalizarNombre(nombreOrig);
    if (!maestroPorNombre.has(norm)) maestroPorNombre.set(norm, []);
    maestroPorNombre.get(norm)!.push(rucOrig);
    maestroPorRuc.set(rucOrig, nombreOrig);
  }

  // ------------------------------------------------------------------
  // 4. Cruzar cada proveedor de la Agenda
  // ------------------------------------------------------------------
  const proveedoresCruce: ProveedorCruce[] = [];

  for (const a of agendaFiltrada) {
    const obs: string[] = [];
    let rucResuelto: string | null = null;
    let citaMatch: string | null = null;
    let estado: "valido" | "pendiente" | "ambiguo" = "valido";

    // 4a. Si la agenda trae RUC, verificar que exista en maestro
    if (a.ruc) {
      if (maestroPorRuc.has(a.ruc)) {
        rucResuelto = a.ruc;
      } else {
        obs.push("RUC de la agenda no encontrado en el Maestro de Proveedores");
      }
    }

    // 4b. Resolver RUC vía Maestro usando nombre normalizado (si aún no tenemos RUC)
    if (!rucResuelto && a.proveedorNormalizado) {
      const rucsMaestro = maestroPorNombre.get(a.proveedorNormalizado);
      if (rucsMaestro && rucsMaestro.length === 1) {
        rucResuelto = rucsMaestro[0];
      } else if (rucsMaestro && rucsMaestro.length > 1) {
        obs.push(
          `Múltiples RUC en el Maestro para este nombre (${rucsMaestro.length}): requiere revisión`
        );
      }
    }

    // 4c. Buscar coincidencias en Reporte
    // Prioridad: RUC resuelto > Nombre normalizado
    let coincidencias: FilaReporteCita[] = [];

    if (rucResuelto && reportePorRuc.has(rucResuelto)) {
      coincidencias = reportePorRuc.get(rucResuelto)!;
    } else if (reportePorNombre.has(a.proveedorNormalizado)) {
      coincidencias = reportePorNombre.get(a.proveedorNormalizado)!;
    }

    // 4d. Determinar estado y cita match
    if (coincidencias.length === 0) {
      estado = "pendiente";
      obs.push("Sin coincidencia en Reporte de Citas");
    } else {
      // Verificar si todas las coincidencias son la misma cita
      const numerosCitaUnicos = new Set(
        coincidencias.map((c) => normalizarNumeroCita(c.numeroCita))
      );
      if (numerosCitaUnicos.size === 1) {
        citaMatch = String(coincidencias[0].numeroCita);
      } else {
        // Múltiples citas distintas → ambiguo
        estado = "ambiguo";
        obs.push(
          `Múltiples citas encontradas (${numerosCitaUnicos.size}): requiere revisión manual`
        );
      }

      // 4e. Verificar relación comprobable: RUC del reporte debe coincidir con RUC resuelto
      if (rucResuelto) {
        const citasConRuc = coincidencias.filter((c) => c.ruc);
        if (citasConRuc.length > 0) {
          const rucsEnCitas = new Set(citasConRuc.map((c) => c.ruc));
          if (!rucsEnCitas.has(rucResuelto)) {
            obs.push(
              "El RUC de la agenda no coincide con el RUC del reporte de citas"
            );
          }
        }
      }
    }

    // 4f. Calcular unidades estimadas totales y citas distintas del proveedor
    const citasDelProveedor =
      estado === "ambiguo"
        ? coincidencias
        : coincidencias.filter(
            (c) =>
              !citaMatch ||
              normalizarNumeroCita(c.numeroCita) ===
                normalizarNumeroCita(citaMatch)
          );

    const citasDistintasDelProveedor = new Set(
      coincidencias.map((c) => normalizarNumeroCita(c.numeroCita))
    ).size;

    const totalUnidadesEstimadas = citasDelProveedor.reduce(
      (suma, c) => suma + c.unidadesEstimadas,
      0
    );

    // ------------------------------------------------------------------
    // 5. Cálculo de LPN
    // ------------------------------------------------------------------
    let lpns: number | null = null;
    let ratio: number | null = null;

    const tieneUnidSolicitadas = a.unidSolicitadas > 0;
    const tieneCantMpsCds = a.cantMpsCds > 0;
    const tieneFR = a.fr != null && a.fr > 0;

    if (!tieneUnidSolicitadas || !tieneCantMpsCds || !tieneFR) {
      if (!tieneUnidSolicitadas) obs.push("Falta Unid Solicitadas en la Agenda");
      if (!tieneCantMpsCds) obs.push("Falta Cant Mps CDs en la Agenda");
      if (!tieneFR) obs.push("Falta FR en la Agenda");
      estado = "pendiente";
    } else {
      ratio = a.unidSolicitadas / a.cantMpsCds;
      // Los LPN son unidades enteras: se redondean (sin decimales).
      lpns = Math.round((totalUnidadesEstimadas / ratio) * (a.fr ?? 0));
      if (!Number.isFinite(lpns) || lpns < 0) {
        lpns = null;
        obs.push("Cálculo de LPN resultó en valor no válido");
      }
    }

    proveedoresCruce.push({
      proveedorOriginal: a.proveedorOriginal,
      proveedorNormalizado: a.proveedorNormalizado,
      ruc: rucResuelto,
      cdDestino: a.cdDestino,
      horaInicio: citasDelProveedor[0]?.horaInicio ?? null,
      unidSolicitadas: a.unidSolicitadas,
      cantMpsCds: a.cantMpsCds,
      fr: a.fr,
      ratio,
      totalUnidadesEstimadas,
      numCitasDistintas: citasDistintasDelProveedor,
      lpns,
      estado,
      observaciones: obs,
      citaMatch,
    });
  }

  // ------------------------------------------------------------------
  // 6. Indicadores globales
  // ------------------------------------------------------------------
  const totalProveedoresAgenda = proveedoresCruce.length;
  const proveedoresConCita = proveedoresCruce.filter(
    (p) => p.estado !== "pendiente"
  ).length;
  const proveedoresSinCita = proveedoresCruce.filter(
    (p) => p.estado === "pendiente"
  ).length;

  const totalUnidadesEstimadas = proveedoresCruce.reduce(
    (suma, p) => suma + p.totalUnidadesEstimadas,
    0
  );

  const lpnsValidos = proveedoresCruce.filter((p) => p.lpns != null);
  const avanceLpns = lpnsValidos.reduce((suma, p) => suma + p.lpns!, 0);
  const avanceLpnsPorcentaje = (avanceLpns / TOPE_LPNS) * 100;

  // Ranking: proveedores del Reporte con más de una cita distinta.
  // Orden: mayor a menor cantidad de citas; empate → alfabético.
  const proveedoresRanking: RankingProveedor[] = Array.from(
    rankingPorProveedor.values()
  )
    .filter((p) => p.citas.size > 1)
    .map((p) => ({
      proveedor: p.proveedor,
      proveedorNormalizado: p.proveedorNormalizado,
      citasDistintas: p.citas.size,
      unidadesEstimadas: p.unidadesEstimadas,
    }))
    .sort(
      (a, b) =>
        b.citasDistintas - a.citasDistintas ||
        a.proveedor.localeCompare(b.proveedor)
    );

  const rankingVacio = proveedoresRanking.length === 0;

  // Alertas de capacidad (se muestra porcentaje real, barra limitada al 100%)
  const alertaCapacidadLpns = avanceLpns > TOPE_LPNS;
  const alertaCapacidadProveedores =
    totalProveedoresAgenda > CAPACIDAD_PROVEEDORES;

  return {
    fechaProceso: new Date().toISOString(),
    cdSeleccionado: opciones?.cdFiltro ?? null,
    proveedoresAgenda: proveedoresCruce,
    totalProveedoresAgenda,
    proveedoresConCita,
    proveedoresSinCita,
    totalCitasDistintas,
    totalUnidadesEstimadas,
    avanceLpns,
    avanceLpnsPorcentaje,
    capacidadProveedores: CAPACIDAD_PROVEEDORES,
    proveedoresRanking,
    rankingVacio,
    alertaCapacidadLpns,
    alertaCapacidadProveedores,
  };
}
