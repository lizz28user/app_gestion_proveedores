import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth";
import { obtenerUsuarioSesion } from "@/lib/sesion-servidor";


const cuerpoSchema = z.object({
  password: z.string().min(1, "Ingresa tu contraseña."),
});

/**
 * POST /api/auth/verificar-password
 * Confirma la contraseña del usuario en sesión antes de una acción sensible
 * (cargar o vaciar el Catálogo de productos). Solo responde OK si el usuario
 * es Administrador y la contraseña es correcta.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const data = await obtenerUsuarioSesion();
    if (!data) {
      return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
    }

    const parsed = cuerpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Ingresa tu contraseña." }, { status: 400 });
    }

    if (data.sessionExpiresAt && new Date(data.sessionExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Tu sesión expiró. Vuelve a iniciar sesión." }, { status: 401 });
    }
    if (data.rol !== "Administrador" || data.estado !== "activo") {
      return NextResponse.json(
        { error: "Solo el Administrador puede realizar esta acción." },
        { status: 403 },
      );
    }
    if (!data.passwordHash || !data.passwordSalt) {
      return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
    }

    const valida = await verifyPassword(parsed.data.password, data.passwordHash, data.passwordSalt);
    if (!valida) {
      return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo verificar la contraseña." }, { status: 500 });
  }
}
