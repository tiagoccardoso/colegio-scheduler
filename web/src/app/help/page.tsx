import Link from "next/link";

import { Shell } from "@/components/Shell";
import { HelpChat } from "@/components/HelpChat";
import { getNavSections } from "@/components/nav";
import { requireStaff } from "@/lib/require-staff";
import { getEffectiveAccess } from "@/lib/billing";

export default async function HelpPage() {
  const { supabase, profile } = await requireStaff();

  const { data: school } = await supabase.from("schools").select("name").eq("id", profile.school_id).maybeSingle();
  const schoolName = String((school as any)?.name ?? "Colégio Scheduler").trim() || "Colégio Scheduler";

  const access = await getEffectiveAccess({
    supabase: supabase as any,
    profile: {
      user_id: profile.user_id,
      school_id: profile.school_id,
      role: profile.role as any,
      full_name: profile.full_name,
    },
  });
  const active = access.active;
  const navSections = getNavSections({ subscribed: active });

  return (
    <Shell
      title="Ajuda"
      subtitle={`Tutorial rápido de ${schoolName} com foco nas novas telas, no fluxo de cadastro completo e no uso do chat de ajuda para o Novo Ensino Médio.`}
      isSubscribed={active}
      navSections={navSections}
      homeHref="/dashboard"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4">
          <div className="panel p-5">
            <h2 className="text-lg font-semibold">Guia rápido (fluxo recomendado)</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>
                Em <strong>Disciplinas</strong>, classifique cada componente com tipo curricular, área do conhecimento, carga horária anual, aulas semanais sugeridas, eixo do itinerário, ementa e habilitação docente requerida.
              </li>
              <li>
                Em <strong>Salas</strong>, informe capacidade, bloco, acessibilidade e se a sala suporta educação digital ou formação técnica.
              </li>
              <li>
                Em <strong>Turmas</strong>, preencha série, ano letivo, coorte, versão curricular, modelo de oferta, eixo/nome do itinerário, capacidade, vagas e sala padrão.
              </li>
              <li>
                Em <strong>Horários</strong>, cadastre os períodos por turno e, em seguida, use a <strong>Matriz Curricular</strong> para distribuir disciplina + turma + aulas por semana antes de vincular os professores.
              </li>
              <li>
                Em <strong>Professores</strong>, registre CPF, titulação, área de habilitação, áreas adicionais, aptidão para NEM/técnico e só depois detalhe as habilitações por horário quando a grade automática realmente precisar delas.
              </li>
              <li>
                Em <strong>Estudantes</strong>, complete os dados civis, endereço, saúde, escola de origem, matrícula inicial, responsáveis, trilha inicial e depois anexe os documentos do estudante.
              </li>
              <li>
                Configure o painel <strong>Novo Ensino Médio</strong>, <strong>Documentos NEM</strong> e, depois, acompanhe em <strong>Permanência NEM</strong>, <strong>Histórico e trilhas</strong> e <strong>Documentos do aluno</strong>.
              </li>
              <li>
                Só depois siga para <strong>Montar grade</strong> e para os relatórios.
              </li>
            </ol>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-900 dark:bg-zinc-950">
              <div className="font-semibold">Atalho útil</div>
              <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                {schoolName} agora usa o menu <strong>Ajuda</strong> para descrever o fluxo completo e o chat do dashboard pode preparar cadastros com os novos campos. O botão <strong>Assinaturas</strong> continua liberando o acesso completo quando a assinatura estiver ativa.
              </div>
              <div className="mt-3">
                <Link className="btn btn-secondary" href="/dashboard">
                  Voltar ao dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-lg font-semibold">Tutoriais por área</h2>
            <div className="mt-3 grid gap-3">
              <details className="panel-inner p-4">
                <summary className="cursor-pointer text-sm font-semibold">Cadastros</summary>
                <div className="mt-3 grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <p>
                    O sistema funciona melhor quando os cadastros estão completos. Ordem recomendada:
                    <strong> Disciplinas → Salas → Turmas → Horários → Matriz Curricular → Professores → Estudantes → Painéis NEM → Montar grade</strong>.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      <strong>Disciplinas</strong>: complete classificação NEM, carga anual, aulas semanais, ementa e habilitação requerida.
                    </li>
                    <li>
                      <strong>Turmas</strong>: não deixe em branco série, coorte, ano letivo, oferta, eixo/nome do itinerário, capacidade e vagas.
                    </li>
                    <li>
                      <strong>Professores</strong>: além da disponibilidade, registre titulação, licensure_area, áreas adicionais e aptidão para NEM/técnico.
                    </li>
                    <li>
                      <strong>Estudantes</strong>: salve primeiro o cadastro completo, depois complemente responsáveis, documentos, histórico e trilhas quando necessário.
                    </li>
                  </ul>
                </div>
              </details>

              <details className="panel-inner p-4">
                <summary className="cursor-pointer text-sm font-semibold">Montar grade</summary>
                <div className="mt-3 grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <p>
                    Ao abrir <strong>Montar grade</strong>, o sistema monta a grade geral do turno (todas as turmas) usando o cadastro dos professores, a Hora Atividade (HA) e, quando existir, a matriz curricular por turma.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      Se a grade do turno ainda não existir, ela é gerada automaticamente.
                    </li>
                    <li>
                      Se aparecerem conflitos, revise disponibilidade do professor, salas ocupadas e as regras de atendimento (turmas/salas permitidas).
                    </li>
                    <li>
                      Quando a IA estiver habilitada, você pode receber sugestões e geração assistida (quando disponível na sua tela).
                    </li>
                  </ul>
                </div>
              </details>

              <details className="panel-inner p-4">
                <summary className="cursor-pointer text-sm font-semibold">Direção, acompanhamento e documentos</summary>
                <div className="mt-3 grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <ul className="list-disc space-y-1 pl-5">
                    <li><strong>Novo Ensino Médio</strong>: define a régua da rede, currículo estadual, componentes obrigatórios monitorados e validações automáticas.</li>
                    <li><strong>Permanência NEM</strong> e <strong>Relatórios NEM</strong>: acompanham risco, coortes, trilhas e lacunas documentais.</li>
                    <li><strong>Histórico e trilhas</strong>: consolida horas, resultado anual e progresso técnico do estudante.</li>
                    <li><strong>Documentos NEM</strong> e <strong>Documentos do aluno</strong>: configuram layout institucional, emissão e consulta de documentos escolares.</li>
                    <li><strong>Relatórios</strong>: continuam sendo a saída para grade semanal, por turma, sala, professor, faltas e HA.</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>
        </div>

        <HelpChat enabled={process.env.AI_SCHEDULER_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY)} />
      </div>
    </Shell>
  );
}
