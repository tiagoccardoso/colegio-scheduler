import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

async function upsertSubscription(params: {
  schoolId: string;
  stripeCustomerId: string | null;
  sub: Stripe.Subscription;
}) {
  const admin = createAdminClient();
  const { schoolId, stripeCustomerId, sub } = params;

  await admin.from("school_subscriptions").upsert(
    {
      school_id: schoolId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: sub.id,
      status: sub.status,
      price_id: sub.items.data[0]?.price?.id ?? null,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "school_id" },
  );
}

async function resolveSchoolId(params: {
  stripeCustomerId: string | null;
  metadataSchoolId?: string | null;
}) {
  const { stripeCustomerId, metadataSchoolId } = params;

  if (isString(metadataSchoolId)) return metadataSchoolId;
  if (!isString(stripeCustomerId)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("billing_customers")
    .select("school_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  return (data as any)?.school_id ?? null;
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err?.message ?? "invalid signature"}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      // Assinaturas: criação/atualização/cancelamento
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const stripeCustomerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

        const schoolId = await resolveSchoolId({
          stripeCustomerId,
          metadataSchoolId: (sub.metadata as any)?.school_id ?? null,
        });

        if (schoolId) await upsertSubscription({ schoolId, stripeCustomerId, sub });
        break;
      }

      // Checkout (útil como fallback/observabilidade)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;

          const sub = await stripe.subscriptions.retrieve(String(session.subscription));

          const schoolId = await resolveSchoolId({
            stripeCustomerId,
            metadataSchoolId: (sub.metadata as any)?.school_id ?? (session.metadata as any)?.school_id ?? null,
          });

          if (schoolId) await upsertSubscription({ schoolId, stripeCustomerId, sub });
        }
        break;
      }

      // Pagamento falhou (opcional: disparar e-mail/alerta interno)
      case "invoice.payment_failed":
      case "invoice.paid":
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Webhook handler failed" }, { status: 500 });
  }
}
