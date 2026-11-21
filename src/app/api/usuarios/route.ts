import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  agregarUsuario,
  buscarUsuarioPorDni,
  listarUsuarios,
} from "@/lib/almacen-usuarios";
import {
  hashPassword,
  validarDNI,
  validarPassword,
} from "@/lib/auth";
import type { Rol } from "@/lib/permissions";
import { obtenerUsuarioSesion } from "@/lib/sesion-servidor";

/**
 * GET /api/usuarios
 * Listar todos los usuarios (solo Administrador).
 */
export async function GET(): Promise<Response> {
  try {
    const sesion = await obtenerUsuarioSesion();
    if (!sesion || sesion.rol !== "Administrador") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const lista = (await listarUsuarios()).sort((a, b) =>
      a.apellidos.localeCompare(b.apellidos, "es"),
    );

    const usuarios = lista.map((data) => {
      return {
        id: data.id,
        dni: data.dni,
        nombres: data.nombres,
        apellidos: data.apellidos,
        rol: data.rol,
        estado: data.estado,
        debeCambiarPassword: data.debeCambiarPassword,
        fechaCreacion: data.fechaCreacion,
        fechaActualizacion: data.fechaActualizacion,
        creadoPor: data.creadoPor,
      };
    });

    return NextResponse.json({ usuarios });
  } catch {
    return NextResponse.json({ error: "Error al listar usuarios." }, { status: 500 });
  }
}

/**
 * POST /api/usuarios
 * Crear un nuevo usuario (solo Administrador).
 * Genera contraseña temporal que debe cambiarse en primer ingreso.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const sesion = await obtenerUsuarioSesion();
    if (!sesion || sesion.rol !== "Administrador") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const body = await request.json();
    const {
      dni,
      nombres,
      apellidos,
      rol,
      estado = "activo",
      debeCambiarPassword,
    } = body as {
      dni?: string;
      nombres?: string;
      apellidos?: string;
      rol?: Rol;
      estado?: string;
      password?: string;
      debeCambiarPassword?: boolean;
    };

    // Validaciones
    if (!dni || !nombres || !apellidos || !rol) {
      return NextResponse.json(
        { error: "DNI, nombres, apellidos y rol son requeridos." },
        { status: 400 },
      );
    }

    if (!validarDNI(dni)) {
      return NextResponse.json(
        { error: "El DNI debe tener exactamente 8 dígitos numéricos." },
        { status: 400 },
      );
    }

    if (!["Administrador", "Supervisor", "Auxiliar"].includes(rol)) {
      return NextResponse.json(
        { error: "El rol indicado no es válido." },
        { status: 400 },
      );
    }

    // Verificar DNI único
    if (await buscarUsuarioPorDni(dni)) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese DNI." },
        { status: 409 },
      );
    }

    // Generar contraseña temporal si no se proporciona
    const passwordProvided = body.password;
    const passwordTemporal =
      passwordProvided ||
      randomBytes(10).toString("hex"); // contraseña temporal aleatoria

    if (!validarPassword(passwordTemporal)) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400 },
      );
    }

    const { hash, salt } = await hashPassword(passwordTemporal);
    const ahora = new Date().toISOString();

    const nuevoUsuario = {
      dni,
      nombres,
      apellidos,
      rol,
      estado,
      passwordHash: hash,
      passwordSalt: salt,
      debeCambiarPassword:
        typeof debeCambiarPassword === "boolean"
          ? debeCambiarPassword
          : !passwordProvided, // si se generó temporal, debe cambiarse
      fechaCreacion: ahora,
      fechaActualizacion: ahora,
      creadoPor: sesion.id,
      sessionToken: null,
      sessionExpiresAt: null,
    };

    const creado = await agregarUsuario(nuevoUsuario);

    return NextResponse.json({
      success: true,
      usuario: {
        id: creado.id,
        dni,
        nombres,
        apellidos,
        rol,
        estado,
        debeCambiarPassword: nuevoUsuario.debeCambiarPassword,
      },
      passwordTemporal: passwordProvided ? undefined : passwordTemporal,
      mensaje:
        passwordProvided
          ? "Usuario creado correctamente."
          : "Usuario creado. Contraseña temporal generada. Debe entregársela al usuario para su primer ingreso.",
    });
  } catch {
    return NextResponse.json({ error: "Error al crear usuario." }, { status: 500 });
  }
}