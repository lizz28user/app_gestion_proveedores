import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión",
  description:
    "SIRA, Sistema Integral de Recepción y Abastecimiento de Farmacias Peruanas · Punta Negra.",
};

type IconoProps = { className?: string };

function GaritaIcon({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 42V22l8-5 8 5v20M6 42h16M10 42V30h8v12" />
      <path d="M28 42V26h12v16M24 42h20" />
      <path d="M8 16 40 8M36 9l-1.5 5" />
    </svg>
  );
}

function CajaIcon({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m24 6 16 8v20L24 42 8 34V14l16-8Z" />
      <path d="m8 14 16 8 16-8M24 22v20M16 10l16 8" />
    </svg>
  );
}

function CalendarioIcon({ className }: IconoProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M38 24V12a3 3 0 0 0-3-3H11a3 3 0 0 0-3 3v26a3 3 0 0 0 3 3h13M14 6v6M32 6v6M8 18h30" />
      <circle cx="35" cy="35" r="8" />
      <path d="M35 31v4.5l3 1.5" />
    </svg>
  );
}

const FUNCIONES = [
  {
    titulo: "Garita",
    texto: "Control de acceso y validación documental corporativa.",
    icono: GaritaIcon,
  },
  {
    titulo: "Recepción",
    texto: "Control de calidad en descarga y gestión de contingencias.",
    icono: CajaIcon,
  },
  {
    titulo: "Agendamiento",
    texto: "Sincronización de tiempos y optimización de flujos de trabajo.",
    icono: CalendarioIcon,
  },
];

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-screen overflow-hidden bg-[#10131a]">
      {/* Fotografía del centro de distribución a pantalla completa */}
      <div aria-hidden="true" className="fixed inset-0 -z-20 overflow-hidden">
      <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/sira-fondo.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center lg:inset-auto lg:left-0 lg:top-1/2 lg:-ml-[13%] lg:h-auto lg:w-[113%] lg:max-w-none lg:-translate-y-1/2"
      />
      </div>
      </div>
      {/* Degradado oscuro sutil: lado del formulario y base de los textos */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-black/35 bg-[linear-gradient(90deg,rgba(8,10,16,0)_0%,rgba(8,10,16,0)_62%,rgba(8,10,16,0.5)_100%),linear-gradient(0deg,rgba(8,10,16,0.6)_0%,rgba(8,10,16,0)_42%)] lg:bg-transparent"
      />

      {/* Curvas rojas y blancas de la identidad corporativa */}
      <svg
        aria-hidden="true"
        viewBox="0 0 420 200"
        className="pointer-events-none absolute left-0 top-0 -z-10 w-[min(62vw,400px)]"
      >
        <path d="M0 0H380C330 46 238 100 128 122C74 133 32 154 0 182Z" fill="#E0230F" />
        <path d="M0 182C32 154 74 133 128 122C238 100 330 46 380 0H404C352 52 252 112 138 136C86 147 40 170 0 204Z" fill="#fff" opacity="0.92" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 1600 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[9vh] min-h-[56px] w-full"
      >
        <path d="M0 160V76C380 134 900 124 1600 24V160Z" fill="#E0230F" />
        <path d="M0 76C380 134 900 124 1600 24V10C900 110 380 120 0 62Z" fill="#fff" opacity="0.92" />
      </svg>

      {/* Logo de Farmacias Peruanas, sobre la curva roja */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-fp-blanco.svg"
        alt="Farmacias Peruanas"
        className="absolute left-5 top-4 z-10 h-9 w-auto sm:left-8 sm:top-5 sm:h-11"
      />

      <div className="relative grid w-full items-stretch gap-10 px-5 pb-20 pt-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,410px)] lg:gap-8 lg:pb-16 lg:pt-10">
        {/* Eslogan y funciones: abajo, para dejar a la vista el letrero del almacén */}
        <section className="order-2 flex flex-col justify-end gap-8 lg:order-1 lg:min-h-[80vh]">
          <h2 className="text-[clamp(1.9rem,3vw,2.7rem)] font-extrabold italic leading-[1.05] tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.5)]">
            Cada entrega,
            <span className="ml-3 inline-block -skew-x-6 bg-[#E0230F] px-4 py-0.5 not-italic shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]">
              bajo control.
            </span>
          </h2>

          <ul className="grid max-w-[700px] grid-cols-1 gap-x-3 gap-y-9 pt-5 sm:grid-cols-3">
            {FUNCIONES.map((f) => {
              const Icono = f.icono;
              return (
                <li
                  key={f.titulo}
                  className="group relative flex flex-col items-center rounded-2xl border border-white/20 bg-[#16181c]/60 px-3 pb-4 pt-9 text-center backdrop-blur-sm transition duration-200 hover:-translate-y-1 hover:border-white/40 hover:bg-[#16181c]/75"
                >
                  <span className="absolute -top-6 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#F02615] to-[#a3180c] text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-105">
                    <Icono className="size-7" />
                  </span>
                  <span className="text-base font-bold text-white">{f.titulo}</span>
                  <span className="mt-1 text-[12.5px] leading-snug text-white/85">
                    {f.texto}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-3 h-[2px] w-12 rounded-full bg-[#F02615]"
                  />
                </li>
              );
            })}
          </ul>
        </section>

        {/* Panel de acceso */}
        <section className="relative order-1 mx-auto w-full max-w-[410px] self-center overflow-hidden rounded-[28px] border border-white/20 bg-[#1c1e22]/65 p-6 shadow-[0_0_0_1px_rgba(240,38,21,0.28),0_24px_60px_-24px_rgba(0,0,0,0.65)] backdrop-blur-lg sm:p-8 lg:order-2 lg:justify-self-end">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#F02615] via-[#F02615]/60 to-transparent"
          />

          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/sira-logo-cromo.png"
              alt="SIRA"
              className="w-[52%] max-w-[190px]"
            />
            <p className="border-l-2 border-[#F02615] pl-3 text-[13px] font-semibold leading-snug text-white">
              Sistema Integral de Recepción y Abastecimiento
            </p>
          </div>

          <header className="mt-5 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-5 shrink-0 rotate-45 rounded-[5px] bg-gradient-to-br from-[#ff4a37] to-[#B32515]"
            />
            <h1 className="text-[22px] font-extrabold tracking-tight text-white sm:text-[25px]">
              Accede con tu usuario
            </h1>
          </header>

          <div className="mt-5">
            <LoginForm />
          </div>

          <p className="mt-5 flex items-center justify-center gap-2 border-t border-white/10 pt-4 text-xs text-white/70">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-4 text-[#F02615]"
            >
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            Plataforma de recepción - Punta Negra
          </p>
        </section>
      </div>
    </main>
  );
}
