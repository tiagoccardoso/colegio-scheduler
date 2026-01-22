import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { HelpIconLink } from "@/components/HelpIconLink";
import { MobileNav } from "@/components/MobileNav";
import { NavLinks } from "@/components/NavLinks";
import { SchoolLogoMark } from "@/components/SchoolLogoMark";
import { SchoolNameLabel } from "@/components/SchoolNameLabel";
import { NAV_SECTIONS, type NavSection } from "@/components/nav";

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
  const safeHome = homeHref ?? (isSubscribed ? "/dashboard" : "/billing");
  const resolvedNavSections = navSections ?? NAV_SECTIONS;
  const hasMenu = (resolvedNavSections?.length ?? 0) > 0;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 pt-4">
        <div className="page-container">
          <div className="panel px-4 py-4">
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
                    href={isSubscribed ? "/director" : "/dashboard"}
                    className="block text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                  >
                    Painel do diretor
                  </Link>

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
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                {hasMenu ? (
                  <div className="hidden lg:flex">
                    <NavLinks variant="top" sections={resolvedNavSections} isSubscribed={isSubscribed} />
                  </div>
                ) : null}

                <div className="flex flex-col items-center gap-1">
                  <HelpIconLink />
                  <LogoutButton />
                </div>
                {hasMenu ? (
                  <MobileNav homeHref={safeHome} sections={resolvedNavSections} isSubscribed={isSubscribed} />
                ) : null}
              </div>
            </div>

            <div className="mt-4 border-t border-zinc-200/60 pt-4 dark:border-zinc-800/60">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="mt-1 muted max-w-3xl">{subtitle}</p> : null}
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