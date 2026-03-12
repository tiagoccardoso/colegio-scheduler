import { jsonError, normalizeShift, requireStaffApi } from "../_helpers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ctx = await requireStaffApi();
  if (!ctx) return jsonError("Não autorizado.", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const shift = normalizeShift(body?.shift ?? "MANHA");
    const confirm = Boolean(body?.confirm);
    if (!confirm) return jsonError("Confirmação obrigatória.");

    const timeSlotsRes = await ctx.supabase
      .from("time_slots")
      .select("id")
      .eq("school_id", ctx.profile.school_id)
      .eq("shift", shift)
      .in("weekday", [1, 2, 3, 4, 5]);

    if (timeSlotsRes.error) return jsonError(timeSlotsRes.error.message || "Falha ao carregar os horários.");

    const timeSlotIds = ((timeSlotsRes.data as any[]) ?? []).map((item: any) => String(item.id));
    if (!timeSlotIds.length) return NextResponse.json({ ok: true, deleted: 0 });

    const delRes = await ctx.supabase
      .from("curriculum_matrix_slots")
      .delete()
      .eq("school_id", ctx.profile.school_id)
      .in("time_slot_id", timeSlotIds);

    if (delRes.error) return jsonError(delRes.error.message || "Falha ao zerar a matriz curricular.");
    return NextResponse.json({ ok: true, deleted: Number(delRes.count ?? 0) || 0 });
  } catch (e: any) {
    return jsonError(e?.message ?? "Erro inesperado.", 500);
  }
}
