import { z } from "zod";
import { buscarProducto, valorColumna, type Producto } from "./catalogo";
import { generarId } from "./incidencias-maestros";
import { todayIso } from "./utils";

/** Cambio MP: historial de cambios de Master Pack (unidades por caja). */
export const ESTADOS_CAMBIO_MP = ["Pendiente", "En Proceso", "Resuelta"] as const;
export type EstadoCambioMp = (typeof ESTADOS_CAMBIO_MP)[number];
export type Procedio = "Sí" | "No";

export type CambioMp = {
  id: string;
  sku: string;
  descripcion: string;
  mpAntiguo: number | null;
  mpNuevo: number;
  fecha: string; // yyyy-mm-dd
  usuario: string;
  procedio: Procedio;
  estado: EstadoCambioMp;
  fechaResolucion: string | null; // ISO
  origen: "manual" | "excel";
};

export const HOJA_PLANTILLA = "Master Pack";
export const COLUMNAS_PLANTILLA = [
  "SKU",
  "Descripción",
  "MP Antiguo",
  "MP Nuevo",
  "Fecha de Cambio",
  "Usuario",
  "Procedió",
] as const;

const numeroPositivo = z.coerce
  .number({ message: "Ingresa un número." })
  .int("Debe ser un número entero.")
  .positive("Debe ser mayor que 0.");

export const cambioMpSchema = z
  .object({
    sku: z.string().trim().min(1, "Ingresa el SKU."),
    mpAntiguo: z.union([numeroPositivo, z.literal("").transform(() => null)]),
    mpNuevo: numeroPositivo,
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona la fecha del cambio."),
    usuario: z.string().trim().min(1, "Ingresa el usuario."),
    procedio: z.enum(["Sí", "No"]),
    estado: z.enum(ESTADOS_CAMBIO_MP),
  })
  .refine((d) => d.mpAntiguo === null || d.mpAntiguo !== d.mpNuevo, {
    message: "El MP nuevo es igual al MP actual.",
    path: ["mpNuevo"],
  });

/** Regla de estado: si procedió, el cambio queda Resuelta. */
export function estadoSegunProcedio(procedio: Procedio, estado: EstadoCambioMp): EstadoCambioMp {
  if (procedio === "Sí") return "Resuelta";
  return estado === "Resuelta" ? "Pendiente" : estado;
}

const LS_KEY = "portal-proveedores:cambios-mp";

export function cargarCambiosMp(): CambioMp[] {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const lista: unknown = JSON.parse(raw);
    return Array.isArray(lista) ? (lista as CambioMp[]).filter((c) => c && typeof c.sku === "string") : [];
  } catch {
    return [];
  }
}

export function guardarCambiosMp(lista: CambioMp[]): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(lista));
  } catch {
    throw new Error("No hay espacio suficiente en este navegador para guardar los cambios.");
  }
}

/** Interpreta un MP del catálogo ("12", "12 und", "") como número o null. */
export function mpComoNumero(valor: string | number | null | undefined): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) && valor > 0 ? valor : null;
  const coincide = String(valor ?? "").replace(",", ".").match(/\d+(\.\d+)?/);
  if (!coincide) return null;
  const n = Number(coincide[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fecha del Excel (Date, número de serie o texto dd/mm/yyyy | yyyy-mm-dd) a yyyy-mm-dd. */
export function fechaExcelAIso(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, "0")}-${String(valor.getDate()).padStart(2, "0")}`;
  }
  if (typeof valor === "number" && Number.isFinite(valor) && valor > 20000) {
    const d = new Date(Math.round((valor - 25569) * 86_400_000));
    return d.toISOString().slice(0, 10);
  }
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  const iso = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    const anio = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${anio}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

export type ResultadoImportacion = {
  agregados: CambioMp[];
  errores: string[];
};

/**
 * Convierte las filas de la plantilla en cambios MP.
 * Valida cada SKU contra el catálogo y completa descripción y MP antiguo.
 */
export function filasACambiosMp(
  filas: Record<string, unknown>[],
  productos: Record<string, Producto>,
  usuarioPorDefecto: string,
): ResultadoImportacion {
  const agregados: CambioMp[] = [];
  const errores: string[] = [];

  filas.forEach((fila, indice) => {
    const numeroFila = indice + 2; // fila 1 = encabezados
    const sku = String(valorColumna(fila, ["SKU", "Código", "Codigo"])).trim();
    if (!sku && Object.values(fila).every((v) => String(v ?? "").trim() === "")) return; // fila vacía

    const producto = buscarProducto(productos, sku);
    if (!sku) {
      errores.push(`Fila ${numeroFila}: falta el SKU.`);
      return;
    }
    if (!producto) {
      errores.push(`Fila ${numeroFila}: el SKU ${sku} no existe en el catálogo.`);
      return;
    }

    const mpNuevo = mpComoNumero(valorColumna(fila, ["MP Nuevo", "MP nuevo", "Nuevo MP"]) as string | number);
    if (mpNuevo === null || !Number.isInteger(mpNuevo)) {
      errores.push(`Fila ${numeroFila}: el MP nuevo del SKU ${producto.sku} no es un número entero válido.`);
      return;
    }

    const mpExcel = mpComoNumero(valorColumna(fila, ["MP Antiguo", "MP actual"]) as string | number);
    const mpAntiguo = mpComoNumero(producto.mp) ?? mpExcel;
    if (mpAntiguo !== null && mpAntiguo === mpNuevo) {
      errores.push(`Fila ${numeroFila}: el MP nuevo del SKU ${producto.sku} es igual al actual (${mpNuevo}).`);
      return;
    }

    const rawProcedio = String(valorColumna(fila, ["Procedió", "Procedio"])).trim().toLowerCase();
    const procedio: Procedio = ["sí", "si", "s", "yes", "1", "true"].includes(rawProcedio) ? "Sí" : "No";
    const fecha = fechaExcelAIso(valorColumna(fila, ["Fecha de Cambio", "Fecha"])) ?? todayIso();
    const estado = estadoSegunProcedio(procedio, "Pendiente");

    agregados.push({
      id: generarId("MP"),
      sku: producto.sku,
      descripcion: producto.descripcion,
      mpAntiguo,
      mpNuevo,
      fecha,
      usuario: String(valorColumna(fila, ["Usuario"])).trim() || usuarioPorDefecto,
      procedio,
      estado,
      fechaResolucion: estado === "Resuelta" ? new Date(`${fecha}T12:00:00`).toISOString() : null,
      origen: "excel",
    });
  });

  return { agregados, errores };
}
