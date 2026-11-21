import type { Metadata } from "next";
import { CatalogoView } from "./catalogo-view";

export const metadata: Metadata = { title: "Catálogo de productos" };

export default function CatalogoDeProductosPage() {
  return <CatalogoView />;
}
