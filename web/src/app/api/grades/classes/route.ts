
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeSlots } from "@/lib/time-slots/normalize";
import { subjectLabel, teacherLabel, roomLabel, effectiveRoomId } from "@/lib/schedule/rules";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shift = String(url.searchParams.get("shift") || "MANHA").trim().toUpperCase();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.school_id) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 400 });
    if (profile.role !== "director") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    const schoolId = profile.school_id;

    const [{ data: timeSlotsRaw }, { data: classesRaw }, { data: roomsRaw }, { data: subjectsRaw }, { data: teachersRaw }, { data: schedulesRaw }, { data: school }] =
      await Promise.all([
        supabase
          .from("time_slots")
          .select("id,weekday,starts_at,ends_at,shift,period_index")
          .eq("school_id", schoolId)
          .eq("shift", shift)
          .order("weekday", { ascending: true })
          .order("period_index", { ascending: true }),
        supabase.from("classes").select("*").eq("school_id", schoolId),
        supabase.from("rooms").select("*").eq("school_id", schoolId),
        supabase.from("subjects").select("*").eq("school_id", schoolId),
        supabase.from("teachers").select("*").eq("school_id", schoolId),
        // we'll filter schedules by slot IDs
        supabase.from("schedules").select("id,class_id,time_slot_id,subject_id,teacher_id,room_id").eq("school_id", schoolId),
        supabase.from("schools").select("id,name,term_label").eq("id", schoolId).maybeSingle(),
      ]);

    const timeSlots = normalizeTimeSlots((timeSlotsRaw as any[]) ?? []);
    const slotById = new Map<string, any>(timeSlots.map((s: any) => [s.id, s]));
    const slotIds = timeSlots.map((s: any) => s.id);

    // filter schedules to these slots only (client-side, safe)
    const schedules = ((schedulesRaw as any[]) ?? []).filter((s) => slotIds.includes(s.time_slot_id));

    const roomsById = new Map<string, any>(((roomsRaw as any[]) ?? []).map((r) => [r.id, r]));
    const subjectsById = new Map<string, any>(((subjectsRaw as any[]) ?? []).map((r) => [r.id, r]));
    const teachersById = new Map<string, any>(((teachersRaw as any[]) ?? []).map((r) => [r.id, r]));
    const classes = ((classesRaw as any[]) ?? []).slice();

    // Sort classes by room number, display_order, then name
    classes.sort((a, b) => {
      const ra = roomsById.get(a.default_room_id);
      const rb = roomsById.get(b.default_room_id);
      const rna = Number(ra?.room_number ?? 9999);
      const rnb = Number(rb?.room_number ?? 9999);
      if (rna !== rnb) return rna - rnb;
      const da = Number(a.display_order ?? 9999);
      const db = Number(b.display_order ?? 9999);
      if (da !== db) return da - db;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    const cols = classes.map((cls) => {
      const room = roomsById.get(cls.default_room_id);
      return {
        id: cls.id,
        header: {
          sala: roomLabel(room),
          levelStage: [cls.level, cls.stage].filter(Boolean).join(" "),
          turma: cls.name ?? "Turma",
        },
      };
    });

    // grid key = weekday-period_index
    const grid: Record<string, Record<string, any>> = {};
    for (const ts of timeSlots) {
      const k = `${ts.weekday}-${ts.period_index ?? 0}`;
      grid[k] ||= {};
    }

    for (const sc of schedules) {
      const ts = slotById.get(sc.time_slot_id);
      if (!ts) continue;
      const k = `${ts.weekday}-${ts.period_index ?? 0}`;
      const subj = subjectsById.get(sc.subject_id);
      const teach = teachersById.get(sc.teacher_id);
      const cls = classes.find((c) => c.id === sc.class_id);
      const effRoom = effectiveRoomId({
        scheduleRoomId: sc.room_id,
        classDefaultRoomId: cls?.default_room_id ?? null,
        teacherDefaultRoomId: teach?.default_room_id ?? null,
      });
      grid[k] ||= {};
      grid[k][sc.class_id] = {
        subject: subjectLabel(subj),
        teacher: teacherLabel(teach),
        room: effRoom ? roomLabel(roomsById.get(effRoom)) : null,
      };
    }

    return NextResponse.json({
      ok: true,
      school: { name: (school as any)?.name ?? null, term_label: (school as any)?.term_label ?? null },
      shift,
      timeSlots: timeSlots.map((t) => ({ weekday: t.weekday, period_index: t.period_index, starts_at: t.starts_at, ends_at: t.ends_at })),
      classes: cols,
      grid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
