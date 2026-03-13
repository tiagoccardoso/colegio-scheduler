import { NextResponse } from "next/server";
import { jsonError, normalizeShift, requireStaffApi, teacherMatchesMatrixCell } from "../_helpers";

type MatrixCellLike = {
  id: string;
  class_id: string;
  time_slot_id: string;
  subject_id: string;
  teacher_id?: string | null;
  notes?: string | null;
};

function mergeTeacherSubjectIds(teacher: any, subjectId: string) {
  return Array.from(
    new Set(
      [String(teacher?.subject_id ?? "").trim(), ...((teacher?.subject_ids ?? []) as any[]).map(String), subjectId].filter(Boolean),
    ),
  );
}

async function syncTeacherSubjects(args: { supabase: any; schoolId: string; teacherId: string; teacherRecord: any; subjectId: string }) {
  const { supabase, schoolId, teacherId, teacherRecord, subjectId } = args;
  const mergedSubjectIds = mergeTeacherSubjectIds(teacherRecord, subjectId);

  const updateTeacherRes = await supabase
    .from("teachers")
    .update({
      subject_ids: mergedSubjectIds,
      subject_id: teacherRecord.subject_id ? teacherRecord.subject_id : mergedSubjectIds.length === 1 ? mergedSubjectIds[0] : null,
    })
    .eq("id", teacherId)
    .eq("school_id", schoolId);

  if (updateTeacherRes.error) {
    throw new Error(updateTeacherRes.error.message || "Não foi possível atualizar as disciplinas do professor.");
  }
}

