import { NextResponse } from "next/server";
import { requireDirector } from "@/lib/require-director";

type SourceType = "site" | "pdf";

function cleanUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  // Remove espaços e caracteres invisíveis.
  return u.replace(/\s+/g, "");
}

function inferType(url: string): SourceType {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    return p.endsWith(".pdf") ? "pdf" : "site";
  } catch {
    const u = (url || "").toLowerCase();
    return u.includes(".pdf") ? "pdf" : "site";
  }
}

async function seedDefaultsIfEmpty(supabase: any, schoolId: string) {
  const { data: existing } = await supabase
    .from("calendar_sources")
    .select("id")
    .eq("school_id", schoolId)
    .limit(1);

  if (existing && existing.length) return;

  const defaults = [
    {
      school_id: schoolId,
      name: "SEED-PR — Calendário Escolar (PDF)",
      url: "https://www.educacao.pr.gov.br/sites/default/arquivos_restritos/files/documento/2025-11/calendario_escolar2026.pdf",
      type: "pdf",
      active: true,
    },
    {
      school_id: schoolId,
      name: "NRE — Portal dos Núcleos Regionais",
      url: "https://nre.educacao.pr.gov.br/",
      type: "site",
      active: true,
    },
  ];

  await supabase.from("calendar_sources").insert(defaults);
}

export async function GET() {
  const { supabase, profile } = await requireDirector();
  await seedDefaultsIfEmpty(supabase as any, profile.school_id);

  const { data, error } = await supabase
    .from("calendar_sources")
    .select("id,name,url,type,active")
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ sources: data ?? [] });
}

export async function POST(req: Request) {
  const { supabase, profile } = await requireDirector();
  const body = (await req.json().catch(() => null)) as any;

  const name = String(body?.name || "").trim();
  const url = cleanUrl(body?.url);
  const type = (String(body?.type || "") as SourceType) || inferType(url);
  const active = body?.active === false ? false : true;

  if (!name) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return NextResponse.json({ error: "Informe um link válido (http/https)." }, { status: 400 });
  }
  if (type !== "site" && type !== "pdf") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("calendar_sources")
    .insert({ school_id: profile.school_id, name, url, type, active })
    .select("id,name,url,type,active")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ source: data });
}

export async function PATCH(req: Request) {
  const { supabase, profile } = await requireDirector();
  const body = (await req.json().catch(() => null)) as any;

  const id = String(body?.id || "").trim();
  if (!id) return NextResponse.json({ error: "Informe o id." }, { status: 400 });

  const patch: any = {};
  if (typeof body?.active === "boolean") patch.active = body.active;
  if (typeof body?.name === "string") patch.name = String(body.name).trim();
  if (typeof body?.url === "string") patch.url = cleanUrl(body.url);
  if (typeof body?.type === "string") patch.type = body.type;

  if (patch.url && !patch.url.startsWith("http")) {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }
  if (patch.type && patch.type !== "site" && patch.type !== "pdf") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("calendar_sources")
    .update(patch)
    .eq("school_id", profile.school_id)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { supabase, profile } = await requireDirector();
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Informe o id." }, { status: 400 });

  const { error } = await supabase
    .from("calendar_sources")
    .delete()
    .eq("school_id", profile.school_id)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
