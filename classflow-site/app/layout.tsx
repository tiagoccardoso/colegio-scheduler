import type { Metadata } from 'next'
import './globals.css'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: {
    default: 'ClassFlow — Gestão acadêmica escolar com IA',
    template: '%s — ClassFlow',
  },
  description:
    'Plataforma de gestão acadêmica com IA para organizar cadastros, matriz curricular, grade, Novo Ensino Médio, jornada do aluno, documentos e relatórios escolares.',
  metadataBase: new URL('https://classflow.site'),
  openGraph: {
    title: 'ClassFlow',
    description:
      'Organize a operação acadêmica da escola com IA: cadastros, grade, conformidade curricular, acompanhamento do aluno, documentos e relatórios.',
    type: 'website',
  },
  icons: [{ rel: 'icon', url: '/favicon.svg' }],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
