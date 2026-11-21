"use client";

import type { ReactNode } from "react";

// Input: claro → blanco/texto oscuro; oscuro → zinc-950/texto claro
const inputClasses =
  "h-11 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm text-slate-900 dark:text-zinc-100 shadow-sm transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:focus-visible:border-red-500 aria-invalid:border-red-600 dark:aria-invalid:border-red-500";

const labelClasses =
  "flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-zinc-300";

const requiredLabel = <span className="text-red-500">*</span>;

export function ReceptionInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  className = inputClasses,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClasses}>
        {label}
        {required && requiredLabel}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}

export function ReceptionSelect({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
  className = inputClasses,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClasses}>
        {label}
        {required && requiredLabel}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        className={className}
      >
        <option value="">Seleccionar</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ReceptionTextarea({
  id,
  label,
  value,
  onChange,
  required = false,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClasses}>
        {label}
        {required && requiredLabel}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder="Describe lo ocurrido…"
        rows={rows}
        className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600/20 dark:focus-visible:border-red-500"
      />
    </div>
  );
}

export function ReceptionButton({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  loading = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants: Record<string, string> = {
    primary:
      "bg-red-700 text-white shadow-sm hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 focus-visible:ring-red-600 dark:focus-visible:ring-red-500",
    secondary:
      "border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/50 focus-visible:ring-slate-600 dark:focus-visible:ring-zinc-600",
    outline:
      "border border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/30 focus-visible:ring-slate-600 dark:focus-visible:ring-zinc-600",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading || !onClick}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 animate-spin"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 11-6.24 1.55L18 10.28" />
          </svg>
          Guardando…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function ReceptionBadge({
  status,
  type = "status",
}: {
  status: string;
  type?: "status" | "homologacion" | "resultado";
}) {
  const classes: Record<string, Record<string, string>> = {
    status: {
      avance: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
      finalizada:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
      pendiente:
        "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300",
    },
    homologacion: {
      Vigente: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      Vencida: "bg-red-500/10 text-red-400 border border-red-500/20",
      "No homologado":
        "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    },
    resultado: {
      "sin-rechazo": "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
      "rechazo-parcial": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
      "rechazo-total": "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
    },
  };

  const icons: Record<string, string> = {
    avance: "↻",
    finalizada: "✓",
    pendiente: "○",
    Vigente: "✓",
    Vencida: "✕",
    "No homologado": "○",
  };

  const cls = classes[type][status] ?? classes[type].pendiente ?? "";
  const icon = icons[status] ?? "";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {icon} {status}
    </span>
  );
}

export function SectionHeader({
  number,
  title,
}: {
  number: number;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5 text-slate-500 dark:text-zinc-500"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <h2 className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
        {number}. {title}
      </h2>
    </div>
  );
}

export function ReadOnlyField({
  label,
  value,
  badgeVariant,
}: {
  label: string;
  value: string;
  badgeVariant?: "emerald" | "red" | "amber" | "default";
}) {
  const badgeClasses: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    red: "bg-red-500/10 text-red-400 border border-red-500/20",
    amber: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    default: "bg-slate-200 dark:bg-zinc-800/50 text-slate-700 dark:text-zinc-400",
  };

  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses[badgeVariant ?? "default"]}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
