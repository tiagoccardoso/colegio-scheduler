"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NAV_SECTIONS, type NavSection } from "@/components/nav";
import { createClient } from "@/lib/supabase/client";

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

  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState<string | null>(null);

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

  const sections = props.sections ?? NAV_SECTIONS;
  const isSubscribed = props.isSubscribed ?? true;
  const dropdownSectionTitles = new Set(["Direção", "Relatórios"]);

  const goBilling = () => router.push(isDirector ? "/billing" : "/help");

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
            className={"nav-pill opacity-55 hover:opacity-80"}
          >
            <LockIcon className="h-4 w-4" />
            {label}
          </button>
        );
      }

      return (
        <Link key={href} href={href} className={"nav-pill " + (active ? "nav-pill-active" : "")}>
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
            "flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition opacity-55 hover:bg-zinc-50 hover:opacity-80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
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
          "rounded-2xl border px-3 py-2 text-sm font-semibold shadow-sm transition " +
          (active
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900")
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
            "flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-semibold text-zinc-700 shadow-sm transition opacity-55 hover:bg-zinc-50 hover:opacity-80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
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
          "block rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition " +
          (active
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900")
        }
      >
        {label}
      </Link>
    );
  };

  if (variant === "top") {
    return (
      <nav className="flex w-full flex-wrap items-center gap-2">
        {sections.map((section) => {
          if (dropdownSectionTitles.has(section.title)) {
            const sectionLocked = !isSubscribed;
            return (
              <details key={`${section.title}-${pathname}`} className="relative">
                <summary
                  className={
                    "nav-pill list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden " +
                    (sectionLocked ? "opacity-55 hover:opacity-80" : "")
                  }
                  title={sectionLocked ? "Bloqueado até concluir a assinatura" : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    {sectionLocked ? <LockIcon className="h-4 w-4" /> : null}
                    {section.title}
                    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4 opacity-70">
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                </summary>

                <div className="absolute left-0 z-20 mt-2 min-w-[260px] rounded-3xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
                  {section.items.map((l) => (
                    <DropdownLinkItem key={l.href} href={l.href} label={l.label} />
                  ))}
                </div>
              </details>
            );
          }

          return section.items.map((l) => <LinkItem key={l.href} href={l.href} label={l.label} />);
        })}
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
