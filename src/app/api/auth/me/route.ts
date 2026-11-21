import { NextResponse } from "next/server";
import { obtenerUsuarioSesion } from "@/lib/sesion-servidor";

export async function GET(): Promise<Response> {
  try {
    const data = await obtenerUsuarioSesion();

    if (!data) {
      return NextResponse.json({ autenticado: false }, { status: 401 });
    }

    // Verificar que la sesión no haya expirado
    const expiracion = data.sessionExpiresAt
      ? new Date(data.sessionExpiresAt)
      : null;
    if (expiracion && expiracion < new Date()) {
      return NextResponse.json({ autenticado: false }, { status: 401 });
    }

    return NextResponse.json({
      autenticado: true,
      usuario: {
        id: data.id,
        dni: data.dni,
        nombres: data.nombres,
        apellidos: data.apellidos,
        rol: data.rol,
        estado: data.estado,
        debeCambiarPassword: data.debeCambiarPassword,
      },
    });
  } catch {
    return NextResponse.json({ autenticado: false }, { status: 500 });
  }
}
