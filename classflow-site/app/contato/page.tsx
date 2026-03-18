import { Card, PrimaryButton } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_TEL_URL, CONTACT_WHATSAPP_URL } from '@/lib/contact'

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
              <a className="text-sm font-semibold text-brand-700 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">Telefone / WhatsApp</div>
            <p className="mt-2 text-sm text-zinc-600">
              Ligue ou mande uma mensagem para agendar uma apresentação do fluxo de cadastros, grade, NEM, alunos e documentos.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
              <a className="text-brand-700 hover:underline" href={CONTACT_TEL_URL}>
                {CONTACT_PHONE_DISPLAY}
              </a>
              <a className="text-brand-700 hover:underline" href={CONTACT_WHATSAPP_URL} target="_blank" rel="noreferrer">
                Abrir no WhatsApp
              </a>
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
          <PrimaryButton href="/planos">Ver planos</PrimaryButton>
        </div>
      </Section>
    </div>
  )
}
