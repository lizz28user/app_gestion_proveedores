"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ARRIVAL_STATUS_OPTIONS,
  HOMOLOGATION_OPTIONS,
  type Arrival,
  type ArrivalRow,
  type ArrivalStatus,
  type HomologationStatus,
} from "./arrivals-data";
import type { ProviderMaster } from "./providers-data";
import { computeArrivalStatus, todayIso, normalizeText, getArrivalStatusBadge } from "@/lib/utils";
import {
  AwardIcon,
  BuildingIcon,
  CalendarIcon,
  ChevronDownIcon,
  CheckIcon,
  ClockIcon,
  IdCardIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";

const arrivalFormSchema = z.object({
  ruc: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "El RUC debe tener 11 dígitos numéricos."),
  proveedor: z
    .string()
    .trim()
    .min(1, "Ingresa la razón social del proveedor."),
  fecha: z.string().min(1, "Selecciona la fecha de llegada."),
  hora: z.string().min(1, "Selecciona la hora de llegada."),
  horaSolicitada: z.string().min(1, "Selecciona la hora solicitada."),
  estadoLlegada: z.string().min(1, "Selecciona el estado de llegada."),
  homologacion: z.string().min(1, "Selecciona el estado de homologación."),
  conductor: z.string().trim().min(1, "Ingresa el nombre del conductor."),
  licencia: z.string().trim().min(1, "Ingresa el número de licencia."),
  placa: z.string().trim().optional(),
  unidadesEstimadas: z.string().trim().optional(),
});

type ArrivalFormValues = z.infer<typeof arrivalFormSchema>;

const inputClasses =
  "h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus-visible:border-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/20 aria-invalid:border-red-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus-visible:border-red-500 dark:aria-invalid:border-red-500";

type ArrivalFormModalProps = {
  providers: ProviderMaster[];
  scheduledHours: Record<string, string>;
  initialValues?: ArrivalRow | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (arrival: Arrival) => void;
};

