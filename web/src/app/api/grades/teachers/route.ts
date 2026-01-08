
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeSlots } from "@/lib/time-slots/normalize";
import { effectiveRoomId, roomLabel, subjectLabel, teacherLabel } from "@/lib/schedule/rules";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shift = String(url.searchParams.get("shift") || "MANHA").trim().toUpperCase();
    const teacherId = String(url.searchParams.get("teacherId") || "").trim();

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

    const [{ data: timeSlotsRaw }, { data: teachersRaw }, { data: classesRaw }, { data: roomsRaw }, { data: subjectsRaw }, { data: school }] =
      await Promise.all([
        supabase
          .from("time_slots")
          .select("id,weekday,starts_at,ends_at,shift,period_index")
          .eq("school_id", schoolId)
          .eq("shift", shift)
          .order("weekday", { ascending: true })
          .order("period_index", { ascending: true }),
        supabase.from("teachers").select("*").eq("school_id", schoolId),
        supabase.from("classes").select("*").eq("school_id", schoolId),
        supabase.from("rooms").select("*").eq("school_id", schoolId),
        supabase.from("subjects").select("*").eq("school_id", schoolId),
        supabase.from("schools").select("id,name,term_label").eq("id", schoolId).maybeSingle(),
      ]);

    const teachers = ((teachersRaw as any[]) ?? []).slice();
    teachers.sort((a, b) => {
      const da = Number(a.display_order ?? 9999);
      const db = Number(b.display_order ?? 9999);
      if (da !== db) return da - db;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });

    const teacherItems = teachers.map((t) => ({ id: t.id, label: teacherLabel(t) }));

    const selectedTeacher = teacherId ? teachers.find((t) => t.id === teacherId) : null;
    if (teacherId && !selectedTeacher) {
      return NextResponse.json({ error: "Professor não encontrado.", ok: false }, { status: 400 });
    }

    const timeSlots = normalizeTimeSlots((timeSlotsRaw as any[]) ?? []);
    const slotById = new Map<string, any>(timeSlots.map((s: any) => [s.id, s]));
    const slotIds = timeSlots.map((s: any) => s.id);

    // schedules (optional)
    let schedules: any[] = [];
    if (teacherId && slotIds.length > 0) {
      const { data: schedulesRaw } = await supabase
        .from("schedules")
        .select("id,class_id,time_slot_id,subject_id,teacher_id,room_id")
        .eq("school_id", schoolId)
        .eq("teacher_id", teacherId)
        .in("time_slot_id", slotIds);

      schedules = (schedulesRaw as any[]) ?? [];
    }

    const classesById = new Map<string, any>(((classesRaw as any[]) ?? []).map((c) => [c.id, c]));
    const roomsById = new Map<string, any>(((roomsRaw as any[]) ?? []).map((r) => [r.id, r]));
    const subjectsById = new Map<string, any>(((subjectsRaw as any[]) ?? []).map((s) => [s.id, s]));

    const grid: Record<string, any> = {};
    for (const ts of timeSlots) {
      const k = `${ts.weekday}-${ts.period_index ?? 0}`;
      grid[k] ||= null;
    }

    for (const sc of schedules) {
      const ts = slotById.get(sc.time_slot_id);
      if (!ts) continue;
      const k = `${ts.weekday}-${ts.period_index ?? 0}`;
      const cls = classesById.get(sc.class_id);
      const subj = subjectsById.get(sc.subject_id);
      const effRoom = effectiveRoomId({
        scheduleRoomId: sc.room_id,
        classDefaultRoomId: cls?.default_room_id ?? null,
        teacherDefaultRoomId: selectedTeacher?.default_room_id ?? null,
      });
      grid[k] = {
        className: cls?.name ?? "Turma",
        subject: subjectLabel(subj),
        room: effRoom ? roomLabel(roomsById.get(effRoom)) : null,
      };
    }

    return NextResponse.json({
      ok: true,
      school: { name: (school as any)?.name ?? null, term_label: (school as any)?.term_label ?? null },
      shift,
      teacherId: teacherId || null,
      teacher: selectedTeacher ? { id: selectedTeacher.id, label: teacherLabel(selectedTeacher) } : null,
      teachers: teacherItems,
      timeSlots: timeSlots.map((t) => ({ weekday: t.weekday, period_index: t.period_index, starts_at: t.starts_at, ends_at: t.ends_at })),
      grid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
