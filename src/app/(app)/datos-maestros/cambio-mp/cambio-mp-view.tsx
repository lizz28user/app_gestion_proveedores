"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  buscarProducto,
  descargarExcel,
  fechaArchivo,
  leerHojaExcel,
  useCatalogo,
} from "@/lib/catalogo";
import {
  COLUMNAS_PLANTILLA,
  ESTADOS_CAMBIO_MP,
  HOJA_PLANTILLA,
  cambioMpSchema,
  cargarCambiosMp,
  estadoSegunProcedio,
  filasACambiosMp,
  guardarCambiosMp,
  mpComoNumero,
  type CambioMp,
  type EstadoCambioMp,
  type Procedio,
} from "@/lib/cambios-mp";
import { generarId } from "@/lib/incidencias-maestros";
import { usePermisos } from "@/lib/use-permisos";
import { useSession } from "@/lib/use-session";
import { todayIso } from "@/lib/utils";
import {
  AvisoBanner,
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  CAMPO,
  CampoSku,
  Encabezado,
  EstadoBadge,
  Indicador,
  Modal,
  Paginador,
  formatearFechaCorta,
  useAviso,
  usePaginacion,
} from "@/components/datos-maestros/ui";
import { DownloadIcon, PencilIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons";

type Formulario = {
  sku: string;
  mpAntiguo: string;
  mpNuevo: string;
  fecha: string;
  usuario: string;
  procedio: Procedio;
  estado: EstadoCambioMp;
};

type Errores = Partial<Record<keyof Formulario, string>>;

export function CambioMpView() {
  // Auxiliar: solo ver. Supervisor y Administrador: agregar, editar, borrar y carga masiva.
  const permisos = usePermisos("datos-maestros");
  const { usuario } = useSession();
  const nombreUsuario = usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() : "";
  const { catalogo } = useCatalogo();
  const catalogoVacio = Object.keys(catalogo.productos).length === 0;

  const [lista, setLista] = useState<CambioMp[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [procedioFiltro, setProcedioFiltro] = useState<Procedio | "">("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoCambioMp | "">("");
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<CambioMp | null>(null);
  const [form, setForm] = useState<Formulario>(() => formularioVacio(""));
  const [errores, setErrores] = useState<Errores>({});
  const [reporte, setReporte] = useState<{ archivo: string; agregados: number; errores: string[] } | null>(null);
  const [importando, setImportando] = useState(false);
  const [aviso, setAviso] = useAviso();
  const inputArchivo = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLista(cargarCambiosMp());
  }, []);

  function persistir(nueva: CambioMp[]): boolean {
    try {
      guardarCambiosMp(nueva);
      setLista(nueva);
      return true;
    } catch (error) {
      setAviso({ tipo: "error", texto: error instanceof Error ? error.message : "No se pudo guardar." });
      return false;
    }
  }

  const mesActual = todayIso().slice(0, 7);
  const resumen = useMemo(
    () => ({
      total: lista.length,
      procedieron: lista.filter((c) => c.procedio === "Sí").length,
      pendientes: lista.filter((c) => c.estado !== "Resuelta").length,
      esteMes: lista.filter((c) => c.fecha.startsWith(mesActual)).length,
    }),
    [lista, mesActual],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista
      .filter((c) => !procedioFiltro || c.procedio === procedioFiltro)
      .filter((c) => !estadoFiltro || c.estado === estadoFiltro)
      .filter((c) => !q || [c.sku, c.descripcion, c.usuario].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  }, [lista, busqueda, procedioFiltro, estadoFiltro]);

  const { visibles, ...paginacion } = usePaginacion(filtrados, 25);

  function abrirNuevo() {
    setEditando(null);
    setForm(formularioVacio(nombreUsuario));
    setErrores({});
    setAbierto(true);
  }

  function abrirEdicion(cambio: CambioMp) {
    setEditando(cambio);
    setForm({
      sku: cambio.sku,
      mpAntiguo: cambio.mpAntiguo === null ? "" : String(cambio.mpAntiguo),
      mpNuevo: String(cambio.mpNuevo),
      fecha: cambio.fecha,
      usuario: cambio.usuario,
      procedio: cambio.procedio,
      estado: cambio.estado,
    });
    setErrores({});
    setAbierto(true);
  }

  function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const producto = buscarProducto(catalogo.productos, form.sku);
    const validado = cambioMpSchema.safeParse(form);
    const nuevos: Errores = {};
    if (!validado.success) {
      for (const issue of validado.error.issues) {
        const campo = issue.path[0] as keyof Formulario;
        nuevos[campo] ??= issue.message;
      }
    }
    if (form.sku.trim() && !producto) {
      nuevos.sku = "Este SKU no existe en el catálogo.";
    }
    setErrores(nuevos);
    if (!validado.success || !producto) return;

    const d = validado.data;
    const estado = estadoSegunProcedio(d.procedio, d.estado);
    const fechaResolucion =
      estado === "Resuelta" ? editando?.fechaResolucion ?? new Date().toISOString() : null;

    if (editando) {
      if (!permisos.editar) return;
      const ok = persistir(
        lista.map((c) =>
          c.id === editando.id
            ? { ...c, sku: producto.sku, descripcion: producto.descripcion, mpAntiguo: d.mpAntiguo, mpNuevo: d.mpNuevo, fecha: d.fecha, usuario: d.usuario, procedio: d.procedio, estado, fechaResolucion }
            : c,
        ),
      );
      if (ok) setAviso({ tipo: "exito", texto: `Cambio MP del SKU ${producto.sku} actualizado.` });
    } else {
      if (!permisos.crear) return;
      const nuevo: CambioMp = {
        id: generarId("MP"),
        sku: producto.sku,
        descripcion: producto.descripcion,
        mpAntiguo: d.mpAntiguo,
        mpNuevo: d.mpNuevo,
        fecha: d.fecha,
        usuario: d.usuario,
        procedio: d.procedio,
        estado,
        fechaResolucion,
        origen: "manual",
      };
      if (persistir([nuevo, ...lista])) {
        setAviso({ tipo: "exito", texto: `Cambio MP registrado para el SKU ${producto.sku}.` });
      }
    }
    setAbierto(false);
  }

  function eliminar(cambio: CambioMp) {
    if (!permisos.eliminar) return;
    if (!window.confirm(`¿Eliminar el cambio MP del SKU ${cambio.sku}?`)) return;
    if (persistir(lista.filter((c) => c.id !== cambio.id))) {
      setAviso({ tipo: "exito", texto: "Cambio MP eliminado." });
    }
  }

  function descargarPlantilla() {
    descargarExcel(`Plantilla_Master_Pack_${fechaArchivo()}.xlsx`, HOJA_PLANTILLA, [
      [...COLUMNAS_PLANTILLA],
      ["100245", "(se completa del catálogo)", "", 24, todayIso(), nombreUsuario || "Usuario", "No"],
    ]);
  }

  async function importar(archivo: File) {
    if (!permisos.crear) return;
    setImportando(true);
    try {
      const filas = await leerHojaExcel(archivo, HOJA_PLANTILLA, true);
      const { agregados, errores: erroresImportacion } = filasACambiosMp(
        filas,
        catalogo.productos,
        nombreUsuario || "Carga masiva",
      );
      if (agregados.length > 0) persistir([...agregados, ...lista]);
      setReporte({ archivo: archivo.name, agregados: agregados.length, errores: erroresImportacion });
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo leer el archivo. Usa la plantilla de Cambio MP." });
    } finally {
      setImportando(false);
    }
  }

  function exportar() {
    descargarExcel(`Cambios_MP_${fechaArchivo()}.xlsx`, HOJA_PLANTILLA, [
      ["SKU", "Descripción", "MP Antiguo", "MP Nuevo", "Fecha", "Usuario", "Procedió", "Estado"],
      ...filtrados.map((c) => [
        c.sku,
        c.descripcion,
        c.mpAntiguo ?? "",
        c.mpNuevo,
        formatearFechaCorta(c.fecha),
        c.usuario,
        c.procedio,
        c.estado,
      ]),
    ]);
  }

  const productoForm = buscarProducto(catalogo.productos, form.sku);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <Encabezado
        titulo="Cambio MP"
        descripcion="Historial de cambios de Master Pack (unidades por caja). El SKU se valida contra el catálogo y el MP actual se completa solo."
        acciones={
          <>
            <button type="button" onClick={exportar} disabled={filtrados.length === 0} className={BOTON_SECUNDARIO}>
              <DownloadIcon className="size-4" />
              Exportar
            </button>
            {permisos.crear ? (
              <>
                <button type="button" onClick={descargarPlantilla} className={BOTON_SECUNDARIO}>
                  <DownloadIcon className="size-4" />
                  Plantilla
                </button>
                <button
                  type="button"
                  onClick={() => inputArchivo.current?.click()}
                  disabled={catalogoVacio || importando}
                  className={BOTON_SECUNDARIO}
                >
                  <PlusIcon className="size-4" />
                  {importando ? "Importando…" : "Carga masiva"}
                </button>
                <input
                  ref={inputArchivo}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const archivo = event.target.files?.[0];
                    event.target.value = "";
                    if (archivo) void importar(archivo);
                  }}
                />
                <button type="button" onClick={abrirNuevo} disabled={catalogoVacio} className={BOTON_PRIMARIO}>
                  <PlusIcon className="size-4" />
                  Nuevo cambio
                </button>
              </>
            ) : null}
          </>
        }
      />

      <AvisoBanner aviso={aviso} />

      {catalogoVacio ? (
        <p className="rounded-xl border border-[#FAB701]/35 bg-[#FAB701]/10 px-4 py-3 text-sm text-fp-ink">
          El catálogo de productos está vacío. Hasta que el Administrador lo cargue no se pueden registrar cambios MP.
        </p>
      ) : null}

      <section aria-label="Resumen de cambios MP" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Cambios registrados" valor={resumen.total} color="#76797B" />
        <Indicador etiqueta="Procedieron" valor={resumen.procedieron} detalle="estado Resuelta" color="#2FBF71" />
        <Indicador etiqueta="Por resolver" valor={resumen.pendientes} color="#FAB701" />
        <Indicador etiqueta="Este mes" valor={resumen.esteMes} color="#F02615" />
      </section>

      <section className="glass overflow-hidden rounded-[18px]">
        <div className="flex flex-wrap items-center gap-3 border-b border-fp-line p-4">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-3.5 size-4 text-fp-faint" />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar SKU, descripción o usuario…"
              aria-label="Buscar cambios MP"
              className={`${CAMPO} pl-9`}
            />
          </div>
          <select
            value={procedioFiltro}
            onChange={(event) => setProcedioFiltro(event.target.value as Procedio | "")}
            aria-label="Filtrar por Procedió"
            className={`${CAMPO} w-auto`}
          >
            <option value="">Procedió: todos</option>
            <option value="Sí">Procedió: Sí</option>
            <option value="No">Procedió: No</option>
          </select>
          <select
            value={estadoFiltro}
            onChange={(event) => setEstadoFiltro(event.target.value as EstadoCambioMp | "")}
            aria-label="Filtrar por estado"
            className={`${CAMPO} w-auto`}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_CAMBIO_MP.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <caption className="sr-only">Historial de cambios de Master Pack</caption>
            <thead>
              <tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-fp-faint">
                <th scope="col" className="px-4 py-3">Fecha</th>
                <th scope="col" className="px-4 py-3">SKU</th>
                <th scope="col" className="px-4 py-3">Descripción</th>
                <th scope="col" className="px-4 py-3 text-center">MP antiguo → nuevo</th>
                <th scope="col" className="px-4 py-3">Usuario</th>
                <th scope="col" className="px-4 py-3 text-center">Procedió</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fp-line)]">
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center text-sm text-fp-dim">
                    {lista.length === 0 ? "Aún no hay cambios MP registrados." : "Ningún cambio coincide con los filtros."}
                  </td>
                </tr>
              ) : (
                visibles.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-fp-surface">
                    <td className="whitespace-nowrap px-4 py-3 text-fp-dim">
                      {formatearFechaCorta(c.fecha)}
                      {c.origen === "excel" ? (
                        <span className="block text-[11px] text-fp-faint">Carga masiva</span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] font-semibold text-fp-ink">{c.sku}</td>
                    <td className="px-4 py-3 text-fp-ink">{c.descripcion}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums">
                      <span className="text-fp-faint line-through decoration-fp-faint/60">{c.mpAntiguo ?? "—"}</span>
                      <span className="mx-2 text-fp-faint">→</span>
                      <span className="font-extrabold text-fp-ink">{c.mpNuevo}</span>
                    </td>
                    <td className="px-4 py-3 text-fp-dim">{c.usuario}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          c.procedio === "Sí" ? "bg-[#2FBF71]/15 text-[#1f9d5b]" : "bg-fp-surface text-fp-dim"
                        }`}
                      >
                        {c.procedio}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge estado={c.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {permisos.editar ? (
                          <button
                            type="button"
                            onClick={() => abrirEdicion(c)}
                            aria-label={`Editar cambio MP del SKU ${c.sku}`}
                            className="rounded-lg border border-fp-line p-2 text-fp-dim transition hover:bg-fp-surface hover:text-fp-ink"
                          >
                            <PencilIcon className="size-4" />
                          </button>
                        ) : null}
                        {permisos.eliminar ? (
                          <button
                            type="button"
                            onClick={() => eliminar(c)}
                            aria-label={`Eliminar cambio MP del SKU ${c.sku}`}
                            className="rounded-lg border border-[#F02615]/30 p-2 text-[#F02615] transition hover:bg-[#F02615]/10"
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
        <Paginador {...paginacion} />
      </section>

      {abierto ? (
        <Modal titulo={editando ? "Editar cambio MP" : "Nuevo cambio MP"} onCerrar={() => setAbierto(false)}>
          <form noValidate onSubmit={guardar} className="flex flex-col gap-4">
            <CampoSku
              id="cambio-sku"
              valor={form.sku}
              productos={catalogo.productos}
              catalogoVacio={catalogoVacio}
              onCambio={(sku, producto) =>
                setForm((f) => ({
                  ...f,
                  sku,
                  // Autocompleta el MP actual registrado en el catálogo.
                  mpAntiguo: producto ? String(mpComoNumero(producto.mp) ?? "") : f.mpAntiguo,
                }))
              }
            />

            <label className="flex flex-col gap-2 text-sm font-semibold text-fp-ink" htmlFor="cambio-descripcion">
              Descripción
              <input
                id="cambio-descripcion"
                value={productoForm?.descripcion ?? ""}
                readOnly
                placeholder="Se completa al ingresar un SKU válido"
                className={`${CAMPO} cursor-not-allowed`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="MP antiguo" error={errores.mpAntiguo} ayuda="Del catálogo">
                <input
                  id="cambio-mp-antiguo"
                  inputMode="numeric"
                  value={form.mpAntiguo}
                  onChange={(event) => setForm((f) => ({ ...f, mpAntiguo: event.target.value }))}
                  className={`${CAMPO} tabular-nums`}
                />
              </Campo>
              <Campo etiqueta="MP nuevo" obligatorio error={errores.mpNuevo}>
                <input
                  id="cambio-mp-nuevo"
                  inputMode="numeric"
                  value={form.mpNuevo}
                  onChange={(event) => setForm((f) => ({ ...f, mpNuevo: event.target.value }))}
                  aria-invalid={errores.mpNuevo ? true : undefined}
                  className={`${CAMPO} tabular-nums`}
                />
              </Campo>
              <Campo etiqueta="Fecha de cambio" obligatorio error={errores.fecha}>
                <input
                  id="cambio-fecha"
                  type="date"
                  value={form.fecha}
                  onChange={(event) => setForm((f) => ({ ...f, fecha: event.target.value }))}
                  className={CAMPO}
                />
              </Campo>
              <Campo etiqueta="Usuario" obligatorio error={errores.usuario}>
                <input
                  id="cambio-usuario"
                  value={form.usuario}
                  onChange={(event) => setForm((f) => ({ ...f, usuario: event.target.value }))}
                  className={CAMPO}
                />
              </Campo>
              <Campo etiqueta="Procedió">
                <select
                  id="cambio-procedio"
                  value={form.procedio}
                  onChange={(event) => {
                    const procedio = event.target.value as Procedio;
                    setForm((f) => ({ ...f, procedio, estado: estadoSegunProcedio(procedio, f.estado) }));
                  }}
                  className={CAMPO}
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </Campo>
              <Campo
                etiqueta="Estado"
                ayuda={form.procedio === "Sí" ? "Procedió = Sí: queda Resuelta" : undefined}
              >
                <select
                  id="cambio-estado"
                  value={form.estado}
                  disabled={form.procedio === "Sí"}
                  onChange={(event) => setForm((f) => ({ ...f, estado: event.target.value as EstadoCambioMp }))}
                  className={CAMPO}
                >
                  {ESTADOS_CAMBIO_MP.filter((e) => form.procedio === "Sí" || e !== "Resuelta").map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} className={BOTON_SECUNDARIO}>
                Cancelar
              </button>
              <button type="submit" disabled={!productoForm} className={BOTON_PRIMARIO}>
                {editando ? "Guardar cambios" : "Registrar cambio"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {reporte ? (
        <Modal titulo="Resultado de la carga masiva" onCerrar={() => setReporte(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fp-dim">
              Archivo: <span className="font-semibold text-fp-ink">{reporte.archivo}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Indicador etiqueta="Agregados" valor={reporte.agregados} color="#2FBF71" />
              <Indicador
                etiqueta="Con error"
                valor={reporte.errores.length}
                color="#F02615"
                alerta={reporte.errores.length > 0}
              />
            </div>
            {reporte.errores.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-fp-faint">
                  Filas no importadas
                </p>
                <ul className="max-h-60 overflow-y-auto rounded-xl border border-fp-line bg-fp-sunken p-3 text-sm text-fp-ink">
                  {reporte.errores.slice(0, 200).map((error) => (
                    <li key={error} className="py-0.5">
                      {error}
                    </li>
                  ))}
                  {reporte.errores.length > 200 ? (
                    <li className="pt-1 text-fp-faint">… y {reporte.errores.length - 200} más.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <div className="flex justify-end">
              <button type="button" onClick={() => setReporte(null)} className={BOTON_PRIMARIO}>
                Entendido
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function formularioVacio(usuario: string): Formulario {
  return {
    sku: "",
    mpAntiguo: "",
    mpNuevo: "",
    fecha: todayIso(),
    usuario,
    procedio: "No",
    estado: "Pendiente",
  };
}

function Campo({
  etiqueta,
  obligatorio = false,
  error,
  ayuda,
  children,
}: {
  etiqueta: string;
  obligatorio?: boolean;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm font-semibold text-fp-ink">
      <span>
        {etiqueta} {obligatorio ? <span className="text-[#F02615]">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-xs font-semibold text-[#F02615]">{error}</span>
      ) : ayuda ? (
        <span className="text-xs font-normal text-fp-faint">{ayuda}</span>
      ) : null}
    </div>
  );
}
