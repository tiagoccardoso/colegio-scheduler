import Link from 'next/link'
import { cn } from '@/lib/utils'

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href)
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-100 px-3 py-1 text-xs font-semibold tracking-wide text-brand-700">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
      {children}
    </span>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-black/5 bg-white/85 p-6 shadow-soft', className)}>
      {children}
    </div>
  )
}

export function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  const className =
    'inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 px-5 text-sm font-semibold text-white shadow-soft transition-all duration-150 hover:from-brand-700 hover:to-brand-900 hover:shadow-premium'

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
    'inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-800 transition-colors duration-150 hover:bg-zinc-50 hover:border-zinc-300'

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
