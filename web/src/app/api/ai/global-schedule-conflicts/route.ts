import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { teacherLabel, subjectLabel, roomLabel } from "@/lib/schedule/rules";
import { isStaffRole } from "@/lib/authz";

type TeachingRule = {
  subject_id: string;
  room_id: string;
  class_id: string;
  shift: string;
  period_index: number;
  weekdays?: number[] | null;
};

type ConflictKind = "teacher" | "room" | "class" | "slot";

const WEEKDAY_LABEL: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};

const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

function normalizeShift(v: any) {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return "MANHA";
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return key;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function safeRules(raw: any): TeachingRule[] {
  if (!Array.isArray(raw)) return [];
  const out: TeachingRule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const subject_id = String((r as any).subject_id ?? "").trim();
    const room_id = String((r as any).room_id ?? "").trim();
    const class_id = String((r as any).class_id ?? "").trim();
    const shift = normalizeShift((r as any).shift ?? "");
    const period_index = Number((r as any).period_index);
    if (!subject_id || !room_id || !class_id) continue;
    if (!Number.isFinite(period_index) || period_index < 1) continue;

    const weekdaysRaw = (r as any).weekdays;
    const weekdays = Array.isArray(weekdaysRaw)
      ? uniq(
          weekdaysRaw
            .map((d: any) => Number(d))
            .filter((d: number) => Number.isFinite(d) && d >= 1 && d <= 7),
        )
      : null;
    out.push({
      subject_id,
      room_id,
      class_id,
      shift,
      period_index,
      weekdays: weekdays && weekdays.length ? weekdays : null,
    });
  }
  return out;
}

function slotLabel(ts: any) {
  const w = WEEKDAY_LABEL?.[Number(ts?.weekday ?? 0)] ?? "Dia";
  const p = Number(ts?.period_index ?? 0);
  const range = ts?.starts_at ? `${ts.starts_at}–${ts.ends_at}` : p ? `${p}º` : "";
  return `${w} ${range}`.trim();
}

