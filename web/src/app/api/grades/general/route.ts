import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeSlots } from "@/lib/time-slots/normalize";

const WEEKDAY = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

function teacherName(t: any) {
  return (
    String(t?.short_name ?? "").trim() ||
    String(t?.name ?? "").trim() ||
    "(sem nome)"
  );
}

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

    const timeSlots = normalizeTimeSlots((timeSlotsRaw as any[]) ?? []);
    const slotById = new Map<string, any>(timeSlots.map((s: any) => [s.id, s]));
    const slotIds = timeSlots.map((s: any) => s.id);

    let schedules: any[] = [];

    // Tenta ler activity_type; se a coluna não existir, retorna tudo como AULA.
    if (slotIds.length) {
      const { data, error } = await supabase
        .from("schedules")
        .select(
          "id,teacher_id,class_id,subject_id,room_id,notes,activity_type,time_slot_id,\n" +
            "time_slot:time_slots(weekday,period_index,starts_at,ends_at,shift),\n" +
            "class:classes(name),subject:subjects(name),teacher:teachers(name,short_name,display_order)"
        )
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds);

      if (error) {
        const { data: legacy } = await supabase
          .from("schedules")
          .select(
            "id,teacher_id,class_id,subject_id,room_id,notes,time_slot_id,\n" +
              "time_slot:time_slots(weekday,period_index,starts_at,ends_at,shift),\n" +
              "class:classes(name),subject:subjects(name),teacher:teachers(name,short_name,display_order)"
          )
          .eq("school_id", schoolId)
          .in("time_slot_id", slotIds);
        schedules = (legacy as any[]) ?? [];
      } else {
        schedules = (data as any[]) ?? [];
      }
    }

    const items = schedules
      .map((s) => {
        const ts = s?.time_slot || slotById.get(s?.time_slot_id);
        const weekday = Number(ts?.weekday ?? 0);
        const period = Number(ts?.period_index ?? 0);
        const act = String(s?.activity_type ?? "AULA").trim().toUpperCase() === "HA" ? "HA" : "AULA";
        return {
          id: String(s?.id ?? ""),
          teacherId: String(s?.teacher_id ?? ""),
          teacherName: teacherName(s?.teacher),
          weekday,
          weekdayLabel: WEEKDAY[weekday] ?? String(weekday),
          period_index: Number.isFinite(period) ? period : null,
          starts_at: ts?.starts_at ?? null,
          ends_at: ts?.ends_at ?? null,
          activity_type: act,
          className: s?.class?.name ?? null,
          subjectName: s?.subject?.name ?? null,
          notes: s?.notes ?? null,
          display_order: Number(s?.teacher?.display_order ?? 9999),
        };
      })
      .filter((x) => x.teacherId && x.weekday >= 1 && x.weekday <= 5 && x.period_index)
      .sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        const tn = String(a.teacherName).localeCompare(String(b.teacherName));
        if (tn !== 0) return tn;
        if (a.weekday !== b.weekday) return a.weekday - b.weekday;
        return Number(a.period_index ?? 0) - Number(b.period_index ?? 0);
      });

    return NextResponse.json({ ok: true, shift, items, timeSlots: timeSlots.map((t) => ({ weekday: t.weekday, period_index: t.period_index, starts_at: t.starts_at, ends_at: t.ends_at })) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
