"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

/**
 * Catálogo de productos: fuente de la verdad para Incidencias de datos maestros
 * y Cambio MP. Solo el Administrador lo carga o lo vacía.
 */
export type Producto = {
  sku: string;
  descripcion: string;
  mp: string;
  undsPallet: string;
  cargaTitan: string;
};

export type CatalogoGuardado = {
  productos: Record<string, Producto>;
  cargadoEn: string | null;
  archivo: string | null;
};

const EVENTO_CATALOGO = "catalogo-actualizado";

const VACIO: CatalogoGuardado = { productos: {}, cargadoEn: null, archivo: null };

/** Normaliza un SKU para buscarlo: sin espacios y en mayúsculas. */
export function normalizarSku(valor: unknown): string {
  return String(valor ?? "").trim().toUpperCase();
}

/* ───────────── Almacenamiento en IndexedDB ─────────────
 * El catálogo puede tener decenas de miles de SKU: no entra en localStorage
 * (límite ~5 MB). IndexedDB admite cientos de MB en el mismo navegador.
 */
const DB_NOMBRE = "portal-proveedores";
const DB_VERSION = 1;
const STORE = "datos-maestros";
const CLAVE_CATALOGO = "catalogo";
const LS_CATALOGO_ANTIGUO = "portal-proveedores:catalogo";

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite guardar datos locales."));
      return;
    }
    const solicitud = indexedDB.open(DB_NOMBRE, DB_VERSION);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error ?? new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function operar<T>(
  modo: IDBTransactionMode,
  accion: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await abrirDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, modo);
      const solicitud = accion(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(solicitud.result as T);
      tx.onerror = () => reject(tx.error ?? solicitud.error);
      tx.onabort = () => reject(tx.error ?? new Error("Operación cancelada."));
    });
  } finally {
    db.close();
  }
}

export async function cargarCatalogo(): Promise<CatalogoGuardado> {
  try {
    const guardado = await operar<Partial<CatalogoGuardado> | undefined>("readonly", (s) =>
      s.get(CLAVE_CATALOGO),
    );
    if (!guardado) return VACIO;
    return {
      productos: guardado.productos ?? {},
      cargadoEn: guardado.cargadoEn ?? null,
      archivo: guardado.archivo ?? null,
    };
  } catch {
    return VACIO;
  }
}

/** Guarda el catálogo. Lanza un error legible si no se pudo guardar. */
export async function guardarCatalogo(catalogo: CatalogoGuardado): Promise<void> {
  try {
    await operar("readwrite", (s) => s.put(catalogo, CLAVE_CATALOGO));
  } catch (error) {
    const sinEspacio = error instanceof DOMException && error.name === "QuotaExceededError";
    throw new Error(
      sinEspacio
        ? "No hay espacio suficiente en este equipo para guardar el catálogo. Libera espacio en el disco o consulta a TI."
        : "No se pudo guardar el catálogo en este navegador.",
    );
  }
  // Limpia la copia antigua de localStorage, si existiera.
  try {
    window.localStorage.removeItem(LS_CATALOGO_ANTIGUO);
  } catch {
    // Sin acción.
  }
  window.dispatchEvent(new Event(EVENTO_CATALOGO));
}

export async function vaciarCatalogo(): Promise<void> {
  await operar("readwrite", (s) => s.delete(CLAVE_CATALOGO));
  window.dispatchEvent(new Event(EVENTO_CATALOGO));
}

/** Busca un SKU en el catálogo (o null si no existe). */
export function buscarProducto(
  productos: Record<string, Producto>,
  sku: string,
): Producto | null {
  const clave = normalizarSku(sku);
  return clave ? productos[clave] ?? null : null;
}

/** Hook: catálogo actual, se actualiza cuando otra pantalla lo cambia. */
export function useCatalogo() {
  const [catalogo, setCatalogo] = useState<CatalogoGuardado>(VACIO);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(() => {
    void cargarCatalogo().then((datos) => {
      setCatalogo(datos);
      setCargando(false);
    });
  }, []);

  useEffect(() => {
    recargar();
    window.addEventListener(EVENTO_CATALOGO, recargar);
    return () => window.removeEventListener(EVENTO_CATALOGO, recargar);
  }, [recargar]);

  return { catalogo, cargando, recargar };
}

