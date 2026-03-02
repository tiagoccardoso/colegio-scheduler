import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Admin Supabase client (service role).
 * Used for server-side operations that require elevated privileges (e.g. Storage bucket creation/upload).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurado.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurado.");

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
