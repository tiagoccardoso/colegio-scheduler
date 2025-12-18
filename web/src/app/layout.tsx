import "./globals.css";

import type { ReactNode } from "react";

export const metadata = {
  title: "Colégio Scheduler",
  description: "Painel do diretor e app do professor",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
