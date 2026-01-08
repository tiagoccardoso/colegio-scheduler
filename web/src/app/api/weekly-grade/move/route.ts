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
  const scheduleId = String(body.scheduleId || "");
  const targetTimeSlotId = String(body.targetTimeSlotId || "");
  const targetTeacherId = String(body.targetTeacherId || "");

  if (!scheduleId || !targetTimeSlotId || !targetTeacherId) return jsonError("Parâmetros inválidos.");

  const { data: current } = await supabase
    .from("schedules")
    .select("id,school_id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
    .eq("id", scheduleId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!current) return jsonError("Aula não encontrada.");

  const { data: slot } = await supabase
    .from("time_slots")
    .select("id,weekday,period_index,shift")
    .eq("id", targetTimeSlotId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!slot) return jsonError("Horário de destino não encontrado.");
  if (String(slot.shift || "").toUpperCase() !== shift) {
    return jsonError("Turno do slot diferente do filtro atual.");
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id,shift")
    .eq("id", current.class_id)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!cls) return jsonError("Turma não encontrada.");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id,shifts,availability,class_ids,subject_id,subject_ids,room_ids,available_weekdays")
    .eq("id", targetTeacherId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!teacher) return jsonError("Professor não encontrado.");

  const occupied = await supabase
    .from("schedules")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("teacher_id", targetTeacherId)
    .eq("time_slot_id", targetTimeSlotId)
    .neq("id", scheduleId)
    .maybeSingle();
  if (occupied?.data) return jsonError("Destino já ocupado.");

  const ruleError = validateTeacherForSlot({ teacher, cls, slot, subject_id: current.subject_id, room_id: current.room_id ?? null });
  if (ruleError) return jsonError(ruleError);

  const conflict = await validateNoConflicts({
    supabase,
    class_id: current.class_id,
    time_slot_id: targetTimeSlotId,
    teacher_id: targetTeacherId,
    room_id: current.room_id ?? null,
    schedule_id: scheduleId,
  });
  if (conflict) return jsonError(conflict.message);

  const before = scheduleSnapshot(current);

  const { data: afterRow, error } = await supabase
    .from("schedules")
    .update({ teacher_id: targetTeacherId, time_slot_id: targetTimeSlotId })
    .eq("id", scheduleId)
    .eq("school_id", profile.school_id)
    .select("id,school_id,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
    .maybeSingle();

  if (error) return jsonError(error.message || "Falha ao mover.");

  const after = scheduleSnapshot(afterRow);
  await supabase.from("schedule_audit_events").insert({
    school_id: profile.school_id,
    user_id: user.id,
    action: "move",
    before,
    after,
  });

  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
