"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Header } from "./header";
import { SidebarContent } from "./sidebar";

const STORAGE_KEY = "sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Sin persistencia si localStorage no está disponible.
    }
    setHydrated(true);
  }, []);

  // Foco de luz: el panel bajo el puntero recibe su posición para iluminarse.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let marco = 0;
    let anterior: HTMLElement | null = null;

    function mover(evento: PointerEvent) {
      if (marco) return;
      const { clientX, clientY, target } = evento;
      marco = window.requestAnimationFrame(() => {
        marco = 0;
        const panel = target instanceof Element ? target.closest<HTMLElement>(".glass") : null;
        if (anterior && anterior !== panel) {
          anterior.style.removeProperty("--mx");
          anterior.style.removeProperty("--my");
        }
        anterior = panel;
        if (!panel) return;
        const caja = panel.getBoundingClientRect();
        panel.style.setProperty("--mx", `${clientX - caja.left}px`);
        panel.style.setProperty("--my", `${clientY - caja.top}px`);
      });
    }

    document.addEventListener("pointermove", mover, { passive: true });
    return () => {
      document.removeEventListener("pointermove", mover);
      if (marco) window.cancelAnimationFrame(marco);
    };
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Sin persistencia si localStorage no está disponible.
      }
      return next;
    });
  }, []);

  const openMobile = useCallback(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    setMobileOpen(true);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    previousFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const drawer = drawerRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const first = drawer?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile();
        return;
      }

      if (event.key !== "Tab" || !drawer) {
        return;
      }

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        return;
      }

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, closeMobile]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar de escritorio */}
      <aside
        id="app-sidebar"
        className={`glass-bar sticky top-0 hidden h-screen shrink-0 border-r border-fp-line transition-[width] duration-200 ease-out lg:block ${
          collapsed ? "w-20" : "w-[264px]"
        }`}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Drawer móvil */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          mobileOpen ? "" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <div
          onClick={closeMobile}
          aria-hidden="true"
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          ref={drawerRef}
          id="mobile-sidebar"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-fp-line bg-[var(--drawer)] shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContent
            collapsed={false}
            onClose={closeMobile}
            onNavigate={closeMobile}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onOpenMobileSidebar={openMobile}
          onToggleCollapse={toggleCollapse}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
        />

        <main
          id="main-content"
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8"
          data-hydrated={hydrated ? "true" : undefined}
        >
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}
