import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
import { NavLinks } from "@/components/NavLinks";
import { SchoolLogoMark } from "@/components/SchoolLogoMark";
import { SchoolNameLabel } from "@/components/SchoolNameLabel";

export function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 pt-4">
        <div className="page-container">
          <div className="panel px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="shrink-0" aria-label="Ir para o dashboard">
                  <SchoolLogoMark />
                </Link>

                <div className="leading-tight">
                  <Link
                    href="/dashboard"
                    className="block text-xs font-semibold tracking-wide text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
                  >
                    <SchoolNameLabel />
                  </Link>
                  <Link
                    href="/director"
                    className="block text-sm font-semibold text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
                  >
                    Painel do diretor
                  </Link>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="hidden lg:flex">
                  <NavLinks variant="top" />
                </div>

                <LogoutButton />
                <MobileNav />
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