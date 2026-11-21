import type { Metadata } from "next";
import { ReceptionListView } from "./reception-list-view";

export const metadata: Metadata = {
  title: "Gestión de recepción",
  description: "Gestiona la recepción de proveedores según los registros de llegada.",
};

export default function ReceptionPage() {
  return <ReceptionListView />;
}
