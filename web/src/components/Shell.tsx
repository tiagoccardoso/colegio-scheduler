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

type MenuMode = "auto" | "pinned" | "hidden";

function AutoModeIcon() {
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
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="M5.64 5.64l2.83 2.83" />
      <path d="M15.53 15.53l2.83 2.83" />
      <path d="M18.36 5.64l-2.83 2.83" />
      <path d="M8.47 15.53l-2.83 2.83" />
    </svg>
  );
}

function PinIcon() {
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
      <path d="M12 17v5" />
      <path d="M5 9l6-6" />
      <path d="M13 5l6 6" />
      <path d="M8 12l8 0" />
      <path d="M9 12l-2 5" />
      <path d="M15 12l2 5" />
    </svg>
  );
}

function HideIcon() {
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
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7-.37.78-.82 1.51-1.34 2.18" />
      <path d="M6.61 6.61C4.62 7.88 3.04 9.76 2 12c1.73 3.89 6 7 10 7 1.55 0 3.03-.31 4.37-.88" />
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
  const [menuMode, setMenuMode] = useState<MenuMode>("auto");
  const [isAutoReveal, setIsAutoReveal] = useState(false);

  useEffect(() => {
    try {
      const mode = window.localStorage.getItem("ui:topMenuMode") as MenuMode | null;
      const legacyHidden = window.localStorage.getItem("ui:topMenuHidden");
      if (mode === "auto" || mode === "pinned" || mode === "hidden") {
        setMenuMode(mode);
      } else if (legacyHidden === "1") {
        setMenuMode("hidden");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("ui:topMenuMode", menuMode);
      window.localStorage.removeItem("ui:topMenuHidden");
    } catch {
      // ignore
    }
  }, [menuMode]);

  useEffect(() => {
    if (menuMode !== "auto") setIsAutoReveal(false);
  }, [menuMode]);

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
  const isTopMenuVisible = hasMenu && (menuMode === "pinned" || (menuMode === "auto" && isAutoReveal));

  return (
    <div className="min-h-screen">
      {hasMenu && menuMode === "auto" && !isTopMenuVisible ? (
        <div
          className="fixed inset-x-0 top-0 z-50 h-5"
          onMouseEnter={() => setIsAutoReveal(true)}
          aria-hidden="true"
        />
      ) : null}

      <header className={"sticky top-0 z-40 " + (isTopMenuVisible ? "pt-4" : "pt-2")}>
        <div className="page-container">
          <div
            className="panel px-4 py-4"
            onMouseEnter={() => {
              if (menuMode === "auto") setIsAutoReveal(true);
            }}
            onMouseLeave={() => {
              if (menuMode === "auto") setIsAutoReveal(false);
            }}
          >
            {isTopMenuVisible ? (
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

            <div className={isTopMenuVisible ? "mt-4 border-t border-zinc-200/60 pt-4 dark:border-zinc-800/60" : ""}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                  {subtitle ? <p className="mt-1 muted max-w-3xl">{subtitle}</p> : null}
                </div>

                {hasMenu ? (
                  <div className={"panel-inner flex items-center gap-1 p-1" + (subtitle ? " mt-7" : " mt-2")}>
                    <button
                      type="button"
                      className={
                        "btn h-8 rounded-full px-3 text-xs font-semibold " +
                        (menuMode === "auto" ? "btn-primary" : "btn-ghost")
                      }
                      aria-label="Modo automático do menu"
                      title="Modo automático do menu"
                      aria-pressed={menuMode === "auto"}
                      onClick={() => setMenuMode("auto")}
                    >
                      <AutoModeIcon />
                      <span className="hidden sm:inline">Auto</span>
                    </button>
                    <button
                      type="button"
                      className={
                        "btn h-8 rounded-full px-3 text-xs font-semibold " +
                        (menuMode === "pinned" ? "btn-primary" : "btn-ghost")
                      }
                      aria-label="Fixar menu"
                      title="Fixar menu"
                      aria-pressed={menuMode === "pinned"}
                      onClick={() => setMenuMode("pinned")}
                    >
                      <PinIcon />
                      <span className="hidden sm:inline">Fixar</span>
                    </button>
                    <button
                      type="button"
                      className={
                        "btn h-8 rounded-full px-3 text-xs font-semibold " +
                        (menuMode === "hidden" ? "btn-primary" : "btn-ghost")
                      }
                      aria-label="Ocultar menu"
                      title="Ocultar menu"
                      aria-pressed={menuMode === "hidden"}
                      onClick={() => setMenuMode("hidden")}
                    >
                      <HideIcon />
                      <span className="hidden sm:inline">Ocultar</span>
                    </button>
                  </div>
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
