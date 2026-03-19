"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpIconLink } from "@/components/HelpIconLink";
import { LogoutButton } from "@/components/LogoutButton";
import { NavLinks } from "@/components/NavLinks";
import { type NavSection } from "@/components/nav";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}

export function MobileNav(props: { homeHref?: string; sections?: NavSection[]; isSubscribed?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const homeHref = props.homeHref ?? "/dashboard";

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
        className="btn btn-secondary h-10 w-10 px-0 lg:hidden"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        {open ? <XIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="absolute left-0 top-0 h-full w-[88%] max-w-[360px] overflow-y-auto rounded-r-3xl border-r border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <Link href={homeHref} className="text-sm font-semibold tracking-tight">
                Colégio Scheduler
              </Link>
              <div className="flex flex-col items-end gap-1">
                <HelpIconLink />
                <LogoutButton />
              </div>
            </div>

            <div className="mt-4 panel-solid p-2">
              <NavLinks variant="sidebar" sections={props.sections} isSubscribed={props.isSubscribed} />
            </div>

            <p className="mt-8 text-xs text-zinc-500">MVP — Colégio Scheduler</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
