import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { PlansCatalog } from "@/components/PlansCatalog";
import { getNavSections } from "@/components/nav";
import { requireDirector } from "@/lib/require-director";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { stripe } from "@/lib/stripe";
import {
  getSchoolSubscription,
  getUserAccessOverride,
  isSubscriptionActive,
  isUserOverrideActive,
  getOrCreateStripeCustomerId,
} from "@/lib/billing";

// Stripe Node SDK precisa do runtime Node.js.
export const runtime = "nodejs";

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};

  const selectedPlan = ((): "trial" | "monthly" | "yearly" => {
    const p = typeof sp.plan === "string" ? sp.plan : "";
    if (p === "trial") return "trial";
    return p === "yearly" ? "yearly" : "monthly";
  })();

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const sub = await getSchoolSubscription(supabase as any, profile.school_id);
  const paidActive = isSubscriptionActive(sub?.status);
  const hasEverSubscribed = Boolean(sub?.stripe_subscription_id || sub?.status);

  const userOverride = await getUserAccessOverride(supabase as any, user.id);
  const courtesyActive = isUserOverrideActive(userOverride);

  // "Acesso" significa: assinatura paga ativa OU cortesia ativa.
  const hasAccess = paidActive || courtesyActive;
  const trialDaysLabel = process.env.NEXT_PUBLIC_TRIAL_DAYS ?? process.env.STRIPE_TRIAL_DAYS ?? "7";

  async function startCheckout(formData: FormData) {
    "use server";
    const { supabase, user, profile } = await requireDirector();

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

    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS ?? "7");

    // Trial só quando o usuário escolhe explicitamente o plano "trial"
    // e apenas para a primeira assinatura da escola (evita “trial infinito” via cancelamento/recompra).
    const existingSub = await getSchoolSubscription(supabase as any, profile.school_id);
    const hasEverSubscribed = Boolean(existingSub?.stripe_subscription_id || existingSub?.status);

    if (plan === "trial" && hasEverSubscribed) {
      redirect("/billing?error=" + encodeMsg("O teste grátis está disponível apenas na primeira assinatura desta escola."));
    }

    const enableTrial =
      plan === "trial" && !hasEverSubscribed && Number.isFinite(trialDays) && trialDays > 0;

    let sessionUrl: string | null = null;
    try {
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
        payment_method_collection: "always", // exige cartão mesmo durante trial
        subscription_data: {
          trial_period_days: enableTrial ? trialDays : undefined,
          // Mesmo exigindo cartão, isso deixa o comportamento explícito caso o método de pagamento falhe.
          trial_settings: {
            end_behavior: { missing_payment_method: "cancel" },
          },
          metadata: { user_id: user.id, school_id: profile.school_id },
        },
        metadata: { user_id: user.id, school_id: profile.school_id },
      });

      sessionUrl = session.url ?? null;
    } catch (err: any) {
      console.error("[billing] startCheckout failed", err);
      // Evita explodir com um 500 (tela de digest) e devolve algo acionável.
      const msg = String(err?.message ?? "Não foi possível iniciar o checkout.");
      redirect("/billing?error=" + encodeMsg(msg));
    }

    if (!sessionUrl) redirect("/billing?error=" + encodeMsg("Não foi possível iniciar o checkout."));
    redirect(sessionUrl);
  }

  async function openPortal() {
    "use server";
    const { supabase, user, profile } = await requireDirector();

    const h = await headers();
    const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    let portalUrl: string | null = null;
    try {
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

      portalUrl = portal.url ?? null;
    } catch (err: any) {
      console.error("[billing] openPortal failed", err);
      const msg = String(err?.message ?? "Não foi possível abrir o portal do Stripe.");
      redirect("/billing?error=" + encodeMsg(msg));
    }

    if (!portalUrl) redirect("/billing?error=" + encodeMsg("Não foi possível abrir o portal do Stripe."));
    redirect(portalUrl);
  }

  async function cancelSubscription() {
    "use server";
    const { supabase, profile } = await requireDirector();

    const sub = await getSchoolSubscription(supabase as any, profile.school_id);
    const subscriptionId = sub?.stripe_subscription_id;

    if (!subscriptionId) {
      redirect("/billing?error=" + encodeMsg("Nenhuma assinatura encontrada para cancelar."));
    }

    try {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    } catch (err: any) {
      console.error("[billing] cancelSubscription failed", err);
      const msg = String(err?.message ?? "Não foi possível solicitar o cancelamento.");
      redirect("/billing?error=" + encodeMsg(msg));
    }
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
              <div className="grid gap-4">
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

                <PlansCatalog
                  checkoutNote="Você será redirecionado para o checkout seguro do Stripe."
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
                      action: (
                        <form action={startCheckout}>
                          <input type="hidden" name="plan" value="trial" />
                          <button
                            className={"btn btn-primary w-full " + (hasEverSubscribed ? "opacity-50 cursor-not-allowed" : "")}
                            type="submit"
                            disabled={hasEverSubscribed}
                            title={hasEverSubscribed ? "Disponível apenas na primeira assinatura desta escola." : ""}
                          >
                            Começar teste grátis
                          </button>
                        </form>
                      ),
                      footer: hasEverSubscribed ? "Disponível apenas na primeira assinatura desta escola." : undefined,
                    },
                    {
                      title: "Mensal",
                      price: process.env.NEXT_PUBLIC_PLAN_MONTHLY_PRICE ?? "Mensal",
                      note: "Renovação automática. Cancele quando quiser. Libera exatamente os mesmos recursos dos outros planos.",
                      selected: selectedPlan === "monthly",
                      action: (
                        <form action={startCheckout}>
                          <input type="hidden" name="plan" value="monthly" />
                          <button className="btn btn-primary w-full" type="submit">
                            Assinar mensal
                          </button>
                        </form>
                      ),
                    },
                    {
                      title: "Anual",
                      price: process.env.NEXT_PUBLIC_PLAN_YEARLY_PRICE ?? "Anual",
                      note: "Economize e tenha previsibilidade no ano todo. Libera exatamente os mesmos recursos dos outros planos.",
                      highlight: true,
                      selected: selectedPlan === "yearly",
                      action: (
                        <form action={startCheckout}>
                          <input type="hidden" name="plan" value="yearly" />
                          <button className="btn btn-primary w-full" type="submit">
                            Assinar anual
                          </button>
                        </form>
                      ),
                    },
                  ]}
                />

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
