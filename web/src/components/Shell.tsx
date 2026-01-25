"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { HelpIconLink } from "@/components/HelpIconLink";
import { MobileNav } from "@/components/MobileNav";
import { NavLinks } from "@/components/NavLinks";
import { SchoolLogoMark } from "@/components/SchoolLogoMark";
import { SchoolNameLabel } from "@/components/SchoolNameLabel";
import { NAV_SECTIONS, type NavSection } from "@/components/nav";
import { createClient } from "@/lib/supabase/client";

function MenuToggleIcon({ hidden }: { hidden: boolean }) {
  // Ícone simples (chevron) para alternar ocultação/exibição do menu.
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {hidden ? <path d="M6 10l6 6 6-6" /> : <path d="M6 14l6-6 6 6" />}
    </svg>
  );
}

export function Shell({
  title,
  subtitle,
  children,
  isSubscribed = true,
  navSections,
  homeHref,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  isSubscribed?: boolean;
  navSections?: NavSection[];
  homeHref?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<string | null>(null);
  const [isTopMenuHidden, setIsTopMenuHidden] = useState(false);

  // Persistência local: mantém a preferência do usuário ao trocar de páginas.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("ui:topMenuHidden");
      if (v === "1") setIsTopMenuHidden(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("ui:topMenuHidden", isTopMenuHidden ? "1" : "0");
    } catch {
      // ignore
    }
  }, [isTopMenuHidden]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const r = String((profile as any)?.role || "").trim();
        if (!cancelled) setRole(r || null);
      } catch {
        if (!cancelled) setRole(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const isDirector = role === "director";
  const isPedagogical = role === "pedagogical";
  const safeHome =
    homeHref ??
    (isDirector ? (isSubscribed ? "/dashboard" : "/billing") : isSubscribed ? "/dashboard" : "/help");

  const roleNavSections = navSections ?? NAV_SECTIONS;
  const hasMenu = (roleNavSections?.length ?? 0) > 0;
  return (
    <div className="min-h-screen">
      <header className={"sticky top-0 z-40 " + (isTopMenuHidden ? "pt-2" : "pt-4")}>
        <div className="page-container">
          <div className="panel px-4 py-4">
            {!isTopMenuHidden ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3">
                  <Link href={safeHome} className="shrink-0" aria-label="Ir para o início">
                    <SchoolLogoMark />
                  </Link>

                  <div className="leading-tight">
                    <Link
                      href={safeHome}
                      className="block text-xs font-semibold tracking-wide text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
                    >
                      <SchoolNameLabel />
                    </Link>
                    <Link
                      href={isDirector ? "/director" : isPedagogical ? "/team" : safeHome}
                      className="block text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                    >
                      {isDirector ? "Painel do diretor" : "Painel da equipe"}
                    </Link>

                    {isDirector ? (
                      <Link
                        href="/billing"
                        className={
                          "mt-2 inline-flex w-fit items-center rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition " +
                          (isSubscribed
                            ? "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                            : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100")
                        }
                        title={isSubscribed ? "Gerenciar/cancelar assinatura" : "Finalizar assinatura"}
                      >
                        Assinaturas
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {hasMenu ? (
                    <div className="hidden lg:flex">
                      <NavLinks variant="top" sections={roleNavSections} isSubscribed={isSubscribed} />
                    </div>
                  ) : null}

                  <div className="flex flex-col items-center gap-1">
                    <HelpIconLink />
                    <LogoutButton />
                  </div>
                  {hasMenu ? (
                    <MobileNav homeHref={safeHome} sections={roleNavSections} isSubscribed={isSubscribed} />
                  ) : null}
                </div>
              </div>
            ) : null}

            <div
              className={
                (isTopMenuHidden ? "" : "mt-4 border-t border-zinc-200/60 pt-4 dark:border-zinc-800/60") +
                ""
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                  {subtitle ? <p className="mt-1 muted max-w-3xl">{subtitle}</p> : null}
                </div>

                {hasMenu ? (
                  <button
                    type="button"
                    className={
                      "btn btn-ghost h-8 w-8 rounded-full px-0" +
                      (subtitle ? " mt-7" : " mt-2")
                    }
                    aria-label={isTopMenuHidden ? "Mostrar barra de menus" : "Ocultar barra de menus"}
                    title={isTopMenuHidden ? "Mostrar barra de menus" : "Ocultar barra de menus"}
                    aria-pressed={isTopMenuHidden}
                    onClick={() => setIsTopMenuHidden((v) => !v)}
                  >
                    <MenuToggleIcon hidden={isTopMenuHidden} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="page-container py-6">
        {children}

        <footer className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-500">
          MVP — Colégio Scheduler
        </footer>
      </main>
    </div>
  );
}