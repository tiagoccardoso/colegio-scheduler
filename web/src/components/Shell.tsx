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
              <div className="grid gap-4">
                <div className="flex items-start justify-between gap-4">
                  <Link href={safeHome} className="flex min-w-0 items-center gap-3" aria-label="Ir para o início">
                    <SchoolLogoMark />
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        <SchoolNameLabel />
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2">
                    <HelpIconLink />
                    <LogoutButton />
                    {hasMenu ? (
                      <MobileNav homeHref={safeHome} sections={roleNavSections} isSubscribed={isSubscribed} />
                    ) : null}
                  </div>
                </div>

                {hasMenu ? (
                  <div className="hidden w-full border-t border-zinc-200/60 pt-4 dark:border-zinc-800/60 lg:flex">
                    <NavLinks variant="top" sections={roleNavSections} isSubscribed={isSubscribed} />
                  </div>
                ) : null}
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
                    className={"btn btn-ghost h-8 w-8 rounded-full px-0" + (subtitle ? " mt-7" : " mt-2")}
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
