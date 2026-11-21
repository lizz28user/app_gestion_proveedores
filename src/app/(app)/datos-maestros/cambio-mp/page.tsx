import type { Metadata } from "next";
import { CambioMpView } from "./cambio-mp-view";

export const metadata: Metadata = { title: "Cambio MP" };

export default function CambioMpPage() {
  return <CambioMpView />;
}
