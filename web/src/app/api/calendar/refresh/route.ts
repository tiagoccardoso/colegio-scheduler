import { NextResponse } from "next/server";
import { requireDirector } from "@/lib/require-director";
import { openaiChatJsonSchema, OpenAIError } from "@/lib/openai-chat";
import crypto from "crypto";
import { extractPdfTextFromUrl } from "@/lib/pdf-text";
import { extractHeuristicEvents, findCandidates, inferDocumentYear, normalizePdfWhitespace } from "@/lib/calendar-extract";

export const runtime = "nodejs";

function stripHtml(html: string) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeHash(parts: string[]) {
  return crypto.createHash("sha1").update(parts.join("|"), "utf8").digest("hex");
}

function isUuid(v: any) {
  const s = String(v || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeUtcDateTime(args: { date: string; time?: string | null }) {
  const m = String(args.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  const t = String(args.time || "").trim();
  let hh = 9;
  let mm = 0;
  if (/^\d{2}:\d{2}$/.test(t)) {
    hh = Math.min(23, Math.max(0, Number(t.slice(0, 2))));
    mm = Math.min(59, Math.max(0, Number(t.slice(3, 5))));
  }
  const dt = new Date(Date.UTC(y, mo - 1, da, hh, mm, 0));
  if (isNaN(dt.getTime())) return null;
  return dt;
}

async function extractEventsWithAI(args: {
  apiKey: string;
  model: string;
  userId: string;
  sourceName: string;
  sourceUrl: string;
  candidates: Array<{ date: string; context: string; raw: string }>;
}) {
  const { apiKey, model, userId, sourceName, sourceUrl, candidates } = args;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            date: { type: "string" },
            time: { type: ["string", "null"] },
            end_date: { type: ["string", "null"] },
            end_time: { type: ["string", "null"] },
            category: { type: ["string", "null"] },
          },
          required: ["title", "date"],
        },
      },
    },
    required: ["events"],
  };

  const sys =
    "Você extrai eventos para um calendário escolar. " +
    "Use apenas evidências nos trechos. " +
    "Retorne títulos curtos e claros. " +
    "Ignore datas que parecem ser apenas data de publicação. " +
    "date/end_date devem ser YYYY-MM-DD. time/end_time (se houver) devem ser HH:MM 24h, ou null.";

  const payload = { source: { name: sourceName, url: sourceUrl }, candidates };

  const out = await openaiChatJsonSchema<{ events: any[] }>({
    apiKey,
    model,
    schemaName: "calendar_events_extraction",
    schema,
    temperature: 0.1,
    maxCompletionTokens: 1200,
    userIdForSafetyIdentifier: userId,
    messages: [
      { role: "system", content: sys },
      {
        role: "user",
        content:
          "Extraia eventos do calendário a partir destes trechos com datas. " +
          "Retorne apenas eventos reais (reuniões, conselhos, recessos, prazos, convocações, etc.).\n\n" +
          JSON.stringify(payload),
      },
    ],
  });

  const evs = Array.isArray(out?.events) ? out.events : [];
  return evs.slice(0, 140);
}

function inferUrlLooksLikePdf(url: string): boolean {
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    return p.endsWith(".pdf");
  } catch {
    return String(url || "").toLowerCase().includes(".pdf");
  }
}

async function sniffIsPdf(url: string): Promise<boolean> {
  // Try a HEAD first (cheap) then fallback to extension.
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/pdf")) return true;
  } catch {
    // ignore
  }
  return inferUrlLooksLikePdf(url);
}

