import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeSlots } from "@/lib/time-slots/normalize";
import { teacherLabel } from "@/lib/schedule/rules";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shift = String(url.searchParams.get("shift") || "MANHA").trim().toUpperCase();

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

    const { data: timeSlotsRaw } = await supabase
      .from("time_slots")
      .select("id,weekday,starts_at,ends_at,shift,period_index")
      .eq("school_id", schoolId)
      .eq("shift", shift)
      .in("weekday", [1, 2, 3, 4, 5])
      .order("weekday", { ascending: true })
      .order("period_index", { ascending: true });

    // Em alguns bancos antigos, teachers pode não ter short_name/display_order.
    // Se a consulta falhar, caímos para um select mínimo (id,name), evitando voltar "Professor" por falta de dados.
    let teachersRaw: any[] = [];
    const teachersTry = await supabase
      .from("teachers")
      .select("id,name,short_name,display_order")
      .eq("school_id", schoolId)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });

    if (teachersTry.error) {
      const teachersFallback = await supabase
        .from("teachers")
        .select("id,name")
        .eq("school_id", schoolId)
        .order("name", { ascending: true });
      teachersRaw = ((teachersFallback.data as any[]) ?? []).filter((t) => t?.id);
    } else {
      teachersRaw = ((teachersTry.data as any[]) ?? []).filter((t) => t?.id);
    }

    const timeSlots = normalizeTimeSlots((timeSlotsRaw as any[]) ?? []);
    const slotById = new Map<string, any>(timeSlots.map((s: any) => [s.id, s]));
    const slotIds = timeSlots.map((s: any) => s.id);

    // Tenta ler activity_type; se a coluna não existir (DB antigo), devolve vazio.
    let haRows: any[] = [];
    if (slotIds.length) {
      const { data, error } = await supabase
        .from("schedules")
        .select("id,teacher_id,time_slot_id,activity_type,notes")
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds);

      if (error) {
        // DB sem activity_type
        haRows = [];
      } else {
        haRows = ((data as any[]) ?? []).filter((r) => String(r?.activity_type ?? "").toUpperCase() === "HA");
      }
    }

    const teachers = teachersRaw;
    const teacherById = new Map<string, any>(teachers.map((t) => [t.id, t]));

    const byTeacher: Record<string, { weekday: number; period_index: number | null; timeSlotId: string; notes: string | null }[]> = {};
    for (const r of haRows) {
      const tid = String(r.teacher_id ?? "");
      const tsid = String(r.time_slot_id ?? "");
      if (!tid || !tsid) continue;
      const ts = slotById.get(tsid);
      if (!ts) continue;
      byTeacher[tid] ||= [];
      byTeacher[tid].push({
        weekday: Number(ts.weekday),
        period_index: ts.period_index ?? null,
        timeSlotId: tsid,
        notes: r.notes ? String(r.notes) : null,
      });
    }

    const items = Object.entries(byTeacher)
      .map(([teacherId, slots]) => {
        const t = teacherById.get(teacherId);
        slots.sort((a, b) => (a.weekday - b.weekday) || (Number(a.period_index ?? 0) - Number(b.period_index ?? 0)));
        return {
          teacherId,
          teacherName: teacherLabel(t),
          slots,
        };
      })
      .sort((a, b) => String(a.teacherName).localeCompare(String(b.teacherName)));

    return NextResponse.json({ ok: true, shift, items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
