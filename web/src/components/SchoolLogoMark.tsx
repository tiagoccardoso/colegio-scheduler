"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "school-logos";
const logoPath = (schoolId: string) => `schools/${schoolId}/logo`;

function pickLogoFromList(schoolId: string, top: any[] | null | undefined, nested: any[] | null | undefined) {
  const base = `schools/${schoolId}`;

  const items: Array<{ path: string; size: number; mime: string; version: string; name: string }> = [];

  (top ?? []).forEach((it: any) => {
    const name = String(it?.name || "");
    if (!(name === "logo" || name.startsWith("logo."))) return;
    const size = Number(it?.metadata?.size ?? 0);
    const mime = String(it?.metadata?.mimetype ?? it?.metadata?.contentType ?? "");
    const updatedAt = String(it?.updated_at ?? it?.updatedAt ?? "");
    const version = updatedAt ? String(new Date(updatedAt).getTime()) : String(Date.now());
    items.push({ path: `${base}/${name}`, name, size, mime, version });
  });

  (nested ?? []).forEach((it: any) => {
    const name = String(it?.name || "");
    if (!name) return;
    const size = Number(it?.metadata?.size ?? 0);
    const mime = String(it?.metadata?.mimetype ?? it?.metadata?.contentType ?? "");
    const updatedAt = String(it?.updated_at ?? it?.updatedAt ?? "");
    const version = updatedAt ? String(new Date(updatedAt).getTime()) : String(Date.now());
    items.push({ path: `${base}/logo/${name}`, name, size, mime, version });
  });

  const preferred = items.find((x) => x.path === logoPath(schoolId));
  const byExt = items
    .filter((x) => x.name.startsWith("logo."))
    .sort((a, b) => {
      const order = ["png", "webp", "jpg", "jpeg", "svg"];
      const ea = a.name.split(".").pop() || "";
      const eb = b.name.split(".").pop() || "";
      return order.indexOf(ea) - order.indexOf(eb);
    })[0];
  const nestedFirst = items.find((x) => x.path.includes(`${base}/logo/`));

  const pick = preferred ?? byExt ?? nestedFirst;
  if (!pick) return null;
  if (!pick.size || (pick.mime && !pick.mime.startsWith("image/"))) return null;
  return pick;
}

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

        // Descobre se existe logo de verdade (e não “fantasma” de cache / arquivo vazio).
        const base = `schools/${schoolId}`;
        const { data: top } = await supabase.storage.from(BUCKET).list(base, { limit: 100 });
        const { data: nested } = await supabase.storage.from(BUCKET).list(`${base}/logo`, { limit: 100 });
        const picked = pickLogoFromList(schoolId, top as any, nested as any);
        if (!picked) return;

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(picked.path);
        const url = data?.publicUrl ? `${String(data.publicUrl)}?v=${picked.version}` : "";
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
