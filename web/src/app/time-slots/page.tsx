import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";

type TimeSlot = { id: string; weekday: number; starts_at: string; ends_at: string };

const WEEKDAYS: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { supabase } = await requireDirector();

  const msg = typeof searchParams?.msg === "string" ? decodeMsg(searchParams?.msg) : null;
  const error = typeof searchParams?.error === "string" ? decodeMsg(searchParams?.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("time_slots")
    .select("id, weekday, starts_at, ends_at")
    .order("weekday", { ascending: true })
    .order("starts_at", { ascending: true });

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const weekday = Number(formData.get("weekday"));
    const starts_at = String(formData.get("starts_at") || "").trim();
    const ends_at = String(formData.get("ends_at") || "").trim();

    if (!(weekday >= 1 && weekday <= 7)) redirect("/time-slots?error=" + encodeMsg("Dia da semana inválido."));
    if (!starts_at || !ends_at) redirect("/time-slots?error=" + encodeMsg("Preencha início e fim."));

    const { error } = await supabase.from("time_slots").insert({
      school_id: profile.school_id,
      weekday,
      starts_at,
      ends_at,
    });

    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário criado."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase } = await requireDirector();

    const id = String(formData.get("id") || "");
    const weekday = Number(formData.get("weekday"));
    const starts_at = String(formData.get("starts_at") || "").trim();
    const ends_at = String(formData.get("ends_at") || "").trim();

    if (!id) redirect("/time-slots?error=" + encodeMsg("ID inválido."));
    if (!(weekday >= 1 && weekday <= 7)) redirect("/time-slots?error=" + encodeMsg("Dia da semana inválido."));
    if (!starts_at || !ends_at) redirect("/time-slots?error=" + encodeMsg("Preencha início e fim."));

    const { error } = await supabase.from("time_slots").update({ weekday, starts_at, ends_at }).eq("id", id);
    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário atualizado."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/time-slots?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("time_slots").delete().eq("id", id);
    if (error) redirect("/time-slots?error=" + encodeMsg(error.message));

    revalidatePath("/time-slots");
    redirect("/time-slots?msg=" + encodeMsg("Horário removido."));
  }

  return (
    <Shell title="Horários">
      <div className="grid gap-4">
        <Flash message={error || msg || (loadError ? loadError.message : null)} variant={error ? "error" : msg ? "success" : "info"} />

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar horário</summary>
            <form action={createAction} className="mt-4 grid max-w-xl gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Dia da semana</span>
                <select name="weekday" defaultValue="1" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                  {Object.entries(WEEKDAYS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Início</span>
                  <input name="starts_at" type="time" required className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Fim</span>
                  <input name="ends_at" type="time" required className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                </label>
              </div>

              <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                Salvar
              </button>
            </form>
          </details>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dia</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Início</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Fim</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(rows as TimeSlot[] | null)?.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-4 py-3 text-sm">{WEEKDAYS[row.weekday] ?? row.weekday}</td>
                    <td className="px-4 py-3 text-sm">{row.starts_at}</td>
                    <td className="px-4 py-3 text-sm">{row.ends_at}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                          <form action={updateAction} className="mt-3 grid w-[340px] gap-3">
                            <input type="hidden" name="id" value={row.id} />

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Dia</span>
                              <select name="weekday" defaultValue={String(row.weekday)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                                {Object.entries(WEEKDAYS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Início</span>
                                <input name="starts_at" type="time" defaultValue={row.starts_at} required className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
                              </label>
                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Fim</span>
                                <input name="ends_at" type="time" defaultValue={row.ends_at} required className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
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

                {(rows?.length ?? 0) === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={4} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">Nenhum horário cadastrado.</td>
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
