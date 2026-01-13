import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const SHIFT_KEYS = ["MANHA", "TARDE", "NOITE"] as const;
export type ShiftKey = (typeof SHIFT_KEYS)[number];

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireDirectorApi() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, school_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || (profile as any).role !== "director") return null;
  return { supabase, user, profile: profile as any };
}

export async function getState(args: { supabase: any; schoolId: string; shift: string }) {
  const { supabase, schoolId, shift } = args;

  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("id")
    .eq("school_id", schoolId)
    .eq("shift", shift)
    .in("weekday", [1, 2, 3, 4, 5]);

  const timeSlotIds = ((timeSlots as any[] | null) ?? []).map((t) => t.id);

  let schedules: any[] = [];
  if (timeSlotIds.length) {
    const { data: sched } = await supabase
      .from("schedules")
      .select(
        "id,time_slot_id,teacher_id,activity_type,class_id,subject_id,room_id,notes,time_slot:time_slots(weekday,period_index,shift),class:classes(name,shift),subject:subjects(name),room:rooms(name)",
      )
      .eq("school_id", schoolId)
      .in("time_slot_id", timeSlotIds);
    schedules = (sched as any[] | null) ?? [];
  }

  const { data: events } = await supabase
    .from("schedule_audit_events")
    .select("id,action,created_at,undone_at,redone_at")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(20);

  return { schedules, events: (events as any[] | null) ?? [] };
}

export function normalizeShift(v: string | null | undefined): ShiftKey | null {
  const s = String(v || "").trim().toUpperCase();
  return (SHIFT_KEYS as readonly string[]).includes(s) ? (s as ShiftKey) : null;
}

export function validateTeacherForSlot(args: {
  teacher: any;
  cls: any;
  slot: any;
  subject_id: string;
  room_id: string | null;
}) {
  const { teacher, cls, slot, subject_id, room_id } = args;

  const classShift = String(cls?.shift ?? "");
  const slotShift = String(slot?.shift ?? "");
  if (classShift && slotShift && classShift !== slotShift) {
    return "O horário selecionado não pertence ao turno da turma.";
  }

  const targetShift = slotShift || classShift;
  const teacherShifts = (((teacher?.shifts ?? []) as string[]) || []).map(String).filter(Boolean);
  if (teacherShifts.length && targetShift && !teacherShifts.includes(targetShift)) {
    return "Professor não atende este turno.";
  }

  // Availability: detailed > legacy
  const availability = teacher?.availability as any;
  const weekday = Number(slot?.weekday);
  const periodIndex = Number(slot?.period_index);

  if (availability && typeof availability === "object" && targetShift && Number.isFinite(weekday) && Number.isFinite(periodIndex)) {
    const allowed = availability?.[String(targetShift)]?.[String(weekday)];
    if (!Array.isArray(allowed) || allowed.length === 0 || !allowed.includes(periodIndex)) {
      return "Professor indisponível neste dia/período.";
    }
  } else {
    const days = ((teacher?.available_weekdays ?? []) as number[]).filter((n) => Number.isFinite(n));
    if (days.length && !days.includes(weekday)) return "Professor indisponível neste dia da semana.";
  }

  const allowedClasses = (((teacher?.class_ids ?? []) as string[]) || []).map(String).filter(Boolean);
  if (allowedClasses.length && !allowedClasses.includes(String(cls?.id))) {
    return "Professor não está habilitado para esta turma.";
  }

  const primarySubject = String(teacher?.subject_id ?? "");
  const legacySubjects = (((teacher?.subject_ids ?? []) as string[]) || []).map(String).filter(Boolean);
  if (primarySubject && subject_id && primarySubject !== subject_id) {
    return "Disciplina não compatível com este professor.";
  }
  if (!primarySubject && legacySubjects.length && subject_id && !legacySubjects.includes(subject_id)) {
    return "Professor não está habilitado para esta disciplina.";
  }

  const allowedRooms = (((teacher?.room_ids ?? []) as string[]) || []).map(String).filter(Boolean);
  if (room_id && allowedRooms.length && !allowedRooms.includes(room_id)) {
    return "Professor não está habilitado para esta sala.";
  }

  return null;
}

// Regras mínimas para Hora Atividade (HA):
// - professor atende o turno do slot
// - professor disponível no dia/período
export function validateTeacherForHaSlot(args: { teacher: any; slot: any }) {
  const { teacher, slot } = args;

  const slotShift = String(slot?.shift ?? "");
  const teacherShifts = (((teacher?.shifts ?? []) as string[]) || []).map(String).filter(Boolean);
  if (teacherShifts.length && slotShift && !teacherShifts.includes(slotShift)) {
    return "Professor não atende este turno.";
  }

  const availability = teacher?.availability as any;
  const weekday = Number(slot?.weekday);
  const periodIndex = Number(slot?.period_index);

  if (availability && typeof availability === "object" && slotShift && Number.isFinite(weekday) && Number.isFinite(periodIndex)) {
    const allowed = availability?.[String(slotShift)]?.[String(weekday)];
    if (!Array.isArray(allowed) || allowed.length === 0 || !allowed.includes(periodIndex)) {
      return "Professor indisponível neste dia/período.";
    }
  } else {
    const days = ((teacher?.available_weekdays ?? []) as number[]).filter((n) => Number.isFinite(n));
    if (days.length && !days.includes(weekday)) return "Professor indisponível neste dia da semana.";
  }

  return null;
}

export function scheduleSnapshot(s: any) {
  if (!s) return null;
  return {
    id: s.id,
    school_id: s.school_id,
    activity_type: s.activity_type ?? "AULA",
    class_id: s.class_id ?? null,
    time_slot_id: s.time_slot_id,
    subject_id: s.subject_id ?? null,
    teacher_id: s.teacher_id,
    room_id: s.room_id ?? null,
    notes: s.notes ?? null,
  };
}
