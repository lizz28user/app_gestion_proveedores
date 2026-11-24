"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { leerExcelArchivo, ejecutarCruce } from "@/lib/agenda-cruce";
import { useCruceStorage } from "@/lib/use-cruce-storage";
import { usePermisos } from "@/lib/use-permisos";
import { guardarMetaCruce, cargarMetaCruce, normalizarFecha } from "@/lib/citas-del-dia";
import { fechaDesdeNombreArchivo, formatearFechaAgenda } from "@/lib/fecha-archivo";
import { PROVIDERS } from "@/app/(app)/garita/registro-de-llegada/providers-data";

/** Maestro de proveedores incluido en la app (base de datos de Proveedores, de PROVEEDORES.xlsx). */
const MAESTRO_INTEGRADO = PROVIDERS.map((p) => ({
  PROVEEDOR: p.nombre,
  RUC: p.ruc,
}));

const STORAGE_KEYS = {
  agenda: "portal-proveedores:cruce:agenda",
  reporte: "portal-proveedores:cruce:reporte",
  maestro: "portal-proveedores:cruce:maestro",
};

type EstadoArchivo = "vacio" | "cargando" | "listo" | "error";

/** Maestro de proveedores cargado antes en este navegador (o null si no hay). */
function maestroGuardado(): Record<string, unknown>[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.maestro);
    const filas: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(filas) && filas.length > 0 ? (filas as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

/** Cuántos proveedores tiene el maestro guardado (0 si se usa el integrado). */
function contarMaestro(): number {
  return maestroGuardado()?.length ?? 0;
}

interface ArchivoCruceProps {
  onResultado: (resultado: ReturnType<typeof ejecutarCruce>) => void;
}

const CLASE_INPUT =
  "block w-full text-sm text-slate-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 dark:file:bg-zinc-800 dark:file:text-zinc-200";

/**
 * Carga de la Agenda CD40 y el Reporte IKF.
 * - La fecha de la agenda se toma del nombre del archivo (formato "Agenda-fecha").
 * - El cruce Agenda × IKF × Proveedores se ejecuta solo, apenas están los dos archivos.
 */
export function ArchivoCruce({ onResultado }: ArchivoCruceProps) {
  const { resultado, setResultado: guardarResultado, limpiar } = useCruceStorage();
  // Cargar o cambiar archivos: Supervisor y Administrador. Auxiliar: solo ver.
  const permisos = usePermisos("agendamientos");

  const [archivoAgenda, setArchivoAgenda] = useState<File | null>(null);
  const [archivoReporte, setArchivoReporte] = useState<File | null>(null);
  const [archivoMaestro, setArchivoMaestro] = useState<File | null>(null);
  const [fechaAgenda, setFechaAgenda] = useState<string | null>(null);
  const [fechaIkf, setFechaIkf] = useState<string | null>(null);
  const [estadoAgenda, setEstadoAgenda] = useState<EstadoArchivo>("vacio");
  const [estadoReporte, setEstadoReporte] = useState<EstadoArchivo>("vacio");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaGuardada, setMetaGuardada] = useState<ReturnType<typeof cargarMetaCruce>>(null);
  const ultimoProceso = useRef<string>("");
  const [maestroInfo, setMaestroInfo] = useState(0);

  useEffect(() => {
    setMetaGuardada(cargarMetaCruce());
  }, [resultado]);

  useEffect(() => {
    setMaestroInfo(contarMaestro());
  }, []);

  const procesar = useCallback(
    async (agenda: File, reporte: File, maestro: File | null) => {
      setProcesando(true);
      setError(null);
      setEstadoAgenda("cargando");
      setEstadoReporte("cargando");
      try {
        const [filasAgenda, filasReporte, filasMaestro] = await Promise.all([
          leerExcelArchivo(agenda, { palabraClaveEncabezados: "CD DESTINO" }),
          leerExcelArchivo(reporte, { palabraClaveEncabezados: "NÚMERO DE CITA" }),
          // Base de datos de Proveedores: el archivo si se carga uno; si no, el último
          // archivo cargado en este navegador; si no hay, la incluida en la app.
          maestro
            ? leerExcelArchivo(maestro, { palabraClaveEncabezados: "PROVEEDOR" })
            : Promise.resolve(maestroGuardado() ?? MAESTRO_INTEGRADO),
        ]);

        if (filasAgenda.length === 0) {
          setEstadoAgenda("error");
          throw new Error(
            'No se encontró la fila con "CD DESTINO" en la Agenda. Revisa que sea la hoja Ingreso por Proveedores CD40.',
          );
        }
        if (filasReporte.length === 0) {
          setEstadoReporte("error");
          throw new Error("El Reporte de Citas no tiene filas. Revisa que sea el archivo IKF (hoja REPORTE_CITAS).");
        }

        const res = ejecutarCruce(filasAgenda, filasReporte, filasMaestro);

        // Fecha de las citas según el IKF (la más repetida), para avisar si no coincide con la agenda.
        const conteo = new Map<string, number>();
        for (const fila of filasReporte) {
          const f = normalizarFecha(fila["FECHA CITA"]);
          if (f) conteo.set(f, (conteo.get(f) ?? 0) + 1);
        }
        setFechaIkf([...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);

        localStorage.setItem(STORAGE_KEYS.agenda, JSON.stringify(filasAgenda));
        localStorage.setItem(STORAGE_KEYS.reporte, JSON.stringify(filasReporte));
        // El maestro se conserva para los próximos cruces (no se borra al cambiar archivos).
        if (maestro) {
          localStorage.setItem(STORAGE_KEYS.maestro, JSON.stringify(filasMaestro));
          setMaestroInfo(contarMaestro());
        }
        guardarMetaCruce({
          fechaAgenda: fechaDesdeNombreArchivo(agenda.name),
          archivoAgenda: agenda.name,
          archivoReporte: reporte.name,
          procesadoEn: new Date().toISOString(),
        });

        guardarResultado(res);
        onResultado(res);
        setEstadoAgenda("listo");
        setEstadoReporte("listo");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "No se pudieron procesar los archivos.");
        setEstadoAgenda((estado) => (estado === "cargando" ? "error" : estado));
        setEstadoReporte((estado) => (estado === "cargando" ? "error" : estado));
      } finally {
        setProcesando(false);
      }
    },
    [guardarResultado, onResultado],
  );

  // Cruce automático: apenas están la Agenda y el IKF (y cada vez que cambia alguno).
  useEffect(() => {
    if (!archivoAgenda || !archivoReporte) return;
    const clave = [archivoAgenda, archivoReporte, archivoMaestro]
      .map((f) => (f ? `${f.name}|${f.size}|${f.lastModified}` : "-"))
      .join("||");
    if (clave === ultimoProceso.current) return;
    ultimoProceso.current = clave;
    void procesar(archivoAgenda, archivoReporte, archivoMaestro);
  }, [archivoAgenda, archivoReporte, archivoMaestro, procesar]);

  const limpiarDatos = useCallback(() => {
    limpiar();
    localStorage.removeItem(STORAGE_KEYS.agenda);
    localStorage.removeItem(STORAGE_KEYS.reporte);
    guardarMetaCruce(null);
    ultimoProceso.current = "";
    setArchivoAgenda(null);
    setArchivoReporte(null);
    setArchivoMaestro(null);
    setFechaAgenda(null);
    setFechaIkf(null);
    setEstadoAgenda("vacio");
    setEstadoReporte("vacio");
    setError(null);
  }, [limpiar]);

  const iconoEstado = (estado: EstadoArchivo) => {
    switch (estado) {
      case "listo":
        return <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Listo</span>;
      case "error":
        return <span className="text-xs font-semibold text-red-600 dark:text-red-400">✕ Error</span>;
      case "cargando":
        return <span className="animate-pulse text-xs font-semibold text-amber-600 dark:text-amber-400">Procesando…</span>;
      default:
        return <span className="text-xs text-slate-400 dark:text-zinc-500">Pendiente</span>;
    }
  };

  if (!permisos.cargando && !permisos.crear) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-fp-dim">
          {resultado
            ? `Datos cargados y procesados${metaGuardada?.fechaAgenda ? ` · Agenda del ${formatearFechaAgenda(metaGuardada.fechaAgenda)}` : ""}. `
            : "Aún no se cargaron la Agenda CD40 y el Reporte IKF. "}
          Solo un Supervisor o Administrador puede cargar o cambiar los archivos.
        </p>
      </div>
    );
  }

  const fechasNoCoinciden = Boolean(fechaAgenda && fechaIkf && fechaAgenda !== fechaIkf);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {resultado ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Datos cargados y procesados</h2>
            {metaGuardada ? (
              <p className="text-xs text-fp-dim">
                {metaGuardada.fechaAgenda
                  ? `Agenda del ${formatearFechaAgenda(metaGuardada.fechaAgenda)}`
                  : "Agenda sin fecha en el nombre"}
                {" · "}
                {metaGuardada.archivoAgenda} + {metaGuardada.archivoReporte}
              </p>
            ) : null}
          </div>
          <button onClick={limpiarDatos} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
            Cambiar archivos
          </button>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 1. Agenda */}
        <div className="flex flex-col gap-2">
          <label htmlFor="archivo-agenda" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            1. Agenda CD40
          </label>
          <input
            id="archivo-agenda"
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivoAgenda(f);
              setFechaAgenda(f ? fechaDesdeNombreArchivo(f.name) : null);
              setEstadoAgenda(f ? "cargando" : "vacio");
            }}
            disabled={procesando}
            className={CLASE_INPUT}
          />
          {archivoAgenda && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-slate-600 dark:text-zinc-400" title={archivoAgenda.name}>
                {archivoAgenda.name}
              </span>
              {iconoEstado(estadoAgenda)}
            </div>
          )}
          {archivoAgenda ? (
            fechaAgenda ? (
              <p className="rounded-lg border border-[#2FBF71]/35 bg-[#2FBF71]/10 px-2.5 py-1.5 text-xs font-semibold text-fp-ink">
                Fecha de la agenda: <span className="capitalize">{formatearFechaAgenda(fechaAgenda)}</span>
              </p>
            ) : (
              <p className="rounded-lg border border-[#FAB701]/40 bg-[#FAB701]/10 px-2.5 py-1.5 text-xs text-fp-ink">
                No se encontró la fecha en el nombre. Renombra el archivo como <strong>Agenda-14.11.xlsx</strong> (día.mes).
              </p>
            )
          ) : (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
              Nombre con la fecha: <strong>Agenda-14.11.xlsx</strong> o <strong>Agenda-14-11-2026.xlsx</strong>
            </p>
          )}
        </div>

        {/* 2. Reporte IKF */}
        <div className="flex flex-col gap-2">
          <label htmlFor="archivo-ikf" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            2. Reporte de Citas IKF
          </label>
          <input
            id="archivo-ikf"
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivoReporte(f);
              setFechaIkf(null);
              setEstadoReporte(f ? "cargando" : "vacio");
            }}
            disabled={procesando}
            className={CLASE_INPUT}
          />
          {archivoReporte && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-slate-600 dark:text-zinc-400" title={archivoReporte.name}>
                {archivoReporte.name}
              </span>
              {iconoEstado(estadoReporte)}
            </div>
          )}
          {fechaIkf ? (
            <p className="text-xs text-fp-dim">
              Citas del IKF: <span className="capitalize">{formatearFechaAgenda(fechaIkf)}</span>
            </p>
          ) : null}
        </div>

        {/* 3. Proveedores (opcional) */}
        <div className="flex flex-col gap-2">
          <label htmlFor="archivo-maestro" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            3. Proveedores <span className="normal-case tracking-normal text-fp-faint">(opcional)</span>
          </label>
          <input
            id="archivo-maestro"
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={(e) => setArchivoMaestro(e.target.files?.[0] ?? null)}
            disabled={procesando}
            className={CLASE_INPUT}
          />
          <p className="text-xs text-fp-dim">
            {maestroInfo > 0
              ? `RUC de ${maestroInfo.toLocaleString("es-PE")} proveedores guardado en este navegador.`
              : "El cruce es por RUC. Carga PROVEEDORES.xlsx una vez y queda guardado."}
          </p>
        </div>
      </div>

      {procesando ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-fp-line bg-fp-surface px-4 py-3 text-sm text-fp-ink" role="status">
          <span aria-hidden="true" className="size-2 animate-ping rounded-full bg-[#F02615]" />
          Cruzando Agenda, Reporte IKF y Proveedores…
        </p>
      ) : !resultado && !error ? (
        <p className="mb-4 text-sm text-fp-dim">
          {archivoAgenda || archivoReporte
            ? "Falta un archivo. El cruce se hace solo apenas estén la Agenda y el Reporte IKF."
            : "Carga la Agenda y el Reporte IKF: el cruce se hace automáticamente."}
        </p>
      ) : null}

      {fechasNoCoinciden ? (
        <div className="mb-4 rounded-lg border border-[#FAB701]/40 bg-[#FAB701]/10 px-4 py-3 text-sm text-fp-ink" role="alert">
          La agenda es del <strong className="capitalize">{formatearFechaAgenda(fechaAgenda)}</strong> y el Reporte IKF trae
          citas del <strong className="capitalize">{formatearFechaAgenda(fechaIkf)}</strong>. Revisa que sean del mismo día
          antes de guardar.
        </div>
      ) : null}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      {error && archivoAgenda && archivoReporte ? (
        <button
          onClick={() => {
            ultimoProceso.current = "";
            void procesar(archivoAgenda, archivoReporte, archivoMaestro);
          }}
          disabled={procesando}
          className="inline-flex items-center justify-center rounded-lg bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reintentar cruce
        </button>
      ) : null}
    </div>
  );
}
