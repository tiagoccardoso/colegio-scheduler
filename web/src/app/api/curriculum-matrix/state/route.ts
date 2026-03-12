import { NextResponse } from "next/server";
import { jsonError, loadMatrixState, normalizeShift, requireStaffApi } from "../_helpers";

export async function GET(req: Request) {
  const ctx = await requireStaffApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  try {
    const url = new URL(req.url);
    const shift = normalizeShift(url.searchParams.get("shift") || "MANHA");
    const state = await loadMatrixState({
      supabase: ctx.supabase,
      schoolId: String(ctx.profile.school_id),
      shift,
    });

    if ((state as any)?.missingTable) {
      return NextResponse.json(
        {
          error:
            'A tabela da matriz curricular por slot ainda não existe. Rode o arquivo db/patch_curriculum_matrix_builder.sql no Supabase.',
        },
        { status: 400 },
      );
    }

    return NextResponse.json(state);
  } catch (e: any) {
    return jsonError(e?.message ?? "Erro inesperado.", 500);
  }
}
