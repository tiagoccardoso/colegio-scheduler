import { NextResponse } from "next/server";
import { jsonError, loadMatrixState, normalizeShift, requireStaffApi } from "../_helpers";

const WEEKDAY_LABEL: Record<number, string> = { 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex" };

function mapGetSet(map: Map<string, Set<number>>, key: string) {
  let set = map.get(key);
  if (!set) {
    set = new Set<number>();
    map.set(key, set);
  }
  return set;
}

function mapGetDayCount(map: Map<string, Map<number, number>>, key: string) {
  let inner = map.get(key);
  if (!inner) {
    inner = new Map<number, number>();
    map.set(key, inner);
  }
  return inner;
}

function slotLabel(slot: any) {
  const w = WEEKDAY_LABEL[Number(slot?.weekday ?? 0)] ?? "Dia";
  const p = Number(slot?.period_index ?? 0);
  const range = slot?.starts_at ? `${slot.starts_at}–${slot.ends_at}` : p ? `${p}º` : "";
  return `${w} ${range}`.trim();
}

export async function POST(req: Request) {
  const ctx = await requireStaffApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const schoolId = String(ctx.profile.school_id);
    const shift = normalizeShift(body?.shift ?? "MANHA");
    const overwrite = Boolean(body?.overwrite);

    const state: any = await loadMatrixState({ supabase: ctx.supabase, schoolId, shift });
    if (state?.missingTable) {
      return NextResponse.json(
        { error: 'A tabela da matriz curricular por slot ainda não existe. Rode o arquivo db/patch_curriculum_matrix_builder.sql no Supabase.' },
        { status: 400 },
      );
    }

    const timeSlots = (state.timeSlots as any[]) ?? [];
    const classes = (state.classes as any[]) ?? [];
    const requirements = (state.requirements as any[]) ?? [];
    const existingCells = (state.cells as any[]) ?? [];
    const settings = state.settings ?? {};

    const { data: schedulesRaw, error: schedulesError } = await ctx.supabase
      .from("schedules")
      .select("id,class_id,time_slot_id,subject_id,teacher_id,notes,activity_type")
      .eq("school_id", schoolId)
      .in("time_slot_id", timeSlots.map((item: any) => String(item.id)));
    if (schedulesError) {
      return jsonError(schedulesError.message || "Falha ao carregar a grade do turno.");
    }
    const scheduleRows = ((schedulesRaw as any[]) ?? []).filter((item: any) => {
      const activityType = String(item?.activity_type ?? "AULA").trim().toUpperCase();
      if (activityType === "HA") return false;
      return Boolean(item?.class_id) && Boolean(item?.subject_id) && Boolean(item?.time_slot_id);
    });

    if (!timeSlots.length) {
      return jsonError(`Nenhum horário encontrado para o turno ${shift}. Configure em Horários.`);
    }

    if (overwrite && existingCells.length) {
      const timeSlotIds = timeSlots.map((item: any) => String(item.id));
      const delRes = await ctx.supabase
        .from("curriculum_matrix_slots")
        .delete()
        .eq("school_id", schoolId)
        .in("time_slot_id", timeSlotIds);
      if (delRes.error) return jsonError(delRes.error.message || "Falha ao limpar a matriz curricular.");
      state.cells = [];
    }

    const slotById = new Map<string, any>(timeSlots.map((slot: any) => [String(slot.id), slot]));
    const busyClass = new Map<string, Set<string>>();
    const classDayPeriods = new Map<string, Set<number>>();
    const classSubjectDayPeriods = new Map<string, Set<number>>();
    const classSubjectDayCount = new Map<string, Map<number, number>>();
    const classSubjectCount = new Map<string, number>();

    const currentCells = overwrite ? [] : existingCells;
    const occupiedMatrixCell = new Set<string>();
    let importedFromGrade = 0;
    let skippedFromGrade = 0;
    const warnings: string[] = [];

    for (const cell of currentCells) {
      const classId = String(cell.class_id ?? "");
      const subjectId = String(cell.subject_id ?? "");
      const timeSlotId = String(cell.time_slot_id ?? "");
      const slot = slotById.get(timeSlotId);
      if (!classId || !subjectId || !slot) continue;
      occupiedMatrixCell.add(`${timeSlotId}|${classId}`);
      const weekday = Number(slot.weekday ?? 0);
      const period = Number(slot.period_index ?? 0);
      busyClass.get(timeSlotId) ?? busyClass.set(timeSlotId, new Set());
      busyClass.get(timeSlotId)!.add(classId);
      mapGetSet(classDayPeriods, `${classId}|${weekday}`).add(period);
      const subjectKey = `${classId}|${subjectId}`;
      mapGetSet(classSubjectDayPeriods, `${subjectKey}|${weekday}`).add(period);
      const byDay = mapGetDayCount(classSubjectDayCount, subjectKey);
      byDay.set(weekday, (byDay.get(weekday) ?? 0) + 1);
      classSubjectCount.set(subjectKey, (classSubjectCount.get(subjectKey) ?? 0) + 1);
    }

    for (const row of scheduleRows) {
      const classId = String(row?.class_id ?? "").trim();
      const subjectId = String(row?.subject_id ?? "").trim();
      const timeSlotId = String(row?.time_slot_id ?? "").trim();
      const teacherId = row?.teacher_id ? String(row.teacher_id) : null;
      const notes = row?.notes ? String(row.notes) : null;
      const slot = slotById.get(timeSlotId);
      if (!classId || !subjectId || !timeSlotId || !slot) {
        skippedFromGrade += 1;
        continue;
      }

      const matrixKey = `${timeSlotId}|${classId}`;
      if (occupiedMatrixCell.has(matrixKey)) continue;

      const insertRes = await ctx.supabase
        .from("curriculum_matrix_slots")
        .insert({
          school_id: schoolId,
          class_id: classId,
          time_slot_id: timeSlotId,
          subject_id: subjectId,
          teacher_id: teacherId,
          notes,
        });

      if (insertRes.error) {
        skippedFromGrade += 1;
        warnings.push(insertRes.error.message || `Falha ao importar item da grade em ${slotLabel(slot)}.`);
        continue;
      }

      importedFromGrade += 1;
      occupiedMatrixCell.add(matrixKey);
      const weekday = Number(slot.weekday ?? 0);
      const period = Number(slot.period_index ?? 0);
      busyClass.get(timeSlotId) ?? busyClass.set(timeSlotId, new Set());
      busyClass.get(timeSlotId)!.add(classId);
      mapGetSet(classDayPeriods, `${classId}|${weekday}`).add(period);
      const subjectKey = `${classId}|${subjectId}`;
      mapGetSet(classSubjectDayPeriods, `${subjectKey}|${weekday}`).add(period);
      const byDay = mapGetDayCount(classSubjectDayCount, subjectKey);
      byDay.set(weekday, (byDay.get(weekday) ?? 0) + 1);
      classSubjectCount.set(subjectKey, (classSubjectCount.get(subjectKey) ?? 0) + 1);
    }

    const requirementsByClass = new Map<string, Array<{ classId: string; subjectId: string; remaining: number }>>();
    for (const row of requirements) {
      const classId = String(row.class_id ?? "");
      const subjectId = String(row.subject_id ?? "");
      if (!classId || !subjectId) continue;
      const current = classSubjectCount.get(`${classId}|${subjectId}`) ?? 0;
      const remaining = Math.max(0, Number(row.lessons_per_week ?? 0) - current);
      if (remaining <= 0) continue;
      const arr = requirementsByClass.get(classId) ?? [];
      arr.push({ classId, subjectId, remaining });
      requirementsByClass.set(classId, arr);
    }

    let applied = 0;
    let skipped = 0;

    while (true) {
      let best:
        | null
        | {
            classId: string;
            subjectId: string;
            slotId: string;
            score: number;
          } = null;

      for (const cls of classes) {
        const classId = String(cls.id);
        const reqs = requirementsByClass.get(classId) ?? [];
        for (const req of reqs) {
          if (req.remaining <= 0) continue;
          for (const slot of timeSlots) {
            const slotId = String(slot.id);
            if (busyClass.get(slotId)?.has(classId)) continue;

            const weekday = Number(slot.weekday ?? 0);
            const period = Number(slot.period_index ?? 0);
            const subjectKey = `${classId}|${req.subjectId}`;
            const sameDayCount = classSubjectDayCount.get(subjectKey)?.get(weekday) ?? 0;
            const sameSubjectPeriods = classSubjectDayPeriods.get(`${subjectKey}|${weekday}`);
            const classPeriods = classDayPeriods.get(`${classId}|${weekday}`);

            let score = 100 + req.remaining * 20;
            score += sameDayCount === 0 ? Number(settings.spread_subjects_weight ?? 0) : -sameDayCount * Number(settings.spread_subjects_weight ?? 0);

            if (sameSubjectPeriods?.has(period - 1) || sameSubjectPeriods?.has(period + 1)) {
              score += Number(settings.prefer_consecutive_weight ?? 0);
            }

            if (classPeriods && classPeriods.size > 0) {
              score += Number(settings.compact_teacher_days_weight ?? 0);
              if (classPeriods.has(period - 1) || classPeriods.has(period + 1)) {
                score += Number(settings.reduce_teacher_gaps_weight ?? 0) * 2;
              } else {
                score -= Math.max(1, Math.floor(Number(settings.reduce_teacher_gaps_weight ?? 0) / 2));
              }
            }

            if (period > 0) score -= period * 0.2;
            const allPeriodsThisDay = timeSlots
              .filter((item: any) => Number(item.weekday) === weekday)
              .map((item: any) => Number(item.period_index ?? 0));
            const maxPeriod = allPeriodsThisDay.length ? Math.max(...allPeriodsThisDay) : 0;
            if (maxPeriod && period === maxPeriod) score -= Number(settings.avoid_last_period_penalty ?? 0);

            if (!best || score > best.score) {
              best = { classId, subjectId: req.subjectId, slotId, score };
            }
          }
        }
      }

      if (!best) break;

      const slot = slotById.get(best.slotId);
      const insertRes = await ctx.supabase
        .from("curriculum_matrix_slots")
        .insert({
          school_id: schoolId,
          class_id: best.classId,
          time_slot_id: best.slotId,
          subject_id: best.subjectId,
          notes: null,
        });

      if (insertRes.error) {
        skipped += 1;
        warnings.push(insertRes.error.message || `Falha ao inserir item em ${slotLabel(slot)}.`);
        busyClass.get(best.slotId) ?? busyClass.set(best.slotId, new Set());
        busyClass.get(best.slotId)!.add(best.classId);
      } else {
        applied += 1;
        const weekday = Number(slot?.weekday ?? 0);
        const period = Number(slot?.period_index ?? 0);
        busyClass.get(best.slotId) ?? busyClass.set(best.slotId, new Set());
        busyClass.get(best.slotId)!.add(best.classId);
        mapGetSet(classDayPeriods, `${best.classId}|${weekday}`).add(period);
        const subjectKey = `${best.classId}|${best.subjectId}`;
        mapGetSet(classSubjectDayPeriods, `${subjectKey}|${weekday}`).add(period);
        const byDay = mapGetDayCount(classSubjectDayCount, subjectKey);
        byDay.set(weekday, (byDay.get(weekday) ?? 0) + 1);
        classSubjectCount.set(subjectKey, (classSubjectCount.get(subjectKey) ?? 0) + 1);
      }

      const reqs = requirementsByClass.get(best.classId) ?? [];
      const idx = reqs.findIndex((item) => item.subjectId === best.subjectId);
      if (idx >= 0) {
        reqs[idx].remaining -= 1;
      }
    }

    for (const [classId, reqs] of requirementsByClass.entries()) {
      for (const req of reqs) {
        if (req.remaining > 0) {
          const clsName = (classes.find((item: any) => String(item.id) === classId)?.name ?? classId) as string;
          warnings.push(`A turma ${clsName} ainda ficou com ${req.remaining} aula(s) sem distribuir.`);
          skipped += req.remaining;
        }
      }
    }

    if (importedFromGrade > 0 || skippedFromGrade > 0) {
      warnings.push(`Grade → matriz: importadas ${importedFromGrade} aula(s) da grade e ignoradas ${skippedFromGrade}.`);
    }

    return NextResponse.json({
      ok: true,
      shift,
      overwrite,
      applied,
      skipped,
      importedFromGrade,
      skippedFromGrade,
      warnings,
      summary:
        importedFromGrade > 0 && applied > 0
          ? `Matriz sincronizada com a grade e complementada automaticamente no turno ${shift}. Importadas ${importedFromGrade} aula(s) da grade e distribuídas ${applied} aula(s) adicionais.`
          : importedFromGrade > 0
            ? `Matriz montada com base na grade do turno ${shift}. Importadas ${importedFromGrade} aula(s).`
            : applied > 0
              ? `Matriz montada. Distribuídas ${applied} aula(s) automaticamente no turno ${shift}.`
              : `Nada novo para distribuir no turno ${shift}.`,
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Erro inesperado.", 500);
  }
}
