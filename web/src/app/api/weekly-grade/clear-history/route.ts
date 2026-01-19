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
    // body opcional
    body = {};
  }

  const shift = normalizeShift(body.shift) ?? "MANHA";

  const { error } = await supabase
    .from("schedule_audit_events")
    .delete()
    .eq("school_id", profile.school_id);

  if (error) return jsonError(error.message || "Falha ao limpar histórico.");

  // Retorna o state vazio para a UI atualizar sem outra requisição.
  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
