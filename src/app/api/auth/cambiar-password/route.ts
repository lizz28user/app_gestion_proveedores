import { NextResponse } from "next/server";
import { actualizarUsuario } from "@/lib/almacen-usuarios";
import { hashPassword, validarPassword, verifyPassword } from "@/lib/auth";
import { obtenerUsuarioSesion } from "@/lib/sesion-servidor";

export async function POST(request: Request): Promise<Response> {
  try {
    // Buscar usuario por token de sesión
    const data = await obtenerUsuarioSesion();

    if (!data) {
      return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    }

    const { passwordActual, passwordNueva } = await request.json();

    if (!passwordActual || !passwordNueva) {
      return NextResponse.json(
        { error: "Contraseña actual y nueva son requeridas." },
        { status: 400 },
      );
    }

    if (!validarPassword(passwordNueva)) {
      return NextResponse.json(
        { error: "La contraseña nueva debe tener al menos 8 caracteres." },
        { status: 400 },
      );
    }

    // Verificar contraseña actual
    const valida = await verifyPassword(passwordActual, data.passwordHash, data.passwordSalt);
    if (!valida) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta." },
        { status: 401 },
      );
    }

    // Hashear nueva contraseña
    const { hash, salt } = await hashPassword(passwordNueva);

    await actualizarUsuario(data.id, {
      passwordHash: hash,
      passwordSalt: salt,
      debeCambiarPassword: false,
      fechaActualizacion: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      mensaje: "Contraseña cambiada correctamente.",
      redirect: "/dashboard",
    });
  } catch {
    return NextResponse.json({ error: "Error al cambiar contraseña." }, { status: 500 });
  }
}
