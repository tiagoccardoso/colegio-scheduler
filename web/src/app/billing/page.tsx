import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { getNavSections } from "@/components/nav";
import { requireAuth } from "@/lib/require-auth";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { stripe } from "@/lib/stripe";
import {
  getProfile,
  getSchoolSubscription,
  getUserAccessOverride,
  isSubscriptionActive,
  isUserOverrideActive,
  getOrCreateStripeCustomerId,
} from "@/lib/billing";

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireAuth();
  const sp = (await searchParams) ?? {};

  const selectedPlan = ((): "monthly" | "yearly" => {
    const p = typeof sp.plan === "string" ? sp.plan : "";
    return p === "yearly" ? "yearly" : "monthly";
  })();

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const profile = await getProfile(supabase as any, user.id);
  if (!profile?.school_id) redirect("/onboarding");

  const sub = await getSchoolSubscription(supabase as any, profile.school_id);
  const paidActive = isSubscriptionActive(sub?.status);

  const userOverride = await getUserAccessOverride(supabase as any, user.id);
  const courtesyActive = isUserOverrideActive(userOverride);

  // "Acesso" significa: assinatura paga ativa OU cortesia ativa.
  const hasAccess = paidActive || courtesyActive;

  async function startCheckout(formData: FormData) {
    "use server";
    const { supabase, user } = await requireAuth();
    const profile = await getProfile(supabase as any, user.id);
    if (!profile?.school_id) redirect("/onboarding");

    if (profile.role !== "director") {
      redirect("/billing?error=" + encodeMsg("Apenas o diretor pode contratar um plano."));
    }

    const h = await headers();
    const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const plan = String(formData.get("plan") ?? "monthly");
    const priceId =
      plan === "yearly" ? process.env.STRIPE_PRICE_ID_YEARLY : process.env.STRIPE_PRICE_ID_MONTHLY;

    if (!priceId) {
      redirect(
        "/billing?error=" +
          encodeMsg(
            plan === "yearly"
              ? "STRIPE_PRICE_ID_YEARLY não configurado."
              : "STRIPE_PRICE_ID_MONTHLY não configurado.",
          ),
      );
    }

    const stripeCustomerId = await getOrCreateStripeCustomerId({
      supabase: supabase as any,
      userId: user.id,
      schoolId: profile.school_id,
      email: user.email,
      createCustomer: ({ email, metadata }) => stripe.customers.create({ email: email ?? undefined, metadata }),
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing`,
      subscription_data: {
        metadata: { user_id: user.id, school_id: profile.school_id },
      },
      metadata: { user_id: user.id, school_id: profile.school_id },
    });

    if (!session.url) redirect("/billing?error=" + encodeMsg("Não foi possível iniciar o checkout."));
    redirect(session.url);
  }

  async function openPortal() {
    "use server";
    const { supabase, user } = await requireAuth();
    const profile = await getProfile(supabase as any, user.id);
    if (!profile?.school_id) redirect("/onboarding");

    const h = await headers();
    const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const stripeCustomerId = await getOrCreateStripeCustomerId({
      supabase: supabase as any,
      userId: user.id,
      schoolId: profile.school_id,
      email: user.email,
      createCustomer: ({ email, metadata }) => stripe.customers.create({ email: email ?? undefined, metadata }),
    });

    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/billing`,
    });

    redirect(portal.url);
  }

  async function cancelSubscription() {
    "use server";
    const { supabase, user } = await requireAuth();
    const profile = await getProfile(supabase as any, user.id);
    if (!profile?.school_id) redirect("/onboarding");

    if (profile.role !== "director") {
      redirect("/billing?error=" + encodeMsg("Apenas o diretor pode cancelar o plano."));
    }

    const sub = await getSchoolSubscription(supabase as any, profile.school_id);
    const subscriptionId = sub?.stripe_subscription_id;

    if (!subscriptionId) {
      redirect("/billing?error=" + encodeMsg("Nenhuma assinatura encontrada para cancelar."));
    }

    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    redirect(
      "/billing?msg=" +
        encodeMsg(
          "Cancelamento solicitado. A assinatura ficará ativa até o fim do período e o Stripe vai confirmar em instantes.",
        ),
    );
  }

  const navSections = getNavSections({ subscribed: hasAccess });

  return (
    <Shell
      title="Assinaturas"
      subtitle="Finalize sua assinatura para liberar o sistema"
      isSubscribed={hasAccess}
      navSections={navSections}
      homeHref={hasAccess ? "/dashboard" : "/billing"}
    >
      <div className="grid gap-4">
        {msg ? <Flash message={msg} variant="success" /> : null}
        {error ? <Flash message={error} variant="error" /> : null}

        <div className="panel p-5">
          <div className="grid gap-3">
            <div>
              <div className="text-sm font-semibold">Status</div>
              <div className="text-sm text-zinc-700 dark:text-zinc-300">
                {paidActive
                  ? "Ativa"
                  : courtesyActive
                    ? "Cortesia ativa"
                    : sub?.status
                      ? `Pendente (${sub.status})`
                      : "Nenhuma assinatura encontrada"}
              </div>
            </div>

            {paidActive ? (
              <div className="grid gap-3">
                {sub?.cancel_at_period_end ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    Cancelamento já está agendado para o fim do período.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <form action={openPortal}>
                    <button className="btn btn-primary" type="submit">
                      Gerenciar no Stripe
                    </button>
                  </form>

                  {profile.role === "director" && !sub?.cancel_at_period_end ? (
                    <form action={cancelSubscription}>
                      <button className="btn" type="submit">
                        Cancelar assinatura
                      </button>
                    </form>
                  ) : null}

                  {sub?.cancel_at_period_end ? (
                    <div className="text-xs text-zinc-500">
                      Cancelamento agendado. A assinatura fica ativa até o fim do período.
                    </div>
                  ) : null}

                  <a className="btn" href="/dashboard">
                    Ir para o sistema
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {courtesyActive ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <div className="font-semibold">Acesso liberado por cortesia</div>
                    <div className="mt-1 opacity-90">
                      Este usuário está com acesso ativo mesmo sem assinatura no Stripe.
                      {userOverride?.access_override_until ? (
                        <span>
                          {" "}Válido até <strong>{new Date(userOverride.access_override_until).toLocaleString()}</strong>.
                        </span>
                      ) : (
                        <span> Cortesia sem data de expiração.</span>
                      )}
                    </div>
                    {userOverride?.note ? <div className="mt-2 text-xs opacity-80">{userOverride.note}</div> : null}
                    <div className="mt-3">
                      <a className="btn btn-primary" href="/dashboard">
                        Ir para o sistema
                      </a>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-base font-semibold">Plano Profissional</div>
                      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                        Acesso completo ao gerador de grade e relatórios.
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">
                      Escolha mensal ou anual para continuar.
                    </div>
                  </div>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                    <li>Cadastros ilimitados (turmas, professores, salas)</li>
                    <li>Geração automática com IA (se habilitado)</li>
                    <li>Relatórios de grade (turma/sala/professor)</li>
                  </ul>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
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
                    <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      Pagamento recorrente mensal.
                    </div>
                    <form action={startCheckout} className="mt-4">
                      <input type="hidden" name="plan" value="monthly" />
                      <button className="btn btn-primary w-full" type="submit">
                        Assinar mensal
                      </button>
                    </form>
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
                    <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      Pagamento recorrente anual.
                    </div>
                    <form action={startCheckout} className="mt-4">
                      <input type="hidden" name="plan" value="yearly" />
                      <button className="btn btn-primary w-full" type="submit">
                        Assinar anual
                      </button>
                    </form>
                  </div>
                </div>

                <div className="text-xs text-zinc-500">
                  Você será redirecionado para o checkout seguro do Stripe.
                </div>

                {profile.role !== "director" ? (
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">
                    Observação: apenas o diretor do colégio pode contratar/alterar o plano.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
