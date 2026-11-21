"use client";

import { useEffect } from "react";
import type { Reception } from "./types";
import { RESULT_CLASSES, RESULT_LABELS } from "./types";
import { toSafeNumber } from "./storage";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const contenido =
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "object"
      ? "—"
      : value;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">
        {contenido}
      </span>
    </div>
  );
}

export function ReceptionSummary({
  recepcion,
  onClose,
}: {
  recepcion: Reception;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rechazo =
    recepcion.resultado === "rechazo-parcial" ||
    recepcion.resultado === "rechazo-total";

  const estadoLabel =
    recepcion.estado === "finalizada"
      ? "Finalizada"
      : recepcion.puerta
        ? "Procesando"
        : "Pendiente";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resumen-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-lg bg-slate-100 text-xl leading-none text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          aria-label="Cerrar resumen"
        >
          ×
        </button>

        <header className="pr-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
            Resumen de recepción
          </p>
          <h2
            id="resumen-title"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50"
          >
            {recepcion.proveedor}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-zinc-400">
            RUC {recepcion.ruc}
          </p>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
            {estadoLabel}
          </span>
          {recepcion.resultado ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${RESULT_CLASSES[recepcion.resultado]}`}
            >
              {RESULT_LABELS[recepcion.resultado]}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
              Resultado sin definir
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              rechazo
                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
            }`}
          >
            Rechazo: {rechazo ? "Sí" : "No"}
          </span>
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Datos del proveedor
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Proveedor" value={recepcion.proveedor} />
            <Field label="RUC" value={recepcion.ruc} />
            <Field label="Fecha" value={recepcion.fecha} />
            <Field
              label="Unidades estimadas"
              value={recepcion.unidadesEstimadas}
            />
            <Field label="Hora solicitada" value={recepcion.horaSolicitada} />
            <Field label="Hora de llegada" value={recepcion.horaLlegada} />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Transporte
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Conductor" value={recepcion.conductor} />
            <Field label="Licencia" value={recepcion.licencia} />
            <Field label="Placa" value={recepcion.placa} />
            <Field label="Homologación" value={recepcion.homologacion} />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Recepción
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Puerta" value={recepcion.puerta} />
            <Field label="Operario responsable" value={recepcion.operarioResponsable} />
            <Field label="Inicio de descarga" value={recepcion.horaInicioDescarga ?? null} />
            <Field label="Fin de descarga" value={recepcion.horaFin} />
            <Field label="Unidades evaluadas" value={toSafeNumber(recepcion.evaluadas)} />
            <Field label="Aceptadas" value={toSafeNumber(recepcion.aceptadas)} />
            <Field label="Rechazadas" value={toSafeNumber(recepcion.rechazadas)} />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
            Motivo del rechazo
          </h3>
          {recepcion.incidencias.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {rechazo
                ? "Se registró rechazo sin incidencias detalladas."
                : "Sin incidencias registradas."}
            </p>
          ) : (
            <ul className="space-y-3">
              {recepcion.incidencias.map((incidencia) => (
                <li
                  key={incidencia.id}
                  className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-zinc-950"
                >
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                    {incidencia.tipo}
                    <span className="ml-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                      OC / SKU: {incidencia.ocSku} · Cantidad afectada:{" "}
                      {incidencia.cantidadAfectada}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                    {incidencia.descripcion}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-4 text-xs italic text-slate-500 dark:text-zinc-500">
          Datos vinculados al registro de llegada.
        </p>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:bg-red-600 dark:hover:bg-red-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
