"use client";

import { useEffect, useState } from "react";
import { ROL_DESCRIPCIONES, type Rol } from "@/lib/permissions";

const ROL_LABELS: Record<string, string> = {
  Administrador: "Administrador",
  Supervisor: "Supervisor",
  Auxiliar: "Auxiliar / Operario",
};

const ESTADO_LABELS: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
};

const ROL_CLASSES: Record<string, string> = {
  Administrador: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Supervisor: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Auxiliar: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
};

const ESTADO_CLASSES: Record<string, string> = {
  activo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  inactivo: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
};

type UsuarioRow = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  rol: string;
  estado: string;
  debeCambiarPassword: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadoPor: string | null;
};

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"crear" | "editar">("crear");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "exito" | "error" } | null>(null);

  // Formulario
  const [dni, setDni] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [rol, setRol] = useState<Rol>("Auxiliar");
  const [estado, setEstado] = useState<"activo" | "inactivo">("activo");
  const [password, setPassword] = useState("");
  const [debeCambiarPassword, setDebeCambiarPassword] = useState(true);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  async function cargarUsuarios() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/usuarios", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("No se pudo cargar la lista de usuarios.");
      }
      const data = await response.json();
      setUsuarios(data.usuarios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar usuarios.");
    } finally {
      setLoading(false);
    }
  }

  async function crearUsuario() {
    if (!dni || !nombres || !apellidos || !rol) {
      setMensaje({ texto: "Completa todos los campos obligatorios.", tipo: "error" });
      return;
    }
    setGuardando(true);
    try {
      const response = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dni, nombres, apellidos, rol, estado, password: password || undefined, debeCambiarPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMensaje({ texto: data.error || "Error al crear usuario.", tipo: "error" });
        setGuardando(false);
        return;
      }
      setMensaje({ texto: data.mensaje || "Usuario creado correctamente.", tipo: "exito" });
      setModalOpen(false);
      resetForm();
      await cargarUsuarios();
      if (data.passwordTemporal) {
        setMensaje({
          texto: `Contraseña temporal generada: ${data.passwordTemporal}. Entrégasela al usuario.`,
          tipo: "exito",
        });
      }
    } catch {
      setMensaje({ texto: "Error al crear usuario.", tipo: "error" });
    } finally {
      setGuardando(false);
    }
  }

  async function editarUsuario(id: string) {
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) return;
    setEditandoId(id);
    setModalMode("editar");
    setDni(usuario.dni);
    setNombres(usuario.nombres);
    setApellidos(usuario.apellidos);
    setRol(usuario.rol as Rol);
    setEstado(usuario.estado as "activo" | "inactivo");
    setDebeCambiarPassword(usuario.debeCambiarPassword);
    setPassword("");
    setModalOpen(true);
  }

  async function guardarEdicion() {
    if (!editandoId) return;
    setGuardando(true);
    try {
      const response = await fetch(`/api/usuarios/${editandoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dni,
          nombres,
          apellidos,
          rol,
          estado,
          password: password || undefined,
          debeCambiarPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMensaje({ texto: data.error || "Error al actualizar usuario.", tipo: "error" });
        setGuardando(false);
        return;
      }
      setMensaje({ texto: "Usuario actualizado correctamente.", tipo: "exito" });
      setModalOpen(false);
      setEditandoId(null);
      resetForm();
      await cargarUsuarios();
    } catch {
      setMensaje({ texto: "Error al actualizar usuario.", tipo: "error" });
    } finally {
      setGuardando(false);
    }
  }

  async function restablecerPassword(id: string) {
    if (!confirm("¿Restablecer la contraseña de este usuario? Se generará una nueva contraseña temporal.")) return;
    setGuardando(true);
    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMensaje({ texto: data.error || "Error al restablecer contraseña.", tipo: "error" });
        return;
      }
      setMensaje({
        texto: data.passwordTemporal
          ? `Contraseña restablecida. Temporal: ${data.passwordTemporal}. El usuario debe cambiarla en su próximo ingreso.`
          : "Contraseña restablecida. El usuario debe cambiarla en su próximo ingreso.",
        tipo: "exito",
      });
      await cargarUsuarios();
    } catch {
      setMensaje({ texto: "Error al restablecer contraseña.", tipo: "error" });
    } finally {
      setGuardando(false);
    }
  }

  async function toggleEstado(id: string) {
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) return;
    const nuevoEstado = usuario.estado === "activo" ? "inactivo" : "activo";
    setGuardando(true);
    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!response.ok) {
        const data = await response.json();
        setMensaje({ texto: data.error || "Error al cambiar estado.", tipo: "error" });
        setGuardando(false);
        return;
      }
      setMensaje({ texto: `Usuario ${nuevoEstado === "activo" ? "activado" : "desactivado"} correctamente.`, tipo: "exito" });
      await cargarUsuarios();
    } catch {
      setMensaje({ texto: "Error al cambiar estado.", tipo: "error" });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarUsuario(id: string) {
    if (!confirm("¿Desactivar este usuario? Se marcará como inactivo y no podrá iniciar sesión.")) return;
    setGuardando(true);
    try {
      const response = await fetch(`/api/usuarios/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json();
        setMensaje({ texto: data.error || "Error al desactivar usuario.", tipo: "error" });
        setGuardando(false);
        return;
      }
      setMensaje({ texto: "Usuario desactivado correctamente.", tipo: "exito" });
      await cargarUsuarios();
    } catch {
      setMensaje({ texto: "Error al desactivar usuario.", tipo: "error" });
    } finally {
      setGuardando(false);
    }
  }

  function resetForm() {
    setDni("");
    setNombres("");
    setApellidos("");
    setRol("Auxiliar");
    setEstado("activo");
    setPassword("");
    setDebeCambiarPassword(true);
    setEditandoId(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-100 dark:bg-zinc-950 p-4 sm:p-6">
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-zinc-400">Cargando usuarios…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-3xl">
              Gestión de usuarios
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Crea usuarios, asigna roles, restablece contraseñas y activa o desactiva cuentas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModalMode("crear");
              setEditandoId(null);
              resetForm();
              setModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <span className="text-red-400">+</span> Nuevo usuario
          </button>
        </header>

        {mensaje && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              mensaje.tipo === "exito"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20"
                : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/30 dark:bg-red-900/20"
            }`}
          >
            {mensaje.texto}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Listado de usuarios del sistema</caption>
                <thead>
                  <tr className="bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
                    <th scope="col" className="px-5 py-3 font-bold">DNI</th>
                    <th scope="col" className="px-5 py-3 font-bold">Nombre completo</th>
                    <th scope="col" className="px-5 py-3 font-bold">Rol</th>
                    <th scope="col" className="px-5 py-3 font-bold">Estado</th>
                    <th scope="col" className="px-5 py-3 font-bold">Cambiar clave</th>
                    <th scope="col" className="px-5 py-3 font-bold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {usuarios.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500 dark:text-zinc-400">
                        No hay usuarios registrados.
                      </td>
                    </tr>
                  ) : (
                    usuarios.map((usuario) => (
                      <tr key={usuario.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                        <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300 font-mono">
                          {usuario.dni}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-zinc-200">
                          {usuario.nombres} {usuario.apellidos}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              ROL_CLASSES[usuario.rol] ?? ""
                            }`}
                          >
                            {ROL_LABELS[usuario.rol] ?? usuario.rol}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              ESTADO_CLASSES[usuario.estado] ?? ""
                            }`}
                          >
                            {ESTADO_LABELS[usuario.estado] ?? usuario.estado}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                          {usuario.debeCambiarPassword ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400">Sí</span>
                          ) : (
                            <span className="text-xs text-slate-500">No</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => editarUsuario(usuario.id)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 border border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => restablecerPassword(usuario.id)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-amber-600 border border-amber-600 hover:bg-amber-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 dark:text-amber-400 dark:border-amber-400 dark:hover:bg-amber-900/20 dark:focus-visible:ring-offset-zinc-900"
                            >
                              Clave
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleEstado(usuario.id)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-400 border border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                            >
                              {usuario.estado === "activo" ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarUsuario(usuario.id)}
                              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 border border-red-700 hover:bg-red-700/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal de usuario */}
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center ${modalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none transition-opacity duration-300"}`}
        >
          <div
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md mx-4 sm:mx-0">
            <div className="rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">
                  {modalMode === "crear" ? "Nuevo usuario" : "Editar usuario"}
                </h2>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-offset-zinc-900"
                >
                  ×
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); modalMode === "crear" ? crearUsuario() : guardarEdicion(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                      DNI <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                      placeholder="12345678"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                      Nombres <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nombres}
                      onChange={(e) => setNombres(e.target.value)}
                      placeholder="Nombres"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                      Apellidos <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                      placeholder="Apellidos"
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                      Rol <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={rol}
                      onChange={(e) => setRol(e.target.value as Rol)}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500"
                    >
                      <option value="Auxiliar">Auxiliar / Operario</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                    <p className="text-xs leading-relaxed text-fp-dim">
                      {ROL_DESCRIPCIONES[rol]}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                      Estado <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={estado}
                      onChange={(e) => setEstado(e.target.value as "activo" | "inactivo")}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500"
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300">
                      Contraseña <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={modalMode === "crear" ? "Contraseña (deja vacío para generar temporal)" : "Nueva contraseña (opcional)"}
                      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500"
                    />
                    {modalMode === "crear" && (
                      <p className="text-xs text-slate-500 mt-1">
                        Si lo dejas vacío, se generará una contraseña temporal.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="debeCambiarPassword"
                    checked={debeCambiarPassword}
                    onChange={(e) => setDebeCambiarPassword(e.target.checked)}
                    className="rounded-red-700 text-red-600 focus:ring-red-600"
                  />
                  <label htmlFor="debeCambiarPassword" className="text-sm text-slate-600 dark:text-zinc-400">
                    El usuario debe cambiar la contraseña en su primer ingreso
                  </label>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {guardando ? "Guardando…" : modalMode === "crear" ? "Crear usuario" : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
