"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Mostra o nome do colégio (schools.name) do usuário logado.
 * Fallback quando ainda não existe colégio/perfil: "Colégio Scheduler".
 */
export function SchoolNameLabel({ fallback = "Colégio Scheduler" }: { fallback?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState<string | null>(null);

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

        const { data: school } = await supabase
          .from("schools")
          .select("name")
          .eq("id", schoolId)
          .maybeSingle();

        const schoolName = String((school as any)?.name || "").trim();
        if (!schoolName) return;

        if (!cancelled) setName(schoolName);
      } catch {
        // Silencioso: fallback segue funcionando.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return <span>{name || fallback}</span>;
}
