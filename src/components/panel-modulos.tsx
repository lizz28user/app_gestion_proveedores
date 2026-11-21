"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { puedeAccesarRuta, modulosVisible, type Rol, type Modulo } from "@/lib/permissions";
import { useSession } from "@/lib/use-session";
import { cargarCitasDelReporte, type LpnsHora } from "@/lib/citas-del-dia";
import { EXTRA_ARRIVALS_STORAGE_KEY, type Arrival } from "@/app/(app)/garita/registro-de-llegada/arrivals-data";
import { loadRecepciones } from "@/components/reception/storage";
import { PUERTAS, puertaInactiva } from "@/components/reception/types";
import { cargarIncidencias } from "@/lib/incidencias-proveedores";
import { todayIso } from "@/lib/utils";

type ModuloPanel = {
  modulo: Modulo;
  titulo: string;
  items: {
    href: string;
    label: string;
  }[];
  icono: ReactNode;
};

const iconoProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-6",
  "aria-hidden": true,
};

function Icono({ children, className = "size-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const MODULOS: ModuloPanel[] = [
  {
    modulo: "garita",
    titulo: "Garita",
    icono: (
      <svg {...iconoProps}>
        <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
        <path d="M9 21v-6h6v6" />
        <path d="M9 7h6" />
      </svg>
    ),
    items: [
      { href: "/garita/registro-de-llegada", label: "Registro de llegada" },
      { href: "/garita/gestion-recepcion", label: "Gestión de recepción" },
      { href: "/garita/historico-llegadas", label: "Histórico de llegadas" },
    ],
  },
  {
    modulo: "agendamientos",
    titulo: "Agendamientos",
    icono: (
      <svg {...iconoProps}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
    items: [
      { href: "/agendamientos/dashboard", label: "Dashboard de citas" },
      { href: "/agendamientos/incidencias-de-proveedores", label: "Incidencias de proveedores" },
      { href: "/agendamientos/reportes-de-citas", label: "Reportes de citas" },
    ],
  },
  {
    modulo: "datos-maestros",
    titulo: "Datos maestros",
    icono: (
      <svg {...iconoProps}>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" />
      </svg>
    ),
    items: [
      { href: "/datos-maestros/catalogo-de-productos", label: "Catálogo de productos" },
      { href: "/datos-maestros/incidencias", label: "Incidencias" },
      { href: "/datos-maestros/cambio-mp", label: "Cambio MP" },
    ],
  },
];

type Actividad = {
  id: string;
  hora: string;
  proveedor: string;
  proceso: "Llegada (Garita)" | "Recepción";
  estado: "Registrada" | "En proceso" | "Finalizada";
};

type ResumenDia = {
  fechaCitas: string | null;
  citas: number;
  proveedores: number;
  unidades: number;
  llegadas: number;
  enRecepcion: number;
  finalizadas: number;
  incidenciasAbiertas: number;
  /** LPN (enteros) y proveedores por hora de cita, del cruce guardado para Garita. */
  porHora: LpnsHora[];
  totalLpns: number;
  /** true si la agenda asignada es anterior a este cambio y no trae LPN por hora. */
  faltanLpns: boolean;
  actividad: Actividad[];
  puertas: { libres: number; reservadas: number; ocupadas: number; inactivas: number; total: number };
};

function leerResumen(): ResumenDia {
  const reporte = cargarCitasDelReporte();
  const fechaRef = reporte?.fecha ?? todayIso();

  let arribos: Arrival[] = [];
  try {
    const raw = window.localStorage.getItem(EXTRA_ARRIVALS_STORAGE_KEY);
    const lista: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(lista)) {
      arribos = (lista as Arrival[]).filter((a) => a.fecha === fechaRef);
    }
  } catch {
    arribos = [];
  }

  const recepciones = loadRecepciones().filter((r) => r.fecha === fechaRef);

  const actividad: Actividad[] = [
    ...arribos.map((a, i): Actividad => ({
      id: `a-${i}-${a.ruc}`,
      hora: a.llegada || a.horaSolicitada || "",
      proveedor: a.proveedor,
      proceso: "Llegada (Garita)",
      estado: "Registrada",
    })),
    ...recepciones.map((r, i): Actividad => ({
      id: `r-${i}-${r.proveedor}`,
      hora: (r.estado === "finalizada" ? r.horaFin : null) || r.horaInicioDescarga || r.horaLlegada || "",
      proveedor: r.proveedor,
      proceso: "Recepción",
      estado: r.estado === "finalizada" ? "Finalizada" : "En proceso",
    })),
  ]
    .sort((a, b) => b.hora.localeCompare(a.hora))
    .slice(0, 5);

  // Estado de puertas: misma regla del mapa de recepción (asignada = reservada, con inicio de descarga = ocupada).
  const enMuelle = new Map<string, (typeof recepciones)[number]>();
  for (const r of recepciones) {
    if (!r.puerta || r.estado === "finalizada") continue;
    const actual = enMuelle.get(r.puerta);
    if (!actual || r.updatedAt > actual.updatedAt) enMuelle.set(r.puerta, r);
  }
  const inactivas = PUERTAS.filter(puertaInactiva).length;
  let ocupadas = 0;
  let reservadas = 0;
  for (const r of enMuelle.values()) {
    if (r.horaInicioDescarga || r.horaFin) ocupadas += 1;
    else reservadas += 1;
  }
  const puertas = {
    libres: Math.max(0, PUERTAS.length - inactivas - ocupadas - reservadas),
    reservadas,
    ocupadas,
    inactivas,
    total: PUERTAS.length,
  };

  return {
    puertas,
    fechaCitas: reporte?.fecha ?? null,
    citas: reporte?.totalCitas ?? 0,
    proveedores: reporte?.citas.length ?? 0,
    unidades: Math.round(
      reporte?.citas.reduce((s, c) => s + (Number(c.unidadesEstimadas) || 0), 0) ?? 0,
    ),
    llegadas: arribos.length,
    enRecepcion: recepciones.filter((r) => r.estado === "avance").length,
    finalizadas: recepciones.filter((r) => r.estado === "finalizada").length,
    incidenciasAbiertas: cargarIncidencias().filter((i) => i.estado !== "Resuelta").length,
    porHora: reporte?.asignado.lpnsPorHora ?? [],
    totalLpns: reporte?.asignado.totalLpns ?? 0,
    faltanLpns: Boolean(reporte && !reporte.asignado.lpnsPorHora),
    actividad,
  };
}

/** "sábado, 14 de noviembre de 2026" → "Sábado, 14 de noviembre de 2026" */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearFecha(iso: string, opciones: Intl.DateTimeFormatOptions) {
  const fecha = new Date(`${iso}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleDateString("es-PE", opciones);
}

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Escala del eje vertical: 5 marcas con un máximo redondeado. */
function escalaEje(max: number): number[] {
  const paso = Math.max(1, Math.ceil(max / 4 / 100) * 100);
  return [0, 1, 2, 3, 4].map((i) => i * paso);
}

export function PanelModulos() {
  const { usuario, loading } = useSession();
  const [resumen, setResumen] = useState<ResumenDia | null>(null);
  const [saludoActual, setSaludoActual] = useState("Hola");

  useEffect(() => {
    setResumen(leerResumen());
    setSaludoActual(saludo());
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-fp-dim">Cargando panel…</p>
      </div>
    );
  }

  if (!usuario) {
    return null;
  }

  const rolUsuario = usuario.rol as Rol;
  const disponibles = modulosVisible(rolUsuario);
  const modulos = MODULOS.filter((m) => disponibles.includes(m.modulo))
    .map((m) => ({
      ...m,
      items: m.items.filter((item) => puedeAccesarRuta(rolUsuario, item.href)),
    }))
    .filter((m) => m.items.length > 0);

  const hoy = capitalizar(
    formatearFecha(todayIso(), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );

  // Avance del día: finalizadas, en recepción y llegadas aún sin recepción.
  const total = resumen?.proveedores ?? 0;
  const finalizadas = resumen?.finalizadas ?? 0;
  const enRecepcion = resumen?.enRecepcion ?? 0;
  const llegadas = resumen?.llegadas ?? 0;
  const enPatio = Math.max(0, llegadas - enRecepcion - finalizadas);
  const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
  const avancePct = Math.round(pct(llegadas));

  // Agenda por hora: todas las horas del turno (de la primera a la última cita), sin saltos.
  const porHora = completarHoras(resumen?.porHora ?? []);
  const maxLpns = Math.max(1, ...porHora.map((h) => h.lpns));
  const eje = escalaEje(maxLpns);
  const topeEje = eje[eje.length - 1] || 1;
  const pico = porHora.reduce<(typeof porHora)[number] | null>(
    (mejor, h) => (!mejor || h.lpns > mejor.lpns ? h : mejor),
    null,
  );
  const esHoy = resumen?.fechaCitas === todayIso();
  const horaActual = String(new Date().getHours()).padStart(2, "0");
  const fechaReporte = resumen?.fechaCitas
    ? formatearFecha(resumen.fechaCitas, { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      {/* Bienvenida + avance + agenda por hora */}
      {/* relative z-10: el resumen por hora se despliega por encima de los indicadores de abajo */}
      <section className="relative z-10 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="glass glass-edge rounded-[22px] p-6 !shadow-[0_26px_50px_-22px_rgba(0,0,0,0.9),0_0_0_1px_rgba(240,38,21,0.10),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_40px_-30px_rgba(240,38,21,0.35)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-fp-dim">
              <Icono>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </Icono>
              {hoy}
            </p>
            <h2 className="mt-2 text-[34px] font-extrabold leading-tight tracking-tight text-fp-ink sm:text-[40px]">
              {saludoActual}, <span className="text-[#F02615]">{usuario.nombres.split(" ")[0]}</span>
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-fp-dim">
              <svg viewBox="0 0 24 24" fill="#F02615" aria-hidden="true" className="size-4">
                <path d="M12 22s7-6.2 7-11.5a7 7 0 0 0-14 0C5 15.8 12 22 12 22Zm0-8.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
              </svg>
              Plataforma de recepción - Punta Negra
            </p>

            {fechaReporte ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip icono={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>}>
                  Agenda del {fechaReporte}
                </Chip>
                <Chip icono={<><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>}>
                  <strong className="font-bold text-fp-ink">{resumen?.citas ?? 0}</strong> citas
                </Chip>
                <Chip icono={<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>}>
                  <strong className="font-bold text-fp-ink">{total}</strong> proveedores
                </Chip>
                {resumen && !resumen.faltanLpns ? (
                  <Chip icono={<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>}>
                    <strong className="font-bold text-fp-ink">
                      {resumen.totalLpns.toLocaleString("es-PE")}
                    </strong>{" "}
                    LPNs
                  </Chip>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-fp-dim">
                Garita aún no tiene una agenda asignada. Carga la Agenda y el Reporte IKF en
                Agendamientos → Dashboard de citas y presiona Guardar dashboard.
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {puedeAccesarRuta(rolUsuario, "/garita/registro-de-llegada") ? (
                <Link
                  href="/garita/registro-de-llegada"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#F02615] to-[#B32515] px-5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_-10px_rgba(240,38,21,0.95)] transition hover:brightness-110"
                >
                  Registrar llegada
                </Link>
              ) : null}
              {puedeAccesarRuta(rolUsuario, "/agendamientos/dashboard") ? (
                <Link
                  href="/agendamientos/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-fp-line-strong bg-fp-surface px-5 text-sm font-semibold text-fp-ink transition hover:border-fp-faint/60"
                >
                  {resumen?.fechaCitas ? "Ver dashboard de citas" : "Cargar Reporte IKF"}
                </Link>
              ) : null}
            </div>
          </div>

          {/* Avance de llegadas */}
          <div className="glass rounded-[22px] p-6 !shadow-[0_26px_50px_-22px_rgba(0,0,0,0.9),0_0_0_1px_rgba(240,38,21,0.10),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_40px_-30px_rgba(240,38,21,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-fp-ink">
                <Icono className="size-7">
                  <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
                  <circle cx="7" cy="18" r="1.6" />
                  <circle cx="17" cy="18" r="1.6" />
                </Icono>
                Avance de llegadas
              </h3>
              <p className="flex items-center gap-3">
                <span>
                  <span className="text-3xl font-extrabold tabular-nums text-fp-ink">{llegadas}</span>
                  <span className="text-lg font-semibold text-fp-faint"> /{total}</span>
                </span>
                <span className="rounded-full bg-gradient-to-b from-[#F02615] to-[#B32515] px-3 py-0.5 text-sm font-bold text-white shadow-[0_8px_16px_-6px_rgba(240,38,21,0.9),inset_0_1px_0_rgba(255,255,255,0.35)]">
                  {avancePct}%
                </span>
              </p>
            </div>
            <div
              className="mt-4 flex h-3 overflow-hidden rounded-full bg-fp-track"
              role="img"
              aria-label={`${finalizadas} finalizadas, ${enRecepcion} en recepción, ${enPatio} en patio de ${total} proveedores`}
            >
              <span className="h-full bg-fp-ok transition-[width] duration-700" style={{ width: `${pct(finalizadas)}%` }} />
              <span className="h-full bg-fp-dock transition-[width] duration-700" style={{ width: `${pct(enRecepcion)}%` }} />
              <span className="h-full bg-[#FAB701] transition-[width] duration-700" style={{ width: `${pct(enPatio)}%` }} />
              {llegadas === 0 ? null : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-fp-dim">
              <Leyenda color="#2FBF71" texto={`Recibidos ${finalizadas}`} />
              <Leyenda color="#7FB2FF" texto={`En recepción ${enRecepcion}`} />
              <Leyenda color="#FAB701" texto={`En patio ${enPatio}`} />
              <Leyenda color="#76797B" texto={`Por llegar ${Math.max(0, total - llegadas)}`} />
            </div>
          </div>
        </div>

        {/* Agenda por hora */}
        <div className="glass glass-edge flex min-w-0 flex-col rounded-[22px] p-6 !shadow-[0_26px_50px_-22px_rgba(0,0,0,0.9),0_0_0_1px_rgba(240,38,21,0.10),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_40px_-30px_rgba(240,38,21,0.35)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-fp-ink">
              <Icono className="size-7">
                <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
              </Icono>
              LPNs y proveedores por hora
            </h3>
            {pico && pico.lpns > 0 ? (
              <p className="flex items-center gap-2 text-sm text-fp-dim">
                <Icono>
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2M9 2h6" />
                </Icono>
                Hora pico: <span className="font-extrabold text-[#F02615]">{pico.hora}:00</span>
              </p>
            ) : null}
          </div>

          {porHora.length > 0 ? (
            <div className="mt-5 flex gap-3">
              {/* Eje vertical */}
              <div className="flex h-44 shrink-0 flex-col-reverse justify-between pt-6 text-right text-xs font-semibold tabular-nums text-fp-dim">
                {eje.map((v) => (
                  <span key={v} className="leading-none">
                    {v.toLocaleString("es-PE")}
                  </span>
                ))}
              </div>

              <ol
                className="relative grid min-w-0 flex-1 gap-2"
                style={{ gridTemplateColumns: `repeat(${porHora.length}, minmax(0, 1fr))` }}
                aria-label="LPNs y proveedores por hora de inicio de cita"
              >
                {/* Líneas guía */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-6 h-44 bg-[linear-gradient(to_top,var(--fp-line)_1px,transparent_1px)] bg-[length:100%_25%]"
                />
                {porHora.map((h, indice) => {
                  const esPico = pico?.hora === h.hora && h.lpns > 0;
                  const esAhora = esHoy && h.hora === horaActual;
                  const vacia = h.proveedores === 0;
                  // El resumen se abre hacia adentro en los extremos para no salirse del panel.
                  const alineacion =
                    indice <= 1
                      ? "left-0"
                      : indice >= porHora.length - 2
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2";
                  return (
                    <li
                      key={h.hora}
                      tabIndex={vacia ? -1 : 0}
                      aria-label={`${h.hora}:00, ${h.lpns} LPNs, ${h.proveedores} proveedores`}
                      className={`group relative flex min-w-0 flex-col items-center rounded-lg outline-none transition-colors ${
                        vacia ? "" : "cursor-default focus-visible:ring-2 focus-visible:ring-[#F02615]/50"
                      }`}
                    >
                      {/* Área de la barra: valor sobre la barra, misma altura para todas las horas */}
                      <span className="relative flex h-[200px] w-full flex-col items-center justify-end pt-6">
                        <span
                          className={`mb-1 text-sm font-extrabold tabular-nums ${
                            vacia ? "text-fp-faint" : esPico ? "text-[#F02615]" : "text-fp-ink"
                          }`}
                        >
                          {vacia ? "–" : h.lpns.toLocaleString("es-PE")}
                        </span>
                        <span className="flex h-44 w-full items-end justify-center">
                          <span
                            className={`w-3/5 max-w-14 rounded-t-md transition-[height] duration-700 ${
                              vacia
                                ? "bg-fp-track"
                                : esPico
                                  ? "bg-gradient-to-t from-[#B32515] to-[#F02615] shadow-[0_0_18px_rgba(240,38,21,0.5)]"
                                  : esAhora
                                    ? "bg-gradient-to-t from-[#c98f00] to-[#FAB701] shadow-[0_0_16px_rgba(250,183,1,0.45)]"
                                    : "bg-gradient-to-t from-[#76797B]/50 to-[#9a9da0] shadow-[0_8px_18px_-8px_rgba(0,0,0,0.8)] group-hover:from-[#F02615]/50 group-hover:to-[#F02615]/80"
                            }`}
                            style={{
                              height: vacia ? "3px" : `${Math.max(4, (h.lpns / topeEje) * 100)}%`,
                            }}
                          />
                        </span>
                      </span>

                      <span
                        className={`mt-2 text-sm font-bold tabular-nums ${esAhora ? "text-[#c98f00]" : "text-fp-ink"}`}
                      >
                        {h.hora}h
                      </span>
                      <span
                        className={`mt-1 rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${
                          vacia ? "text-fp-faint/60" : "border border-fp-line bg-fp-surface text-fp-dim shadow-[0_6px_12px_-8px_rgba(0,0,0,0.8)]"
                        }`}
                      >
                        {h.proveedores} prov.
                      </span>

                      {/* Resumen al pasar el puntero (o al enfocar con teclado) */}
                      {!vacia ? (
                        <div
                          role="tooltip"
                          className={`pointer-events-none absolute top-full z-30 mt-2 hidden w-72 rounded-xl border border-fp-line-strong bg-[var(--drawer)] p-3 text-left shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl group-hover:block group-focus:block ${alineacion}`}
                        >
                          <p className="flex items-baseline justify-between gap-2 border-b border-fp-line pb-2">
                            <span className="text-sm font-extrabold text-fp-ink">{h.hora}:00 – {h.hora}:59</span>
                            <span className="text-xs font-bold text-[#F02615]">
                              {h.lpns.toLocaleString("es-PE")} LPNs
                            </span>
                          </p>
                          {h.detalle && h.detalle.length > 0 ? (
                            <ul className="mt-2 flex flex-col gap-1.5">
                              {h.detalle.slice(0, 8).map((p) => (
                                <li key={p.nombre} className="flex items-center justify-between gap-3 text-xs">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span aria-hidden="true" className="size-1.5 shrink-0 rotate-45 rounded-[1px] bg-[#F02615]" />
                                    <span className="truncate font-medium text-fp-ink" title={p.nombre}>
                                      {p.nombre}
                                    </span>
                                  </span>
                                  <span className="shrink-0 tabular-nums text-fp-dim">
                                    {p.lpns > 0
                                      ? `${p.lpns.toLocaleString("es-PE")} LPN`
                                      : `${p.unidades.toLocaleString("es-PE")} und.`}
                                  </span>
                                </li>
                              ))}
                              {h.detalle.length > 8 ? (
                                <li className="pt-1 text-xs text-fp-faint">y {h.detalle.length - 8} proveedores más</li>
                              ) : null}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-fp-dim">
                              {h.proveedores} proveedor{h.proveedores === 1 ? "" : "es"}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="mt-4 flex min-h-[260px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-fp-line-strong text-center">
              <span aria-hidden="true" className="flex gap-1.5">
                <span className="size-2.5 rotate-45 rounded-[2px] bg-[#F02615]" />
                <span className="size-2.5 rotate-45 rounded-[2px] bg-[#76797B]" />
                <span className="size-2.5 rotate-45 rounded-[2px] bg-[#F02615]/60" />
              </span>
              <p className="max-w-xs text-sm text-fp-dim">
                {resumen?.faltanLpns
                  ? "Vuelve a presionar Guardar dashboard en el Dashboard de citas para ver los LPNs por hora."
                  : "Guarda el Dashboard de citas para ver los LPNs y proveedores de cada hora."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Indicadores */}
      <section aria-label="Indicadores del día" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          etiqueta="Citas agendadas"
          valor={resumen?.citas ?? 0}
          detalle={`${resumen?.proveedores ?? 0} proveedores`}
          color="#F02615"
          icono={<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 15l2 2 4-4" /></>}
          badge={{ texto: `${(resumen?.unidades ?? 0).toLocaleString("es-PE")} und.`, tono: "sube" }}
        />
        <Kpi
          etiqueta="Llegadas registradas"
          valor={resumen?.llegadas ?? 0}
          detalle="en garita"
          color="#4C8DFF"
          icono={<><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>}
          badge={{ texto: `${avancePct}%`, tono: avancePct > 0 ? "sube" : "igual" }}
        />
        <Kpi
          etiqueta="Recepciones"
          valor={resumen?.enRecepcion ?? 0}
          detalle={`en proceso - ${resumen?.finalizadas ?? 0} finalizadas`}
          color="#2FBF71"
          icono={<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>}
          badge={{
            texto: `${llegadas > 0 ? Math.round((finalizadas / llegadas) * 100) : 0}%`,
            tono: finalizadas > 0 ? "sube" : "igual",
          }}
        />
        <Kpi
          etiqueta="Incidencias abiertas"
          valor={resumen?.incidenciasAbiertas ?? 0}
          detalle="de proveedores"
          color="#F02615"
          icono={<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.01" /></>}
          badge={{
            texto: `${resumen?.incidenciasAbiertas ?? 0} abiertas`,
            tono: (resumen?.incidenciasAbiertas ?? 0) > 0 ? "alerta" : "igual",
          }}
        />
      </section>

      {/* Módulos */}
      <section aria-label="Módulos" className="flex flex-wrap justify-center gap-3">
        {modulos.map((modulo) => (
          <article
            key={modulo.modulo}
            className="glass group relative w-full overflow-hidden sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] rounded-[18px] bg-gradient-to-r from-[#F02615]/20 to-transparent !shadow-[0_20px_40px_-18px_rgba(240,38,21,0.55),0_14px_30px_-16px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5"
          >
            <Link
              href={modulo.items[0].href}
              className="flex items-center gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F02615]/60"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F02615] to-[#a3180c] text-white shadow-[0_12px_24px_-6px_rgba(240,38,21,0.85),inset_0_1px_0_rgba(255,255,255,0.35)]">
                {modulo.icono}
              </span>
              <h3 className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight text-fp-ink">
                {modulo.titulo}
              </h3>
              <Icono className="size-6 shrink-0 text-fp-dim transition group-hover:translate-x-1 group-hover:text-fp-ink">
                <path d="m9 6 6 6-6 6" />
              </Icono>
            </Link>

            {modulo.items.length > 1 ? (
              <ul className="flex flex-wrap gap-1.5 border-t border-fp-line px-4 py-3">
                {modulo.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex rounded-full border border-fp-line bg-fp-sunken px-3 py-1 text-sm font-medium text-fp-dim transition hover:border-[#F02615]/50 hover:text-fp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {/* Actividad reciente */}
      <section aria-label="Actividad reciente" className="glass rounded-[22px] p-6 !shadow-[0_26px_50px_-22px_rgba(0,0,0,0.9),0_0_0_1px_rgba(240,38,21,0.10),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_40px_-30px_rgba(240,38,21,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-fp-ink">
            <Icono className="size-7">
              <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
            </Icono>
            Actividad reciente
          </h3>
          {puedeAccesarRuta(rolUsuario, "/garita/historico-llegadas") ? (
            <Link
              href="/garita/historico-llegadas"
              className="inline-flex items-center gap-1 text-sm font-bold text-fp-ink transition hover:text-[#F02615]"
            >
              Ver historial
              <Icono className="size-4">
                <path d="m9 6 6 6-6 6" />
              </Icono>
            </Link>
          ) : null}
        </div>

        {resumen && resumen.actividad.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="bg-fp-sunken text-fp-dim">
                  <th className="rounded-l-lg px-3 py-2 font-semibold">Hora</th>
                  <th className="px-3 py-2 font-semibold">Proveedor</th>
                  <th className="px-3 py-2 font-semibold">Proceso</th>
                  <th className="rounded-r-lg px-3 py-2 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {resumen.actividad.map((fila) => (
                  <tr key={fila.id} className="border-b border-fp-line last:border-0">
                    <td className="px-3 py-3 tabular-nums text-fp-ink">{fila.hora || "–"}</td>
                    <td className="px-3 py-3 font-medium text-fp-ink">{fila.proveedor}</td>
                    <td className="px-3 py-3 text-fp-ink">{fila.proceso}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex min-w-28 justify-center rounded-full border px-3 py-1 text-xs font-bold shadow-[0_8px_16px_-8px_var(--b),inset_0_1px_0_rgba(255,255,255,0.35)] ${
                          fila.estado === "Finalizada"
                            ? "border-[#4be093]/40 bg-gradient-to-b from-[#26b36a] to-[#177a45] text-white [--b:#2FBF71]"
                            : fila.estado === "En proceso"
                              ? "border-[#7fb2ff]/40 bg-gradient-to-b from-[#3b7bf0] to-[#1d4fb8] text-white [--b:#4C8DFF]"
                              : "border-[#ffd75a]/50 bg-gradient-to-b from-[#FAB701] to-[#c98f00] text-[#2a2000] [--b:#FAB701]"
                        }`}
                      >
                        {fila.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-fp-line-strong px-4 py-8 text-center text-sm text-fp-dim">
            Aún no hay llegadas ni recepciones registradas para la fecha de la agenda.
          </p>
        )}
      </section>

      <EstadoPuertas puertas={resumen?.puertas ?? { libres: 0, reservadas: 0, ocupadas: 0, inactivas: 0, total: 0 }} />
      </div>
    </div>
  );
}

