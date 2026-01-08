import { normalizeShift, type Shift } from "@/lib/schedule/rules";

export type TeachingRule = {
  /** Disciplina habilitada */
  subject_id: string;
  /** Sala habilitada (obrigatória) */
  room_id: string;
  /** Turma habilitada (obrigatória) */
  class_id: string;
  /** Turno */
  shift: Shift;
  /** Período (1..6; Noite costuma ser 1..5) */
  period_index: number;
  /** Dias da semana (1=Seg .. 7=Dom). Se vazio/ausente, assume Seg–Sex. */
  weekdays?: number[] | null;
};

const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export function parseTeachingRulesJson(raw: any): TeachingRule[] {
  if (raw == null) return [];
  const text = String(raw);
  if (!text.trim()) return [];

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  const out: TeachingRule[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;

    const subject_id = String((item as any).subject_id ?? "").trim();
    if (!subject_id) continue;

    const roomRaw = (item as any).room_id;
    const room_id = roomRaw == null || String(roomRaw).trim() === "" ? null : String(roomRaw).trim();
    if (!room_id) continue;

    const classRaw = (item as any).class_id;
    const class_id = classRaw == null || String(classRaw).trim() === "" ? null : String(classRaw).trim();
    if (!class_id) continue;

    const shift = normalizeShift((item as any).shift) as Shift;
    const period_index = Number((item as any).period_index);
    if (!Number.isFinite(period_index) || period_index < 1 || period_index > 6) continue;

    const weekdaysRaw = (item as any).weekdays;
    const weekdays = Array.isArray(weekdaysRaw)
      ? weekdaysRaw
          .map((d: any) => Number(d))
          .filter((d: number) => Number.isFinite(d) && d >= 1 && d <= 7)
      : [];

    out.push({
      subject_id,
      room_id,
      class_id,
      shift,
      period_index,
      weekdays: weekdays.length ? uniq(weekdays).sort((a, b) => a - b) : null,
    });
  }

  return out;
}

/**
 * Deriva os campos "legados" que o restante do sistema já entende (turnos, availability, subject_ids, room_ids, class_ids...).
 *
 * Semântica importante (compatível com teacher-rules.ts):
 * - room_ids vazio => aceita qualquer sala
 * - class_ids vazio => aceita qualquer turma
 * - subject_id só é preenchido quando existe UMA única disciplina; caso contrário fica null e usa subject_ids.
 */
export function deriveLegacyFieldsFromTeachingRules(rules: TeachingRule[]) {
  const shifts = uniq(rules.map((r) => r.shift));

  const subject_ids = uniq(rules.map((r) => r.subject_id)).filter(Boolean);
  const subject_id = subject_ids.length === 1 ? subject_ids[0] : null;

  const hasAnyRoom = rules.some((r) => !r.room_id);
  const room_ids = hasAnyRoom ? [] : uniq(rules.map((r) => (r.room_id ? String(r.room_id) : ""))).filter(Boolean);
  const default_room_id = room_ids.length === 1 ? room_ids[0] : null;

  const hasAnyClass = rules.some((r) => !r.class_id);
  const class_ids = hasAnyClass ? [] : uniq(rules.map((r) => (r.class_id ? String(r.class_id) : ""))).filter(Boolean);

  const availability: Record<string, Record<string, number[]>> = {};
  const daysSet = new Set<number>();

  for (const r of rules) {
    const days = (r.weekdays && r.weekdays.length ? r.weekdays : DEFAULT_WEEKDAYS).slice();
    for (const d of days) {
      daysSet.add(d);
      availability[r.shift] ??= {};
      availability[r.shift][String(d)] ??= [];
      availability[r.shift][String(d)].push(r.period_index);
    }
  }

  for (const s of Object.keys(availability)) {
    for (const d of Object.keys(availability[s] ?? {})) {
      availability[s][d] = uniq(availability[s][d]).sort((a, b) => a - b);
    }
  }

  const available_weekdays = uniq(Array.from(daysSet)).sort((a, b) => a - b);

  return {
    shifts: shifts.length ? shifts : (["MANHA"] as Shift[]),
    availability,
    available_weekdays: available_weekdays.length ? available_weekdays : DEFAULT_WEEKDAYS,
    subject_ids,
    room_ids,
    class_ids,
    subject_id,
    default_room_id,
  };
}
