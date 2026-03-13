import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_GRADE_SOLVER_SETTINGS,
  normalizeGradeSolverSettings,
} from "@/lib/schedule/solver-settings";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (String((profile as any)?.role ?? "") !== "director") {
      return NextResponse.json({ error: "Apenas diretor pode acessar." }, { status: 403 });
    }

    const { data } = await supabase
      .from("schedule_solver_settings")
      .select("*")
      .eq("school_id", String((profile as any).school_id))
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      settings: normalizeGradeSolverSettings(data ?? DEFAULT_GRADE_SOLVER_SETTINGS),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (String((profile as any)?.role ?? "") !== "director") {
      return NextResponse.json({ error: "Apenas diretor pode acessar." }, { status: 403 });
    }

    const normalized = normalizeGradeSolverSettings(body ?? {});
    const payload = {
      school_id: String((profile as any).school_id),
      prefer_consecutive_weight: normalized.prefer_consecutive_weight,
      compact_teacher_days_weight: normalized.compact_teacher_days_weight,
      reduce_teacher_gaps_weight: normalized.reduce_teacher_gaps_weight,
      avoid_last_period_penalty: normalized.avoid_last_period_penalty,
      spread_subjects_weight: normalized.spread_subjects_weight,
      respect_requirements: normalized.respect_requirements,
      prioritize_default_room: normalized.prioritize_default_room,
      updated_by: user.id,
    };

    const { data: saved, error } = await supabase
      .from("schedule_solver_settings")
      .upsert(payload, { onConflict: "school_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message || "Falha ao salvar parâmetros." }, { status: 400 });
    }

    try {
      revalidatePath("/director/parametros-grade");
      revalidatePath("/director/matriz-curricular");
    } catch {
      // noop
    }

    return NextResponse.json({ ok: true, settings: normalizeGradeSolverSettings(saved ?? payload) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
