import { Card } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_TEL_URL, CONTACT_WHATSAPP_URL } from '@/lib/contact'
import { TrackedLink } from '@/components/tracked-link'

export const metadata = { title: 'Contato' }

export default function ContatoPage() {
  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Contato"
          title="Vamos apresentar o fluxo completo da sua escola?"
          description="Peça uma demonstração, treinamento ou apoio para implantação. Resposta rápida em horário comercial."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="text-sm font-semibold text-zinc-900">E-mail</div>
            <p className="mt-2 text-sm text-zinc-600">
              Envie sua mensagem com nome da escola, município, quantidade aproximada de turmas e os módulos que você quer ver na demonstração.
            </p>
            <div className="mt-4">
              <TrackedLink
                className="text-sm font-semibold text-brand-700 hover:underline"
                href={`mailto:${CONTACT_EMAIL}`}
                eventName="contact_email_clicked"
                eventProperties={{ page: 'contato', channel: 'email' }}
              >
                {CONTACT_EMAIL}
              </TrackedLink>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">Telefone / WhatsApp</div>
            <p className="mt-2 text-sm text-zinc-600">
              Ligue ou mande uma mensagem para agendar uma apresentação do fluxo de cadastros, grade, NEM, alunos e documentos.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
              <TrackedLink
                className="text-brand-700 hover:underline"
                href={CONTACT_TEL_URL}
                eventName="contact_phone_clicked"
                eventProperties={{ page: 'contato', channel: 'telefone' }}
              >
                {CONTACT_PHONE_DISPLAY}
              </TrackedLink>
              <TrackedLink
                className="text-brand-700 hover:underline"
                href={CONTACT_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                eventName="contact_whatsapp_clicked"
                eventProperties={{ page: 'contato', channel: 'whatsapp' }}
              >
                Abrir no WhatsApp
              </TrackedLink>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">Endereço</div>
            <p className="mt-2 text-sm text-zinc-600">{CONTACT_ADDRESS}</p>
          </Card>
        </div>

        <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50 p-6">
          <div className="text-sm font-semibold text-zinc-900">Sugestão de mensagem</div>
          <p className="mt-2 text-sm text-zinc-700">
            “Olá! Quero uma demonstração do ClassFlow. Somos uma escola com X turmas e queremos conhecer os fluxos de cadastros, matriz curricular, grade com IA, Novo Ensino Médio, acompanhamento do aluno e documentos. Podemos agendar?”
          </p>
        </div>

        <div className="mt-10">
          <TrackedLink
            href="/planos"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700"
            eventName="contact_view_plans_clicked"
            eventProperties={{ page: 'contato', destination: 'planos' }}
          >
            Ver planos
          </TrackedLink>
        </div>
      </Section>
    </div>
  )
}
