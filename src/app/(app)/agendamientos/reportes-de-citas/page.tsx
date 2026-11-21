import type { Metadata } from "next";
import { ReportesCitasView } from "./reportes-citas-view";

export const metadata: Metadata = { title: "Reportes de citas" };

export default function ReportesDeCitasPage() {
  return <ReportesCitasView />;
}
