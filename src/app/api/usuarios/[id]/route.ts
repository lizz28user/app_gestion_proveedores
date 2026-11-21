import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  actualizarUsuario,
  buscarUsuarioPorDni,
  buscarUsuarioPorId,
  type UsuarioDoc,
} from "@/lib/almacen-usuarios";
import {
  hashPassword,
  validarDNI,
  validarPassword,
} from "@/lib/auth";
import { esRol } from "@/lib/permissions";
import { esAdministrador } from "@/lib/sesion-servidor";

/**
 * GET /api/usuarios/[id]
 * Obtener un usuario por ID (solo Administrador).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    if (!(await esAdministrador())) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { id } = await params;
    const data = await buscarUsuarioPorId(id);
    if (!data) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener usuario." }, { status: 500 });
  }
}

/**
 * PUT /api/usuarios/[id]
 * Actualizar un usuario (solo Administrador).
 * Permite cambiar rol, estado, nombres, apellidos, DNI, contraseña.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    if (!(await esAdministrador())) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      dni,
      nombres,
      apellidos,
      rol,
      estado,
      password,
      debeCambiarPassword,
      resetPassword,
    } = body as {
      dni?: string;
      nombres?: string;
      apellidos?: string;
      rol?: string;
      estado?: string;
      password?: string;
      debeCambiarPassword?: boolean;
      resetPassword?: boolean;
    };

    const data = await buscarUsuarioPorId(id);
    if (!data) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    if (rol !== undefined && !esRol(rol)) {
      return NextResponse.json(
        { error: "El rol indicado no es válido." },
        { status: 400 },
      );
    }
    if (estado !== undefined && estado !== "activo" && estado !== "inactivo") {
      return NextResponse.json(
        { error: "El estado indicado no es válido." },
        { status: 400 },
      );
    }

    // Validar DNI único si se cambia
    if (dni && dni !== data.dni) {
      if (!validarDNI(dni)) {
        return NextResponse.json(
          { error: "El DNI debe tener exactamente 8 dígitos numéricos." },
          { status: 400 },
        );
      }
      if (await buscarUsuarioPorDni(dni)) {
        return NextResponse.json(
          { error: "Ya existe un usuario con ese DNI." },
          { status: 409 },
        );
      }
    }

    const actualizar: Partial<Omit<UsuarioDoc, "id">> = {
      fechaActualizacion: new Date().toISOString(),
    };

    if (dni) actualizar.dni = dni;
    if (nombres) actualizar.nombres = nombres;
    if (apellidos) actualizar.apellidos = apellidos;
    if (rol) actualizar.rol = rol;
    if (estado) actualizar.estado = estado;
    if (typeof debeCambiarPassword === "boolean") {
      actualizar.debeCambiarPassword = debeCambiarPassword;
    }

    // Si se proporciona nueva contraseña, hashearla
    if (password) {
      if (!validarPassword(password)) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 8 caracteres." },
          { status: 400 },
        );
      }
      const { hash, salt } = await hashPassword(password);
      actualizar.passwordHash = hash;
      actualizar.passwordSalt = salt;
      actualizar.debeCambiarPassword = false;
    }

    // Restablecer contraseña: genera una temporal y obliga a cambiarla.
    let passwordTemporal: string | undefined;
    if (resetPassword) {
      passwordTemporal = randomBytes(10).toString("hex");
      const { hash, salt } = await hashPassword(passwordTemporal);
      actualizar.passwordHash = hash;
      actualizar.passwordSalt = salt;
      actualizar.debeCambiarPassword = true;
      actualizar.sessionToken = null;
      actualizar.sessionExpiresAt = null;
    }

    await actualizarUsuario(id, actualizar);

    return NextResponse.json({ success: true, id, passwordTemporal });
  } catch {
    return NextResponse.json({ error: "Error al actualizar usuario." }, { status: 500 });
  }
}

/**
 * DELETE /api/usuarios/[id]
 * Desactivar (soft delete) un usuario (solo Administrador).
 * No se elimina físicamente para preservar auditoría.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    if (!(await esAdministrador())) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const { id } = await params;
    if (!(await buscarUsuarioPorId(id))) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    // Soft delete: marcar como inactivo y invalidar sesión
    await actualizarUsuario(id, {
      estado: "inactivo",
      sessionToken: null,
      sessionExpiresAt: null,
      fechaActualizacion: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: "Error al desactivar usuario." }, { status: 500 });
  }
}