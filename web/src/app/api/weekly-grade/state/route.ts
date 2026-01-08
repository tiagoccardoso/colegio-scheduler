import { NextResponse } from "next/server";
import { getState, jsonError, normalizeShift, requireDirectorApi } from "../_utils";

export async function GET(req: Request) {
  const ctx = await requireDirectorApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  const { profile, supabase } = ctx;
  const url = new URL(req.url);
  const shift = normalizeShift(url.searchParams.get("shift")) ?? "MANHA";

  const state = await getState({ supabase, schoolId: profile.school_id, shift });
  return NextResponse.json(state);
}
