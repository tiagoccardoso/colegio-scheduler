import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateNoConflicts } from "@/lib/schedule/validate";
import { isStaffRole } from "@/lib/authz";
import { normalizeGradeSolverSettings } from "@/lib/schedule/solver-settings";

type BuildReq = {
  shift?: string | null;
  overwrite?: boolean;
  classIds?: string[] | null;
};

type TeachingRule = {
  subject_id: string;
  room_id: string;
  class_id: string;
  shift: string;
  period_index: number;
  weekdays?: number[] | null;
};

type SolverCandidate = {
  key: string;
  teacherId: string;
  teacherName: string;
  teacherDefaultRoomId: string | null;
  classId: string;
  subjectId: string;
  roomId: string;
  slotId: string;
  weekday: number;
  periodIndex: number;
};

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

function mapGetSet(map: Map<string, Set<number>>, key: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set<number>();
    map.set(key, set);
  }
  return set;
}

function mapGetDayCount(map: Map<string, Map<number, number>>, key: string) {
  let inner = map.get(key);
  if (!inner) {
    inner = new Map<number, number>();
    map.set(key, inner);
  }
  return inner;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BuildReq;
    const overwrite = Boolean(body?.overwrite);
    const requestedShift = normalizeShift(body?.shift ?? "MANHA");
    const requestedClassIds = Array.isArray(body?.classIds) ? body.classIds.map(String).filter(Boolean) : null;

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

    if (!profile || !isStaffRole((profile as any).role)) {
      return NextResponse.json({ error: "Apenas diretor pode usar esta função." }, { status: 403 });
    }

    const schoolId = String((profile as any).school_id);

    const [{ data: settingsRow }, { data: timeSlots }] = await Promise.all([
      supabase.from("schedule_solver_settings").select("*").eq("school_id", schoolId).maybeSingle(),
      supabase
        .from("time_slots")
        .select("id,weekday,shift,period_index,starts_at,ends_at")
        .eq("school_id", schoolId)
        .eq("shift", requestedShift)
        .in("weekday", [1, 2, 3, 4, 5]),
    ]);

    const settings = normalizeGradeSolverSettings(settingsRow ?? {});

    const slots = ((timeSlots as any[]) ?? []).filter((t) => t?.id && t?.weekday && t?.period_index);
    if (slots.length === 0) {
      return NextResponse.json(
        { error: `Nenhum horário encontrado para o turno ${requestedShift}. Configure em Horários.` },
        { status: 400 },
      );
    }

    const slotIds = slots.map((s) => String(s.id));
    const slotKeyToId = new Map<string, string>();
    const slotById = new Map<string, any>();
    const maxPeriodByWeekday = new Map<number, number>();
    for (const s of slots) {
      slotKeyToId.set(`${Number(s.weekday)}-${Number(s.period_index)}`, String(s.id));
      slotById.set(String(s.id), s);
      maxPeriodByWeekday.set(
        Number(s.weekday),
        Math.max(Number(s.period_index ?? 0), maxPeriodByWeekday.get(Number(s.weekday)) ?? 0),
      );
    }

    let hasActivityType = true;
    {
      const probe = await supabase.from("schedules").select("activity_type").limit(1);
      if (probe.error) hasActivityType = false;
    }

    if (!overwrite) {
      const { data: existing } = await supabase
        .from("schedules")
        .select(hasActivityType ? "id,class_id,activity_type" : "id,class_id")
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds);
      const aulaCount = ((existing as any[]) ?? []).filter((r) => {
        if (!r?.class_id) return false;
        if (!hasActivityType) return true;
        return String(r?.activity_type ?? "").trim().toUpperCase() !== "HA";
      }).length;
      if (aulaCount > 0) {
        return NextResponse.json({
          ok: true,
          shift: requestedShift,
          overwrite,
          applied: 0,
          skipped: 0,
          skippedAll: true,
          summary: "Grade já existe para este turno; não remontei automaticamente.",
        });
      }
    }

    if (overwrite) {
      let delQuery: any = supabase
        .from("schedules")
        .delete()
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds)
        .not("class_id", "is", null);

      if (hasActivityType) {
        delQuery = delQuery.or("activity_type.is.null,activity_type.neq.HA");
      }
      if (requestedClassIds?.length) {
        delQuery = delQuery.in("class_id", requestedClassIds);
      }
      const delRes = await delQuery;
      if (delRes.error) {
        return NextResponse.json({ error: delRes.error.message || "Falha ao limpar grade." }, { status: 400 });
      }
    }

    let existingSchedules: any[] = [];
    if (slotIds.length) {
      const { data } = await supabase
        .from("schedules")
        .select(
          hasActivityType
            ? "id,time_slot_id,teacher_id,room_id,class_id,subject_id,activity_type"
            : "id,time_slot_id,teacher_id,room_id,class_id,subject_id",
        )
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds);
      existingSchedules = (data as any[]) ?? [];
    }

    const busyTeacher = new Map<string, Set<string>>();
    const busyRoom = new Map<string, Set<string>>();
    const busyClass = new Map<string, Set<string>>();
    const teacherDayPeriods = new Map<string, Set<number>>();
    const classSubjectDayPeriods = new Map<string, Set<number>>();
    const classSubjectDayCount = new Map<string, Map<number, number>>();
    const classSubjectCount = new Map<string, number>();

    for (const s of existingSchedules) {
      const ts = String(s?.time_slot_id ?? "");
      if (!ts) continue;
      const tid = String(s?.teacher_id ?? "");
      const rid = String(s?.room_id ?? "");
      const cid = String(s?.class_id ?? "");
      const sid = String(s?.subject_id ?? "");
      const slot = slotById.get(ts);
      const weekday = Number(slot?.weekday ?? 0);
      const period = Number(slot?.period_index ?? 0);

      if (tid) {
        busyTeacher.get(ts) ?? busyTeacher.set(ts, new Set());
        busyTeacher.get(ts)!.add(tid);
        if (weekday && period) mapGetSet(teacherDayPeriods, `${tid}|${weekday}`).add(period);
      }
      if (rid) {
        busyRoom.get(ts) ?? busyRoom.set(ts, new Set());
        busyRoom.get(ts)!.add(rid);
      }
      if (cid) {
        busyClass.get(ts) ?? busyClass.set(ts, new Set());
        busyClass.get(ts)!.add(cid);
      }
      if (cid && sid && weekday && period) {
        const subjectKey = `${cid}|${sid}`;
        mapGetSet(classSubjectDayPeriods, `${subjectKey}|${weekday}`).add(period);
        const byDay = mapGetDayCount(classSubjectDayCount, subjectKey);
        byDay.set(weekday, (byDay.get(weekday) ?? 0) + 1);
        classSubjectCount.set(subjectKey, (classSubjectCount.get(subjectKey) ?? 0) + 1);
      }
    }

    const [{ data: teachersRaw }, { data: reqRows }] = await Promise.all([
      supabase
        .from("teachers")
        .select("id,name,default_room_id,teaching_rules")
        .eq("school_id", schoolId)
        .order("name", { ascending: true }),
      supabase
        .from("class_subject_requirements")
        .select("class_id,subject_id,lessons_per_week")
        .eq("school_id", schoolId),
    ]);

    const teachers = ((teachersRaw as any[]) ?? []).filter((t) => t?.id);
    const reqByClassSubject = new Map<string, number>();
    for (const row of (reqRows as any[] | null) ?? []) {
      const key = `${String((row as any)?.class_id ?? "")}|${String((row as any)?.subject_id ?? "")}`;
      const lessons = Number((row as any)?.lessons_per_week ?? 0);
      if (key !== "|" && Number.isFinite(lessons) && lessons > 0) reqByClassSubject.set(key, lessons);
    }

    let applied = 0;
    let skipped = 0;
    const warnings: string[] = [];
    const conflictCounts = { teacher: 0, room: 0, class: 0 };
    const conflictPreview: string[] = [];

    function pushPreview(msg: string) {
      if (!msg || conflictPreview.length >= 10) return;
      conflictPreview.push(msg);
    }

    function slotLabel(slotId: string) {
      const ts = slotById.get(slotId);
      if (!ts) return "(horário)";
      const w = WEEKDAY_LABEL?.[Number(ts.weekday) ?? 0] ?? "Dia";
      const p = Number(ts.period_index ?? 0);
      const range = ts.starts_at ? `${ts.starts_at}–${ts.ends_at}` : p ? `${p}º` : "";
      return `${w} ${range}`.trim();
    }

    const candidateKeys = new Set<string>();
    const candidates: SolverCandidate[] = [];
    for (const t of teachers) {
      const teacherId = String(t.id);
      const teacherName = String((t as any).name ?? "(sem nome)");
      const teacherDefaultRoomId = (t as any).default_room_id ? String((t as any).default_room_id) : null;
      const rules = safeRules((t as any).teaching_rules).filter((r) => normalizeShift(r.shift) === requestedShift);
      for (const r of rules) {
        if (requestedClassIds?.length && !requestedClassIds.includes(String(r.class_id))) continue;
        const weekdays = (r.weekdays && r.weekdays.length ? r.weekdays : DEFAULT_WEEKDAYS)
          .map((d) => Number(d))
          .filter((d) => d >= 1 && d <= 5);
        for (const wd of weekdays) {
          const slotId = slotKeyToId.get(`${wd}-${Number(r.period_index)}`);
          if (!slotId) {
            skipped += 1;
            continue;
          }
          const key = `${teacherId}|${String(r.class_id)}|${slotId}|${String(r.subject_id)}|${String(r.room_id)}`;
          if (candidateKeys.has(key)) continue;
          candidateKeys.add(key);
          candidates.push({
            key,
            teacherId,
            teacherName,
            teacherDefaultRoomId,
            classId: String(r.class_id),
            subjectId: String(r.subject_id),
            roomId: String(r.room_id),
            slotId,
            weekday: wd,
            periodIndex: Number(r.period_index),
          });
        }
      }
    }

    if (!candidates.length) {
      return NextResponse.json({
        ok: true,
        shift: requestedShift,
        overwrite,
        applied: 0,
        skipped,
        conflicts: { total: 0, teacher: 0, room: 0, class: 0, preview: [] },
        warnings: ["Nenhuma regra elegível encontrada para o turno. Verifique Professores → Habilitações por horário."],
        summary: "Nenhuma regra elegível encontrada para executar o Solve.",
      });
    }

    const remaining = [...candidates];

    function calcScore(c: SolverCandidate) {
      if (busyTeacher.get(c.slotId)?.has(c.teacherId)) return Number.NEGATIVE_INFINITY;
      if (busyRoom.get(c.slotId)?.has(c.roomId)) return Number.NEGATIVE_INFINITY;
      if (busyClass.get(c.slotId)?.has(c.classId)) return Number.NEGATIVE_INFINITY;

      const subjectKey = `${c.classId}|${c.subjectId}`;
      const reqMax = reqByClassSubject.get(subjectKey);
      const current = classSubjectCount.get(subjectKey) ?? 0;
      if (settings.respect_requirements && typeof reqMax === "number" && current >= reqMax) {
        return Number.NEGATIVE_INFINITY;
      }

      let score = 100;
      if (settings.respect_requirements && typeof reqMax === "number") {
        score += Math.max(0, (reqMax - current) * 20);
      }

      const byDay = classSubjectDayCount.get(subjectKey);
      const countSameDay = byDay?.get(c.weekday) ?? 0;
      score += countSameDay === 0 ? settings.spread_subjects_weight : -countSameDay * settings.spread_subjects_weight;

      const sameSubjectPeriods = classSubjectDayPeriods.get(`${subjectKey}|${c.weekday}`);
      if (sameSubjectPeriods?.has(c.periodIndex - 1) || sameSubjectPeriods?.has(c.periodIndex + 1)) {
        score += settings.prefer_consecutive_weight;
      }

      const teacherPeriods = teacherDayPeriods.get(`${c.teacherId}|${c.weekday}`);
      if (teacherPeriods && teacherPeriods.size > 0) {
        score += settings.compact_teacher_days_weight;
        if (teacherPeriods.has(c.periodIndex - 1) || teacherPeriods.has(c.periodIndex + 1)) {
          score += settings.reduce_teacher_gaps_weight * 2;
        } else {
          score -= Math.max(1, Math.floor(settings.reduce_teacher_gaps_weight / 2));
        }
      }

      if ((maxPeriodByWeekday.get(c.weekday) ?? 0) === c.periodIndex) {
        score -= settings.avoid_last_period_penalty;
      }

      if (settings.prioritize_default_room && c.teacherDefaultRoomId && c.teacherDefaultRoomId === c.roomId) {
        score += 2;
      }

      return score;
    }

    while (remaining.length > 0) {
      let bestIndex = -1;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < remaining.length; i += 1) {
        const score = calcScore(remaining[i]);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      if (bestIndex < 0 || !Number.isFinite(bestScore)) break;

      const candidate = remaining.splice(bestIndex, 1)[0];
      const conflict = await validateNoConflicts({
        supabase: supabase as any,
        class_id: candidate.classId,
        time_slot_id: candidate.slotId,
        teacher_id: candidate.teacherId,
        room_id: candidate.roomId || null,
      });
      if (conflict) {
        if (conflict.kind === "teacher") conflictCounts.teacher += 1;
        if (conflict.kind === "room") conflictCounts.room += 1;
        if (conflict.kind === "class") conflictCounts.class += 1;
        pushPreview(conflict.message);
        skipped += 1;
        continue;
      }

      const payload: any = {
        school_id: schoolId,
        class_id: candidate.classId,
        time_slot_id: candidate.slotId,
        teacher_id: candidate.teacherId,
        subject_id: candidate.subjectId,
        room_id: candidate.roomId,
        notes: null,
      };
      if (hasActivityType) payload.activity_type = "AULA";

      const ins = await supabase.from("schedules").insert(payload);
      if (ins.error) {
        skipped += 1;
        pushPreview(ins.error.message || `Falha ao inserir regra em ${slotLabel(candidate.slotId)}.`);
        continue;
      }

      applied += 1;
      busyTeacher.get(candidate.slotId) ?? busyTeacher.set(candidate.slotId, new Set());
      busyTeacher.get(candidate.slotId)!.add(candidate.teacherId);
      busyRoom.get(candidate.slotId) ?? busyRoom.set(candidate.slotId, new Set());
      busyRoom.get(candidate.slotId)!.add(candidate.roomId);
      busyClass.get(candidate.slotId) ?? busyClass.set(candidate.slotId, new Set());
      busyClass.get(candidate.slotId)!.add(candidate.classId);
      mapGetSet(teacherDayPeriods, `${candidate.teacherId}|${candidate.weekday}`).add(candidate.periodIndex);
      const subjectKey = `${candidate.classId}|${candidate.subjectId}`;
      mapGetSet(classSubjectDayPeriods, `${subjectKey}|${candidate.weekday}`).add(candidate.periodIndex);
      const byDay = mapGetDayCount(classSubjectDayCount, subjectKey);
      byDay.set(candidate.weekday, (byDay.get(candidate.weekday) ?? 0) + 1);
      classSubjectCount.set(subjectKey, (classSubjectCount.get(subjectKey) ?? 0) + 1);
    }

    for (const candidate of remaining) {
      if (busyTeacher.get(candidate.slotId)?.has(candidate.teacherId)) {
        conflictCounts.teacher += 1;
        pushPreview(`Professor ocupado: ${candidate.teacherName} em ${slotLabel(candidate.slotId)}.`);
      } else if (busyRoom.get(candidate.slotId)?.has(candidate.roomId)) {
        conflictCounts.room += 1;
        pushPreview(`Sala ocupada em ${slotLabel(candidate.slotId)}.`);
      } else if (busyClass.get(candidate.slotId)?.has(candidate.classId)) {
        conflictCounts.class += 1;
        pushPreview(`Turma já tem aula em ${slotLabel(candidate.slotId)}.`);
      } else {
        const subjectKey = `${candidate.classId}|${candidate.subjectId}`;
        const reqMax = reqByClassSubject.get(subjectKey);
        const current = classSubjectCount.get(subjectKey) ?? 0;
        if (settings.respect_requirements && typeof reqMax === "number" && current >= reqMax) {
          pushPreview(`Matriz curricular atingida para a turma ${candidate.classId} em ${slotLabel(candidate.slotId)}.`);
        }
      }
      skipped += 1;
    }

    if (applied === 0 && skipped > 0) {
      warnings.push(
        "Nenhuma aula foi aplicada. Verifique se os professores têm regras (Professores → Habilitações por horário), se o turno foi cadastrado e se a matriz curricular não está bloqueando as combinações.",
      );
    }

    const totalConflicts = conflictCounts.teacher + conflictCounts.room + conflictCounts.class;
    if (totalConflicts > 0) {
      warnings.push(
        `Conflitos/pulos no Solve: Professores (${conflictCounts.teacher}), Turmas (${conflictCounts.class}), Salas (${conflictCounts.room}).`,
      );
    }

    return NextResponse.json({
      ok: true,
      shift: requestedShift,
      overwrite,
      applied,
      skipped,
      conflicts: {
        total: totalConflicts,
        teacher: conflictCounts.teacher,
        room: conflictCounts.room,
        class: conflictCounts.class,
        preview: conflictPreview,
      },
      warnings,
      summary:
        `Solve executado com heurísticas configuráveis. Aplicadas: ${applied}. Ignoradas: ${skipped}. ` +
        `Pesos — consecutivas ${settings.prefer_consecutive_weight}, compactação ${settings.compact_teacher_days_weight}, janelas ${settings.reduce_teacher_gaps_weight}, último horário ${settings.avoid_last_period_penalty}, espalhamento ${settings.spread_subjects_weight}.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
