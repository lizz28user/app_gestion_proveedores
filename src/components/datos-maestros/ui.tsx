"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { buscarProducto, verificarPasswordAdmin, type Producto } from "@/lib/catalogo";

export const CAMPO =
  "h-11 w-full rounded-xl border border-fp-line-strong bg-fp-surface px-3 text-sm text-fp-ink placeholder:text-fp-faint transition-colors focus-visible:border-[#F02615] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F02615]/15 disabled:opacity-60";

export const BOTON_PRIMARIO =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#F02615] px-4 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_24px_-12px_rgba(240,38,21,0.95)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F02615]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const BOTON_SECUNDARIO =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-fp-line-strong bg-fp-surface px-4 text-sm font-semibold text-fp-ink transition hover:bg-fp-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const BOTON_PELIGRO =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#F02615]/40 bg-[#F02615]/10 px-4 text-sm font-semibold text-[#F02615] transition hover:bg-[#F02615]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F02615]/40 disabled:cursor-not-allowed disabled:opacity-50";

/** Encabezado de pantalla del módulo Datos maestros. */
export function Encabezado({
  titulo,
  descripcion,
  acciones,
  modulo = "Datos maestros",
}: {
  titulo: string;
  descripcion: string;
  acciones?: ReactNode;
  modulo?: string;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="eyebrow">{modulo}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-fp-ink sm:text-3xl">{titulo}</h1>
        {/* La descripción se conserva como texto accesible, sin mostrarse. */}
        <p className="sr-only">{descripcion}</p>
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </header>
  );
}

export function Indicador({
  etiqueta,
  valor,
  detalle,
  color,
  alerta = false,
}: {
  etiqueta: string;
  valor: number | string;
  detalle?: string;
  color: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`glass relative overflow-hidden rounded-2xl p-4 ${alerta ? "!border-[#F02615]/45" : ""}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${color}38 0%, transparent 70%)`,
        boxShadow: `0 22px 40px -22px ${color}b0, 0 14px 28px -16px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${color}33`,
      }}
    >
      <p className="flex items-center justify-between text-[10.5px] font-bold uppercase tracking-[0.16em] text-fp-dim">
        {etiqueta}
        <span
          aria-hidden="true"
          className="size-2.5 rotate-45 rounded-[2px]"
          style={{ background: color, boxShadow: `0 0 12px ${color}` }}
        />
      </p>
      <p
        className={`mt-2 text-[28px] font-extrabold leading-none tracking-tight tabular-nums ${alerta ? "text-[#F02615]" : "text-fp-ink"}`}
      >
        {typeof valor === "number" ? valor.toLocaleString("es-PE") : valor}
      </p>
      {detalle ? <p className="mt-1.5 text-xs text-fp-faint">{detalle}</p> : null}
    </div>
  );
}

export type Aviso = { tipo: "exito" | "error"; texto: string } | null;

