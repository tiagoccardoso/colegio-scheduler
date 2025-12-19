import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}

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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p> : null}
            </div>
            <LogoutButton />
          </div>

          <nav className="mt-4 flex flex-wrap gap-1">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/subjects">Disciplinas</NavLink>
            <NavLink href="/rooms">Salas</NavLink>
            <NavLink href="/classes">Turmas</NavLink>
            <NavLink href="/teachers">Professores</NavLink>
            <NavLink href="/time-slots">Horários</NavLink>
            <NavLink href="/schedule">Grade</NavLink>
          </nav>
        </header>

        <main className="mt-6">{children}</main>

        <footer className="mt-10 text-center text-xs text-zinc-500">
          MVP — Colégio Scheduler
        </footer>
      </div>
    </div>
  );
}
