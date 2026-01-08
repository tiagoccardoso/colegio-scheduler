import { NextResponse } from "next/server";
import { getState, jsonError, normalizeShift, requireDirectorApi } from "../_utils";

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
  const eventId = String(body.eventId || "");
  if (!eventId) return jsonError("Parâmetros inválidos.");

  const { data: ev, error } = await supabase
    .from("schedule_audit_events")
    .select("id,school_id,before,after,undone_at")
    .eq("id", eventId)
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (error || !ev) return jsonError("Evento não encontrado.");
  if (ev.undone_at) return jsonError("Este evento já foi desfeito.");

  const before = ev.before as any;
  const after = ev.after as any;

  // Undo means: apply 'before'
  if (!before) {
    // It was an insert -> delete the inserted schedule
    const id = String(after?.id || "");
    if (id) {
      const { error: delErr } = await supabase.from("schedules").delete().eq("id", id).eq("school_id", profile.school_id);
      if (delErr) return jsonError(delErr.message || "Falha ao desfazer.");
    }
  } else {
    const { error: upErr } = await supabase
      .from("schedules")
      .upsert({ ...before, school_id: profile.school_id }, { onConflict: "id" });
    if (upErr) return jsonError(upErr.message || "Falha ao desfazer.");
  }

  await supabase
    .from("schedule_audit_events")
    .update({ undone_at: new Date().toISOString(), redone_at: null })
    .eq("id", eventId)
    .eq("school_id", profile.school_id);

  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
