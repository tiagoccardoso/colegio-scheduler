'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/produto', label: 'Produto' },
  { href: '/planos', label: 'Planos' },
  { href: '/treinamentos', label: 'Treinamentos' },
  { href: '/contato', label: 'Contato' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seusistema.vercel.app'

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/70 backdrop-blur dark:bg-white/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 4h10a3 3 0 0 1 3 3v13a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M7 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-zinc-900">ClassFlow</div>
            <div className="text-xs text-zinc-500">IA para horários sem conflitos</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                  active && 'bg-zinc-100 text-zinc-900'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={appUrl}
            className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 md:inline-flex"
          >
            Acessar sistema
          </Link>
          <Link
            href="/planos"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
          >
            Assinar
          </Link>
        </div>
      </div>
    </header>
  )
}
