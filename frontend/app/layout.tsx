import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CSV Coverage Grid Converter",
  description: "Convert CSV coordinates into 153 meter KML or GeoPackage coverage grids.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
