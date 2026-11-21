import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Almacén de usuarios y sesiones (reemplaza a Firestore).
 *
 * - En la nube (Vercel): usa Upstash Redis cuando existen las variables
 *   UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_URL y
 *   KV_REST_API_TOKEN, que crea la integración de Vercel).
 * - En tu equipo: guarda un archivo JSON en `data/usuarios.json`, que no se
 *   sube a GitHub.
 * Las escrituras se encolan para que dos peticiones a la vez no se pisen.
 */

export type UsuarioDoc = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  rol: string;
  estado: string;
  passwordHash: string;
  passwordSalt: string;
  debeCambiarPassword: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadoPor: string;
  sessionToken: string | null;
  sessionExpiresAt: string | null;
  ultimoAcceso?: string;
};

const DIRECTORIO = path.join(process.cwd(), "data");
const ARCHIVO = path.join(DIRECTORIO, "usuarios.json");

let cola: Promise<unknown> = Promise.resolve();

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const REDIS_CLAVE = "sira:usuarios";

/** Ejecuta un comando en Upstash Redis por su API REST. */
async function redis(comando: string[]): Promise<unknown> {
  const respuesta = await fetch(REDIS_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(comando),
    cache: "no-store",
  });
  if (!respuesta.ok) throw new Error(`Redis respondió ${respuesta.status}`);
  const cuerpo = (await respuesta.json()) as { result?: unknown; error?: string };
  if (cuerpo.error) throw new Error(cuerpo.error);
  return cuerpo.result;
}

async function leer(): Promise<UsuarioDoc[]> {
  if (REDIS_URL && REDIS_TOKEN) {
    const texto = await redis(["GET", REDIS_CLAVE]);
    if (typeof texto !== "string") return [];
    const datos: unknown = JSON.parse(texto);
    return Array.isArray(datos) ? (datos as UsuarioDoc[]) : [];
  }
  try {
    const texto = await fs.readFile(ARCHIVO, "utf8");
    const datos: unknown = JSON.parse(texto);
    return Array.isArray(datos) ? (datos as UsuarioDoc[]) : [];
  } catch {
    return [];
  }
}

async function escribir(usuarios: UsuarioDoc[]): Promise<void> {
  if (REDIS_URL && REDIS_TOKEN) {
    await redis(["SET", REDIS_CLAVE, JSON.stringify(usuarios)]);
    return;
  }
  await fs.mkdir(DIRECTORIO, { recursive: true });
  const temporal = `${ARCHIVO}.tmp`;
  await fs.writeFile(temporal, JSON.stringify(usuarios, null, 2), "utf8");
  await fs.rename(temporal, ARCHIVO);
}

/** Ejecuta un cambio sobre la lista de usuarios, de uno en uno. */
function modificar<T>(cambio: (usuarios: UsuarioDoc[]) => T | Promise<T>): Promise<T> {
  const tarea = cola.then(async () => {
    const usuarios = await leer();
    const resultado = await cambio(usuarios);
    await escribir(usuarios);
    return resultado;
  });
  cola = tarea.catch(() => undefined);
  return tarea;
}

export async function listarUsuarios(): Promise<UsuarioDoc[]> {
  return leer();
}

export async function buscarUsuarioPorId(id: string): Promise<UsuarioDoc | null> {
  return (await leer()).find((u) => u.id === id) ?? null;
}

export async function buscarUsuarioPorDni(dni: string): Promise<UsuarioDoc | null> {
  return (await leer()).find((u) => u.dni === dni) ?? null;
}

export async function buscarUsuarioPorToken(token: string): Promise<UsuarioDoc | null> {
  if (!token) return null;
  return (await leer()).find((u) => u.sessionToken === token) ?? null;
}

export async function existeAdministrador(): Promise<boolean> {
  return (await leer()).some((u) => u.rol === "Administrador");
}

export function agregarUsuario(datos: Omit<UsuarioDoc, "id">): Promise<UsuarioDoc> {
  return modificar((usuarios) => {
    const nuevo: UsuarioDoc = { id: randomUUID(), ...datos };
    usuarios.push(nuevo);
    return nuevo;
  });
}

export function actualizarUsuario(
  id: string,
  cambios: Partial<Omit<UsuarioDoc, "id">>,
): Promise<UsuarioDoc | null> {
  return modificar((usuarios) => {
    const indice = usuarios.findIndex((u) => u.id === id);
    if (indice === -1) return null;
    usuarios[indice] = { ...usuarios[indice], ...cambios };
    return usuarios[indice];
  });
}
