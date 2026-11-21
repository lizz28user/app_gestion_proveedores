export type Rol = "Administrador" | "Supervisor" | "Auxiliar";

export type Modulo =
  | "garita"
  | "agendamientos"
  | "datos-maestros"
  | "usuarios";

export type Accion = "ver" | "crear" | "editar" | "eliminar" | "gestionar";

export type PermisosModulo = Record<Accion, boolean>;

export type PermisosUsuario = {
  [K in Modulo]: PermisosModulo;
};

export type Usuario = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  estado: "activo" | "inactivo";
  debeCambiarPassword: boolean;
  permisos: PermisosUsuario;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadoPor: string | null;
};

const TODO: PermisosModulo = { ver: true, crear: true, editar: true, eliminar: true, gestionar: true };
const NADA: PermisosModulo = { ver: false, crear: false, editar: false, eliminar: false, gestionar: false };
const SOLO_VER: PermisosModulo = { ver: true, crear: false, editar: false, eliminar: false, gestionar: false };
const AGREGAR_Y_VER: PermisosModulo = { ver: true, crear: true, editar: false, eliminar: false, gestionar: false };
const AGREGAR_EDITAR_BORRAR: PermisosModulo = { ver: true, crear: true, editar: true, eliminar: true, gestionar: false };

/**
 * Permisos por rol:
 *
 * | Módulo          | Administrador | Supervisor                  | Auxiliar / Operario |
 * |-----------------|---------------|-----------------------------|---------------------|
 * | Garita          | Todo          | Ver, agregar, editar, borrar | Ver y agregar      |
 * | Agendamientos   | Todo          | Ver, agregar, editar, borrar | Solo ver           |
 * | Datos maestros  | Todo          | Ver, agregar, editar, borrar | Solo ver           |
 * | Usuarios        | Todo          | Sin acceso                  | Sin acceso          |
 *
 * Solo el Administrador gestiona usuarios.
 */
export const ROLES_PERMISSIONS: Record<Rol, PermisosUsuario> = {
  Administrador: {
    "garita": TODO,
    "agendamientos": TODO,
    "datos-maestros": TODO,
    "usuarios": TODO,
  },
  Supervisor: {
    "garita": AGREGAR_EDITAR_BORRAR,
    "agendamientos": AGREGAR_EDITAR_BORRAR,
    "datos-maestros": AGREGAR_EDITAR_BORRAR,
    "usuarios": NADA,
  },
  Auxiliar: {
    "garita": AGREGAR_Y_VER,
    "agendamientos": SOLO_VER,
    "datos-maestros": SOLO_VER,
    "usuarios": NADA,
  },
};

/**
 * Verifica si un rol tiene permiso para una acción en un módulo.
 */
export function tienePermiso(
  rol: Rol,
  modulo: Modulo,
  accion: Accion,
): boolean {
  return ROLES_PERMISSIONS[rol]?.[modulo]?.[accion] ?? false;
}

/**
 * Lista los módulos que un rol puede ver.
 */
export function modulosVisible(rol: Rol): Modulo[] {
  const modulos: Modulo[] = ["garita", "agendamientos", "datos-maestros", "usuarios"];
  return modulos.filter((m) => tienePermiso(rol, m, "ver"));
}

/**
 * Verifica si un usuario puede acceder a una ruta basada en su rol.
 * Las rutas empiezan con el nombre del módulo (ej: /garita/...).
 */
export function puedeAccesarRuta(
  rol: Rol,
  pathname: string,
): boolean {
  // El primer segmento de la URL identifica el módulo: /garita/..., /usuarios/...
  const moduloDesdeRuta = pathname
    .split("/")
    .filter(Boolean)[0] as Modulo | undefined;

  // Raíz, login, dashboard o rutas que no pertenecen a un módulo: permitir.
  if (!moduloDesdeRuta) return true;
  if (!(moduloDesdeRuta in ROLES_PERMISSIONS[rol])) return true;

  if (moduloDesdeRuta === "usuarios") {
    return rol === "Administrador";
  }

  return tienePermiso(rol, moduloDesdeRuta, "ver");
}

export const ROL_LABELS: Record<Rol, string> = {
  Administrador: "Administrador",
  Supervisor: "Supervisor",
  Auxiliar: "Auxiliar / Operario",
};

/** Descripción corta de lo que puede hacer cada rol (se muestra al crear usuarios). */
export const ROL_DESCRIPCIONES: Record<Rol, string> = {
  Administrador: "Acceso total. Único rol que gestiona usuarios.",
  Supervisor: "Puede agregar, editar y borrar en Garita, Agendamientos y Datos maestros.",
  Auxiliar: "Puede agregar datos en Garita. En los demás módulos solo puede ver.",
};

export function esRol(valor: unknown): valor is Rol {
  return valor === "Administrador" || valor === "Supervisor" || valor === "Auxiliar";
}

export const ESTADO_LABELS: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
};
