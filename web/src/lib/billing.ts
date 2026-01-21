import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type BillingProfile = {
  user_id: string;
  school_id: string;
  role: "director" | "teacher";
  full_name: string | null;
};

export type SchoolSubscription = {
  school_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  updated_at: string | null;
};

export type UserAccessOverride = {
  user_id: string;
  access_override: string | null;
  access_override_until: string | null;
  note: string | null;
};

export function isSubscriptionActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export function isUserOverrideActive(override: UserAccessOverride | null | undefined) {
  if (!override) return false;
  if (override.access_override !== "complimentary") return false;
  if (!override.access_override_until) return true;

  const until = new Date(String(override.access_override_until));
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > Date.now();
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<BillingProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, school_id, role, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  return (data as any) ?? null;
}

export async function getSchoolSubscription(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<SchoolSubscription | null> {
  const { data } = await supabase
    .from("school_subscriptions")
    .select(
      "school_id, stripe_customer_id, stripe_subscription_id, status, price_id, current_period_end, cancel_at_period_end, updated_at",
    )
    .eq("school_id", schoolId)
    .maybeSingle();

  return (data as any) ?? null;
}

export async function getUserAccessOverride(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAccessOverride | null> {
  const { data, error } = await supabase
    .from("user_access_overrides")
    .select("user_id, access_override, access_override_until, note")
    .eq("user_id", userId)
    .maybeSingle();

  // Se a tabela ainda não existe, não quebra o app.
  if (error) return null;
  return (data as any) ?? null;
}

export async function getOrCreateStripeCustomerId(params: {
  supabase: SupabaseClient;
  userId: string;
  schoolId: string;
  email?: string | null;
  createCustomer: (p: { email?: string | null; metadata: Record<string, string> }) => Promise<{ id: string }>;
}) {
  const { supabase, userId, schoolId, email, createCustomer } = params;

  const { data: existing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const stripe_customer_id = (existing as any)?.stripe_customer_id as string | undefined;
  if (stripe_customer_id) return stripe_customer_id;

  const customer = await createCustomer({
    email: email ?? undefined,
    metadata: { user_id: userId, school_id: schoolId },
  });

  // Guarda o mapeamento (user/school -> stripe_customer_id)
  const { error } = await supabase
    .from("billing_customers")
    .upsert({ user_id: userId, school_id: schoolId, stripe_customer_id: customer.id }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);

  return customer.id;
}
