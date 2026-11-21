import { NextResponse } from "next/server";
import { agregarUsuario, existeAdministrador } from "@/lib/almacen-usuarios";
import { hashPassword, validarDNI, validarPassword } from "@/lib/auth";

const SEED_KEY_HEADER = "x-admin-seed-key";

/**
 * POST /api/seed/admin
 * Crea el PRIMER administrador de forma controlada.
 * Requiere la clave secreta ADMIN_SEED_KEY en las variables de entorno
 * y en el header de la petición.
 * Solo funciona si NO existe ningún usuario con rol Administrador.
 *
 * Esta ruta NO permite autogenerar administradores desde el login.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    // Verificar clave secreta
    const providedKey = request.headers.get(SEED_KEY_HEADER);
    const expectedKey = process.env.ADMIN_SEED_KEY;

    if (!expectedKey) {
      return NextResponse.json(
        { error: "El sistema no tiene configurada una clave de semilla." },
        { status: 500 },
      );
    }

    if (providedKey !== expectedKey) {
      return NextResponse.json(
        { error: "Clave de semilla inválida." },
        { status: 401 },
      );
    }

    // Verificar que NO exista ya un administrador
    if (await existeAdministrador()) {
      return NextResponse.json(
        { error: "Ya existe un administrador en el sistema." },
        { status: 409 },
      );
    }

    const body = await request.json();
    const { dni, nombres, apellidos, password } = body as {
      dni?: string;
      nombres?: string;
      apellidos?: string;
      password?: string;
    };

    if (!dni || !nombres || !apellidos || !password) {
      return NextResponse.json(
        { error: "DNI, nombres, apellidos y contraseña son requeridos." },
        { status: 400 },
      );
    }

    if (!validarDNI(dni)) {
      return NextResponse.json(
        { error: "El DNI debe tener exactamente 8 dígitos numéricos." },
        { status: 400 },
      );
    }

    if (!validarPassword(password)) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 },
      );
    }

    const { hash, salt } = await hashPassword(password);
    const ahora = new Date().toISOString();

    const nuevoAdmin = {
      dni,
      nombres,
      apellidos,
      rol: "Administrador",
      estado: "activo",
      passwordHash: hash,
      passwordSalt: salt,
      debeCambiarPassword: true, // debe cambiarla en primer ingreso
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
      creadoPor: "seed",
      sessionToken: null,
      sessionExpiresAt: null,
    };

    const creado = await agregarUsuario(nuevoAdmin);

    return NextResponse.json({
      success: true,
      mensaje:
        "Primer administrador creado. Debe cambiar la contraseña en su primer ingreso.",
      usuario: {
        id: creado.id,
        dni,
        nombres,
        apellidos,
        rol: "Administrador",
        debeCambiarPassword: true,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al crear el primer administrador." },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Método no permitido." }, { status: 405 });
}