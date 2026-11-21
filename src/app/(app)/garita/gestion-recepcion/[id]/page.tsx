import type { Metadata } from "next";
import { ReceptionDetailView } from "../reception-detail-view";

export const metadata: Metadata = {
  title: "Gestionar recepción",
  description: "Registra puerta, operario, incidencias y resultado de la recepción.",
};

export default async function ReceptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReceptionDetailView receptionId={id} />;
}
