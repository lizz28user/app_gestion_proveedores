"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@/lib/auth";

const inputClasses =
  "block h-[52px] w-full rounded-full border border-[#d9dadd] bg-[#ffffff] pl-12 pr-4 text-base text-[#161618] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] placeholder:text-[#8a8c90] focus-visible:border-[#F02615] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F02615]/20 aria-invalid:border-red-500";

const etiquetaClasses = "text-[15px] font-bold text-white";

export function LoginForm() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      dni: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dni: values.dni,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAuthError(data.error || "Credenciales inválidas.");
        return;
      }

      if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setAuthError("No pudimos iniciar sesión. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
    >
      {authError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {authError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="dni" className={etiquetaClasses}>
          Usuario{" "}
          <span aria-hidden="true" className="text-[#ff5a4a]">
            *
          </span>
        </label>

        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#3d3e40]"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          <input
            id="dni"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            enterKeyHint="next"
            maxLength={8}
            placeholder="Ingresa tu usuario"
            aria-required="true"
            aria-invalid={errors.dni ? true : undefined}
            aria-describedby={errors.dni ? "dni-error" : undefined}
            className={inputClasses}
            {...register("dni")}
          />
        </div>

        {errors.dni ? (
          <p id="dni-error" role="alert" className="text-sm font-medium text-[#ff8a7d]">
            {errors.dni.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={etiquetaClasses}>
          Contraseña{" "}
          <span aria-hidden="true" className="text-[#ff5a4a]">
            *
          </span>
        </label>

        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#3d3e40]"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <input
            id="password"
            type={verPassword ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            placeholder="Ingresa tu contraseña"
            aria-required="true"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            className={`${inputClasses} pr-12`}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={verPassword}
            className="absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#3d3e40] transition-colors hover:bg-black/5 hover:text-[#E0230F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F02615]/40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {verPassword ? null : <path d="m3 3 18 18" />}
            </svg>
          </button>
        </div>

        {errors.password ? (
          <p id="password-error" role="alert" className="text-sm font-medium text-[#ff8a7d]">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="mt-1 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#F02615] px-6 text-xl font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_32px_-12px_rgba(240,38,21,0.95)] transition-[filter,transform] hover:brightness-110 active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F02615]/30 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="size-4 animate-spin"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 0 1 8-8"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            Iniciando sesión…
          </>
        ) : (
          <>
            Iniciar sesión
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-6"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}
