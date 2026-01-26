import { Badge, Card, PrimaryButton, SecondaryButton } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'

export const metadata = { title: 'Planos' }

export default function PlanosPage() {
  const monthly = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_URL || '#'
  const yearly = process.env.NEXT_PUBLIC_STRIPE_YEARLY_URL || '#'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seusistema.vercel.app'

  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Plano de assinatura"
          title="Tudo que você precisa para montar a grade — com IA"
          description="Acesso completo ao gerador de grade, cadastros, detecção e resolução de conflitos e relatórios."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <PricingCard
            title="Mensal"
            price="R$ 39,90"
            note="Renovação automática. Cancele quando quiser."
            ctaHref={monthly}
            ctaLabel="Assinar mensal"
            highlight={false}
          />
          <PricingCard
            title="Anual"
            price="R$ 383,05"
            note="Economize e ganhe previsibilidade o ano todo."
            ctaHref={yearly}
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
            <div className="text-sm font-semibold text-zinc-900">IA para organizar e resolver</div>
            <p className="mt-2 text-sm text-zinc-600">Sugestões em português, ações clicáveis e botão “Aplicar todas”.</p>
          </Card>
          <Card>
            <div className="text-sm font-semibold text-zinc-900">Relatórios prontos</div>
            <p className="mt-2 text-sm text-zinc-600">Por turma, professor e sala — pronto para imprimir e compartilhar.</p>
          </Card>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <PrimaryButton href={appUrl}>Acessar sistema</PrimaryButton>
          <SecondaryButton href="/contato">Falar com a equipe</SecondaryButton>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          A liberação do sistema acontece após a confirmação da assinatura (checkout Stripe).
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
}) {
  return (
    <Card className={props.highlight ? 'border-brand-200 bg-white' : ''}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{props.title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{props.price}</div>
          <p className="mt-2 text-sm text-zinc-600">{props.note}</p>
        </div>
        {props.highlight ? <Badge>Mais escolhido</Badge> : null}
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

      {props.ctaHref === '#' ? (
        <p className="mt-3 text-xs text-zinc-500">
          Configure os links do checkout com <span className="font-semibold">NEXT_PUBLIC_STRIPE_MONTHLY_URL</span> e{' '}
          <span className="font-semibold">NEXT_PUBLIC_STRIPE_YEARLY_URL</span>.
        </p>
      ) : null}
    </Card>
  )
}
