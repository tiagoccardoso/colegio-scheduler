import { deriveLegacyFieldsFromTeachingRules, type TeachingRule } from "@/lib/schedule/teaching-rules";
import { effectiveRoomId as pickRoomId, normalizeShift } from "@/lib/schedule/rules";

const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

type ScheduleSnapshot = {
  id: string;
  school_id: string;
  activity_type?: string | null;
  class_id?: string | null;
  time_slot_id: string;
  subject_id?: string | null;
  teacher_id: string;
  room_id?: string | null;
  notes?: string | null;
};

type SlotInfo = { weekday: number; shift: string | null; period_index: number | null };

type ClassInfo = { id: string; shift: string | null; default_room_id: string | null };

type TeacherInfo = { id: string; default_room_id: string | null; teaching_rules: any };

function toStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeActivityType(v: any): "AULA" | "HA" {
  const k = String(v ?? "AULA").trim().toUpperCase();
  return k === "HA" ? "HA" : "AULA";
}

function uniqNums(arr: number[]) {
  const out = Array.from(new Set(arr)).filter((n) => Number.isFinite(n));
  out.sort((a, b) => a - b);
  return out;
}

function ruleWeekdays(rule: any): number[] {
  const raw = Array.isArray(rule?.weekdays)
    ? rule.weekdays
        .map((n: any) => Number(n))
        .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 7)
    : [];
  return raw.length ? uniqNums(raw) : DEFAULT_WEEKDAYS.slice();
}

function normalizeRules(raw: any): TeachingRule[] {
  if (!Array.isArray(raw)) return [];
  const out: TeachingRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const subject_id = toStr((item as any).subject_id);
    const class_id = toStr((item as any).class_id);
    const room_id = toStr((item as any).room_id);
    const period_index = Number((item as any).period_index);
    const shiftRaw = (item as any).shift;
    if (!subject_id || !class_id || !room_id) continue;
    if (!Number.isFinite(period_index) || period_index < 1 || period_index > 6) continue;
    const shift = normalizeShift(shiftRaw);

    const weekdaysRaw = Array.isArray((item as any).weekdays)
      ? (item as any).weekdays
          .map((n: any) => Number(n))
          .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 7)
      : [];

    out.push({
      subject_id,
      class_id,
      room_id,
      shift,
      period_index,
      weekdays: weekdaysRaw.length ? uniqNums(weekdaysRaw) : null,
    });
  }
  return out;
}

function dedupeRules(rules: TeachingRule[]) {
  const seen = new Map<string, TeachingRule>();
  for (const r of rules) {
    const key = [
      toStr(r.subject_id),
      toStr(r.class_id),
      toStr(r.room_id),
      normalizeShift(r.shift),
      String(r.period_index),
    ].join("|");

    const w = Array.isArray(r.weekdays) && r.weekdays.length ? uniqNums(r.weekdays) : null;
    const wKey = w ? w.join(",") : "*";
    const k2 = key + "|" + wKey;

    if (!seen.has(k2)) {
      seen.set(k2, { ...r, shift: normalizeShift(r.shift), weekdays: w });
    }
  }
  return Array.from(seen.values());
}

function removeWeekdayFromRule(rule: TeachingRule, weekday: number): TeachingRule | null {
  const days = ruleWeekdays(rule);
  const remaining = days.filter((d) => d !== weekday);
  if (remaining.length === 0) return null;
  return { ...rule, weekdays: uniqNums(remaining) };
}

function applyRemoveRule(args: {
  rules: TeachingRule[];
  shift: string;
  period_index: number;
  weekday: number;
  class_id: string;
  subject_id: string;
}) {
  const { rules, shift, period_index, weekday, class_id, subject_id } = args;
  const sKey = normalizeShift(shift);

  const out: TeachingRule[] = [];
  for (const r of rules) {
    const match =
      normalizeShift(r.shift) === sKey &&
      Number(r.period_index) === Number(period_index) &&
      toStr(r.class_id) === toStr(class_id) &&
      toStr(r.subject_id) === toStr(subject_id);

    if (!match) {
      out.push(r);
      continue;
    }

    const updated = removeWeekdayFromRule(r, weekday);
    if (updated) out.push(updated);
  }

  return dedupeRules(out);
}

