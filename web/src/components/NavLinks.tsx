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

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              "rounded-full px-3 py-1 text-sm transition " +
              (active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
