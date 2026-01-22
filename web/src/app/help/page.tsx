import Link from "next/link";

import { Shell } from "@/components/Shell";
import { HelpChat } from "@/components/HelpChat";
import { getNavSections } from "@/components/nav";
import { requireDirector } from "@/lib/require-director";
import { getSchoolSubscription, getUserAccessOverride, isSubscriptionActive, isUserOverrideActive } from "@/lib/billing";

export default async function HelpPage() {
  const { supabase, profile } = await requireDirector();

  const sub = await getSchoolSubscription(supabase as any, profile.school_id);
  const override = await getUserAccessOverride(supabase as any, profile.user_id);
  const active = isSubscriptionActive(sub?.status) || isUserOverrideActive(override);
  const navSections = getNavSections({ subscribed: active });

  return (
    <Shell
      title="Ajuda"
      subtitle="Tutorial rápido do Colégio Scheduler + um chat para tirar dúvidas exclusivamente sobre o uso do sistema."
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
                Em <strong>Cadastros</strong>, crie <strong>Disciplinas</strong>, <strong>Salas</strong>, <strong>Turmas</strong> e <strong>Horários</strong>.
              </li>
              <li>
                Cadastre <strong>Professores</strong> e configure: disciplina principal, salas permitidas, turmas atendidas e disponibilidade.
              </li>
              <li>
                Vá em <strong>Montar grade</strong> e selecione o <strong>turno</strong>. Ao entrar, o sistema monta a grade geral automaticamente quando ainda não existe.
              </li>
              <li>
                Use os relatórios em <strong>Relatórios</strong> para revisar e ajustar: por turma, por sala e por professor.
              </li>
            </ol>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-900 dark:bg-zinc-950">
              <div className="font-semibold">Atalho útil</div>
              <div className="mt-1 text-zinc-700 dark:text-zinc-300">
                O botão <strong>Assinaturas</strong> fica no topo do painel. Ele libera o acesso completo quando a assinatura estiver ativa.
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
                    O sistema funciona melhor quando os cadastros estão completos. Siga esta ordem:
                    <strong> Disciplinas → Salas → Turmas → Horários → Professores</strong>.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      <strong>Horários</strong>: cadastre por dia (Seg–Sex) e por período (1º, 2º, 3º...), vinculando ao turno.
                    </li>
                    <li>
                      <strong>Professores</strong>: defina disciplina, turnos atendidos e disponibilidade por dia/período (isso evita conflitos).
                    </li>
                  </ul>
                </div>
              </details>

              <details className="panel-inner p-4">
                <summary className="cursor-pointer text-sm font-semibold">Montar grade</summary>
                <div className="mt-3 grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <p>
                    Ao abrir <strong>Montar grade</strong>, o sistema monta a grade geral do turno (todas as turmas) usando o cadastro dos professores e a Hora Atividade (HA).
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
                <summary className="cursor-pointer text-sm font-semibold">Relatórios</summary>
                <div className="mt-3 grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      <strong>Grade semanal</strong>: visão geral do turno.
                    </li>
                    <li>
                      <strong>Grade por turma/sala/professor</strong>: ideal para validar conflitos e imprimir.
                    </li>
                    <li>
                      <strong>Hora Atividade</strong>: mostra bloqueios de HA por professor (importante para a montagem da grade).
                    </li>
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
