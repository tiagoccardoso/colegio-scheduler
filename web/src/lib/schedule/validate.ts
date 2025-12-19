import type { SupabaseClient } from "@supabase/supabase-js";

const WEEKDAY_LABEL: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};

type ConflictInfo = {
  kind: "teacher" | "room";
  message: string;
};

/**
 * Deterministic, server-side validation to prevent schedule conflicts.
 * NOTE: Still add DB constraints for full protection under concurrency.
 */
export async function validateNoConflicts(args: {
  supabase: SupabaseClient;
  class_id: string;
  time_slot_id: string;
  teacher_id: string;
  room_id: string | null;
}): Promise<ConflictInfo | null> {
  const { supabase, class_id, time_slot_id, teacher_id, room_id } = args;

  // Teacher conflict: same teacher in another class at the same time slot.
  if (teacher_id) {
    const { data: tConflict } = await supabase
      .from("schedules")
      .select(
        "class:classes(name), subject:subjects(name), slot:time_slots(weekday,starts_at,ends_at)"
      )
      .eq("teacher_id", teacher_id)
      .eq("time_slot_id", time_slot_id)
      .neq("class_id", class_id)
      .limit(1);

    const c = (tConflict as any)?.[0];
    if (c) {
      const w = WEEKDAY_LABEL?.[c.slot?.weekday ?? 0] ?? "Dia";
      const range = c.slot?.starts_at ? `${c.slot.starts_at}–${c.slot.ends_at}` : "";
      const cls = c.class?.name ? `na turma ${c.class.name}` : "em outra turma";
      const subj = c.subject?.name ? ` (${c.subject.name})` : "";
      return {
        kind: "teacher",
        message: `Conflito: este professor já está ${cls} em ${w} ${range}${subj}.`,
      };
    }
  }

  // Room conflict: same room in another class at the same time slot.
  if (room_id) {
    const { data: rConflict } = await supabase
      .from("schedules")
      .select(
        "class:classes(name), subject:subjects(name), room:rooms(name), slot:time_slots(weekday,starts_at,ends_at)"
      )
      .eq("room_id", room_id)
      .eq("time_slot_id", time_slot_id)
      .neq("class_id", class_id)
      .limit(1);

    const c = (rConflict as any)?.[0];
    if (c) {
      const w = WEEKDAY_LABEL?.[c.slot?.weekday ?? 0] ?? "Dia";
      const range = c.slot?.starts_at ? `${c.slot.starts_at}–${c.slot.ends_at}` : "";
      const cls = c.class?.name ? `na turma ${c.class.name}` : "em outra turma";
      const subj = c.subject?.name ? ` (${c.subject.name})` : "";
      const roomName = c.room?.name ? `Sala ${c.room.name}` : "Esta sala";
      return {
        kind: "room",
        message: `Conflito: ${roomName} já está ocupada ${cls} em ${w} ${range}${subj}.`,
      };
    }
  }

  return null;
}
