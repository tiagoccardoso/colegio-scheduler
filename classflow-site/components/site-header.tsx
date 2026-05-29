'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { APP_URL } from '@/lib/app-url'

const nav = [
  { href: '/produto', label: 'Produto' },
  { href: '/planos', label: 'Planos' },
  { href: '/treinamentos', label: 'Treinamentos' },
  { href: '/matricula', label: 'Matrícula' },
  { href: '/contato', label: 'Contato' },
]

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-black/6 bg-white/82 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-soft">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4h10a3 3 0 0 1 3 3v13a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-zinc-900">ClassFlow</div>
            <div className="text-xs text-zinc-500 font-medium">Gestão acadêmica com IA</div>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-brand-50 text-brand-700 font-semibold'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-brand-600 opacity-70" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={APP_URL}
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors duration-150 md:inline-flex"
          >
            Acessar sistema
          </a>
          <Link
            href="/matricula"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 px-4 text-sm font-semibold text-white shadow-soft transition-all duration-150 hover:from-brand-700 hover:to-brand-900 hover:shadow-premium"
          >
            Fazer matrícula
          </Link>
        </div>
      </div>
    </header>
  )
}
