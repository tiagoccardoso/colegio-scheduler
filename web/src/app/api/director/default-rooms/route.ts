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
    const target = String(body?.target ?? "").trim();
    const id = String(body?.id ?? "").trim();
    const default_room_id = String(body?.default_room_id ?? "").trim() || null;

    if (!id || !["class", "teacher"].includes(target)) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    if (default_room_id) {
      const { data: room, error: roomError } = await auth.supabase
        .from("rooms")
        .select("id")
        .eq("id", default_room_id)
        .eq("school_id", auth.schoolId)
        .maybeSingle();

      if (roomError || !room) {
        return NextResponse.json({ error: "Sala inválida para esta escola." }, { status: 400 });
      }
    }

    const table = target === "class" ? "classes" : "teachers";
    const { error } = await auth.supabase
      .from(table)
      .update({ default_room_id })
      .eq("id", id)
      .eq("school_id", auth.schoolId);

    if (error) {
      return NextResponse.json(
        { error: error.message || "Não foi possível atualizar a sala padrão." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