export function ArrivalFormModal({
  providers,
  scheduledHours,
  initialValues,
  isSaving,
  onClose,
  onSave,
}: ArrivalFormModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ArrivalFormValues>({
    resolver: zodResolver(arrivalFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      ruc: "",
      proveedor: "",
      fecha: todayIso(),
      hora: `${todayIso()}T00:00`,
      horaSolicitada: "",
      estadoLlegada: "",
      homologacion: "",
      conductor: "",
      licencia: "",
      placa: "",
      unidadesEstimadas: "",
    },
  });

  const rucValue = watch("ruc");
  const horaValue = watch("hora");
  const horaSolicitadaValue = watch("horaSolicitada");

  const providerByRuc = useMemo(() => {
    const map = new Map<string, ProviderMaster>();
    for (const provider of providers) {
      map.set(provider.ruc, provider);
    }
    return map;
  }, [providers]);

  const suggestions = useMemo(() => {
    if (isEditing) {
      return [];
    }

    const term = normalizeText(rucValue.trim());

    if (term.length < 2) {
      return [];
    }

    return providers
      .filter(
        (provider) =>
          normalizeText(provider.ruc).includes(term) ||
          normalizeText(provider.nombre).includes(term),
      )
      .slice(0, 8);
  }, [providers, rucValue, isEditing]);

  useEffect(() => {
    if (!initialValues) {
      return;
    }

    setIsEditing(true);
    setValue("ruc", initialValues.ruc, { shouldDirty: true, shouldValidate: false });
    setValue("proveedor", initialValues.proveedor, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("fecha", initialValues.fecha ?? todayIso(), {
      shouldDirty: false,
      shouldValidate: false,
    });
    setValue("hora", initialValues.llegada ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("horaSolicitada", initialValues.horaSolicitada ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("estadoLlegada", initialValues.estadoLlegada ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("homologacion", initialValues.homologacion ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("conductor", initialValues.conductor ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("licencia", initialValues.licencia ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue("placa", initialValues.placa ?? "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue(
      "unidadesEstimadas",
      initialValues.unidadesEstimadas ?? "",
      { shouldDirty: true, shouldValidate: false },
    );
  }, [initialValues]);

  // Calcular estado de llegada automáticamente al cambiar hora o hora solicitada
  useEffect(() => {
    if (!horaValue || !horaSolicitadaValue) {
      return;
    }

    setValue("estadoLlegada", computeArrivalStatus(horaValue, horaSolicitadaValue), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [horaValue, horaSolicitadaValue, setValue]);

  useEffect(() => {
    const panel = panelRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const first = panel?.querySelector<HTMLElement>(focusableSelector);
    first?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panel) {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        return;
      }

      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  function applyProvider(provider: ProviderMaster) {
    clearErrors("ruc");
    setValue("ruc", provider.ruc, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("proveedor", provider.nombre, {
      shouldDirty: true,
      shouldValidate: true,
    });

    const scheduled = scheduledHours[provider.ruc];

    if (scheduled) {
      setValue("horaSolicitada", scheduled, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setLookupMessage(
        `Proveedor agendado hoy a las ${scheduled}. Estado de llegada calculado automáticamente.`,
      );
    } else {
      setLookupMessage(
        "Proveedor encontrado en el maestro, pero sin cita agendada para hoy.",
      );
    }

    setSuggestionsOpen(false);
  }

  function handleLookup() {
    const ruc = getValues("ruc").trim();

    if (!/^\d{11}$/.test(ruc)) {
      setError("ruc", {
        type: "manual",
        message: "Ingresa un RUC de 11 dígitos para buscar.",
      });
      setLookupMessage(null);
      return;
    }

    const provider = providerByRuc.get(ruc);

    if (provider) {
      applyProvider(provider);
      return;
    }

    setLookupMessage(
      "No encontramos ese RUC en el maestro. Puedes ingresar la razón social manualmente.",
    );
  }

  function onSubmit(values: ArrivalFormValues) {
    onSave({
      ruc: values.ruc.trim(),
      proveedor: values.proveedor.trim(),
      fecha: values.fecha,
      horaSolicitada: values.horaSolicitada,
      unidadesEstimadas: (values.unidadesEstimadas ?? "").trim(),
      llegada: values.hora,
      estadoLlegada: values.estadoLlegada as ArrivalStatus,
      conductor: values.conductor.trim(),
      licencia: values.licencia.trim(),
      placa: (values.placa ?? "").trim(),
      homologacion: values.homologacion as HomologationStatus,
    });
  }

  const rucField = register("ruc");
  const fechaField = register("fecha");
  const horaField = register("hora");
  const horaSolicitadaField = register("horaSolicitada");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="arrival-form-title"
        className="relative my-4 w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:my-0 sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="arrival-form-title"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50"
          >
            Registrar llegada
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:ring-offset-zinc-900"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit(onSubmit)}
          className="mt-5 flex flex-col gap-6"
        >
          <SectionTitle>Datos del proveedor</SectionTitle>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="ruc" icon={<BuildingIcon />}>
                RUC
              </FieldLabel>

              <div className="relative">
                <input
                  id="ruc"
                  type="text"
                  autoComplete="off"
                  placeholder="Busca por RUC o nombre"
                  readOnly={isEditing}
                  aria-invalid={errors.ruc ? true : undefined}
                  aria-describedby={errors.ruc ? "ruc-error" : "ruc-help"}
                  aria-expanded={suggestionsOpen && suggestions.length > 0}
                  aria-controls="provider-suggestions"
                  aria-autocomplete="list"
                  role="combobox"
                  className={`${inputClasses} pr-16`}
                  {...rucField}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={(event) => {
                    rucField.onBlur(event);
                    window.setTimeout(() => setSuggestionsOpen(false), 120);
                  }}
                />
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={isEditing}
                  aria-label="Buscar proveedor por RUC"
                  className="absolute inset-y-1 right-1 inline-flex w-12 items-center justify-center rounded-md bg-red-700 text-white transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 dark:bg-red-700 dark:hover:bg-red-600 dark:focus-visible:ring-offset-zinc-950"
                >
                  <SearchIcon className="size-5" />
                </button>

                {suggestionsOpen && suggestions.length > 0 ? (
                  <ul
                    id="provider-suggestions"
                    role="listbox"
                    className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {suggestions.map((provider) => (
                      <li key={provider.ruc} role="option" aria-selected="false">
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyProvider(provider)}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-red-50 focus-visible:bg-red-50 focus-visible:outline-none dark:hover:bg-red-500/10 dark:focus-visible:bg-red-500/10"
                        >
                          <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                            {provider.nombre}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-zinc-400">
                            RUC {provider.ruc}
                            {scheduledHours[provider.ruc]
                              ? ` · Agendado ${scheduledHours[provider.ruc]}`
                              : " · Sin cita hoy"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <p
                id="ruc-help"
                className="text-xs text-slate-500 dark:text-zinc-400"
              >
                Escribe RUC o nombre para ver sugerencias del maestro.
              </p>

              {lookupMessage ? (
                <p
                  aria-live="polite"
                  className="text-xs text-emerald-700 dark:text-emerald-400"
                >
                  {lookupMessage}
                </p>
              ) : null}

              {errors.ruc ? (
                <p
                  id="ruc-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.ruc.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="fecha" icon={<CalendarIcon className="size-5" />}>
                Fecha
              </FieldLabel>
              <input
                id="fecha"
                type="date"
                aria-invalid={errors.fecha ? true : undefined}
                aria-describedby={errors.fecha ? "fecha-error" : undefined}
                className={inputClasses}
                {...fechaField}
                ref={(element) => {
                  fechaField.ref(element);
                  dateRef.current = element;
                }}
              />
              {errors.fecha ? (
                <p
                  id="fecha-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.fecha.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="proveedor" icon={<UsersIcon />}>
                Nombre del proveedor
              </FieldLabel>
              <input
                id="proveedor"
                type="text"
                placeholder="Razón social del proveedor"
                aria-invalid={errors.proveedor ? true : undefined}
                aria-describedby={
                  errors.proveedor ? "proveedor-error" : undefined
                }
                className={inputClasses}
                {...register("proveedor")}
              />
              {errors.proveedor ? (
                <p
                  id="proveedor-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.proveedor.message}
                </p>
              ) : null}
            </div>
          </div>

          <SectionTitle>Datos de llegada</SectionTitle>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-zinc-100">
                <ClockIcon className="size-5" />
                Llegada (Hora)
              </span>

              <div className="flex h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 shadow-sm transition-colors focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-red-500">
                <input
                  type="time"
                  aria-label="Hora de llegada"
                  aria-invalid={errors.hora ? true : undefined}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none [&::-webkit-calendar-picker-indicator]:hidden dark:text-zinc-100 dark:[color-scheme:dark]"
                  {...horaField}
                  ref={(element) => {
                    horaField.ref(element);
                    timeRef.current = element;
                  }}
                />
                <span
                  aria-hidden="true"
                  className="h-6 w-px bg-slate-300 dark:bg-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => openPicker(timeRef.current)}
                  aria-label="Abrir selector de hora"
                  className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <ClockIcon className="size-4" />
                </button>
              </div>

              {errors.hora ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {errors.hora.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel
                htmlFor="horaSolicitada"
                icon={<ClockIcon className="size-5" />}
              >
                Hora solicitada
              </FieldLabel>
              <div className="flex h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 shadow-sm transition-colors focus-within:border-red-600 focus-within:ring-2 focus-within:ring-red-600/20 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-within:border-red-500">
                <input
                  id="horaSolicitada"
                  type="time"
                  aria-invalid={errors.horaSolicitada ? true : undefined}
                  aria-describedby={
                    errors.horaSolicitada
                      ? "hora-solicitada-error"
                      : "hora-solicitada-help"
                  }
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none [&::-webkit-calendar-picker-indicator]:hidden dark:text-zinc-100 dark:[color-scheme:dark]"
                  {...horaSolicitadaField}
                />
              </div>

              <p
                id="hora-solicitada-help"
                className="text-xs text-slate-500 dark:text-zinc-400"
              >
                Se completa con la primera cita del proveedor en el reporte.
              </p>

              {errors.horaSolicitada ? (
                <p
                  id="hora-solicitada-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.horaSolicitada.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel
                htmlFor="estadoLlegada"
                icon={<ClockIcon className="size-5" />}
              >
                Estado de llegada
              </FieldLabel>

              <div className="relative">
                <select
                  id="estadoLlegada"
                  disabled
                  aria-invalid={errors.estadoLlegada ? true : undefined}
                  aria-describedby={
                    errors.estadoLlegada
                      ? "estado-llegada-error"
                      : "estado-llegada-help"
                  }
                  className={`${inputClasses} appearance-none pr-10 opacity-50 cursor-not-allowed`}
                  {...register("estadoLlegada")}
                >
                  <option value="">Seleccionar estado</option>
                  {ARRIVAL_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400" />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Estado calculado:
                </span>
                {(() => {
                  const badge = getArrivalStatusBadge(horaValue, horaSolicitadaValue);
                  return (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
                    >
                      {badge.status}
                    </span>
                  );
                })()}
              </div>

              <p
                id="estado-llegada-help"
                className="text-xs text-slate-500 dark:text-zinc-400"
              >
                Se calcula automáticamente comparando la llegada con la hora
                solicitada (tolerancia de 15 min).
              </p>

              {errors.estadoLlegada ? (
                <p
                  id="estado-llegada-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.estadoLlegada.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="homologacion" icon={<AwardIcon />}>
                Homologación
              </FieldLabel>

              <div className="relative">
                <select
                  id="homologacion"
                  aria-invalid={errors.homologacion ? true : undefined}
                  aria-describedby={
                    errors.homologacion
                      ? "homologacion-error"
                      : "homologacion-help"
                  }
                  className={`${inputClasses} appearance-none pr-10`}
                  {...register("homologacion")}
                >
                  <option value="">Seleccionar estado</option>
                  {HOMOLOGATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-zinc-400" />
              </div>

              <p
                id="homologacion-help"
                className="text-xs text-slate-500 dark:text-zinc-400"
              >
                Vigente / Vencida / No homologado
              </p>

              {errors.homologacion ? (
                <p
                  id="homologacion-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.homologacion.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="unidadesEstimadas" icon={<ClockIcon className="size-5" />}>
                Unidades estimadas
              </FieldLabel>
              <input
                id="unidadesEstimadas"
                type="text"
                inputMode="numeric"
                placeholder="0"
                aria-invalid={errors.unidadesEstimadas ? true : undefined}
                aria-describedby={
                  errors.unidadesEstimadas ? "unidades-estimadas-error" : undefined
                }
                className={inputClasses}
                {...register("unidadesEstimadas")}
              />
              <p
                id="unidades-estimadas-help"
                className="text-xs text-slate-500 dark:text-zinc-400"
              >
                Del reporte de citas IKF
              </p>
              {errors.unidadesEstimadas ? (
                <p
                  id="unidades-estimadas-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.unidadesEstimadas.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="conductor" icon={<UserIcon />}>
                Nombre del conductor
              </FieldLabel>
              <input
                id="conductor"
                type="text"
                placeholder="Nombres y apellidos"
                aria-invalid={errors.conductor ? true : undefined}
                aria-describedby={
                  errors.conductor ? "conductor-error" : undefined
                }
                className={inputClasses}
                {...register("conductor")}
              />
              {errors.conductor ? (
                <p
                  id="conductor-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.conductor.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="licencia" icon={<IdCardIcon />}>
                Licencia
              </FieldLabel>
              <input
                id="licencia"
                type="text"
                placeholder="Número de licencia"
                aria-invalid={errors.licencia ? true : undefined}
                aria-describedby={
                  errors.licencia ? "licencia-error" : undefined
                }
                className={inputClasses}
                {...register("licencia")}
              />
              {errors.licencia ? (
                <p
                  id="licencia-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.licencia.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="placa" icon={<BuildingIcon />}>
                Placa
              </FieldLabel>
              <input
                id="placa"
                type="text"
                placeholder="Placa del vehículo"
                aria-invalid={errors.placa ? true : undefined}
                className={inputClasses}
                {...register("placa")}
              />
              {errors.placa ? (
                <p
                  id="placa-error"
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {errors.placa.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-1 flex flex-col gap-4 border-t border-slate-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-red-700 px-5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-red-500 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus-visible:ring-offset-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
              >
                {isSaving ? (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    >
                      <path d="M21 12a9 9 0 11-6.24 1.55L18 10.28" />
                    </svg>
                    Guardando…
                  </>
                ) : (
                  <>
                    <CheckIcon className="size-4" />
                    {isEditing ? "Guardar cambios" : "Registrar llegada"}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-4">
      <h3 className="shrink-0 text-base font-bold text-slate-900 dark:text-zinc-50">
        {children}
      </h3>
      <span
        aria-hidden="true"
        className="h-px flex-1 bg-slate-300 dark:bg-zinc-700"
      />
    </div>
  );
}

function FieldLabel({
  htmlFor,
  icon,
  children,
}: {
  htmlFor: string;
  icon: React.ReactNode;
  children: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-zinc-100"
    >
      <span aria-hidden="true" className="text-slate-800 dark:text-zinc-200">
        {icon}
      </span>
      {children}
    </label>
  );
}

function openPicker(input: HTMLInputElement | null) {
  if (!input) {
    return;
  }

  try {
    input.showPicker();
  } catch {
    input.focus();
  }
}
