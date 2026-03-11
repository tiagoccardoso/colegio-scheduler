import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireDirectorSchool() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (String((profile as any)?.role ?? "") !== "director") {
    return { error: NextResponse.json({ error: "Apenas diretor pode acessar." }, { status: 403 }) };
  }

  return { supabase, schoolId: String((profile as any).school_id) };
}

export async function POST(req: Request) {
  try {
    const auth = await requireDirectorSchool();
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim() || null;
    const class_id = String(body?.class_id ?? "").trim();
    const subject_id = String(body?.subject_id ?? "").trim();
    const lessons_per_week = Math.max(1, Math.min(40, Number(body?.lessons_per_week ?? 0) || 0));

    if (!class_id || !subject_id || !lessons_per_week) {
      return NextResponse.json({ error: "Informe turma, disciplina e aulas por semana." }, { status: 400 });
    }

    const [{ data: cls }, { data: subject }] = await Promise.all([
      auth.supabase
        .from("classes")
        .select("id")
        .eq("id", class_id)
        .eq("school_id", auth.schoolId)
        .maybeSingle(),
      auth.supabase
        .from("subjects")
        .select("id")
        .eq("id", subject_id)
        .eq("school_id", auth.schoolId)
        .maybeSingle(),
    ]);

    if (!cls || !subject) {
      return NextResponse.json({ error: "Turma ou disciplina inválida para esta escola." }, { status: 400 });
    }

    const payload = {
      school_id: auth.schoolId,
      class_id,
      subject_id,
      lessons_per_week,
    };

    const query = id
      ? auth.supabase
          .from("class_subject_requirements")
          .update(payload)
          .eq("id", id)
          .eq("school_id", auth.schoolId)
          .select("id,class_id,subject_id,lessons_per_week")
          .single()
      : auth.supabase
          .from("class_subject_requirements")
          .insert(payload)
          .select("id,class_id,subject_id,lessons_per_week")
          .single();

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message || "Não foi possível salvar a matriz curricular." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, row: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireDirectorSchool();
    if ("error" in auth) return auth.error;

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const { error } = await auth.supabase
      .from("class_subject_requirements")
      .delete()
      .eq("id", id)
      .eq("school_id", auth.schoolId);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Não foi possível remover o item da matriz curricular." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
