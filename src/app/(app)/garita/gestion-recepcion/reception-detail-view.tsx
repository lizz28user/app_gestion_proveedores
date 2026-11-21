"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Reception, PUERTAS_ASIGNABLES, OPERARIOS, etiquetaPuerta } from "@/components/reception/types";
import { loadRecepciones, saveRecepciones, toSafeNumber } from "@/components/reception/storage";
import {
  ReceptionInput,
  ReceptionSelect,
  ReceptionTextarea,
  ReceptionButton,
  SectionHeader,
  ReadOnlyField,
} from "@/components/reception/ui";
import { usePermisos } from "@/lib/use-permisos";
import { ocsDelProveedor, type OrdenCompraIkf } from "@/lib/citas-del-dia";
import {
  cargarTiposIncidencia,
  guardarTiposIncidencia,
  validarTipoNuevo,
} from "@/lib/tipos-incidencia";

type Resultado = "sin-rechazo" | "rechazo-parcial" | "rechazo-total";

const LISTA_RECEPCIONES = "/garita/gestion-recepcion";

const CAMPO =
  "h-11 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm text-slate-900 dark:text-zinc-100 shadow-sm transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 disabled:opacity-60";

/** Hora actual del sistema en formato HH:MM (24 h). */
function horaActual(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ReceptionDetailView({ receptionId }: { receptionId: string }) {
  const router = useRouter();
  // Auxiliar: puede registrar la recepción (agregar). Modificar una recepción
  // finalizada, corregir horas, borrar incidencias o gestionar tipos: Supervisor y Administrador.
  const permisos = usePermisos("garita");

  const [recepcion, setRecepcion] = useState<Reception | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: "exito" | "error" } | null>(null);

  // 1. Datos de recepción
  const [puerta, setPuerta] = useState("");
  const [operario, setOperario] = useState("");
  const [horaInicioDescarga, setHoraInicioDescarga] = useState<string | null>(null);
  const [horaFin, setHoraFin] = useState<string | null>(null);

  // 2. Incidencias
  const [presentaIncidencias, setPresentaIncidencias] = useState<boolean | null>(null);
  const [tipos, setTipos] = useState<string[]>([]);
  const [gestionTipos, setGestionTipos] = useState(false);
  const [tipoNuevo, setTipoNuevo] = useState("");
  const [errorTipo, setErrorTipo] = useState<string | null>(null);
  const [ocs, setOcs] = useState<OrdenCompraIkf[]>([]);
  const [tipoIncidencia, setTipoIncidencia] = useState("");
  const [ocSku, setOcSku] = useState("");
  const [cantidadAfectada, setCantidadAfectada] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // 3. Resultado
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [aceptadas, setAceptadas] = useState("");
  const [rechazadas, setRechazadas] = useState("");
  const [evaluadas, setEvaluadas] = useState("");
  const seccionResultado = useRef<HTMLElement | null>(null);

  useEffect(() => {
    cargarRecepcion();
    setTipos(cargarTiposIncidencia());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receptionId]);

  function cargarRecepcion() {
    try {
      const encontrada = loadRecepciones().find((r) => r.id === receptionId);
      if (!encontrada) {
        setLoading(false);
        return;
      }
      const incidencias = Array.isArray(encontrada.incidencias) ? encontrada.incidencias : [];
      const estadoInicial: Reception = {
        ...encontrada,
        puerta: encontrada.puerta ?? null,
        operarioResponsable: encontrada.operarioResponsable ?? null,
        horaInicioDescarga: encontrada.horaInicioDescarga ?? null,
        horaFin: encontrada.horaFin ?? null,
        estado: encontrada.estado ?? "avance",
        incidencias,
        resultado: encontrada.resultado ?? null,
        aceptadas: toSafeNumber(encontrada.aceptadas),
        rechazadas: toSafeNumber(encontrada.rechazadas),
        evaluadas: toSafeNumber(encontrada.evaluadas),
        updatedAt: encontrada.updatedAt ?? new Date().toISOString(),
      };

      setPuerta(encontrada.puerta ?? "");
      setOperario(encontrada.operarioResponsable ?? "");
      setHoraInicioDescarga(encontrada.horaInicioDescarga ?? null);
      setHoraFin(encontrada.horaFin ?? null);
      // Respuesta guardada; si no hay, se deduce de las incidencias registradas.
      setPresentaIncidencias(
        typeof encontrada.presentaIncidencias === "boolean"
          ? encontrada.presentaIncidencias
          : incidencias.length > 0
            ? true
            : null,
      );
      if (encontrada.resultado) setResultado(encontrada.resultado);
      if (encontrada.aceptadas) setAceptadas(String(encontrada.aceptadas));
      if (encontrada.rechazadas) setRechazadas(String(encontrada.rechazadas));
      if (encontrada.evaluadas) setEvaluadas(String(encontrada.evaluadas));
      setOcs(ocsDelProveedor(encontrada.ruc));
      setRecepcion(estadoInicial);
    } finally {
      setLoading(false);
    }
  }

  function mostrarMensaje(texto: string, tipo: "exito" | "error") {
    setMensaje({ texto, tipo });
    window.setTimeout(() => setMensaje(null), 4000);
  }

  /** Guarda cambios de esta recepción en el almacenamiento. */
  const persistir = useCallback(
    (cambios: Partial<Reception>) => {
      if (!recepcion) return;
      const actualizado = { ...cambios, updatedAt: new Date().toISOString() };
      const lista = loadRecepciones().map((r) => (r.id === recepcion.id ? { ...r, ...actualizado } : r));
      saveRecepciones(lista);
      setRecepcion((prev) => (prev ? { ...prev, ...actualizado } : prev));
    },
    [recepcion],
  );

  /* ───────────── 1. Inicio y fin de descarga ───────────── */

  function registrarInicioDescarga() {
    const hora = horaActual();
    setHoraInicioDescarga(hora);
    persistir({ horaInicioDescarga: hora });
    mostrarMensaje(`Inicio de descarga registrado a las ${hora}.`, "exito");
  }

  function registrarFinDescarga() {
    if (!horaInicioDescarga) {
      mostrarMensaje("Primero registra el inicio de la descarga.", "error");
      return;
    }
    const hora = horaActual();
    setHoraFin(hora);
    persistir({ horaFin: hora });
    mostrarMensaje(`Fin de descarga registrado a las ${hora}.`, "exito");
  }

  function corregirHoras() {
    setHoraInicioDescarga(null);
    setHoraFin(null);
    persistir({ horaInicioDescarga: null, horaFin: null });
    mostrarMensaje("Horas de descarga borradas. Vuelve a registrarlas.", "exito");
  }

  /* ───────────── 2. Incidencias ───────────── */

  function responderIncidencias(valor: boolean) {
    setPresentaIncidencias(valor);
    if (valor) {
      // Con incidencias: se pasa directo a la sección 3. Resultado.
      window.setTimeout(() => {
        seccionResultado.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } else {
      // Sin incidencias: la sección Resultado se oculta y la recepción queda "Sin rechazo".
      setResultado(null);
    }
  }

  const agregarIncidencia = useCallback(() => {
    if (!tipoIncidencia || !ocSku || !cantidadAfectada || !descripcion.trim()) {
      mostrarMensaje("Completa tipo, OC / SKU, cantidad afectada y descripción.", "error");
      return;
    }
    const cantidad = parseInt(cantidadAfectada, 10);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      mostrarMensaje("La cantidad afectada debe ser mayor a 0.", "error");
      return;
    }
    const nueva = {
      id: crypto.randomUUID(),
      tipo: tipoIncidencia,
      ocSku,
      cantidadAfectada: cantidad,
      descripcion: descripcion.trim(),
      evidencia: null,
    };
    setRecepcion((prev) => (prev ? { ...prev, incidencias: [...prev.incidencias, nueva] } : prev));
    setTipoIncidencia("");
    setOcSku("");
    setCantidadAfectada("");
    setDescripcion("");
    mostrarMensaje("Incidencia agregada. Se guarda al presionar Guardar avance o Finalizar.", "exito");
  }, [tipoIncidencia, ocSku, cantidadAfectada, descripcion]);

  const eliminarIncidencia = useCallback((id: string) => {
    setRecepcion((prev) => (prev ? { ...prev, incidencias: prev.incidencias.filter((i) => i.id !== id) } : prev));
  }, []);

  function agregarTipo() {
    const error = validarTipoNuevo(tipos, tipoNuevo);
    if (error) {
      setErrorTipo(error);
      return;
    }
    const lista = [...tipos, tipoNuevo.trim()];
    setTipos(lista);
    guardarTiposIncidencia(lista);
    setTipoNuevo("");
    setErrorTipo(null);
  }

  function eliminarTipo(tipo: string) {
    if (tipos.length <= 1) {
      setErrorTipo("Debe quedar al menos un tipo.");
      return;
    }
    const lista = tipos.filter((t) => t !== tipo);
    setTipos(lista);
    guardarTiposIncidencia(lista);
    if (tipoIncidencia === tipo) setTipoIncidencia("");
    setErrorTipo(null);
  }

  /* ───────────── Guardar y finalizar ───────────── */

  const handleGuardarAvance = useCallback(() => {
    if (!recepcion) return;
    if (!puerta || !operario) {
      mostrarMensaje("Puerta y operario responsable son requeridos.", "error");
      return;
    }
    setGuardando(true);
    persistir({
      puerta,
      operarioResponsable: operario,
      horaInicioDescarga,
      horaFin,
      presentaIncidencias,
      incidencias: presentaIncidencias === false ? [] : recepcion.incidencias,
      estado: "avance",
    });
    // Vuelve a la lista de Gestión de recepción.
    router.push(LISTA_RECEPCIONES);
  }, [recepcion, puerta, operario, horaInicioDescarga, horaFin, presentaIncidencias, persistir, router]);

  const handleFinalizar = useCallback(() => {
    if (!recepcion) return;
    if (!puerta || !operario) {
      mostrarMensaje("Puerta y operario responsable son requeridos para finalizar.", "error");
      return;
    }
    if (!horaInicioDescarga || !horaFin) {
      mostrarMensaje("Registra el inicio y el fin de la descarga antes de finalizar.", "error");
      return;
    }
    if (presentaIncidencias === null) {
      mostrarMensaje("Indica si la recepción presenta incidencias.", "error");
      return;
    }
    if (presentaIncidencias && recepcion.incidencias.length === 0) {
      mostrarMensaje("Marcaste que hay incidencias: agrega al menos una.", "error");
      return;
    }

    let resultadoFinal: Resultado;
    let aceptadasNum: number;
    let rechazadasNum: number;
    let evaluadasNum: number;

    if (presentaIncidencias) {
      if (!resultado) {
        mostrarMensaje("Selecciona un resultado (Sin rechazo / Rechazo parcial / Rechazo total).", "error");
        return;
      }
      aceptadasNum = parseInt(aceptadas, 10) || 0;
      rechazadasNum = parseInt(rechazadas, 10) || 0;
      evaluadasNum = parseInt(evaluadas, 10) || 0;
      if (resultado === "sin-rechazo" && rechazadasNum > 0) {
        mostrarMensaje("Sin rechazo no puede tener unidades rechazadas.", "error");
        return;
      }
      resultadoFinal = resultado;
    } else {
      // Sin incidencias: todo lo estimado se considera aceptado.
      const estimadas = Math.round(Number(recepcion.unidadesEstimadas) || 0);
      resultadoFinal = "sin-rechazo";
      aceptadasNum = estimadas;
      rechazadasNum = 0;
      evaluadasNum = estimadas;
    }

    setGuardando(true);
    persistir({
      puerta,
      operarioResponsable: operario,
      horaInicioDescarga,
      horaFin,
      presentaIncidencias,
      incidencias: presentaIncidencias ? recepcion.incidencias : [],
      estado: "finalizada",
      resultado: resultadoFinal,
      aceptadas: aceptadasNum,
      rechazadas: rechazadasNum,
      evaluadas: evaluadasNum,
    });
    // Vuelve a la lista de Gestión de recepción.
    router.push(LISTA_RECEPCIONES);
  }, [
    recepcion,
    puerta,
    operario,
    horaInicioDescarga,
    horaFin,
    presentaIncidencias,
    resultado,
    aceptadas,
    rechazadas,
    evaluadas,
    persistir,
    router,
  ]);

  const duracionDescarga = useMemo(() => {
    if (!horaInicioDescarga || !horaFin) return null;
    const [hi, mi] = horaInicioDescarga.split(":").map(Number);
    const [hf, mf] = horaFin.split(":").map(Number);
    let minutos = hf * 60 + mf - (hi * 60 + mi);
    if (minutos < 0) minutos += 24 * 60;
    const h = Math.floor(minutos / 60);
    return h > 0 ? `${h} h ${minutos % 60} min` : `${minutos} min`;
  }, [horaInicioDescarga, horaFin]);

  /* ───────────── Pantallas de carga y error ───────────── */

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Gestionar recepción</h1>
        <p className="py-10 text-center text-slate-500 dark:text-zinc-400">Cargando recepción…</p>
      </div>
    );
  }

  if (!recepcion) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">Gestionar recepción</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-200">
          No se encontró la recepción solicitada.
        </div>
        <button
          type="button"
          onClick={() => router.push(LISTA_RECEPCIONES)}
          className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          Volver a Gestión de recepción
        </button>
      </div>
    );
  }

  const finalizada = recepcion.estado === "finalizada";
  const soloLectura = !permisos.cargando && (!permisos.crear || (finalizada && !permisos.editar));
  const sinOcs = ocs.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      {/* Encabezado */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Gestión de recepción</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-fp-ink sm:text-4xl">{recepcion.proveedor}</h1>
          <p className="mt-1 text-sm text-fp-dim">RUC {recepcion.ruc}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push(LISTA_RECEPCIONES)}
          className="inline-flex size-10 items-center justify-center rounded-lg border border-fp-line bg-fp-surface text-fp-dim transition-colors hover:text-fp-ink"
          aria-label="Volver a Gestión de recepción"
        >
          ×
        </button>
      </header>

      {mensaje && (
        <div
          role={mensaje.tipo === "error" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm font-medium ${
            mensaje.tipo === "exito"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-200"
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      {soloLectura ? (
        <div className="flex items-start gap-3 rounded-xl border border-[#FAB701]/35 bg-[#FAB701]/10 px-4 py-3 text-sm text-fp-ink">
          <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rotate-45 rounded-[1px] bg-[#FAB701]" />
          <span>
            {finalizada
              ? "Esta recepción ya fue finalizada. Solo un Supervisor o Administrador puede modificarla."
              : "Tu rol solo permite ver esta recepción."}
          </span>
        </div>
      ) : null}

      {/* Datos de llegada - Solo lectura */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <SectionHeader number={0} title="Datos de llegada · Solo lectura" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <ReadOnlyField label="RUC" value={recepcion.ruc} />
          <ReadOnlyField label="Llegada" value={recepcion.horaLlegada} />
          <ReadOnlyField label="Conductor" value={recepcion.conductor} />
          <ReadOnlyField label="Placa" value={recepcion.placa} />
          <ReadOnlyField label="Homologación" value={recepcion.homologacion} badgeVariant="emerald" />
        </div>
      </section>

      {/* Secciones editables: se bloquean si el rol no puede modificar */}
      <fieldset disabled={soloLectura} className="flex min-w-0 flex-col gap-4 disabled:opacity-80">
        {/* 1. Datos de recepción */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <SectionHeader number={1} title="Datos de recepción" />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReceptionSelect
              id="puerta"
              label="Puerta"
              value={puerta}
              onChange={(e) => setPuerta(e.target.value)}
              options={PUERTAS_ASIGNABLES.map((p) => ({ value: p, label: etiquetaPuerta(p) }))}
              required
            />
            <ReceptionSelect
              id="operario"
              label="Operario responsable"
              value={operario}
              onChange={(e) => setOperario(e.target.value)}
              options={OPERARIOS.map((o) => ({ value: o, label: o }))}
              required
            />
          </div>

          {/* Inicio y fin de descarga: toman la hora del sistema */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BotonHora
              titulo="Inicio de descarga"
              hora={horaInicioDescarga}
              onRegistrar={registrarInicioDescarga}
              deshabilitado={Boolean(horaInicioDescarga)}
              ayuda={horaInicioDescarga ? "Registrado" : "Presiona cuando empiece la descarga"}
            />
            <BotonHora
              titulo="Fin de descarga"
              hora={horaFin}
              onRegistrar={registrarFinDescarga}
              deshabilitado={Boolean(horaFin) || !horaInicioDescarga}
              ayuda={
                horaFin
                  ? `Registrado${duracionDescarga ? ` · duración ${duracionDescarga}` : ""}`
                  : horaInicioDescarga
                    ? "Presiona cuando termine la descarga"
                    : "Disponible después del inicio"
              }
            />
          </div>
          {permisos.editar && (horaInicioDescarga || horaFin) ? (
            <div className="mt-2 text-xs">
              <button
                type="button"
                onClick={corregirHoras}
                className="font-semibold text-[#F02615] underline underline-offset-2"
              >
                Corregir horas
              </button>
            </div>
          ) : null}
        </section>

        {/* 2. Incidencias */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <SectionHeader number={2} title="Incidencias" />

          <div className="mb-4 flex flex-wrap items-center gap-3" role="radiogroup" aria-label="¿Presenta incidencias?">
            <span className="text-sm font-bold text-slate-600 dark:text-zinc-300">¿Presenta incidencias?</span>
            {([false, true] as const).map((valor) => (
              <button
                key={String(valor)}
                type="button"
                role="radio"
                aria-checked={presentaIncidencias === valor}
                onClick={() => responderIncidencias(valor)}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
                  presentaIncidencias === valor
                    ? "bg-red-700 text-white"
                    : "border border-slate-300 bg-slate-200 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {valor ? "Sí" : "No"}
              </button>
            ))}
            {presentaIncidencias === false ? (
              <span className="text-xs text-fp-faint">Se registrará como “Sin rechazo”.</span>
            ) : null}
          </div>

          {presentaIncidencias && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {/* Tipo: lista editable por Supervisor y Administrador */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="tipo-incidencia" className="text-sm font-bold text-slate-600 dark:text-zinc-300">
                      Tipo <span className="text-red-500">*</span>
                    </label>
                    {permisos.editar ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGestionTipos((v) => !v);
                          setErrorTipo(null);
                        }}
                        className="text-xs font-semibold text-[#F02615] underline underline-offset-2"
                        aria-expanded={gestionTipos}
                      >
                        {gestionTipos ? "Cerrar" : "Editar tipos"}
                      </button>
                    ) : null}
                  </div>
                  <select
                    id="tipo-incidencia"
                    value={tipoIncidencia}
                    onChange={(e) => setTipoIncidencia(e.target.value)}
                    className={CAMPO}
                  >
                    <option value="">Seleccionar</option>
                    {tipos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* OC / SKU: OCs del proveedor según el Reporte IKF */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="oc-sku" className="text-sm font-bold text-slate-600 dark:text-zinc-300">
                    OC / SKU <span className="text-red-500">*</span>
                  </label>
                  {sinOcs ? (
                    <>
                      <input
                        id="oc-sku"
                        value={ocSku}
                        onChange={(e) => setOcSku(e.target.value.replace(/[^\w-]/g, ""))}
                        placeholder="Escribe la OC"
                        className={CAMPO}
                      />
                      <span className="text-xs text-[#c98f00]">
                        No hay OCs de este proveedor en el Reporte IKF cargado. Escríbela con cuidado.
                      </span>
                    </>
                  ) : (
                    <>
                      <select id="oc-sku" value={ocSku} onChange={(e) => setOcSku(e.target.value)} className={CAMPO}>
                        <option value="">Seleccionar OC</option>
                        {ocs.map((o) => (
                          <option key={o.oc} value={o.oc}>
                            OC {o.oc} · {o.unidades.toLocaleString("es-PE")} uds
                            {o.numeroCita ? ` · Cita ${o.numeroCita}` : ""}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                <ReceptionInput
                  id="cantidad-afectada"
                  label="Cantidad afectada"
                  value={cantidadAfectada}
                  onChange={(e) => setCantidadAfectada(e.target.value)}
                  type="number"
                  placeholder="0"
                  required
                />
                <ReceptionTextarea
                  id="descripcion"
                  label="Descripción"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  required
                />
              </div>

              {/* Gestión de tipos (Supervisor y Administrador) */}
              {gestionTipos && permisos.editar ? (
                <div className="rounded-xl border border-fp-line bg-fp-sunken p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-fp-faint">Tipos de incidencia</p>
                  <ul className="mb-3 flex flex-wrap gap-2">
                    {tipos.map((t) => (
                      <li
                        key={t}
                        className="inline-flex items-center gap-2 rounded-full border border-fp-line-strong bg-fp-surface py-1 pl-3 pr-1 text-sm text-fp-ink"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => eliminarTipo(t)}
                          aria-label={`Eliminar el tipo ${t}`}
                          className="inline-flex size-6 items-center justify-center rounded-full text-fp-faint transition hover:bg-[#F02615]/15 hover:text-[#F02615]"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-start gap-2">
                    <input
                      value={tipoNuevo}
                      onChange={(e) => {
                        setTipoNuevo(e.target.value);
                        setErrorTipo(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          agregarTipo();
                        }
                      }}
                      placeholder="Nuevo tipo, ej. Pallet mal armado"
                      aria-label="Nuevo tipo de incidencia"
                      className={`${CAMPO} max-w-xs`}
                    />
                    <button
                      type="button"
                      onClick={agregarTipo}
                      className="inline-flex h-11 items-center rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
                    >
                      Agregar tipo
                    </button>
                  </div>
                  {errorTipo ? <p className="mt-2 text-xs font-semibold text-[#F02615]">{errorTipo}</p> : null}
                </div>
              ) : null}

              <div className="flex gap-3">
                <ReceptionButton variant="outline" onClick={agregarIncidencia}>
                  <span className="text-red-700 dark:text-red-400">+</span> Añadir incidencia
                </ReceptionButton>
              </div>

              {recepcion.incidencias.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left">Tipo</th>
                        <th className="px-4 py-2 text-left">OC / SKU</th>
                        <th className="px-4 py-2 text-left">Cantidad</th>
                        <th className="px-4 py-2 text-left">Descripción</th>
                        <th className="px-4 py-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recepcion.incidencias.map((inc) => (
                        <tr key={inc.id} className="border-b border-slate-100 last:border-0 dark:border-zinc-800">
                          <td className="px-4 py-3 text-slate-700 dark:text-zinc-300">{inc.tipo}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-zinc-300">{inc.ocSku}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-zinc-300">{inc.cantidadAfectada}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-zinc-400">{inc.descripcion}</td>
                          <td className="px-4 py-3 text-center">
                            {permisos.eliminar ? (
                              <button
                                type="button"
                                onClick={() => eliminarIncidencia(inc.id)}
                                className="text-slate-500 transition-colors hover:text-red-500 dark:text-zinc-400"
                              >
                                Eliminar
                              </button>
                            ) : (
                              <span className="text-xs text-fp-faint">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. Resultado: solo cuando hay incidencias */}
        {presentaIncidencias ? (
          <section
            ref={seccionResultado}
            className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <SectionHeader number={3} title="Resultado" />

            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["sin-rechazo", "Sin rechazo"],
                  ["rechazo-parcial", "Rechazo parcial"],
                  ["rechazo-total", "Rechazo total"],
                ] as const
              ).map(([valor, texto]) => (
                <label key={valor} className="flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="radio"
                    name="resultado"
                    value={valor}
                    checked={resultado === valor}
                    onChange={() => setResultado(valor)}
                    className="text-red-600 focus:ring-red-600"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">{texto}</span>
                </label>
              ))}
            </div>


            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReceptionInput id="aceptadas" label="Aceptadas" value={aceptadas} onChange={(e) => setAceptadas(e.target.value)} type="number" placeholder="0" required />
              <ReceptionInput id="rechazadas" label="Rechazadas" value={rechazadas} onChange={(e) => setRechazadas(e.target.value)} type="number" placeholder="0" required />
              <ReceptionInput id="evaluadas" label="Evaluadas" value={evaluadas} onChange={(e) => setEvaluadas(e.target.value)} type="number" placeholder="0" required />
            </div>
          </section>
        ) : null}
      </fieldset>

      {/* Acciones: ambas vuelven a Gestión de recepción */}
      {soloLectura ? null : (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <ReceptionButton variant="secondary" onClick={handleGuardarAvance} disabled={guardando} loading={guardando}>
            Guardar avance
          </ReceptionButton>
          <ReceptionButton variant="primary" onClick={handleFinalizar} disabled={guardando} loading={guardando}>
            Finalizar recepción
          </ReceptionButton>
        </div>
      )}
    </div>
  );
}

/** Botón grande que registra la hora actual y la muestra una vez registrada. */
function BotonHora({
  titulo,
  hora,
  onRegistrar,
  deshabilitado,
  ayuda,
}: {
  titulo: string;
  hora: string | null;
  onRegistrar: () => void;
  deshabilitado: boolean;
  ayuda: string;
}) {
  const registrado = Boolean(hora);
  return (
    <button
      type="button"
      onClick={onRegistrar}
      disabled={deshabilitado}
      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition ${
        registrado
          ? "border-[#2FBF71]/45 bg-[#2FBF71]/10"
          : "border-[#F02615]/40 bg-[#F02615]/10 hover:bg-[#F02615]/15 disabled:border-fp-line disabled:bg-fp-surface disabled:hover:bg-fp-surface"
      } disabled:cursor-not-allowed`}
    >
      <span>
        <span className="block text-sm font-bold text-fp-ink">{titulo}</span>
        <span className="block text-xs text-fp-dim">{ayuda}</span>
      </span>
      <span
        className={`text-2xl font-extrabold tabular-nums ${registrado ? "text-[#1f9d5b]" : "text-fp-faint"}`}
        aria-label={registrado ? `${titulo}: ${hora}` : `${titulo}: sin registrar`}
      >
        {hora ?? "--:--"}
      </span>
    </button>
  );
}
