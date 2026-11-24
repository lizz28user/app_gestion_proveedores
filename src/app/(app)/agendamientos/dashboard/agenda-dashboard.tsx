"use client";

import { useEffect, useState } from "react";
import type { ProveedorCruce, RankingProveedor } from "@/lib/agenda-cruce";
import { useCruceStorage } from "@/lib/use-cruce-storage";
import { usePermisos } from "@/lib/use-permisos";
import {
  asignarIkfAGarita,
  cargarCitasPorProveedor,
  cargarIkfAsignado,
  cargarMetaCruce,
  type IkfAsignado,
  type MetaCruce,
} from "@/lib/citas-del-dia";
import { formatearFechaAgenda } from "@/lib/fecha-archivo";
import { registrarIncidenciasSinCita } from "@/lib/incidencias-proveedores";
import { todayIso } from "@/lib/utils";
import { ArchivoCruce } from "@/components/agenda/carga-archivos";
import {
  cargarDashboards,
  eliminarDashboard,
  formatearFechaCorta,
  formatearFechaGuardado,
  guardarDashboard,
  type DashboardGuardado,
} from "@/lib/dashboard-history";
import {
  ClipboardIcon,
  SaveIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";

const TOPE_LPNS = 26000;
const CAPACIDAD_PROVEEDORES = 72;

const entero = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });

function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// El resultado se persiste en useCruceStorage; el uploader solo notifica.
const sinAccion = () => {};

