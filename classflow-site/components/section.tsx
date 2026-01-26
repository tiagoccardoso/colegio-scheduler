import { cn } from '@/lib/utils'

export function Section({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('py-12', className)}>{children}</section>
}

export function SectionTitle({ kicker, title, description }: { kicker?: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      {kicker ? (
        <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">{kicker}</div>
      ) : null}
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-sm text-zinc-600 sm:text-base">{description}</p> : null}
    </div>
  )
}
