
// src/lib/schedule/rules.ts
export type Shift = "MANHA" | "TARDE" | "NOITE";

export function normalizeShift(v: any): Shift {
  const key = String(v ?? "").trim().toUpperCase();
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  return "NOITE";
}

export function normalizeShiftOrNull(v: any): Shift | null {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  return normalizeShift(raw);
}

export function availabilityHasPeriod(
  availability: any,
  args: { shift: string | null; weekday: number; period_index: number | null }
) {
  const { shift, weekday, period_index } = args;
  if (!availability || typeof availability !== "object") return null; // means "no structured availability"
  if (!shift || !Number.isFinite(weekday) || !Number.isFinite(period_index)) return false;

  const sKey = normalizeShift(shift);
  const byShift = availability?.[sKey] ?? availability?.[String(sKey).toLowerCase()];
  const byDay = byShift?.[String(weekday)] ?? byShift?.[weekday];
  if (!byDay) return false;

  // Format A (current UI): [1,2,3,...]
  if (Array.isArray(byDay)) return byDay.includes(Number(period_index));

  // Format B (legacy-ish): { "1": true, "2": 0, ... }
  const v = byDay?.[String(period_index)] ?? byDay?.[period_index as any];
  return !!v;
}

export function teacherAcceptsShift(shifts: any[] | null | undefined, shift: string | null) {
  if (!shift) return true;
  const list = (shifts ?? []).map(normalizeShift).filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(normalizeShift(shift));
}

export function subjectLabel(subject: { name?: string | null; short_name?: string | null } | undefined | null) {
  const short = subject?.short_name ? String(subject.short_name).trim() : "";
  const name = subject?.name ? String(subject.name).trim() : "";
  return short || name || "Disciplina";
}

export function teacherLabel(teacher: { name?: string | null; short_name?: string | null } | undefined | null) {
  const short = teacher?.short_name ? String(teacher.short_name).trim() : "";
  const name = teacher?.name ? String(teacher.name).trim() : "";
  return short || name || "Professor";
}

export function roomLabel(room: { name?: string | null; room_number?: number | null } | undefined | null) {
  if (room?.room_number) return `SALA ${String(room.room_number).padStart(2, "0")}`;
  return room?.name ? String(room.name) : "SALA";
}

export function effectiveRoomId(args: {
  scheduleRoomId?: string | null;
  classDefaultRoomId?: string | null;
  teacherDefaultRoomId?: string | null;
}) {
  return args.scheduleRoomId || args.classDefaultRoomId || args.teacherDefaultRoomId || null;
}
