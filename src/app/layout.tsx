import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { temaInitScript } from "@/lib/tema";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SIRA · Punta Negra",
    template: "%s | SIRA · Punta Negra",
  },
  description:
    "SIRA, Sistema Integral de Recepción y Abastecimiento de Farmacias Peruanas en Punta Negra: citas, llegadas y recepción de proveedores.",
  applicationName: "SIRA",
};

export const viewport: Viewport = {
  themeColor: "#181920",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Tema por defecto: Negro. El script de <head> aplica el tema guardado (Negro o Gris).
    <html lang="es" className="fp theme-negro dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
