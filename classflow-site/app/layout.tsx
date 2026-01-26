import type { Metadata } from 'next'
import './globals.css'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: {
    default: 'ClassFlow — Grade escolar com ajuda da IA',
    template: '%s — ClassFlow',
  },
  description: 'A inteligência artificial auxilia na organização das regras da escola e monta automaticamente uma grade de horários sem conflitos.',
  metadataBase: new URL('https://classflow.site'),
  openGraph: {
    title: 'ClassFlow',
    description:
      'Organize horários escolares com ajuda da IA: cadastros, montagem de grade, detecção e resolução de conflitos e relatórios.',
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
