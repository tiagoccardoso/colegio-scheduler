import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { NAV_SECTIONS } from "./nav";

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

function ReportsDropdown({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <details className="relative">
      <summary
        className="list-none rounded-xl px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-white cursor-pointer select-none [&::-webkit-details-marker]:hidden"
      >
        <span className="inline-flex items-center gap-2">
          {title}
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 opacity-70">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </summary>

      <div className="absolute left-0 z-20 mt-1 min-w-[220px] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-900 dark:bg-zinc-950">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-900 dark:hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </details>
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
  const reportsSection = NAV_SECTIONS.find((s) => s.title === "Relatórios");
  const mainItems = NAV_SECTIONS.filter((s) => s.title !== "Relatórios").flatMap((s) => s.items);

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

          <nav className="mt-4 flex flex-wrap items-center gap-1">
            {mainItems.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}

            {reportsSection?.items?.length ? (
              <ReportsDropdown title={reportsSection.title} items={reportsSection.items} />
            ) : null}
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
