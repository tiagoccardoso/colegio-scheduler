import Link from "next/link";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { DashboardSetupChat } from "@/components/DashboardSetupChat";
import { PlansCatalog } from "@/components/PlansCatalog";
import { getNavSections } from "@/components/nav";
import { requireStaff } from "@/lib/require-staff";
import { decodeMsg } from "@/lib/flash";
import { getEffectiveAccess, getSchoolSubscription } from "@/lib/billing";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};
  const isDirector = profile.role === "director";

  const selectedPlan = ((): "trial" | "monthly" | "yearly" => {
    const p = typeof sp.plan === "string" ? sp.plan : "";
    if (p === "trial") return "trial";
    return p === "yearly" ? "yearly" : "monthly";
  })();

  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

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

  // Usado apenas para exibir/desabilitar o card de teste grátis no dashboard bloqueado.
  // A regra de verdade continua sendo aplicada em /billing (server action).
  const sub = await getSchoolSubscription(supabase as any, profile.school_id);
  const hasEverSubscribed = Boolean(sub?.stripe_subscription_id || sub?.status);
  const trialDaysLabel = process.env.NEXT_PUBLIC_TRIAL_DAYS ?? process.env.STRIPE_TRIAL_DAYS ?? "7";

  return (
    <Shell
      title="Dashboard"
      subtitle={profile.full_name ? `Olá, ${profile.full_name}` : "Olá!"}
      isSubscribed={active}
      navSections={navSections}
      homeHref="/dashboard"
    >
      <div className="grid gap-4">
        {error ? <Flash message={error} variant="error" /> : null}

        {!active ? (
          isDirector ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="font-semibold">Sistema bloqueado até concluir a assinatura</div>
                <div className="mt-1">
                  O menu já aparece aqui para você conhecer as opções, mas tudo fica indisponível até a confirmação do
                  plano.
                </div>
              </div>

              <div className="panel p-5">
                <PlansCatalog
                  checkoutNote="Checkout seguro via Stripe. Após a confirmação, o sistema é liberado automaticamente."
                  topNote={
                    <>
                      Após a assinatura, sua escola libera acesso completo para direção, coordenação, secretaria,
                      cadastros, grade, Novo Ensino Médio, documentos, relatórios e recursos com IA.
                      <span className="block mt-1 text-xs font-normal text-zinc-600 dark:text-zinc-400">
                        Primeira assinatura ganha teste grátis de {trialDaysLabel} dias (cartão obrigatório).
                      </span>
                    </>
                  }
                  cards={[
                    {
                      title: "Teste grátis",
                      price: `R$ 0 por ${trialDaysLabel} dias`,
                      note: `Experimente sem custo por ${trialDaysLabel} dias. Após o período de teste, a cobrança continua no plano mensal.`,
                      badge: "Comece aqui",
                      selected: selectedPlan === "trial",
                      action: hasEverSubscribed ? (
                        <div
                          className="btn btn-primary w-full opacity-50 cursor-not-allowed"
                          title="Teste grátis disponível apenas na primeira assinatura do colégio."
                          aria-disabled="true"
                        >
                          Teste já utilizado
                        </div>
                      ) : (
                        <Link className="btn btn-primary w-full" href="/billing?plan=trial">
                          Começar teste grátis
                        </Link>
                      ),
                      footer: hasEverSubscribed ? "Disponível apenas na primeira assinatura desta escola." : undefined,
                    },
                    {
                      title: "Mensal",
                      price: process.env.NEXT_PUBLIC_PLAN_MONTHLY_PRICE ?? "Mensal",
                      note: "Renovação automática. Cancele quando quiser. Libera exatamente os mesmos recursos dos outros planos.",
                      selected: selectedPlan === "monthly",
                      action: (
                        <Link className="btn btn-primary w-full" href="/billing?plan=monthly">
                          Assinar mensal
                        </Link>
                      ),
                    },
                    {
                      title: "Anual",
                      price: process.env.NEXT_PUBLIC_PLAN_YEARLY_PRICE ?? "Anual",
                      note: "Economize e tenha previsibilidade no ano todo. Libera exatamente os mesmos recursos dos outros planos.",
                      highlight: true,
                      selected: selectedPlan === "yearly",
                      action: (
                        <Link className="btn btn-primary w-full" href="/billing?plan=yearly">
                          Assinar anual
                        </Link>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="font-semibold">Sistema bloqueado</div>
                <div className="mt-1">
                  A assinatura ainda não foi concluída. Peça ao diretor para finalizar em <strong>Assinaturas</strong>.
                </div>
                <div className="mt-3">
                  <Link className="btn btn-primary" href="/help">
                    Ver ajuda
                  </Link>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">Fluxo recomendado</h2>
                <Link
                  href="/director/calendario"
                  className="btn btn-secondary"
                  title="Abrir calendário do diretor"
                >
                  Calendário
                </Link>
              </div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                <li>
                  Cadastre <strong>Disciplinas</strong> e classifique FGB, itinerários, técnico, Projeto de Vida e educação digital
                </li>
                <li>
                  Cadastre <strong>Salas</strong>
                </li>
                <li>
                  Cadastre <strong>Turmas</strong> com coorte, série e modelo de oferta do Novo Ensino Médio
                </li>
                <li>
                  Configure o painel <strong>Novo Ensino Médio</strong> com as metas da rede
                </li>
                <li>
                  Cadastre <strong>Horários</strong>
                </li>
                <li>
                  Monte a <strong>Matriz Curricular</strong> por turma antes da grade, para não deixar a legislação refém do improviso semanal
                </li>
                <li>
                  Cadastre <strong>Professores</strong>
                </li>
                <li>
                  Cadastre <strong>Estudantes</strong> e registre matrícula, coorte, itinerário e Projeto de Vida inicial
                </li>
                <li>
                  Monte a grade em <strong>Montar grade</strong>
                </li>
                <li>
                  Lance frequência, avaliação e alertas em <strong>Acompanhamento do aluno</strong>
                </li>
                <li>
                  Consolide <strong>Histórico e trilhas</strong> para acompanhar horas, progressão e formação técnica
                </li>
                <li>
                  Revise <strong>Permanência NEM</strong> e <strong>Relatórios NEM</strong> no painel do diretor
                </li>
                <li>
                  Configure <strong>Documentos NEM</strong> e emita declarações em <strong>Documentos do aluno</strong>
                </li>
              </ol>
            </div>
          </div>
        )}
        {active && isDirector ? <DashboardSetupChat /> : null}
      </div>
    </Shell>
  );
}
