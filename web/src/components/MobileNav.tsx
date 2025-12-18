"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";
import { LogoutButton } from "@/components/LogoutButton";

function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M3 5h14a1 1 0 1 0 0-2H3a1 1 0 1 0 0 2Zm14 4H3a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2Zm0 6H3a1 1 0 0 0 0 2h14a1 1 0 1 0 0-2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" />
    </svg>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900 lg:hidden"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center justify-between">
              <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
                Colégio Scheduler
              </Link>
              <LogoutButton />
            </div>

            <div className="mt-4 panel p-2">
              <NavLinks variant="sidebar" />
            </div>

            <p className="mt-8 text-xs text-zinc-500">MVP — Colégio Scheduler</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
