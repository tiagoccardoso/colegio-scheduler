import Link from "next/link";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { getNavSections } from "@/components/nav";
import { requireStaff } from "@/lib/require-staff";
import { decodeMsg } from "@/lib/flash";
import {
  getEffectiveAccess,
} from "@/lib/billing";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};
  const isDirector = profile.role === "director";

  const selectedPlan = ((): "monthly" | "yearly" => {
    const p = typeof sp.plan === "string" ? sp.plan : "";
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-base font-semibold">Plano Profissional</div>
                    <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                      Escolha mensal ou anual para liberar cadastros, grade e relatórios.
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">Checkout seguro via Stripe.</div>
                </div>

                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  <li>Cadastros ilimitados (turmas, professores, salas)</li>
                  <li>Montagem de grade com revisão de conflitos</li>
                  <li>Relatórios (turma/sala/professor/hora atividade)</li>
                </ul>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div
                    className={
                      "rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-950 " +
                      (selectedPlan === "monthly"
                        ? "border-zinc-900 dark:border-white"
                        : "border-zinc-200 dark:border-zinc-900")
                    }
                  >
                    <div className="text-sm font-semibold">Mensal</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight">
                      {process.env.NEXT_PUBLIC_PLAN_MONTHLY_PRICE ?? "Mensal"}
                    </div>
                    <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Pagamento recorrente mensal.</div>
                    <Link className="btn btn-primary mt-4 w-full" href="/billing?plan=monthly">
                      Assinar mensal
                    </Link>
                  </div>

                  <div
                    className={
                      "rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-950 " +
                      (selectedPlan === "yearly"
                        ? "border-zinc-900 dark:border-white"
                        : "border-zinc-200 dark:border-zinc-900")
                    }
                  >
                    <div className="text-sm font-semibold">Anual</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight">
                      {process.env.NEXT_PUBLIC_PLAN_YEARLY_PRICE ?? "Anual"}
                    </div>
                    <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Pagamento recorrente anual.</div>
                    <Link className="btn btn-primary mt-4 w-full" href="/billing?plan=yearly">
                      Assinar anual
                    </Link>
                  </div>
                </div>

                <div className="mt-3 text-xs text-zinc-500">
                  Após a confirmação do Stripe, o sistema é liberado automaticamente.
                </div>
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
              <h2 className="text-lg font-semibold">Fluxo recomendado</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                <li>
                  Cadastre <strong>Disciplinas</strong>
                </li>
                <li>
                  Cadastre <strong>Salas</strong>
                </li>
                <li>
                  Cadastre <strong>Turmas</strong>
                </li>
                <li>
                  Cadastre <strong>Horários</strong>
                </li>
                <li>
                  Cadastre <strong>Professores</strong>
                </li>
                <li>
                  Monte a grade em <strong>Montar grade</strong>
                </li>
                <li>
                  Revise e ajuste em <strong>Relatórios</strong>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
