import type { Metadata } from "next";
import { IncidenciasView } from "./incidencias-view";

export const metadata: Metadata = {
  title: "Incidencias de proveedores",
  description: "Registro y seguimiento de incidencias de proveedores.",
};

export default function IncidenciasProveedoresPage() {
  return <IncidenciasView />;
}
