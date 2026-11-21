"use client";

import { useState, useEffect, Fragment } from "react";
import { useCruceStorage } from "@/lib/use-cruce-storage";

type ProveedorHora = {
  proveedor: string;
  ruc: string;
  lpns: number;
};

type DatoHora = {
  hora: string;
  proveedores: ProveedorHora[];
  totalLpns: number;
  totalProveedores: number;
};

/**
 * Extrae la hora numérica inicial (0-23) de un cdDestino en cualquier formato.
 * Soporta: "07:00-08:00", "07:00", "9:00-10:00", "9028", "0900", etc.
 */
function extraerHoraNumerica(cdDestino: string | null | undefined): number | null {
  if (!cdDestino) return null;

  const s = String(cdDestino).trim();
  if (!s) return null;

  // "07:00-08:00", "07:00", "7:00"
  const conDosPuntos = s.match(/^(\d{1,2}):(\d{2})/);
  if (conDosPuntos) {
    const h = parseInt(conDosPuntos[1], 10);
    return h >= 0 && h <= 23 ? h : null;
  }

  // "9040" (HHMM), "900" (HMM), "0900"
  if (/^\d{3,4}$/.test(s)) {
    const h = parseInt(s.slice(0, s.length - 2), 10);
    const m = parseInt(s.slice(-2), 10);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h : null;
  }

  // "9"
  if (/^\d{1,2}$/.test(s)) {
    const h = parseInt(s, 10);
    return h >= 0 && h <= 23 ? h : null;
  }

  return null;
}

function formatearHora12h(horaNumerica: number): string {
  if (horaNumerica === 0) return "12:00 am";
  if (horaNumerica < 12) return `${horaNumerica}:00 am`;
  if (horaNumerica === 12) return "12:00 pm";
  return `${horaNumerica - 12}:00 pm`;
}

/**
 * Lee y agrupa datos del cruce por hora desde localStorage.
 */
function cargarDatosDesdeLocalStorage(): DatoHora[] {
  try {
    const prev = localStorage.getItem("portal-proveedores:cruce:resultado");
    if (!prev) return [];

    const parsed = JSON.parse(prev);
    const proveedoresAgenda: Array<{
      cdDestino: string;
      horaInicio: string | null;
      proveedorOriginal: string;
      ruc: string | null;
      lpns: number | null;
    }> = parsed?.proveedoresAgenda ?? [];

    const mapa = new Map<
      number,
      {
        proveedores: ProveedorHora[];
        totalLpns: number;
        totalProveedores: number;
      }
    >();

    for (const p of proveedoresAgenda) {
      // La hora real viene del Reporte de Citas ("Hora Inicio").
      // cdDestino se usa solo como respaldo si contiene una hora válida.
      const horaNum =
        extraerHoraNumerica(p.horaInicio) ??
        extraerHoraNumerica(p.cdDestino);
      if (horaNum === null) continue;

      if (!mapa.has(horaNum)) {
        mapa.set(horaNum, {
          proveedores: [],
          totalLpns: 0,
          totalProveedores: 0,
        });
      }
      const existente = mapa.get(horaNum)!;
      // LPN enteros (también redondea cruces guardados antes de este cambio).
      const lpns = Math.round(p.lpns ?? 0);
      existente.proveedores.push({
        proveedor: p.proveedorOriginal,
        ruc: p.ruc || "—",
        lpns,
      });
      existente.totalLpns += lpns;
      existente.totalProveedores++;
    }

    return Array.from(mapa.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([horaNum, datos]) => ({
        hora: String(horaNum),
        proveedores: datos.proveedores,
        totalLpns: datos.totalLpns,
        totalProveedores: datos.totalProveedores,
      }));
  } catch {
    return [];
  }
}

