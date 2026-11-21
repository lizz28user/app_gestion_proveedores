"use client";

import Link from "next/link";
import { NAVES, numeroDePuerta, puertaInactiva, puertasDeNave, type NaveId, type Reception } from "./types";

type Etapa = { texto: string; paso: 1 | 2 | 3; ocupada: boolean };

/**
 * Etapa según los botones de la descarga:
 * puerta asignada = Reservada; con inicio de descarga = Ocupada.
 */
function etapaDe(r: Reception): Etapa {
  if (r.horaFin) return { texto: "Terminó de descargar", paso: 3, ocupada: true };
  if (r.horaInicioDescarga) return { texto: "Descargando", paso: 2, ocupada: true };
  return { texto: "Esperando descarga", paso: 1, ocupada: false };
}

function unidades(valor: string | undefined): string | null {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? `${Math.round(n).toLocaleString("es-PE")} uds` : null;
}

const base =
  "flex min-h-[84px] flex-col rounded-lg border p-2.5 transition-[background-color,border-color,box-shadow]";

/**
 * Mapa de puertas del día, por nave. Colores: verde libre, amarillo reservada,
 * rojo ocupada y gris con rayas y candado inactiva.
 */
export function MapaPuertas({ recepciones, nave }: { recepciones: Reception[]; nave: NaveId }) {
  const naveActual = NAVES.find((n) => n.id === nave) ?? NAVES[0];
  const puertas = puertasDeNave(naveActual);

  const enMuelle = new Map<string, Reception>();
  const atendidas = new Map<string, number>();
  for (const r of recepciones) {
    if (!r.puerta) continue;
    if (r.estado === "finalizada") {
      atendidas.set(r.puerta, (atendidas.get(r.puerta) ?? 0) + 1);
    } else {
      const actual = enMuelle.get(r.puerta);
      // Si hubiera dos en la misma puerta, se muestra la más reciente.
      if (!actual || r.updatedAt > actual.updatedAt) enMuelle.set(r.puerta, r);
    }
  }

  const inactivas = puertas.filter(puertaInactiva).length;
  let ocupadas = 0;
  let reservadas = 0;
  for (const p of puertas) {
    const r = enMuelle.get(p);
    if (!r) continue;
    if (etapaDe(r).ocupada) ocupadas += 1;
    else reservadas += 1;
  }
  const libres = puertas.length - inactivas - ocupadas - reservadas;

  const resumen = [
    { n: libres, texto: "libres", color: "#2FBF71" },
    { n: reservadas, texto: "reservadas", color: "#FAB701" },
    { n: ocupadas, texto: "ocupadas", color: "#F02615" },
    ...(inactivas > 0 ? [{ n: inactivas, texto: "inactivas", color: "#76797B" }] : []),
  ];

  return (
    <section aria-labelledby="mapa-puertas-titulo" className="glass rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="mapa-puertas-titulo" className="text-sm font-extrabold uppercase tracking-[0.14em] text-fp-ink">
          Mapa de puertas · {naveActual.nombre}
          <span className="ml-2 text-xs font-semibold normal-case tracking-normal text-fp-faint">
            P{String(naveActual.desde).padStart(2, "0")} a P{String(naveActual.hasta).padStart(2, "0")}
          </span>
        </h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold tabular-nums text-fp-dim">
          {resumen.map((x) => (
            <li key={x.texto} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rotate-45 rounded-[2px]" style={{ backgroundColor: x.color }} />
              <span className="text-fp-ink">{x.n}</span> {x.texto}
            </li>
          ))}
        </ul>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-10">
        {puertas.map((puerta) => {
          const r = enMuelle.get(puerta);
          const hechas = atendidas.get(puerta) ?? 0;
          const numero = String(numeroDePuerta(puerta)).padStart(2, "0");

          // Puertas inactivas: rayas y candado.
          if (puertaInactiva(puerta)) {
            return (
              <li
                key={puerta}
                aria-label={`Puerta ${numero}: inactiva`}
                title="Inactiva (temporal)"
                className={`${base} border-fp-line bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(118,121,123,0.22)_6px_8px)] opacity-80`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xl font-black tabular-nums text-fp-faint">{numero}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-fp-dim" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </div>
                <p className="mt-auto text-[11px] font-bold text-fp-dim">Inactiva</p>
              </li>
            );
          }

          // Puertas libres.
          if (!r) {
            return (
              <li
                key={puerta}
                aria-label={`Puerta ${numero}: libre`}
                className={`${base} border-[#2FBF71]/50 bg-gradient-to-br from-[#2FBF71]/20 to-[#2FBF71]/5`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xl font-black tabular-nums text-fp-ink">{numero}</span>
                  <span aria-hidden="true" className="mt-1 size-2.5 rotate-45 rounded-[2px] bg-[#2FBF71] shadow-[0_0_8px_rgba(47,191,113,0.7)]" />
                </div>
                <p className="mt-auto text-[11px] font-bold text-[#1f9d5b]">Libre</p>
                {hechas > 0 ? (
                  <p className="text-[10px] font-semibold tabular-nums text-fp-faint">
                    {hechas} atendida{hechas === 1 ? "" : "s"}
                  </p>
                ) : null}
              </li>
            );
          }

          // Reservada (amarillo) u ocupada (rojo FP).
          const etapa = etapaDe(r);
          const uds = unidades(r.unidadesEstimadas);
          const detalle = [r.proveedor, uds, r.operarioResponsable, `desde ${r.horaInicioDescarga ?? r.horaLlegada}`]
            .filter(Boolean)
            .join(" · ");
          const estilo = etapa.ocupada
            ? "border-[#F02615]/70 bg-gradient-to-br from-[#F02615]/30 to-[#B32515]/10 shadow-[0_0_16px_-4px_rgba(240,38,21,0.55)] hover:border-[#F02615]"
            : "border-[#FAB701]/70 bg-gradient-to-br from-[#FAB701]/25 to-[#FAB701]/5 hover:border-[#FAB701]";
          const acento = etapa.ocupada ? "#F02615" : "#FAB701";

          return (
            <li key={puerta}>
              <Link
                href={`/garita/gestion-recepcion/${r.id}`}
                title={detalle}
                aria-label={`Puerta ${numero}: ${etapa.ocupada ? "ocupada" : "reservada"}, ${r.proveedor}, ${etapa.texto}. Gestionar recepción`}
                className={`${base} ${estilo} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F02615]`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xl font-black tabular-nums text-fp-ink">{numero}</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 size-2.5 rotate-45 rounded-[2px]"
                    style={{ backgroundColor: acento, boxShadow: `0 0 8px ${acento}` }}
                  />
                </div>
                <p className="mt-auto truncate text-[11px] font-bold leading-tight text-fp-ink">{r.proveedor}</p>
                <div
                  className="mt-1 h-1 overflow-hidden rounded-full bg-fp-track"
                  role="progressbar"
                  aria-label="Avance de la descarga"
                  aria-valuemin={0}
                  aria-valuemax={3}
                  aria-valuenow={etapa.paso}
                  aria-valuetext={etapa.texto}
                >
                  <div className="h-full rounded-full" style={{ width: `${(etapa.paso / 3) * 100}%`, backgroundColor: acento }} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
