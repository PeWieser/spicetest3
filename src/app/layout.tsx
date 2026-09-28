import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "CircuitBench - Electronic Circuit Design & Simulation",
  description: "Professional electronic circuit schematic editor with SPICE simulation, oscilloscope, function generator, and analysis tools.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}