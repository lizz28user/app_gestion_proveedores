"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ESTADOS_INCIDENCIA,
  MOTIVOS_INCIDENCIA,
  cargarIncidencias,
  crearIncidencia,
  esCritica,
  formatearFecha,
  guardarIncidencias,
  incidenciaSchema,
  textoTranscurrido,
  type EstadoIncidencia,
  type IncidenciaFormValues,
  type IncidenciaProveedor,
} from "@/lib/incidencias-proveedores";
import { todayIso } from "@/lib/utils";
import { usePermisos } from "@/lib/use-permisos";
import {
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";

type Aviso = { tipo: "exito" | "error"; texto: string };

const ESTADO_CLASES: Record<EstadoIncidencia, string> = {
  Pendiente:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "En Proceso":
    "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  Resuelta:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
};

const INPUT_CLASES =
  "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500";

function GaugeCard({
  label,
  value,
  max,
  color,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: ReactNode;
}) {
  const radio = 50;
  const circunferencia = Math.PI * radio;
  const porcentaje = max > 0 ? Math.min(1, value / max) : 0;
  const dashOffset = circunferencia - porcentaje * circunferencia;

  return (
    <article className="relative flex flex-col items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="mb-2 flex w-full items-center justify-center gap-2">
        <span
          className="flex size-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
          {label}
        </p>
      </div>
      <div className="relative mt-2 flex h-20 w-40 items-end justify-center">
        <svg viewBox="0 0 120 70" className="h-full w-full" aria-hidden="true">
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke="currentColor"
            strokeWidth="14"
            strokeLinecap="round"
            className="text-slate-200 dark:text-zinc-800"
          />
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute bottom-0 text-4xl font-black text-slate-900 dark:text-zinc-50">
          {value}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
        Registros
      </p>
    </article>
  );
}

export function IncidenciasView() {
  // Auxiliar: solo ver. Supervisor y Administrador: agregar, editar y borrar.
  const permisos = usePermisos("agendamientos");
  const [incidencias, setIncidencias] = useState<IncidenciaProveedor[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoIncidencia | "">("");
  const [soloCriticas, setSoloCriticas] = useState(false);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<IncidenciaProveedor | null>(null);
  const [form, setForm] = useState<IncidenciaFormValues>({
    fecha: todayIso(),
    proveedor: "",
    motivo: MOTIVOS_INCIDENCIA[0],
    observaciones: "",
    estado: "Pendiente",
  });
  const [errores, setErrores] = useState<
    Partial<Record<keyof IncidenciaFormValues, string>>
  >({});
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    setIncidencias(cargarIncidencias());
  }, []);

  const persistir = (nuevas: IncidenciaProveedor[]) => {
    setIncidencias(nuevas);
    guardarIncidencias(nuevas);
  };

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return incidencias
      .filter((i) => {
        if (texto) {
          const coincide =
            i.proveedor.toLowerCase().includes(texto) ||
            i.observaciones.toLowerCase().includes(texto) ||
            i.motivo.toLowerCase().includes(texto);
          if (!coincide) return false;
        }
        if (desde && i.fecha < desde) return false;
        if (hasta && i.fecha > hasta) return false;
        if (estadoFiltro && i.estado !== estadoFiltro) return false;
        if (soloCriticas && !esCritica(i)) return false;
        return true;
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [incidencias, busqueda, desde, hasta, estadoFiltro, soloCriticas]);

  // Tarjetas superiores: una por motivo.
  const kpis = useMemo(
    () => [
      {
        label: "No generó su cita",
        value: incidencias.filter((i) => i.motivo === "No generó su cita").length,
        color: "#F37021",
        icon: "◷",
      },
      {
        label: "Cita tardía",
        value: incidencias.filter((i) => i.motivo === "Cita tardía").length,
        color: "#E3001B",
        icon: "!",
      },
      {
        label: "Por límite cubierto",
        value: incidencias.filter((i) => i.motivo === "Por límite cubierto").length,
        color: "#3B82F6",
        icon: "▣",
      },
      {
        label: "Reprogramación",
        value: incidencias.filter((i) => i.motivo === "Reprogramación").length,
        color: "#8B5CF6",
        icon: "↻",
      },
    ],
    [incidencias]
  );

  const maxKpi = Math.max(...kpis.map((k) => k.value), 1);
  const criticas = incidencias.filter((i) => esCritica(i)).length;

  const hayFiltros = Boolean(busqueda || desde || hasta || estadoFiltro || soloCriticas);

  const limpiarFiltros = () => {
    setBusqueda("");
    setDesde("");
    setHasta("");
    setEstadoFiltro("");
    setSoloCriticas(false);
  };

  const abrirNueva = () => {
    setEditando(null);
    setErrores({});
    setForm({
      fecha: todayIso(),
      proveedor: "",
      motivo: MOTIVOS_INCIDENCIA[0],
      observaciones: "",
      estado: "Pendiente",
    });
    setModalAbierto(true);
  };

  const abrirEdicion = (incidencia: IncidenciaProveedor) => {
    setEditando(incidencia);
    setErrores({});
    setForm({
      fecha: incidencia.fecha,
      proveedor: incidencia.proveedor,
      motivo: incidencia.motivo,
      observaciones: incidencia.observaciones,
      estado: incidencia.estado,
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setEditando(null);
    setErrores({});
  };

  const guardar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const resultado = incidenciaSchema.safeParse(form);
    if (!resultado.success) {
      const nuevosErrores: Partial<
        Record<keyof IncidenciaFormValues, string>
      > = {};
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0] as keyof IncidenciaFormValues;
        if (!nuevosErrores[campo]) nuevosErrores[campo] = issue.message;
      }
      setErrores(nuevosErrores);
      return;
    }

    const nueva = crearIncidencia(resultado.data, editando);
    const lista = editando
      ? incidencias.map((i) => (i.id === editando.id ? nueva : i))
      : [nueva, ...incidencias];

    persistir(lista);
    setAviso({
      tipo: "exito",
      texto: editando ? "Incidencia actualizada." : "Incidencia registrada.",
    });
    cerrarModal();
  };

  const eliminar = (id: string) => {
    persistir(incidencias.filter((i) => i.id !== id));
    setSeleccion((actual) => actual.filter((s) => s !== id));
    setAviso({ tipo: "exito", texto: "Incidencia eliminada." });
  };

  const eliminarSeleccionadas = () => {
    if (seleccion.length === 0) return;
    persistir(incidencias.filter((i) => !seleccion.includes(i.id)));
    setSeleccion([]);
    setAviso({ tipo: "exito", texto: "Incidencias eliminadas." });
  };

  const toggleSeleccion = (id: string) => {
    setSeleccion((actual) =>
      actual.includes(id)
        ? actual.filter((s) => s !== id)
        : [...actual, id]
    );
  };

  const todosVisiblesSeleccionados =
    filtradas.length > 0 && filtradas.every((i) => seleccion.includes(i.id));

  const toggleTodos = () => {
    setSeleccion(
      todosVisiblesSeleccionados ? [] : filtradas.map((i) => i.id)
    );
  };

  const exportar = () => {
    if (filtradas.length === 0) return;
    const filas: Array<Array<string | number>> = [
      ["Fecha", "Proveedor", "Motivo", "Observaciones", "Estado", "Tiempo"],
      ...filtradas.map((i) => [
        formatearFecha(i.fecha),
        i.proveedor,
        i.motivo,
        i.observaciones,
        i.estado,
        textoTranscurrido(i),
      ]),
    ];
    const csv = filas
      .map((fila) =>
        fila
          .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "incidencias-proveedores.csv";
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
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

      {/* Indicadores de Rendimiento */}
      <section className="overflow-hidden rounded-xl border border-slate-200 border-t-4 border-t-[#E3001B] bg-white shadow-sm dark:border-zinc-800 dark:border-t-[#E3001B] dark:bg-zinc-900">
        <div className="p-4 sm:p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">
            Indicadores de Rendimiento
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <GaugeCard key={kpi.label} {...kpi} max={maxKpi} />
            ))}
          </div>
          <div
            className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              criticas > 0
                ? "border-[#F02615]/40 bg-[#F02615]/10 text-fp-ink"
                : "border-fp-line bg-fp-surface text-fp-dim"
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-2.5 rounded-full ${criticas > 0 ? "bg-[#F02615] shadow-[0_0_8px_#F02615]" : "bg-[#2FBF71]"}`}
            />
            {criticas > 0 ? (
              <span>
                <strong className="font-extrabold text-[#F02615]">{criticas}</strong>{" "}
                incidencia{criticas === 1 ? "" : "s"} crítica{criticas === 1 ? "" : "s"}: llevan más de 1 día sin resolverse.
              </span>
            ) : (
              <span>No hay incidencias críticas: ninguna lleva más de 1 día sin resolverse.</span>
            )}
            {criticas > 0 ? (
              <button
                type="button"
                onClick={() => setSoloCriticas((v) => !v)}
                className="ml-auto rounded-lg border border-[#F02615]/40 px-3 py-1.5 text-xs font-bold text-[#F02615] transition hover:bg-[#F02615]/10"
              >
                {soloCriticas ? "Ver todas" : "Ver solo críticas"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Listado de registros */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-4 border-b border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">
                Listado de registros
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                {filtradas.length} de {incidencias.length} registros
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportar}
                disabled={filtradas.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <DownloadIcon className="size-4" />
                Exportar
              </button>
              {permisos.crear ? (
                <button
                  type="button"
                  onClick={abrirNueva}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E3001B] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
                >
                  <PlusIcon className="size-4" />
                  Nueva incidencia
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="relative w-full sm:max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                aria-label="Buscar incidencias"
                className={`${INPUT_CLASES} pl-9`}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={`${INPUT_CLASES} w-auto`}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Hasta
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={`${INPUT_CLASES} w-auto`}
              />
            </label>
            <select
              value={estadoFiltro}
              onChange={(e) =>
                setEstadoFiltro(e.target.value as EstadoIncidencia | "")
              }
              aria-label="Filtrar por estado"
              className={`${INPUT_CLASES} w-full sm:w-auto`}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_INCIDENCIA.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
            {hayFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400"
              >
                <ClockIcon className="size-4" />
                Limpiar Filtros
              </button>
            )}
          </div>

          {permisos.eliminar && seleccion.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                {seleccion.length} SELECCIONADO(S)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSeleccion([])}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  Limpiar selección
                </button>
                <button
                  type="button"
                  onClick={eliminarSeleccionadas}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#E3001B] px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                >
                  <XIcon className="size-3.5" />
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Listado de incidencias de proveedores
            </caption>
            <thead>
              <tr className="bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                <th scope="col" className="w-10 px-4 py-3">
                  {permisos.eliminar ? (
                    <input
                      type="checkbox"
                      checked={todosVisiblesSeleccionados}
                      onChange={toggleTodos}
                      aria-label="Seleccionar todas las incidencias visibles"
                      className="size-4 cursor-pointer rounded border-slate-300"
                    />
                  ) : null}
                </th>
                {[
                  "Fecha",
                  "Proveedor",
                  "Motivo",
                  "Observaciones",
                  "Estado",
                  "Tiempo",
                  "Acciones",
                ].map((columna) => (
                  <th
                    key={columna}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-14 text-center text-sm text-slate-500 dark:text-zinc-400"
                  >
                    No se encontraron registros.
                  </td>
                </tr>
              ) : (
                filtradas.map((incidencia) => (
                  <tr
                    key={incidencia.id}
                    className={`hover:bg-slate-50/70 dark:hover:bg-zinc-800/50 ${
                      esCritica(incidencia) ? "bg-[#F02615]/[0.07] shadow-[inset_3px_0_0_#F02615]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      {permisos.eliminar ? (
                        <input
                          type="checkbox"
                          checked={seleccion.includes(incidencia.id)}
                          onChange={() => toggleSeleccion(incidencia.id)}
                          aria-label={`Seleccionar incidencia de ${incidencia.proveedor}`}
                          className="size-4 cursor-pointer rounded border-slate-300"
                        />
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-zinc-300">
                      {formatearFecha(incidencia.fecha)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-100">
                      {incidencia.proveedor}
                      {incidencia.origen === "dashboard" ? (
                        <span className="mt-0.5 block text-[11px] font-medium text-fp-faint">
                          Generada por el Dashboard
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">
                      {incidencia.motivo}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-500 dark:text-zinc-400">
                      <span className="line-clamp-2">
                        {incidencia.observaciones}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${ESTADO_CLASES[incidencia.estado]}`}
                      >
                        {incidencia.estado}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p
                        className={
                          esCritica(incidencia)
                            ? "font-bold text-[#F02615]"
                            : "text-slate-600 dark:text-zinc-300"
                        }
                      >
                        {textoTranscurrido(incidencia)}
                      </p>
                      {esCritica(incidencia) ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#F02615] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          Crítica
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {permisos.editar ? (
                          <button
                            type="button"
                            onClick={() => abrirEdicion(incidencia)}
                            aria-label={`Editar incidencia de ${incidencia.proveedor}`}
                            className="rounded-lg border border-slate-300 p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          >
                            <PencilIcon className="size-4" />
                          </button>
                        ) : null}
                        {permisos.eliminar ? (
                          <button
                            type="button"
                            onClick={() => eliminar(incidencia.id)}
                            aria-label={`Eliminar incidencia de ${incidencia.proveedor}`}
                            className="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                          >
                            <XIcon className="size-4" />
                          </button>
                        ) : null}
                        {!permisos.editar && !permisos.eliminar ? (
                          <span className="text-xs text-fp-faint">Solo lectura</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
          Los indicadores consideran todos los registros de esta sección.
        </div>
      </section>

      {/* Modal de incidencia */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar formulario"
            onClick={cerrarModal}
            className="fixed inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-incidencia"
            className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="titulo-incidencia"
                  className="text-xl font-bold text-slate-900 dark:text-zinc-50"
                >
                  {editando ? "Editar registro" : "Nueva Incidencia"}
                </h2>
              </div>
              <button
                type="button"
                onClick={cerrarModal}
                aria-label="Cerrar"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <form onSubmit={guardar} className="flex flex-col gap-4" noValidate>
              <div>
                <label
                  htmlFor="incidencia-proveedor"
                  className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-200"
                >
                  Proveedor
                </label>
                <input
                  id="incidencia-proveedor"
                  type="text"
                  value={form.proveedor}
                  onChange={(e) =>
                    setForm((actual) => ({
                      ...actual,
                      proveedor: e.target.value,
                    }))
                  }
                  aria-invalid={Boolean(errores.proveedor)}
                  className={INPUT_CLASES}
                  placeholder="Nombre del proveedor"
                />
                {errores.proveedor && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errores.proveedor}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="incidencia-fecha"
                    className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-200"
                  >
                    Fecha
                  </label>
                  <input
                    id="incidencia-fecha"
                    type="date"
                    value={form.fecha}
                    onChange={(e) =>
                      setForm((actual) => ({
                        ...actual,
                        fecha: e.target.value,
                      }))
                    }
                    aria-invalid={Boolean(errores.fecha)}
                    className={INPUT_CLASES}
                  />
                  {errores.fecha && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {errores.fecha}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="incidencia-estado"
                    className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-200"
                  >
                    Estado
                  </label>
                  <select
                    id="incidencia-estado"
                    value={form.estado}
                    onChange={(e) =>
                      setForm((actual) => ({
                        ...actual,
                        estado: e.target.value as EstadoIncidencia,
                      }))
                    }
                    className={INPUT_CLASES}
                  >
                    {ESTADOS_INCIDENCIA.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="incidencia-motivo"
                  className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-200"
                >
                  Motivo
                </label>
                <select
                  id="incidencia-motivo"
                  value={form.motivo}
                  onChange={(e) =>
                    setForm((actual) => ({
                      ...actual,
                      motivo: e.target.value as IncidenciaFormValues["motivo"],
                    }))
                  }
                  className={INPUT_CLASES}
                >
                  {MOTIVOS_INCIDENCIA.map((motivo) => (
                    <option key={motivo} value={motivo}>
                      {motivo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="incidencia-observaciones"
                  className="mb-1 block text-sm font-semibold text-slate-700 dark:text-zinc-200"
                >
                  Observaciones
                </label>
                <textarea
                  id="incidencia-observaciones"
                  rows={3}
                  value={form.observaciones}
                  onChange={(e) =>
                    setForm((actual) => ({
                      ...actual,
                      observaciones: e.target.value,
                    }))
                  }
                  aria-invalid={Boolean(errores.observaciones)}
                  className={`${INPUT_CLASES} h-auto py-2`}
                  placeholder="Detalle de la incidencia"
                />
                {errores.observaciones && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {errores.observaciones}
                  </p>
                )}
              </div>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#E3001B] px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                >
                  <CheckIcon className="size-4" />
                  {editando ? "Guardar cambios" : "Registrar incidencia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