function EstadoPuertas({
  puertas,
}: {
  puertas: { libres: number; reservadas: number; ocupadas: number; inactivas: number; total: number };
}) {
  const filas = [
    { texto: "Libres", n: puertas.libres, color: "#2FBF71" },
    { texto: "Ocupadas", n: puertas.ocupadas, color: "#F02615" },
    { texto: "Reservadas", n: puertas.reservadas, color: "#FAB701" },
    ...(puertas.inactivas > 0 ? [{ texto: "Inactivas", n: puertas.inactivas, color: "#76797B" }] : []),
  ];
  const r = 52;
  const circ = 2 * Math.PI * r;
  let acumulado = 0;
  const activas = Math.max(1, puertas.total);

  return (
    <section
      aria-label="Estado de puertas"
      className="glass rounded-[22px] p-6 !shadow-[0_26px_50px_-22px_rgba(0,0,0,0.9),0_0_0_1px_rgba(240,38,21,0.10),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_40px_-30px_rgba(240,38,21,0.35)]"
    >
      <h3 className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-fp-ink">
        <Icono className="size-7">
          <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M14 12v.01" />
        </Icono>
        Estado de puertas
      </h3>

      <div className="mt-5 flex flex-wrap items-center justify-around gap-6">
        <div className="relative size-[168px] shrink-0">
          <svg viewBox="0 0 140 140" className="size-full -rotate-90 drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)]" role="img" aria-label={`${puertas.total} puertas: ${puertas.libres} libres, ${puertas.ocupadas} ocupadas, ${puertas.reservadas} reservadas`}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="var(--fp-track)" strokeWidth="16" />
            {filas.map((f) => {
              if (f.n <= 0) return null;
              const largo = (f.n / activas) * circ;
              const desfase = acumulado;
              acumulado += largo;
              return (
                <circle
                  key={f.texto}
                  cx="70"
                  cy="70"
                  r={r}
                  fill="none"
                  stroke={f.color}
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(0, largo - 2)} ${circ}`}
                  strokeDashoffset={-desfase}
                  style={{ filter: `drop-shadow(0 0 5px ${f.color}99)` }}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold leading-none tabular-nums text-fp-ink">{puertas.total}</span>
            <span className="mt-1 text-sm font-bold text-fp-ink">Puertas</span>
          </div>
        </div>

        <ul className="flex min-w-[170px] flex-1 flex-col gap-3">
          {filas.map((f) => (
            <li key={f.texto} className="flex items-center justify-between gap-3 border-b border-fp-line pb-2 last:border-0">
              <span className="flex items-center gap-3 text-base font-bold text-fp-ink">
                <span
                  aria-hidden="true"
                  className="size-3.5 rounded-full"
                  style={{ background: f.color, boxShadow: `0 0 10px ${f.color}` }}
                />
                {f.texto}
              </span>
              <span className="text-lg font-extrabold tabular-nums text-fp-ink">{f.n}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Rellena las horas sin citas entre la primera y la última, para que el eje quede parejo. */
function completarHoras(horas: LpnsHora[]): LpnsHora[] {
  if (horas.length === 0) return [];
  const numeros = horas.map((h) => Number(h.hora)).filter((n) => Number.isFinite(n));
  const desde = Math.min(...numeros);
  const hasta = Math.max(...numeros);
  const porHora = new Map(horas.map((h) => [Number(h.hora), h]));
  const resultado: LpnsHora[] = [];
  for (let n = desde; n <= hasta; n++) {
    resultado.push(porHora.get(n) ?? { hora: String(n).padStart(2, "0"), lpns: 0, proveedores: 0, detalle: [] });
  }
  return resultado;
}

function Chip({ children, icono }: { children: ReactNode; icono: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl border border-fp-line bg-fp-surface px-3.5 py-2 text-sm font-medium text-fp-ink shadow-[0_10px_18px_-12px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <Icono className="size-4 text-fp-dim">{icono}</Icono>
      {children}
    </span>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  );
}

function Kpi({
  etiqueta,
  valor,
  detalle,
  color,
  icono,
  badge,
}: {
  etiqueta: string;
  valor: number | string;
  detalle: string;
  color: string;
  icono: ReactNode;
  badge: { texto: string; tono: "sube" | "igual" | "alerta" };
}) {
  const tonoBadge =
    badge.tono === "sube"
      ? "border-[#2FBF71]/40 bg-[#2FBF71]/15 text-[#4be093]"
      : badge.tono === "alerta"
        ? "border-[#F02615]/45 bg-[#F02615]/15 text-[#ff6a5a]"
        : "border-fp-line-strong bg-fp-surface text-fp-dim";
  return (
    <div
      className="glass relative overflow-hidden rounded-[18px] p-4"
      style={{
        backgroundImage: `linear-gradient(135deg, ${color}38 0%, transparent 70%)`,
        boxShadow: `0 22px 40px -22px ${color}b0, 0 14px 28px -16px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${color}33`,
      }}
    >
      <div className="flex items-start gap-4">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}a6)`,
            boxShadow: `0 12px 24px -6px ${color}, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        >
          <Icono className="size-7">{icono}</Icono>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-bold tracking-tight text-fp-ink">{etiqueta}</p>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums shadow-[0_6px_12px_-8px_rgba(0,0,0,0.8)] ${tonoBadge}`}
            >
              {badge.tono === "sube" ? "↑" : badge.tono === "alerta" ? "↑" : "="} {badge.texto}
            </span>
          </div>
          <p className="mt-1 text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-fp-ink">
            {typeof valor === "number" ? valor.toLocaleString("es-PE") : valor}
          </p>
          <p className="mt-2 text-sm text-fp-dim">{detalle}</p>
        </div>
      </div>
      {/* Línea decorativa de tendencia (sin datos) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 40"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute bottom-3 right-4 h-9 w-28 overflow-visible"
      >
        {/* Resplandor y sombra de la línea */}
        <path
          d="M2 30c14 6 20-14 34-8s18 8 30-4 20-14 32-14 14 0 20-4"
          strokeWidth="6"
          opacity="0.35"
          style={{ filter: "blur(4px)" }}
        />
        <path
          d="M2 30c14 6 20-14 34-8s18 8 30-4 20-14 32-14 14 0 20-4"
          style={{ filter: `drop-shadow(0 8px 6px ${color}99)` }}
        />
      </svg>
    </div>
  );
}
