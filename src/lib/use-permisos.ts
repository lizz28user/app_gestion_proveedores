"use client";

import { esRol, tienePermiso, type Modulo } from "./permissions";
import { useSession } from "./use-session";

export type PermisosPantalla = {
  /** Mientras se carga la sesión, todo queda en false. */
  cargando: boolean;
  rol: string | null;
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
};

/**
 * Permisos del usuario en sesión para un módulo.
 * Uso: const { crear, editar, eliminar } = usePermisos("garita");
 */
export function usePermisos(modulo: Modulo): PermisosPantalla {
  const { usuario, loading } = useSession();
  const rol = usuario?.rol ?? null;

  if (loading || !esRol(rol)) {
    return { cargando: loading, rol, ver: false, crear: false, editar: false, eliminar: false };
  }

  return {
    cargando: false,
    rol,
    ver: tienePermiso(rol, modulo, "ver"),
    crear: tienePermiso(rol, modulo, "crear"),
    editar: tienePermiso(rol, modulo, "editar"),
    eliminar: tienePermiso(rol, modulo, "eliminar"),
  };
}
