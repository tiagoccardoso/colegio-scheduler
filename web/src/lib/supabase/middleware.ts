import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  // Rotas que precisam funcionar sem assinatura (ou sem login)
  if (pathname === "/") return true;
  if (pathname.startsWith("/login")) return true;
  if (pathname.startsWith("/reset-password")) return true;
  if (pathname.startsWith("/auth/callback")) return true;
  if (pathname.startsWith("/onboarding")) return true;
  if (pathname.startsWith("/forbidden")) return true;

  // Billing
  if (pathname.startsWith("/billing")) return true;

  // Ajuda (acessível mesmo sem assinatura ativa)
  if (pathname.startsWith("/help")) return true;
  if (pathname.startsWith("/api/ai/help")) return true;

  // Stripe webhook precisa ser público (chamado pelo Stripe)
  if (pathname.startsWith("/api/stripe/webhook")) return true;

  return false;
}

function isActiveStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

function isCourtesyActive(override: { access_override?: string | null; access_override_until?: string | null } | null) {
  if (!override) return false;
  if (override.access_override !== "complimentary") return false;
  if (!override.access_override_until) return true;

  const until = new Date(String(override.access_override_until));
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > Date.now();
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Guardar cookies que o Supabase pedir para setar (para conseguirmos repassar
  // mesmo se no final a resposta virar redirect/json).
  const pendingCookies: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
          pendingCookies.push(...cookiesToSet);

          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // refresh session cookies (se necessário)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Sem login: segue o fluxo normal (as páginas já redirecionam para /login quando necessário)
  if (!user) return response;

  // Rotas públicas/permitidas
  if (isPublicPath(pathname)) return response;

  // Proteção por assinatura:
  // 1) precisa ter perfil (school_id)
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.school_id) {
    const url = new URL("/onboarding", request.url);
    const r = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) => r.cookies.set(name, value, options));
    return r;
  }

  // 2) precisa ter assinatura ativa da escola
  const { data: sub } = await supabase
    .from("school_subscriptions")
    .select("status")
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (isActiveStatus((sub as any)?.status)) return response;

  // 3) Cortesia por usuário (override) — libera acesso mesmo sem Stripe.
  // Observação: se a tabela/policy não existir, apenas ignora e segue bloqueando.
  const { data: override, error: overrideError } = await supabase
    .from("user_access_overrides")
    .select("access_override, access_override_until")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!overrideError && isCourtesyActive((override as any) ?? null)) return response;

  // API: devolve erro (sem redirect)
  if (pathname.startsWith("/api/")) {
    const r = NextResponse.json({ error: "Pagamento requerido (assinatura não ativa)." }, { status: 402 });
    pendingCookies.forEach(({ name, value, options }) => r.cookies.set(name, value, options));
    return r;
  }

  // Páginas: manda para billing
  const url = new URL("/billing", request.url);
  url.searchParams.set("error", encodeURIComponent("Assinatura necessária para acessar o sistema."));

  const r = NextResponse.redirect(url);
  pendingCookies.forEach(({ name, value, options }) => r.cookies.set(name, value, options));
  return r;
}