/* ───────────── Excel ───────────── */

function claveColumna(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Lee el primer valor no vacío de una fila probando varios nombres de columna. */
export function valorColumna(fila: Record<string, unknown>, alias: string[]): unknown {
  const claves = Object.keys(fila);
  for (const nombre of alias) {
    const buscada = claveColumna(nombre);
    const clave = claves.find((k) => claveColumna(k) === buscada);
    if (clave !== undefined && fila[clave] !== "" && fila[clave] != null) return fila[clave];
  }
  return "";
}

/**
 * Lee una hoja de Excel como filas con encabezados.
 * raw=true conserva números y fechas (objetos Date); raw=false devuelve texto.
 */
export async function leerHojaExcel(
  archivo: File,
  hojaPreferida?: string,
  raw = false,
): Promise<Record<string, unknown>[]> {
  const buffer = await archivo.arrayBuffer();
  const libro = XLSX.read(buffer, { type: "array", cellDates: true });
  const nombre =
    hojaPreferida && libro.SheetNames.includes(hojaPreferida)
      ? hojaPreferida
      : libro.SheetNames[0];
  return XLSX.utils.sheet_to_json(libro.Sheets[nombre], { defval: "", raw });
}

export type ResultadoCargaCatalogo = {
  productos: Record<string, Producto>;
  total: number;
  omitidas: number;
};

/** Convierte las filas del Excel del catálogo en productos (SKU + descripción obligatorios). */
export function filasACatalogo(filas: Record<string, unknown>[]): ResultadoCargaCatalogo {
  const productos: Record<string, Producto> = {};
  let omitidas = 0;

  for (const fila of filas) {
    const sku = normalizarSku(valorColumna(fila, ["SKU", "Código", "Codigo", "Cod SAP", "CODPRODSAP"]));
    const descripcion = String(
      valorColumna(fila, ["Descripción", "Descripcion", "Description", "Producto", "DESPROD", "Nombre"]),
    ).trim();
    if (!sku || !descripcion) {
      omitidas++;
      continue;
    }
    productos[sku] = {
      sku,
      descripcion,
      mp: String(valorColumna(fila, ["MP", "Master Pack", "Masterpack"])).trim(),
      undsPallet: String(valorColumna(fila, ["Unds PALLET", "Unds Pallet", "Unidades por pallet", "Pallet"])).trim(),
      cargaTitan: String(valorColumna(fila, ["CARGA TITAN", "Carga Titan", "Titan"])).trim(),
    };
  }

  return { productos, total: Object.keys(productos).length, omitidas };
}

/** Descarga un Excel (se usa para exportar y para plantillas). */
export function descargarExcel(nombreArchivo: string, hoja: string, filas: (string | number)[][]) {
  const libro = XLSX.utils.book_new();
  const hojaXlsx = XLSX.utils.aoa_to_sheet(filas);
  hojaXlsx["!cols"] = filas[0]?.map((_, i) => ({
    wch: Math.min(60, Math.max(10, ...filas.slice(0, 200).map((f) => String(f[i] ?? "").length + 2))),
  }));
  XLSX.utils.book_append_sheet(libro, hojaXlsx, hoja);
  XLSX.writeFile(libro, nombreArchivo);
}

export function fechaArchivo(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/** Pide al servidor que confirme la contraseña del Administrador. */
export async function verificarPasswordAdmin(password: string): Promise<string | null> {
  try {
    const respuesta = await fetch("/api/auth/verificar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (respuesta.ok) return null;
    const data = (await respuesta.json().catch(() => ({}))) as { error?: string };
    return data.error ?? "No se pudo verificar la contraseña.";
  } catch {
    return "No se pudo verificar la contraseña. Revisa tu conexión.";
  }
}
