"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { buscarProducto, descargarExcel, fechaArchivo, useCatalogo } from "@/lib/catalogo";
import {
  ESTADOS_INCIDENCIA_MAESTRO,
  MOTIVOS_SUGERIDOS,
  cargarIncidenciasMaestro,
  diasTranscurridos,
  esCritica,
  generarId,
  guardarIncidenciasMaestro,
  incidenciaMaestroSchema,
  type EstadoIncidenciaMaestro,
  type IncidenciaMaestro,
} from "@/lib/incidencias-maestros";
import { usePermisos } from "@/lib/use-permisos";
import { useSession } from "@/lib/use-session";
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
  formatearFechaHora,
  useAviso,
  usePaginacion,
} from "@/components/datos-maestros/ui";
import { DownloadIcon, PencilIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons";

type Formulario = {
  sku: string;
  motivo: string;
  estado: EstadoIncidenciaMaestro;
};

const FORM_VACIO: Formulario = { sku: "", motivo: "", estado: "Pendiente" };

export function IncidenciasMaestrosView() {
  // Auxiliar: solo ver. Supervisor y Administrador: agregar, editar y borrar.
  const permisos = usePermisos("datos-maestros");
  const { usuario } = useSession();
  const { catalogo } = useCatalogo();
  const catalogoVacio = Object.keys(catalogo.productos).length === 0;

  const [lista, setLista] = useState<IncidenciaMaestro[]>([]);
  const [ahora, setAhora] = useState(() => new Date());
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoIncidenciaMaestro | "">("");
  const [soloCriticas, setSoloCriticas] = useState(false);
  const [editando, setEditando] = useState<IncidenciaMaestro | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<Formulario>(FORM_VACIO);
  const [errores, setErrores] = useState<Partial<Record<keyof Formulario, string>>>({});
  const [aviso, setAviso] = useAviso();

  useEffect(() => {
    setLista(cargarIncidenciasMaestro());
    // Actualiza el semáforo cada minuto.
    const id = window.setInterval(() => setAhora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function persistir(nueva: IncidenciaMaestro[]) {
    setLista(nueva);
    guardarIncidenciasMaestro(nueva);
  }

  const resumen = useMemo(
    () => ({
      total: lista.length,
      pendientes: lista.filter((i) => i.estado === "Pendiente").length,
      enProceso: lista.filter((i) => i.estado === "En Proceso").length,
      criticas: lista.filter((i) => esCritica(i, ahora)).length,
      resueltas: lista.filter((i) => i.estado === "Resuelta").length,
    }),
    [lista, ahora],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista
      .filter((i) => !estadoFiltro || i.estado === estadoFiltro)
      .filter((i) => !soloCriticas || esCritica(i, ahora))
      .filter(
        (i) =>
          !q || [i.sku, i.descripcion, i.motivo, i.registradoPor].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));
  }, [lista, busqueda, estadoFiltro, soloCriticas, ahora]);

  const { visibles, ...paginacion } = usePaginacion(filtradas, 25);

  function abrirNueva() {
    setEditando(null);
    setForm(FORM_VACIO);
    setErrores({});
    setAbierto(true);
  }

  function abrirEdicion(incidencia: IncidenciaMaestro) {
    setEditando(incidencia);
    setForm({ sku: incidencia.sku, motivo: incidencia.motivo, estado: incidencia.estado });
    setErrores({});
    setAbierto(true);
  }

  function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validado = incidenciaMaestroSchema.safeParse(form);
    const nuevosErrores: Partial<Record<keyof Formulario, string>> = {};
    if (!validado.success) {
      for (const issue of validado.error.issues) {
        const campo = issue.path[0] as keyof Formulario;
        nuevosErrores[campo] ??= issue.message;
      }
    }
    // Validación estricta: el SKU debe existir en el catálogo.
    const producto = buscarProducto(catalogo.productos, form.sku);
    if (form.sku.trim() && !producto) {
      nuevosErrores.sku = "Este SKU no existe en el catálogo. No se puede registrar.";
    }
    setErrores(nuevosErrores);
    if (!validado.success || !producto) return;

    const datos = validado.data;
    const ahoraIso = new Date().toISOString();
    const fechaResolucion =
      datos.estado === "Resuelta" ? editando?.fechaResolucion ?? ahoraIso : null;

    if (editando) {
      if (!permisos.editar) return;
      persistir(
        lista.map((i) =>
          i.id === editando.id
            ? { ...i, sku: producto.sku, descripcion: producto.descripcion, motivo: datos.motivo, estado: datos.estado, fechaResolucion }
            : i,
        ),
      );
      setAviso({ tipo: "exito", texto: `Incidencia del SKU ${producto.sku} actualizada.` });
    } else {
      if (!permisos.crear) return;
      const nueva: IncidenciaMaestro = {
        id: generarId("DM"),
        fechaRegistro: ahoraIso,
        sku: producto.sku,
        descripcion: producto.descripcion,
        motivo: datos.motivo,
        estado: datos.estado,
        fechaResolucion,
        registradoPor: usuario ? `${usuario.nombres} ${usuario.apellidos}`.trim() : "",
      };
      persistir([nueva, ...lista]);
      setAviso({ tipo: "exito", texto: `Incidencia registrada para el SKU ${producto.sku}.` });
    }
    setAbierto(false);
  }

  function eliminar(incidencia: IncidenciaMaestro) {
    if (!permisos.eliminar) return;
    if (!window.confirm(`¿Eliminar la incidencia del SKU ${incidencia.sku}?`)) return;
    persistir(lista.filter((i) => i.id !== incidencia.id));
    setAviso({ tipo: "exito", texto: "Incidencia eliminada." });
  }

  function exportar() {
    descargarExcel(`Incidencias_Datos_Maestros_${fechaArchivo()}.xlsx`, "Incidencias", [
      ["Fecha de registro", "SKU", "Descripción", "Motivo", "Estado", "Días", "Crítica", "Fecha de resolución", "Registrado por"],
      ...filtradas.map((i) => [
        formatearFechaHora(i.fechaRegistro),
        i.sku,
        i.descripcion,
        i.motivo,
        i.estado,
        diasTranscurridos(i, ahora),
        esCritica(i, ahora) ? "Sí" : "No",
        formatearFechaHora(i.fechaResolucion),
        i.registradoPor,
      ]),
    ]);
  }

  const productoForm = buscarProducto(catalogo.productos, form.sku);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <Encabezado
        titulo="Incidencias de datos maestros"
        descripcion="Reporta productos con información incorrecta en el sistema (EAN, descripción, MP…). El SKU debe existir en el catálogo."
        acciones={
          <>
            <button type="button" onClick={exportar} disabled={filtradas.length === 0} className={BOTON_SECUNDARIO}>
              <DownloadIcon className="size-4" />
              Exportar
            </button>
            {permisos.crear ? (
              <button type="button" onClick={abrirNueva} disabled={catalogoVacio} className={BOTON_PRIMARIO}>
                <PlusIcon className="size-4" />
                Nueva incidencia
              </button>
            ) : null}
          </>
        }
      />

      <AvisoBanner aviso={aviso} />

      {catalogoVacio ? (
        <p className="rounded-xl border border-[#FAB701]/35 bg-[#FAB701]/10 px-4 py-3 text-sm text-fp-ink">
          El catálogo de productos está vacío. Hasta que el Administrador lo cargue no se pueden registrar incidencias.
        </p>
      ) : null}

      <section aria-label="Resumen de incidencias" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador etiqueta="Total" valor={resumen.total} color="#76797B" />
        <Indicador etiqueta="Pendientes" valor={resumen.pendientes} color="#FAB701" />
        <Indicador etiqueta="En proceso" valor={resumen.enProceso} color="#7FB2FF" />
        <Indicador
          etiqueta="Críticas +1 día"
          valor={resumen.criticas}
          detalle="sin resolver"
          color="#F02615"
          alerta={resumen.criticas > 0}
        />
        <Indicador etiqueta="Resueltas" valor={resumen.resueltas} color="#2FBF71" />
      </section>

      <section className="glass overflow-hidden rounded-[18px]">
        <div className="flex flex-wrap items-center gap-3 border-b border-fp-line p-4">
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3 top-3.5 size-4 text-fp-faint" />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar SKU, descripción o motivo…"
              aria-label="Buscar incidencias"
              className={`${CAMPO} pl-9`}
            />
          </div>
          <select
            value={estadoFiltro}
            onChange={(event) => setEstadoFiltro(event.target.value as EstadoIncidenciaMaestro | "")}
            aria-label="Filtrar por estado"
            className={`${CAMPO} w-auto`}
          >
            <option value="">Todos los estados</option>
            {ESTADOS_INCIDENCIA_MAESTRO.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={soloCriticas}
            onClick={() => setSoloCriticas((v) => !v)}
            className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
              soloCriticas
                ? "border-[#F02615] bg-[#F02615]/15 text-[#F02615]"
                : "border-fp-line-strong bg-fp-surface text-fp-dim hover:text-fp-ink"
            }`}
          >
            <span aria-hidden="true" className="size-2 rotate-45 rounded-[1px] bg-[#F02615]" />
            Solo críticas
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <caption className="sr-only">Incidencias de datos maestros</caption>
            <thead>
              <tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-fp-faint">
                <th scope="col" className="px-4 py-3">Registro</th>
                <th scope="col" className="px-4 py-3">SKU</th>
                <th scope="col" className="px-4 py-3">Descripción</th>
                <th scope="col" className="px-4 py-3">Motivo</th>
                <th scope="col" className="px-4 py-3">Estado</th>
                <th scope="col" className="px-4 py-3">Tiempo</th>
                <th scope="col" className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--fp-line)]">
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm text-fp-dim">
                    {lista.length === 0 ? "Aún no hay incidencias registradas." : "Ninguna incidencia coincide con los filtros."}
                  </td>
                </tr>
              ) : (
                visibles.map((i) => {
                  const dias = diasTranscurridos(i, ahora);
                  const critica = esCritica(i, ahora);
                  return (
                    <tr key={i.id} className={`transition-colors hover:bg-fp-surface ${critica ? "bg-[#F02615]/[0.05]" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-3 text-fp-dim">
                        {formatearFechaHora(i.fechaRegistro)}
                        {i.registradoPor ? <span className="block text-[11px] text-fp-faint">{i.registradoPor}</span> : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] font-semibold text-fp-ink">{i.sku}</td>
                      <td className="px-4 py-3 text-fp-ink">{i.descripcion}</td>
                      <td className="max-w-xs px-4 py-3 text-fp-dim">{i.motivo}</td>
                      <td className="px-4 py-3">
                        <EstadoBadge estado={i.estado} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Semaforo dias={dias} critica={critica} resuelta={i.estado === "Resuelta"} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {permisos.editar ? (
                            <button
                              type="button"
                              onClick={() => abrirEdicion(i)}
                              aria-label={`Editar incidencia del SKU ${i.sku}`}
                              className="rounded-lg border border-fp-line p-2 text-fp-dim transition hover:bg-fp-surface hover:text-fp-ink"
                            >
                              <PencilIcon className="size-4" />
                            </button>
                          ) : null}
                          {permisos.eliminar ? (
                            <button
                              type="button"
                              onClick={() => eliminar(i)}
                              aria-label={`Eliminar incidencia del SKU ${i.sku}`}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Paginador {...paginacion} />
      </section>

      {abierto ? (
        <Modal titulo={editando ? "Editar incidencia" : "Nueva incidencia"} onCerrar={() => setAbierto(false)}>
          <form noValidate onSubmit={guardar} className="flex flex-col gap-4">
            <CampoSku
              id="incidencia-sku"
              valor={form.sku}
              productos={catalogo.productos}
              catalogoVacio={catalogoVacio}
              onCambio={(sku) => setForm((f) => ({ ...f, sku }))}
            />
            {errores.sku && form.sku.trim() === "" ? (
              <p className="-mt-2 text-xs font-semibold text-[#F02615]">{errores.sku}</p>
            ) : null}

            <label className="flex flex-col gap-2 text-sm font-semibold text-fp-ink" htmlFor="incidencia-descripcion">
              Descripción
              <input
                id="incidencia-descripcion"
                value={productoForm?.descripcion ?? ""}
                readOnly
                placeholder="Se completa al ingresar un SKU válido"
                className={`${CAMPO} cursor-not-allowed`}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-fp-ink" htmlFor="incidencia-motivo">
              <span>
                Motivo del error <span className="text-[#F02615]">*</span>
              </span>
              <input
                id="incidencia-motivo"
                list="motivos-sugeridos"
                value={form.motivo}
                onChange={(event) => setForm((f) => ({ ...f, motivo: event.target.value }))}
                placeholder="Ej. Error de EAN"
                aria-invalid={errores.motivo ? true : undefined}
                className={CAMPO}
              />
              <datalist id="motivos-sugeridos">
                {MOTIVOS_SUGERIDOS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              {errores.motivo ? <span className="text-xs font-semibold text-[#F02615]">{errores.motivo}</span> : null}
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-fp-ink" htmlFor="incidencia-estado">
              Estado
              <select
                id="incidencia-estado"
                value={form.estado}
                onChange={(event) => setForm((f) => ({ ...f, estado: event.target.value as EstadoIncidenciaMaestro }))}
                className={CAMPO}
              >
                {ESTADOS_INCIDENCIA_MAESTRO.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
              {form.estado === "Resuelta" ? (
                <span className="text-xs font-normal text-fp-faint">La fecha de resolución se registra automáticamente.</span>
              ) : null}
            </label>

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} className={BOTON_SECUNDARIO}>
                Cancelar
              </button>
              <button type="submit" disabled={!productoForm} className={BOTON_PRIMARIO}>
                {editando ? "Guardar cambios" : "Registrar incidencia"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

/** Semáforo de tiempo: verde en plazo, rojo crítica (+1 día), gris resuelta. */
function Semaforo({ dias, critica, resuelta }: { dias: number; critica: boolean; resuelta: boolean }) {
  const texto = dias === 0 ? "Hoy" : `${dias} día${dias === 1 ? "" : "s"}`;
  const color = resuelta ? "#76797B" : critica ? "#F02615" : "#2FBF71";
  const etiqueta = resuelta ? "Resuelta" : critica ? "Crítico" : "En plazo";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-2.5 rounded-full"
        style={{ background: color, boxShadow: critica ? `0 0 8px ${color}` : undefined }}
      />
      <span className="text-sm font-semibold text-fp-ink">{texto}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
        {etiqueta}
      </span>
    </span>
  );
}
