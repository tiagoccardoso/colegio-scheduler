import { availabilityHasPeriod, effectiveRoomId, normalizeShift, normalizeShiftOrNull, teacherAcceptsShift } from "@/lib/schedule/rules";
import { parseTeachingRulesJson } from "@/lib/schedule/teaching-rules";

export type TeachingRuleCompat = {
  subject_id: string;
  /** Sala (opcional). null/undefined = qualquer sala */
  room_id?: string | null;
  /** Turma (opcional). null/undefined = qualquer turma */
  class_id?: string | null;
  /** Turno */
  shift: string;
  /** Período (1..6; Noite costuma ser 1..5) */
  period_index: number;
  /** Dias da semana (1=Seg .. 7=Dom). Se vazio/ausente, assume Seg–Sex. */
  weekdays?: number[] | null;
  /** Compat futuro */
  period_from?: number;
  /** Compat futuro */
  period_to?: number;
};

const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function toStr(v: any) {
  return String(v ?? "").trim();
}

/**
 * teaching_rules pode vir como:
 * - array (jsonb no Supabase)
 * - string JSON (hidden input)
 */
export function getTeachingRules(raw: any): TeachingRuleCompat[] {
  if (Array.isArray(raw)) {
    const out: TeachingRuleCompat[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const subject_id = toStr((item as any).subject_id);
      if (!subject_id) continue;

      const roomRaw = (item as any).room_id;
      const room_id = roomRaw == null || toStr(roomRaw) === "" ? null : toStr(roomRaw);

      const shift = normalizeShift((item as any).shift);
      const period_index = Number((item as any).period_index);

      if (!Number.isFinite(period_index) || period_index < 1 || period_index > 6) continue;

      const weekdaysRaw = (item as any).weekdays;
      const weekdays = Array.isArray(weekdaysRaw)
        ? weekdaysRaw.map((d: any) => Number(d)).filter((d: number) => Number.isFinite(d) && d >= 1 && d <= 7)
        : [];

      out.push({
        subject_id,
        room_id,
        shift,
        period_index,
        weekdays: weekdays.length ? uniq(weekdays).sort((a, b) => a - b) : null,
      });
    }
    return out;
  }

  // fallback para string JSON
  return parseTeachingRulesJson(raw);
}

function ruleWeekdays(rule: any): number[] {
  const w = Array.isArray(rule?.weekdays)
    ? rule.weekdays.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 7)
    : [];
  return w.length ? w : DEFAULT_WEEKDAYS;
}

/**
 * Compatibilidade:
 * - Se no futuro a rule trouxer class_id, period_from/period_to, a validação já considera.
 */
function ruleMatchesSlot(
  rule: any,
  args: { class_id: string; shift: string | null; weekday: number; period_index: number | null }
) {
  const shift = normalizeShiftOrNull(args.shift);
  if (!shift) return false;

  const rShift = normalizeShift(rule?.shift);
  if (rShift !== shift) return false;

  const p = Number(args.period_index);
  if (!Number.isFinite(p)) return false;

  // period_index (modelo atual)
  const rPeriodIndex = Number(rule?.period_index);
  if (Number.isFinite(rPeriodIndex)) {
    if (rPeriodIndex !== p) return false;
  } else {
    // period_from / period_to (modelo futuro/compat)
    const pf = Number(rule?.period_from);
    const pt = Number(rule?.period_to);
    if (Number.isFinite(pf) && Number.isFinite(pt)) {
      if (p < pf || p > pt) return false;
    } else {
      return false;
    }
  }

  const weekdays = ruleWeekdays(rule);
  if (weekdays.length && !weekdays.includes(Number(args.weekday))) return false;

  // class_id (modelo futuro/compat): se existir na rule, deve casar
  const rClass = toStr(rule?.class_id);
  if (rClass && rClass !== toStr(args.class_id)) return false;

  return true;
}

export type TeacherConstraintArgs = {
  teacher: any;
  cls: any;
  slot: any;
  subject_id: string;
  room_id: string | null;
};

/**
 * Retorna null quando o professor PODE ser alocado no slot.
 * Retorna string com o motivo quando NÃO pode.
 *
 * Regra principal:
 * - Se teacher.teaching_rules tiver itens => valida pela combinação completa (turno+período+dia + disciplina (+ sala) (+ turma se existir)).
 * - Se não tiver => cai no legado (shifts/availability/class_ids/subject_ids/room_ids).
 */
