import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function safeNextPath(next: string | null | undefined) {
  if (!next) return "/dashboard";
  // evita open redirect
  if (!next.startsWith("/")) return "/dashboard";
  return next;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  // Sempre redireciona para o próximo destino ao final.
  const redirectUrl = new URL(next, url.origin);
  let response = NextResponse.redirect(redirectUrl);

  if (!code) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Troca o code por sessão e grava cookies (essencial para confirmar troca de e-mail e recuperação de senha no SSR)
  await supabase.auth.exchangeCodeForSession(code);

  return response;
}
