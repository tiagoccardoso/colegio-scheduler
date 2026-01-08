
// src/lib/time-slots/normalize.ts
export type TimeSlotRow = {
  id: string;
  school_id?: string;
  shift: string | null;
  weekday: number;
  period_index: number | null;
  starts_at: string | null;
  ends_at: string | null;
};

export function normalizeTimeSlots(slots: TimeSlotRow[]) {
  const byKey: Record<string, TimeSlotRow[]> = {};
  for (const t of slots) {
    const key = `${String(t.shift ?? "")}|${t.weekday}`;
    (byKey[key] ||= []).push(t);
  }

  const out: TimeSlotRow[] = [];
  for (const key of Object.keys(byKey)) {
    const arr = byKey[key];
    arr.sort((a, b) => {
      const ap = a.period_index ?? 9999;
      const bp = b.period_index ?? 9999;
      if (ap !== bp) return ap - bp;
      const at = a.starts_at ?? "";
      const bt = b.starts_at ?? "";
      if (at !== bt) return at.localeCompare(bt);
      return a.id.localeCompare(b.id);
    });
    let n = 1;
    for (const t of arr) {
      out.push({ ...t, period_index: t.period_index ?? n });
      n++;
    }
  }

  out.sort((a, b) => {
    if (a.shift !== b.shift) return String(a.shift ?? "").localeCompare(String(b.shift ?? ""));
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return (a.period_index ?? 9999) - (b.period_index ?? 9999);
  });
  return out;
}
