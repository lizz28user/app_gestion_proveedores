"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "@/lib/use-session";

type SidebarContentProps = {
  collapsed: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
};

type IconProps = { className?: string };

type NavItem = {
  href: string;
  label: string;
  icon: (props: IconProps) => ReactNode;
};

type NavSection = {
  id: string;
  title: string;
  icon: (props: IconProps) => ReactNode;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    id: "garita",
    title: "Garita",
    icon: GateIcon,
    items: [
      {
        href: "/garita/registro-de-llegada",
        label: "Registro de llegada",
        icon: ClockIcon,
      },
      {
        href: "/garita/gestion-recepcion",
        label: "Gestión de recepción",
        icon: ClipboardCheckIcon,
      },
      {
        href: "/garita/historico-llegadas",
        label: "Histórico de llegadas",
        icon: HistoryIcon,
      },
    ],
  },
  {
    id: "agendamientos",
    title: "Agendamientos",
    icon: CalendarIcon,
    items: [
      {
        href: "/agendamientos/dashboard",
        label: "Dashboard",
        icon: GridIcon,
      },
      {
        href: "/agendamientos/incidencias-de-proveedores",
        label: "Incidencias de proveedores",
        icon: AlertTriangleIcon,
      },
      {
        href: "/agendamientos/reportes-de-citas",
        label: "Reportes de citas",
        icon: CalendarIcon,
      },
    ],
  },
  {
    id: "datos-maestros",
    title: "Gestión de datos maestros",
    icon: DatabaseIcon,
    items: [
      {
        href: "/datos-maestros/incidencias",
        label: "Incidencias",
        icon: AlertCircleIcon,
      },
      {
        href: "/datos-maestros/cambio-mp",
        label: "Cambio MP",
        icon: RefreshIcon,
      },
      {
        href: "/datos-maestros/catalogo-de-productos",
        label: "Catálogo de productos",
        icon: PackageIcon,
      },
    ],
  },
  {
    id: "usuarios",
    title: "Seguridad",
    icon: UsersIcon,
    items: [
      {
        href: "/usuarios",
        label: "Gestión de usuarios",
        icon: UsersIcon,
      },
    ],
  },
];

