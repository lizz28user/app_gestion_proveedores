"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eliminarLlegadaHistorico,
  obtenerLlegadasHistorico,
  type HistoricoArrival,
} from "@/lib/historico-service";
import { usePermisos } from "@/lib/use-permisos";

const STATUS_CLASSES: Record<string, string> = {
  Vigente:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Vencida: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  "No homologado":
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};

const ARRIVAL_STATUS_CLASSES: Record<string, string> = {
  Puntual:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Tardanza:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  Anticipado: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
};

export function HistoricoView() {
  // Borrar registros del histórico: solo Supervisor y Administrador.
  const permisos = usePermisos("garita");
  const [borrando, setBorrando] = useState<string | null>(null);
  const [data, setData] = useState<HistoricoArrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [ruc, setRuc] = useState("");
  const [estadoLlegada, setEstadoLlegada] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resultado = await obtenerLlegadasHistorico({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        ruc: ruc || undefined,
        estadoLlegada: estadoLlegada || undefined,
      });
      setData(resultado);
    } catch {
      setError("No se pudo cargar el histórico.");
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, ruc, estadoLlegada]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtrados = useMemo(() => {
    return data;
  }, [data]);

  async function borrarRegistro(row: HistoricoArrival) {
    if (!permisos.eliminar) return;
    if (
      !window.confirm(
        `¿Borrar del histórico la llegada de ${row.proveedor} (${row.fecha ?? "sin fecha"})?\n\nEsta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    setBorrando(row.id);
    setError(null);
    try {
      await eliminarLlegadaHistorico(row.id);
      setData((actual) => actual.filter((item) => item.id !== row.id));
    } catch {
      setError("No se pudo borrar el registro. Inténtalo de nuevo.");
    } finally {
      setBorrando(null);
    }
  }

  function handleExport() {
    const header = [
      "Fecha",
      "RUC",
      "Nombre del proveedor",
      "Hora solicitada",
      "Llegada",
      "Estado de llegada",
      "Unidades estimadas",
      "Nombre del conductor",
      "Licencia",
      "Placa",
      "Homologación",
    ];

    const rows = filtrados.map((row) => [
      row.fecha ?? "",
      row.ruc,
      row.proveedor,
      row.horaSolicitada,
      row.llegada ?? "",
      row.estadoLlegada ?? "Pendiente",
      row.unidadesEstimadas ?? "",
      row.conductor ?? "",
      row.licencia ?? "",
      row.placa ?? "",
      row.homologacion ?? "",
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `historico-llegadas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Histórico de llegadas
          </h1>
          <p className="text-center py-10 text-slate-500 dark:text-zinc-400">
            Cargando histórico…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
            Histórico de llegadas
          </h1>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-3xl">
              Histórico de llegadas
            </h1>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-700 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-red-500 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus-visible:ring-offset-zinc-900"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
            Exportar CSV
          </button>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-200 p-4 dark:border-zinc-800">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Fecha desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Fecha hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  RUC
                </label>
                <input
                  type="text"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value)}
                  placeholder="RUC del proveedor"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Estado de llegada
                </label>
                <select
                  value={estadoLlegada}
                  onChange={(e) => setEstadoLlegada(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="">Todos</option>
                  <option value="Puntual">Puntual</option>
                  <option value="Tardanza">Tardanza</option>
                  <option value="Anticipado">Anticipado</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                {filtrados.length} registro{filtrados.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Histórico de llegadas con fecha, RUC, proveedor, hora
                solicitada, llegada, estado, unidades, conductor, licencia,
                placa y homologación.
              </caption>
              <thead>
                <tr className="bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
                  <th scope="col" className="px-5 py-3 font-bold">
                    Fecha
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    RUC
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Nombre del proveedor
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Hora solicitada
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Llegada
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Estado de llegada
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Unidades estimadas
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Nombre del conductor
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Licencia
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Placa
                  </th>
                  <th scope="col" className="px-5 py-3 font-bold">
                    Homologación
                  </th>
                  {permisos.eliminar ? (
                    <th scope="col" className="px-5 py-3 text-center font-bold">
                      Acción
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={permisos.eliminar ? 12 : 11}
                      className="px-5 py-10 text-center text-sm text-slate-500 dark:text-zinc-400"
                    >
                      No se encontraron registros de llegadas.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {row.fecha ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {row.ruc}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-zinc-200">
                        {row.proveedor}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                          <span className="font-semibold">{row.horaSolicitada}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {row.llegada ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-zinc-200">
                            <span className="font-semibold">{row.llegada}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.estadoLlegada ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ARRIVAL_STATUS_CLASSES[row.estadoLlegada] ?? ARRIVAL_STATUS_CLASSES.Puntual}`}
                          >
                            {row.estadoLlegada}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-slate-500 dark:text-zinc-500 text-sm">
                          {row.unidadesEstimadas ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {row.conductor ?? (
                          <span className="text-slate-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {row.licencia ?? (
                          <span className="text-slate-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {row.placa ?? (
                          <span className="text-slate-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {row.homologacion ? (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[row.homologacion] ?? STATUS_CLASSES["No homologado"]}`}
                          >
                            {row.homologacion}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                      {permisos.eliminar ? (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => void borrarRegistro(row)}
                            disabled={borrando === row.id}
                            aria-label={`Borrar del histórico la llegada de ${row.proveedor}`}
                            className="inline-flex items-center justify-center rounded-lg border border-[#F02615]/40 px-3 py-2 text-sm font-semibold text-[#F02615] transition-colors hover:bg-[#F02615]/10 disabled:opacity-50"
                          >
                            {borrando === row.id ? "Borrando…" : "Borrar"}
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
