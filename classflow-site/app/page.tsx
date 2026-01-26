import Link from 'next/link'
import { Badge, Card, PrimaryButton, SecondaryButton } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'

export default function HomePage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seusistema.vercel.app'

  return (
    <div>
      <div className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
        <div>
          <Badge>Organização escolar sem conflitos</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            IA que auxilia na organização
            <span className="text-brand-700"> e monta a grade</span>.
          </h1>
          <p className="mt-5 text-base text-zinc-600 sm:text-lg">
            Cadastre professores, turmas, disciplinas e salas. Descreva critérios (dias, períodos, preferências).
            A inteligência artificial sugere horários, identifica conflitos e ajuda a corrigir antes de salvar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PrimaryButton href="/planos">Ver planos</PrimaryButton>
            <SecondaryButton href="/treinamentos">Treinamentos</SecondaryButton>
            <Link
              href={appUrl}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Acessar sistema
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-zinc-500">
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">Vercel</div>
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">Supabase</div>
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">Stripe</div>
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">OpenAI</div>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="border-b border-black/5 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
            <div className="text-sm font-semibold">Prévia do fluxo</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">Critérios → Grade → Ajustes → Salvar</div>
            <p className="mt-2 text-sm text-white/85">
              A IA transforma critérios em uma proposta de horário. Se houver conflito, ela sugere correções e você decide.
            </p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <MiniFeature title="Critérios do professor" desc="Dias disponíveis, períodos, turmas e carga horária." />
            <MiniFeature title="Detecção de conflitos" desc="Professor, turma ou sala ocupada no mesmo horário." />
            <MiniFeature title="Resolver com IA" desc="Sugestões clicáveis e aplicar tudo de uma vez." />
            <MiniFeature title="Relatórios" desc="Por turma, professor e sala — pronto para imprimir." />
          </div>
        </Card>
      </div>

      <Section>
        <SectionTitle
          kicker="Por que ClassFlow"
          title="Menos planilhas. Menos retrabalho. Mais clareza."
          description="O ClassFlow foi desenhado para o que mais consome tempo na escola: montar e ajustar grade." 
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <div className="text-sm font-semibold text-zinc-900">Montagem mais rápida</div>
            <p className="mt-2 text-sm text-zinc-600">Gere a grade do turno, revise e publique em minutos.</p>
          </Card>
          <Card>
            <div className="text-sm font-semibold text-zinc-900">IA como copiloto</div>
            <p className="mt-2 text-sm text-zinc-600">A IA sugere, explica e ajuda você a decidir. Você mantém o controle.</p>
          </Card>
          <Card>
            <div className="text-sm font-semibold text-zinc-900">Conflitos resolvidos</div>
            <p className="mt-2 text-sm text-zinc-600">Sugestões clicáveis e botão “Aplicar todas” para reduzir conflitos de uma vez.</p>
          </Card>
        </div>
      </Section>

      <Section className="pt-0">
        <Card className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Pronto para começar?</div>
            <p className="mt-2 text-sm text-zinc-600">
              Assine e tenha acesso completo ao gerador de grade, cadastros, resolução de conflitos com IA e relatórios.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryButton href="/planos">Assinar agora</PrimaryButton>
            <SecondaryButton href="/contato">Pedir demonstração</SecondaryButton>
          </div>
        </Card>
      </Section>
    </div>
  )
}

function MiniFeature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-4">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <p className="mt-2 text-sm text-zinc-600">{desc}</p>
    </div>
  )
}
