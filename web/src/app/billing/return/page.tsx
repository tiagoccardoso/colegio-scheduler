import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireAuth } from "@/lib/require-auth";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, getOrCreateStripeCustomerId, isSubscriptionActive } from "@/lib/billing";
import { encodeMsg } from "@/lib/flash";

export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await requireAuth();
  const sp = (await searchParams) ?? {};
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : null;
  if (!sessionId) redirect("/billing?error=" + encodeMsg("session_id ausente."));

  const profile = await getProfile(supabase as any, user.id);
  if (!profile?.school_id) redirect("/onboarding");

  // Valida que o session_id é do próprio customer do usuário (evita “fuçar” sessão alheia)
  const stripeCustomerId = await getOrCreateStripeCustomerId({
    supabase: supabase as any,
    userId: user.id,
    schoolId: profile.school_id,
    email: user.email,
    createCustomer: ({ email, metadata }) => stripe.customers.create({ email: email ?? undefined, metadata }),
  });

  const checkout = await stripe.checkout.sessions.retrieve(sessionId);

  if (checkout.customer !== stripeCustomerId) {
    redirect("/billing?error=" + encodeMsg("Sessão inválida para este usuário."));
  }

  if (checkout.mode !== "subscription" || !checkout.subscription) {
    redirect("/billing?error=" + encodeMsg("Sessão não é de assinatura."));
  }

  const subscription = await stripe.subscriptions.retrieve(String(checkout.subscription));

  // Faz “fast sync” (o webhook continua sendo a fonte de verdade)
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

  const h = await headers();
  const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (isSubscriptionActive(subscription.status)) {
    redirect(`${origin}/dashboard`);
  }

  redirect(`/billing?error=${encodeMsg(`Pagamento não finalizado. Status da assinatura: ${subscription.status}`)}`);
}
