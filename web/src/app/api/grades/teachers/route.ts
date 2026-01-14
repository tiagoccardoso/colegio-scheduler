import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeSlots } from "@/lib/time-slots/normalize";
import { effectiveRoomId, roomLabel, subjectLabel, teacherLabel } from "@/lib/schedule/rules";

function normalizeShift(v: any) {
  const k = String(v ?? "").trim().toUpperCase();
  if (!k) return "";
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return k;
}

function teacherVisibleInShift(t: any, shift: string) {
  const raw = (t as any)?.shifts;
  if (!Array.isArray(raw)) return true; // DB legado: sem campo "shifts" -> não filtra
  const arr = raw.map((x: any) => String(x || "").trim().toUpperCase()).filter(Boolean);
  return arr.length === 0 || arr.includes(shift);
}

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
          .in("weekday", [1, 2, 3, 4, 5])
          .order("weekday", { ascending: true })
          .order("period_index", { ascending: true }),
        supabase.from("teachers").select("*").eq("school_id", schoolId),
        supabase.from("classes").select("*").eq("school_id", schoolId),
        supabase.from("rooms").select("*").eq("school_id", schoolId),
        supabase.from("subjects").select("*").eq("school_id", schoolId),
        supabase.from("schools").select("id,name,term_label").eq("id", schoolId).maybeSingle(),
      ]);

    const timeSlots = normalizeTimeSlots((timeSlotsRaw as any[]) ?? []);
    const slotById = new Map<string, any>(timeSlots.map((s: any) => [s.id, s]));
    const slotIds = timeSlots.map((s: any) => s.id);

    // Professores visíveis no turno
    const teachersAll = ((teachersRaw as any[]) ?? []).slice();
    const teachers = teachersAll
      .filter((t) => teacherVisibleInShift(t, shift))
      .sort((a, b) => {
        const da = Number((a as any).display_order ?? 9999);
        const db = Number((b as any).display_order ?? 9999);
        if (da !== db) return da - db;
        return String((a as any).name ?? "").localeCompare(String((b as any).name ?? ""));
      });

    const teacherItems = teachers.map((t) => ({ id: String((t as any).id), label: teacherLabel(t) }));

    const selectedTeacher = teacherId ? teachers.find((t) => String((t as any).id) === teacherId) : null;
    if (teacherId && !selectedTeacher) {
      return NextResponse.json({ error: "Professor não encontrado.", ok: false }, { status: 400 });
    }

    // Classes do turno (para manter coerência com a grade geral)
    const classesAll = ((classesRaw as any[]) ?? []).slice();
    const visibleClassIds = new Set<string>(
      classesAll
        .filter((c) => {
          const s = normalizeShift((c as any)?.shift);
          return !s || s === shift;
        })
        .map((c: any) => String(c.id)),
    );

    const classesById = new Map<string, any>(classesAll.map((c: any) => [String(c.id), c]));
    const roomsById = new Map<string, any>(((roomsRaw as any[]) ?? []).map((r: any) => [String(r.id), r]));
    const subjectsById = new Map<string, any>(((subjectsRaw as any[]) ?? []).map((s: any) => [String(s.id), s]));

    // Detecta coluna activity_type (bases antigas podem não ter)
    let hasActivityType = true;
    {
      const probe = await supabase.from("schedules").select("activity_type").limit(1);
      if (probe.error) hasActivityType = false;
    }

    let schedules: any[] = [];
    if (teacherId && slotIds.length > 0) {
      const sel = hasActivityType
        ? "id,class_id,time_slot_id,subject_id,teacher_id,room_id,activity_type,notes"
        : "id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes";

      const res = await supabase
        .from("schedules")
        .select(sel)
        .eq("school_id", schoolId)
        .eq("teacher_id", teacherId)
        .in("time_slot_id", slotIds);

      if (res.error) {
        const legacy = await supabase
          .from("schedules")
          .select("id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
          .eq("school_id", schoolId)
          .eq("teacher_id", teacherId)
          .in("time_slot_id", slotIds);
        schedules = (legacy.data as any[]) ?? [];
        hasActivityType = false;
      } else {
        schedules = (res.data as any[]) ?? [];
      }
    }

    const grid: Record<string, any> = {};
    for (const ts of timeSlots) {
      const k = `${ts.weekday}-${ts.period_index ?? 0}`;
      grid[k] ||= null;
    }

    for (const sc of schedules) {
      const ts = slotById.get(sc.time_slot_id);
      if (!ts) continue;

      const act = hasActivityType
        ? String(sc?.activity_type ?? "AULA").trim().toUpperCase()
        : "AULA";
      const isHa = act === "HA";

      const classId = sc?.class_id ? String(sc.class_id) : "";

      // AULA segue coerência da grade geral (turmas do turno). HA não depende de turma.
      if (!isHa) {
        if (!classId) continue;
        if (!visibleClassIds.has(classId)) continue;
      }

      const k = `${ts.weekday}-${ts.period_index ?? 0}`;
      if (isHa) {
        grid[k] = {
          activityType: "HA",
          className: "Hora Atividade",
          subject: "Hora Atividade",
          room: null,
          notes: (sc as any)?.notes ?? null,
        };
        continue;
      }

      const cls = classesById.get(classId);
      const subj = subjectsById.get(String(sc.subject_id ?? ""));

      const effRoom = effectiveRoomId({
        scheduleRoomId: sc.room_id,
        classDefaultRoomId: (cls as any)?.default_room_id ?? null,
        teacherDefaultRoomId: (selectedTeacher as any)?.default_room_id ?? null,
      });

      grid[k] = {
        activityType: "AULA",
        className: (cls as any)?.name ?? "Turma",
        subject: subjectLabel(subj),
        room: effRoom ? roomLabel(roomsById.get(String(effRoom))) : null,
        notes: (sc as any)?.notes ?? null,
      };
    }

    return NextResponse.json({
      ok: true,
      school: { name: (school as any)?.name ?? null, term_label: (school as any)?.term_label ?? null },
      shift,
      teacherId: teacherId || null,
      teacher: selectedTeacher ? { id: String((selectedTeacher as any).id), label: teacherLabel(selectedTeacher) } : null,
      teachers: teacherItems,
      timeSlots: timeSlots.map((t) => ({
        weekday: t.weekday,
        period_index: t.period_index,
        starts_at: t.starts_at,
        ends_at: t.ends_at,
      })),
      grid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
