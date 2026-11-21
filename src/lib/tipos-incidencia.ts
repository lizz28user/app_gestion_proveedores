import { TIPOS_INCIDENCIA } from "@/components/reception/types";

/**
 * Tipos de incidencia de recepción (Daño de empaque, Producto vencido…).
 * La lista se puede ampliar o reducir; solo Supervisor y Administrador pueden hacerlo.
 */
const LS_TIPOS_KEY = "portal-proveedores:tipos-incidencia-recepcion";

export function cargarTiposIncidencia(): string[] {
  try {
    const raw = window.localStorage.getItem(LS_TIPOS_KEY);
    if (!raw) return [...TIPOS_INCIDENCIA];
    const lista: unknown = JSON.parse(raw);
    if (!Array.isArray(lista)) return [...TIPOS_INCIDENCIA];
    const limpios = lista.map((t) => String(t).trim()).filter(Boolean);
    return limpios.length > 0 ? limpios : [...TIPOS_INCIDENCIA];
  } catch {
    return [...TIPOS_INCIDENCIA];
  }
}

export function guardarTiposIncidencia(tipos: string[]): void {
  window.localStorage.setItem(LS_TIPOS_KEY, JSON.stringify(tipos));
}

/** Agrega un tipo nuevo. Devuelve un mensaje de error o null si se agregó. */
export function validarTipoNuevo(tipos: string[], nuevo: string): string | null {
  const texto = nuevo.trim();
  if (texto.length < 3) return "Escribe al menos 3 caracteres.";
  if (texto.length > 60) return "Máximo 60 caracteres.";
  if (tipos.some((t) => t.toLowerCase() === texto.toLowerCase())) return "Ese tipo ya existe.";
  return null;
}
