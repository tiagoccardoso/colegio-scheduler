import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  subject_ids: string[] | null;
  class_ids: string[] | null;
  room_ids: string[] | null;
  restrictions: string | null;
  available_weekdays: number[] | null;
};

type RefRow = { id: string; name: string | null };

const WEEKDAYS: { key: number; label: string }[] = [
  { key: 1, label: "Segunda" },
  { key: 2, label: "Terça" },
  { key: 3, label: "Quarta" },
  { key: 4, label: "Quinta" },
  { key: 5, label: "Sexta" },
  { key: 6, label: "Sábado" },
  { key: 7, label: "Domingo" },
];

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { supabase } = await requireDirector();

  const msg = typeof searchParams?.msg === "string" ? decodeMsg(searchParams?.msg) : null;
  const error = typeof searchParams?.error === "string" ? decodeMsg(searchParams?.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("teachers")
    .select("id, name, email, subject_ids, class_ids, room_ids, restrictions, available_weekdays")
    .order("created_at", { ascending: false });

  const { data: subjects } = await supabase.from("subjects").select("id, name").order("name", { ascending: true });
  const { data: classes } = await supabase.from("classes").select("id, name").order("name", { ascending: true });
  const { data: rooms } = await supabase.from("rooms").select("id, name").order("name", { ascending: true });

  const subjectById = new Map(((subjects as RefRow[] | null) ?? []).map((s) => [s.id, s.name ?? ""]));
  const classById = new Map(((classes as RefRow[] | null) ?? []).map((c) => [c.id, c.name ?? ""]));
  const roomById = new Map(((rooms as RefRow[] | null) ?? []).map((r) => [r.id, r.name ?? ""]));

  function labelList(ids: string[] | null | undefined, dict: Map<string, string>) {
    const arr = (ids ?? []).map((id) => dict.get(id) || id).filter(Boolean);
    return arr.length ? arr.join(", ") : "—";
  }

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const available_weekdays = (formData.getAll("available_weekdays") as any[])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);

    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      subject_ids: (formData.getAll("subject_ids") as string[]).map(String).filter(Boolean),
      class_ids: (formData.getAll("class_ids") as string[]).map(String).filter(Boolean),
      room_ids: (formData.getAll("room_ids") as string[]).map(String).filter(Boolean),
      restrictions: String(formData.get("restrictions") || "").trim() || null,
      // Se o usuário não marcou nada, assume Seg–Sex (padrão mais comum).
      available_weekdays: available_weekdays.length ? available_weekdays : [1, 2, 3, 4, 5],
    };

    if (!payload["name"]) {
      redirect("/teachers?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const { error } = await supabase.from("teachers").insert(payload);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));

    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Professores criada com sucesso."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/teachers?error=" + encodeMsg("ID inválido."));

    const available_weekdays = (formData.getAll("available_weekdays") as any[])
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);

    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      subject_ids: (formData.getAll("subject_ids") as string[]).map(String).filter(Boolean),
      class_ids: (formData.getAll("class_ids") as string[]).map(String).filter(Boolean),
      room_ids: (formData.getAll("room_ids") as string[]).map(String).filter(Boolean),
      restrictions: String(formData.get("restrictions") || "").trim() || null,
      // Mantém o mesmo padrão do create.
      available_weekdays: available_weekdays.length ? available_weekdays : [1, 2, 3, 4, 5],
    };

    if (!payload["name"]) {
      redirect("/teachers?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const { error } = await supabase.from("teachers").update(payload).eq("id", id);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));

    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Professores atualizada."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/teachers?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("teachers").delete().eq("id", id);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));

    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Professores removida."));
  }

  return (
    <Shell title="Professores">
      <div className="grid gap-4">
        <Flash
          message={error || msg || (loadError ? loadError.message : null)}
          variant={error ? "error" : msg ? "success" : "info"}
        />

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar</summary>
            <form action={createAction} className="mt-4 grid max-w-xl gap-4">
              <label className="grid gap-2">
  <span className="text-sm font-semibold">Nome</span>
  <input
    name="name"
    type="text"

    required
    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
  />
</label>
<label className="grid gap-2">
  <span className="text-sm font-semibold">E-mail</span>
  <input
    name="email"
    type="email"


    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
  />
</label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Disciplinas</span>
                <select
                  name="subject_ids"
                  multiple
                  className="min-h-[120px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  {((subjects as RefRow[] | null) ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500">Segure Ctrl/⌘ para selecionar mais de uma.</span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Turmas</span>
                <select
                  name="class_ids"
                  multiple
                  className="min-h-[120px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  {((classes as RefRow[] | null) ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500">Deixe vazio para permitir todas.</span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Salas</span>
                <select
                  name="room_ids"
                  multiple
                  className="min-h-[120px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  {((rooms as RefRow[] | null) ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-500">Deixe vazio para permitir todas.</span>
              </label>

              <fieldset className="grid gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <legend className="px-2 text-sm font-semibold">Dias disponíveis</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {WEEKDAYS.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="available_weekdays"
                        value={String(d.key)}
                        className="h-4 w-4"
                      />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
                <span className="text-xs text-zinc-500">Se nada for marcado, considere marcar pelo menos Seg–Sex.</span>
              </fieldset>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Restrições (opcional)</span>
                <textarea
                  name="restrictions"
                  rows={3}
                  placeholder="Ex.: não pode 1ª aula; prefere manhã; evitar 6ª feira..."
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
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
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nome</th>
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">E-mail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Disciplinas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turmas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Dias</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {(rows as Row[] | null)?.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.name ?? ""}</td>
<td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.email ?? ""}</td>
                    <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{labelList(row.subject_ids, subjectById)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{labelList(row.class_ids, classById)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{labelList(row.room_ids, roomById)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                      {((row.available_weekdays ?? []) as number[]).length
                        ? (row.available_weekdays ?? [])
                            .map((k) => WEEKDAYS.find((d) => d.key === k)?.label)
                            .filter(Boolean)
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                          <form action={updateAction} className="mt-3 grid w-[340px] gap-3">
                            <input type="hidden" name="id" value={row.id} />
                            <label className="grid gap-2">
  <span className="text-sm font-semibold">Nome</span>
  <input
    name="name"
    type="text"
    defaultValue={row.name ?? ""}
    required
    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
  />
</label>
<label className="grid gap-2">
  <span className="text-sm font-semibold">E-mail</span>
  <input
    name="email"
    type="email"
    defaultValue={row.email ?? ""}

    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
  />
</label>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Disciplinas</span>
                              <select
                                name="subject_ids"
                                multiple
                                defaultValue={(row.subject_ids ?? []) as any}
                                className="min-h-[120px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                              >
                                {((subjects as RefRow[] | null) ?? []).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Turmas</span>
                              <select
                                name="class_ids"
                                multiple
                                defaultValue={(row.class_ids ?? []) as any}
                                className="min-h-[120px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                              >
                                {((classes as RefRow[] | null) ?? []).map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Salas</span>
                              <select
                                name="room_ids"
                                multiple
                                defaultValue={(row.room_ids ?? []) as any}
                                className="min-h-[120px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                              >
                                {((rooms as RefRow[] | null) ?? []).map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <fieldset className="grid gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                              <legend className="px-2 text-sm font-semibold">Dias disponíveis</legend>
                              <div className="grid grid-cols-1 gap-2">
                                {WEEKDAYS.map((d) => (
                                  <label key={d.key} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      name="available_weekdays"
                                      value={String(d.key)}
                                      defaultChecked={(row.available_weekdays ?? []).includes(d.key)}
                                      className="h-4 w-4"
                                    />
                                    <span>{d.label}</span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Restrições (opcional)</span>
                              <textarea
                                name="restrictions"
                                rows={3}
                                defaultValue={row.restrictions ?? ""}
                                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                              />
                            </label>
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
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            Excluir
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}

                {(rows?.length ?? 0) === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={7} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                      Nenhum registro encontrado.
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
