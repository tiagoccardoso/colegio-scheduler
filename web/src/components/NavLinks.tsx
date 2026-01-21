"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_SECTIONS, type NavSection } from "@/components/nav";

function LockIcon(props: { className?: string } = {}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={props.className ?? "h-4 w-4"}
    >
      <path
        fillRule="evenodd"
        d="M10 2a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V6a4 4 0 0 0-4-4Zm2 6V6a2 2 0 1 0-4 0v2h4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function NavLinks(
  props: { variant?: "top" | "sidebar"; sections?: NavSection[]; isSubscribed?: boolean } = {},
) {
  const pathname = usePathname();
  const router = useRouter();
  const variant = props.variant ?? "top";

  const sections = props.sections ?? NAV_SECTIONS;
  const isSubscribed = props.isSubscribed ?? true;

  const reportsSection = sections.find((s) => s.title === "Relatórios");
  const mainItems = sections
    .filter((s) => s.title !== "Relatórios")
    .flatMap((s) => s.items);

  const goBilling = () => router.push("/billing");

  const LinkItem = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;
    const locked = !isSubscribed && href !== "/billing";

    if (variant === "top") {
      if (locked) {
        return (
          <button
            key={href}
            type="button"
            onClick={goBilling}
            title="Bloqueado até concluir a assinatura"
            className={"nav-pill opacity-40 hover:opacity-60"}
          >
            <LockIcon className="h-4 w-4" />
            {label}
          </button>
        );
      }

      return (
        <Link key={href} href={href} className={"nav-pill " + (active ? "nav-pill-active" : "")}
        >
          {label}
        </Link>
      );
    }

    if (locked) {
      return (
        <button
          key={href}
          type="button"
          onClick={goBilling}
          title="Bloqueado até concluir a assinatura"
          className={
            "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition opacity-40 hover:opacity-60 " +
            "text-zinc-700 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-950/60"
          }
        >
          <LockIcon className="h-4 w-4" />
          {label}
        </button>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        className={
          "rounded-2xl px-3 py-2 text-sm font-semibold transition " +
          (active
            ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950"
            : "text-zinc-700 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-950/60")
        }
      >
        {label}
      </Link>
    );
  };

  const DropdownLinkItem = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;
    const locked = !isSubscribed && href !== "/billing";

    if (locked) {
      return (
        <button
          key={href}
          type="button"
          onClick={goBilling}
          title="Bloqueado até concluir a assinatura"
          className={
            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition opacity-40 hover:opacity-60 " +
            "text-zinc-700 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-900"
          }
        >
          <LockIcon className="h-4 w-4" />
          {label}
        </button>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        className={
          "block rounded-xl px-3 py-2 text-sm font-semibold transition " +
          (active
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
            : "text-zinc-700 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-900")
        }
      >
        {label}
      </Link>
    );
  };

  if (variant === "top") {
    const reportsLocked = !isSubscribed;
    return (
      <nav className="flex flex-wrap items-center gap-2">
        {mainItems.map((l) => (
          <LinkItem key={l.href} href={l.href} label={l.label} />
        ))}

        {reportsSection?.items?.length ? (
          <details key={pathname} className="relative">
            <summary
              className={
                "nav-pill list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden " +
                (reportsLocked ? "opacity-40 hover:opacity-60" : "")
              }
              title={reportsLocked ? "Bloqueado até concluir a assinatura" : undefined}
            >
              <span className="inline-flex items-center gap-2">
                {reportsLocked ? <LockIcon className="h-4 w-4" /> : null}
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

            <div className="absolute left-0 z-20 mt-2 min-w-[240px] panel p-1">
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
      {sections.map((section) => (
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
