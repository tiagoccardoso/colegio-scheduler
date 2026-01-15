import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeTimeSlots } from "@/lib/time-slots/normalize";
import { subjectLabel, teacherLabel, roomLabel, effectiveRoomId } from "@/lib/schedule/rules";

function normalizeShift(v: any) {
  const k = String(v ?? "").trim().toUpperCase();
  if (!k) return "";
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return k;
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

    const [{ data: timeSlotsRaw }, { data: roomsRaw }, { data: subjectsRaw }, { data: teachersRaw }, { data: classesRaw }, { data: school }] =
      await Promise.all([
        supabase
          .from("time_slots")
          .select("id,weekday,starts_at,ends_at,shift,period_index")
          .eq("school_id", schoolId)
          .eq("shift", shift)
          .in("weekday", [1, 2, 3, 4, 5])
          .order("weekday", { ascending: true })
          .order("period_index", { ascending: true }),
        supabase.from("rooms").select("*").eq("school_id", schoolId),
        supabase.from("subjects").select("*").eq("school_id", schoolId),
        supabase.from("teachers").select("*").eq("school_id", schoolId),
        supabase.from("classes").select("*").eq("school_id", schoolId),
        supabase.from("schools").select("id,name").eq("id", schoolId).maybeSingle(),
      ]);

    const timeSlots = normalizeTimeSlots((timeSlotsRaw as any[]) ?? []);
    const slotById = new Map<string, any>(timeSlots.map((s: any) => [s.id, s]));
    const slotIds = timeSlots.map((s: any) => s.id);

    // Classes do turno (para evitar “vazar” registros de outros turnos)
    const classesAll = ((classesRaw as any[]) ?? []).slice();
    const classes = classesAll.filter((c) => {
      const s = normalizeShift((c as any)?.shift);
      return !s || s === shift;
    });
    const classesById = new Map<string, any>(classesAll.map((c: any) => [String(c.id), c]));
    const classIds = new Set<string>(classes.map((c: any) => String(c.id)));

    // Salas (colunas)
    const rooms = ((roomsRaw as any[]) ?? []).slice();
    rooms.sort((a, b) => {
      const da = Number((a as any).display_order ?? 9999);
      const db = Number((b as any).display_order ?? 9999);
      if (da !== db) return da - db;
      const na = Number((a as any).room_number ?? 9999);
      const nb = Number((b as any).room_number ?? 9999);
      if (na !== nb) return na - nb;
      return String((a as any).name ?? "").localeCompare(String((b as any).name ?? ""));
    });

    const roomsById = new Map<string, any>(rooms.map((r: any) => [String(r.id), r]));
    const subjectsById = new Map<string, any>(((subjectsRaw as any[]) ?? []).map((r) => [String((r as any).id), r]));
    const teachersById = new Map<string, any>(((teachersRaw as any[]) ?? []).map((r) => [String((r as any).id), r]));

    const cols = rooms.map((r: any) => ({ id: String(r.id), header: roomLabel(r) }));

    // Detecta coluna activity_type (para evitar trazer HA no relatório)
    let hasActivityType = true;
    {
      const probe = await supabase.from("schedules").select("activity_type").limit(1);
      if (probe.error) hasActivityType = false;
    }

    let schedules: any[] = [];
    if (slotIds.length) {
      const sel = hasActivityType
        ? "id,class_id,time_slot_id,subject_id,teacher_id,room_id,activity_type"
        : "id,class_id,time_slot_id,subject_id,teacher_id,room_id";

      const res = await supabase
        .from("schedules")
        .select(sel)
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds);

      if (res.error) {
        const legacy = await supabase
          .from("schedules")
          .select("id,class_id,time_slot_id,subject_id,teacher_id,room_id")
          .eq("school_id", schoolId)
          .in("time_slot_id", slotIds);
        schedules = (legacy.data as any[]) ?? [];
        hasActivityType = false;
      } else {
        schedules = (res.data as any[]) ?? [];
      }
    }

    const grid: Record<string, Record<string, any>> = {};
    for (const ts of timeSlots) {
      const k = `${ts.weekday}-${ts.period_index ?? 0}`;
      grid[k] ||= {};
    }

    for (const sc of schedules) {
      const classId = sc?.class_id ? String(sc.class_id) : "";
      if (!classId) continue;
      if (!classIds.has(classId)) continue;

      if (hasActivityType) {
        const act = String(sc?.activity_type ?? "").trim().toUpperCase();
        if (act === "HA") continue;
      }

      const ts = slotById.get(sc.time_slot_id);
      if (!ts) continue;
      const k = `${ts.weekday}-${ts.period_index ?? 0}`;

      const subj = subjectsById.get(String(sc.subject_id ?? ""));
      const teach = teachersById.get(String(sc.teacher_id ?? ""));
      const cls = classesById.get(classId) ?? classesAll.find((c: any) => String(c.id) === classId);

      const effRoom = effectiveRoomId({
        scheduleRoomId: sc.room_id,
        classDefaultRoomId: (cls as any)?.default_room_id ?? null,
        teacherDefaultRoomId: (teach as any)?.default_room_id ?? null,
      });
      if (!effRoom) continue;

      grid[k] ||= {};
      grid[k][String(effRoom)] = {
        className: (cls as any)?.name ?? "Turma",
        subject: subjectLabel(subj),
        teacher: teacherLabel(teach),
      };
    }

    return NextResponse.json({
      ok: true,
      school: { name: (school as any)?.name ?? null },
      shift,
      timeSlots: timeSlots.map((t) => ({
        weekday: t.weekday,
        period_index: t.period_index,
        starts_at: t.starts_at,
        ends_at: t.ends_at,
      })),
      rooms: cols,
      grid,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