export function HorarioHoraHora() {
  const { cargar } = useCruceStorage();
  const [datosHora, setDatosHora] = useState<DatoHora[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    setDatosHora(cargarDatosDesdeLocalStorage());

    const handler = () => setDatosHora(cargarDatosDesdeLocalStorage());
    window.addEventListener("cruce-actualizado", handler);

    return () => window.removeEventListener("cruce-actualizado", handler);
  }, [cargar]);

  const formatearHora = (hora24: string) => {
    const horaNum = extraerHoraNumerica(hora24);
    return horaNum !== null ? formatearHora12h(horaNum) : hora24;
  };

  const totalLpns = datosHora.reduce((sum, h) => sum + h.totalLpns, 0);

  const recargarDatos = () => setDatosHora(cargarDatosDesdeLocalStorage());

  return (
    <section aria-label="Horario hora a hora de proveedores" className="glass rounded-2xl p-6">
      {datosHora.length > 0 ? (
        <>
          <div className="mb-6 p-4 rounded-lg bg-slate-50 dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1">
                  Detalle de carga por hora
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                  {datosHora.length} hora(s) con proveedores programados ·
                  {totalLpns.toLocaleString("es-PE")} LPNs totales
                </p>
              </div>
              <button
                onClick={recargarDatos}
                className="text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 underline flex items-center gap-1"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true"><path d="M1 4v6h6M23 4v6h-6" /><path d="M20 4v6M4 4v6" /></svg>
                Recargar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800">
                    <th className="text-left p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Hora</th>
                    <th className="text-right p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">LPNs</th>
                    <th className="text-right p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Proveedores</th>
                    <th className="text-center p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {datosHora.map((h) => (
                    <Fragment key={h.hora}>
                      <tr
                        className={`border-b border-slate-200 dark:border-zinc-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-900 ${horaSeleccionada === h.hora ? "bg-amber-50 dark:bg-amber-500/10" : ""}`}
                        onClick={() => setHoraSeleccionada(horaSeleccionada === h.hora ? null : h.hora)}
                      >
                        <td className="p-2 font-medium text-slate-700 dark:text-zinc-100">{formatearHora(h.hora)}</td>
                        <td className="p-2 text-right text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {h.totalLpns.toLocaleString("es-PE")}
                        </td>
                        <td className="p-2 text-right text-[9px] text-slate-500 dark:text-zinc-400">
                          {h.totalProveedores}
                        </td>
                        <td className="p-2 text-center">
                          {horaSeleccionada === h.hora ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Ver menos</span>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold">Ver detalle</span>
                          )}
                        </td>
                      </tr>

                      {horaSeleccionada === h.hora && (
                        <tr key={`${h.hora}-detalle`} className="bg-slate-50 dark:bg-zinc-900/50">
                          <td colSpan={4} className="p-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-zinc-800">
                                    <th className="text-left p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Proveedor</th>
                                    <th className="text-center p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">RUC</th>
                                    <th className="text-right p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">LPNs</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {h.proveedores.map((p, idx) => (
                                    <tr key={`${p.ruc}-${idx}`} className="border-b border-slate-100 dark:border-zinc-800">
                                      <td className="p-2 text-slate-700 dark:text-zinc-100 text-sm">{p.proveedor}</td>
                                      <td className="p-2 text-center text-slate-500 dark:text-zinc-400 text-sm">{p.ruc}</td>
                                      <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold text-sm">{p.lpns.toLocaleString("es-PE")}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="p-6 text-center text-slate-500 dark:text-zinc-400">
          <p>No hay datos de cruce disponibles.</p>
          <p className="text-xs mt-2">Procesa los 3 archivos (Agenda, Reporte de Citas, Maestro de Proveedores) para ver el detalle por hora.</p>
          <button
            onClick={recargarDatos}
            className="mt-4 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 underline flex items-center justify-center gap-1 mx-auto"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true"><path d="M1 4v6h6M23 4v6h-6" /><path d="M20 4v6M4 4v6" /></svg>
            Recargar desde localStorage
          </button>
        </div>
      )}
    </section>
  );
}