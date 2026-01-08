import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { requireDirector } from "@/lib/require-director";
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

function addMinutes(hhmm: string, minutes: number) {
  const [hRaw, mRaw] = String(hhmm || "").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const total = h * 60 + m + minutes;
  const hh = Math.floor((total + 24 * 60) % (24 * 60) / 60);
  const mm = (total + 24 * 60) % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, profile } = await requireDirector();
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

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

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

    // Some databases may not have a DEFAULT for `time_slots.id`.
    // Always provide a UUID so inserts never fail with "null value in column id".
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
    const { supabase, profile } = await requireDirector();

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
      .eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário atualizado."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/time-slots?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("time_slots").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário removido."));
  }

  async function generateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const shift = String(formData.get("g_shift") || "MANHA").trim().toUpperCase();
    const start = String(formData.get("g_start") || "07:00").trim();
    const duration = Math.max(1, Number(formData.get("g_duration")) || 50);
    const gap = Math.max(0, Number(formData.get("g_gap")) || 0);
    const periods = Math.min(maxPeriodsForShift(shift), Math.max(1, Number(formData.get("g_periods")) || 6));
    const weekdays = (formData.getAll("g_weekdays") as string[]).map((v) => Number(v)).filter((n) => n >= 1 && n <= 7);

    if (!SHIFT_OPTIONS.some((s) => s.key === shift)) redirect("/time-slots?error=" + encodeMsg("Turno inválido."));
    if (!start) redirect("/time-slots?error=" + encodeMsg("Horário inicial inválido."));
    if (weekdays.length === 0) redirect("/time-slots?error=" + encodeMsg("Selecione pelo menos um dia."));

    const payload: any[] = [];
    // NOTE: Server Actions are compiled into separate modules; avoid relying on
    // local helper functions via closure (can lead to ReferenceError at runtime).
    for (const weekday of Array.from(new Set(weekdays))) {
      for (let p = 1; p <= periods; p++) {
        const starts_at = addMinutes(start, (p - 1) * (duration + gap));
        const ends_at = addMinutes(start, (p - 1) * (duration + gap) + duration);
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

    // Robust generation: do NOT rely on composite unique indexes.
// We load existing ids by (weekday,period_index) and upsert by id (PK).
const uniqWeekdays = Array.from(new Set(weekdays));
const { data: existing } = await supabase
  .from("time_slots")
  .select("id, weekday, period_index")
  .eq("school_id", profile.school_id)
  .eq("shift", shift)
  .in("weekday", uniqWeekdays);

const idByKey = new Map<string, string>();
for (const r of (existing as any[] | null) ?? []) {
  const w = Number((r as any).weekday);
  const p = Number((r as any).period_index);
  if (!Number.isFinite(w) || !Number.isFinite(p) || p <= 0) continue;
  idByKey.set(`${w}-${p}`, String((r as any).id));
}

const payloadWithIds = payload.map((row) => {
  const k = `${row.weekday}-${row.period_index}`;
  const existingId = idByKey.get(k);
  // Ensure we never send `id: null` (or omit id when the table has no DEFAULT).
  // Using a UUID for new rows keeps generation reliable across different DB schemas.
  return { ...row, id: existingId ?? randomUUID() };
});

const { error } = await supabase
  .from("time_slots")
  .upsert(payloadWithIds, { onConflict: "id" });

if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

// Optional cleanup: if the user reduced the number of periods, remove leftovers.
// This keeps the calendar consistent with the selected "Qtd. períodos".
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

  const rowsTyped = (rows as TimeSlot[] | null) ?? [];

  return (
    <Shell title="Horários" subtitle="Cadastre por turno e período (Manhã/Tarde: 1..6; Noite: 1..5), ou gere o calendário automaticamente.">
      <div className="grid gap-4">
        <Flash message={error || msg || (loadError ? loadError.message : null)} variant={error ? "error" : msg ? "success" : "info"} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <details open>
              <summary className="cursor-pointer text-sm font-semibold">Cadastrar horário</summary>
              <form action={createAction} className="mt-4 grid gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Turno</span>
                    <select name="shift" defaultValue="MANHA" className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                      {SHIFT_OPTIONS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Dia da semana</span>
                    <select name="weekday" defaultValue="1" className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
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
                    <input name="period_index" type="number" min={1} max={6} defaultValue={1} required className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Início</span>
                    <input name="starts_at" type="time" required className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Fim</span>
                    <input name="ends_at" type="time" required className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                  </label>
                </div>

                <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
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
                  <select name="g_shift" defaultValue="MANHA" className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
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
                        <input type="checkbox" name="g_weekdays" value={String(d)} defaultChecked className="h-4 w-4" />
                        <span>{WEEKDAYS[d]}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Início</span>
                    <input name="g_start" type="time" defaultValue="07:00" required className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Duração (min)</span>
                    <input name="g_duration" type="number" min={1} defaultValue={50} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Intervalo (min)</span>
                    <input name="g_gap" type="number" min={0} defaultValue={0} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Períodos</span>
                    <input name="g_periods" type="number" min={1} max={6} defaultValue={6} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                  </label>
                </div>

                <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                  Gerar
                </button>

                <span className="text-xs text-zinc-500">
                  Isso cria/atualiza os horários por (turno, dia, período) sem apagar IDs existentes.
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
                                <select name="shift" defaultValue={row.shift ?? "MANHA"} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                                  {SHIFT_OPTIONS.map((s) => (
                                    <option key={s.key} value={s.key}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Dia</span>
                                <select name="weekday" defaultValue={String(row.weekday)} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
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
                              <input name="period_index" type="number" min={1} max={6} defaultValue={row.period_index ?? 1} required className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                            </label>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Início</span>
                                <input name="starts_at" type="time" defaultValue={row.starts_at} required className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Fim</span>
                                <input name="ends_at" type="time" defaultValue={row.ends_at} required className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                              </label>
                            </div>

                            <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                              Atualizar
                            </button>
                          </form>
                        </details>

                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmButton confirmText="Tem certeza que deseja excluir?" type="submit" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900">
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