export function teacherNotAllowedReason(args: TeacherConstraintArgs): string | null {
  const { teacher, cls, slot, subject_id } = args;

  const classShift = toStr(cls?.shift);
  const slotShift = toStr(slot?.shift);
  if (classShift && slotShift && classShift !== slotShift) {
    return "O horário selecionado não pertence ao turno da turma.";
  }

  const targetShift = slotShift || classShift || null;
  const weekday = Number(slot?.weekday ?? NaN);
  const period_index = slot?.period_index == null ? null : Number(slot.period_index);
  const class_id = toStr(cls?.id);

  if (!Number.isFinite(weekday)) return "Horário inválido (dia da semana).";

  const effectiveRoom = effectiveRoomId({
    scheduleRoomId: args.room_id,
    classDefaultRoomId: cls?.default_room_id ? String(cls.default_room_id) : null,
    teacherDefaultRoomId: teacher?.default_room_id ? String(teacher.default_room_id) : null,
  });

  // 1) NOVO MODELO (teaching_rules)
  const rules = getTeachingRules(teacher?.teaching_rules);
  if (rules.length) {
    const slotRules = rules.filter((r) =>
      ruleMatchesSlot(r, { class_id, shift: targetShift, weekday, period_index })
    );
    if (!slotRules.length) {
      return "Professor não possui habilitação para este turno/período.";
    }

    const bySubject = slotRules.filter((r) => toStr((r as any).subject_id) === toStr(subject_id));
    if (!bySubject.length) {
      return "Professor não está habilitado para esta disciplina neste período.";
    }

    // Sala: se qualquer rule do subject não restringe sala => ok.
    const anyRoom = bySubject.some((r) => !toStr((r as any).room_id));
    if (anyRoom) return null;

    // Se restringe, precisa bater com sala efetiva
    const allowedRooms = new Set(bySubject.map((r) => toStr((r as any).room_id)).filter(Boolean));
    if (!effectiveRoom) {
      return "Defina a sala (ou padrão) para validar a habilitação do professor.";
    }
    if (!allowedRooms.has(toStr(effectiveRoom))) {
      return "Professor não está habilitado para esta sala neste período.";
    }

    return null;
  }

  // 2) LEGADO
  if (!teacherAcceptsShift((teacher?.shifts ?? []) as any, targetShift)) {
    return "Professor não atende este turno.";
  }

  const avOk = availabilityHasPeriod(teacher?.availability, { shift: targetShift, weekday, period_index });
  if (avOk === false) return "Professor indisponível neste dia/período.";
  if (avOk === null) {
    const days = ((teacher?.available_weekdays ?? []) as number[]).filter((n) => Number.isFinite(n));
    if (days.length && !days.includes(Number(weekday))) return "Professor indisponível neste dia da semana.";
  }

  const allowedClasses = (((teacher?.class_ids ?? []) as string[]) || []).map(String).filter(Boolean);
  if (allowedClasses.length && class_id && !allowedClasses.includes(class_id)) {
    return "Professor não está habilitado para esta turma.";
  }

  const primarySubject = toStr(teacher?.subject_id);
  const legacySubjects = (((teacher?.subject_ids ?? []) as string[]) || []).map(String).filter(Boolean);
  if (primarySubject && toStr(subject_id) !== primarySubject) {
    return "Disciplina não compatível com este professor.";
  }
  if (!primarySubject && legacySubjects.length && !legacySubjects.includes(toStr(subject_id))) {
    return "Professor não está habilitado para esta disciplina.";
  }

  const allowedRooms = (((teacher?.room_ids ?? []) as string[]) || []).map(String).filter(Boolean);
  if (effectiveRoom && allowedRooms.length && !allowedRooms.includes(toStr(effectiveRoom))) {
    return "Professor não está habilitado para esta sala.";
  }

  return null;
}

/**
 * Utilitários para IA / filtros de UI:
 * Retorna as disciplinas permitidas para um slot.
 */
export function allowedSubjectsForSlot(args: { teacher: any; cls: any; slot: any }) {
  const { teacher, cls, slot } = args;
  const classShift = toStr(cls?.shift);
  const slotShift = toStr(slot?.shift);
  const targetShift = slotShift || classShift || null;

  const weekday = Number(slot?.weekday ?? NaN);
  const period_index = slot?.period_index == null ? null : Number(slot.period_index);
  const class_id = toStr(cls?.id);

  const rules = getTeachingRules(teacher?.teaching_rules);
  if (!rules.length) {
    const primary = toStr(teacher?.subject_id);
    const legacy = (((teacher?.subject_ids ?? []) as string[]) || []).map(String).filter(Boolean);
    return primary ? [primary] : legacy;
  }

  const slotRules = rules.filter((r) => ruleMatchesSlot(r, { class_id, shift: targetShift, weekday, period_index }));
  return uniq(slotRules.map((r) => toStr((r as any).subject_id)).filter(Boolean));
}

/**
 * Utilitários para IA: salas permitidas para (slot + disciplina).
 */
export function allowedRoomsForSlotSubject(args: {
  teacher: any;
  cls: any;
  slot: any;
  subject_id: string;
}): { anyRoom: boolean; roomIds: string[] } {
  const { teacher, cls, slot, subject_id } = args;
  const classShift = toStr(cls?.shift);
  const slotShift = toStr(slot?.shift);
  const targetShift = slotShift || classShift || null;

  const weekday = Number(slot?.weekday ?? NaN);
  const period_index = slot?.period_index == null ? null : Number(slot.period_index);
  const class_id = toStr(cls?.id);

  const rules = getTeachingRules(teacher?.teaching_rules);
  if (!rules.length) {
    // legado: se não houver room_ids => qualquer
    const rooms = (((teacher?.room_ids ?? []) as string[]) || []).map(String).filter(Boolean);
    return { anyRoom: rooms.length === 0, roomIds: rooms };
  }

  const slotRules = rules
    .filter((r) => ruleMatchesSlot(r, { class_id, shift: targetShift, weekday, period_index }))
    .filter((r) => toStr((r as any).subject_id) === toStr(subject_id));

  const anyRoom = slotRules.some((r) => !toStr((r as any).room_id));
  const roomIds = uniq(slotRules.map((r) => toStr((r as any).room_id)).filter(Boolean));

  return { anyRoom, roomIds };
}
