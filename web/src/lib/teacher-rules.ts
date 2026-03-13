/**
 * Regras de elegibilidade do professor para um slot.
 *
 * Importante: o sistema pode ter bases legadas com formatos diferentes de `availability`.
 * Este helper aceita:
 *  - availability[SHIFT][weekday] = number[] (lista de períodos permitidos)
 *  - availability[SHIFT][weekday] = { [periodIndex]: boolean | 0 | 1 } (mapa por período)
 */

export type TeacherLike = {
  shifts?: string[] | null;
  availability?: any | null;
  available_weekdays?: number[] | null;
  class_ids?: string[] | null;
  subject_id?: string | null;
  subject_ids?: string[] | null;
  room_ids?: string[] | null;
};

export function normUpper(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

export function teacherAcceptsShift(teacher: TeacherLike, shift: string | null) {
  if (!shift) return true;
  const shifts = (teacher.shifts ?? []).map(normUpper).filter(Boolean);
  if (shifts.length === 0) return true;
  return shifts.includes(normUpper(shift));
}

export function teacherAllowedForClass(teacher: TeacherLike, classId: string) {
  const allowed = (teacher.class_ids ?? []).map(String).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(String(classId));
}

export function teacherAllowsSubject(teacher: TeacherLike, subjectId: string) {
  const sid = String(subjectId ?? "").trim();
  if (!sid) return true;

  const primary = String(teacher.subject_id ?? "").trim();
  const legacy = (teacher.subject_ids ?? []).map(String).filter(Boolean);
  const allowed = Array.from(new Set([primary, ...legacy].filter(Boolean)));
  if (allowed.length === 0) return true;
  return allowed.includes(sid);
}

export function teacherAllowsRoom(teacher: TeacherLike, roomId: string) {
  const rid = String(roomId ?? "").trim();
  if (!rid) return true;
  const allowed = (teacher.room_ids ?? []).map(String).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(rid);
}

function availabilityAllowsPeriod(dayValue: any, periodIndex: number): boolean {
  if (!dayValue) return false;

  // Format A: array of allowed periods
  if (Array.isArray(dayValue)) {
    return dayValue.map(Number).filter((n) => Number.isFinite(n)).includes(Number(periodIndex));
  }

  // Format B: object map by periodIndex -> boolean/0/1
  if (typeof dayValue === "object") {
    const v = (dayValue as any)?.[String(periodIndex)];
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v > 0;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (["true", "1", "yes", "sim"].includes(s)) return true;
      if (["false", "0", "no", "nao", "não"].includes(s)) return false;
    }
  }

  return false;
}

/**
 * Disponibilidade do professor para um slot.
 *
 * Semântica:
 * - Se `availability` existir (objeto) e os parâmetros forem válidos, ele é tratado como a fonte de verdade.
 *   Ausência de dados para aquele turno/dia -> indisponível.
 * - Caso contrário, usa `available_weekdays` (legado). Se vazio, assume disponível.
 */
export function teacherAvailable(
  teacher: TeacherLike,
  args: { shift: string | null; weekday: number; period_index: number | null },
) {
  const { shift, weekday, period_index } = args;

  const availability = (teacher as any).availability;
  if (
    availability &&
    typeof availability === "object" &&
    shift &&
    Number.isFinite(weekday) &&
    weekday >= 1 &&
    weekday <= 7 &&
    Number.isFinite(period_index)
  ) {
    const sh = normUpper(shift);
    const dayValue = availability?.[sh]?.[String(weekday)];
    return availabilityAllowsPeriod(dayValue, Number(period_index));
  }

  const days = (teacher.available_weekdays ?? []).map(Number).filter((n) => Number.isFinite(n));
  if (days.length === 0) return true;
  return days.includes(Number(weekday));
}
