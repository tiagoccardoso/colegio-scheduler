import { NextResponse } from "next/server";
import { requireDirector } from "@/lib/require-director";

export const runtime = "nodejs";

/**
 * Clear (delete) all events for the director's school AND reset source cache.
 * POST is used (instead of DELETE) to reduce accidental calls.
 *
 * Resetting cache makes the next /api/calendar/refresh behave like a "first scan"
 * (i.e., it will not skip sources based on last_content_hash).
 */
export async function POST() {
  const { supabase, profile } = await requireDirector();

  const nowIso = new Date().toISOString();

  // 1) Delete all events
  const { error: delError, count } = await supabase
    .from("calendar_events")
    .delete({ count: "exact" })
    .eq("school_id", profile.school_id);

  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });

  // 2) Reset cache for all sources (so refresh re-processes everything)
  const { error: cacheError } = await supabase
    .from("calendar_sources")
    .update(
      {
        last_content_hash: null,
        last_checked_at: null,
        last_ai_at: null,
        last_ai_model: null,
        updated_at: nowIso,
      } as any,
    )
    .eq("school_id", profile.school_id);

  if (cacheError) {
    // Events were cleared; return partial success with warning.
    return NextResponse.json(
      {
        ok: true,
        deleted: count ?? 0,
        cache_reset: false,
        warning: cacheError.message,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0, cache_reset: true });
}
