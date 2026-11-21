import type { Metadata } from "next";
import { PanelModulos } from "@/components/panel-modulos";

export const metadata: Metadata = {
  title: "Panel general",
  description: "Panel de módulos disponibles según tu rol.",
};

export default function DashboardPage() {
  return <PanelModulos />;
}
