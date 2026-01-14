import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";

type TeacherRow = {
  id: string;
  name: string | null;
};

type TimeSlotRow = {
  id: string;
  weekday: number;
  shift: string | null;
  period_index: number | null;
  starts_at: string;
  ends_at: string;
};

type HaScheduleRow = {
  id: string;
  teacher_id: string;
  time_slot_id: string;
  notes: string | null;
  activity_type: string | null;
  teacher: { id: string; name: string | null } | null;
  time_slot: {
    id: string;
    weekday: number;
    shift: string | null;
    period_index: number | null;
    starts_at: string;
    ends_at: string;
  } | null;
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

function shiftLabel(shift: string | null | undefined) {
  const k = String(shift || "").trim().toUpperCase();
  return SHIFT_OPTIONS.find((s) => s.key === k)?.label ?? (k || "—");
}

function timeSlotLabel(ts: TimeSlotRow) {
  const shift = shiftLabel(ts.shift);
  const day = WEEKDAYS[ts.weekday] ?? String(ts.weekday);
  const p = ts.period_index ? `${ts.period_index}º` : "—";
  const hhmm = ts.starts_at && ts.ends_at ? `${ts.starts_at}–${ts.ends_at}` : "";
  return `${shift} · ${day} · ${p}${hhmm ? ` · ${hhmm}` : ""}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("id,weekday,shift,period_index,starts_at,ends_at")
    .eq("school_id", profile.school_id)
    .order("shift", { ascending: true })
    .order("weekday", { ascending: true })
    .order("period_index", { ascending: true })
    .order("starts_at", { ascending: true });

  // Tenta carregar HA; se a coluna activity_type não existir, orienta a rodar a migração.
  const haRes = await supabase
    .from("schedules")
    .select(
      "id,teacher_id,time_slot_id,notes,activity_type,teacher:teachers(id,name),time_slot:time_slots(id,weekday,shift,period_index,starts_at,ends_at)",
    )
    .eq("school_id", profile.school_id);

  const loadError = haRes.error
    ? haRes.error.message || "Falha ao carregar Hora Atividade."
    : null;

  const rowsAll = ((haRes.data as any[]) ?? []) as HaScheduleRow[];
  const rows = rowsAll
    .filter((r) => String(r.activity_type || "").toUpperCase() === "HA")
    .sort((a, b) => {
      const tsa = a.time_slot;
      const tsb = b.time_slot;
      const sa = String(tsa?.shift || "").localeCompare(String(tsb?.shift || ""));
      if (sa !== 0) return sa;
      const ta = String(a.teacher?.name || "").localeCompare(String(b.teacher?.name || ""));
      if (ta !== 0) return ta;
      const da = Number(tsa?.weekday ?? 0) - Number(tsb?.weekday ?? 0);
      if (da !== 0) return da;
      return Number(tsa?.period_index ?? 0) - Number(tsb?.period_index ?? 0);
    });

  const teachersTyped = (teachers as TeacherRow[] | null) ?? [];
  const timeSlotsTyped = (timeSlots as TimeSlotRow[] | null) ?? [];

  async function updateHaAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const id = String(formData.get("id") || "");
    const teacherId = String(formData.get("teacher_id") || "");
    const timeSlotId = String(formData.get("time_slot_id") || "");
    const notesRaw = String(formData.get("notes") || "").trim();
    const notes = notesRaw ? notesRaw : null;

    if (!id) redirect("/time-slots/listagem?error=" + encodeMsg("ID inválido."));
    if (!teacherId) redirect("/time-slots/listagem?error=" + encodeMsg("Selecione um professor."));
    if (!timeSlotId) redirect("/time-slots/listagem?error=" + encodeMsg("Selecione um horário."));

    const { data: current, error: curErr } = await supabase
      .from("schedules")
      .select("id,activity_type")
      .eq("school_id", profile.school_id)
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      redirect(
        "/time-slots/listagem?error=" +
          encodeMsg(
            curErr.message ||
              "Falha ao carregar registro. Verifique se a coluna activity_type existe no banco.",
          ),
      );
    }

    if (String((current as any)?.activity_type || "").toUpperCase() !== "HA") {
      redirect("/time-slots/listagem?error=" + encodeMsg("Este registro não é Hora Atividade."));
    }

    // Evita conflito: o professor já pode estar ocupado neste slot (AULA ou HA).
    const { data: conflict } = await supabase
      .from("schedules")
      .select("id")
      .eq("school_id", profile.school_id)
      .eq("teacher_id", teacherId)
      .eq("time_slot_id", timeSlotId)
      .neq("id", id)
      .limit(1);

    if (((conflict as any[]) ?? []).length) {
      redirect(
        "/time-slots/listagem?error=" +
          encodeMsg("Conflito: este professor já está ocupado neste horário."),
      );
    }

    const { error } = await supabase
      .from("schedules")
      .update({ teacher_id: teacherId, time_slot_id: timeSlotId, notes })
      .eq("school_id", profile.school_id)
      .eq("id", id);

    if (error) {
      redirect("/time-slots/listagem?error=" + encodeMsg(error.message || "Falha ao atualizar."));
    }

    revalidatePath("/time-slots");
    revalidatePath("/time-slots/listagem");
    revalidatePath("/schedule");
    revalidatePath("/weekly-grade");
    redirect("/time-slots/listagem?msg=" + encodeMsg("Hora Atividade atualizada."));
  }

  async function deleteHaAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/time-slots/listagem?error=" + encodeMsg("ID inválido."));

    // Confere que é HA.
    const { data: current, error: curErr } = await supabase
      .from("schedules")
      .select("id,activity_type")
      .eq("school_id", profile.school_id)
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      redirect(
        "/time-slots/listagem?error=" +
          encodeMsg(curErr.message || "Falha ao carregar registro."),
      );
    }

    if (String((current as any)?.activity_type || "").toUpperCase() !== "HA") {
      redirect("/time-slots/listagem?error=" + encodeMsg("Este registro não é Hora Atividade."));
    }

    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("school_id", profile.school_id)
      .eq("id", id);

    if (error) {
      redirect("/time-slots/listagem?error=" + encodeMsg(error.message || "Falha ao excluir."));
    }

    revalidatePath("/time-slots");
    revalidatePath("/time-slots/listagem");
    revalidatePath("/schedule");
    revalidatePath("/weekly-grade");
    redirect("/time-slots/listagem?msg=" + encodeMsg("Hora Atividade excluída."));
  }

  return (
    <Shell title="Listagem de Hora Atividade" subtitle="Altere ou exclua as HAs já cadastradas.">
      <div className="grid gap-4">
        <Flash
          message={error || msg || loadError}
          variant={error ? "error" : msg ? "success" : loadError ? "error" : "info"}
        />

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/time-slots"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Voltar para Horários
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Professor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dia</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Período</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Horário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Obs.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ts = r.time_slot;
                  return (
                    <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-900">
                      <td className="px-4 py-3 text-sm">{r.teacher?.name || "(sem nome)"}</td>
                      <td className="px-4 py-3 text-sm">{shiftLabel(ts?.shift)}</td>
                      <td className="px-4 py-3 text-sm">{WEEKDAYS[Number(ts?.weekday ?? 0)] ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{ts?.period_index ? `${ts.period_index}º` : "—"}</td>
                      <td className="px-4 py-3 text-sm">
                        {ts?.starts_at && ts?.ends_at ? `${ts.starts_at}–${ts.ends_at}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">{r.notes || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Alterar</summary>
                            <form action={updateHaAction} className="mt-3 grid w-[520px] gap-3">
                              <input type="hidden" name="id" value={r.id} />

                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Professor</span>
                                <select
                                  name="teacher_id"
                                  defaultValue={r.teacher_id}
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
                                <span className="text-sm font-semibold">Horário</span>
                                <select
                                  name="time_slot_id"
                                  defaultValue={r.time_slot_id}
                                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                                >
                                  <option value="">Selecione…</option>
                                  {timeSlotsTyped.map((ts) => (
                                    <option key={ts.id} value={ts.id}>
                                      {timeSlotLabel(ts)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Observações</span>
                                <textarea
                                  name="notes"
                                  rows={3}
                                  defaultValue={r.notes ?? ""}
                                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                                />
                              </label>

                              <button
                                type="submit"
                                className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                              >
                                Salvar
                              </button>
                            </form>
                          </details>

                          <form action={deleteHaAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <ConfirmButton
                              confirmText="Tem certeza que deseja excluir esta Hora Atividade?"
                              type="submit"
                              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                              Excluir
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={7} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                      Nenhuma Hora Atividade cadastrada.
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
