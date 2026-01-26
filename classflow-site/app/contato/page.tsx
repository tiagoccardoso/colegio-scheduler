import { Card, PrimaryButton } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'

export const metadata = { title: 'Contato' }

export default function ContatoPage() {
  const email = 'contato@classflow.app'

  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Contato"
          title="Vamos organizar seus horários?"
          description="Peça demonstração, treinamento ou ajuda para implantação. Resposta rápida em horário comercial."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="text-sm font-semibold text-zinc-900">E-mail</div>
            <p className="mt-2 text-sm text-zinc-600">
              Envie sua mensagem com nome da escola, município, turno e quantidade aproximada de turmas.
            </p>
            <div className="mt-4">
              <a className="text-sm font-semibold text-brand-700 hover:underline" href={`mailto:${email}`}>
                {email}
              </a>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">WhatsApp</div>
            <p className="mt-2 text-sm text-zinc-600">
              Preferiu WhatsApp? Mande uma mensagem e a gente agenda uma demonstração.
            </p>
            <div className="mt-4 text-sm font-semibold text-zinc-900">(00) 00000-0000</div>
          </Card>
        </div>

        <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-6">
          <div className="text-sm font-semibold text-zinc-900">Sugestão de mensagem</div>
          <p className="mt-2 text-sm text-zinc-700">
            “Olá! Quero uma demonstração do ClassFlow. Somos uma escola com X turmas no turno Y. Precisamos organizar a grade e reduzir conflitos. Podemos agendar?”
          </p>
        </div>

        <div className="mt-10">
          <PrimaryButton href="/planos">Ver planos</PrimaryButton>
        </div>
      </Section>
    </div>
  )
}
