import { NextResponse } from "next/server";
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
      ...normalized,
      updated_by: user.id,
    };

    const { error } = await supabase
      .from("schedule_solver_settings")
      .upsert(payload, { onConflict: "school_id" });

    if (error) {
      return NextResponse.json({ error: error.message || "Falha ao salvar parâmetros." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, settings: normalized });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
