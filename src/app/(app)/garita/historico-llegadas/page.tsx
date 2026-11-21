import type { Metadata } from "next";
import { HistoricoView } from "./historico-view";

export const metadata: Metadata = {
  title: "Histórico de llegadas",
  description: "Consulta el historial de llegadas de proveedores registradas.",
};

export default function HistoricoPage() {
  return <HistoricoView />;
}
