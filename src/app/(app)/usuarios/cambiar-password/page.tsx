"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClasses =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500";

export default function CambiarPasswordPage() {
  const router = useRouter();
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (passwordNueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (passwordNueva !== passwordConfirmar) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    if (passwordNueva === passwordActual) {
      setError("La nueva contraseña debe ser diferente a la actual.");
      return;
    }

    setGuardando(true);
    try {
      const response = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ passwordActual, passwordNueva }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "No se pudo cambiar la contraseña.");
        return;
      }

      router.push(data.redirect || "/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-100 p-4 dark:bg-zinc-950 sm:p-6">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <div className="mx-auto max-w-sm">
            <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-3xl">
              Cambiar contraseña
            </h1>
            <p className="mb-6 text-sm text-slate-500 dark:text-zinc-400">
              Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.
            </p>

            {error ? (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
              >
                {error}
              </p>
            ) : null}

            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div>
                <label
                  htmlFor="password-actual"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Contraseña actual (temporal)
                </label>
                <input
                  id="password-actual"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={passwordActual}
                  onChange={(event) => setPasswordActual(event.target.value)}
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="password-nueva"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Nueva contraseña
                </label>
                <input
                  id="password-nueva"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={passwordNueva}
                  onChange={(event) => setPasswordNueva(event.target.value)}
                  className={inputClasses}
                />
              </div>

              <div>
                <label
                  htmlFor="password-confirmar"
                  className="block text-sm font-medium text-slate-700 dark:text-zinc-300"
                >
                  Confirmar nueva contraseña
                </label>
                <input
                  id="password-confirmar"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={passwordConfirmar}
                  onChange={(event) => setPasswordConfirmar(event.target.value)}
                  className={inputClasses}
                />
              </div>

              <button
                type="submit"
                disabled={guardando}
                aria-busy={guardando}
                className="flex w-full justify-center rounded-lg bg-red-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {guardando ? "Guardando…" : "Cambiar contraseña"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
