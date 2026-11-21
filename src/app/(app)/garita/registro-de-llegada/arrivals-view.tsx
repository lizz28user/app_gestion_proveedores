"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrivalFormModal } from "./arrival-form-modal";
import {
  EXTRA_ARRIVALS_STORAGE_KEY,
  type Arrival,
  type ArrivalRow,
  type ArrivalStatus,
  type HomologationStatus,
} from "./arrivals-data";
import { PROVIDERS } from "./providers-data";
import { SCHEDULE_DATE, SCHEDULED_ARRIVALS } from "./scheduled-arrivals";
import { guardarLlegadaHistorico } from "@/lib/historico-service";
import { cargarCitasDelReporte } from "@/lib/citas-del-dia";
import { usePermisos } from "@/lib/use-permisos";
import { eliminarRecepcionDeLlegada } from "@/components/reception/storage";
import {
  normalizeArrivalStatus,
  normalizeStatus,
  normalizeText,
  todayIso,
  ARRIVAL_STATUS_CLASSES,
} from "@/lib/utils";

const STATUS_CLASSES: Record<HomologationStatus, string> = {
  Vigente:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  Vencida: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  "No homologado":
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
};
import {
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "@/components/icons";

export function ArrivalsView() {
  // Agregar llegadas: todos los roles de Garita. Editar una ya registrada: Supervisor y Administrador.
  const permisos = usePermisos("garita");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [registered, setRegistered] = useState<Arrival[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ArrivalRow | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Citas del día: del Reporte IKF cargado en el Dashboard; si no hay, datos de ejemplo.
  const [reporte, setReporte] = useState<ReturnType<typeof cargarCitasDelReporte>>(null);

  useEffect(() => {
    const cargado = cargarCitasDelReporte();
    setReporte(cargado);
    setDate(cargado?.fecha ?? todayIso());

    // Búsqueda que llega desde el buscador de la cabecera (?q=…).
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);

    try {
      const raw = window.localStorage.getItem(EXTRA_ARRIVALS_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRegistered(
            (parsed as Arrival[]).map((arrival) => ({
              ...arrival,
              fecha: arrival.fecha ?? todayIso(),
              horaSolicitada: arrival.horaSolicitada ?? arrival.llegada,
              estadoLlegada: normalizeArrivalStatus(arrival.estadoLlegada),
              homologacion: normalizeStatus(arrival.homologacion),
            })),
          );
        }
      }
    } catch {
      // Ignorar datos inválidos del almacenamiento local.
    }
  }, []);

  const citasActivas = reporte?.citas ?? SCHEDULED_ARRIVALS;
  const fechaCitas = reporte?.fecha ?? SCHEDULE_DATE;
  const esEjemplo = reporte === null;

  const rows = useMemo<ArrivalRow[]>(() => {
    // Solo las llegadas registradas en la fecha seleccionada.
    const delDia = registered.filter((item) => !date || item.fecha === date);
    const byRuc = new Map(delDia.map((item) => [item.ruc, item]));
    const programadas = date === fechaCitas ? citasActivas : [];

    const scheduledRows: ArrivalRow[] = programadas.map((scheduled) => {
      const done = byRuc.get(scheduled.ruc);

      if (done) {
        return {
          ruc: done.ruc,
          proveedor: done.proveedor,
          fecha: done.fecha,
          horaSolicitada: done.horaSolicitada,
          unidadesEstimadas: done.unidadesEstimadas,
          llegada: done.llegada,
          estadoLlegada: done.estadoLlegada,
          conductor: done.conductor,
          licencia: done.licencia,
          placa: done.placa,
          homologacion: done.homologacion,
        };
      }

      return {
        ruc: scheduled.ruc,
        proveedor: scheduled.proveedor,
        fecha: fechaCitas,
        horaSolicitada: scheduled.horaSolicitada,
        unidadesEstimadas: scheduled.unidadesEstimadas,
      };
    });

    const scheduledRucs = new Set(programadas.map((item) => item.ruc));
    const extraRows: ArrivalRow[] = delDia
      .filter((item) => !scheduledRucs.has(item.ruc))
      .map((item) => ({
        ruc: item.ruc,
        proveedor: item.proveedor,
        fecha: item.fecha,
        horaSolicitada: item.horaSolicitada,
        unidadesEstimadas: item.unidadesEstimadas,
        llegada: item.llegada,
        estadoLlegada: item.estadoLlegada,
        conductor: item.conductor,
        licencia: item.licencia,
        placa: item.placa,
        homologacion: item.homologacion,
      }));

    return [...scheduledRows, ...extraRows].sort((a, b) =>
      a.horaSolicitada.localeCompare(b.horaSolicitada),
    );
  }, [registered, date, fechaCitas, citasActivas]);

  const scheduledHours = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of citasActivas) {
      map[item.ruc] = item.horaSolicitada;
    }
    return map;
  }, [citasActivas]);

  const resumen = useMemo(() => {
    const llegados = rows.filter((row) => row.llegada);
    return {
      total: rows.length,
      llegados: llegados.length,
      puntuales: llegados.filter((row) => row.estadoLlegada === "Puntual").length,
      tardanzas: llegados.filter((row) => row.estadoLlegada === "Tardanza").length,
      alertas: llegados.filter(
        (row) => row.homologacion && row.homologacion !== "Vigente",
      ).length,
      unidades: rows.reduce(
        (suma, row) => suma + (Number(row.unidadesEstimadas) || 0),
        0,
      ),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = normalizeText(query.trim());

    if (!term) {
      return rows;
    }

    return rows.filter((row) =>
      [row.ruc, row.proveedor, row.conductor ?? ""].some((value) =>
        normalizeText(value).includes(term),
      ),
    );
  }, [query, rows]);

  const pendingCount = useMemo(
    () => rows.filter((row) => !row.llegada).length,
    [rows],
  );

  const openModal = useCallback(() => {
    setSavedName(null);
    setEditingRow(null);
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((row: ArrivalRow) => {
    setSavedName(null);
    setEditingRow(row);
    setIsModalOpen(true);
  }, []);

  // Borrar una llegada registrada: solo Supervisor y Administrador.
  // También borra su recepción; la cita vuelve a quedar pendiente.
  const borrarLlegada = useCallback(
    (row: ArrivalRow) => {
      if (!permisos.eliminar || !row.llegada) return;
      if (
        !window.confirm(
          `¿Borrar la llegada de ${row.proveedor}?\n\nTambién se borrará su recepción (puerta, operario e incidencias). La cita volverá a quedar pendiente.`,
        )
      ) {
        return;
      }
      setRegistered((actual) => {
        const siguiente = actual.filter(
          (item) => !(item.ruc === row.ruc && item.fecha === row.fecha),
        );
        try {
          window.localStorage.setItem(EXTRA_ARRIVALS_STORAGE_KEY, JSON.stringify(siguiente));
        } catch {
          // Sin persistencia si localStorage no está disponible.
        }
        return siguiente;
      });
      eliminarRecepcionDeLlegada(row.ruc, row.horaSolicitada, row.fecha ?? date);
      setSavedName(null);
    },
    [permisos.eliminar],
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingRow(null);
  }, []);

  const handleSave = useCallback(async (arrival: Arrival) => {
    // Sobrescribir una llegada ya registrada requiere permiso de edición.
    const yaExiste = registered.some(
      (item) => item.ruc === arrival.ruc && item.fecha === arrival.fecha,
    );
    if ((yaExiste && !permisos.editar) || (!yaExiste && !permisos.crear)) {
      setIsModalOpen(false);
      setEditingRow(null);
      return;
    }
    setIsSaving(true);
    try {
      setRegistered((current) => {
        const next = [
          ...current.filter((item) => item.ruc !== arrival.ruc),
          arrival,
        ];
        try {
          window.localStorage.setItem(
            EXTRA_ARRIVALS_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          // Si el almacenamiento local falla, la llegada se mantiene en memoria.
        }
        return next;
      });

      // Guardar también en el histórico de llegadas
      try {
        await guardarLlegadaHistorico(arrival);
      } catch {
        // Si el histórico falla, la llegada ya quedó guardada en localStorage.
      }

      setSavedName(arrival.proveedor);
    } catch {
      // Si algo falló, la llegada ya quedó en localStorage.
    } finally {
      // Cerrar el modal SIEMPRE, incluso si hubo errores.
      setIsModalOpen(false);
      setEditingRow(null);
      setIsSaving(false);
      window.setTimeout(() => {
        setIsModalOpen(false);
        setEditingRow(null);
        setIsSaving(false);
      }, 300);
    }
  }, [registered, permisos.crear, permisos.editar]);

  function handleExport() {
    const header = [
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

    const rowsToExport = filtered.map((row) => [
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

    const csv = [header, ...rowsToExport]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `llegadas-${date || "hoy"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Garita · {formatearFechaLarga(date)}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-fp-ink sm:text-3xl">
              Llegadas del día
            </h1>
            {/* Solo se avisa cuando NO hay agenda real asignada. */}
            {esEjemplo ? (
              <p className="mt-2 inline-flex rounded-lg border border-[#FAB701]/40 bg-[#FAB701]/10 px-3 py-1.5 text-sm text-fp-ink">
                Citas de ejemplo: guarda el Dashboard de citas para usar las del día.
              </p>
            ) : null}
          </div>

          {permisos.crear ? (
            <button
              type="button"
              onClick={openModal}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F02615] px-5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_28px_-10px_rgba(240,38,21,0.95)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F02615]/30"
            >
              <PlusIcon className="size-4" />
              Registrar llegada
            </button>
          ) : null}
        </header>

        <section
          aria-label="Resumen del día"
          className="grid grid-cols-2 gap-3 lg:grid-cols-5"
        >
          <Indicador etiqueta="Citas del día" valor={resumen.total} color="#76797B" />
          <Indicador
            etiqueta="Llegadas"
            valor={`${resumen.llegados}/${resumen.total}`}
            color="#7FB2FF"
            progreso={resumen.total ? resumen.llegados / resumen.total : 0}
          />
          <Indicador etiqueta="Puntuales" valor={resumen.puntuales} color="#2FBF71" />
          <Indicador etiqueta="Tardanzas" valor={resumen.tardanzas} color="#FAB701" />
          <Indicador
            etiqueta="Alertas homologación"
            valor={resumen.alertas}
            color="#F02615"
            destacado={resumen.alertas > 0}
          />
        </section>

        {savedName ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            <CheckIcon className="mt-0.5 size-4 shrink-0" />
            <span>
              Llegada de <strong>{savedName}</strong> registrada correctamente.
            </span>
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-zinc-800 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-xl">
              <label htmlFor="arrival-search" className="sr-only">
                Buscar por RUC, proveedor o conductor
              </label>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-zinc-500"
              >
                <SearchIcon className="size-4" />
              </span>
              <input
                id="arrival-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por RUC, proveedor o conductor"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto">
              <div>
                <label htmlFor="arrival-date" className="sr-only">
                  Fecha de los registros
                </label>
                <input
                  id="arrival-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:[color-scheme:dark] sm:w-48"
                />
              </div>

              <button
                type="button"
                onClick={handleExport}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-700 px-4 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-red-500 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus-visible:ring-offset-zinc-900"
              >
                <DownloadIcon className="size-4" />
                Exportar
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              Registros de llegada
            </h2>
            <span
              aria-hidden="true"
              className="h-6 w-px bg-slate-300 dark:bg-zinc-700"
            />
            <p
              aria-live="polite"
              className="text-sm text-slate-500 dark:text-zinc-400"
            >
              {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
            </p>
            {pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                <ClockIcon className="size-3.5" />
                {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Registros de llegada de proveedores con RUC, nombre del
                proveedor, hora solicitada, llegada, estado de llegada, unidades
                estimadas, conductor, licencia, placa y estado de homologación.
              </caption>
              <thead>
                <tr className="bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
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
                  <th scope="col" className="px-5 py-3 font-bold">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-5 py-10 text-center text-sm text-slate-500 dark:text-zinc-400"
                    >
                      No se encontraron registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, index) => (
                    <tr
                      key={`${row.ruc}-${row.horaSolicitada}-${index}`}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {row.ruc}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-zinc-200">
                        {row.proveedor}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                          <ClockIcon className="size-4 text-slate-500 dark:text-zinc-400" />
                          <span className="font-semibold">
                            {row.horaSolicitada}
                          </span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {row.llegada ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-800 dark:text-zinc-200">
                            <ClockIcon className="size-4 text-slate-500 dark:text-zinc-400" />
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
                          <ArrivalStatusBadge status={row.estadoLlegada} />
                        ) : (
                          <PendingBadge />
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
                          <StatusBadge status={row.homologacion} />
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {/* Sin llegada: registrar (agregar). Con llegada: editar. */}
                        {row.llegada ? (
                          permisos.editar || permisos.eliminar ? (
                            <div className="flex items-center justify-center gap-1">
                              {permisos.editar ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  aria-label={`Editar llegada de ${row.proveedor}`}
                                  title="Editar llegada"
                                  className="inline-flex size-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                                >
                                  <PencilIcon className="size-5" />
                                </button>
                              ) : null}
                              {permisos.eliminar ? (
                                <button
                                  type="button"
                                  onClick={() => borrarLlegada(row)}
                                  aria-label={`Borrar llegada de ${row.proveedor}`}
                                  title="Borrar llegada"
                                  className="inline-flex size-10 items-center justify-center rounded-lg text-[#F02615] transition-colors hover:bg-[#F02615]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                                >
                                  <XIcon className="size-5" />
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <span
                              className="text-[11px] font-semibold text-fp-faint"
                              title="Solo Supervisor o Administrador pueden editar una llegada registrada"
                            >
                              Registrada
                            </span>
                          )
                        ) : permisos.crear ? (
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            aria-label={`Registrar llegada de ${row.proveedor}`}
                            title="Registrar llegada"
                            className="inline-flex size-10 items-center justify-center rounded-lg text-[#F02615] transition-colors hover:bg-[#F02615]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                          >
                            <PlusIcon className="size-5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Mostrando {filtered.length} de {rows.length} registros
            </p>
            <p>
              {resumen.llegados} llegada{resumen.llegados === 1 ? "" : "s"}{" "}
              registrada{resumen.llegados === 1 ? "" : "s"} ·{" "}
              {Math.round(resumen.unidades).toLocaleString("es-PE")} unidades
              estimadas
            </p>
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <ArrivalFormModal
          providers={PROVIDERS}
          scheduledHours={scheduledHours}
          initialValues={editingRow ?? undefined}
          isSaving={isSaving}
          onClose={closeModal}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}

function formatearFechaLarga(iso: string): string {
  if (!iso) return "";
  const fecha = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function Indicador({
  etiqueta,
  valor,
  color,
  progreso,
  destacado = false,
}: {
  etiqueta: string;
  valor: number | string;
  color: string;
  progreso?: number;
  destacado?: boolean;
}) {
  return (
    <div
      className={`glass relative overflow-hidden rounded-2xl p-4 ${destacado ? "!border-[#F02615]/50" : ""}`}
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
        className={`mt-2 text-[28px] font-extrabold leading-none tracking-tight tabular-nums ${destacado ? "text-[#F02615]" : "text-fp-ink"}`}
      >
        {valor}
      </p>
      {progreso !== undefined ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-fp-track">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.round(progreso * 100)}%`, background: color }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ArrivalStatusBadge({ status }: { status: ArrivalStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ARRIVAL_STATUS_CLASSES[status]}`}
    >
      {status === "Puntual" ? (
        <CheckIcon className="size-3.5" />
      ) : status === "Tardanza" ? (
        <ClockIcon className="size-3.5" />
      ) : (
        <XIcon className="size-3.5" />
      )}
      {status}
    </span>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
      <ClockIcon className="size-3.5" />
      Pendiente
    </span>
  );
}

function StatusBadge({ status }: { status: HomologationStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}
    >
      {status === "Vigente" ? (
        <CheckIcon className="size-3.5" />
      ) : status === "No homologado" ? (
        <ClockIcon className="size-3.5" />
      ) : (
        <XIcon className="size-3.5" />
      )}
      {status}
    </span>
  );
}
