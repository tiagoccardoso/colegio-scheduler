import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/authz";
import { subjectLabel, teacherLabel, roomLabel } from "@/lib/schedule/rules";

const SHIFT_ORDER: Record<string, number> = { MANHA: 1, TARDE: 2, NOITE: 3 };

function normalizeShift(v: any) {
  const k = String(v ?? "").trim().toUpperCase();
  if (!k || k === "ALL") return "ALL";
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return k;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const shift = normalizeShift(url.searchParams.get("shift") || "ALL");
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
    if (!isStaffRole((profile as any).role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    const schoolId = String(profile.school_id);

    const [{ data: school }, teachersTry] = await Promise.all([
      supabase.from("schools").select("id,name").eq("id", schoolId).maybeSingle(),
      supabase
        .from("teachers")
        .select("id,name,short_name,display_order")
        .eq("school_id", schoolId)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true }),
    ]);

    let teachersRaw: any[] = [];
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

    let query = supabase
      .from("schedules")
      .select(
        "id,teacher_id,time_slot_id,activity_type,class_id,subject_id,room_id,notes,is_teacher_absent,replacement_teacher_id," +
          "time_slot:time_slots(id,weekday,period_index,starts_at,ends_at,shift)," +
          "class:classes(name),subject:subjects(name),room:rooms(name)"
      )
      .eq("school_id", schoolId)
      .eq("is_teacher_absent", true);

    if (teacherId) query = query.eq("teacher_id", teacherId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message || "Falha ao carregar faltas." }, { status: 400 });

    const teachersById = new Map<string, any>(teachersRaw.map((t: any) => [String(t.id), t]));

    const items = ((data as any[]) ?? [])
      .map((row: any) => {
        const timeSlot = row?.time_slot ?? null;
        const slotShift = String(timeSlot?.shift ?? "").toUpperCase();
        if (shift !== "ALL" && slotShift !== shift) return null;

        const teacher = teachersById.get(String(row?.teacher_id ?? ""));
        const replacementTeacherId = row?.replacement_teacher_id ? String(row.replacement_teacher_id) : null;
        const replacementTeacher = replacementTeacherId ? teachersById.get(replacementTeacherId) : null;
        const activityType = String(row?.activity_type ?? "AULA").trim().toUpperCase() === "HA" ? "HA" : "AULA";

        return {
          scheduleId: String(row?.id ?? ""),
          teacherId: String(row?.teacher_id ?? ""),
          teacherName: teacher ? teacherLabel(teacher) : "Professor",
          replacementTeacherId,
          replacementTeacherName: replacementTeacher ? teacherLabel(replacementTeacher) : null,
          shift: slotShift || "MANHA",
          weekday: Number(timeSlot?.weekday ?? 0),
          periodIndex: Number(timeSlot?.period_index ?? 0),
          startsAt: timeSlot?.starts_at ?? null,
          endsAt: timeSlot?.ends_at ?? null,
          activityType,
          className: activityType === "HA" ? "Hora Atividade" : String(row?.class?.name ?? "—"),
          subjectName: activityType === "HA" ? "Hora Atividade" : subjectLabel(row?.subject),
          roomName: activityType === "HA" ? null : roomLabel(row?.room),
          notes: row?.notes ? String(row.notes) : null,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const byTeacher = String(a.teacherName).localeCompare(String(b.teacherName));
        if (byTeacher) return byTeacher;
        const byShift = (SHIFT_ORDER[String(a.shift)] ?? 99) - (SHIFT_ORDER[String(b.shift)] ?? 99);
        if (byShift) return byShift;
        const byDay = Number(a.weekday ?? 0) - Number(b.weekday ?? 0);
        if (byDay) return byDay;
        return Number(a.periodIndex ?? 0) - Number(b.periodIndex ?? 0);
      });

    const teachers = teachersRaw
      .map((t: any) => ({ id: String(t.id), label: teacherLabel(t) }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));

    return NextResponse.json({
      ok: true,
      shift,
      teacherId: teacherId || null,
      school: { name: (school as any)?.name ?? null },
      teachers,
      items,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
