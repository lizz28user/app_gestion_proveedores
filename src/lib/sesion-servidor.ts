import { cookies } from "next/headers";
import { COOKIE_SESSION } from "@/lib/constantes-auth";
import { buscarUsuarioPorToken, type UsuarioDoc } from "@/lib/almacen-usuarios";

/** Usuario de la sesión actual (según la cookie), o null si no hay sesión válida. */
export async function obtenerUsuarioSesion(): Promise<UsuarioDoc | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSION)?.value;
  if (!token) return null;
  return buscarUsuarioPorToken(token);
}

/** true si la sesión pertenece a un Administrador. */
export async function esAdministrador(): Promise<boolean> {
  const sesion = await obtenerUsuarioSesion();
  return Boolean(sesion && sesion.rol === "Administrador");
}
