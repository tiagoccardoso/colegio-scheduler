import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateNoConflicts } from "@/lib/schedule/validate";

type BuildReq = {
  classId: string;
  overwrite?: boolean;
  shift?: string | null;
};

type TimeSlotRow = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  shift: string | null;
  period_index: number | null;
};

type TeacherRow = {
  id: string;
  name: string | null;
  shifts: string[] | null;
  subject_id: string | null;
  default_room_id: string | null;
  class_ids: string[] | null;
  restrictions: string | null;
  availability: any | null;

  // legacy
  subject_ids: string[] | null;
  room_ids: string[] | null;
  available_weekdays: number[] | null;
};

type RoomRow = { id: string; name: string | null };
type SubjectRow = { id: string; name: string | null };

const WEEKDAYS: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};

function normalizeShift(v: any) {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return "";
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return key;
}

function normalizeShiftOrNull(v: any): string | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const k = normalizeShift(raw);
  return k ? k : null;
}

function teacherAcceptsShift(teacher: TeacherRow, shift: string | null) {
  if (!shift) return true;
  const shifts = (teacher.shifts ?? []).map(normalizeShift).filter(Boolean);
  if (shifts.length === 0) return true;
  return shifts.includes(normalizeShift(shift));
}

function teacherAvailable(teacher: TeacherRow, args: { shift: string | null; weekday: number; period_index: number | null }) {
  const { shift, weekday, period_index } = args;

  const availability = teacher.availability;
  if (availability && typeof availability === "object" && shift && Number.isFinite(weekday) && Number.isFinite(period_index)) {
    const allowed = availability?.[normalizeShift(shift)]?.[String(weekday)] as any;
    if (Array.isArray(allowed) && allowed.length > 0) {
      return allowed.includes(Number(period_index));
    }
    // If availability exists but is missing for this shift/day, treat as unavailable.
    return false;
  }

  const days = (teacher.available_weekdays ?? []).filter((n) => Number.isFinite(n));
  if (days.length === 0) return true;
  return days.includes(weekday);
}

function teacherAllowedForClass(teacher: TeacherRow, classId: string) {
  const allowed = (teacher.class_ids ?? []).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(classId);
}

function teacherAllowsSubject(teacher: TeacherRow, subjectId: string) {
  const primary = teacher.subject_id ? String(teacher.subject_id) : "";
  if (primary) return primary === subjectId;
  const legacy = (teacher.subject_ids ?? []).filter(Boolean);
  if (legacy.length === 0) return true;
  return legacy.includes(subjectId);
}

function teacherAllowsRoom(teacher: TeacherRow, roomId: string) {
  const legacy = (teacher.room_ids ?? []).filter(Boolean);
  if (legacy.length === 0) return true;
  return legacy.includes(roomId);
}

function inferSubjectId(teacher: TeacherRow, proposed?: string | null) {
  const p = String(proposed ?? "").trim();
  if (p) return p;
  const primary = String(teacher.subject_id ?? "").trim();
  if (primary) return primary;
  const legacy = (teacher.subject_ids ?? []).filter(Boolean);
  return legacy[0] ? String(legacy[0]) : "";
}

type CandidateTeacher = {
  id: string;
  name: string;
  subjectId: string | null;
  subjectName: string | null;
  defaultRoomId: string | null;
  defaultRoomName: string | null;
  restrictions: string | null;
};

type CandidateRoom = { id: string; name: string | null };

type CandidateSlot = {
  timeSlotId: string;
  weekday: number;
  weekdayName: string;
  starts_at: string;
  ends_at: string;
  shift: string | null;
  period_index: number | null;
  freeTeachers: CandidateTeacher[];
  freeRooms: CandidateRoom[];
};

type AiAssignment = {
  timeSlotId: string;
  teacherId: string;
  subjectId?: string;
  roomId?: string | null;
  notes?: string | null;
};

