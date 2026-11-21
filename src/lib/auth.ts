import { randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 64;
const SESSION_TOKEN_BYTES = 32;

export const loginSchema = z.object({
  dni: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "El DNI debe tener exactamente 8 dígitos numéricos."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export type AuthUser = {
  id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  rol: string;
  displayName: string;
};

/**
 * Genera un hash PBKDF2-SHA256 de una contraseña.
 * Nunca guarda contraseñas en texto plano.
 */
export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require("crypto");
    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      "sha256",
      (err: Error | null, derivedKey: Buffer) => {
        if (err) return reject(err);
        resolve(derivedKey);
      },
    );
  });
  return {
    hash: derived.toString("hex"),
    salt,
  };
}

/**
 * Verifica una contraseña contra su hash almacenado.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
): Promise<boolean> {
  const crypto = require("crypto");
  return new Promise<boolean>((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      "sha256",
      (err: Error | null, derivedKey: Buffer) => {
        if (err) return reject(err);
        const provided = derivedKey.toString("hex");
        // Comparación en tiempo constante para evitar timing attacks
        resolve(
          timingSafeEqual(
            Buffer.from(storedHash, "hex"),
            Buffer.from(provided, "hex"),
          ),
        );
      },
    );
  });
}

/**
 * Genera un token de sesión aleatorio seguro.
 */
export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("hex");
}

/**
 * Valida que un DNI tenga exactamente 8 dígitos numéricos.
 */
export function validarDNI(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

/**
 * Valida que una contraseña tenga al menos 8 caracteres.
 */
export function validarPassword(password: string): boolean {
  return password.length >= 8;
}
