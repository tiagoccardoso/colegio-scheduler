"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/teachers", label: "Professores" },
  { href: "/classes", label: "Turmas" },
  { href: "/subjects", label: "Disciplinas" },
  { href: "/rooms", label: "Salas" },
  { href: "/time-slots", label: "Horários" },
  { href: "/schedule", label: "Grade" },
];

export function NavLinks({ variant = "pills" }: { variant?: "pills" | "sidebar" }) {
  const pathname = usePathname();

  return (
    <nav
      className={
        variant === "sidebar"
          ? "grid gap-1"
          : "flex flex-wrap items-center gap-2"
      }
    >
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              (variant === "sidebar"
                ? "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition "
                : "rounded-full px-3 py-1 text-sm transition ") +
              (active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")
            }
          >
            <span>{l.label}</span>
            {variant === "sidebar" && active ? (
              <span className="text-xs opacity-80">Atual</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
