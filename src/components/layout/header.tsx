"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSession } from "@/lib/use-session";
import { ThemeSwitcher } from "@/components/theme-switcher";

type HeaderProps = {
  onOpenMobileSidebar: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  mobileOpen: boolean;
};

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Panel general",
    subtitle: "Secciones disponibles",
  },
  "/garita/registro-de-llegada": {
    title: "Registro de llegada",
    subtitle: "Garita · Llegadas del día",
  },
  "/garita/gestion-recepcion": {
    title: "Gestión de recepción",
    subtitle: "Garita · Andenes y descarga",
  },
  "/garita/historico-llegadas": {
    title: "Histórico de llegadas",
    subtitle: "Garita · Consulta de registros",
  },
  "/usuarios": {
    title: "Gestión de usuarios",
    subtitle: "Seguridad · Usuarios y roles",
  },
  "/usuarios/cambiar-password": {
    title: "Cambiar contraseña",
    subtitle: "Seguridad",
  },
  "/agendamientos/dashboard": {
    title: "Dashboard",
    subtitle: "Agendamientos · Resumen de la agenda",
  },
  "/agendamientos/incidencias-de-proveedores": {
    title: "Incidencias de proveedores",
    subtitle: "Agendamientos",
  },
  "/agendamientos/reportes-de-citas": {
    title: "Reportes de citas",
    subtitle: "Agendamientos",
  },
  "/datos-maestros/incidencias": {
    title: "Incidencias",
    subtitle: "Gestión de datos maestros",
  },
  "/datos-maestros/cambio-mp": {
    title: "Cambio MP",
    subtitle: "Gestión de datos maestros",
  },
  "/datos-maestros/catalogo-de-productos": {
    title: "Catálogo de productos",
    subtitle: "Gestión de datos maestros",
  },
};

const DEFAULT_META = {
  title: "Panel general",
  subtitle: "Secciones disponibles",
};

