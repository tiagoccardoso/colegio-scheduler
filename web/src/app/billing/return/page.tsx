import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireDirector } from "@/lib/require-director";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateStripeCustomerId, isSubscriptionActive } from "@/lib/billing";
import { encodeMsg } from "@/lib/flash";

// Stripe Node SDK precisa do runtime Node.js.
export const runtime = "nodejs";

export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  if (!sessionId) redirect("/billing?error=" + encodeMsg("session_id ausente."));


  // Valida que o session_id é do próprio customer do usuário (evita “fuçar” sessão alheia)
  let stripeCustomerId: string;
  let checkout: any;
  try {
    stripeCustomerId = await getOrCreateStripeCustomerId({
      supabase: supabase as any,
      userId: user.id,
      schoolId: profile.school_id,
      email: user.email,
      createCustomer: ({ email, metadata }) => stripe.customers.create({ email: email ?? undefined, metadata }),
    });

    checkout = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err: any) {
    console.error("[billing] return handler failed", err);
    redirect("/billing?error=" + encodeMsg(String(err?.message ?? "Falha ao validar o pagamento.")));
  }

  if (checkout.customer !== stripeCustomerId) {
    redirect("/billing?error=" + encodeMsg("Sessão inválida para este usuário."));
  }

  if (checkout.mode !== "subscription" || !checkout.subscription) {
    redirect("/billing?error=" + encodeMsg("Sessão não é de assinatura."));
  }

  let subscription: any;
  try {
    subscription = await stripe.subscriptions.retrieve(String(checkout.subscription));
  } catch (err: any) {
    console.error("[billing] failed to retrieve subscription", err);
    redirect("/billing?error=" + encodeMsg(String(err?.message ?? "Falha ao consultar a assinatura.")));
  }

  // Faz “fast sync” (o webhook continua sendo a fonte de verdade)
  try {
    const admin = createAdminClient();
    await admin.from("school_subscriptions").upsert(
      {
        school_id: profile.school_id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        price_id: subscription.items.data[0]?.price?.id ?? null,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id" },
    );
  } catch (err: any) {
    console.error("[billing] fast sync failed", err);
    // Não bloqueia o usuário se o sync falhar — o webhook ainda deve atualizar.
  }

  const h = await headers();
  const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (isSubscriptionActive(subscription.status)) {
    redirect(`${origin}/dashboard`);
  }

  redirect(`/billing?error=${encodeMsg(`Pagamento não finalizado. Status da assinatura: ${subscription.status}`)}`);
}