export async function POST() {
  const { supabase, profile } = await requireDirector();

  const aiEnabled = process.env.AI_SCHEDULER_ENABLED === "true";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const canUseAI = aiEnabled && Boolean(openaiKey);

  const { data: sources, error: sourcesError } = await supabase
    .from("calendar_sources")
    .select("*")
    .eq("school_id", profile.school_id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 400 });

  const created: any[] = [];
  const skipped: string[] = [];
  const aiErrors: string[] = [];
  const now = new Date();
  const guardYearMin = now.getUTCFullYear() - 1;
  const guardYearMax = now.getUTCFullYear() + 2;

  for (const src of sources ?? []) {
    const name = String(src.name || "");
    const url = String(src.url || "");
    const declaredType = String(src.type || "site");

    const actualIsPdf = declaredType === "pdf" ? true : await sniffIsPdf(url);

    if (actualIsPdf) {
      let pdfText = "";
      let contentType: string | undefined;
      try {
        const out = await extractPdfTextFromUrl(url);
        pdfText = normalizePdfWhitespace(out.text);
        contentType = out.contentType;
      } catch {
        pdfText = "";
      }

      // Always mark checked.
      try {
        await supabase
          .from("calendar_sources")
          .update({ last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          .eq("id", src.id)
          .eq("school_id", profile.school_id);
      } catch {
        // ignore
      }

      if (!pdfText || pdfText.length < 40) {
        // fallback reminder
        const hash = makeHash(["pdf-reminder", profile.school_id, src.id]);
        created.push({
          school_id: profile.school_id,
          source_id: isUuid(src.id) ? src.id : null,
          source_name: name,
          source_url: url,
          category: "PDF",
          title: `Revisar PDF: ${name}`,
          start_at: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0)).toISOString(),
          end_at: null,
          hash,
        });
        continue;
      }

      const year = inferDocumentYear(pdfText);
      const candidates = findCandidates(pdfText, { max: 60, defaultYear: year });
      const heur = extractHeuristicEvents(pdfText, year);

      const contentHash = makeHash(["pdf", url, contentType || "", String(pdfText.length), pdfText.slice(0, 4500)]);
      const lastHash = String((src as any).last_content_hash || "");

      if (lastHash && lastHash === contentHash) {
        skipped.push(name || url);
        continue;
      }

      // 1) Heuristic events first (cheap, deterministic)
      for (const ev of heur) {
        const date = String(ev?.date || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const y = Number(date.slice(0, 4));
        if (y < guardYearMin || y > guardYearMax) continue;

        const title = String(ev?.title || "").replace(/\s+/g, " ").trim();
        if (!title) continue;

        const startDt = safeUtcDateTime({ date, time: ev?.time ?? null });
        if (!startDt) continue;

        let end_at: string | null = null;
        if (ev?.end_date) {
          const endDate = String(ev.end_date).trim();
          const endDt = safeUtcDateTime({ date: endDate, time: ev?.end_time ?? null });
          if (endDt && endDt.getTime() >= startDt.getTime()) end_at = endDt.toISOString();
        } else {
          const endDt = safeUtcDateTime({ date, time: ev?.end_time ?? null });
          if (endDt && endDt.getTime() > startDt.getTime()) end_at = endDt.toISOString();
        }

        const category = String(ev?.category || "").trim() || "PDF";
        const hash = makeHash([profile.school_id, src.id, startDt.toISOString().slice(0, 16), end_at || "", title]);

        created.push({
          school_id: profile.school_id,
          source_id: isUuid(src.id) ? src.id : null,
          source_name: name,
          source_url: url,
          category,
          title: title.slice(0, 240),
          start_at: startDt.toISOString(),
          end_at,
          hash,
        });

        if (created.length > 950) break;
      }

      // 2) AI extraction (optional) using candidates
      let extracted: any[] = [];
      if (candidates.length) {
        if (canUseAI) {
          try {
            extracted = await extractEventsWithAI({
              apiKey: openaiKey,
              model,
              userId: profile.user_id,
              sourceName: name,
              sourceUrl: url,
              candidates,
            });
          } catch (e: any) {
            const msg = e instanceof OpenAIError ? e.message : e?.message || "Falha ao usar IA.";
            aiErrors.push(`${name || url}: ${msg}`);
          }
        }

        // fallback sem IA
        if (!extracted.length) {
          extracted = candidates.map((c) => ({
            title: `${name}: ${c.context}`,
            date: c.date,
            time: null,
            end_date: null,
            end_time: null,
            category: "PDF",
          }));
        }

        for (const ev of extracted) {
          const date = String(ev?.date || "").trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          const y = Number(date.slice(0, 4));
          if (y < guardYearMin || y > guardYearMax) continue;

          const title = String(ev?.title || "").replace(/\s+/g, " ").trim();
          if (!title) continue;

          const startDt = safeUtcDateTime({ date, time: ev?.time ?? null });
          if (!startDt) continue;

          let end_at: string | null = null;
          const endDate = String(ev?.end_date || "").trim();
          if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            const endDt = safeUtcDateTime({ date: endDate, time: ev?.end_time ?? null });
            if (endDt && endDt.getTime() >= startDt.getTime()) end_at = endDt.toISOString();
          } else {
            const endDt = safeUtcDateTime({ date, time: ev?.end_time ?? null });
            if (endDt && endDt.getTime() > startDt.getTime()) end_at = endDt.toISOString();
          }

          const category = String(ev?.category || "").trim() || "PDF";
          const hash = makeHash([profile.school_id, src.id, startDt.toISOString().slice(0, 16), end_at || "", title]);

          created.push({
            school_id: profile.school_id,
            source_id: isUuid(src.id) ? src.id : null,
            source_name: name,
            source_url: url,
            category,
            title: title.slice(0, 240),
            start_at: startDt.toISOString(),
            end_at,
            hash,
          });

          if (created.length > 950) break;
        }
      }

      // Update source cache
      try {
        await supabase
          .from("calendar_sources")
          .update({
            last_content_hash: contentHash,
            last_ai_at: canUseAI ? new Date().toISOString() : null,
            last_ai_model: canUseAI ? model : null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", src.id)
          .eq("school_id", profile.school_id);
      } catch {
        // ignore
      }

      continue;
    }

    // SITE / HTML
    let html = "";
    try {
      const r = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (CalendarioDiretorBot/1.0)",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
      });
      if (!r.ok) continue;
      html = await r.text();
    } catch {
      continue;
    }

    const text = stripHtml(html);
    const year = inferDocumentYear(text);
    const candidates = findCandidates(text, { max: 64, defaultYear: year });
    if (!candidates.length) {
      try {
        await supabase
          .from("calendar_sources")
          .update({ last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
          .eq("id", src.id)
          .eq("school_id", profile.school_id);
      } catch {}
      continue;
    }

    const contentHash = makeHash(["html", url, String(text.length), text.slice(0, 4000)]);
    const lastHash = String((src as any).last_content_hash || "");

    try {
      await supabase
        .from("calendar_sources")
        .update({ last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
        .eq("id", src.id)
        .eq("school_id", profile.school_id);
    } catch {}

    if (lastHash && lastHash === contentHash) {
      skipped.push(name || url);
      continue;
    }

    let extracted: any[] = [];
    if (canUseAI) {
      try {
        extracted = await extractEventsWithAI({
          apiKey: openaiKey,
          model,
          userId: profile.user_id,
          sourceName: name,
          sourceUrl: url,
          candidates,
        });
      } catch (e: any) {
        const msg = e instanceof OpenAIError ? e.message : e?.message || "Falha ao usar IA.";
        aiErrors.push(`${name || url}: ${msg}`);
      }
    }

    if (!extracted.length) {
      extracted = candidates.map((c) => ({
        title: `${name}: ${c.context}`,
        date: c.date,
        time: null,
        end_date: null,
        end_time: null,
        category: "NRE/Fontes",
      }));
    }

    for (const ev of extracted) {
      const date = String(ev?.date || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const y = Number(date.slice(0, 4));
      if (y < guardYearMin || y > guardYearMax) continue;

      const title = String(ev?.title || "").replace(/\s+/g, " ").trim();
      if (!title) continue;

      const startDt = safeUtcDateTime({ date, time: ev?.time ?? null });
      if (!startDt) continue;

      let end_at: string | null = null;
      const endDate = String(ev?.end_date || "").trim();
      if (endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        const endDt = safeUtcDateTime({ date: endDate, time: ev?.end_time ?? null });
        if (endDt && endDt.getTime() >= startDt.getTime()) end_at = endDt.toISOString();
      } else {
        const endDt = safeUtcDateTime({ date, time: ev?.end_time ?? null });
        if (endDt && endDt.getTime() > startDt.getTime()) end_at = endDt.toISOString();
      }

      const category = String(ev?.category || "").trim() || "NRE/Fontes";
      const hash = makeHash([profile.school_id, src.id, startDt.toISOString().slice(0, 16), end_at || "", title]);

      created.push({
        school_id: profile.school_id,
        source_id: isUuid(src.id) ? src.id : null,
        source_name: name,
        source_url: url,
        category,
        title: title.slice(0, 240),
        start_at: startDt.toISOString(),
        end_at,
        hash,
      });

      if (created.length > 950) break;
    }

    try {
      await supabase
        .from("calendar_sources")
        .update({
          last_content_hash: contentHash,
          last_ai_at: canUseAI ? new Date().toISOString() : null,
          last_ai_model: canUseAI ? model : null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", src.id)
        .eq("school_id", profile.school_id);
    } catch {
      // ignore
    }
  }

  if (!created.length) {
    return NextResponse.json({
      message:
        skipped.length > 0
          ? `Nada novo. ${skipped.length} fonte(s) sem mudanças desde a última varredura.`
          : "Nenhuma data nova encontrada nas fontes.",
      ai_errors: aiErrors.slice(0, 6),
    });
  }

  const { error } = await supabase.from("calendar_events").upsert(created, { onConflict: "school_id,hash" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    message:
      `Atualizado! ${created.length} evento(s) identificado(s). ` +
      (skipped.length ? `(${skipped.length} fonte(s) sem mudanças, sem gastar tokens.)` : ""),
    ai_errors: aiErrors.slice(0, 6),
  });
}
