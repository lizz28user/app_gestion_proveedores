"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXTRA_ARRIVALS_STORAGE_KEY,
  type Arrival,
} from "../registro-de-llegada/arrivals-data";
import { isoLocal, normalizeText, todayIso } from "@/lib/utils";
import { MapaPuertas } from "@/components/reception/mapa-puertas";
import { NAVES, type NaveId, type Reception } from "@/components/reception/types";
import { loadRecepciones, reiniciarRecepcion, saveRecepciones } from "@/components/reception/storage";
import { usePermisos } from "@/lib/use-permisos";
import {
  ReceptionInput,
  ReceptionButton,
  ReceptionBadge,
} from "@/components/reception/ui";
import { ReceptionSummary } from "@/components/reception/summary";

/** Fecha de la recepción; las antiguas sin fecha usan el día en que se crearon. */
function fechaDe(r: Reception): string {
  if (r.fecha) return r.fecha;
  const creada = new Date(r.createdAt);
  return Number.isNaN(creada.getTime()) ? "" : isoLocal(creada);
}

function fechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function ReceptionListView() {
  // Borrar datos de una recepción: solo Supervisor y Administrador.
  const permisos = usePermisos("garita");
  const [recepciones, setRecepciones] = useState<Reception[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), 5000);
    return () => window.clearTimeout(id);
  }, [aviso]);

  function borrarRecepcion(recepcion: Reception) {
    if (!permisos.eliminar) return;
    if (
      !window.confirm(
        `¿Borrar los datos de la recepción de ${recepcion.proveedor}?\n\nSe borrarán puerta, operario, incidencias y resultado. La llegada sigue registrada, así que la recepción vuelve a quedar pendiente.`,
      )
    ) {
      return;
    }
    const siguiente = recepciones.map((r) => (r.id === recepcion.id ? reiniciarRecepcion(r) : r));
    saveRecepciones(siguiente);
    setRecepciones(siguiente);
    setAviso(`Datos de la recepción de ${recepcion.proveedor} borrados. Quedó pendiente.`);
  }
  const [query, setQuery] = useState("");
  /** Nave del mapa de puertas. */
  const [nave, setNave] = useState<NaveId>("nave1");
  /** Día filtrado (aaaa-mm-dd); vacío = todas las fechas. */
  const [fecha, setFecha] = useState(() => todayIso());
  // Mientras no elijas una fecha, el filtro se ajusta solo al día que tiene recepciones.
  const [fechaAuto, setFechaAuto] = useState(true);
  function elegirFecha(valor: string) {
    setFechaAuto(false);
    setFecha(valor);
  }
  const [filterEstado, setFilterEstado] = useState<"todos" | "pendiente" | "procesando" | "finalizada">("todos");
  const [resumen, setResumen] = useState<Reception | null>(null);

  useEffect(() => {
    function cargar() {
      try {
        const lista = loadRecepciones();
        setRecepciones(lista);
        // Crear recepciones pendientes solo para llegadas que aún no tienen recepción.
        cargarLlegadasComoRecepciones(lista);
      } catch {
        // Ignorar.
      }
    }

    cargar();
  }, []);

  function cargarLlegadasComoRecepciones(existenteLista: Reception[]) {
    try {
      const raw = window.localStorage.getItem(EXTRA_ARRIVALS_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const llegadas = parsed as Arrival[];
      // La misma cita en otro día es otra recepción: la clave incluye la fecha.
      const existente = new Set(
        existenteLista.map((r) => `${r.ruc}-${r.horaSolicitada}-${fechaDe(r)}`),
      );

      const nuevas: Reception[] = llegadas
        .filter((a) => a.llegada) // solo las que ya tienen hora de llegada
        .filter((a) => !existente.has(`${a.ruc}-${a.horaSolicitada}-${a.fecha || todayIso()}`))
        .map((a) => ({
          id: crypto.randomUUID(),
          arrivalKey: `${a.ruc}-${a.horaSolicitada}-${a.fecha || todayIso()}`,
          ruc: a.ruc,
          proveedor: a.proveedor,
          fecha: a.fecha || todayIso(),
          horaSolicitada: a.horaSolicitada,
          horaLlegada: a.llegada,
          unidadesEstimadas: a.unidadesEstimadas ?? "",
          estadoLlegada: a.estadoLlegada ?? "",
          conductor: a.conductor ?? "",
          licencia: a.licencia ?? "",
          placa: a.placa ?? "",
          homologacion: a.homologacion ?? "",
          puerta: null,
          operarioResponsable: null,
          horaFin: null,
          estado: "avance",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          incidencias: [],
          resultado: null,
          aceptadas: 0,
          rechazadas: 0,
          evaluadas: 0,
        }));

      if (nuevas.length > 0) {
        const next = [...existenteLista, ...nuevas];
        saveRecepciones(next);
        setRecepciones(next);
      }
    } catch {
      // Ignorar errores.
    }
  }

  function abrirResumen(recepcion: Reception) {
    let enriquecida = recepcion;
    try {
      const raw = window.localStorage.getItem(EXTRA_ARRIVALS_STORAGE_KEY);
      if (raw) {
        const llegadas = JSON.parse(raw) as Arrival[];
        const llegada = llegadas.find(
          (a) =>
            a.ruc === recepcion.ruc &&
            a.horaSolicitada === recepcion.horaSolicitada &&
            (a.fecha || todayIso()) === fechaDe(recepcion),
        );
        if (llegada) {
          enriquecida = {
            ...recepcion,
            unidadesEstimadas:
              recepcion.unidadesEstimadas ?? llegada.unidadesEstimadas,
            estadoLlegada: recepcion.estadoLlegada ?? llegada.estadoLlegada,
          };
        }
      }
    } catch {
      // Ignorar errores de lectura.
    }
    setResumen(enriquecida);
  }

  // Recepciones del día elegido.
  const delDia = useMemo(
    () => (fecha ? recepciones.filter((r) => fechaDe(r) === fecha) : recepciones),
    [recepciones, fecha],
  );
  // El mapa de puertas siempre muestra un solo día (hoy si se eligió "Todas").
  const delMapa = useMemo(() => {
    const dia = fecha || todayIso();
    return recepciones.filter((r) => fechaDe(r) === dia);
  }, [recepciones, fecha]);

  // La agenda y las llegadas pueden ser de otro día (por ejemplo, el de la agenda cargada):
  // si hoy no hay recepciones, se muestra la fecha más reciente que sí tiene.
  useEffect(() => {
    if (!fechaAuto || recepciones.length === 0) return;
    const hoy = todayIso();
    if (recepciones.some((r) => fechaDe(r) === hoy)) {
      setFecha(hoy);
      return;
    }
    const masReciente = recepciones.map(fechaDe).filter(Boolean).sort().pop();
    if (masReciente) setFecha(masReciente);
  }, [recepciones, fechaAuto]);

  function moverDia(dias: number) {
    const base = new Date(`${fecha || todayIso()}T00:00:00`);
    base.setDate(base.getDate() + dias);
    elegirFecha(isoLocal(base));
  }

  const filtered = useMemo(() => {    const term = normalizeText(query.trim());
    return delDia.filter((r) => {
      const matchTerm =
        !term ||
        normalizeText(r.ruc).includes(term) ||
        normalizeText(r.proveedor).includes(term) ||
        normalizeText(r.conductor).includes(term);
      const matchEstado =
        filterEstado === "todos" ||
        (filterEstado === "pendiente" && !r.puerta) ||
        (filterEstado === "procesando" && r.puerta && r.estado === "avance") ||
        (filterEstado === "finalizada" && r.estado === "finalizada");
      return matchTerm && matchEstado;
    });
  }, [delDia, query, filterEstado]);

  const pendientesCount = delDia.filter((r) => !r.puerta).length;
  const procesandoCount = delDia.filter(
    (r) => r.puerta && r.estado === "avance",
  ).length;
  const finalizadasCount = delDia.filter(
    (r) => r.estado === "finalizada",
  ).length;

  return (
    <div className="-m-4 min-h-[calc(100vh-4rem)] bg-slate-100 p-4 dark:bg-zinc-950 sm:-m-6 sm:p-6 lg:-m-8 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-3xl">
              Gestión de recepción
            </h1>
          </div>
        </header>

        {aviso ? (
          <div
            role="status"
            className="rounded-xl border border-[#2FBF71]/35 bg-[#2FBF71]/10 px-4 py-3 text-sm font-medium text-fp-ink"
          >
            {aviso}
          </div>
        ) : null}

        <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="recep-fecha" className="text-sm font-bold text-fp-dim">
              Fecha
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => moverDia(-1)}
                aria-label="Día anterior"
                className="inline-flex size-11 items-center justify-center rounded-lg border border-fp-line-strong text-fp-ink transition-colors hover:bg-fp-surface-hover"
              >
                ‹
              </button>
              <input
                id="recep-fecha"
                type="date"
                value={fecha}
                max={todayIso()}
                onChange={(e) => elegirFecha(e.target.value)}
                className="h-11 rounded-lg border border-fp-line-strong bg-fp-surface px-3 text-sm font-semibold tabular-nums text-fp-ink focus-visible:border-[#F02615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F02615]/20"
              />
              <button
                type="button"
                onClick={() => moverDia(1)}
                disabled={!!fecha && fecha >= todayIso()}
                aria-label="Día siguiente"
                className="inline-flex size-11 items-center justify-center rounded-lg border border-fp-line-strong text-fp-ink transition-colors hover:bg-fp-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => elegirFecha(todayIso())}
            aria-pressed={fecha === todayIso()}
            className={`h-11 rounded-lg border px-4 text-sm font-semibold transition-colors ${
              fecha === todayIso()
                ? "border-[#F02615] bg-[#F02615] text-white"
                : "border-fp-line-strong text-fp-ink hover:bg-fp-surface-hover"
            }`}
          >
            Hoy
          </button>
          <div className="flex flex-wrap gap-2 sm:ml-auto" role="group" aria-label="Nave del mapa de puertas">
            {NAVES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setNave(n.id)}
                aria-pressed={nave === n.id}
                className={`h-11 rounded-lg border px-5 text-sm font-bold transition-colors ${
                  nave === n.id
                    ? "border-[#F02615] bg-[#F02615] text-white"
                    : "border-fp-line-strong text-fp-ink hover:bg-fp-surface-hover"
                }`}
              >
                {n.nombre}
              </button>
            ))}
          </div>
        </div>

        <MapaPuertas recepciones={delMapa} nave={nave} />

        <div className="flex flex-wrap gap-3 items-start sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <ReceptionInput
              id="recep-search"
              label="Buscar recepción"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por RUC, proveedor o conductor"
              required={false}
            />
          </div>

          <div className="flex gap-2 sm:flex-1 sm:justify-end">
            <ReceptionButton
              variant="primary"
              onClick={() => setFilterEstado("todos")}
              disabled={filterEstado === "todos"}
            >
              Todos
            </ReceptionButton>
            <ReceptionButton
              variant="secondary"
              onClick={() => setFilterEstado("pendiente")}
              disabled={filterEstado === "pendiente"}
            >
              Pendientes ({pendientesCount})
            </ReceptionButton>
            <ReceptionButton
              variant="secondary"
              onClick={() => setFilterEstado("procesando")}
              disabled={filterEstado === "procesando"}
            >
              Procesando ({procesandoCount})
            </ReceptionButton>
            <ReceptionButton
              variant="secondary"
              onClick={() => setFilterEstado("finalizada")}
              disabled={filterEstado === "finalizada"}
            >
              Finalizadas ({finalizadasCount})
            </ReceptionButton>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Recepciones de proveedores con RUC, proveedor, hora llegada,
                conductor, placa, puerta, estado y rechazo.
              </caption>
              <thead>
                <tr className="bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
                  <th scope="col" className="px-5 py-3 font-bold">RUC</th>
                  <th scope="col" className="px-5 py-3 font-bold">Proveedor</th>
                  <th scope="col" className="px-5 py-3 font-bold">Hora llegada</th>
                  <th scope="col" className="px-5 py-3 font-bold">Conductor</th>
                  <th scope="col" className="px-5 py-3 font-bold">Placa</th>
                  <th scope="col" className="px-5 py-3 font-bold">Puerta</th>
                  <th scope="col" className="px-5 py-3 font-bold">Estado</th>
                  <th scope="col" className="px-5 py-3 font-bold text-center">Rechazo</th>
                  <th scope="col" className="px-5 py-3 font-bold text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-sm text-slate-500 dark:text-zinc-400"
                    >
                      {fecha && delDia.length === 0
                        ? `No hay recepciones el ${fechaCorta(fecha)}.`
                        : "No se encontraron recepciones."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((recepcion) => (
                    <tr
                      key={recepcion.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {recepcion.ruc}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-zinc-200">
                        {recepcion.proveedor}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {recepcion.horaLlegada}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {recepcion.conductor || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {recepcion.placa || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 dark:text-zinc-300">
                        {recepcion.puerta || (
                          <span className="text-slate-400 dark:text-zinc-500">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {recepcion.estado === "finalizada" ? (
                          <ReceptionBadge status="finalizada" type="status" />
                        ) : recepcion.puerta ? (
                          <ReceptionBadge status="avance" type="status" />
                        ) : (
                          <ReceptionBadge status="pendiente" type="status" />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {recepcion.resultado === "rechazo-parcial" ||
                        recepcion.resultado === "rechazo-total" ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                          >
                            Sí
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                          >
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (recepcion.estado === "finalizada") {
                                abrirResumen(recepcion);
                              } else {
                                window.location.href = `/garita/gestion-recepcion/${recepcion.id}`;
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
                          >
                            {recepcion.estado === "finalizada" ? "Ver" : "Gestionar"}
                          </button>
                          {permisos.eliminar && (recepcion.puerta || recepcion.estado === "finalizada") ? (
                            <button
                              type="button"
                              onClick={() => borrarRecepcion(recepcion)}
                              aria-label={`Borrar datos de la recepción de ${recepcion.proveedor}`}
                              title="Borrar datos de la recepción"
                              className="inline-flex items-center justify-center rounded-lg border border-[#F02615]/40 px-3 py-2 text-sm font-semibold text-[#F02615] transition-colors hover:bg-[#F02615]/10"
                            >
                              Borrar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Mostrando {filtered.length} de {delDia.length} recepciones
              {fecha ? ` del ${fechaCorta(fecha)}` : " de todas las fechas"}
            </p>
          </div>
        </section>
      </div>

      {resumen && (
        <ReceptionSummary
          recepcion={resumen}
          onClose={() => setResumen(null)}
        />
      )}
    </div>
  );
}
