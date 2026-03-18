import { Badge, Card, PrimaryButton, SecondaryButton } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'
import { APP_URL } from '@/lib/app-url'

const platformPillars = [
  {
    title: 'Operação escolar centralizada',
    desc: 'Cadastros de professores, turmas, salas, disciplinas, horários e equipe pedagógica em um único fluxo.',
  },
  {
    title: 'Grade com inteligência operacional',
    desc: 'Monte, revise, ajuste conflitos e publique com relatórios por turma, professor e sala.',
  },
  {
    title: 'Novo Ensino Médio com mais controle',
    desc: 'Acompanhe FGB, itinerários, trilhas, regras curriculares e alertas de conformidade.',
  },
  {
    title: 'Jornada do aluno',
    desc: 'Da pré-matrícula ao histórico escolar, com acompanhamento, documentos e rastreabilidade.',
  },
]

const valueCards = [
  {
    title: 'Menos retrabalho pedagógico',
    desc: 'A matriz curricular, as regras da escola e a grade ficam conectadas, reduzindo ajustes manuais espalhados em planilhas.',
  },
  {
    title: 'IA aplicada em tarefas reais',
    desc: 'A IA ajuda no setup, sugere horários, apoia a resolução de conflitos, interpreta critérios e lê documentos da pré-matrícula.',
  },
  {
    title: 'Mais visibilidade para a direção',
    desc: 'Painéis, relatórios, calendário, documentos e acompanhamento escolar com visão executiva da operação acadêmica.',
  },
]

export default function HomePage() {
  return (
    <div>
      <div className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
        <div>
          <Badge>Plataforma acadêmica com IA</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            Gestão acadêmica escolar com
            <span className="text-brand-700"> IA, grade inteligente e conformidade curricular</span>.
          </h1>
          <p className="mt-5 text-base text-zinc-600 sm:text-lg">
            O ClassFlow conecta cadastros, matriz curricular, horários, Novo Ensino Médio, acompanhamento do aluno,
            documentos e relatórios em uma plataforma única para a rotina da escola.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <PrimaryButton href="/produto">Conhecer o produto</PrimaryButton>
            <SecondaryButton href="/contato">Pedir demonstração</SecondaryButton>
            <a
              href={APP_URL}
              className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Acessar sistema
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-zinc-500">
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">Vercel</div>
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">Supabase</div>
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">Stripe</div>
            <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2">OpenAI</div>
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-black/5 bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
            <div className="text-sm font-semibold">Visão do fluxo</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">Cadastros → Matriz → Grade → Aluno → Documentos</div>
            <p className="mt-2 text-sm text-white/85">
              A plataforma organiza a base acadêmica da escola, aplica regras curriculares e reduz trabalho manual com apoio de IA.
            </p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <MiniFeature title="Novo Ensino Médio" desc="FGB, itinerários, trilhas e alertas de conformidade curricular." />
            <MiniFeature title="Grade e conflitos" desc="Montagem automática, revisão manual, conflitos e sugestões aplicáveis." />
            <MiniFeature title="Pré-matrícula inteligente" desc="Leitura de documentos, extração de dados e proposta de cadastro." />
            <MiniFeature title="Direção e secretaria" desc="Relatórios, calendário, documentos escolares e visão executiva." />
          </div>
        </Card>
      </div>

      <Section>
        <SectionTitle
          kicker="Por que ClassFlow"
          title="Mais do que montar horários: organize a operação acadêmica da escola"
          description="O sistema foi pensado para escolas que precisam integrar rotina pedagógica, grade, conformidade curricular e documentação em um só lugar."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {valueCards.map((card) => (
            <Card key={card.title}>
              <div className="text-sm font-semibold text-zinc-900">{card.title}</div>
              <p className="mt-2 text-sm text-zinc-600">{card.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <SectionTitle
          kicker="Módulos principais"
          title="O que a escola consegue operar dentro da plataforma"
          description="Os módulos abaixo resumem o que já aparece no produto e como isso se traduz em ganho prático para direção, coordenação e secretaria."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {platformPillars.map((pillar) => (
            <Card key={pillar.title}>
              <div className="text-sm font-semibold text-zinc-900">{pillar.title}</div>
              <p className="mt-2 text-sm text-zinc-600">{pillar.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <Card className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="text-sm font-semibold text-zinc-900">Pronto para apresentar o fluxo completo da sua escola?</div>
            <p className="mt-2 text-sm text-zinc-600">
              Veja como o ClassFlow pode conectar cadastros, grade, conformidade do Novo Ensino Médio, acompanhamento do aluno e emissão de documentos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryButton href="/contato">Pedir demonstração</PrimaryButton>
            <SecondaryButton href="/planos">Ver planos</SecondaryButton>
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