export async function POST(req: Request) {
  try {
    if (process.env.AI_SCHEDULER_ENABLED !== "true") {
      return NextResponse.json({ error: "IA desabilitada." }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada." }, { status: 400 });
    }

    const body = (await req.json()) as BuildReq;
    const classId = String(body?.classId ?? "");
    const overwrite = Boolean(body?.overwrite);
    if (!classId) return NextResponse.json({ error: "classId obrigatório." }, { status: 400 });

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
    if (!profile || (profile as any).role !== "director") {
      return NextResponse.json({ error: "Apenas diretor pode usar esta função." }, { status: 403 });
    }
    const schoolId = String((profile as any).school_id);

    const { data: cls } = await supabase
      .from("classes")
      .select("id,name,shift")
      .eq("school_id", schoolId)
      .eq("id", classId)
      .maybeSingle();
    if (!cls) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    
    const preferredShift = normalizeShiftOrNull((body as any)?.shift) ?? normalizeShiftOrNull((cls as any)?.shift);

    // Load time slots. If the class shift is missing or mismatched, we infer the best shift from existing slots.
    const { data: timeSlotsAll } = await supabase
      .from("time_slots")
      .select("id,weekday,starts_at,ends_at,shift,period_index")
      .eq("school_id", schoolId)
      .in("weekday", [1, 2, 3, 4, 5])
      .order("weekday", { ascending: true })
      .order("period_index", { ascending: true })
      .order("starts_at", { ascending: true });

    const allSlots = ((timeSlotsAll as TimeSlotRow[] | null) ?? []).filter((s) => s?.id);

    if (allSlots.length === 0) {
      return NextResponse.json({ error: "Nenhum horário cadastrado. Vá em Horários e cadastre primeiro." }, { status: 400 });
    }

    // Count by normalized shift
    const counts = new Map<string, number>();
    for (const s of allSlots) {
      const sh = normalizeShiftOrNull(s.shift);
      if (!sh) continue;
      counts.set(sh, (counts.get(sh) ?? 0) + 1);
    }

    let classShift: string | null = null;
    if (preferredShift && (counts.get(preferredShift) ?? 0) > 0) {
      classShift = preferredShift;
    } else {
      let best: string | null = null;
      let bestN = 0;
      for (const [sh, n] of counts.entries()) {
        if (n > bestN) {
          best = sh;
          bestN = n;
        }
      }
      classShift = best;
    }

    const slots = classShift ? allSlots.filter((s) => normalizeShiftOrNull(s.shift) === classShift) : allSlots;

    if (slots.length === 0) {
      return NextResponse.json({ error: "Nenhum horário cadastrado para esta turma/turno." }, { status: 400 });
    }

    const slotById = new Map(slots.map((s) => [s.id, s] as const));
    const timeSlotIds = slots.map((s) => s.id);

    // Load all schedules for these time slots to know what's already occupied.
    const { data: allSchedules } = await supabase
      .from("schedules")
      .select("id,class_id,time_slot_id,teacher_id,room_id,subject_id")
      .eq("school_id", schoolId)
      .in("time_slot_id", timeSlotIds);

    const schedules = ((allSchedules as any[] | null) ?? []).filter(Boolean);

    // In overwrite mode, treat this class's own existing lessons as removable.
    const effectiveSchedules = overwrite ? schedules.filter((s) => s.class_id !== classId) : schedules;

    const busyTeachersBySlot = new Map<string, Set<string>>();
    const busyRoomsBySlot = new Map<string, Set<string>>();
    const classOccupiedSlots = new Set<string>();

    for (const s of schedules) {
      const tsid = String(s.time_slot_id ?? "");
      if (!tsid) continue;
      if (String(s.class_id ?? "") === classId) classOccupiedSlots.add(tsid);
    }

    for (const s of effectiveSchedules) {
      const tsid = String(s.time_slot_id ?? "");
      if (!tsid) continue;
      const tid = String(s.teacher_id ?? "");
      const rid = String(s.room_id ?? "");

      if (tid) {
        busyTeachersBySlot.get(tsid) ?? busyTeachersBySlot.set(tsid, new Set());
        busyTeachersBySlot.get(tsid)!.add(tid);
      }
      if (rid) {
        busyRoomsBySlot.get(tsid) ?? busyRoomsBySlot.set(tsid, new Set());
        busyRoomsBySlot.get(tsid)!.add(rid);
      }
    }

    const { data: subjects } = await supabase
      .from("subjects")
      .select("id,name")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    const subjectById = new Map(((subjects as SubjectRow[] | null) ?? []).map((s) => [s.id, s.name ?? null] as const));

    const { data: rooms } = await supabase
      .from("rooms")
      .select("id,name")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    const roomById = new Map(((rooms as RoomRow[] | null) ?? []).map((r) => [r.id, r.name ?? null] as const));
    const roomsList = ((rooms as RoomRow[] | null) ?? []).filter((r) => r?.id);

    const { data: teachers } = await supabase
      .from("teachers")
      .select(
        "id,name,shifts,subject_id,default_room_id,class_ids,restrictions,availability,subject_ids,room_ids,available_weekdays",
      )
      .eq("school_id", schoolId)
      .order("name", { ascending: true });
    const teachersList = ((teachers as TeacherRow[] | null) ?? []).filter((t) => t?.id);
    const teacherById = new Map(teachersList.map((t) => [t.id, t] as const));

    // Matriz curricular (aulas/semana por disciplina) — opcional
    const { data: reqRows } = await supabase
      .from("class_subject_requirements")
      .select("subject_id,lessons_per_week,max_per_day,block_size,min_days,prefer_consecutive")
      .eq("school_id", schoolId)
      .eq("class_id", classId);

    const reqBySubject = new Map<string, number>();
    const reqRulesBySubject = new Map<string, { max_per_day?: number; block_size?: number; min_days?: number; prefer_consecutive?: boolean }>();
    for (const r of (reqRows as any[] | null) ?? []) {
      const sid = String((r as any)?.subject_id ?? "");
      const lpw = Number((r as any)?.lessons_per_week ?? 0);
      if (sid && Number.isFinite(lpw) && lpw > 0) {
        reqBySubject.set(sid, lpw);
        const maxpd = Number((r as any)?.max_per_day ?? 0);
        const blk = Number((r as any)?.block_size ?? 0);
        const mind = Number((r as any)?.min_days ?? 0);
        const pref = Boolean((r as any)?.prefer_consecutive ?? false);
        reqRulesBySubject.set(sid, {
          max_per_day: Number.isFinite(maxpd) && maxpd > 0 ? maxpd : undefined,
          block_size: Number.isFinite(blk) && blk > 1 ? blk : undefined,
          min_days: Number.isFinite(mind) && mind > 0 ? mind : undefined,
          prefer_consecutive: pref || undefined,
        });
      }
    }
    const requirementsEnabled = reqBySubject.size > 0;
    const maxPerDayBySubject = new Map<string, number>();
    const minDaysBySubject = new Map<string, number>();
    for (const [sid, r] of (reqRulesBySubject as any).entries?.() ?? []) {
      if (r?.max_per_day) maxPerDayBySubject.set(String(sid), Number(r.max_per_day));
      if (r?.min_days) minDaysBySubject.set(String(sid), Number(r.min_days));
    }


    // Only fill empty slots unless overwrite=true.
    const targetSlots = overwrite ? slots : slots.filter((s) => !classOccupiedSlots.has(s.id));
    if (targetSlots.length === 0) {
      return NextResponse.json({ error: "Não há slots vazios para preencher." }, { status: 400 });
    }

    const candidates: CandidateSlot[] = [];
    for (const ts of targetSlots) {
      const busyTeachers = busyTeachersBySlot.get(ts.id) ?? new Set<string>();
      const busyRooms = busyRoomsBySlot.get(ts.id) ?? new Set<string>();

      const freeRooms: CandidateRoom[] = roomsList.filter((r) => !busyRooms.has(r.id)).map((r) => ({ id: r.id, name: r.name ?? null }));

      const freeTeachers: CandidateTeacher[] = teachersList
        .filter((t) => !busyTeachers.has(t.id))
        .filter((t) => teacherAcceptsShift(t, ts.shift ?? (classShift || null)))
        .filter((t) => teacherAvailable(t, { shift: ts.shift ?? (classShift || null), weekday: ts.weekday, period_index: ts.period_index }))
        .filter((t) => teacherAllowedForClass(t, classId))
        .map((t) => {
          const subjId = t.subject_id ? String(t.subject_id) : null;
          const roomId = t.default_room_id ? String(t.default_room_id) : null;
          return {
            id: t.id,
            name: t.name ?? "(sem nome)",
            subjectId: subjId,
            subjectName: subjId ? subjectById.get(subjId) ?? null : null,
            defaultRoomId: roomId,
            defaultRoomName: roomId ? roomById.get(roomId) ?? null : null,
            restrictions: t.restrictions ?? null,
          };
        });

      candidates.push({
        timeSlotId: ts.id,
        weekday: ts.weekday,
        weekdayName: WEEKDAYS[ts.weekday] ?? String(ts.weekday),
        starts_at: ts.starts_at,
        ends_at: ts.ends_at,
        shift: ts.shift ? normalizeShift(ts.shift) : (classShift || null),
        period_index: ts.period_index ?? null,
        freeTeachers,
        freeRooms,
      });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const sys =
      "Você é um assistente de alocação de grade escolar. Sua saída DEVE ser JSON válido. " +
      "Siga rigorosamente as regras: (1) 1 professor por slot, (2) nunca alocar professor/" +
      "sala ocupados no mesmo slot, (3) respeitar turno e disponibilidade (dia/período) do professor, " +
      "(4) respeitar habilitação de turma e disciplina do professor, (5) quando houver matriz curricular, " +
      "não ultrapassar a carga semanal por disciplina.";

    const userPrompt = {
      school: { id: schoolId },
      class: { id: classId, name: (cls as any).name ?? null, shift: classShift || null },
      requirementsEnabled,
      requirements: Array.from(reqBySubject.entries()).map(([subjectId, lessonsPerWeek]) => ({
        subjectId,
        subjectName: subjectById.get(subjectId) ?? null,
        lessonsPerWeek,
      })),
      candidates,
      outputSchema: {
        assignments: [
          {
            timeSlotId: "uuid",
            teacherId: "uuid",
            subjectId: "uuid (preferir o subjectId do professor)",
            roomId: "uuid|null (opcional)",
            notes: "string|null (opcional)",
          },
        ],
        summary: "string (opcional)",
        warnings: ["string"],
      },
      instructions:
        "Gere no máximo 1 assignment por candidate.timeSlotId. " +
        "Escolha teachers apenas da lista freeTeachers do slot. " +
        "Se requirementsEnabled=true, distribua as disciplinas para bater o mais perto possível de lessonsPerWeek (sem exceder). " +
        "Se um slot não tiver opções boas, deixe sem assignment e explique em warnings.",
    };

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(userPrompt) },
        ],
      }),
    });

    const aiJson = await aiRes.json();
    if (!aiRes.ok) {
      return NextResponse.json(
        { error: aiJson?.error?.message ?? "Falha ao chamar OpenAI." },
        { status: 500 },
      );
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(aiJson?.choices?.[0]?.message?.content ?? "null");
    } catch {
      return NextResponse.json({ error: "Resposta da IA não era JSON válido." }, { status: 500 });
    }

    const assignments: AiAssignment[] = Array.isArray(parsed?.assignments) ? parsed.assignments : [];
    const warnings: string[] = Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : [];
    const summary: string | null = parsed?.summary ? String(parsed.summary) : null;

    // Apply
    const skipped: { assignment?: any; reason: string }[] = [];
    const subjectDayCounts = new Map<string, Map<number, number>>();
    let applied = 0;

    // If overwrite, delete existing schedules for the class only within the relevant time slots.
    if (overwrite) {
      await supabase
        .from("schedules")
        .delete()
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .in("time_slot_id", timeSlotIds);
    }

    // Track current counts for requirements.
    const currentCounts = new Map<string, number>();
    if (requirementsEnabled) {
      const { data: currentSched } = await supabase
        .from("schedules")
        .select("subject_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId);
      for (const s of (currentSched as any[] | null) ?? []) {
        const sid = String(s.subject_id ?? "");
        if (!sid) continue;
        currentCounts.set(sid, (currentCounts.get(sid) ?? 0) + 1);
      }
    }

    // Update in-memory occupancy as we apply.
    const localBusyTeachersBySlot = new Map(busyTeachersBySlot);
    const localBusyRoomsBySlot = new Map(busyRoomsBySlot);

    for (const a of assignments) {
      const timeSlotId = String((a as any)?.timeSlotId ?? "");
      const teacherId = String((a as any)?.teacherId ?? "");
      let roomId = (a as any)?.roomId ?? null;
      roomId = roomId === "" ? null : roomId;

      if (!timeSlotId || !teacherId) {
        skipped.push({ assignment: a, reason: "Assignment incompleto (faltou timeSlotId/teacherId)." });
        continue;
      }

      const slot = slotById.get(timeSlotId);
      const teacher = teacherById.get(teacherId);
      if (!slot) {
        skipped.push({ assignment: a, reason: "Slot inválido." });
        continue;
      }
      if (!teacher) {
        skipped.push({ assignment: a, reason: "Professor inválido." });
        continue;
      }

      const slotShift = normalizeShift(slot.shift ?? (classShift || ""));
      if (classShift && slotShift && classShift !== slotShift) {
        skipped.push({ assignment: a, reason: "Slot não pertence ao turno da turma." });
        continue;
      }
      if (!teacherAcceptsShift(teacher, slotShift || null)) {
        skipped.push({ assignment: a, reason: "Professor não atende este turno." });
        continue;
      }
      if (!teacherAvailable(teacher, { shift: slotShift || null, weekday: slot.weekday, period_index: slot.period_index })) {
        skipped.push({ assignment: a, reason: "Professor indisponível neste dia/período." });
        continue;
      }
      if (!teacherAllowedForClass(teacher, classId)) {
        skipped.push({ assignment: a, reason: "Professor não habilitado para a turma." });
        continue;
      }

      const subjectId = inferSubjectId(teacher, (a as any)?.subjectId ?? null);
      if (!subjectId) {
        skipped.push({ assignment: a, reason: "Não foi possível inferir a disciplina do professor." });
        continue;
      }
      if (!teacherAllowsSubject(teacher, subjectId)) {
        skipped.push({ assignment: a, reason: "Disciplina não compatível com este professor." });
        continue;
      }

      // Requirements enforcement
      if (requirementsEnabled) {
        const max = reqBySubject.get(subjectId);
        if (typeof max === "number") {
          const current = currentCounts.get(subjectId) ?? 0;
          if (current >= max) {
            skipped.push({ assignment: a, reason: "Matriz curricular: disciplina já atingiu a carga semanal." });
            continue;
          }
        }
      }

      // Occupancy check
      const bt = localBusyTeachersBySlot.get(timeSlotId) ?? new Set<string>();
      if (bt.has(teacherId)) {
        skipped.push({ assignment: a, reason: "Professor já ocupado neste horário." });
        continue;
      }

      // Room selection: explicit roomId > default room if free > null.
      const br = localBusyRoomsBySlot.get(timeSlotId) ?? new Set<string>();
      if (roomId) {
        if (br.has(String(roomId))) {
          skipped.push({ assignment: a, reason: "Sala já ocupada neste horário." });
          continue;
        }
        if (!teacherAllowsRoom(teacher, String(roomId))) {
          skipped.push({ assignment: a, reason: "Professor não habilitado para esta sala." });
          continue;
        }
      } else {
        const defRoom = teacher.default_room_id ? String(teacher.default_room_id) : "";
        if (defRoom && !br.has(defRoom) && teacherAllowsRoom(teacher, defRoom)) {
          roomId = defRoom;
        }
      }

      // Upsert schedule
      const { data: existing } = await supabase
        .from("schedules")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("time_slot_id", timeSlotId)
        .maybeSingle();

      const conflict = await validateNoConflicts({
        supabase,
        class_id: classId,
        time_slot_id: timeSlotId,
        teacher_id: teacherId,
        room_id: roomId ? String(roomId) : null,
        schedule_id: existing?.id ?? null,
      });
      if (conflict) {
        skipped.push({ assignment: a, reason: conflict.message });
        continue;
      }

      const payload = {
        subject_id: subjectId,
        teacher_id: teacherId,
        room_id: roomId ? String(roomId) : null,
        notes: (a as any)?.notes ? String((a as any).notes) : null,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from("schedules")
          .update(payload)
          .eq("school_id", schoolId)
          .eq("id", existing.id);
        if (error) {
          skipped.push({ assignment: a, reason: error.message });
          continue;
        }
      } else {
        const { error } = await supabase.from("schedules").insert({
          school_id: schoolId,
          class_id: classId,
          time_slot_id: timeSlotId,
          ...payload,
        });
        if (error) {
          skipped.push({ assignment: a, reason: error.message });
          continue;
        }
      }

      // Mark busy
      localBusyTeachersBySlot.get(timeSlotId) ?? localBusyTeachersBySlot.set(timeSlotId, new Set());
      localBusyTeachersBySlot.get(timeSlotId)!.add(teacherId);
      if (roomId) {
        localBusyRoomsBySlot.get(timeSlotId) ?? localBusyRoomsBySlot.set(timeSlotId, new Set());
        localBusyRoomsBySlot.get(timeSlotId)!.add(String(roomId));
      }
      if (requirementsEnabled && subjectId) {
        currentCounts.set(subjectId, (currentCounts.get(subjectId) ?? 0) + 1);
        const byDay = subjectDayCounts.get(subjectId) ?? new Map<number, number>();
        byDay.set(slot.weekday, (byDay.get(slot.weekday) ?? 0) + 1);
        subjectDayCounts.set(subjectId, byDay);
      }

      applied += 1;
    }

    return NextResponse.json({
      ok: true,
      summary: summary ?? "Geração concluída.",
      warnings,
      applied,
      skipped,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}