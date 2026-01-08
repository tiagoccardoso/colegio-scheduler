import { NextResponse } from "next/server";
import { validateNoConflicts } from "@/lib/schedule/validate";
import { getState, jsonError, normalizeShift, requireDirectorApi, scheduleSnapshot, validateTeacherForSlot } from "../_utils";

export async function POST(req: Request) {
  const ctx = await requireDirectorApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  const { supabase, profile, user } = ctx;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const shift = normalizeShift(body.shift) ?? "MANHA";
  const scheduleId = body.scheduleId ? String(body.scheduleId) : null;
  const teacherId = String(body.teacherId || "");
  const timeSlotId = String(body.timeSlotId || "");
  const classId = String(body.classId || "");
  const subjectId = String(body.subjectId || "");
  const roomId = body.roomId ? String(body.roomId) : null;
  const notes = body.notes ? String(body.notes) : null;

  if (!teacherId || !timeSlotId || !classId || !subjectId) {
    return jsonError("Campos obrigatórios: professor, horário, turma e disciplina.");
  }

  const { data: slot } = await supabase
    .from("time_slots")
    .select("id,weekday,period_index,shift")
    .eq("id", timeSlotId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!slot) return jsonError("Horário não encontrado.");

  if (String(slot.shift || "").toUpperCase() !== shift) {
    return jsonError("Turno do slot diferente do filtro atual.");
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id,shift")
    .eq("id", classId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!cls) return jsonError("Turma não encontrada.");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id,shifts,availability,class_ids,subject_id,subject_ids,room_ids,available_weekdays")
    .eq("id", teacherId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!teacher) return jsonError("Professor não encontrado.");

  const ruleError = validateTeacherForSlot({ teacher, cls, slot, subject_id: subjectId, room_id: roomId });
  if (ruleError) return jsonError(ruleError);

  // Identify existing schedule row
  let current: any = null;
  if (scheduleId) {
    const { data } = await supabase
      .from("schedules")
      .select("id,school_id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
      .eq("id", scheduleId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    current = data;
  }

  if (!current) {
    const { data } = await supabase
      .from("schedules")
      .select("id,school_id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
      .eq("school_id", profile.school_id)
      .eq("class_id", classId)
      .eq("time_slot_id", timeSlotId)
      .maybeSingle();
    current = data;
  }

  const conflict = await validateNoConflicts({
    supabase,
    class_id: classId,
    time_slot_id: timeSlotId,
    teacher_id: teacherId,
    room_id: roomId,
    schedule_id: current?.id ?? null,
  });

  if (conflict) return jsonError(conflict.message);

  const before = scheduleSnapshot(current);

  let writeError: any = null;
  let afterRow: any = null;

  if (current?.id) {
    const { data, error } = await supabase
      .from("schedules")
      .update({ teacher_id: teacherId, time_slot_id: timeSlotId, class_id: classId, subject_id: subjectId, room_id: roomId, notes })
      .eq("id", current.id)
      .eq("school_id", profile.school_id)
      .select("id,school_id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
      .maybeSingle();
    writeError = error;
    afterRow = data;
  } else {
    const { data, error } = await supabase
      .from("schedules")
      .insert({ school_id: profile.school_id, teacher_id: teacherId, time_slot_id: timeSlotId, class_id: classId, subject_id: subjectId, room_id: roomId, notes })
      .select("id,school_id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
      .maybeSingle();
    writeError = error;
    afterRow = data;
  }

  if (writeError) return jsonError(writeError.message || "Falha ao salvar.");

  const after = scheduleSnapshot(afterRow);
  await supabase.from("schedule_audit_events").insert({
    school_id: profile.school_id,
    user_id: user.id,
    action: "set",
    before,
    after,
  });

  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
