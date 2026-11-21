"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { cargarDashboards, type DashboardGuardado } from "@/lib/dashboard-history";
import {
  ESTADOS_REPORTE,
  TIPOS_REPORTE,
  cargarReportes,
  construirTop,
  diasReporte,
  guardarReportes,
  periodosDisponibles,
  reporteCritico,
  reporteSchema,
  type Periodo,
  type ReporteForm,
  type ReporteRecepcion,
} from "@/lib/reportes-citas";
import { generarId } from "@/lib/incidencias-maestros";
import { descargarExcel, fechaArchivo } from "@/lib/catalogo";
import { usePermisos } from "@/lib/use-permisos";
import { todayIso } from "@/lib/utils";
import {
  AvisoBanner,
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  CAMPO,
  Encabezado,
  EstadoBadge,
  Indicador,
  Modal,
  formatearFechaCorta,
  useAviso,
} from "@/components/datos-maestros/ui";
import { DownloadIcon, PencilIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons";

type Pestana = "top" | "recepcion";

export function ReportesCitasView() {
  const [pestana, setPestana] = useState<Pestana>("top");

  useEffect(() => {
    if (window.location.hash === "#recepcion") setPestana("recepcion");
  }, []);

  function cambiar(p: Pestana) {
    setPestana(p);
    window.history.replaceState(null, "", p === "recepcion" ? "#recepcion" : "#top");
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <Encabezado
        modulo="Agendamientos"
        titulo="Reportes de citas"
        descripcion="Comportamiento de las citas: ranking de proveedores con más de una cita y reportes de recepción (faltantes, daños…)."
      />

      <div role="tablist" aria-label="Secciones" className="inline-flex w-fit gap-1 rounded-xl border border-fp-line bg-fp-surface p-1">
        {(
          [
            ["top", "Top de proveedores"],
            ["recepcion", "Reportes de recepción"],
          ] as const
        ).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={pestana === id}
            onClick={() => cambiar(id)}
            className={`h-9 rounded-lg px-4 text-sm font-semibold transition ${
              pestana === id
                ? "bg-[#F02615] text-white shadow-[0_6px_16px_-8px_rgba(240,38,21,0.9)]"
                : "text-fp-dim hover:text-fp-ink"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === "top" ? <TopProveedores /> : <ReportesRecepcion />}
    </div>
  );
}

/* ═══════════════ Top de proveedores ═══════════════ */

function TopProveedores() {
  const [dashboards, setDashboards] = useState<DashboardGuardado[]>([]);
  const [cargado, setCargado] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [seleccion, setSeleccion] = useState<string>("");

  useEffect(() => {
    setDashboards(cargarDashboards());
    setCargado(true);
  }, []);

  const opciones = useMemo(() => periodosDisponibles(dashboards, periodo), [dashboards, periodo]);
  const actual = opciones.find((o) => o.clave === seleccion) ?? opciones[0] ?? null;
  const top = useMemo(() => (actual ? construirTop(dashboards, actual.dias) : []), [dashboards, actual]);

  const maxCitas = Math.max(1, ...top.map((t) => t.citas));
  const totalCitas = top.reduce((s, t) => s + t.citas, 0);
  const totalUnidades = top.reduce((s, t) => s + t.unidades, 0);

  function exportar() {
    if (!actual) return;
    descargarExcel(`Top_Proveedores_${periodo === "dia" ? "dia" : "semana"}_${actual.clave}.xlsx`, "Top proveedores", [
      ["Puesto", "Proveedor", "Citas únicas", "Unidades estimadas", "Días con cita"],
      ...top.map((t, i) => [i + 1, t.proveedor, t.citas, t.unidades, t.dias]),
    ]);
  }

  if (cargado && dashboards.length === 0) {
    return (
      <section className="glass flex flex-col items-center gap-3 rounded-[18px] px-6 py-14 text-center">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-3 rotate-45 rounded-[2px] bg-[#F02615]" />
          <span className="size-3 rotate-45 rounded-[2px] bg-[#76797B]" />
        </span>
        <p className="text-base font-bold text-fp-ink">Aún no hay dashboards guardados</p>
        <p className="max-w-md text-sm text-fp-dim">
          El Top se arma con los dashboards que se guardan en el Dashboard de citas. Carga la Agenda y el
          Reporte IKF y presiona “Guardar dashboard”.
        </p>
        <Link href="/agendamientos/dashboard" className={BOTON_PRIMARIO}>
          Ir al Dashboard de citas
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="glass flex flex-wrap items-center gap-3 rounded-[18px] p-4">
        <div role="radiogroup" aria-label="Agrupar por" className="inline-flex gap-1 rounded-xl border border-fp-line bg-fp-sunken p-1">
          {(
            [
              ["dia", "Por día"],
              ["semana", "Por semana"],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={periodo === id}
              onClick={() => {
                setPeriodo(id);
                setSeleccion("");
              }}
              className={`h-9 rounded-lg px-4 text-sm font-semibold transition ${
                periodo === id ? "bg-fp-surface-hover text-fp-ink shadow-[inset_0_0_0_1px_var(--fp-line-strong)]" : "text-fp-dim hover:text-fp-ink"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        <select
          aria-label={periodo === "dia" ? "Día" : "Semana"}
          value={actual?.clave ?? ""}
          onChange={(event) => setSeleccion(event.target.value)}
          className={`${CAMPO} w-auto min-w-[280px]`}
        >
          {opciones.map((o) => (
            <option key={o.clave} value={o.clave}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <button type="button" onClick={exportar} disabled={top.length === 0} className={`${BOTON_SECUNDARIO} ml-auto`}>
          <DownloadIcon className="size-4" />
          Exportar
        </button>
      </section>

      <section aria-label="Resumen del periodo" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador etiqueta="Proveedores con +1 cita" valor={top.length} color="#F02615" />
        <Indicador etiqueta="Citas de esos proveedores" valor={totalCitas} color="#76797B" />
        <Indicador etiqueta="Unidades estimadas" valor={totalUnidades} color="#2FBF71" />
      </section>

      <section className="glass glass-edge rounded-[18px] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-fp-dim">
            Ranking de proveedores con más de 1 cita
          </h2>
        </div>

        {top.length === 0 ? (
          <p className="py-10 text-center text-sm text-fp-dim">
            En este periodo ningún proveedor tuvo más de 1 cita.
          </p>
        ) : (
          <ol className="flex flex-col gap-2.5" aria-label="Ranking de proveedores">
            {top.map((fila, indice) => {
              const lider = indice === 0;
              return (
                <li key={fila.clave} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[28px_minmax(0,260px)_minmax(0,1fr)]">
                  <span className={`text-center text-sm font-extrabold tabular-nums ${lider ? "text-[#F02615]" : "text-fp-faint"}`}>
                    {indice + 1}
                  </span>
                  <span className="truncate text-sm font-semibold text-fp-ink" title={fila.proveedor}>
                    {fila.proveedor}
                  </span>
                  <span className="col-span-2 flex items-center gap-3 sm:col-span-1">
                    <span className="relative h-7 flex-1 overflow-hidden rounded-lg bg-fp-track">
                      <span
                        className={`absolute inset-y-0 left-0 rounded-lg transition-[width] duration-700 ${
                          lider
                            ? "bg-gradient-to-r from-[#B32515] to-[#F02615] shadow-[0_0_14px_rgba(240,38,21,0.45)]"
                            : "bg-gradient-to-r from-[#F02615]/45 to-[#F02615]/70"
                        }`}
                        style={{ width: `${(fila.citas / maxCitas) * 100}%` }}
                      />
                      <span className="relative flex h-full items-center px-3 text-xs font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]">
                        {fila.citas} citas
                      </span>
                    </span>
                    <span className="w-28 shrink-0 text-right text-xs tabular-nums text-fp-dim">
                      {fila.unidades.toLocaleString("es-PE")} uds
                      {periodo === "semana" ? (
                        <span className="block text-[11px] text-fp-faint">
                          {fila.dias} día{fila.dias === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

/* ═══════════════ Reportes de recepción ═══════════════ */

const FORM_VACIO: ReporteForm = {
  fechaCita: todayIso(),
  proveedor: "",
  tipo: "Faltante de mercadería",
  descripcion: "",
  estado: "Pendiente",
};

function ReportesRecepcion() {
  const permisos = usePermisos("agendamientos");
  const [lista, setLista] = useState<ReporteRecepcion[]>([]);
  const [proveedoresSugeridos, setProveedoresSugeridos] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<ReporteRecepcion | null>(null);
  const [form, setForm] = useState<ReporteForm>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof ReporteForm, string>>>({});
  const [aviso, setAviso] = useAviso();

  useEffect(() => {
    setLista(cargarReportes());
    // Sugerencias: proveedores con cita en los dashboards guardados.
    const nombres = new Set<string>();
    for (const d of cargarDashboards()) {
      d.citasPorProveedor?.forEach((p) => nombres.add(p.proveedor));
    }
    setProveedoresSugeridos([...nombres].sort((a, b) => a.localeCompare(b)));
  }, []);

  function persistir(nueva: ReporteRecepcion[]) {
    setLista(nueva);
    guardarReportes(nueva);
  }

  const porTipo = useMemo(() => {
    const conteo = new Map<string, number>();
    lista.forEach((r) => conteo.set(r.tipo, (conteo.get(r.tipo) ?? 0) + 1));
    return [...conteo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [lista]);
  const criticos = lista.filter((r) => reporteCritico(r)).length;

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista
      .filter((r) => !tipoFiltro || r.tipo === tipoFiltro)
      .filter((r) => !q || [r.proveedor, r.descripcion, r.tipo].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));
  }, [lista, busqueda, tipoFiltro]);

  function abrir(reporte: ReporteRecepcion | null) {
    setEditando(reporte);
    setForm(
      reporte
        ? { fechaCita: reporte.fechaCita, proveedor: reporte.proveedor, tipo: reporte.tipo, descripcion: reporte.descripcion, estado: reporte.estado }
        : { ...FORM_VACIO, fechaCita: todayIso() },
    );
    setErrores({});
    setAbierto(true);
  }

  function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validado = reporteSchema.safeParse(form);
    if (!validado.success) {
      const nuevos: Partial<Record<keyof ReporteForm, string>> = {};
      validado.error.issues.forEach((issue) => {
        const campo = issue.path[0] as keyof ReporteForm;
        nuevos[campo] ??= issue.message;
      });
      setErrores(nuevos);
      return;
    }
    const d = validado.data;
    const fechaResolucion = d.estado === "Resuelta" ? editando?.fechaResolucion ?? new Date().toISOString() : null;
    if (editando) {
      if (!permisos.editar) return;
      persistir(lista.map((r) => (r.id === editando.id ? { ...r, ...d, fechaResolucion } : r)));
      setAviso({ tipo: "exito", texto: "Reporte actualizado." });
    } else {
      if (!permisos.crear) return;
      persistir([{ id: generarId("RC"), fechaRegistro: new Date().toISOString(), ...d, fechaResolucion }, ...lista]);
      setAviso({ tipo: "exito", texto: "Reporte registrado." });
    }
    setAbierto(false);
  }

  function eliminar(reporte: ReporteRecepcion) {
    if (!permisos.eliminar) return;
    if (!window.confirm(`¿Eliminar el reporte de ${reporte.proveedor}?`)) return;
    persistir(lista.filter((r) => r.id !== reporte.id));
    setAviso({ tipo: "exito", texto: "Reporte eliminado." });
  }

  function exportar() {
    descargarExcel(`Reportes_Recepcion_${fechaArchivo()}.xlsx`, "Reportes", [
      ["Fecha de cita", "Proveedor", "Tipo", "Descripción", "Estado", "Días", "Fecha de resolución"],
      ...filtrados.map((r) => [
        formatearFechaCorta(r.fechaCita),
        r.proveedor,
        r.tipo,
        r.descripcion,
        r.estado,
        diasReporte(r),
        formatearFechaCorta(r.fechaResolucion),
      ]),
    ]);
  }

  return (
    <div className="flex flex-col gap-5">
      <AvisoBanner aviso={aviso} />

      <section aria-label="Resumen de reportes" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador etiqueta="Reportes" valor={lista.length} color="#76797B" />
        {[0, 1, 2].map((i) => (
          <Indicador
            key={i}
            etiqueta={porTipo[i]?.[0] ?? "—"}
            valor={porTipo[i]?.[1] ?? 0}
            color={["#F37021", "#7FB2FF", "#8B5CF6"][i]}
          />
        ))}
        <Indicador etiqueta="Críticos +1 día" valor={criticos} detalle="sin resolver" color="#F02615" alerta={criticos > 0} />
      </section>

      <section className="glass overflow-hidden rounded-[18px]">
        <div className="flex flex-wrap items-center gap-3 border-b border-fp-line p-4">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-3.5 size-4 text-fp-faint" />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar proveedor o descripción…"
              aria-label="Buscar reportes"
              className={`${CAMPO} pl-9`}
            />
          </div>
          <select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)} aria-label="Filtrar por tipo" className={`${CAMPO} w-auto`}>
            <option value="">Todos los tipos</option>
            {TIPOS_REPORTE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={exportar} disabled={filtrados.length === 0} className={BOTON_SECUNDARIO}>
              <DownloadIcon className="size-4" />
              Exportar
            </button>
            {permisos.crear ? (
              <button type="button" onClick={() => abrir(null)} className={BOTON_PRIMARIO}>
                <PlusIcon className="size-4" />
                Nuevo reporte
              </button>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <caption className="sr-only">Reportes de recepción</caption>
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3">Fecha de cita</th>
                <th scope="col" className="px-4 py-3">Proveedor</th>
                <th scope="col" className="px-4 py-3">Tipo</th>
                <th scope="col" className="px-4 py-3">Descripción</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3">Tiempo</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fp-line)]">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-fp-dim">
                    {lista.length === 0 ? "Aún no hay reportes de recepción." : "Ningún reporte coincide con los filtros."}
                  </td>
                </tr>
              ) : (
                filtrados.map((r) => {
                  const critico = reporteCritico(r);
                  const dias = diasReporte(r);
                  return (
                    <tr key={r.id} className={`transition-colors hover:bg-fp-surface ${critico ? "bg-[#F02615]/[0.07] shadow-[inset_3px_0_0_#F02615]" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-3 text-fp-dim">{formatearFechaCorta(r.fechaCita)}</td>
                      <td className="px-4 py-3 font-semibold text-fp-ink">{r.proveedor}</td>
                      <td className="px-4 py-3 text-fp-dim">{r.tipo}</td>
                      <td className="max-w-sm px-4 py-3 text-fp-dim">
                        <span className="line-clamp-2">{r.descripcion}</span>
                      </td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={r.estado} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={critico ? "font-bold text-[#F02615]" : "text-fp-dim"}>
                          {dias === 0 ? "Hoy" : `${dias} día${dias === 1 ? "" : "s"}`}
                        </span>
                        {critico ? (
                          <span className="ml-2 rounded-full bg-[#F02615] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            Crítico
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {permisos.editar ? (
                            <button type="button" onClick={() => abrir(r)} aria-label={`Editar reporte de ${r.proveedor}`} className="rounded-lg border border-fp-line p-2 text-fp-dim transition hover:bg-fp-surface hover:text-fp-ink">
                              <PencilIcon className="size-4" />
                            </button>
                          ) : null}
                          {permisos.eliminar ? (
                            <button type="button" onClick={() => eliminar(r)} aria-label={`Eliminar reporte de ${r.proveedor}`} className="rounded-lg border border-[#F02615]/30 p-2 text-[#F02615] transition hover:bg-[#F02615]/10">
                              <XIcon className="size-4" />
                            </button>
                          ) : null}
                          {!permisos.editar && !permisos.eliminar ? <span className="text-xs text-fp-faint">Solo lectura</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {abierto ? (
        <Modal titulo={editando ? "Editar reporte" : "Nuevo reporte de recepción"} onCerrar={() => setAbierto(false)}>
          <form noValidate onSubmit={guardar} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-fp-ink" htmlFor="reporte-fecha">
                Fecha de la cita <span className="sr-only">(obligatorio)</span>
                <input id="reporte-fecha" type="date" value={form.fechaCita} onChange={(e) => setForm((f) => ({ ...f, fechaCita: e.target.value }))} className={CAMPO} />
                {errores.fechaCita ? <span className="text-xs text-[#F02615]">{errores.fechaCita}</span> : null}
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-fp-ink" htmlFor="reporte-tipo">
                Tipo de reporte
                <select id="reporte-tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as ReporteForm["tipo"] }))} className={CAMPO}>
                  {TIPOS_REPORTE.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-fp-ink" htmlFor="reporte-proveedor">
              Proveedor
              <input id="reporte-proveedor" list="reporte-proveedores" value={form.proveedor} onChange={(e) => setForm((f) => ({ ...f, proveedor: e.target.value }))} placeholder="Escribe o elige un proveedor" className={CAMPO} />
              <datalist id="reporte-proveedores">
                {proveedoresSugeridos.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              {errores.proveedor ? <span className="text-xs text-[#F02615]">{errores.proveedor}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-fp-ink" htmlFor="reporte-descripcion">
              Descripción
              <textarea id="reporte-descripcion" rows={3} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Ej. Faltaron 2 cajas de paracetamol en la descarga." className={`${CAMPO} h-auto py-2`} />
              {errores.descripcion ? <span className="text-xs text-[#F02615]">{errores.descripcion}</span> : null}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-fp-ink" htmlFor="reporte-estado">
              Estado
              <select id="reporte-estado" value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as ReporteForm["estado"] }))} className={CAMPO}>
                {ESTADOS_REPORTE.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} className={BOTON_SECUNDARIO}>
                Cancelar
              </button>
              <button type="submit" className={BOTON_PRIMARIO}>
                {editando ? "Guardar cambios" : "Registrar reporte"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