/** "2026-11-17" → "Martes 17/11/2026" */
function fechaTitulo(iso: string | null | undefined): string {
  if (!iso) return "";
  const fecha = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return iso;
  const dia = fecha.toLocaleDateString("es-PE", { weekday: "long" });
  const dmy = fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${dmy}`;
}

const tarjeta =
  "glass rounded-2xl";

function KpiCard({
  label,
  value,
  detalle,
  porcentaje,
  excede = false,
  color = "#F02615",
}: {
  label: string;
  value: string;
  detalle?: string;
  /** Si se indica, dibuja una barra fina de capacidad. */
  porcentaje?: number;
  excede?: boolean;
  color?: string;
}) {
  return (
    <div
      className={`${tarjeta} relative flex flex-col overflow-hidden px-6 py-5`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${color}38 0%, transparent 70%)`,
        boxShadow: `0 22px 40px -22px ${color}b0, 0 14px 28px -16px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${color}33`,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute right-5 top-5 size-2.5 rotate-45 rounded-[2px]"
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      />
      <p className="text-base font-bold text-slate-800 dark:text-zinc-200">{label}</p>
      <p className="mt-1 text-4xl font-extrabold tracking-tight text-fp-ink tabular-nums sm:text-5xl">
        {value}
      </p>
      {detalle ? (
        <p className={`mt-1 text-sm tabular-nums ${excede ? "font-semibold text-[#c98f00]" : "text-slate-500 dark:text-zinc-400"}`}>
          {detalle}
        </p>
      ) : null}
      {porcentaje !== undefined ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800"
          role="progressbar"
          aria-label={`${label}: uso de la capacidad`}
          aria-valuenow={Math.round(porcentaje)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full ${excede ? "bg-[#FAB701]" : "bg-gradient-to-r from-[#B32515] to-[#F02615]"}`}
            style={{ width: `${Math.min(100, Math.max(0, porcentaje))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function AlertaCapacidad({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-2xl border border-[#FAB701]/50 bg-[#FAB701]/10 px-5 py-3.5"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-7 shrink-0 text-[#FAB701]" aria-hidden="true">
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <p className="text-base font-bold text-fp-ink">{mensaje}</p>
    </div>
  );
}

function VerTodos({
  abierto,
  onClick,
  textoCerrado,
}: {
  abierto: boolean;
  onClick: () => void;
  textoCerrado: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={abierto}
      className="mt-auto inline-flex items-center gap-1.5 self-start pt-3 text-sm font-semibold text-[#F02615] hover:underline"
    >
      {abierto ? "Ver menos" : textoCerrado}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`size-4 transition-transform ${abierto ? "-rotate-90" : ""}`} aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}

function RankingBarChart({ items }: { items: RankingProveedor[] }) {
  const max = Math.max(...items.map((item) => item.citasDistintas), 1);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((fila) => (
        <li key={fila.proveedorNormalizado} className="grid grid-cols-[minmax(0,42%)_1fr] items-center gap-3">
          <span className="truncate text-sm font-medium text-slate-800 dark:text-zinc-200" title={fila.proveedor}>
            {fila.proveedor}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-5 rounded-r-md bg-gradient-to-r from-[#B32515] to-[#F02615]"
              style={{ width: `${Math.max(6, (fila.citasDistintas / max) * 85)}%` }}
              title={`${fila.proveedor}: ${entero.format(fila.citasDistintas)} citas`}
            />
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-zinc-100">
              {entero.format(fila.citasDistintas)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Dona de atendidos (verde azulado) vs pendientes (gris) con el % sobre cada tramo. */
function DonaAtencion({ atendidos, pendientes }: { atendidos: number; pendientes: number }) {
  const total = Math.max(1, atendidos + pendientes);
  const fraccion = atendidos / total;
  const r = 76;
  const c = 2 * Math.PI * r;

  // Posición de la etiqueta en el centro angular de cada tramo (empieza arriba, sentido horario).
  const etiqueta = (desde: number, hasta: number) => {
    const angulo = ((desde + hasta) / 2) * 2 * Math.PI - Math.PI / 2;
    return { x: 100 + r * Math.cos(angulo), y: 100 + r * Math.sin(angulo) };
  };
  const pctA = Math.round(fraccion * 100);
  const pctP = 100 - pctA;
  const posA = etiqueta(0, fraccion);
  const posP = etiqueta(fraccion, 1);

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center">
      <svg
        viewBox="0 0 200 200"
        className="aspect-square w-full max-w-[280px]"
        role="img"
        aria-label={`Atendidos: ${atendidos} (${pctA}%). Pendientes: ${pendientes} (${pctP}%).`}
      >
        <circle cx="100" cy="100" r={r} fill="none" strokeWidth="34" className="stroke-[#76797B]/35" />
        {fraccion > 0 ? (
          <circle
            cx="100"
            cy="100"
            r={r}
            fill="none"
            strokeWidth="34"
            strokeDasharray={`${fraccion * c} ${c}`}
            transform="rotate(-90 100 100)"
            className="stroke-[#F02615]"
          />
        ) : null}
        {fraccion >= 0.06 ? (
          <text x={posA.x} y={posA.y} textAnchor="middle" dominantBaseline="central" className="fill-white text-[13px] font-bold">
            {pctA}%
          </text>
        ) : null}
        {1 - fraccion >= 0.06 ? (
          <text x={posP.x} y={posP.y} textAnchor="middle" dominantBaseline="central" className="fill-fp-ink text-[13px] font-bold">
            {pctP}%
          </text>
        ) : null}
      </svg>

      <ul className="mt-4 flex flex-col gap-2 text-base">
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className="size-5 rotate-45 rounded-[3px] bg-[#F02615]" />
          <span className="tabular-nums text-slate-800 dark:text-zinc-200">
            <strong>{entero.format(atendidos)} atendidos</strong> ({pctA}%)
          </span>
        </li>
        <li className="flex items-center gap-3">
          <span aria-hidden="true" className="size-5 rotate-45 rounded-[3px] bg-[#76797B]/35" />
          <span className="tabular-nums text-slate-800 dark:text-zinc-200">
            <strong>{entero.format(pendientes)}</strong> pendientes ({pctP}%)
          </span>
        </li>
      </ul>
    </div>
  );
}

function PageHeader({
  fechaProceso,
  onReprocesar,
}: {
  fechaProceso?: string;
  onReprocesar?: () => void;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">
          Operaciones / Dashboard de citas
        </p>
        <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-zinc-50">
          Dashboard de Citas
        </h1>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        {fechaProceso && (
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {formatearFechaCorta(fechaProceso)}
          </span>
        )}
        {onReprocesar && (
          <button
            type="button"
            onClick={onReprocesar}
            className="text-sm font-semibold text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Reprocesar cruce
          </button>
        )}
      </div>
    </header>
  );
}

function HistorialModal({
  dashboards,
  onCerrar,
  onVer,
  onEliminar,
}: {
  dashboards: DashboardGuardado[];
  onCerrar: () => void;
  onVer: (dashboard: DashboardGuardado) => void;
  onEliminar?: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar historial"
        onClick={onCerrar}
        className="fixed inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-historial"
        className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-zinc-800">
          <div>
            <h2
              id="titulo-historial"
              className="text-xl font-bold text-slate-900 dark:text-zinc-50"
            >
              Historial de Dashboards
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {dashboards.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-zinc-800">
              <p className="text-base text-slate-500 dark:text-zinc-400">
                No hay dashboards guardados.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dashboards.map((dashboard) => (
                <article
                  key={dashboard.id}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/60"
                >
                  <div>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-zinc-50">
                          Dashboard {formatearFechaCorta(dashboard.guardadoEn)}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
                          {formatearFechaGuardado(dashboard.guardadoEn)}
                        </p>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Guardado
                      </span>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-950">
                        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
                          Citas
                        </p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {entero.format(
                            dashboard.resultado.totalCitasDistintas
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-950">
                        <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">
                          Pendientes
                        </p>
                        <p className="text-lg font-black text-amber-600 dark:text-amber-400">
                          {entero.format(dashboard.resultado.proveedoresSinCita)}
                        </p>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Agenda del {formatearFechaCorta(dashboard.resultado.fechaProceso)}
                    </p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onVer(dashboard)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#E3001B] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
                    >
                      <ClipboardIcon className="size-4" />
                      Ver Dashboard
                    </button>
                    {onEliminar ? (
                    <button
                      type="button"
                      onClick={() => onEliminar(dashboard.id)}
                      aria-label={`Eliminar dashboard del ${formatearFechaGuardado(dashboard.guardadoEn)}`}
                      className="rounded-lg border border-slate-300 p-2 text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** `pie`: contenido que va pegado debajo del dashboard (Detalle de carga por hora). */
export function AgendaDashboard({ pie }: { pie?: React.ReactNode }) {
  const { resultado, limpiar } = useCruceStorage();
  // Auxiliar: solo ver. Supervisor y Administrador: cargar, guardar y borrar.
  const permisos = usePermisos("agendamientos");
  const [dashboards, setDashboards] = useState<DashboardGuardado[]>([]);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState<DashboardGuardado | null>(
    null
  );
  const [aviso, setAviso] = useState<{
    tipo: "exito" | "error";
    texto: string;
  } | null>(null);
  // Fecha de la agenda (del nombre del archivo) e IKF que usa Garita.
  const [meta, setMeta] = useState<MetaCruce | null>(null);
  const [ikfGarita, setIkfGarita] = useState<IkfAsignado | null>(null);
  const [busquedaPendiente, setBusquedaPendiente] = useState("");
  const [verTodosPendientes, setVerTodosPendientes] = useState(false);
  const [verTodoRanking, setVerTodoRanking] = useState(false);

  useEffect(() => {
    setDashboards(cargarDashboards());
    setIkfGarita(cargarIkfAsignado());
  }, []);

  useEffect(() => {
    setMeta(cargarMetaCruce());
  }, [resultado]);

  useEffect(() => {
    if (!aviso) return;
    const timeout = setTimeout(() => setAviso(null), 7000);
    return () => clearTimeout(timeout);
  }, [aviso]);

  // ¿El cruce actual ya está asignado a Garita?
  const asignadoAGarita = Boolean(
    ikfGarita &&
      meta &&
      ikfGarita.archivoReporte === meta.archivoReporte &&
      ikfGarita.asignadoEn >= meta.procesadoEn,
  );

  const resultadoVisible = seleccionado?.resultado ?? resultado;

  const guardarActual = () => {
    if (!resultado || !permisos.crear) return;
    try {
      // Día de la agenda: el del nombre del archivo; si no se detectó, la fecha de las citas del IKF.
      const citas = cargarCitasPorProveedor();
      const fechaCitas = cargarMetaCruce()?.fechaAgenda ?? citas?.fecha ?? todayIso();
      const entrada = guardarDashboard(resultado, {
        fechaCitas,
        citasPorProveedor: citas?.proveedores ?? [],
      });
      setDashboards((actuales) => [entrada, ...actuales]);

      // Proveedores de la Agenda sin cita → incidencia "No generó su cita".
      const sinCita = resultado.proveedoresAgenda
        .filter((p) => p.estado === "pendiente")
        .map((p) => p.proveedorOriginal);
      const registradas = registrarIncidenciasSinCita(sinCita, fechaCitas);

      // El IKF del cruce pasa a ser el valor principal de Garita (Registro de llegada).
      const asignado = asignarIkfAGarita();

      const partes = [
        `Dashboard del ${formatearFechaAgenda(fechaCitas)} guardado.`,
        asignado
          ? "Garita ya usa estas citas para registrar llegadas."
          : "No se pudo asignar el IKF a Garita: vuelve a cargar los archivos.",
        registradas > 0
          ? `Se registraron ${registradas} incidencia${registradas === 1 ? "" : "s"} "No generó su cita".`
          : "",
      ];
      setAviso({ tipo: asignado ? "exito" : "error", texto: partes.filter(Boolean).join(" ") });
      setMeta(cargarMetaCruce());
      setIkfGarita(cargarIkfAsignado());
    } catch {
      setAviso({
        tipo: "error",
        texto: "No se pudo guardar el dashboard. Verifica el espacio disponible.",
      });
    }
  };

  const borrarGuardado = (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("¿Eliminar este dashboard guardado?")
    ) {
      return;
    }
    setDashboards(eliminarDashboard(id));
    if (seleccionado?.id === id) {
      setSeleccionado(null);
    }
    setAviso({ tipo: "exito", texto: "Dashboard eliminado del historial." });
  };

  if (!resultadoVisible) {
    return (
      <div className="-m-4 bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
          <PageHeader />
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-zinc-50">
              Faltan datos
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-zinc-400">
              Sube la Agenda CD40 y el Reporte de Citas IKF para generar el
              dashboard. El maestro de proveedores es opcional.
            </p>
          </div>
          <ArchivoCruce onResultado={sinAccion} />
          {dashboards.length > 0 && (
            <button
              type="button"
              onClick={() => setHistorialAbierto(true)}
              className="mx-auto inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <ClipboardIcon className="size-4" />
              Historial ({dashboards.length})
            </button>
          )}
          {pie}
        </div>

        {historialAbierto && (
          <HistorialModal
            dashboards={dashboards}
            onCerrar={() => setHistorialAbierto(false)}
            onVer={(dashboard) => {
              setSeleccionado(dashboard);
              setHistorialAbierto(false);
            }}
            onEliminar={permisos.eliminar ? borrarGuardado : undefined}
          />
        )}
      </div>
    );
  }

  const {
    proveedoresAgenda,
    totalProveedoresAgenda,
    proveedoresConCita,
    proveedoresSinCita,
    totalCitasDistintas,
    avanceLpns,
    avanceLpnsPorcentaje,
    proveedoresRanking,
    rankingVacio,
    alertaCapacidadLpns,
    alertaCapacidadProveedores,
    fechaProceso,
  } = resultadoVisible;

  const pendientes = proveedoresAgenda
    .filter((p: ProveedorCruce) => p.estado === "pendiente")
    .sort((a: ProveedorCruce, b: ProveedorCruce) => a.proveedorOriginal.localeCompare(b.proveedorOriginal));

  const termino = normalizarBusqueda(busquedaPendiente);
  const pendientesFiltrados = termino
    ? pendientes.filter(
        (p: ProveedorCruce) =>
          normalizarBusqueda(p.proveedorOriginal).includes(termino) || (p.ruc ?? "").includes(termino),
      )
    : pendientes;
  const pendientesVisibles = verTodosPendientes || termino ? pendientesFiltrados : pendientesFiltrados.slice(0, 7);
  const rankingVisible = verTodoRanking ? proveedoresRanking : proveedoresRanking.slice(0, 7);

  const excesoLpns = Math.round(avanceLpns) - TOPE_LPNS;
  const excesoProveedores = totalProveedoresAgenda - CAPACIDAD_PROVEEDORES;
  const partesExceso = [
    alertaCapacidadLpns && excesoLpns > 0 ? `+${entero.format(excesoLpns)} LPNs` : "",
    alertaCapacidadProveedores && excesoProveedores > 0 ? `+${entero.format(excesoProveedores)} proveedores` : "",
  ].filter(Boolean);

  const fechaAgenda = seleccionado
    ? (seleccionado.fechaCitas ?? fechaProceso)
    : (meta?.fechaAgenda ?? fechaProceso);

  return (
    <div className="-m-4 bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        {/* Encabezado de la agenda generada */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-fp-ink sm:text-4xl">
              AGENDA GENERADA
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-lg text-slate-600 dark:text-zinc-300">
              <span className="tabular-nums">{fechaTitulo(fechaAgenda)}</span>
              <span aria-hidden="true" className="h-5 w-0.5 bg-slate-700 dark:bg-zinc-400" />
              {seleccionado ? (
                <span>Dashboard guardado</span>
              ) : asignadoAGarita ? (
                <span>Asignado a Garita</span>
              ) : (
                <span className="font-semibold text-[#c98f00]">Aún no asignado a Garita</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {permisos.crear || seleccionado ? (
              <button
                type="button"
                onClick={() => {
                  if (seleccionado) {
                    setSeleccionado(null);
                    return;
                  }
                  limpiar();
                }}
                className="text-sm font-semibold text-slate-600 underline-offset-4 hover:underline dark:text-zinc-300"
              >
                {seleccionado ? "Volver al dashboard actual" : "Reprocesar cruce"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setHistorialAbierto(true)}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-fp-line-strong bg-fp-surface px-5 text-base font-bold text-fp-ink transition-colors hover:bg-fp-surface-hover"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l3 2" />
              </svg>
              Historial ({dashboards.length})
            </button>
            {permisos.crear ? (
              <button
                type="button"
                onClick={guardarActual}
                disabled={Boolean(seleccionado)}
                title={
                  seleccionado
                    ? "Vuelve al dashboard actual para guardarlo."
                    : "Guarda el dashboard en el historial y asigna sus citas IKF a Garita."
                }
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#F02615] px-6 text-base font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_32px_-12px_rgba(240,38,21,0.95)] transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SaveIcon className="size-5" />
                Guardar dashboard
              </button>
            ) : null}
          </div>
        </header>

        {aviso && (
          <div
            role="status"
            className={`rounded-xl px-4 py-3 text-sm font-medium ${
              aviso.tipo === "exito"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
                : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-200"
            }`}
          >
            {aviso.texto}
          </div>
        )}

        {seleccionado && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
            Viendo dashboard guardado el {formatearFechaGuardado(seleccionado.guardadoEn)}
          </div>
        )}

        {/* KPIs */}
        <section aria-label="Indicadores de la agenda" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* LPN enteros: también redondea dashboards guardados antes de este cambio. */}
          <KpiCard
            label="LPNs programados"
            value={entero.format(Math.round(avanceLpns))}
            detalle={`Capacidad: ${entero.format(TOPE_LPNS)} · ${avanceLpnsPorcentaje.toFixed(1)}%`}
            porcentaje={avanceLpnsPorcentaje}
            excede={alertaCapacidadLpns}
            color="#F02615"
          />
          <KpiCard
            label="Proveedores agendados"
            value={entero.format(totalProveedoresAgenda)}
            detalle={`Capacidad: ${entero.format(CAPACIDAD_PROVEEDORES)}`}
            porcentaje={(totalProveedoresAgenda / CAPACIDAD_PROVEEDORES) * 100}
            excede={alertaCapacidadProveedores}
            color="#4C8DFF"
          />
          <KpiCard label="Citas totales" value={entero.format(totalCitasDistintas)} color="#2FBF71" />
          <KpiCard label="Proveedores pendientes" value={entero.format(proveedoresSinCita)} color="#FAB701" />
        </section>

        {partesExceso.length > 0 ? (
          <AlertaCapacidad mensaje={`Capacidad excedida: ${partesExceso.join(" y ")}.`} />
        ) : null}

        <section className="grid items-stretch gap-4 lg:grid-cols-[1.1fr_0.95fr_1.1fr]">
          {/* Top de citas por proveedor */}
          <div className={`${tarjeta} flex min-h-[460px] flex-col p-6`}>
            <h2 className="mb-5 text-xl font-bold text-fp-ink">
              {verTodoRanking
                ? `Citas por proveedor (${proveedoresRanking.length})`
                : `Top ${Math.min(7, proveedoresRanking.length)} · Citas por proveedor`}
            </h2>
            {rankingVacio ? (
              <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500 dark:text-zinc-400">
                No hay proveedores con más de una cita.
              </p>
            ) : (
              <>
                <div className={verTodoRanking ? "max-h-[420px] overflow-y-auto pr-1" : ""}>
                  <RankingBarChart items={rankingVisible} />
                </div>
                {proveedoresRanking.length > 7 ? (
                  <div className="mt-auto border-t border-slate-200 dark:border-zinc-800">
                    <VerTodos abierto={verTodoRanking} onClick={() => setVerTodoRanking((v) => !v)} textoCerrado="Ver todos" />
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Dona de atención */}
          <div className={`${tarjeta} flex min-h-[460px] flex-col p-6`}>
            <h2 className="mb-2 text-xl font-bold text-fp-ink">Atención de proveedores</h2>
            <DonaAtencion atendidos={proveedoresConCita} pendientes={proveedoresSinCita} />
          </div>

          {/* Proveedores pendientes */}
          <div className={`${tarjeta} flex min-h-[460px] flex-col p-6`}>
            <h2 className="mb-4 text-xl font-bold text-fp-ink">
              Proveedores pendientes ({entero.format(pendientes.length)})
            </h2>
            {pendientes.length === 0 ? (
              <p className="flex flex-1 items-center justify-center text-center text-sm text-slate-500 dark:text-zinc-400">
                Todos los proveedores de la agenda tienen cita en el Reporte IKF.
              </p>
            ) : (
              <>
                <label htmlFor="buscar-pendiente" className="sr-only">
                  Buscar proveedor pendiente
                </label>
                <div className="relative">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500 dark:text-zinc-400" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    id="buscar-pendiente"
                    type="search"
                    value={busquedaPendiente}
                    onChange={(e) => setBusquedaPendiente(e.target.value)}
                    placeholder="Buscar proveedor"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:border-[#F02615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F02615]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <ul className={`mt-2 divide-y divide-slate-200 dark:divide-zinc-800 ${verTodosPendientes || termino ? "max-h-[360px] overflow-y-auto pr-1" : ""}`}>
                  {pendientesVisibles.length === 0 ? (
                    <li className="py-6 text-center text-sm text-slate-500 dark:text-zinc-400">Sin coincidencias.</li>
                  ) : (
                    pendientesVisibles.map((fila: ProveedorCruce) => (
                      <li
                        key={fila.proveedorNormalizado}
                        className="flex items-baseline justify-between gap-3 px-1.5 py-2.5 text-base text-slate-800 dark:text-zinc-200"
                        title={[fila.proveedorOriginal, ...fila.observaciones].join("\n")}
                      >
                        <span className="truncate">{fila.proveedorOriginal}</span>
                        <span
                          className={`shrink-0 font-mono text-sm tabular-nums ${fila.ruc ? "text-fp-dim" : "font-semibold text-[#F02615]"}`}
                        >
                          {fila.ruc ?? "Sin RUC"}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                {pendientes.length > 7 && !termino ? (
                  <div className="mt-auto border-t border-slate-200 dark:border-zinc-800">
                    <VerTodos
                      abierto={verTodosPendientes}
                      onClick={() => setVerTodosPendientes((v) => !v)}
                      textoCerrado="Ver todos los pendientes"
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        {pie}
      </div>

      {historialAbierto && (
        <HistorialModal
          dashboards={dashboards}
          onCerrar={() => setHistorialAbierto(false)}
          onVer={(dashboard) => {
            setSeleccionado(dashboard);
            setHistorialAbierto(false);
          }}
          onEliminar={permisos.eliminar ? borrarGuardado : undefined}
        />
      )}
    </div>
  );
}