import Link from 'next/link'
import { cn } from '@/lib/utils'

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-900">
      <span className="h-2 w-2 rounded-full bg-brand-600" />
      {children}
    </span>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-black/5 bg-white/80 p-6 shadow-soft', className)}>
      {children}
    </div>
  )
}

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    'inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700'

  // Para links externos (ex.: porta/host diferente), use <a> para evitar qualquer interceptação.
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function SecondaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    'inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50'

  if (isExternalHref(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
