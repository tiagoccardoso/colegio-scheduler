import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeSlots } from "@/lib/time-slots/normalize";
import { teacherLabel } from "@/lib/schedule/rules";
import { isStaffRole } from "@/lib/authz";

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
    if (!isStaffRole((profile as any).role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    const schoolId = profile.school_id;

    const [{ data: timeSlotsRaw }, { data: school }] = await Promise.all([
      supabase
        .from("time_slots")
        .select("id,weekday,starts_at,ends_at,shift,period_index")
        .eq("school_id", schoolId)
        .eq("shift", shift)
        .in("weekday", [1, 2, 3, 4, 5])
        .order("weekday", { ascending: true })
        .order("period_index", { ascending: true }),
      supabase.from("schools").select("id,name").eq("id", schoolId).maybeSingle(),
    ]);

    // Em alguns bancos antigos, teachers pode não ter short_name/display_order.
    // Se a consulta falhar, caímos para um select mínimo (id,name).
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
        .select("id,teacher_id,time_slot_id,activity_type,notes,is_teacher_absent,replacement_teacher_id")
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds);

      if (error) {
        // DB sem activity_type
        haRows = [];
      } else {
        haRows = ((data as any[]) ?? []).filter(
          (r) => String(r?.activity_type ?? "").toUpperCase() === "HA",
        );
      }
    }

    const teachers = teachersRaw;

    // Para edição (modal) precisamos ao menos da lista de professores.
    const editorTeachers = teachers
      .map((t: any) => ({
        id: String(t.id),
        name: t?.name ?? null,
        short_name: t?.short_name ?? null,
        subject_id: (t as any)?.subject_id ?? null,
        default_room_id: (t as any)?.default_room_id ?? null,
      }))
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

    const byTeacher: Record<
      string,
      {
        scheduleId: string;
        weekday: number;
        period_index: number | null;
        timeSlotId: string;
        notes: string | null;
        isTeacherAbsent?: boolean;
        replacementTeacherId?: string | null;
        replacementTeacherName?: string | null;
      }[]
    > = {};

    for (const r of haRows) {
      const tid = String(r.teacher_id ?? "");
      const tsid = String(r.time_slot_id ?? "");
      if (!tid || !tsid) continue;
      const ts = slotById.get(tsid);
      if (!ts) continue;
      byTeacher[tid] ||= [];
      const replacementTeacherId = r?.replacement_teacher_id ? String(r.replacement_teacher_id) : null;
      const replacementTeacher = replacementTeacherId ? teachers.find((t: any) => String(t.id) === replacementTeacherId) : null;
      byTeacher[tid].push({
        scheduleId: String(r.id),
        weekday: Number(ts.weekday),
        period_index: ts.period_index ?? null,
        timeSlotId: tsid,
        notes: r.notes ? String(r.notes) : null,
        isTeacherAbsent: Boolean(r?.is_teacher_absent),
        replacementTeacherId,
        replacementTeacherName: replacementTeacher ? teacherLabel(replacementTeacher) : null,
      });
    }

    const items = teachers
      .map((t) => {
        const slots = (byTeacher[String(t.id)] || []).slice();
        slots.sort(
          (a, b) =>
            (a.weekday - b.weekday) ||
            (Number(a.period_index ?? 0) - Number(b.period_index ?? 0)),
        );
        return {
          teacherId: String(t.id),
          teacherName: teacherLabel(t),
          slots,
        };
      })
      .sort((a, b) => String(a.teacherName).localeCompare(String(b.teacherName)));

    return NextResponse.json({
      ok: true,
      shift,
      editor: {
        teachers: editorTeachers,
      },
      school: {
        name: (school as any)?.name ?? null,
      },
      timeSlots: timeSlots.map((t) => ({
        id: t.id,
        weekday: t.weekday,
        period_index: t.period_index,
        starts_at: t.starts_at ?? null,
        ends_at: t.ends_at ?? null,
      })),
      items,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}