import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";

type TimeSlot = {
  id: string;
  weekday: number;
  shift: string | null;
  period_index: number | null;
  starts_at: string;
  ends_at: string;
};

type TeacherRow = {
  id: string;
  name: string | null;
};

type ShiftSettingRow = {
  shift: string | null;
  interval_minutes: number | null;
  interval_after_period: number | null;
};

const WEEKDAYS: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

const SHIFT_OPTIONS: { key: string; label: string }[] = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];

function maxPeriodsForShift(shift: string) {
  return String(shift || "").toUpperCase() === "NOITE" ? 5 : 6;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("time_slots")
    .select("id, weekday, shift, period_index, starts_at, ends_at")
    .eq("school_id", profile.school_id)
    .order("shift", { ascending: true })
    .order("weekday", { ascending: true })
    .order("period_index", { ascending: true })
    .order("starts_at", { ascending: true });

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  // Optional table (created by db/shift_settings.sql)
  const { data: shiftSettings } = await supabase
    .from("shift_settings")
    .select("shift,interval_minutes,interval_after_period")
    .eq("school_id", profile.school_id);

  const intervalByShift = new Map<string, { minutes: number; afterPeriod: number }>();
  for (const r of ((shiftSettings as ShiftSettingRow[] | null) ?? [])) {
    const k = String(r.shift || "").toUpperCase();
    const minutes = Number(r.interval_minutes ?? 0);
    const afterPeriod = Number(r.interval_after_period ?? 0);
    if (!k) continue;

    intervalByShift.set(k, {
      minutes: Number.isFinite(minutes) ? Math.max(0, minutes) : 0,
      afterPeriod: Number.isFinite(afterPeriod) ? Math.max(0, afterPeriod) : 0,
    });
  }

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const weekday = Number(formData.get("weekday"));
    const shift = String(formData.get("shift") || "MANHA").trim().toUpperCase();
    const period_index = Number(formData.get("period_index"));
    const starts_at = String(formData.get("starts_at") || "").trim();
    const ends_at = String(formData.get("ends_at") || "").trim();

    const maxPeriods = maxPeriodsForShift(shift);

    if (!(weekday >= 1 && weekday <= 7)) redirect("/time-slots?error=" + encodeMsg("Dia da semana inválido."));
    if (!SHIFT_OPTIONS.some((s) => s.key === shift)) redirect("/time-slots?error=" + encodeMsg("Turno inválido."));
    if (!(period_index >= 1 && period_index <= maxPeriods))
      redirect("/time-slots?error=" + encodeMsg(`Período inválido (1..${maxPeriods}).`));
    if (!starts_at || !ends_at) redirect("/time-slots?error=" + encodeMsg("Preencha início e fim."));

    const { error } = await supabase.from("time_slots").insert({
      id: randomUUID(),
      school_id: profile.school_id,
      shift,
      weekday,
      period_index,
      starts_at,
      ends_at,
    });

    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário criado."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    const weekday = Number(formData.get("weekday"));
    const shift = String(formData.get("shift") || "MANHA").trim().toUpperCase();
    const period_index = Number(formData.get("period_index"));
    const starts_at = String(formData.get("starts_at") || "").trim();
    const ends_at = String(formData.get("ends_at") || "").trim();

    const maxPeriods = maxPeriodsForShift(shift);

    if (!id) redirect("/time-slots?error=" + encodeMsg("ID inválido."));
    if (!(weekday >= 1 && weekday <= 7)) redirect("/time-slots?error=" + encodeMsg("Dia da semana inválido."));
    if (!SHIFT_OPTIONS.some((s) => s.key === shift)) redirect("/time-slots?error=" + encodeMsg("Turno inválido."));
    if (!(period_index >= 1 && period_index <= maxPeriods))
      redirect("/time-slots?error=" + encodeMsg(`Período inválido (1..${maxPeriods}).`));
    if (!starts_at || !ends_at) redirect("/time-slots?error=" + encodeMsg("Preencha início e fim."));

    const { error } = await supabase
      .from("time_slots")
      .update({ weekday, shift, period_index, starts_at, ends_at })
      .eq("id", id)
      .eq("school_id", profile.school_id);
    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário atualizado."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/time-slots?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase
      .from("time_slots")
      .delete()
      .eq("id", id)
      .eq("school_id", profile.school_id);
    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário removido."));
  }

  async function generateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const shift = String(formData.get("g_shift") || "MANHA").trim().toUpperCase();
    const start = String(formData.get("g_start") || "07:00").trim();
    const duration = Math.max(1, Number(formData.get("g_duration")) || 50);

    const useShiftInterval = String(formData.get("g_use_shift_interval") || "") === "on";

    const periods = Math.min(
      maxPeriodsForShift(shift),
      Math.max(1, Number(formData.get("g_periods")) || 6),
    );

    const weekdays = (formData.getAll("g_weekdays") as string[])
      .map((v) => Number(v))
      .filter((n) => n >= 1 && n <= 7);

    if (!SHIFT_OPTIONS.some((s) => s.key === shift)) redirect("/time-slots?error=" + encodeMsg("Turno inválido."));
    if (!start) redirect("/time-slots?error=" + encodeMsg("Horário inicial inválido."));
    if (weekdays.length === 0) redirect("/time-slots?error=" + encodeMsg("Selecione pelo menos um dia."));

    let intervalMinutes = 0;
    let intervalAfterPeriod = 0;

    if (useShiftInterval) {
      const { data: ss, error: ssErr } = await supabase
        .from("shift_settings")
        .select("interval_minutes,interval_after_period")
        .eq("school_id", profile.school_id)
        .eq("shift", shift)
        .maybeSingle();
      if (ssErr) {
        redirect(
          "/time-slots?error=" +
            encodeMsg(
              "Não foi possível ler o intervalo do turno. Rode db/shift_settings.sql no Supabase.",
            ),
        );
      }

      intervalMinutes = Math.max(0, Number((ss as any)?.interval_minutes ?? 0));
      intervalAfterPeriod = Math.max(0, Number((ss as any)?.interval_after_period ?? 0));
    }

    function addMinutes(hhmm: string, minutes: number) {
      const [hRaw, mRaw] = String(hhmm || "").split(":");
      const h = Number(hRaw);
      const m = Number(mRaw);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
      const total = h * 60 + m + minutes;
      const hh = Math.floor(((total + 24 * 60) % (24 * 60)) / 60);
      const mm = (total + 24 * 60) % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(hh)}:${pad(mm)}`;
    }

    const payload: any[] = [];
    for (const weekday of Array.from(new Set(weekdays))) {
      for (let p = 1; p <= periods; p++) {
        const intervalOffset =
          intervalMinutes > 0 && intervalAfterPeriod > 0 && p > intervalAfterPeriod ? intervalMinutes : 0;
        const starts_at = addMinutes(start, (p - 1) * duration + intervalOffset);
        const ends_at = addMinutes(start, (p - 1) * duration + intervalOffset + duration);
        payload.push({
          school_id: profile.school_id,
          shift,
          weekday,
          period_index: p,
          starts_at,
          ends_at,
        });
      }
    }

    // Upsert by PK. We first map (weekday,period) -> existing id, then upsert using that id.
    const uniqWeekdays = Array.from(new Set(weekdays));
    const { data: existing, error: exErr } = await supabase
      .from("time_slots")
      .select("id, weekday, period_index")
      .eq("school_id", profile.school_id)
      .eq("shift", shift)
      .in("weekday", uniqWeekdays);
    if (exErr) redirect("/time-slots?error=" + encodeMsg(exErr.message));

    const idByKey = new Map<string, string>();
    for (const r of ((existing as any[] | null) ?? [])) {
      const w = Number((r as any).weekday);
      const p = Number((r as any).period_index);
      if (!Number.isFinite(w) || !Number.isFinite(p) || p <= 0) continue;
      idByKey.set(`${w}-${p}`, String((r as any).id));
    }

    const payloadWithIds = payload.map((row) => {
      const k = `${row.weekday}-${row.period_index}`;
      return { ...row, id: idByKey.get(k) ?? randomUUID() };
    });

    const { error } = await supabase.from("time_slots").upsert(payloadWithIds, { onConflict: "id" });
    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    // Cleanup when user reduces periods.
    await supabase
      .from("time_slots")
      .delete()
      .eq("school_id", profile.school_id)
      .eq("shift", shift)
      .in("weekday", uniqWeekdays)
      .gt("period_index", periods);

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Calendário gerado/atualizado."));
  }

  async function saveShiftIntervalAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const shift = String(formData.get("ss_shift") || "MANHA").trim().toUpperCase();
    const interval = Math.max(0, Math.min(180, Number(formData.get("ss_interval")) || 0));
    const afterPeriodRaw = Number(formData.get("ss_after_period")) || 0;
    const maxPeriods = maxPeriodsForShift(shift);
    const afterPeriod = Math.max(0, Math.min(maxPeriods, Math.floor(afterPeriodRaw)));

    if (!SHIFT_OPTIONS.some((s) => s.key === shift)) redirect("/time-slots?error=" + encodeMsg("Turno inválido."));

    if (afterPeriodRaw !== afterPeriod) {
      redirect(
        "/time-slots?error=" +
          encodeMsg(`Período inválido para iniciar o intervalo (0..${maxPeriods}).`),
      );
    }

    // Read previous settings (so we can adjust existing time slots without cumulative drift)
    let oldInterval = 0;
    let oldAfterPeriod = 0;
    const { data: oldSS, error: oldErr } = await supabase
      .from("shift_settings")
      .select("interval_minutes,interval_after_period")
      .eq("school_id", profile.school_id)
      .eq("shift", shift)
      .maybeSingle();
    if (oldErr) {
      redirect(
        "/time-slots?error=" +
          encodeMsg(
            "Não foi possível ler o intervalo do turno. Rode db/shift_settings.sql no Supabase.",
          ),
      );
    }

    oldInterval = Math.max(0, Number((oldSS as any)?.interval_minutes ?? 0));
    oldAfterPeriod = Math.max(0, Number((oldSS as any)?.interval_after_period ?? 0));

    const { error } = await supabase
      .from("shift_settings")
      .upsert(
        {
          school_id: profile.school_id,
          shift,
          interval_minutes: interval,
          interval_after_period: afterPeriod,
        },
        { onConflict: "school_id,shift" },
      );

    if (error) {
      redirect(
        "/time-slots?error=" +
          encodeMsg(
            error.message || "Falha ao salvar. Rode db/shift_settings.sql no Supabase.",
          ),
      );
    }

    // Update existing time slots for this shift: periods after the interval start are shifted.
    // We apply (newOffset - oldOffset) per period to avoid cumulative drift.
    const offsetFor = (minutes: number, afterP: number, periodIndex: number) =>
      minutes > 0 && afterP > 0 && periodIndex > afterP ? minutes : 0;

    const parseTime = (hhmmss: string) => {
      const [hRaw, mRaw] = String(hhmmss || "").split(":");
      const h = Number(hRaw);
      const m = Number(mRaw);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };

    const formatTime = (totalMinutes: number) => {
      const total = (totalMinutes + 24 * 60) % (24 * 60);
      const hh = Math.floor(total / 60);
      const mm = total % 60;
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(hh)}:${pad(mm)}`;
    };

    const addMinutes = (hhmmss: string, add: number) => {
      const base = parseTime(hhmmss);
      if (base == null) return hhmmss;
      return formatTime(base + add);
    };

    const { data: slotRows, error: slotErr } = await supabase
      .from("time_slots")
      .select("id,weekday,shift,period_index,starts_at,ends_at")
      .eq("school_id", profile.school_id)
      .eq("shift", shift);
    if (slotErr) redirect("/time-slots?error=" + encodeMsg(slotErr.message));

    const updates: any[] = [];
    for (const r of ((slotRows as any[] | null) ?? [])) {
      const id = String((r as any).id || "");
      const wd = Number((r as any).weekday);
      const pi = Number((r as any).period_index);
      if (!id || !Number.isFinite(wd) || !Number.isFinite(pi)) continue;

      const oldOff = offsetFor(oldInterval, oldAfterPeriod, pi);
      const newOff = offsetFor(interval, afterPeriod, pi);
      const delta = newOff - oldOff;
      if (delta === 0) continue;

      updates.push({
        id,
        school_id: profile.school_id,
        shift,
        weekday: wd,
        period_index: pi,
        starts_at: addMinutes(String((r as any).starts_at || ""), delta),
        ends_at: addMinutes(String((r as any).ends_at || ""), delta),
      });
    }

    if (updates.length) {
      const { error: upErr } = await supabase
        .from("time_slots")
        .upsert(updates, { onConflict: "id" });
      if (upErr) redirect("/time-slots?error=" + encodeMsg(upErr.message));
    }

    revalidatePath("/time-slots");
    revalidatePath("/weekly-grade");
    redirect(
      "/time-slots?msg=" +
        encodeMsg(updates.length ? "Intervalo do turno salvo e horários ajustados." : "Intervalo do turno salvo."),
    );
  }

  async function resetAllPeriodsAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const shift = String(formData.get("r_shift") || "ALL").trim().toUpperCase();
    const deleteSchedules = String(formData.get("r_delete_schedules") || "") === "on";

    const shiftFilter = shift === "ALL" ? null : shift;
    if (shiftFilter && !SHIFT_OPTIONS.some((s) => s.key === shiftFilter)) {
      redirect("/time-slots?error=" + encodeMsg("Turno inválido."));
    }

    const q = supabase
      .from("time_slots")
      .select("id")
      .eq("school_id", profile.school_id);
    const { data: slots, error: slotsErr } = shiftFilter ? await q.eq("shift", shiftFilter) : await q;
    if (slotsErr) redirect("/time-slots?error=" + encodeMsg(slotsErr.message));

    const timeSlotIds = ((slots as any[] | null) ?? []).map((r) => String(r.id)).filter(Boolean);

    if (deleteSchedules && timeSlotIds.length) {
      const { error: delSchedErr } = await supabase
        .from("schedules")
        .delete()
        .eq("school_id", profile.school_id)
        .in("time_slot_id", timeSlotIds);
      if (delSchedErr) redirect("/time-slots?error=" + encodeMsg(delSchedErr.message));
    }

    const delQ = supabase
      .from("time_slots")
      .delete()
      .eq("school_id", profile.school_id);

    const { error: delSlotsErr } = shiftFilter ? await delQ.eq("shift", shiftFilter) : await delQ;
    if (delSlotsErr) redirect("/time-slots?error=" + encodeMsg(delSlotsErr.message));

    revalidatePath("/time-slots");
    revalidatePath("/weekly-grade");
    redirect(
      "/time-slots?msg=" +
        encodeMsg(
          shiftFilter
            ? `Períodos do turno ${shiftFilter} zerados.`
            : "Todos os períodos foram zerados.",
        ),
    );
  }

  async function createHoraAtividadeAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const teacherId = String(formData.get("ha_teacher") || "");
    const shift = String(formData.get("ha_shift") || "MANHA").trim().toUpperCase();

    const weekdays = (formData.getAll("ha_weekdays") as string[])
      .map((v) => Number(v))
      .filter((n) => n >= 1 && n <= 7);

    const periods = (formData.getAll("ha_periods") as string[])
      .map((v) => Number(v))
      .filter((n) => n >= 1 && n <= 6);

    const notes = String(formData.get("ha_notes") || "").trim();

    if (!teacherId) redirect("/time-slots?error=" + encodeMsg("Selecione um professor."));
    if (!SHIFT_OPTIONS.some((s) => s.key === shift)) redirect("/time-slots?error=" + encodeMsg("Turno inválido."));
    if (weekdays.length === 0) redirect("/time-slots?error=" + encodeMsg("Selecione ao menos 1 dia."));
    if (periods.length === 0) redirect("/time-slots?error=" + encodeMsg("Selecione ao menos 1 período."));

    const maxPeriods = maxPeriodsForShift(shift);
    const invalidP = periods.find((p) => p < 1 || p > maxPeriods);
    if (invalidP) {
      redirect(
        "/time-slots?error=" +
          encodeMsg(`Período inválido para ${shift} (1..${maxPeriods}).`),
      );
    }

    const uniqWeekdays = Array.from(new Set(weekdays));
    const uniqPeriods = Array.from(new Set(periods));

    const { data: tsRows, error: tsErr } = await supabase
      .from("time_slots")
      .select("id,weekday,period_index")
      .eq("school_id", profile.school_id)
      .eq("shift", shift)
      .in("weekday", uniqWeekdays)
      .in("period_index", uniqPeriods);

    if (tsErr) redirect("/time-slots?error=" + encodeMsg(tsErr.message));

    const slotByKey = new Map<string, string>();
    for (const r of ((tsRows as any[] | null) ?? [])) {
      const wd = Number((r as any).weekday);
      const p = Number((r as any).period_index);
      const id = String((r as any).id || "");
      if (id) slotByKey.set(`${wd}-${p}`, id);
    }

    const missing: string[] = [];
    for (const wd of uniqWeekdays) {
      for (const p of uniqPeriods) {
        if (!slotByKey.get(`${wd}-${p}`)) {
          missing.push(`${WEEKDAYS[wd] ?? wd} ${p}º`);
        }
      }
    }

    if (missing.length) {
      redirect(
        "/time-slots?error=" +
          encodeMsg(
            `Faltam horários configurados para: ${missing.slice(0, 12).join(", ")}${
              missing.length > 12 ? "…" : ""
            }. Gere o calendário do turno antes de cadastrar HA.`,
          ),
      );
    }

    const timeSlotIds = Array.from(new Set(Array.from(slotByKey.values())));

    // Detect occupied slots for this teacher (do NOT overwrite AULAs).
    const { data: occupiedRows, error: occErr } = await supabase
      .from("schedules")
      .select("time_slot_id")
      .eq("school_id", profile.school_id)
      .eq("teacher_id", teacherId)
      .in("time_slot_id", timeSlotIds);

    if (occErr) redirect("/time-slots?error=" + encodeMsg(occErr.message));

    const occupied = new Set<string>();
    for (const r of ((occupiedRows as any[] | null) ?? [])) {
      const id = String((r as any).time_slot_id || "");
      if (id) occupied.add(id);
    }

    const toInsert = timeSlotIds
      .filter((id) => !occupied.has(id))
      .map((time_slot_id) => ({
        id: randomUUID(),
        school_id: profile.school_id,
        teacher_id: teacherId,
        time_slot_id,
        activity_type: "HA",
        class_id: null,
        subject_id: null,
        room_id: null,
        notes: notes ? notes : null,
      }));

    if (toInsert.length === 0) {
      redirect(
        "/time-slots?msg=" +
          encodeMsg("Nenhum slot disponível: o professor já está ocupado em todos os horários selecionados."),
      );
    }

    const { error: insErr } = await supabase.from("schedules").insert(toInsert);
    if (insErr) {
      redirect(
        "/time-slots?error=" +
          encodeMsg(
            insErr.message ||
              "Falha ao cadastrar HA. Verifique se rodou db/seed_pr_upgrade.sql (activity_type).",
          ),
      );
    }

    revalidatePath("/weekly-grade");
    redirect(
      "/time-slots?msg=" +
        encodeMsg(
          `Hora Atividade cadastrada: ${toInsert.length}. Ignorados (ocupados): ${occupied.size}.`,
        ),
    );
  }

  const rowsTyped = (rows as TimeSlot[] | null) ?? [];
  const teachersTyped = (teachers as TeacherRow[] | null) ?? [];

  const ssSummary = SHIFT_OPTIONS.map((s) => {
    const cfg = intervalByShift.get(s.key) ?? { minutes: 0, afterPeriod: 0 };
    if (cfg.minutes > 0 && cfg.afterPeriod > 0) return `${s.label}: ${cfg.minutes} min após ${cfg.afterPeriod}º`;
    return `${s.label}: sem intervalo`;
  }).join(" · ");

  return (
    <Shell
      title="Horários"
      subtitle="Cadastre por turno e período (Manhã/Tarde: 1..6; Noite: 1..5), ou gere o calendário automaticamente."
    >
      <div className="grid gap-4">
        <Flash
          message={
            error || msg || (loadError ? loadError.message : null)
          }
          variant={error ? "error" : msg ? "success" : "info"}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold">Cadastrar horário</summary>
              <form action={createAction} className="mt-4 grid gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Turno</span>
                    <select
                      name="shift"
                      defaultValue="MANHA"
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {SHIFT_OPTIONS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Dia da semana</span>
                    <select
                      name="weekday"
                      defaultValue="1"
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {Object.entries(WEEKDAYS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Período</span>
                    <input
                      name="period_index"
                      type="number"
                      min={1}
                      max={6}
                      defaultValue={1}
                      required
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Início</span>
                    <input
                      name="starts_at"
                      type="time"
                      required
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Fim</span>
                    <input
                      name="ends_at"
                      type="time"
                      required
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Salvar
                </button>
              </form>
            </details>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold">Gerar calendário por turno</summary>
              <form action={generateAction} className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Turno</span>
                  <select
                    name="g_shift"
                    defaultValue="MANHA"
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <legend className="px-2 text-sm font-semibold">Dias</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <label key={d} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="g_weekdays"
                          value={String(d)}
                          defaultChecked
                          className="h-4 w-4"
                        />
                        <span>{WEEKDAYS[d]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Início</span>
                    <input
                      name="g_start"
                      type="time"
                      defaultValue="07:00"
                      required
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Duração (min)</span>
                    <input
                      name="g_duration"
                      type="number"
                      min={1}
                      defaultValue={50}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Períodos</span>
                    <input
                      name="g_periods"
                      type="number"
                      min={1}
                      max={6}
                      defaultValue={6}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="g_use_shift_interval" className="h-4 w-4" />
                  <span>
                    Usar intervalo salvo do turno <span className="text-xs text-zinc-500">({ssSummary || "—"})</span>
                  </span>
                </label>

                <button
                  type="submit"
                  className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Gerar
                </button>

                <span className="text-xs text-zinc-500">
                  Isso cria/atualiza os horários por (turno, dia, período) sem apagar IDs existentes.
                </span>
              </form>
            </details>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold">Intervalo por turno</summary>
              <div className="mt-2 text-xs text-zinc-500">Atual: {ssSummary || "—"}</div>
              <form action={saveShiftIntervalAction} className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Turno</span>
                  <select
                    name="ss_shift"
                    defaultValue="MANHA"
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Intervalo (min)</span>
                    <input
                      name="ss_interval"
                      type="number"
                      min={0}
                      max={180}
                      defaultValue={0}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Inicia após o período</span>
                    <input
                      name="ss_after_period"
                      type="number"
                      min={0}
                      max={6}
                      defaultValue={0}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    />
                  </label>
                </div>

                <span className="text-xs text-zinc-500">
                  Ex.: <strong>10</strong> min iniciando após o <strong>3º</strong> período → o <strong>4º</strong> e os seguintes começam 10 min mais tarde.
                </span>

                <button
                  type="submit"
                  className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Salvar intervalo
                </button>

                <span className="text-xs text-zinc-500">
                  Requer executar <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">db/shift_settings.sql</code>.
                </span>
              </form>
            </details>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold">Cadastrar Hora Atividade (HA)</summary>
              <form action={createHoraAtividadeAction} className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Professor</span>
                  <select
                    name="ha_teacher"
                    defaultValue=""
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="">Selecione…</option>
                    {teachersTyped.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || "(sem nome)"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Turno</span>
                  <select
                    name="ha_shift"
                    defaultValue="MANHA"
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <legend className="px-2 text-sm font-semibold">Dias</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <label key={d} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="ha_weekdays" value={String(d)} className="h-4 w-4" />
                        <span>{WEEKDAYS[d]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <legend className="px-2 text-sm font-semibold">Períodos</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="ha_periods" value={String(p)} className="h-4 w-4" />
                        <span>{p}º</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">Noite usa 1..5.</div>
                </fieldset>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Observações</span>
                  <textarea
                    name="ha_notes"
                    rows={3}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Cadastrar HA
                  </button>

                  <a
                    href="/time-slots/listagem"
                    className="btn btn-danger w-fit"
                  >
                    Listagem
                  </a>
                </div>

                <span className="text-xs text-zinc-500">
                  Requer executar <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">db/seed_pr_upgrade.sql</code> (campo <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">activity_type</code>).
                </span>
              </form>
            </details>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold">Zerar períodos</summary>
              <form action={resetAllPeriodsAction} className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Turno</span>
                  <select
                    name="r_shift"
                    defaultValue="ALL"
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="ALL">Todos</option>
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="r_delete_schedules" defaultChecked className="h-4 w-4" />
                  <span>Apagar também a grade (schedules)</span>
                </label>

                <ConfirmButton
                  confirmText="Tem certeza? Isso remove horários e pode apagar a grade do turno."
                  type="submit"
                  className="btn btn-danger w-fit"
                >
                  Zerar
                </ConfirmButton>

                <span className="text-xs text-zinc-500">
                  Útil para reiniciar a configuração do turno.
                </span>
              </form>
            </details>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dia</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Período</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Início</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fim</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rowsTyped.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-4 py-3 text-sm">{row.shift ?? "—"}</td>
                    <td className="px-4 py-3 text-sm">{WEEKDAYS[row.weekday] ?? row.weekday}</td>
                    <td className="px-4 py-3 text-sm">{row.period_index ? `${row.period_index}º` : "—"}</td>
                    <td className="px-4 py-3 text-sm">{row.starts_at}</td>
                    <td className="px-4 py-3 text-sm">{row.ends_at}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                          <form action={updateAction} className="mt-3 grid w-[420px] gap-3">
                            <input type="hidden" name="id" value={row.id} />
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Turno</span>
                                <select
                                  name="shift"
                                  defaultValue={row.shift ?? "MANHA"}
                                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                                >
                                  {SHIFT_OPTIONS.map((s) => (
                                    <option key={s.key} value={s.key}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Dia</span>
                                <select
                                  name="weekday"
                                  defaultValue={String(row.weekday)}
                                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                                >
                                  {Object.entries(WEEKDAYS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Período</span>
                              <input
                                name="period_index"
                                type="number"
                                min={1}
                                max={6}
                                defaultValue={row.period_index ?? 1}
                                required
                                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                              />
                            </label>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Início</span>
                                <input
                                  name="starts_at"
                                  type="time"
                                  defaultValue={row.starts_at}
                                  required
                                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                                />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Fim</span>
                                <input
                                  name="ends_at"
                                  type="time"
                                  defaultValue={row.ends_at}
                                  required
                                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                                />
                              </label>
                            </div>

                            <button
                              type="submit"
                              className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                            >
                              Atualizar
                            </button>
                          </form>
                        </details>

                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmButton
                            confirmText="Tem certeza que deseja excluir?"
                            type="submit"
                            className="btn btn-danger"
                          >
                            Excluir
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}

                {rowsTyped.length === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={6} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                      Nenhum horário cadastrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
