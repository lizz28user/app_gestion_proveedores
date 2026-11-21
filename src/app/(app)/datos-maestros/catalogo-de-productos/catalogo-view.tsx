"use client";

import { useMemo, useRef, useState } from "react";
import {
  descargarExcel,
  fechaArchivo,
  filasACatalogo,
  guardarCatalogo,
  leerHojaExcel,
  useCatalogo,
  vaciarCatalogo,
} from "@/lib/catalogo";
import { useSession } from "@/lib/use-session";
import {
  AvisoBanner,
  BOTON_PELIGRO,
  BOTON_PRIMARIO,
  BOTON_SECUNDARIO,
  CAMPO,
  ConfirmarPasswordModal,
  Encabezado,
  Indicador,
  Paginador,
  formatearFechaHora,
  useAviso,
  usePaginacion,
} from "@/components/datos-maestros/ui";
import { DownloadIcon, PlusIcon, SearchIcon, XIcon } from "@/components/icons";

type AccionPendiente = { tipo: "cargar"; archivo: File } | { tipo: "vaciar" } | null;

type Columna = "sku" | "descripcion" | "mp" | "undsPallet" | "cargaTitan";
type Filtros = Record<Columna, string>;

const FILTROS_VACIOS: Filtros = { sku: "", descripcion: "", mp: "", undsPallet: "", cargaTitan: "" };

/** Valor especial del filtro para buscar productos sin dato en esa columna. */
const SIN_DATO = "__vacio__";

/** Columnas con lista de valores; si hay demasiados valores distintos se usa texto. */
const MAX_OPCIONES = 300;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function coincide(valor: string, filtro: string, exacto: boolean): boolean {
  if (!filtro) return true;
  if (filtro === SIN_DATO) return valor.trim() === "";
  return exacto ? valor === filtro : normalizar(valor).includes(normalizar(filtro));
}

const CAMPO_FILTRO =
  "h-9 w-full min-w-0 rounded-lg border border-fp-line-strong bg-fp-surface px-2.5 text-xs text-fp-ink placeholder:text-fp-faint focus-visible:border-[#F02615] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F02615]/20";

function FiltroTexto({
  etiqueta,
  valor,
  onCambio,
  placeholder,
  mono = false,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  placeholder: string;
  mono?: boolean;
}) {
  return (
    <input
      type="search"
      aria-label={etiqueta}
      value={valor}
      onChange={(event) => onCambio(event.target.value)}
      placeholder={placeholder}
      className={`${CAMPO_FILTRO} ${mono ? "font-mono" : ""} ${valor ? "!border-[#F02615]/60" : ""}`}
    />
  );
}

/** Filtro de columna corta: lista de valores (o texto si hay demasiados). */
function FiltroColumna({
  etiqueta,
  valor,
  onCambio,
  opciones,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  opciones: { valores: string[]; hayVacios: boolean; usarLista: boolean };
}) {
  if (!opciones.usarLista) {
    return <FiltroTexto etiqueta={etiqueta} valor={valor} onCambio={onCambio} placeholder="Contiene…" />;
  }
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(event) => onCambio(event.target.value)}
      className={`${CAMPO_FILTRO} ${valor ? "!border-[#F02615]/60" : ""}`}
    >
      <option value="">Todos</option>
      {opciones.hayVacios ? <option value={SIN_DATO}>(Sin dato)</option> : null}
      {opciones.valores.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}

