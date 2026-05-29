import { cn } from '@/lib/utils'

export function Section({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('py-14', className)}>{children}</section>
}

export function SectionTitle({ kicker, title, description }: { kicker?: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      {kicker ? (
        <div className="text-xs font-bold uppercase tracking-widest text-brand-700">{kicker}</div>
      ) : null}
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl" style={{ letterSpacing: '-0.025em' }}>
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-base">{description}</p>
      ) : null}
    </div>
  )
}
