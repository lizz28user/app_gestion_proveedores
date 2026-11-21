import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSION, COOKIE_ROLE } from "@/lib/constantes-auth";

/**
 * Rutas públicas que no requieren sesión.
 */
const RUTAS_PUBLICAS = ["/", "/login"];

/**
 * Nombres de cookies de sesión.
 */

/**
 * Matcher de archivos estáticos (iconos, imágenes, fuentes, etc.).
 * Las rutas con extensión se sirven sin comprobar sesión.
 */
const ARCHIVO_ESTATICO = /\.[a-zA-Z0-9]+$/;

function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.includes(pathname) || ARCHIVO_ESTATICO.test(pathname);
}

/**
 * Middleware de protección de rutas.
 * - Redirige a /login si no hay cookie de sesión.
 * - Redirige a /dashboard si un no-admin intenta entrar a /usuarios.
 * La validación detallada de rol y permisos se refuerza en las API Routes
 * consultando Firestore, ya que el middleware corre en Edge.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (esRutaPublica(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(COOKIE_SESSION)?.value;

  if (!sessionToken) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Bloqueo rápido de /usuarios para roles no administradores.
  if (pathname.startsWith("/usuarios")) {
    const userRole = request.cookies.get(COOKIE_ROLE)?.value;
    if (userRole && userRole !== "Administrador") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
