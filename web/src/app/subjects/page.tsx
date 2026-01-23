import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";

type Row = {
  id: string;
  name: string | null;
  short_name?: string | null;
  display_order?: number | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("subjects")
    .select("id, name, short_name, display_order")
    .eq("school_id", profile.school_id)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      short_name: String(formData.get("short_name") || "").trim() || null,
      display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    };

    if (!payload.name) redirect("/subjects?error=" + encodeMsg("Preencha o campo Nome."));

    const { error } = await supabase.from("subjects").insert(payload);
    if (error) redirect("/subjects?error=" + encodeMsg(error.message));

    revalidatePath("/subjects");
    redirect("/subjects?msg=" + encodeMsg("Disciplina criada com sucesso."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/subjects?error=" + encodeMsg("ID inválido."));

    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
      short_name: String(formData.get("short_name") || "").trim() || null,
      display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    };

    if (!payload.name) redirect("/subjects?error=" + encodeMsg("Preencha o campo Nome."));

    const { error } = await supabase.from("subjects").update(payload).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/subjects?error=" + encodeMsg(error.message));

    revalidatePath("/subjects");
    redirect("/subjects?msg=" + encodeMsg("Disciplina atualizada."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/subjects?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("subjects").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/subjects?error=" + encodeMsg(error.message));

    revalidatePath("/subjects");
    redirect("/subjects?msg=" + encodeMsg("Disciplina removida."));
  }

  const rowsTyped = (rows as Row[] | null) ?? [];

  return (
    <Shell title="Disciplinas">
      <div className="grid gap-4">
        <Flash
          message={error || msg || (loadError ? loadError.message : null)}
          variant={error ? "error" : msg ? "success" : "info"}
        />

        <div className="panel p-5">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar</summary>
            <form action={createAction} className="mt-4 grid max-w-xl gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Nome</span>
                <input name="name" type="text" required className="input" />
              </label>

              <button type="submit" className="btn btn-primary w-fit">
                Salvar
              </button>
            </form>
          </details>
        </div>

        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-th">Nome</th>
                  <th className="table-th">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rowsTyped.map((row) => (
                  <tr key={row.id} className="table-row">
                    <td className="table-td">{row.name ?? ""}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap items-center gap-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                          <form action={updateAction} className="mt-3 grid w-[340px] gap-3">
                            <input type="hidden" name="id" value={row.id} />
                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Nome</span>
                              <input name="name" type="text" defaultValue={row.name ?? ""} required className="input" />
                            </label>
                            <button type="submit" className="btn btn-primary w-fit">
                              Atualizar
                            </button>
                          </form>
                        </details>

                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <ConfirmButton confirmText="Tem certeza que deseja excluir?" type="submit" className="btn btn-danger">
                            Excluir
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}

                {rowsTyped.length === 0 ? (
                  <tr className="table-row">
                    <td colSpan={2} className="table-td text-zinc-600 dark:text-zinc-400">
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