export async function POST(req: Request) {
  const ctx = await requireStaffApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const schoolId = String(ctx.profile.school_id);
    const shift = normalizeShift(body?.shift ?? "MANHA");
    const cellId = String(body?.cellId ?? "").trim();
    const classId = String(body?.classId ?? "").trim();
    const timeSlotId = String(body?.timeSlotId ?? "").trim();
    const subjectId = String(body?.subjectId ?? "").trim();
    const teacherId = String(body?.teacherId ?? "").trim();
    const notes = String(body?.notes ?? "").trim() || null;
    const applyTeacherToSameSubject = Boolean(body?.applyTeacherToSameSubject);

    if (!classId || !timeSlotId) return jsonError("Turma e horário são obrigatórios.");

    const [classRes, slotRes] = await Promise.all([
      ctx.supabase.from("classes").select("id,shift").eq("id", classId).eq("school_id", schoolId).maybeSingle(),
      ctx.supabase
        .from("time_slots")
        .select("id,shift,weekday,period_index")
        .eq("id", timeSlotId)
        .eq("school_id", schoolId)
        .maybeSingle(),
    ]);

    if (!classRes.data) return jsonError("Turma não encontrada.");
    if (!slotRes.data) return jsonError("Horário não encontrado.");

    const classShift = normalizeShift((classRes.data as any)?.shift ?? "");
    const slotShift = normalizeShift((slotRes.data as any)?.shift ?? "");
    if (classShift !== shift || slotShift !== shift) {
      return jsonError("A turma e o horário devem pertencer ao turno atual.");
    }

    const existingRes = await ctx.supabase
      .from("curriculum_matrix_slots")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("time_slot_id", timeSlotId)
      .maybeSingle();

    const existingId = String(existingRes.data?.id ?? cellId ?? "").trim();

    if (!subjectId) {
      if (existingId) {
        const delRes = await ctx.supabase
          .from("curriculum_matrix_slots")
          .delete()
          .eq("id", existingId)
          .eq("school_id", schoolId);
        if (delRes.error) return jsonError(delRes.error.message || "Não foi possível limpar a célula.");
      }
      return NextResponse.json({ ok: true, cleared: true });
    }

    const subjectRes = await ctx.supabase
      .from("subjects")
      .select("id,name")
      .eq("id", subjectId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!subjectRes.data) return jsonError("Disciplina não encontrada.");

    let teacherPayloadId: string | null = null;
    let teacherRecord: any = null;
    if (teacherId) {
      const teacherRes = await ctx.supabase
        .from("teachers")
        .select("id,name,subject_id,subject_ids,shifts,class_ids,availability")
        .eq("id", teacherId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!teacherRes.data) return jsonError("Professor não encontrado.");

      const teacher = teacherRes.data as any;
      teacherRecord = teacher;
      const slot = slotRes.data as any;
      if (
        !teacherMatchesMatrixCell({
          teacher,
          classId,
          shift,
          slot: {
            weekday: Number(slot?.weekday ?? 0),
            period_index: Number(slot?.period_index ?? 0),
          },
        })
      ) {
        return jsonError(
          `O professor ${String(teacher?.name ?? "selecionado")} não atende esta combinação de turma e horário.`,
        );
      }

      const teacherBusyMatrix = await ctx.supabase
        .from("curriculum_matrix_slots")
        .select("id,class_id")
        .eq("school_id", schoolId)
        .eq("time_slot_id", timeSlotId)
        .eq("teacher_id", teacherId)
        .neq("class_id", classId)
        .limit(1)
        .maybeSingle();
      if (teacherBusyMatrix.data?.id) {
        return jsonError("Este professor já está vinculado a outra turma neste mesmo horário da matriz.");
      }

      teacherPayloadId = teacherId;
    }

    let savedCell: MatrixCellLike | null = null;
    if (existingId) {
      const updateRes = await ctx.supabase
        .from("curriculum_matrix_slots")
        .update({ subject_id: subjectId, teacher_id: teacherPayloadId, notes })
        .eq("id", existingId)
        .eq("school_id", schoolId)
        .select("id,class_id,time_slot_id,subject_id,teacher_id,notes")
        .maybeSingle();
      if (updateRes.error) return jsonError(updateRes.error.message || "Não foi possível salvar a célula.");
      savedCell = updateRes.data as MatrixCellLike;
    } else {
      const insertRes = await ctx.supabase
        .from("curriculum_matrix_slots")
        .insert({
          school_id: schoolId,
          class_id: classId,
          time_slot_id: timeSlotId,
          subject_id: subjectId,
          teacher_id: teacherPayloadId,
          notes,
        })
        .select("id,class_id,time_slot_id,subject_id,teacher_id,notes")
        .maybeSingle();

      if (insertRes.error) return jsonError(insertRes.error.message || "Não foi possível salvar a célula.");
      savedCell = insertRes.data as MatrixCellLike;
    }

    if (teacherPayloadId && teacherRecord) {
      await syncTeacherSubjects({
        supabase: ctx.supabase,
        schoolId,
        teacherId: teacherPayloadId,
        teacherRecord,
        subjectId,
      });
    }

    let replicatedCount = 0;
    const warnings: string[] = [];

    if (teacherPayloadId && teacherRecord && applyTeacherToSameSubject) {
      const shiftSlotsRes = await ctx.supabase
        .from("time_slots")
        .select("id,weekday,period_index")
        .eq("school_id", schoolId)
        .eq("shift", shift)
        .in("weekday", [1, 2, 3, 4, 5]);
      if (shiftSlotsRes.error) return jsonError(shiftSlotsRes.error.message || "Não foi possível carregar os horários do turno.");

      const shiftSlotById = new Map(((shiftSlotsRes.data as any[]) ?? []).map((slot: any) => [String(slot.id), slot]));
      const sameSubjectRes = await ctx.supabase
        .from("curriculum_matrix_slots")
        .select("id,class_id,time_slot_id,subject_id,teacher_id,notes")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("subject_id", subjectId)
        .neq("id", savedCell?.id ?? "");

      if (sameSubjectRes.error) {
        return jsonError(sameSubjectRes.error.message || "Não foi possível localizar as demais aulas da mesma disciplina.");
      }

      for (const cell of (sameSubjectRes.data as MatrixCellLike[] | null) ?? []) {
        const slot = shiftSlotById.get(String(cell.time_slot_id));
        if (!slot) continue;

        if (
          !teacherMatchesMatrixCell({
            teacher: teacherRecord,
            classId,
            shift,
            slot: {
              weekday: Number((slot as any)?.weekday ?? 0),
              period_index: Number((slot as any)?.period_index ?? 0),
            },
          })
        ) {
          warnings.push(`Professor indisponível em um dos demais horários da disciplina.`);
          continue;
        }

        const teacherBusyMatrix = await ctx.supabase
          .from("curriculum_matrix_slots")
          .select("id,class_id")
          .eq("school_id", schoolId)
          .eq("time_slot_id", String(cell.time_slot_id))
          .eq("teacher_id", teacherPayloadId)
          .neq("class_id", classId)
          .limit(1)
          .maybeSingle();
        if (teacherBusyMatrix.data?.id) {
          warnings.push(`Professor já vinculado a outra turma em um dos demais horários da disciplina.`);
          continue;
        }

        if (String(cell.teacher_id ?? "") === teacherPayloadId) continue;

        const replicateRes = await ctx.supabase
          .from("curriculum_matrix_slots")
          .update({ teacher_id: teacherPayloadId })
          .eq("id", String(cell.id))
          .eq("school_id", schoolId);
        if (replicateRes.error) {
          warnings.push(replicateRes.error.message || "Não foi possível replicar o professor para todas as aulas da disciplina.");
          continue;
        }
        replicatedCount += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      cell: savedCell,
      replicatedCount,
      warnings: Array.from(new Set(warnings)).slice(0, 5),
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Erro inesperado.", 500);
  }
}
