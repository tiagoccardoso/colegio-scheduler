import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/authz";

function normalizeShift(v: any) {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return "MANHA";
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return key;
}

export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const shift = normalizeShift(body?.shift || "MANHA");

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
    if (!isStaffRole((profile as any).role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    const schoolId = profile.school_id;

    const { data: timeSlots } = await supabase
      .from("time_slots")
      .select("id")
      .eq("school_id", schoolId)
      .eq("shift", shift)
      .in("weekday", [1, 2, 3, 4, 5]);

    const timeSlotIds = ((timeSlots as any[]) ?? []).map((t) => t.id).filter(Boolean);
    if (timeSlotIds.length === 0) {
      return NextResponse.json({ ok: true, shift, deleted: 0 });
    }

    // Preferir não apagar HA. Como bases antigas podem não ter activity_type,
    // tentamos primeiro com activity_type e, se falhar, apagamos apenas registros com class_id (aulas).
    // `delete()` pode ser tipado como `never` (e não retorna linhas por padrão).
    // Pedimos o `count` para obter quantos registros foram removidos sem depender de `data`.
    const attempt = await supabase
      .from("schedules")
      .delete({ count: "exact" })
      .eq("school_id", schoolId)
      .in("time_slot_id", timeSlotIds)
      .not("class_id", "is", null)
      .or("activity_type.is.null,activity_type.neq.HA");

    if (attempt.error) {
      // Fallback: DB sem activity_type
      const fallback = await supabase
        .from("schedules")
        .delete({ count: "exact" })
        .eq("school_id", schoolId)
        .in("time_slot_id", timeSlotIds)
        .not("class_id", "is", null);
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message || "Falha ao excluir." }, { status: 400 });
      }
      const deleted = fallback.count ?? 0;
      return NextResponse.json({ ok: true, shift, deleted });
    }

    const deleted = attempt.count ?? 0;
    return NextResponse.json({ ok: true, shift, deleted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}