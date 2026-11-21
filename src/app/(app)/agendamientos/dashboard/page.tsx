import type { Metadata } from "next";
import { AgendaDashboard } from "./agenda-dashboard";
import { HorarioHoraHora } from "@/components/agenda/horario-hora-hora";

export const metadata: Metadata = {
  title: "Dashboard · Agenda",
  description: "Resumen de la agenda diaria de proveedores.",
};

export default function AgendaDashboardPage() {
  return (
    <AgendaDashboard pie={<HorarioHoraHora />} />
  );
}
