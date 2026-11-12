import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ricette · Recipe Studio",
  description: "Uno spazio semplice e flessibile per organizzare le ricette della tua cucina."
};

export const viewport: Viewport = { themeColor: "#f7f7f3", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
