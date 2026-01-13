import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalizeShift(v: any) {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return "MANHA";
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return key;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shift = normalizeShift(url.searchParams.get("shift") || "MANHA");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.school_id) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 400 });
    if (profile.role !== "director") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    const schoolId = profile.school_id;

    const { data: timeSlots } = await supabase
      .from("time_slots")
      .select("id")
      .eq("school_id", schoolId)
      .eq("shift", shift)
      .in("weekday", [1, 2, 3, 4, 5]);

    const timeSlotIds = ((timeSlots as any[]) ?? []).map((t) => t.id).filter(Boolean);
    if (timeSlotIds.length === 0) {
      return NextResponse.json({ ok: true, shift, hasGrade: false, aulaCount: 0 });
    }

    // Precisamos considerar que algumas bases antigas podem não ter a coluna activity_type.
    let aulaCount = 0;
    {
      const { data, error } = await supabase
        .from("schedules")
        .select("id,class_id,activity_type")
        .eq("school_id", schoolId)
        .in("time_slot_id", timeSlotIds);

      if (error) {
        // DB antigo (sem activity_type): considerar tudo como aula, desde que tenha class_id.
        const { data: legacy } = await supabase
          .from("schedules")
          .select("id,class_id")
          .eq("school_id", schoolId)
          .in("time_slot_id", timeSlotIds);
        aulaCount = ((legacy as any[]) ?? []).filter((r) => Boolean(r?.class_id)).length;
      } else {
        aulaCount = ((data as any[]) ?? []).filter((r) => {
          if (!r?.class_id) return false;
          const t = String(r?.activity_type ?? "").trim().toUpperCase();
          return t !== "HA";
        }).length;
      }
    }

    return NextResponse.json({ ok: true, shift, hasGrade: aulaCount > 0, aulaCount });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
