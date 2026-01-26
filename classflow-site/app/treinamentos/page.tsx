import Link from 'next/link'
import { Card } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'
import { getAllTrainings } from '@/lib/trainings'

export const metadata = { title: 'Treinamentos' }

export default function TreinamentosPage() {
  const trainings = getAllTrainings()

  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Treinamentos"
          title="Aprenda a montar grades melhores — mais rápido"
          description="Guias curtos e práticos para cadastros, montagem de grade, resolução de conflitos com IA e relatórios."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {trainings.map((t) => (
            <Link key={t.slug} href={`/treinamentos/${t.slug}`}>
              <Card className="h-full hover:border-brand-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{t.title}</div>
                    <p className="mt-2 text-sm text-zinc-600">{t.description}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">{t.level}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span className="rounded-lg border border-black/5 bg-white/70 px-2 py-1">⏱ {t.duration}</span>
                  <span className="rounded-lg border border-black/5 bg-white/70 px-2 py-1">🗓 {t.updatedAt}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-black/5 bg-white/70 p-6 text-sm text-zinc-600">
          <div className="font-semibold text-zinc-900">Quer um treinamento ao vivo?</div>
          <p className="mt-2">
            Envie uma mensagem pela página de contato. A gente monta um roteiro por perfil (secretaria, coordenação, direção).
          </p>
        </div>
      </Section>
    </div>
  )
}
