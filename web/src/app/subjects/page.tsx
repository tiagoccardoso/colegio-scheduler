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
};

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { supabase } = await requireDirector();

  const msg = typeof searchParams?.msg === "string" ? decodeMsg(searchParams?.msg) : null;
  const error = typeof searchParams?.error === "string" ? decodeMsg(searchParams?.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("subjects")
    .select("id, name")
    .order("created_at", { ascending: false });

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
    };

    if (!payload["name"]) {
      redirect("/subjects?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const { error } = await supabase.from("subjects").insert(payload);
    if (error) redirect("/subjects?error=" + encodeMsg(error.message));

    revalidatePath("/subjects");
    redirect("/subjects?msg=" + encodeMsg("Disciplina criada com sucesso."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/subjects?error=" + encodeMsg("ID inválido."));

    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
    };

    if (!payload["name"]) {
      redirect("/subjects?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const { error } = await supabase.from("subjects").update(payload).eq("id", id);
    if (error) redirect("/subjects?error=" + encodeMsg(error.message));

    revalidatePath("/subjects");
    redirect("/subjects?msg=" + encodeMsg("Disciplina atualizada."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase } = await requireDirector();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/subjects?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) redirect("/subjects?error=" + encodeMsg(error.message));

    revalidatePath("/subjects");
    redirect("/subjects?msg=" + encodeMsg("Disciplina removida."));
  }

  return (
    <Shell title="Disciplinas">
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {(rows as Row[] | null)?.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.name ?? ""}</td>
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
                    <td colSpan={2} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
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