function applyAddRule(args: {
  rules: TeachingRule[];
  shift: string;
  period_index: number;
  weekday: number;
  class_id: string;
  subject_id: string;
  room_id: string;
}) {
  const { rules, shift, period_index, weekday, class_id, subject_id, room_id } = args;
  const sKey = normalizeShift(shift);

  let applied = false;
  const out: TeachingRule[] = rules.map((r) => {
    const match =
      normalizeShift(r.shift) === sKey &&
      Number(r.period_index) === Number(period_index) &&
      toStr(r.class_id) === toStr(class_id) &&
      toStr(r.subject_id) === toStr(subject_id);

    if (!match) return r;

    applied = true;
    const days = ruleWeekdays(r);
    const merged = uniqNums(days.concat([weekday]));
    return { ...r, room_id, weekdays: merged };
  });

  if (!applied) {
    out.push({
      subject_id,
      class_id,
      room_id,
      shift: sKey,
      period_index,
      weekdays: [weekday],
    });
  }

  return dedupeRules(out);
}

async function fetchSlot(supabase: any, schoolId: string, timeSlotId: string): Promise<SlotInfo | null> {
  const { data } = await supabase
    .from("time_slots")
    .select("weekday,shift,period_index")
    .eq("school_id", schoolId)
    .eq("id", timeSlotId)
    .maybeSingle();
  if (!data) return null;
  return {
    weekday: Number((data as any).weekday),
    shift: (data as any).shift ?? null,
    period_index: (data as any).period_index == null ? null : Number((data as any).period_index),
  };
}

async function fetchClass(supabase: any, schoolId: string, classId: string): Promise<ClassInfo | null> {
  if (!classId) return null;
  const { data } = await supabase
    .from("classes")
    .select("id,shift,default_room_id")
    .eq("school_id", schoolId)
    .eq("id", classId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: String((data as any).id),
    shift: (data as any).shift ?? null,
    default_room_id: (data as any).default_room_id ? String((data as any).default_room_id) : null,
  };
}

async function fetchTeacher(supabase: any, schoolId: string, teacherId: string): Promise<TeacherInfo | null> {
  if (!teacherId) return null;
  const { data } = await supabase
    .from("teachers")
    .select("id,default_room_id,teaching_rules")
    .eq("school_id", schoolId)
    .eq("id", teacherId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: String((data as any).id),
    default_room_id: (data as any).default_room_id ? String((data as any).default_room_id) : null,
    teaching_rules: (data as any).teaching_rules,
  };
}

async function saveTeacherRules(supabase: any, schoolId: string, teacherId: string, rules: TeachingRule[]) {
  const derived = deriveLegacyFieldsFromTeachingRules(rules);

  const payload: any = {
    teaching_rules: rules,
    shifts: derived.shifts,
    availability: derived.availability,
    available_weekdays: derived.available_weekdays,
    subject_id: derived.subject_id,
    default_room_id: derived.default_room_id,
    subject_ids: derived.subject_ids ?? [],
    room_ids: derived.room_ids ?? [],
    class_ids: derived.class_ids ?? [],
  };

  const { error } = await supabase
    .from("teachers")
    .update(payload)
    .eq("school_id", schoolId)
    .eq("id", teacherId);

  if (error) throw new Error(error.message || "Falha ao atualizar cadastro do professor.");
}

async function ensureRoomIdForAula(args: {
  supabase: any;
  schoolId: string;
  schedule: ScheduleSnapshot;
  teacher: TeacherInfo;
  cls: ClassInfo;
}) {
  const { supabase, schoolId, schedule, teacher, cls } = args;

  const resolved = pickRoomId({
    scheduleRoomId: schedule.room_id ?? null,
    classDefaultRoomId: cls.default_room_id,
    teacherDefaultRoomId: teacher.default_room_id,
  });

  if (!resolved) {
    throw new Error(
      "Defina a sala (ou configure sala padrao na turma ou no professor) para salvar a aula.",
    );
  }

  // Se a schedule nao tem room_id, grava para manter consistencia (e relatórios mais claros)
  if (!schedule.room_id) {
    await supabase
      .from("schedules")
      .update({ room_id: resolved })
      .eq("school_id", schoolId)
      .eq("id", schedule.id);
    schedule.room_id = resolved;
  }

  return resolved;
}

