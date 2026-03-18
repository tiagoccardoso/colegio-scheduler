import { Badge, Card } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'

export const metadata = { title: 'Planos' }

const PLANS_LOGIN_URL = 'https://www.classflow.app.br/login'

const platformHighlights = [
  {
    title: 'Gestão acadêmica completa',
    desc: 'Cadastros, matriz curricular, horários, grade, estudantes, documentos e relatórios em um único ambiente.',
  },
  {
    title: 'IA operacional',
    desc: 'Apoio para parametrização, critérios de professores, montagem de grade, conflitos e leitura de documentos.',
  },
  {
    title: 'Conformidade do NEM',
    desc: 'Mais visibilidade para FGB, itinerários, trilhas e requisitos curriculares da escola.',
  },
]

export default function PlanosPage() {
  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Plano de assinatura"
          title="Tudo que sua escola precisa para operar com mais controle — com IA"
          description="A assinatura dá acesso à plataforma completa para cadastros, grade, Novo Ensino Médio, jornada do aluno, documentos e relatórios."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <PricingCard
            title="Teste grátis"
            price="7 dias"
            note="Experimente sem custo por 7 dias. Após o período de teste, a cobrança continua no plano mensal (R$ 39,90/mês)."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Começar teste"
            badge="Comece aqui"
            features={[
              'Acesso à plataforma completa',
              'Fluxos de cadastros e grade com IA',
              'Conformidade curricular e relatórios',
              'Pré-matrícula, documentos e histórico',
              'Calendário e visão para direção',
            ]}
          />
          <PricingCard
            title="Mensal"
            price="R$ 39,90"
            note="Renovação automática. Cancele quando quiser."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Assinar mensal"
            features={[
              'Gestão acadêmica escolar completa',
              'IA para setup, grade e conflitos',
              'Matriz curricular e NEM',
              'Acompanhamento do aluno',
              'Documentos e relatórios',
            ]}
          />
          <PricingCard
            title="Anual"
            price="R$ 383,05"
            note="Economize e ganhe previsibilidade o ano todo."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Assinar anual"
            highlight
            features={[
              'Tudo do plano mensal',
              'Operação acadêmica contínua',
              'Mais previsibilidade orçamentária',
              'Uso da plataforma ao longo do ano letivo',
              'Ideal para implantação institucional',
            ]}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {platformHighlights.map((item) => (
            <Card key={item.title}>
              <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
              <p className="mt-2 text-sm text-zinc-600">{item.desc}</p>
            </Card>
          ))}
        </div>

        <p className="mt-10 text-sm text-zinc-600">
          Ao clicar em um plano, você será direcionado para o login do ClassFlow para criar sua conta e concluir a
          assinatura ou iniciar o teste grátis.
        </p>
      </Section>
    </div>
  )
}

function PricingCard(props: {
  title: string
  price: string
  note: string
  ctaHref: string
  ctaLabel: string
  features: string[]
  highlight?: boolean
  badge?: string
}) {
  const hasEmphasis = Boolean(props.highlight || props.badge)

  return (
    <Card className={hasEmphasis ? 'border-brand-200 bg-white' : ''}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{props.price}</div>
          <p className="mt-2 text-sm text-zinc-600">{props.note}</p>
        </div>
        {props.badge ? <Badge>{props.badge}</Badge> : props.highlight ? <Badge>Mais escolhido</Badge> : null}
      </div>

      <ul className="mt-6 space-y-2 text-sm text-zinc-600">
        {props.features.map((feature) => (
          <li key={feature}>• {feature}</li>
        ))}
      </ul>

      <div className="mt-6">
        <a
          href={props.ctaHref}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
        >
          {props.ctaLabel}
        </a>
      </div>
    </Card>
  )
}
