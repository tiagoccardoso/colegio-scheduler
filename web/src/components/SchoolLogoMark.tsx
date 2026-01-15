"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "school-logos";
const logoPath = (schoolId: string) => `schools/${schoolId}/logo`;

/**
 * Mostra a marca do colégio, se houver uma logomarca enviada.
 * Fallback: selo "CS" (Colégio Scheduler).
 */
export function SchoolLogoMark() {
  const supabase = useMemo(() => createClient(), []);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const schoolId = String((profile as any)?.school_id || "").trim();
        if (!schoolId) return;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(logoPath(schoolId));
        const url = data?.publicUrl ? String(data.publicUrl) : "";
        if (!url) return;

        if (!cancelled) setLogoUrl(url);
      } catch {
        // Silencioso: fallback segue funcionando.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  if (!logoUrl || errored) {
    return (
      <span
        aria-hidden="true"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white shadow-sm"
      >
        CS
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-white/40 bg-white shadow-sm dark:border-zinc-800"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain"
        onError={() => setErrored(true)}
      />
    </span>
  );
}
