import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_SESSION, COOKIE_ROLE } from "@/lib/constantes-auth";


export async function POST(): Promise<Response> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_SESSION);
    cookieStore.delete(COOKIE_ROLE);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al cerrar sesión." }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "Método no permitido." }, { status: 405 });
}