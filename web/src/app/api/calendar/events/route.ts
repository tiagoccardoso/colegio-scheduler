import { NextResponse } from "next/server";
import { requireDirector } from "@/lib/require-director";

import crypto from "crypto";

function isIsoDatetime(s: string | null) {
  const t = String(s || "").trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function asISODate(s: string | null) {
  const t = String(s || "").trim();
  if (!t) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  return t;
}

export async function GET(req: Request) {
  const { supabase, profile } = await requireDirector();
  const { searchParams } = new URL(req.url);

  const start = asISODate(searchParams.get("start"));
  const end = asISODate(searchParams.get("end"));
  const q = String(searchParams.get("q") || "").trim();
  const category = String(searchParams.get("category") || "").trim();
  const source = String(searchParams.get("source") || "").trim();

  let query = supabase
    .from("calendar_events")
    .select("id,title,start_at,end_at,category,source_url,source_name,source_id")
    .eq("school_id", profile.school_id)
    .order("start_at", { ascending: true })
    .limit(4000);

  // Show events that INTERSECT the requested range.
  // Condition: start_at <= range_end AND (end_at is null OR end_at >= range_start)
  if (end) query = query.lte("start_at", `${end}T23:59:59.999Z`);
  if (start) {
    // Supabase `or` syntax uses comma-separated filters
    query = query.or(`end_at.is.null,end_at.gte.${start}T00:00:00.000Z`);
  }

  if (category) query = query.eq("category", category);
  if (source) query = query.eq("source_id", source);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const events = (data ?? []).map((e: any) => ({
    id: e.id,
    title: e.title,
    start_at: e.start_at,
    end_at: e.end_at,
    category: e.category,
    source_url: e.source_url,
    source_name: e.source_name,
    source_id: e.source_id,
  }));

  return NextResponse.json({ events });
}

export async function POST(req: Request) {
  const { supabase, profile } = await requireDirector();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const title = String(body.title || "").trim();
  const start_at = isIsoDatetime(body.start_at);
  const end_at = isIsoDatetime(body.end_at);

  if (!title) return NextResponse.json({ error: "Título é obrigatório." }, { status: 400 });
  if (!start_at) return NextResponse.json({ error: "Data/hora inicial inválida." }, { status: 400 });

  const category = String(body.category || "Manual").trim() || "Manual";

  const hash = crypto
    .createHash("sha1")
    .update(["manual", profile.school_id, crypto.randomUUID()].join("|"), "utf8")
    .digest("hex");

  const payload = {
    school_id: profile.school_id,
    source_id: null,
    source_name: null,
    source_url: null,
    category,
    title: title.slice(0, 240),
    start_at,
    end_at: end_at && end_at > start_at ? end_at : null,
    hash,
  };

  const { data, error } = await supabase
    .from("calendar_events")
    .insert(payload)
    .select("id,title,start_at,end_at,category,source_url,source_name,source_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ event: data });
}

export async function DELETE(req: Request) {
  const { supabase, profile } = await requireDirector();
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Informe o id do evento." }, { status: 400 });

  const { error } = await supabase.from("calendar_events").delete().eq("school_id", profile.school_id).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