export function AvisoBanner({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  return (
    <div
      role={aviso.tipo === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        aviso.tipo === "exito"
          ? "border-[#2FBF71]/35 bg-[#2FBF71]/10 text-fp-ink"
          : "border-[#F02615]/40 bg-[#F02615]/10 text-fp-ink"
      }`}
    >
      {aviso.texto}
    </div>
  );
}

/** Hook para avisos que desaparecen solos. */
export function useAviso(): [Aviso, (aviso: Aviso) => void] {
  const [aviso, setAviso] = useState<Aviso>(null);
  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), 5000);
    return () => window.clearTimeout(id);
  }, [aviso]);
  return [aviso, setAviso];
}

export function Modal({
  titulo,
  onCerrar,
  children,
  ancho = "max-w-lg",
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: string;
}) {
  const tituloId = useId();
  useEffect(() => {
    function teclado(event: KeyboardEvent) {
      if (event.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", teclado);
    return () => document.removeEventListener("keydown", teclado);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className={`glass relative max-h-[90vh] w-full ${ancho} overflow-y-auto rounded-[20px] !bg-[var(--drawer)] p-6`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={tituloId} className="text-lg font-extrabold tracking-tight text-fp-ink">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="inline-flex size-8 items-center justify-center rounded-lg text-fp-faint transition hover:bg-fp-surface hover:text-fp-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Pide la contraseña del Administrador y la verifica en el servidor. */
export function ConfirmarPasswordModal({
  titulo,
  mensaje,
  textoBoton,
  peligro = false,
  onConfirmado,
  onCerrar,
}: {
  titulo: string;
  mensaje: string;
  textoBoton: string;
  peligro?: boolean;
  onConfirmado: () => void;
  onCerrar: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerificando(true);
    setError(null);
    const fallo = await verificarPasswordAdmin(password);
    setVerificando(false);
    if (fallo) {
      setError(fallo);
      setPassword("");
      return;
    }
    onConfirmado();
  }

  return (
    <Modal titulo={titulo} onCerrar={onCerrar} ancho="max-w-md">
      <form onSubmit={enviar} className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fp-dim">{mensaje}</p>
        <label className="flex flex-col gap-2 text-sm font-semibold text-fp-ink" htmlFor="password-admin">
          Contraseña del Administrador
          <input
            ref={inputRef}
            id="password-admin"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={CAMPO}
            required
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-medium text-[#F02615]">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={verificando || !password}
            className={peligro ? BOTON_PELIGRO : BOTON_PRIMARIO}
          >
            {verificando ? "Verificando…" : textoBoton}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Campo SKU con validación contra el Catálogo.
 * Muestra si el SKU existe y los datos del producto encontrado.
 */
export function CampoSku({
  id,
  valor,
  onCambio,
  productos,
  catalogoVacio,
  disabled = false,
}: {
  id: string;
  valor: string;
  onCambio: (valor: string, producto: Producto | null) => void;
  productos: Record<string, Producto>;
  catalogoVacio: boolean;
  disabled?: boolean;
}) {
  const producto = buscarProducto(productos, valor);
  const escrito = valor.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-fp-ink">
        SKU <span className="text-[#F02615]">*</span>
      </label>
      <input
        id={id}
        value={valor}
        disabled={disabled}
        autoComplete="off"
        inputMode="text"
        placeholder="Ej. 100245"
        onChange={(event) => {
          const nuevo = event.target.value;
          onCambio(nuevo, buscarProducto(productos, nuevo));
        }}
        aria-invalid={escrito && !producto ? true : undefined}
        aria-describedby={`${id}-estado`}
        className={`${CAMPO} font-mono uppercase ${escrito && !producto ? "!border-[#F02615]" : ""} ${producto ? "!border-[#2FBF71]" : ""}`}
      />
      <p id={`${id}-estado`} className="text-xs" aria-live="polite">
        {catalogoVacio ? (
          <span className="font-semibold text-[#c98f00]">
            El catálogo está vacío. El Administrador debe cargarlo antes de registrar.
          </span>
        ) : !escrito ? (
          <span className="text-fp-faint">Escribe el SKU para buscarlo en el catálogo.</span>
        ) : producto ? (
          <span className="font-semibold text-[#1f9d5b]">SKU encontrado en el catálogo.</span>
        ) : (
          <span className="font-semibold text-[#F02615]">
            Este SKU no existe en el catálogo. No se puede registrar.
          </span>
        )}
      </p>
      {producto ? (
        <dl className="grid grid-cols-3 gap-2 rounded-xl border border-fp-line bg-fp-sunken p-3 text-xs">
          <div>
            <dt className="font-bold uppercase tracking-wider text-fp-faint">MP</dt>
            <dd className="mt-0.5 font-semibold text-fp-ink">{producto.mp || "—"}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wider text-fp-faint">Unds pallet</dt>
            <dd className="mt-0.5 font-semibold text-fp-ink">{producto.undsPallet || "—"}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-wider text-fp-faint">Carga Titan</dt>
            <dd className="mt-0.5 font-semibold text-fp-ink">{producto.cargaTitan || "—"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

const ESTADO_COLORES: Record<string, { fondo: string; texto: string }> = {
  Pendiente: { fondo: "rgba(250,183,1,0.15)", texto: "#b07d00" },
  "En Proceso": { fondo: "rgba(127,178,255,0.18)", texto: "#3f74c9" },
  Resuelta: { fondo: "rgba(47,191,113,0.15)", texto: "#1f9d5b" },
};

export function EstadoBadge({ estado }: { estado: string }) {
  const color = ESTADO_COLORES[estado] ?? { fondo: "var(--fp-surface)", texto: "inherit" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: color.fondo, color: color.texto }}
    >
      {estado}
    </span>
  );
}

/** Paginación simple para tablas grandes. */
export function usePaginacion<T>(items: T[], porPagina = 50) {
  const [pagina, setPagina] = useState(1);
  const paginas = Math.max(1, Math.ceil(items.length / porPagina));
  useEffect(() => {
    if (pagina > paginas) setPagina(1);
  }, [pagina, paginas]);
  const visibles = items.slice((pagina - 1) * porPagina, pagina * porPagina);
  return { visibles, pagina, paginas, setPagina, total: items.length, porPagina };
}

export function Paginador({
  pagina,
  paginas,
  total,
  porPagina,
  setPagina,
}: {
  pagina: number;
  paginas: number;
  total: number;
  porPagina: number;
  setPagina: (p: number) => void;
}) {
  if (total === 0) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fp-line px-4 py-3 text-xs text-fp-dim">
      <p>
        Mostrando {desde.toLocaleString("es-PE")}–{hasta.toLocaleString("es-PE")} de{" "}
        {total.toLocaleString("es-PE")}
      </p>
      {paginas > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPagina(Math.max(1, pagina - 1))}
            disabled={pagina === 1}
            className="rounded-lg border border-fp-line px-3 py-1.5 font-semibold text-fp-ink disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="tabular-nums">
            {pagina} / {paginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina(Math.min(paginas, pagina + 1))}
            disabled={pagina === paginas}
            className="rounded-lg border border-fp-line px-3 py-1.5 font-semibold text-fp-ink disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function formatearFechaHora(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatearFechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
