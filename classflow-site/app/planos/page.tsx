import { Badge, Card } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'

export const metadata = { title: 'Planos' }

const PLANS_LOGIN_URL = 'https://www.classflow.app.br/login'

export default function PlanosPage() {
  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Plano de assinatura"
          title="Tudo que você precisa para montar a grade — com IA"
          description="Acesso completo ao gerador de grade, cadastros, detecção e resolução de conflitos e relatórios."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <PricingCard
            title="Teste grátis"
            price="7 dias"
            note="Experimente sem custo por 7 dias. Após o período de teste, a cobrança continua no plano mensal (R$ 39,90/mês)."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Começar teste"
            badge="Comece aqui"
          />
          <PricingCard
            title="Mensal"
            price="R$ 39,90"
            note="Renovação automática. Cancele quando quiser."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Assinar mensal"
          />
          <PricingCard
            title="Anual"
            price="R$ 383,05"
            note="Economize e ganhe previsibilidade o ano todo."
            ctaHref={PLANS_LOGIN_URL}
            ctaLabel="Assinar anual"
            highlight
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <div className="text-sm font-semibold text-zinc-900">Cadastros ilimitados</div>
            <p className="mt-2 text-sm text-zinc-600">Professores, turmas, disciplinas, salas e horários sem limites.</p>
          </Card>
          <Card>
            <div className="text-sm font-semibold text-zinc-900">IA para critérios e conflitos</div>
            <p className="mt-2 text-sm text-zinc-600">
              A IA interpreta preferências, detecta conflitos e propõe soluções para aplicar em um clique.
            </p>
          </Card>
          <Card>
            <div className="text-sm font-semibold text-zinc-900">Relatórios e auditoria</div>
            <p className="mt-2 text-sm text-zinc-600">
              Relatórios para acompanhar decisões, exceções e histórico de alterações na grade.
            </p>
          </Card>
        </div>

        <p className="mt-10 text-sm text-zinc-600">
          Ao clicar em um plano, você será direcionado para o login do ClassFlow para criar sua conta e concluir a
          assinatura (ou iniciar o teste grátis).
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
        <li>• Montagem de grade com revisão de conflitos</li>
        <li>• Critérios do professor interpretados pela IA</li>
        <li>• Resolver conflitos com sugestões clicáveis</li>
        <li>• Botão “Aplicar todas” e atualização da grade</li>
        <li>• Relatórios completos</li>
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