type Occ = {
  source: "existing" | "planned";
  activityType: "AULA" | "HA";
  teacherId: string | null;
  teacherName: string;
  classId: string | null;
  className: string | null;
  subjectId: string | null;
  subjectName: string | null;
  roomId: string | null;
  roomName: string | null;
  scheduleId?: string | null;
};

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
    if (!isStaffRole((profile as any).role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    const schoolId = profile.school_id;

    const [{ data: timeSlots }, { data: teachersRaw }, { data: classesRaw }, { data: subjectsRaw }, { data: roomsRaw }] =
      await Promise.all([
        supabase
          .from("time_slots")
          .select("id,weekday,shift,period_index,starts_at,ends_at")
          .eq("school_id", schoolId)
          .eq("shift", shift)
          .in("weekday", [1, 2, 3, 4, 5]),
        supabase
          .from("teachers")
          .select("id,name,short_name,teaching_rules")
          .eq("school_id", schoolId)
          .order("name", { ascending: true }),
        supabase.from("classes").select("id,name").eq("school_id", schoolId),
        supabase.from("subjects").select("id,name,short_name").eq("school_id", schoolId),
        supabase.from("rooms").select("id,name,room_number").eq("school_id", schoolId),
      ]);

    const slots = ((timeSlots as any[]) ?? []).filter((t) => t?.id && t?.weekday && t?.period_index);
    const slotById = new Map<string, any>(slots.map((s) => [String(s.id), s]));
    const slotKeyToId = new Map<string, string>();
    for (const s of slots) slotKeyToId.set(`${Number(s.weekday)}-${Number(s.period_index)}`, String(s.id));

    const slotIds = slots.map((s) => String(s.id));

    const classById = new Map<string, any>(((classesRaw as any[]) ?? []).map((c) => [String(c.id), c]));
    const subjectById = new Map<string, any>(((subjectsRaw as any[]) ?? []).map((s) => [String(s.id), s]));
    const roomById = new Map<string, any>(((roomsRaw as any[]) ?? []).map((r) => [String(r.id), r]));

    // Carrega ocupações existentes (inclui HA)
    let hasActivityType = true;
    {
      const probe = await supabase.from("schedules").select("activity_type").limit(1);
      if (probe.error) hasActivityType = false;
    }

    let existing: any[] = [];
    if (slotIds.length) {
      const sel = hasActivityType
        ? "id,time_slot_id,teacher_id,class_id,subject_id,room_id,activity_type"
        : "id,time_slot_id,teacher_id,class_id,subject_id,room_id";
      const res = await supabase.from("schedules").select(sel).eq("school_id", schoolId).in("time_slot_id", slotIds);
      if (res.error) {
        // base antiga
        const legacy = await supabase
          .from("schedules")
          .select("id,time_slot_id,teacher_id,class_id,subject_id,room_id")
          .eq("school_id", schoolId)
          .in("time_slot_id", slotIds);
        existing = (legacy.data as any[]) ?? [];
        hasActivityType = false;
      } else {
        existing = (res.data as any[]) ?? [];
      }
    }

    const teacherList = ((teachersRaw as any[]) ?? []).filter((t) => t?.id);
    const teacherById = new Map<string, any>(teacherList.map((t) => [String(t.id), t]));

    function mkOcc(args: {
      source: "existing" | "planned";
      activityType: "AULA" | "HA";
      teacherId: string | null;
      classId: string | null;
      subjectId: string | null;
      roomId: string | null;
      scheduleId?: string | null;
    }): Occ {
      const teacher = args.teacherId ? teacherById.get(args.teacherId) : null;
      const cls = args.classId ? classById.get(args.classId) : null;
      const subj = args.subjectId ? subjectById.get(args.subjectId) : null;
      const room = args.roomId ? roomById.get(args.roomId) : null;
      return {
        source: args.source,
        activityType: args.activityType,
        teacherId: args.teacherId,
        teacherName: teacherLabel(teacher),
        classId: args.classId,
        className: cls?.name ?? null,
        subjectId: args.subjectId,
        subjectName: subjectLabel(subj),
        roomId: args.roomId,
        roomName: args.roomId ? roomLabel(room) : null,
        scheduleId: args.scheduleId ?? null,
      };
    }

    // Ocupação por slot
    const busyTeacher = new Map<string, Map<string, Occ>>();
    const busyRoom = new Map<string, Map<string, Occ>>();
    const busyClass = new Map<string, Map<string, Occ>>();

    function setBusy(map: Map<string, Map<string, Occ>>, slotId: string, key: string, occ: Occ) {
      if (!key) return;
      const bySlot = map.get(slotId) ?? new Map<string, Occ>();
      bySlot.set(key, occ);
      map.set(slotId, bySlot);
    }

    for (const s of existing) {
      const slotId = String(s?.time_slot_id ?? "");
      if (!slotId) continue;
      const activityType = hasActivityType && String(s?.activity_type ?? "").trim().toUpperCase() === "HA" ? "HA" : "AULA";
      const occ = mkOcc({
        source: "existing",
        activityType,
        teacherId: s?.teacher_id ? String(s.teacher_id) : null,
        classId: s?.class_id ? String(s.class_id) : null,
        subjectId: s?.subject_id ? String(s.subject_id) : null,
        roomId: s?.room_id ? String(s.room_id) : null,
        scheduleId: s?.id ? String(s.id) : null,
      });

      if (occ.teacherId) setBusy(busyTeacher, slotId, occ.teacherId, occ);
      if (occ.roomId) setBusy(busyRoom, slotId, occ.roomId, occ);
      if (occ.classId) setBusy(busyClass, slotId, occ.classId, occ);
    }

    const plannedKeys = new Set<string>();
    const conflicts: any[] = [];

    for (const teacher of teacherList) {
      const teacherId = String(teacher.id);
      const rules = safeRules((teacher as any).teaching_rules).filter((r) => normalizeShift(r.shift) === shift);
      if (rules.length === 0) continue;

      for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
        const r = rules[ruleIndex];
        const weekdays = (r.weekdays && r.weekdays.length ? r.weekdays : DEFAULT_WEEKDAYS)
          .map((d) => Number(d))
          .filter((d) => d >= 1 && d <= 5);
        if (weekdays.length === 0) continue;

        for (const wd of weekdays) {
          const slotId = slotKeyToId.get(`${wd}-${Number(r.period_index)}`);
          if (!slotId) {
            conflicts.push({
              id: `${teacherId}|${wd}|${r.period_index}|slot|${ruleIndex}`,
              kind: "slot" as ConflictKind,
              shift,
              weekday: wd,
              period_index: Number(r.period_index),
              slot: null,
              requested: {
                teacherId,
                teacherName: teacherLabel(teacher),
                classId: String(r.class_id),
                className: classById.get(String(r.class_id))?.name ?? null,
                subjectId: String(r.subject_id),
                subjectName: subjectLabel(subjectById.get(String(r.subject_id))),
                roomId: String(r.room_id),
                roomName: roomLabel(roomById.get(String(r.room_id))),
                ruleIndex,
              },
              blockedBy: null,
              message: `Horário não encontrado para ${WEEKDAY_LABEL[wd] ?? "Dia"} ${Number(r.period_index)}º (${shift}).`,
            });
            continue;
          }

          const key = `${teacherId}|${String(r.class_id)}|${slotId}|${String(r.subject_id)}|${String(r.room_id)}`;
          if (plannedKeys.has(key)) continue;
          plannedKeys.add(key);

          const blockedTeacher = busyTeacher.get(slotId)?.get(teacherId) ?? null;
          const blockedRoom = busyRoom.get(slotId)?.get(String(r.room_id)) ?? null;
          const blockedClass = busyClass.get(slotId)?.get(String(r.class_id)) ?? null;

          const kind: ConflictKind | null = blockedTeacher ? "teacher" : blockedRoom ? "room" : blockedClass ? "class" : null;
          if (kind) {
            const ts = slotById.get(slotId);
            const requestedOcc = mkOcc({
              source: "planned",
              activityType: "AULA",
              teacherId,
              classId: String(r.class_id),
              subjectId: String(r.subject_id),
              roomId: String(r.room_id),
            });

            const blocked = (kind === "teacher" ? blockedTeacher : kind === "room" ? blockedRoom : blockedClass) as Occ;
            const slotText = ts ? slotLabel(ts) : "(horário)";

            const blockedDesc = (() => {
              const a = blocked.activityType === "HA" ? "HA" : "Aula";
              const cls = blocked.className ? ` • Turma ${blocked.className}` : "";
              const subj = blocked.subjectName ? ` • ${blocked.subjectName}` : "";
              const room = blocked.roomName ? ` • ${blocked.roomName}` : "";
              return `${a}${cls}${subj}${room}`;
            })();

            const requestedDesc = (() => {
              const cls = requestedOcc.className ? `Turma ${requestedOcc.className}` : "Turma";
              const subj = requestedOcc.subjectName ? ` • ${requestedOcc.subjectName}` : "";
              const room = requestedOcc.roomName ? ` • ${requestedOcc.roomName}` : "";
              return `${cls}${subj}${room}`;
            })();

            const message =
              kind === "teacher"
                ? `Conflito (professor): ${requestedOcc.teacherName} já está ocupado em ${slotText}. (${blockedDesc}) Tentativa: ${requestedDesc}.`
                : kind === "room"
                ? `Conflito (sala): ${requestedOcc.roomName ?? "Sala"} já está ocupada em ${slotText}. (${blockedDesc}) Tentativa: ${requestedDesc}.`
                : `Conflito (turma): ${requestedOcc.className ?? "Turma"} já tem aula em ${slotText}. (${blockedDesc}) Tentativa: ${requestedDesc}.`;

            conflicts.push({
              id: `${teacherId}|${slotId}|${kind}|${ruleIndex}`,
              kind,
              shift,
              weekday: Number(ts?.weekday ?? wd),
              period_index: Number(ts?.period_index ?? r.period_index),
              slot: ts
                ? {
                    id: slotId,
                    weekday: Number(ts.weekday),
                    period_index: Number(ts.period_index),
                    starts_at: ts.starts_at ?? null,
                    ends_at: ts.ends_at ?? null,
                    label: slotText,
                  }
                : null,
              requested: {
                ...requestedOcc,
                ruleIndex,
              },
              blockedBy: blocked,
              message,
            });
            continue;
          }

          // Sem conflitos: considera como alocado (mesma lógica do builder).
          const occ = mkOcc({
            source: "planned",
            activityType: "AULA",
            teacherId,
            classId: String(r.class_id),
            subjectId: String(r.subject_id),
            roomId: String(r.room_id),
          });
          setBusy(busyTeacher, slotId, teacherId, occ);
          setBusy(busyRoom, slotId, String(r.room_id), occ);
          setBusy(busyClass, slotId, String(r.class_id), occ);
        }
      }
    }

    const counts = {
      total: conflicts.length,
      teacher: conflicts.filter((c) => c.kind === "teacher").length,
      room: conflicts.filter((c) => c.kind === "room").length,
      class: conflicts.filter((c) => c.kind === "class").length,
      slot: conflicts.filter((c) => c.kind === "slot").length,
    };

    return NextResponse.json({ ok: true, shift, counts, conflicts });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}