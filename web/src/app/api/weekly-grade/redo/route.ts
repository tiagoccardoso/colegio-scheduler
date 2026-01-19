import { NextResponse } from "next/server";
import { applyTeachingRulesForTransition } from "../_teachingRulesSync";
import { getState, jsonError, normalizeShift, requireDirectorApi } from "../_utils";

async function applyScheduleSnapshot(args: {
  supabase: any;
  schoolId: string;
  snapshot: any | null;
  deleteIdFallback?: string | null;
}) {
  const { supabase, schoolId, snapshot, deleteIdFallback } = args;

  if (!snapshot) {
    const id = deleteIdFallback ? String(deleteIdFallback) : "";
    if (!id) return { error: null };
    return await supabase.from("schedules").delete().eq("id", id).eq("school_id", schoolId);
  }

  return await supabase
    .from("schedules")
    .upsert({ ...snapshot, school_id: schoolId }, { onConflict: "id" });
}

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
    .select("id,school_id,action,before,after,undone_at")
    .eq("id", eventId)
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (error || !ev) return jsonError("Evento não encontrado.");
  if (!ev.undone_at) return jsonError("Este evento não está desfeito.");

  // Ações em lote (ex: reset / exclusão em massa) não suportam Undo/Redo por segurança
  const action = String((ev as any).action || "").trim().toLowerCase();
  const before = (ev.before as any) ?? null;
  const after = (ev.after as any) ?? null;
  if (action === "reset" || Array.isArray(before) || Array.isArray(after)) {
    return jsonError("Este evento não suporta Redo.");
  }

  // Redo: transiciona do estado "before" -> "after"
  const fromSnap = before;
  const toSnap = after;

  const applyRes = await applyScheduleSnapshot({
    supabase,
    schoolId: profile.school_id,
    snapshot: toSnap,
    deleteIdFallback: fromSnap?.id ?? null,
  });

  if (applyRes?.error) return jsonError(applyRes.error.message || "Falha ao refazer.");

  try {
    await applyTeachingRulesForTransition({
      supabase,
      schoolId: profile.school_id,
      from: fromSnap,
      to: toSnap,
    });
  } catch (err: any) {
    // rollback: volta para o estado "before"
    await applyScheduleSnapshot({
      supabase,
      schoolId: profile.school_id,
      snapshot: fromSnap,
      deleteIdFallback: toSnap?.id ?? null,
    });

    return jsonError(err?.message || "Falha ao atualizar cadastro do professor.");
  }

  await supabase
    .from("schedule_audit_events")
    .update({ undone_at: null, redone_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("school_id", profile.school_id);

  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
