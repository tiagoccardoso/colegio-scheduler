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
  shift: string | null;
  level?: string | null;
  stage?: string | null;
  default_room_id?: string | null;
  display_order?: number | null;
};

const SHIFT_OPTIONS: { key: string; label: string }[] = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};


  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("classes")
    .select("id, name, shift, level, stage, default_room_id, display_order")
    .eq("school_id", profile.school_id)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const rawShift = String(formData.get("shift") || "").trim().toUpperCase();
    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      shift: SHIFT_OPTIONS.some((s) => s.key === rawShift) ? rawShift : null,
    };

    if (!payload["name"]) {
      redirect("/classes?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const { error } = await supabase.from("classes").insert(payload);
    if (error) redirect("/classes?error=" + encodeMsg(error.message));

    revalidatePath("/classes");
    redirect("/classes?msg=" + encodeMsg("Turmas criada com sucesso."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/classes?error=" + encodeMsg("ID inválido."));

    const rawShift = String(formData.get("shift") || "").trim().toUpperCase();
    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
      shift: String(formData.get("shift") || "").trim() || null,
      level: String(formData.get("level") || "").trim() || null,
      stage: String(formData.get("stage") || "").trim() || null,
      default_room_id: String(formData.get("default_room_id") || "").trim() || null,
      display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    };

    if (!payload["name"]) {
      redirect("/classes?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const { error } = await supabase.from("classes").update(payload).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/classes?error=" + encodeMsg(error.message));

    revalidatePath("/classes");
    redirect("/classes?msg=" + encodeMsg("Turmas atualizada."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/classes?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("classes").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/classes?error=" + encodeMsg(error.message));

    revalidatePath("/classes");
    redirect("/classes?msg=" + encodeMsg("Turmas removida."));
  }

  return (
    <Shell title="Turmas">
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
                <span className="text-sm font-semibold">Turno</span>
                <select
                  name="shift"
                  defaultValue=""
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  <option value="">—</option>
                  {SHIFT_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
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
<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {(rows as Row[] | null)?.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.name ?? ""}</td>
<td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.shift ?? ""}</td>
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
                              <span className="text-sm font-semibold">Turno</span>
                              <select
                                name="shift"
                                defaultValue={(row.shift ?? "").toUpperCase()}
                                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                              >
                                <option value="">—</option>
                                {SHIFT_OPTIONS.map((s) => (
                                  <option key={s.key} value={s.key}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
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
                            className="btn btn-danger"
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
                    <td colSpan={3} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
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
