import { Card, PrimaryButton, SecondaryButton } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'
import { APP_URL } from '@/lib/app-url'

export const metadata = { title: 'Produto' }

const coreModules = [
  {
    title: 'Base institucional e acessos',
    description:
      'Onboarding da escola, perfil do diretor, equipe pedagógica, permissões por perfil e assinatura para operação contínua.',
    bullets: ['Direção e equipe pedagógica', 'Perfis e controle de acesso', 'Fluxo pronto para implantação'],
  },
  {
    title: 'Cadastros acadêmicos completos',
    description:
      'Professores, estudantes, turmas, salas, disciplinas, horários e regras curriculares estruturados para alimentar toda a operação.',
    bullets: ['Cadastros de base escolar', 'Regras por turma, sala e turno', 'Informações pedagógicas e operacionais'],
  },
  {
    title: 'Matriz curricular e grade',
    description:
      'A matriz orienta a montagem da grade semanal com regras por componente, distribuição de aulas, edição manual e revisão de conflitos.',
    bullets: ['Matriz por turma e coorte', 'Grade automática e manual', 'Relatórios por turma, professor e sala'],
  },
  {
    title: 'Novo Ensino Médio',
    description:
      'Parâmetros curriculares, FGB, itinerários, trilhas, educação digital, Projeto de Vida e alertas para apoiar a conformidade da escola.',
    bullets: ['Validação por turma e ano', 'Acompanhamento de carga horária', 'Painéis e relatórios do NEM'],
  },
  {
    title: 'Jornada do aluno',
    description:
      'Pré-matrícula, matrícula, acompanhamento, frequência, avaliações, permanência, histórico escolar e trilhas técnicas em um só ambiente.',
    bullets: ['Pré-matrícula com documentos', 'Acompanhamento pedagógico', 'Históricos e certificações'],
  },
  {
    title: 'Documentos e calendário escolar',
    description:
      'Emissão de documentos escolares, rastreabilidade de segundas vias, calendário do diretor e importação de eventos a partir de fontes e PDFs.',
    bullets: ['Declarações e histórico escolar', 'Calendário institucional', 'Fluxo para secretaria e direção'],
  },
]

const aiModules = [
  {
    title: 'IA no setup da escola',
    desc: 'Ajuda a estruturar parâmetros iniciais da operação com base em texto e áudio, acelerando a configuração do ambiente.',
  },
  {
    title: 'IA para grade e conflitos',
    desc: 'Sugere horários, resolve conflitos, aplica heurísticas e apoia decisões sem tirar o controle da equipe escolar.',
  },
  {
    title: 'IA para critérios do professor',
    desc: 'Interpreta linguagem natural, monta proposta de disponibilidade e salva regras operacionais para a grade.',
  },
  {
    title: 'IA para documentos da pré-matrícula',
    desc: 'Lê PDFs e imagens, classifica arquivos e propõe dados de cadastro para revisão antes da conversão em matrícula.',
  },
]

const stakeholders = [
  {
    title: 'Para a direção',
    desc: 'Mais visibilidade sobre conformidade curricular, permanência, calendário, equipe e relatórios executivos.',
  },
  {
    title: 'Para a coordenação pedagógica',
    desc: 'Mais controle sobre matriz curricular, grade, carga horária, conflitos e ajustes de rotina.',
  },
  {
    title: 'Para a secretaria',
    desc: 'Mais agilidade na matrícula, documentos, históricos e organização da base escolar.',
  },
]

export default function ProdutoPage() {
  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Produto"
          title="Uma plataforma para a operação acadêmica da escola"
          description="O ClassFlow conecta gestão de cadastros, matriz curricular, grade, Novo Ensino Médio, jornada do aluno, documentos e automações com IA."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {coreModules.map((module) => (
            <Card key={module.title}>
              <div className="text-sm font-semibold text-zinc-900">{module.title}</div>
              <p className="mt-2 text-sm text-zinc-600">{module.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-zinc-600">
                {module.bullets.map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <SectionTitle
          kicker="IA aplicada"
          title="Automação prática para reduzir trabalho manual"
          description="A IA aparece em tarefas operacionais do dia a dia, não apenas como apoio visual. O objetivo é acelerar configuração, ajustes e conferências."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {aiModules.map((module) => (
            <Card key={module.title}>
              <div className="text-sm font-semibold text-zinc-900">{module.title}</div>
              <p className="mt-2 text-sm text-zinc-600">{module.desc}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section className="pt-0">
        <SectionTitle
          kicker="Quem mais ganha com isso"
          title="Fluxos pensados para direção, coordenação e secretaria"
          description="A plataforma atende áreas diferentes da escola com um mesmo conjunto de dados e relatórios."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {stakeholders.map((item) => (
            <Card key={item.title}>
              <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
              <p className="mt-2 text-sm text-zinc-600">{item.desc}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <PrimaryButton href="/planos">Ver planos</PrimaryButton>
          <SecondaryButton href="/treinamentos">Ver treinamentos</SecondaryButton>
          <a
            href={APP_URL}
            className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Acessar sistema
          </a>
        </div>
      </Section>
    </div>
  )
}