export function SidebarContent({
  collapsed,
  onNavigate,
  onClose,
}: SidebarContentProps) {
  const pathname = usePathname();
  const { usuario } = useSession();
  const sectionIdPrefix = useId().replace(/:/g, "");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(SECTIONS.map((section) => [section.id, true])) as Record<
        string,
        boolean
      >,
  );

  // El módulo de usuarios solo se muestra al Administrador.
  const seccionesVisibles = SECTIONS.filter(
    (section) => section.id !== "usuarios" || usuario?.rol === "Administrador",
  );

  const nombreCompleto = usuario
    ? `${usuario.nombres} ${usuario.apellidos}`.trim()
    : "Usuario";
  const rolVisible = usuario?.rol ?? "";
  const iniciales = usuario
    ? `${usuario.nombres.charAt(0)}${usuario.apellidos.charAt(0)}`.toUpperCase()
    : "?";

  async function cerrarSesion() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  }

  function toggleSection(id: string) {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex shrink-0 items-center border-b border-fp-line ${
          collapsed ? "h-16 justify-center px-2" : "gap-3 px-5 py-5"
        }`}
      >
        {collapsed ? (
          <span
            title="SIRA · Punta Negra"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-fp-line bg-fp-surface"
          >
            <FpMarkIcon className="size-6" />
          </span>
        ) : (
          <span className="flex min-w-0 flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-fp-color.svg"
              alt="Farmacias Peruanas"
              className="h-9 w-auto self-start"
            />
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-bold tracking-tight text-fp-ink">
                SIRA
              </span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#F02615]">
                Punta Negra
              </span>
            </span>
          </span>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú de navegación"
            className="ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CloseIcon className="size-5" />
          </button>
        )}
      </div>

      <nav
        aria-label="Navegación principal"
        className="flex-1 overflow-y-auto overscroll-contain px-2 py-3"
      >
        <ul className="flex flex-col gap-2">
          {/* Panel general: botón directo, visible para todos los roles */}
          <li>
            <SidebarLink
              item={{
                href: "/dashboard",
                label: "Panel general",
                icon: GridIcon,
              }}
              active={pathname === "/dashboard"}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </li>

          {seccionesVisibles.map((section, index) => {
            const SectionIcon = section.icon;
            const isOpen = openSections[section.id];
            const sectionHasActive = section.items.some(
              (item) => pathname === item.href,
            );

            return (
              <li
                key={section.id}
                className={
                  collapsed && index > 0
                    ? "border-t border-border pt-2"
                    : undefined
                }
              >
                {collapsed ? (
                  <ul className="flex flex-col gap-1">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <SidebarLink
                          item={item}
                          active={pathname === item.href}
                          collapsed
                          onNavigate={onNavigate}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isOpen}
                      aria-controls={`${sectionIdPrefix}-${section.id}`}
                      className={`flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[10px] font-bold uppercase tracking-[0.2em] transition-colors hover:bg-fp-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        sectionHasActive ? "text-fp-dim" : "text-fp-faint"
                      }`}
                    >
                      <SectionIcon className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {section.title}
                      </span>
                      <ChevronIcon
                        className={`size-3.5 shrink-0 text-fp-faint transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <ul
                      id={`${sectionIdPrefix}-${section.id}`}
                      className={`mt-1 flex-col gap-1 ${
                        isOpen ? "flex" : "hidden"
                      }`}
                    >
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <SidebarLink
                            item={item}
                            active={pathname === item.href}
                            onNavigate={onNavigate}
                          />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-fp-line p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span
              title={`${nombreCompleto} · ${rolVisible}`}
              className="flex size-9 items-center justify-center rounded-full bg-[#F02615] text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(240,38,21,0.9)]"
            >
              {iniciales}
            </span>
            <button
              type="button"
              onClick={cerrarSesion}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <LogoutIcon className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-fp-line bg-fp-surface px-2.5 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F02615] text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(240,38,21,0.9)]">
              {iniciales}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {nombreCompleto}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {rolVisible}
              </p>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <LogoutIcon className="size-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex h-10 items-center rounded-xl text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        collapsed ? "justify-center px-2" : "gap-3 px-3"
      } ${
        active
          ? "bg-gradient-to-r from-[#F02615]/25 to-transparent font-semibold text-fp-ink shadow-[inset_0_1px_0_var(--glass-highlight)]"
          : "text-fp-dim hover:bg-fp-surface-hover hover:text-fp-ink"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-[#F02615] shadow-[0_0_12px_#F02615]"
        />
      )}
      <Icon
        className={`size-[18px] shrink-0 ${active ? "text-[#F02615]" : "text-fp-faint group-hover:text-fp-dim"}`}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/** Rombos de marca FP (versión compacta del símbolo para el menú colapsado). */
function FpMarkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="5" y="2.5" width="8" height="8" rx="1.6" fill="#F02615" transform="rotate(45 9 6.5)" />
      <rect x="12.5" y="10.5" width="6" height="6" rx="1.2" fill="#76797B" transform="rotate(45 15.5 13.5)" />
      <rect x="5.5" y="14.5" width="4.5" height="4.5" rx="1" fill="#F02615" transform="rotate(45 7.75 16.75)" />
    </svg>
  );
}

function HistoryIcon({ className }: IconProps) {
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
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function GateIcon({ className }: IconProps) {
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
      <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
      <path d="M2 21h20" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 7h6" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function ClipboardCheckIcon({ className }: IconProps) {
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
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function CalendarIcon({ className }: IconProps) {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 11h18M8 3v4M16 3v4" />
    </svg>
  );
}

function GridIcon({ className }: IconProps) {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: IconProps) {
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
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function AlertCircleIcon({ className }: IconProps) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function DatabaseIcon({ className }: IconProps) {
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
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v7a9 3 0 0 0 18 0V5" />
      <path d="M3 12v7a9 3 0 0 0 18 0v-7" />
    </svg>
  );
}

function RefreshIcon({ className }: IconProps) {
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
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function PackageIcon({ className }: IconProps) {
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
      <path d="m7.5 4.3 9 5.2" />
      <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </svg>
  );
}

function ChevronIcon({ className }: IconProps) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {  return (
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
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
