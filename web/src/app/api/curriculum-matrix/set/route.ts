import { NextResponse } from "next/server";
import { jsonError, normalizeShift, requireStaffApi, teacherMatchesMatrixCell } from "../_helpers";

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
    if (teacherId) {
      const teacherRes = await ctx.supabase
        .from("teachers")
        .select("id,name,shifts,subject_id,subject_ids,class_ids,availability")
        .eq("id", teacherId)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (!teacherRes.data) return jsonError("Professor não encontrado.");

      const teacher = teacherRes.data as any;
      const slot = slotRes.data as any;
      if (
        !teacherMatchesMatrixCell({
          teacher,
          classId,
          subjectId,
          shift,
          slot: {
            weekday: Number(slot?.weekday ?? 0),
            period_index: Number(slot?.period_index ?? 0),
          },
        })
      ) {
        return jsonError(
          `O professor ${String(teacher?.name ?? "selecionado")} não atende esta combinação de turma, disciplina e horário.`,
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

    if (existingId) {
      const updateRes = await ctx.supabase
        .from("curriculum_matrix_slots")
        .update({ subject_id: subjectId, teacher_id: teacherPayloadId, notes })
        .eq("id", existingId)
        .eq("school_id", schoolId)
        .select("id,class_id,time_slot_id,subject_id,teacher_id,notes")
        .maybeSingle();
      if (updateRes.error) return jsonError(updateRes.error.message || "Não foi possível salvar a célula.");
      return NextResponse.json({ ok: true, cell: updateRes.data });
    }

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
    return NextResponse.json({ ok: true, cell: insertRes.data });
  } catch (e: any) {
    return jsonError(e?.message ?? "Erro inesperado.", 500);
  }
}
