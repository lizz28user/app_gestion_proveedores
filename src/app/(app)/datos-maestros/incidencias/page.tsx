import type { Metadata } from "next";
import { IncidenciasMaestrosView } from "./incidencias-maestros-view";

export const metadata: Metadata = { title: "Incidencias de datos maestros" };

export default function IncidenciasDatosMaestrosPage() {
  return <IncidenciasMaestrosView />;
}
