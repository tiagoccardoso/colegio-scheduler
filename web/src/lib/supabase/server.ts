import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: any };

export async function createClient() {
  // Next.js 16: cookies() is async.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Next.js (App Router): cookies can only be modified in a Server Action or Route Handler.
          // In Server Components this will throw. We intentionally ignore it and rely on middleware
          // (src/middleware.ts) to refresh the session and write cookies when needed.
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // no-op in Server Components
          }
        },
      },
    },
  );
}
