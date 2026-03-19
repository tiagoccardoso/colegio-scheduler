import "./globals.css";

import type { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "ClassFlow",
  description: "Gestão acadêmica escolar com IA",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
