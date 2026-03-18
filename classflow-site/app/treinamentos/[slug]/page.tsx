import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui'
import { getAllTrainings, getTrainingBySlug } from '@/lib/trainings'

const levelStyles = {
  Iniciante: 'bg-emerald-50 text-emerald-700',
  Intermediário: 'bg-amber-50 text-amber-700',
  Avançado: 'bg-violet-50 text-violet-700',
} as const

export async function generateStaticParams() {
  return getAllTrainings().map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const data = await getTrainingBySlug(params.slug)
  if (!data) return { title: 'Treinamento' }
  return { title: data.meta.title, description: data.meta.description }
}

export default async function TrainingPage({ params }: { params: { slug: string } }) {
  const data = await getTrainingBySlug(params.slug)
  if (!data) notFound()

  const related = getAllTrainings().filter((item) => item.slug !== data.meta.slug).slice(0, 3)

  return (
    <div className="py-6">
      <Link href="/treinamentos" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
        <span aria-hidden="true">←</span>
        Voltar para treinamentos
      </Link>

      <div className="mt-5 overflow-hidden rounded-[28px] border border-black/5 bg-white/85 shadow-soft">
        <div className="relative isolate overflow-hidden px-6 py-7 sm:px-8 sm:py-9">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-brand-100/70 via-brand-50 to-transparent" aria-hidden="true" />
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand-100/60 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">{data.meta.category}</span>
              <span className={`rounded-full px-3 py-1 font-semibold ${levelStyles[data.meta.level]}`}>{data.meta.level}</span>
              <span className="rounded-full border border-black/5 bg-white/80 px-3 py-1">⏱ {data.meta.duration}</span>
              <span className="rounded-full border border-black/5 bg-white/80 px-3 py-1">🗓 Atualizado: {data.meta.updatedAt}</span>
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl lg:text-[2.65rem]">
              {data.meta.title}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 sm:text-lg">
              {data.meta.description}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">O que você vai aprender</div>
                <p className="mt-2 text-sm leading-6 text-zinc-700">A lógica de uso deste fluxo, a ordem correta das ações e os pontos de revisão antes de avançar.</p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Melhor para</div>
                <p className="mt-2 text-sm leading-6 text-zinc-700">Direção, coordenação, secretaria e equipe pedagógica que precisam implantar ou operar o sistema com mais segurança.</p>
              </div>
              <div className="rounded-2xl border border-black/5 bg-white/80 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Leitura recomendada</div>
                <p className="mt-2 text-sm leading-6 text-zinc-700">Siga os tópicos na ordem apresentada e use os checklists para validar a etapa antes de seguir para o próximo tutorial.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          {data.headings.length ? (
            <Card className="p-5">
              <div className="text-sm font-semibold text-zinc-900">Neste tutorial</div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Use esta navegação para encontrar rapidamente a etapa que você quer revisar.
              </p>

              <nav className="mt-4 space-y-2">
                {data.headings.map((heading) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    className={`training-anchor-link ${heading.level === 3 ? 'training-anchor-link-sub' : ''}`}
                  >
                    {heading.title}
                  </a>
                ))}
              </nav>
            </Card>
          ) : null}

          <Card className="p-5">
            <div className="text-sm font-semibold text-zinc-900">Dica de leitura</div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Os tutoriais foram escritos para treinamento prático. Vale usar a página aberta durante a implantação ou revisar cada etapa em reuniões rápidas com a equipe.
            </p>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-black/5 bg-zinc-50/80 px-6 py-4 text-sm font-semibold text-zinc-900 sm:px-8">
              Tutorial completo
            </div>
            <article className="training-content" dangerouslySetInnerHTML={{ __html: data.contentHtml }} />
          </Card>

          <div className="rounded-[24px] border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50/70 p-6 shadow-soft">
            <div className="text-sm font-semibold text-zinc-900">Boa prática de implantação</div>
            <p className="mt-3 text-sm leading-7 text-zinc-700">
              Sempre conclua os cadastros, valide a matriz curricular e revise os parâmetros institucionais antes de publicar a grade.
              Isso reduz conflitos, evita retrabalho e melhora a leitura dos relatórios e documentos emitidos pelo sistema.
            </p>
          </div>

          {related.length ? (
            <div>
              <div className="text-sm font-semibold text-zinc-900">Continue a trilha</div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {related.map((item) => (
                  <Card key={item.slug} className="p-5">
                    <div className="text-xs font-semibold text-brand-700">{item.category}</div>
                    <div className="mt-2 text-lg font-semibold tracking-tight text-zinc-900">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                    <Link href={`/treinamentos/${item.slug}`} className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline">
                      Abrir tutorial →
                    </Link>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
