import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { actualizarUsuario, buscarUsuarioPorDni } from "@/lib/almacen-usuarios";
import {
  verifyPassword,
  generateSessionToken,
  validarDNI,
} from "@/lib/auth";
import { COOKIE_SESSION, COOKIE_ROLE } from "@/lib/constantes-auth";

const SESSION_DURATION_DAYS = 7;

/**
 * POST /api/auth/login
 * Autentica un usuario con DNI y contraseña contra el almacén local.
 * No permite registro público.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { dni: dniRaw, password } = body as {
      dni?: string;
      password?: string;
    };
    const dni = dniRaw?.trim();

    if (!dni || !password) {
      return NextResponse.json(
        { error: "DNI y contraseña son requeridos." },
        { status: 400 },
      );
    }

    if (!validarDNI(dni)) {
      return NextResponse.json(
        { error: "El DNI debe tener exactamente 8 dígitos numéricos." },
        { status: 400 },
      );
    }

    // Buscar usuario por DNI en el almacén local
    const data = await buscarUsuarioPorDni(dni);

    if (!data) {
      return NextResponse.json(
        { error: "Credenciales inválidas." },
        { status: 401 },
      );
    }

    // Verificar que la cuenta esté activa
    if (data.estado !== "activo") {
      return NextResponse.json(
        { error: "Su cuenta está inactiva. Contacte al administrador." },
        { status: 403 },
      );
    }

    // Verificar contraseña (PBKDF2-SHA256, nunca texto plano)
    const valida = await verifyPassword(password, data.passwordHash, data.passwordSalt);
    if (!valida) {
      return NextResponse.json(
        { error: "Credenciales inválidas." },
        { status: 401 },
      );
    }

    // Generar token de sesión
    const sessionToken = generateSessionToken();
    const expiracion = new Date();
    expiracion.setDate(expiracion.getDate() + SESSION_DURATION_DAYS);

    // Guardar la sesión en el registro del usuario
    await actualizarUsuario(data.id, {
      sessionToken,
      sessionExpiresAt: expiracion.toISOString(),
      ultimoAcceso: new Date().toISOString(),
    });

    // Establecer cookies HTTP-only.
    // `Secure` solo cuando la petición llega por HTTPS: así funciona también
    // el acceso por red local (http://IP:3001) durante pruebas.
    const esHttps = new URL(request.url).protocol === "https:";
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_SESSION, sessionToken, {
      httpOnly: true,
      secure: esHttps,
      sameSite: "lax",
      path: "/",
      expires: expiracion,
    });

    cookieStore.set(COOKIE_ROLE, data.rol, {
      httpOnly: false, // accesible desde cliente para middleware rápido
      secure: esHttps,
      sameSite: "lax",
      path: "/",
      expires: expiracion,
    });

    return NextResponse.json({
      success: true,
      usuario: {
        id: data.id,
        dni: data.dni,
        nombres: data.nombres,
        apellidos: data.apellidos,
        rol: data.rol,
        debeCambiarPassword: data.debeCambiarPassword,
      },
      redirect: data.debeCambiarPassword
        ? "/usuarios/cambiar-password"
        : "/dashboard",
    });
  } catch {
    return NextResponse.json(
      { error: "Error al iniciar sesión." },
      { status: 500 },
    );
  }
}

/**
 * GET /api/auth/login (método no permitido)
 */
export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Método no permitido." }, { status: 405 });
}