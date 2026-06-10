import Link from 'next/link'
import { Card } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'
import { getAllTrainings } from '@/lib/trainings'

export const metadata = {
  title: 'Treinamentos',
  description: 'Central de treinamento do ClassFlow com tutoriais completos para implantação, cadastros, grade, NEM, secretaria, documentos e relatórios.',
}

const levelStyles = {
  Iniciante: 'bg-emerald-50 text-emerald-700',
  Intermediário: 'bg-amber-50 text-amber-700',
  Avançado: 'bg-violet-50 text-violet-700',
} as const

export default function TreinamentosPage() {
  const trainings = getAllTrainings()

  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Treinamentos"
          title="Central de treinamento do ClassFlow"
          description="Tutoriais escritos, completos e organizados por jornada de uso para capacitar direção, coordenação, secretaria e equipe pedagógica."
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <div className="text-sm font-semibold text-zinc-900">Como usar esta trilha</div>
            <p className="mt-2 text-sm text-zinc-600">
              Recomendamos começar pela implantação e pelos cadastros. Depois avance para Novo Ensino Médio, matriz curricular,
              montagem de grade, secretaria, documentos e relatórios. Assim a equipe aprende o sistema na mesma ordem em que a
              operação escolar acontece.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                '1. Implantação e acesso inicial',
                '2. Cadastros acadêmicos essenciais',
                '3. Parâmetros e conformidade do NEM',
                '4. Matriz curricular e horários',
                '5. Grade, ajustes e conflitos com IA',
                '6. Secretaria, estudantes e documentos',
                '7. Acompanhamento, histórico e trilhas',
                '8. Calendário, relatórios e gestão',
              ].map((step) => (
                <div key={step} className="rounded-xl border border-black/5 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  {step}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">O que você encontra nesta página</div>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>• Fluxos completos de uso, não apenas dicas rápidas.</p>
              <p>• Passos sugeridos para implantação e operação contínua.</p>
              <p>• Boas práticas para reduzir retrabalho e inconsistências.</p>
              <p>• Conteúdo pronto para treinar novos usuários do sistema.</p>
            </div>

            <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <div className="text-sm font-semibold text-zinc-900">Indicação prática</div>
              <p className="mt-2 text-sm text-zinc-700">
                Para equipes novas, faça o treinamento em blocos curtos: cadastros no primeiro encontro, grade no segundo,
                secretaria e documentos no terceiro, e relatórios no fechamento.
              </p>
            </div>
          </Card>
        </div>

        <div className="mt-10">
          <div className="text-sm font-semibold text-zinc-900">Tutoriais disponíveis</div>
          <p className="mt-1 text-sm text-zinc-600">Todos os vídeos foram removidos desta área. Agora a página reúne apenas os tutoriais escritos e atualizados do sistema.</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {trainings.map((training) => (
              <Card key={training.slug} className="flex h-full flex-col">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">{training.category}</span>
                  <span className={`rounded-full px-3 py-1 font-semibold ${levelStyles[training.level]}`}>
                    {training.level}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-600">{training.duration}</span>
                </div>

                <h2 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">{training.title}</h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600">{training.description}</p>

                <div className="mt-5 flex items-center justify-between gap-4 text-xs text-zinc-500">
                  <span>Atualizado em {training.updatedAt}</span>
                  <Link href={`/treinamentos/${training.slug}`} className="font-semibold text-brand-700 hover:underline">
                    Ler tutorial completo →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>

      </Section>
    </div>
  )
}
