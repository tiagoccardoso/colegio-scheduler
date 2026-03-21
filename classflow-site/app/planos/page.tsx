import { Badge, Card } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'

export const metadata = { title: 'Planos' }

const PLANS_LOGIN_URL = 'https://www.classflow.app.br/login'

const platformHighlights = [
  {
    title: 'Os 3 planos liberam os mesmos recursos',
    desc: 'Teste grátis, mensal e anual dão acesso completo à plataforma. O que muda é apenas a vigência e a forma de cobrança.',
  },
  {
    title: 'Operação acadêmica em um único ambiente',
    desc: 'Direção, coordenação, secretaria e equipe pedagógica trabalham com mais controle sobre grade, estudantes, documentos e relatórios.',
  },
  {
    title: 'IA aplicada à rotina escolar',
    desc: 'A plataforma apoia setup inicial, critérios de professores, montagem de grade, conflitos e organização de documentos.',
  },
]

const sharedPlanFeatures = [
  'Acesso completo à plataforma',
  'Todos os módulos acadêmicos e administrativos',
  'Recursos de IA para operação escolar',
  'Novo Ensino Médio, documentos e relatórios',
  'Direção, coordenação e secretaria no mesmo ambiente',
]

const releasedResources = [
  {
    title: 'Gestão institucional e direção',
    items: [
      'Painel do Diretor',
      'Dashboard da escola',
      'Configuração institucional da escola',
      'Equipe pedagógica',
      'Calendário escolar',
      'Sala padrão',
      'Parâmetros da grade',
      'Visão gerencial para direção e coordenação',
    ],
  },
  {
    title: 'Cadastros acadêmicos completos',
    items: [
      'Cadastro de disciplinas',
      'Cadastro de estudantes',
      'Cadastro de professores',
      'Cadastro de turmas',
      'Cadastro de salas',
      'Cadastro de horários por turno',
      'Matriz curricular',
      'Solicitações de matrícula',
    ],
  },
  {
    title: 'Montagem de grade escolar',
    items: [
      'Montagem de grade',
      'Geração de grade com apoio de IA',
      'Ajustes manuais na grade',
      'Resolução de conflitos',
      'Organização da distribuição de aulas',
      'Revisão por turma, professor e sala',
    ],
  },
  {
    title: 'Novo Ensino Médio e conformidade curricular',
    items: [
      'Configuração do Novo Ensino Médio',
      'Controle de Formação Geral Básica (FGB)',
      'Itinerários formativos',
      'Trilhas',
      'Projeto de Vida',
      'Educação digital',
      'Validação de carga horária',
      'Permanência NEM',
      'Relatórios NEM',
      'Documentos NEM',
    ],
  },
  {
    title: 'Jornada do aluno e secretaria escolar',
    items: [
      'Pré-matrícula',
      'Matrícula',
      'Cadastro completo do estudante',
      'Organização de documentos do aluno',
      'Acompanhamento do aluno',
      'Histórico escolar',
      'Trilhas e certificações',
      'Controle da trajetória acadêmica',
    ],
  },
  {
    title: 'Documentos e rotina escolar',
    items: [
      'Emissão e gestão de documentos escolares',
      'Histórico escolar',
      'Organização de anexos e documentos',
      'Fluxos para secretaria e direção',
    ],
  },
  {
    title: 'Relatórios operacionais',
    items: [
      'Grade semanal',
      'Grade por turma',
      'Grade por sala',
      'Grade por professor',
      'Relatórios de faltas',
      'Relatórios de hora-atividade',
      'Relatórios para planejamento acadêmico',
    ],
  },
  {
    title: 'Recursos de inteligência artificial',
    items: [
      'IA para setup inicial da escola',
      'IA para critérios e disponibilidade de professores',
      'IA para montagem de grade',
      'IA para identificação e resolução de conflitos',
      'IA para leitura e organização de documentos da pré-matrícula',
      'IA para apoio operacional na configuração do ambiente',
    ],
  },
]

export default function PlanosPage() {
  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Plano de assinatura"
          title="Escolha a vigência e libere a plataforma completa para sua escola"
          description="Todos os planos liberam os mesmos recursos. A diferença entre teste grátis, mensal e anual está apenas no período de uso e na forma de cobrança."
        />

        <div className="mt-6 inline-flex rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900">
          Após a assinatura, sua escola libera acesso completo para direção, coordenação, secretaria, cadastros,
          grade, Novo Ensino Médio, documentos, relatórios e recursos com IA.
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <PricingCard
            title="Teste grátis"
            price="7 dias"
            note="Experimente sem custo por 7 dias. Após o período de teste, a cobrança continua no plano mensal (R$ 39,90/mês)."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Começar teste"
            badge="Comece aqui"
            features={sharedPlanFeatures}
          />
          <PricingCard
            title="Mensal"
            price="R$ 39,90"
            note="Renovação automática. Cancele quando quiser. Libera exatamente os mesmos recursos dos outros planos."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Assinar mensal"
            features={sharedPlanFeatures}
          />
          <PricingCard
            title="Anual"
            price="R$ 383,05"
            note="Economize e tenha previsibilidade no ano todo. Libera exatamente os mesmos recursos dos outros planos."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Assinar anual"
            highlight
            features={sharedPlanFeatures}
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
      </Section>

      <Section className="pt-0">
        <SectionTitle
          kicker="Recursos liberados"
          title="Tudo o que sua escola desbloqueia após assinar qualquer plano"
          description="A lista abaixo vale para teste grátis, plano mensal e plano anual. Todos liberam os mesmos módulos e funcionalidades da plataforma."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {releasedResources.map((group) => (
            <Card key={group.title} className="h-full">
              <div className="text-base font-semibold text-zinc-900">{group.title}</div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 text-brand-700">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-black/5 bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-base font-semibold text-zinc-900">Todos os planos, os mesmos recursos</div>
              <p className="mt-2 max-w-2xl text-sm text-zinc-600">
                Escolha a vigência que faz mais sentido para a sua escola. Ao clicar em um plano, você será
                direcionado para o login do ClassFlow para criar sua conta, iniciar o teste grátis ou concluir a
                assinatura.
              </p>
            </div>
            <a
              href={PLANS_LOGIN_URL}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
            >
              Acessar ClassFlow
            </a>
          </div>
        </div>
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
    <Card className={`flex h-full flex-col ${hasEmphasis ? 'border-brand-200 bg-white' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{props.price}</div>
          <p className="mt-2 text-sm text-zinc-600">{props.note}</p>
        </div>
        {props.badge ? <Badge>{props.badge}</Badge> : props.highlight ? <Badge>Mais escolhido</Badge> : null}
      </div>

      <ul className="mt-6 grow space-y-2 text-sm text-zinc-600">
        {props.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="mt-1 text-brand-700">•</span>
            <span>{feature}</span>
          </li>
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
