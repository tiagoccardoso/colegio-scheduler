"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/components/nav";

export function NavLinks(props: { variant?: "top" | "sidebar" } = {}) {
  const pathname = usePathname();
  const variant = props.variant ?? "top";

  const reportsSection = NAV_SECTIONS.find((s) => s.title === "Relatórios");
  const mainItems = NAV_SECTIONS.filter((s) => s.title !== "Relatórios").flatMap((s) => s.items);

  const LinkItem = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;

    return (
      <Link
        key={href}
        href={href}
        className={
          (variant === "sidebar" ? "rounded-xl px-3 py-2" : "rounded-full px-3 py-1") +
          " text-sm transition " +
          (active
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")
        }
      >
        {label}
      </Link>
    );
  };

  const DropdownLinkItem = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={
          "block rounded-lg px-3 py-2 text-sm transition " +
          (active
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")
        }
      >
        {label}
      </Link>
    );
  };

  if (variant === "top") {
    return (
      <nav className="flex flex-wrap items-center gap-2">
        {mainItems.map((l) => (
          <LinkItem key={l.href} href={l.href} label={l.label} />
        ))}

        {reportsSection?.items?.length ? (
          <details key={pathname} className="relative">
            <summary
              className="list-none rounded-full px-3 py-1 text-sm transition text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer select-none [&::-webkit-details-marker]:hidden"
            >
              <span className="inline-flex items-center gap-2">
                {reportsSection.title}
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
              {reportsSection.items.map((l) => (
                <DropdownLinkItem key={l.href} href={l.href} label={l.label} />
              ))}
            </div>
          </details>
        ) : null}
      </nav>
    );
  }

  return (
    <nav className="grid gap-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="grid gap-1">
          <div className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {section.title}
          </div>

          {section.items.map((l) => (
            <LinkItem key={l.href} href={l.href} label={l.label} />
          ))}
        </div>
      ))}
    </nav>
  );
}