export function Header({
  onOpenMobileSidebar,
  onToggleCollapse,
  collapsed,
  mobileOpen,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario } = useSession();
  const [busqueda, setBusqueda] = useState("");
  const [hora, setHora] = useState<string | null>(null);
  const meta =
    PAGE_META[pathname] ??
    (pathname.startsWith("/garita/gestion-recepcion/")
      ? { title: "Detalle de recepción", subtitle: "Garita · Gestión de recepción" }
      : DEFAULT_META);
  const nombreCompleto = usuario
    ? `${usuario.nombres} ${usuario.apellidos}`.trim()
    : "Usuario";
  const iniciales = usuario
    ? `${usuario.nombres.charAt(0)}${usuario.apellidos.charAt(0)}`.toUpperCase()
    : "?";

  // Reloj del turno (se actualiza cada segundo, solo en el cliente).
  useEffect(() => {
    const formato = new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setHora(formato.format(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const termino = busqueda.trim();
    if (!termino) return;
    router.push(
      `/garita/registro-de-llegada?q=${encodeURIComponent(termino)}`,
    );
  }

  return (
    <header   className="
    glass-bar
    sticky top-0 z-30
    flex h-[80px] min-h-[80px]
    shrink-0 items-center gap-3
    border-b border-fp-line
    px-4 sm:px-6 lg:px-8
    overflow-visible
  ">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-[#F02615] via-[#F02615]/30 to-transparent"
      />
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        aria-label="Abrir menú de navegación"
        aria-controls="mobile-sidebar"
        aria-expanded={mobileOpen}
        className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
      >
        <MenuIcon className="size-5" />
      </button>

      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
        aria-controls="app-sidebar"
        aria-expanded={!collapsed}
        className="hidden size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:inline-flex"
      >
        {collapsed ? (
          <PanelLeftOpenIcon className="size-5" />
        ) : (
          <PanelLeftCloseIcon className="size-5" />
        )}
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-visible">
        <span
          aria-hidden="true"
          className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F02615] to-[#a3180c] text-white shadow-[0_12px_24px_-8px_rgba(240,38,21,0.85),inset_0_1px_0_rgba(255,255,255,0.35)] sm:inline-flex"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
          >
            {iconoDeRuta(pathname)}
          </svg>
        </span>
        <h1 className="whitespace-nowrap py-1.5 text-lg font-extrabold leading-snug tracking-tight text-fp-ink max-sm:truncate sm:text-[22px] sm:leading-snug">
          {meta.title}
        </h1>
      </div>

      <form role="search" onSubmit={buscar} className="relative hidden md:block">
        <label htmlFor="global-search" className="sr-only">
          Buscar proveedor, RUC o placa
        </label>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fp-faint"
        >
          <SearchIcon className="size-4" />
        </span>
        <input
          id="global-search"
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Proveedor, RUC o placa…"
          className="h-10 w-56 rounded-xl border border-fp-line-strong bg-fp-surface pl-9 pr-3 text-sm text-foreground placeholder:text-fp-faint focus-visible:border-[#F02615] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F02615]/20 xl:w-72"
        />
      </form>

      <div className="flex items-center gap-2">
        <ThemeSwitcher className="hidden sm:inline-flex" />

        <span className="hidden items-center gap-2 text-xs text-fp-dim xl:flex">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-fp-ok opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-fp-ok" />
          </span>
          En línea
        </span>

        <span
          className="hidden rounded-xl border border-fp-line bg-fp-surface px-3 py-2 font-mono text-[13px] tabular-nums text-fp-ink sm:inline-block"
          aria-label="Hora actual"
          suppressHydrationWarning
        >
          {hora ?? "--:--:--"}
        </span>

        <button
          type="button"
          aria-label="Notificaciones"
          className="relative inline-flex size-10 items-center justify-center rounded-xl border border-fp-line bg-fp-surface text-fp-dim transition-colors hover:border-fp-line-strong hover:text-fp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BellIcon className="size-[18px]" />
        </button>

        <span
          title={`${nombreCompleto}${usuario ? ` · ${usuario.rol}` : ""}`}
          className="inline-flex size-10 items-center justify-center rounded-full bg-[#F02615] text-sm font-bold text-white shadow-[0_0_0_2px_rgba(255,255,255,0.12),0_6px_18px_-6px_rgba(240,38,21,0.9)]"
        >
          {iniciales}
        </span>
      </div>
    </header>
  );
}

/** Trazos del icono de cada pantalla (mismos símbolos que el panel general). */
function iconoDeRuta(pathname: string) {
  if (pathname.startsWith("/garita/registro-de-llegada"))
    return (
      <>
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="17" cy="18" r="1.6" />
      </>
    );
  if (pathname.startsWith("/garita/gestion-recepcion"))
    return (
      <>
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
      </>
    );
  if (pathname.startsWith("/garita/historico-llegadas"))
    return (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    );
  if (pathname.startsWith("/agendamientos/incidencias") || pathname.startsWith("/datos-maestros/incidencias"))
    return (
      <>
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 10v4M12 17.5v.01" />
      </>
    );
  if (pathname.startsWith("/agendamientos/reportes"))
    return (
      <>
        <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>
    );
  if (pathname.startsWith("/agendamientos"))
    return (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18M8 15l2 2 4-4" />
      </>
    );
  if (pathname.startsWith("/datos-maestros/cambio-mp"))
    return (
      <>
        <path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 15 6.7L21 16M21 21v-5h-5" />
      </>
    );
  if (pathname.startsWith("/datos-maestros"))
    return (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" />
      </>
    );
  if (pathname.startsWith("/usuarios"))
    return (
      <>
        <path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    );
  return (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10M10 20v-6h4v6" />
    </>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function PanelLeftCloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 9-3 3 3 3" />
    </svg>
  );
}

function PanelLeftOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m13 9 3 3-3 3" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
