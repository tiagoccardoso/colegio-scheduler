import { NextResponse } from "next/server";
import { requireDirectorApi, jsonError, scheduleSnapshot } from "@/app/api/weekly-grade/_utils";

const SHIFT_KEYS = ["MANHA", "TARDE", "NOITE"] as const;

export async function POST(req: Request) {
  const ctx = await requireDirectorApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  const { supabase, profile } = ctx;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return jsonError("JSON inválido.");
  }

  const rawShift = String(body.shift ?? "ALL").trim().toUpperCase();
  const shifts = rawShift === "ALL" ? [...SHIFT_KEYS] : SHIFT_KEYS.includes(rawShift as any) ? [rawShift] : null;
  if (!shifts) return jsonError("Turno inválido.");

  const ok = Boolean(body.confirm);
  if (!ok) return jsonError("Confirmação obrigatória.");

  // encontra slots do(s) turno(s) e remove somente HA
  const { data: timeSlots, error: tsErr } = await supabase
    .from("time_slots")
    .select("id")
    .eq("school_id", profile.school_id)
    .in("shift", shifts)
    .in("weekday", [1, 2, 3, 4, 5]);

  if (tsErr) return jsonError(tsErr.message || "Falha ao carregar horários.");

  const timeSlotIds = ((timeSlots as any[] | null) ?? []).map((t) => t.id);
  if (!timeSlotIds.length) return NextResponse.json({ ok: true });

  const { data: existing } = await supabase
    .from("schedules")
    .select("id,school_id,activity_type,class_id,time_slot_id,subject_id,teacher_id,room_id,notes")
    .eq("school_id", profile.school_id)
    .eq("activity_type", "HA")
    .in("time_slot_id", timeSlotIds);

  const before = ((existing as any[] | null) ?? []).map((s) => scheduleSnapshot(s)).filter(Boolean);

  const delRes = await supabase
    .from("schedules")
    .delete()
    .eq("school_id", profile.school_id)
    .eq("activity_type", "HA")
    .in("time_slot_id", timeSlotIds);

  if (delRes?.error) return jsonError(delRes.error.message || "Falha ao excluir HA.");

  await supabase.from("schedule_audit_events").insert({
    school_id: profile.school_id,
    action: "bulk_delete_ha",
    before,
    after: [],
  });

  return NextResponse.json({ ok: true });
}
