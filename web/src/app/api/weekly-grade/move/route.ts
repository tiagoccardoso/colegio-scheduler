import { NextResponse } from "next/server";
import { validateNoConflicts } from "@/lib/schedule/validate";
import { effectiveRoomId } from "@/lib/schedule/rules";
import { applyTeachingRulesForTransition } from "../_teachingRulesSync";
import { getState, jsonError, normalizeShift, requireDirectorApi, scheduleSnapshot } from "../_utils";

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
    .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
    .eq("id", scheduleId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!current) return jsonError("Item não encontrado.");

  const activityType =
    String((current as any)?.activity_type || "AULA").trim().toUpperCase() === "HA" ? "HA" : "AULA";

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

  let cls: any = null;
  if (activityType === "AULA") {
    const { data } = await supabase
      .from("classes")
      .select("id,shift,default_room_id")
      .eq("id", current.class_id)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    cls = data;
    if (!cls) return jsonError("Turma não encontrada.");

    const classShift = String((cls as any)?.shift ?? "");
    const slotShift = String((slot as any)?.shift ?? "");
    if (classShift && slotShift && classShift !== slotShift) {
      return jsonError("O horário selecionado não pertence ao turno da turma.");
    }
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id,default_room_id")
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

  // Para AULA, resolve a sala efetiva (para validar conflito de sala corretamente)
  let resolvedRoomId: string | null = null;
  if (activityType === "AULA") {
    resolvedRoomId = effectiveRoomId({
      scheduleRoomId: (current as any).room_id ?? null,
      classDefaultRoomId: cls?.default_room_id ? String(cls.default_room_id) : null,
      teacherDefaultRoomId: (teacher as any).default_room_id ? String((teacher as any).default_room_id) : null,
    });

    if (!resolvedRoomId) {
      return jsonError(
        "Defina a sala (ou configure sala padrão na turma ou no professor) para mover/salvar a aula.",
      );
    }
  }

  const conflict = await validateNoConflicts({
    supabase,
    class_id: activityType === "AULA" ? (current as any).class_id : "",
    time_slot_id: targetTimeSlotId,
    teacher_id: targetTeacherId,
    room_id: activityType === "AULA" ? resolvedRoomId : null,
    schedule_id: scheduleId,
  });
  if (conflict) return jsonError(conflict.message);

  const before = scheduleSnapshot(current);

  const { data: afterRow, error } = await supabase
    .from("schedules")
    .update({ teacher_id: targetTeacherId, time_slot_id: targetTimeSlotId })
    .eq("id", scheduleId)
    .eq("school_id", profile.school_id)
    .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
    .maybeSingle();

  if (error) return jsonError(error.message || "Falha ao mover.");

  const after = scheduleSnapshot(afterRow);

  try {
    await applyTeachingRulesForTransition({
      supabase,
      schoolId: profile.school_id,
      from: before,
      to: after,
    });
  } catch (err: any) {
    // rollback best-effort
    if (before?.id) {
      await supabase.from("schedules").upsert({ ...before, school_id: profile.school_id }, { onConflict: "id" });
    }
    return jsonError(err?.message || "Falha ao atualizar cadastro do professor.");
  }

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
