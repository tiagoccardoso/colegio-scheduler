import type { ReactNode } from "react";

export const sharedPlanFeatures = [
  "Acesso completo à plataforma",
  "Todos os módulos acadêmicos e administrativos",
  "Recursos de IA para operação escolar",
  "Novo Ensino Médio, documentos e relatórios",
  "Direção, coordenação e secretaria no mesmo ambiente",
];

const platformHighlights = [
  {
    title: "Os 3 planos liberam os mesmos recursos",
    desc: "Teste grátis, mensal e anual dão acesso completo à plataforma. O que muda é apenas a vigência e a forma de cobrança.",
  },
  {
    title: "Operação acadêmica em um único ambiente",
    desc: "Direção, coordenação, secretaria e equipe pedagógica trabalham com mais controle sobre grade, estudantes, documentos e relatórios.",
  },
  {
    title: "IA aplicada à rotina escolar",
    desc: "A plataforma apoia setup inicial, critérios de professores, montagem de grade, conflitos e organização de documentos.",
  },
];

const releasedResources = [
  {
    title: "Gestão institucional e direção",
    items: [
      "Painel do Diretor",
      "Dashboard da escola",
      "Configuração institucional da escola",
      "Equipe pedagógica",
      "Calendário escolar",
      "Sala padrão",
      "Parâmetros da grade",
      "Visão gerencial para direção e coordenação",
    ],
  },
  {
    title: "Cadastros acadêmicos completos",
    items: [
      "Cadastro de disciplinas",
      "Cadastro de estudantes",
      "Cadastro de professores",
      "Cadastro de turmas",
      "Cadastro de salas",
      "Cadastro de horários por turno",
      "Matriz curricular",
      "Solicitações de matrícula",
    ],
  },
  {
    title: "Montagem de grade escolar",
    items: [
      "Montagem de grade",
      "Geração de grade com apoio de IA",
      "Ajustes manuais na grade",
      "Resolução de conflitos",
      "Organização da distribuição de aulas",
      "Revisão por turma, professor e sala",
    ],
  },
  {
    title: "Novo Ensino Médio e conformidade curricular",
    items: [
      "Configuração do Novo Ensino Médio",
      "Controle de Formação Geral Básica (FGB)",
      "Itinerários formativos",
      "Trilhas",
      "Projeto de Vida",
      "Educação digital",
      "Validação de carga horária",
      "Permanência NEM",
      "Relatórios NEM",
      "Documentos NEM",
    ],
  },
  {
    title: "Jornada do aluno e secretaria escolar",
    items: [
      "Pré-matrícula",
      "Matrícula",
      "Cadastro completo do estudante",
      "Organização de documentos do aluno",
      "Acompanhamento do aluno",
      "Histórico escolar",
      "Trilhas e certificações",
      "Controle da trajetória acadêmica",
    ],
  },
  {
    title: "Documentos e rotina escolar",
    items: [
      "Emissão e gestão de documentos escolares",
      "Histórico escolar",
      "Organização de anexos e documentos",
      "Fluxos para secretaria e direção",
    ],
  },
  {
    title: "Relatórios operacionais",
    items: [
      "Grade semanal",
      "Grade por turma",
      "Grade por sala",
      "Grade por professor",
      "Relatórios de faltas",
      "Relatórios de hora-atividade",
      "Relatórios para planejamento acadêmico",
    ],
  },
  {
    title: "Recursos de inteligência artificial",
    items: [
      "IA para setup inicial da escola",
      "IA para critérios e disponibilidade de professores",
      "IA para montagem de grade",
      "IA para identificação e resolução de conflitos",
      "IA para leitura e organização de documentos da pré-matrícula",
      "IA para apoio operacional na configuração do ambiente",
    ],
  },
];

type PlanCardConfig = {
  title: string;
  price: string;
  note: string;
  action: ReactNode;
  badge?: string;
  highlight?: boolean;
  selected?: boolean;
  footer?: ReactNode;
};

export function PlansCatalog({
  cards,
  topNote,
  checkoutNote,
}: {
  cards: PlanCardConfig[];
  topNote?: ReactNode;
  checkoutNote?: ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Escolha a vigência e libere a plataforma completa</div>
            <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              Todos os planos liberam os mesmos recursos. A diferença entre teste grátis, mensal e anual está apenas no período de uso e na forma de cobrança.
            </div>
          </div>
          {checkoutNote ? <div className="text-xs text-zinc-500">{checkoutNote}</div> : null}
        </div>

        <div className="inline-flex rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100">
          {topNote ?? (
            <>
              Após a assinatura, sua escola libera acesso completo para direção, coordenação, secretaria, cadastros,
              grade, Novo Ensino Médio, documentos, relatórios e recursos com IA.
            </>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {cards.map((card) => (
            <PricingCard key={card.title} {...card} />
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {platformHighlights.map((item) => (
            <div key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
              <div className="text-sm font-semibold">{item.title}</div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          <div className="text-base font-semibold">Tudo o que a escola desbloqueia após assinar qualquer plano</div>
          <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            A lista abaixo vale para teste grátis, plano mensal e plano anual. Todos liberam os mesmos módulos e funcionalidades da plataforma.
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {releasedResources.map((group) => (
            <div key={group.title} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
              <div className="text-base font-semibold">{group.title}</div>
              <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-base font-semibold">Todos os planos, os mesmos recursos</div>
              <p className="mt-2 max-w-3xl text-sm text-zinc-700 dark:text-zinc-300">
                Escolha a vigência que faz mais sentido para a sua escola. Ao concluir a assinatura, a plataforma libera os mesmos módulos para direção, coordenação, secretaria e equipe pedagógica.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              {checkoutNote ?? "Checkout seguro via Stripe."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingCard({
  title,
  price,
  note,
  action,
  badge,
  highlight,
  selected,
  footer,
}: PlanCardConfig) {
  const highlighted = Boolean(badge || highlight);

  return (
    <div
      className={
        "flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-950 " +
        (selected
          ? "border-zinc-900 dark:border-white "
          : highlighted
            ? "border-zinc-300 dark:border-zinc-700 "
            : "border-zinc-200 dark:border-zinc-900 ")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{price}</div>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{note}</p>
        </div>
        {badge ? (
          <span className="badge">{badge}</span>
        ) : highlight ? (
          <span className="badge">Mais escolhido</span>
        ) : null}
      </div>

      <ul className="mt-6 grow space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
        {sharedPlanFeatures.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span className="mt-1">•</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">{action}</div>
      {footer ? <div className="mt-2 text-xs text-zinc-500">{footer}</div> : null}
    </div>
  );
}
