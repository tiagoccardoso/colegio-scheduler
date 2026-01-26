import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui'
import { getAllTrainings, getTrainingBySlug } from '@/lib/trainings'

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

  return (
    <div className="py-6">
      <Link href="/treinamentos" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Voltar para treinamentos
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        {data.meta.title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-zinc-600 sm:text-base">{data.meta.description}</p>

      <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-500">
        <span className="rounded-lg border border-black/5 bg-white/70 px-2 py-1">📚 {data.meta.level}</span>
        <span className="rounded-lg border border-black/5 bg-white/70 px-2 py-1">⏱ {data.meta.duration}</span>
        <span className="rounded-lg border border-black/5 bg-white/70 px-2 py-1">🗓 Atualizado: {data.meta.updatedAt}</span>
      </div>

      <Card className="mt-8">
        <article className="prose" dangerouslySetInnerHTML={{ __html: data.contentHtml }} />
      </Card>

      <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-6">
        <div className="text-sm font-semibold text-zinc-900">Dica prática</div>
        <p className="mt-2 text-sm text-zinc-700">
          Depois de montar a grade, abra a tela de conflitos e use <span className="font-semibold">Resolver com IA</span> para receber sugestões.
          Você pode aplicar uma ou todas e então salvar para atualizar grade e relatórios.
        </p>
      </div>
    </div>
  )
}