export function CatalogoView() {
  const { usuario } = useSession();
  // Solo el Administrador carga o vacía el catálogo (y confirma con su contraseña).
  const esAdmin = usuario?.rol === "Administrador";
  const { catalogo, cargando } = useCatalogo();
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VACIOS);
  const [accion, setAccion] = useState<AccionPendiente>(null);
  const [procesando, setProcesando] = useState(false);
  const [aviso, setAviso] = useAviso();
  const inputArchivo = useRef<HTMLInputElement | null>(null);

  const productos = useMemo(
    () => Object.values(catalogo.productos).sort((a, b) => a.sku.localeCompare(b.sku, "es", { numeric: true })),
    [catalogo.productos],
  );

  // Valores distintos de las columnas cortas (MP, pallet, Titan) para las listas de filtro.
  const opciones = useMemo(() => {
    const distintos = (col: Columna) => {
      const set = new Set<string>();
      let hayVacios = false;
      for (const p of productos) {
        const v = p[col].trim();
        if (v) set.add(v);
        else hayVacios = true;
      }
      const valores = [...set].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
      return { valores, hayVacios, usarLista: valores.length <= MAX_OPCIONES };
    };
    return { mp: distintos("mp"), undsPallet: distintos("undsPallet"), cargaTitan: distintos("cargaTitan") };
  }, [productos]);

  const filtrosActivos = Object.values(filtros).filter(Boolean).length;

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    return productos.filter((p) => {
      if (q && ![p.sku, p.descripcion, p.mp, p.undsPallet, p.cargaTitan].some((v) => normalizar(v).includes(q))) {
        return false;
      }
      return (
        coincide(p.sku, filtros.sku, false) &&
        coincide(p.descripcion, filtros.descripcion, false) &&
        coincide(p.mp, filtros.mp, opciones.mp.usarLista) &&
        coincide(p.undsPallet, filtros.undsPallet, opciones.undsPallet.usarLista) &&
        coincide(p.cargaTitan, filtros.cargaTitan, opciones.cargaTitan.usarLista)
      );
    });
  }, [productos, busqueda, filtros, opciones]);

  function cambiarFiltro(columna: Columna, valor: string) {
    setFiltros((actual) => ({ ...actual, [columna]: valor }));
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_VACIOS);
    setBusqueda("");
  }

  const { visibles, ...paginacion } = usePaginacion(filtrados, 50);

  const conMp = productos.filter((p) => p.mp).length;
  const conPallet = productos.filter((p) => p.undsPallet).length;

  async function cargarArchivo(archivo: File) {
    setProcesando(true);
    try {
      const filas = await leerHojaExcel(archivo);
      const { productos: nuevos, total, omitidas } = filasACatalogo(filas);
      if (total === 0) {
        setAviso({
          tipo: "error",
          texto: "No se encontraron productos. El Excel debe tener al menos las columnas SKU y Descripción.",
        });
        return;
      }
      await guardarCatalogo({ productos: nuevos, cargadoEn: new Date().toISOString(), archivo: archivo.name });
      setAviso({
        tipo: "exito",
        texto: `Catálogo cargado: ${total.toLocaleString("es-PE")} SKU${omitidas ? ` (${omitidas} filas sin SKU o descripción se omitieron)` : ""}.`,
      });
    } catch (error) {
      setAviso({
        tipo: "error",
        texto: error instanceof Error ? error.message : "No se pudo leer el archivo del catálogo.",
      });
    } finally {
      setProcesando(false);
    }
  }

  function exportar() {
    descargarExcel(`Catalogo_Productos_${fechaArchivo()}.xlsx`, "Catálogo", [
      ["SKU", "Descripción", "MP", "Unds PALLET", "CARGA TITAN"],
      ...filtrados.map((p) => [p.sku, p.descripcion, p.mp, p.undsPallet, p.cargaTitan]),
    ]);
  }

  function descargarPlantilla() {
    descargarExcel("Plantilla_Catalogo_Productos.xlsx", "Catálogo", [
      ["SKU", "Descripción", "MP", "Unds PALLET", "CARGA TITAN"],
      ["100245", "PARACETAMOL 500MG X 100 TAB (ejemplo)", "12", "1440", "A"],
    ]);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <Encabezado
        titulo="Catálogo de productos"
        descripcion="Fuente de la verdad de los productos. Incidencias y Cambio MP validan el SKU contra este catálogo."
        acciones={
          <>
            <button type="button" onClick={exportar} disabled={filtrados.length === 0} className={BOTON_SECUNDARIO}>
              <DownloadIcon className="size-4" />
              Exportar
            </button>
            {esAdmin ? (
              <>
                <button type="button" onClick={descargarPlantilla} className={BOTON_SECUNDARIO}>
                  <DownloadIcon className="size-4" />
                  Plantilla
                </button>
                <button
                  type="button"
                  onClick={() => setAccion({ tipo: "vaciar" })}
                  disabled={productos.length === 0 || procesando}
                  className={BOTON_PELIGRO}
                >
                  <XIcon className="size-4" />
                  Vaciar
                </button>
                <button
                  type="button"
                  onClick={() => inputArchivo.current?.click()}
                  disabled={procesando}
                  className={BOTON_PRIMARIO}
                >
                  <PlusIcon className="size-4" />
                  {procesando ? "Cargando…" : "Cargar Excel"}
                </button>
                <input
                  ref={inputArchivo}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(event) => {
                    const archivo = event.target.files?.[0];
                    event.target.value = "";
                    if (archivo) setAccion({ tipo: "cargar", archivo });
                  }}
                />
              </>
            ) : null}
          </>
        }
      />

      <AvisoBanner aviso={aviso} />


      <section aria-label="Resumen del catálogo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="SKU en catálogo" valor={productos.length} color="#F02615" />
        <Indicador etiqueta="Con MP" valor={conMp} color="#76797B" />
        <Indicador etiqueta="Con unds. pallet" valor={conPallet} color="#7FB2FF" />
        <Indicador
          etiqueta="Última carga"
          valor={catalogo.cargadoEn ? formatearFechaHora(catalogo.cargadoEn).split(",")[0] : "—"}
          detalle={catalogo.archivo ?? "Sin cargas"}
          color="#2FBF71"
        />
      </section>

      <section className="glass overflow-hidden rounded-[18px]">
        <div className="flex flex-wrap items-center gap-3 border-b border-fp-line p-4">
          <div className="relative w-full sm:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-3.5 size-4 text-fp-faint" />
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por SKU, descripción, MP, pallet o carga Titan…"
              aria-label="Buscar en el catálogo"
              className={`${CAMPO} pl-9`}
            />
          </div>
          <p className="text-sm text-fp-dim" aria-live="polite">
            {filtrados.length.toLocaleString("es-PE")} producto{filtrados.length === 1 ? "" : "s"}
            {filtrados.length !== productos.length
              ? ` de ${productos.length.toLocaleString("es-PE")}`
              : ""}
          </p>
          {filtrosActivos > 0 || busqueda ? (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#F02615]/35 bg-[#F02615]/10 px-3 text-xs font-bold text-[#F02615] transition hover:bg-[#F02615]/20"
            >
              <XIcon className="size-3.5" />
              Limpiar filtros{filtrosActivos > 0 ? ` (${filtrosActivos})` : ""}
            </button>
          ) : null}
        </div>

        {cargando ? (
          <p className="px-4 py-14 text-center text-sm text-fp-dim">Cargando catálogo…</p>
        ) : productos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span aria-hidden="true" className="flex gap-1.5">
              <span className="size-3 rotate-45 rounded-[2px] bg-[#F02615]" />
              <span className="size-3 rotate-45 rounded-[2px] bg-[#76797B]" />
            </span>
            <p className="text-base font-bold text-fp-ink">El catálogo está vacío</p>
            <p className="max-w-md text-sm text-fp-dim">
              {esAdmin
                ? "Carga el Excel del catálogo (columnas SKU, Descripción, MP, Unds PALLET y CARGA TITAN) para habilitar Incidencias y Cambio MP."
                : "El Administrador debe cargar el catálogo para habilitar Incidencias y Cambio MP."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">Catálogo de productos</caption>
                <thead>
                  <tr className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-fp-faint">
                    <th scope="col" className="px-4 py-3">SKU</th>
                    <th scope="col" className="px-4 py-3">Descripción</th>
                    <th scope="col" className="px-4 py-3 text-right">MP</th>
                    <th scope="col" className="px-4 py-3 text-right">Unds pallet</th>
                    <th scope="col" className="px-4 py-3 text-center">Carga Titan</th>
                  </tr>
                  {/* Filtros por columna */}
                  <tr className="border-b border-fp-line">
                    <th scope="col" className="px-3 pb-3 font-normal">
                      <FiltroTexto
                        etiqueta="Filtrar por SKU"
                        valor={filtros.sku}
                        onCambio={(v) => cambiarFiltro("sku", v)}
                        placeholder="SKU…"
                        mono
                      />
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      <FiltroTexto
                        etiqueta="Filtrar por descripción"
                        valor={filtros.descripcion}
                        onCambio={(v) => cambiarFiltro("descripcion", v)}
                        placeholder="Contiene…"
                      />
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      <FiltroColumna
                        etiqueta="Filtrar por MP"
                        valor={filtros.mp}
                        onCambio={(v) => cambiarFiltro("mp", v)}
                        opciones={opciones.mp}
                      />
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      <FiltroColumna
                        etiqueta="Filtrar por unidades por pallet"
                        valor={filtros.undsPallet}
                        onCambio={(v) => cambiarFiltro("undsPallet", v)}
                        opciones={opciones.undsPallet}
                      />
                    </th>
                    <th scope="col" className="px-3 pb-3 font-normal">
                      <FiltroColumna
                        etiqueta="Filtrar por carga Titan"
                        valor={filtros.cargaTitan}
                        onCambio={(v) => cambiarFiltro("cargaTitan", v)}
                        opciones={opciones.cargaTitan}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--fp-line)]">
                  {visibles.map((p) => (
                    <tr key={p.sku} className="transition-colors hover:bg-fp-surface">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13px] font-semibold text-fp-ink">{p.sku}</td>
                      <td className="px-4 py-2.5 text-fp-ink">{p.descripcion}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fp-dim">{p.mp || "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-fp-dim">{p.undsPallet || "—"}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-fp-dim">{p.cargaTitan || "—"}</td>
                    </tr>
                  ))}
                  {visibles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-fp-dim">
                        Ningún producto coincide con los filtros.{" "}
                        <button
                          type="button"
                          onClick={limpiarFiltros}
                          className="font-semibold text-[#F02615] underline underline-offset-2"
                        >
                          Limpiar filtros
                        </button>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <Paginador {...paginacion} />
          </>
        )}
      </section>

      {accion?.tipo === "cargar" ? (
        <ConfirmarPasswordModal
          titulo="Cargar catálogo"
          mensaje={`Se reemplazará el catálogo actual con "${accion.archivo.name}". Confirma con tu contraseña de Administrador.`}
          textoBoton="Cargar catálogo"
          onCerrar={() => setAccion(null)}
          onConfirmado={() => {
            const archivo = accion.archivo;
            setAccion(null);
            void cargarArchivo(archivo);
          }}
        />
      ) : null}

      {accion?.tipo === "vaciar" ? (
        <ConfirmarPasswordModal
          titulo="Vaciar catálogo"
          mensaje="Se borrarán todos los productos. Nadie podrá registrar Incidencias ni Cambios MP hasta que se cargue un catálogo nuevo."
          textoBoton="Vaciar catálogo"
          peligro
          onCerrar={() => setAccion(null)}
          onConfirmado={() => {
            setAccion(null);
            vaciarCatalogo()
              .then(() => setAviso({ tipo: "exito", texto: "Catálogo vaciado." }))
              .catch(() => setAviso({ tipo: "error", texto: "No se pudo vaciar el catálogo." }));
          }}
        />
      ) : null}
    </div>
  );
}