export async function applyTeachingRulesForTransition(args: {
  supabase: any;
  schoolId: string;
  from: ScheduleSnapshot | null;
  to: ScheduleSnapshot | null;
}) {
  const { supabase, schoolId } = args;

  const fromAct = args.from ? normalizeActivityType(args.from.activity_type) : null;
  const toAct = args.to ? normalizeActivityType(args.to.activity_type) : null;

  const fromIsAula = fromAct === "AULA";
  const toIsAula = toAct === "AULA";

  if (!fromIsAula && !toIsAula) return;

  const fromTeacherId = args.from?.teacher_id ? String(args.from.teacher_id) : "";
  const toTeacherId = args.to?.teacher_id ? String(args.to.teacher_id) : "";

  // Se for o mesmo professor, faz em uma unica atualizacao para evitar race.
  if (fromIsAula && toIsAula && fromTeacherId && toTeacherId && fromTeacherId === toTeacherId) {
    const teacher = await fetchTeacher(supabase, schoolId, fromTeacherId);
    if (!teacher) return;

    let rules = normalizeRules(teacher.teaching_rules);

    // REMOVE
    if (args.from?.class_id && args.from?.subject_id) {
      const slot = await fetchSlot(supabase, schoolId, args.from.time_slot_id);
      if (slot && slot.shift && slot.period_index != null) {
        rules = applyRemoveRule({
          rules,
          shift: slot.shift,
          period_index: slot.period_index,
          weekday: slot.weekday,
          class_id: String(args.from.class_id),
          subject_id: String(args.from.subject_id),
        });
      }
    }

    // ADD
    if (args.to?.class_id && args.to?.subject_id) {
      const slot = await fetchSlot(supabase, schoolId, args.to.time_slot_id);
      const cls = await fetchClass(supabase, schoolId, String(args.to.class_id));
      if (slot && slot.shift && slot.period_index != null && cls) {
        const room_id = await ensureRoomIdForAula({ supabase, schoolId, schedule: args.to, teacher, cls });
        rules = applyAddRule({
          rules,
          shift: slot.shift,
          period_index: slot.period_index,
          weekday: slot.weekday,
          class_id: String(args.to.class_id),
          subject_id: String(args.to.subject_id),
          room_id,
        });
      }
    }

    await saveTeacherRules(supabase, schoolId, teacher.id, rules);
    return;
  }

  if (fromIsAula && args.from?.class_id && args.from?.subject_id && fromTeacherId) {
    const teacher = await fetchTeacher(supabase, schoolId, fromTeacherId);
    if (teacher) {
      let rules = normalizeRules(teacher.teaching_rules);
      const slot = await fetchSlot(supabase, schoolId, args.from.time_slot_id);
      if (slot && slot.shift && slot.period_index != null) {
        rules = applyRemoveRule({
          rules,
          shift: slot.shift,
          period_index: slot.period_index,
          weekday: slot.weekday,
          class_id: String(args.from.class_id),
          subject_id: String(args.from.subject_id),
        });
        await saveTeacherRules(supabase, schoolId, teacher.id, rules);
      }
    }
  }

  if (toIsAula && args.to?.class_id && args.to?.subject_id && toTeacherId) {
    const teacher = await fetchTeacher(supabase, schoolId, toTeacherId);
    if (teacher) {
      let rules = normalizeRules(teacher.teaching_rules);
      const slot = await fetchSlot(supabase, schoolId, args.to.time_slot_id);
      const cls = await fetchClass(supabase, schoolId, String(args.to.class_id));
      if (slot && slot.shift && slot.period_index != null && cls) {
        const room_id = await ensureRoomIdForAula({ supabase, schoolId, schedule: args.to, teacher, cls });
        rules = applyAddRule({
          rules,
          shift: slot.shift,
          period_index: slot.period_index,
          weekday: slot.weekday,
          class_id: String(args.to.class_id),
          subject_id: String(args.to.subject_id),
          room_id,
        });
        await saveTeacherRules(supabase, schoolId, teacher.id, rules);
      }
    }
  }
}
