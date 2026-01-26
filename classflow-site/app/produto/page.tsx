import { Card, PrimaryButton, SecondaryButton } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'

export const metadata = { title: 'Produto' }

export default function ProdutoPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seusistema.vercel.app'

  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Produto"
          title="Da regra ao horário: a IA auxilia do começo ao fim"
          description="Cadastros simples, geração de grade do turno, detecção de conflitos e resolução com sugestões clicáveis."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="text-sm font-semibold text-zinc-900">1) Cadastros essenciais</div>
            <p className="mt-2 text-sm text-zinc-600">
              Disciplinas, salas, turmas, horários e professores. Tudo organizado para alimentar o motor de grade.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>• Cadastros ilimitados</li>
              <li>• Consistência de horários (início/fim)</li>
              <li>• Relatórios prontos</li>
            </ul>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">2) Critérios do professor</div>
            <p className="mt-2 text-sm text-zinc-600">
              Escreva em linguagem natural: dias disponíveis, períodos, turmas e carga horária. A IA interpreta e propõe horários.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>• Ex.: “Seg/ter/qua de manhã, últimos períodos”</li>
              <li>• Sugestões com explicação</li>
              <li>• Edição manual antes de salvar</li>
            </ul>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">3) Montagem de grade do turno</div>
            <p className="mt-2 text-sm text-zinc-600">
              Monte a grade geral e revise conflitos (professor, turma ou sala). Visualize por dia e aplique ajustes.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>• Detecção automática de conflitos</li>
              <li>• Relatórios por turma/professor/sala</li>
              <li>• Exportação para impressão</li>
            </ul>
          </Card>

          <Card>
            <div className="text-sm font-semibold text-zinc-900">4) Resolver conflitos com IA</div>
            <p className="mt-2 text-sm text-zinc-600">
              Quando aparecer conflito, clique em <span className="font-semibold">Resolver com IA</span>. Veja sugestões em pt-BR e aplique.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600">
              <li>• Sugestões clicáveis</li>
              <li>• Botão “Aplicar todas”</li>
              <li>• Atualiza cadastro, grade e relatórios</li>
            </ul>
          </Card>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <PrimaryButton href="/planos">Ver planos</PrimaryButton>
          <SecondaryButton href="/treinamentos">Ver treinamentos</SecondaryButton>
          <a
            href={appUrl}
            className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Acessar sistema
          </a>
        </div>
      </Section>
    </div>
  )
}
