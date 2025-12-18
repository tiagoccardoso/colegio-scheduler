import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";
import { MobileNav } from "@/components/MobileNav";
import { NavLinks } from "@/components/NavLinks";

export function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="page-container py-6">
        <div className="flex gap-6">
          {/* Sidebar (desktop) */}
          <aside className="hidden w-[280px] shrink-0 lg:block">
            <div className="panel sticky top-6 p-4">
              <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
                Colégio Scheduler
              </Link>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Painel do diretor</p>

              <div className="mt-4">
                <NavLinks variant="sidebar" />
              </div>

              <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-900">
                <LogoutButton className="w-full justify-center" />
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0 flex-1">
            <header className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 lg:hidden">
                    <MobileNav />
                    <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
                      Colégio Scheduler
                    </Link>
                  </div>

                  <h1 className="mt-2 text-2xl font-semibold tracking-tight lg:mt-0">{title}</h1>
                  {subtitle ? <p className="mt-1 muted">{subtitle}</p> : null}
                </div>

                {/* Desktop logout (mobile logout lives inside the drawer) */}
                <div className="hidden lg:block">
                  <LogoutButton />
                </div>
              </div>

              <div className="mt-4 lg:hidden">
                <NavLinks />
              </div>
            </header>

            <main className="mt-6">{children}</main>

            <footer className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
              MVP — Colégio Scheduler
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
