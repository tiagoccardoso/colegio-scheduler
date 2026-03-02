import { NextResponse } from "next/server";
import { requireDirector } from "@/lib/require-director";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const runtime = "nodejs";

const BUCKET = process.env.CALENDAR_PDF_BUCKET || "calendar-pdfs";

function safeName(s: string) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 90);
}

function looksLikeBucketNotFound(message: string) {
  const m = String(message || "").toLowerCase();
  return m.includes("bucket not found") || m.includes("bucket_not_found");
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  // Try to create the bucket if it doesn't exist.
  // If it already exists, Supabase will return an error; we can ignore.
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (!listErr && Array.isArray(buckets) && buckets.some((b) => b.name === BUCKET)) return;

  const { error } = await admin.storage.createBucket(BUCKET, {
    public: true,
    // keep uploads reasonably safe; PDFs are fine
    fileSizeLimit: "15MB",
    allowedMimeTypes: ["application/pdf"],
  });

  // Ignore "already exists" errors, surface others
  if (error) {
    const msg = String((error as any).message || error);
    if (!msg.toLowerCase().includes("already exists")) {
      throw new Error(msg);
    }
  }
}

export async function POST(req: Request) {
  const { supabase, profile } = await requireDirector();

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Form inválido." }, { status: 400 });

  const file = form.get("file");
  const name = safeName(String(form.get("name") || ""));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo PDF." }, { status: 400 });
  }

  const mime = String(file.type || "application/pdf").toLowerCase();
  const filename = String(file.name || "calendario.pdf");
  if (!filename.toLowerCase().endsWith(".pdf") && !mime.includes("pdf")) {
    return NextResponse.json({ error: "Arquivo deve ser PDF." }, { status: 400 });
  }

  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "PDF muito grande (máx. 15MB)." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const path = `schools/${profile.school_id}/calendar/${id}.pdf`;

  const bytes = Buffer.from(await file.arrayBuffer());

  // Prefer admin client for Storage (avoids policy/bucket issues), but keep user-client as fallback.
  let publicUrl = "";
  let storageErr: any = null;

  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (hasServiceRole) {
    try {
      const admin = createAdminClient();
      await ensureBucket(admin);

      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (upErr) throw upErr;

      const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
      publicUrl = String(data?.publicUrl || "");
    } catch (e: any) {
      storageErr = e;
    }
  }

  // Fallback to user client (requires the bucket and policies to already exist)
  if (!publicUrl) {
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (upErr) storageErr = upErr;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    publicUrl = String(data?.publicUrl || "");
  }

  if (!publicUrl) {
    const msg = String(storageErr?.message || storageErr || "");
    const bucketHint = looksLikeBucketNotFound(msg)
      ? `Bucket "${BUCKET}" não encontrado. Crie o bucket no Supabase Storage (ou defina CALENDAR_PDF_BUCKET), ` +
        `ou configure SUPABASE_SERVICE_ROLE_KEY para o app criar automaticamente.`
      : `Falha ao enviar PDF para o storage (${BUCKET}). Verifique permissões/policies do Storage.`;

    return NextResponse.json(
      {
        error: bucketHint + (msg ? ` Detalhe: ${msg}` : ""),
      },
      { status: 400 }
    );
  }

  const sourceName = name || safeName(filename.replace(/\.pdf$/i, "")) || "PDF local";

  const { data: inserted, error } = await supabase
    .from("calendar_sources")
    .insert({
      school_id: profile.school_id,
      name: sourceName,
      url: publicUrl,
      type: "pdf",
      active: true,
    })
    .select("id,name,url,type,active")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ source: inserted });
}
