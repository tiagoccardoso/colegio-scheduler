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
  const scheduleId = body.scheduleId ? String(body.scheduleId) : null;
  const teacherId = String(body.teacherId || "");
  const timeSlotId = String(body.timeSlotId || "");
  const rawActivityType = String(body.activityType ?? body.activity_type ?? "AULA");
  const activityType = rawActivityType.trim().toUpperCase() === "HA" ? "HA" : "AULA";

  const classId = String(body.classId || "");
  const subjectId = String(body.subjectId || "");
  const roomId = body.roomId ? String(body.roomId) : null;
  const notes = body.notes ? String(body.notes) : null;
  const isTeacherAbsent = Boolean(body.isTeacherAbsent);
  const replacementTeacherId = isTeacherAbsent && body.replacementTeacherId ? String(body.replacementTeacherId) : null;

  if (!teacherId || !timeSlotId) return jsonError("Campos obrigatórios: professor e horário.");
  if (activityType === "AULA" && (!classId || !subjectId)) {
    return jsonError("Campos obrigatórios para Aula: turma e disciplina.");
  }
  if (replacementTeacherId && replacementTeacherId === teacherId) {
    return jsonError("O professor substituto deve ser diferente do professor titular.");
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

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id,default_room_id")
    .eq("id", teacherId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!teacher) return jsonError("Professor não encontrado.");

  let resolvedRoomId: string | null = null;

  if (activityType === "AULA") {
    const { data: cls } = await supabase
      .from("classes")
      .select("id,shift,default_room_id")
      .eq("id", classId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (!cls) return jsonError("Turma não encontrada.");

    const classShift = String((cls as any)?.shift ?? "");
    const slotShift = String((slot as any)?.shift ?? "");
    if (classShift && slotShift && classShift !== slotShift) {
      return jsonError("O horário selecionado não pertence ao turno da turma.");
    }

    resolvedRoomId = effectiveRoomId({
      scheduleRoomId: roomId,
      classDefaultRoomId: (cls as any).default_room_id ? String((cls as any).default_room_id) : null,
      teacherDefaultRoomId: (teacher as any).default_room_id ? String((teacher as any).default_room_id) : null,
    });

    if (!resolvedRoomId) {
      return jsonError(
        "Defina a sala (ou configure sala padrão na turma ou no professor) para salvar a aula.",
      );
    }
  }

  let current: any = null;
  if (scheduleId) {
    const { data } = await supabase
      .from("schedules")
      .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
      .eq("id", scheduleId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    current = data;
  }

  if (!current) {
    const { data: byCell } = await supabase
      .from("schedules")
      .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
      .eq("school_id", profile.school_id)
      .eq("teacher_id", teacherId)
      .eq("time_slot_id", timeSlotId)
      .maybeSingle();
    current = byCell;

    if (!current && activityType === "AULA") {
      const { data: byClassSlot } = await supabase
        .from("schedules")
        .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
        .eq("school_id", profile.school_id)
        .eq("class_id", classId)
        .eq("time_slot_id", timeSlotId)
        .maybeSingle();
      current = byClassSlot;
    }
  }

  const conflict = await validateNoConflicts({
    supabase,
    class_id: activityType === "AULA" ? classId : "",
    time_slot_id: timeSlotId,
    teacher_id: teacherId,
    room_id: activityType === "AULA" ? resolvedRoomId : null,
    schedule_id: current?.id ?? null,
  });
  if (conflict) return jsonError(conflict.message);

  if (replacementTeacherId) {
    const { data: replacementTeacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("id", replacementTeacherId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (!replacementTeacher) return jsonError("Professor substituto não encontrado.");

    const excludeId = current?.id ?? "00000000-0000-0000-0000-000000000000";

    const { data: replacementAsTeacher } = await supabase
      .from("schedules")
      .select("id")
      .eq("school_id", profile.school_id)
      .eq("teacher_id", replacementTeacherId)
      .eq("time_slot_id", timeSlotId)
      .neq("id", excludeId)
      .limit(1)
      .maybeSingle();
    if (replacementAsTeacher) {
      return jsonError("Conflito: este professor substituto já possui outro compromisso neste horário.");
    }

    const { data: replacementAsReplacement } = await supabase
      .from("schedules")
      .select("id")
      .eq("school_id", profile.school_id)
      .eq("replacement_teacher_id", replacementTeacherId)
      .eq("is_teacher_absent", true)
      .eq("time_slot_id", timeSlotId)
      .neq("id", excludeId)
      .limit(1)
      .maybeSingle();
    if (replacementAsReplacement) {
      return jsonError("Conflito: este professor substituto já está cobrindo outra aula neste horário.");
    }
  }

  const before = scheduleSnapshot(current);

  let writeError: any = null;
  let afterRow: any = null;

  const schedulePayload: any = {
    activity_type: activityType,
    teacher_id: teacherId,
    time_slot_id: timeSlotId,
    class_id: activityType === "AULA" ? classId : null,
    subject_id: activityType === "AULA" ? subjectId : null,
    room_id: activityType === "AULA" ? resolvedRoomId : null,
    notes,
    is_teacher_absent: isTeacherAbsent,
    replacement_teacher_id: replacementTeacherId,
  };

  if (current?.id) {
    const { data, error } = await supabase
      .from("schedules")
      .update(schedulePayload)
      .eq("id", current.id)
      .eq("school_id", profile.school_id)
      .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
      .maybeSingle();
    writeError = error;
    afterRow = data;
  } else {
    const { data, error } = await supabase
      .from("schedules")
      .insert({ school_id: profile.school_id, ...schedulePayload })
      .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
      .maybeSingle();
    writeError = error;
    afterRow = data;
  }

  if (writeError) return jsonError(writeError.message || "Falha ao salvar.");

  const after = scheduleSnapshot(afterRow);

  try {
    await applyTeachingRulesForTransition({
      supabase,
      schoolId: profile.school_id,
      from: before,
      to: after,
    });
  } catch (err: any) {
    if (before?.id) {
      await supabase
        .from("schedules")
        .upsert({ ...before, school_id: profile.school_id }, { onConflict: "id" });
    } else if (after?.id) {
      await supabase.from("schedules").delete().eq("id", after.id).eq("school_id", profile.school_id);
    }

    return jsonError(err?.message || "Falha ao atualizar cadastro do professor.");
  }

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
