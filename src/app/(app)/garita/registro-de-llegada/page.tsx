import type { Metadata } from "next";
import { ArrivalsView } from "./arrivals-view";

export const metadata: Metadata = {
  title: "Llegadas del día",
  description:
    "Consulta los registros de llegada de proveedores guardados durante la jornada.",
};

export default function ArrivalsPage() {
  return <ArrivalsView />;
}
