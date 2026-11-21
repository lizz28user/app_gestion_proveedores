"use client";

import { useEffect, useState } from "react";
import { TEMA_STORAGE_KEY, type TemaFp } from "@/lib/tema";

const TEMAS: { id: TemaFp; nombre: string; muestra: string }[] = [
  { id: "negro", nombre: "Negro", muestra: "#1b1c23" },
  { id: "gris", nombre: "Gris", muestra: "#b9bbbf" },
];

function aplicarTema(tema: TemaFp) {
  const clases = document.documentElement.classList;
  clases.remove("theme-negro", "theme-gris", "theme-blanco", "dark");
  clases.add("fp", `theme-${tema}`);
  if (tema === "negro") clases.add("dark");
  document.documentElement.style.colorScheme = tema === "negro" ? "dark" : "light";
  try {
    window.localStorage.setItem(TEMA_STORAGE_KEY, tema);
  } catch {
    // Sin persistencia si localStorage no está disponible.
  }
}

/** Selector de tema: dos muestras de color (Negro y Gris). */
export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<TemaFp>("negro");

  useEffect(() => {
    const clases = document.documentElement.classList;
    if (clases.contains("theme-gris")) setTema("gris");
    else setTema("negro");
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className={`inline-flex items-center gap-1 rounded-xl border border-fp-line bg-fp-surface p-1 ${className}`}
    >
      {TEMAS.map((opcion) => {
        const activo = tema === opcion.id;
        return (
          <button
            key={opcion.id}
            type="button"
            role="radio"
            aria-checked={activo}
            title={`Tema ${opcion.nombre}`}
            onClick={() => {
              aplicarTema(opcion.id);
              setTema(opcion.id);
            }}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activo
                ? "bg-fp-surface-hover text-fp-ink shadow-[inset_0_0_0_1px_var(--fp-line-strong)]"
                : "text-fp-faint hover:text-fp-ink"
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-3.5 rounded-full border ${activo ? "border-[#F02615] ring-2 ring-[#F02615]/30" : "border-fp-line-strong"}`}
              style={{ background: opcion.muestra }}
            />
            <span className="hidden 2xl:inline">{opcion.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}
