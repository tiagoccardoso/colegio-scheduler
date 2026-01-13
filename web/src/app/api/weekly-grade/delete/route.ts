import { NextResponse } from "next/server";
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
  if (!scheduleId) return jsonError("Parâmetros inválidos.");

  const { data: current } = await supabase
    .from("schedules")
    .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
    .eq("id", scheduleId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  if (!current) return jsonError("Item não encontrado.");

  const before = scheduleSnapshot(current);

  const { error } = await supabase.from("schedules").delete().eq("id", scheduleId).eq("school_id", profile.school_id);
  if (error) return jsonError(error.message || "Falha ao excluir.");

  await supabase.from("schedule_audit_events").insert({
    school_id: profile.school_id,
    user_id: user.id,
    action: "delete",
    before,
    after: null,
  });

  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
