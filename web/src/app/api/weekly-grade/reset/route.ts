import { NextResponse } from "next/server";
import { getState, jsonError, normalizeShift, requireDirectorApi, scheduleSnapshot } from "../_utils";

export async function POST(req: Request) {
  const ctx = await requireDirectorApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  const { supabase, profile } = ctx;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const shift = normalizeShift(body.shift) ?? "MANHA";

  const ok = Boolean(body?.confirm);
  if (!ok) return jsonError("Confirmação obrigatória.");

  // pega todos os slots do turno (Seg–Sex) e remove todos os registros (AULA + HA)
  const { data: timeSlots, error: tsErr } = await supabase
    .from("time_slots")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("shift", shift)
    .in("weekday", [1, 2, 3, 4, 5]);

  if (tsErr) return jsonError(tsErr.message || "Falha ao carregar horários.");

  const timeSlotIds = ((timeSlots as any[] | null) ?? []).map((t) => t.id);
  if (!timeSlotIds.length) {
    const state = await getState({ supabase, schoolId: profile.school_id, shift });
    return NextResponse.json(state);
  }

  // snapshot do que vai ser removido (para exibir no histórico)
  const { data: existing } = await supabase
    .from("schedules")
    .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes,is_teacher_absent,replacement_teacher_id")
    .eq("school_id", profile.school_id)
    .in("time_slot_id", timeSlotIds);

  const before = ((existing as any[] | null) ?? []).map((s) => scheduleSnapshot(s)).filter(Boolean);

  const delRes = await supabase
    .from("schedules")
    .delete()
    .eq("school_id", profile.school_id)
    .in("time_slot_id", timeSlotIds);

  if (delRes?.error) return jsonError(delRes.error.message || "Falha ao zerar grade.");

  await supabase.from("schedule_audit_events").insert({
    school_id: profile.school_id,
    action: "reset",
    before,
    after: [],
  });

  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
