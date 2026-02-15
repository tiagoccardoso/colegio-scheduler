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
  room_type: string | null;
  room_number?: number | null;
  display_order?: number | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const qRaw = typeof sp.q === "string" ? sp.q : "";
  const q = qRaw.trim().replace(/,/g, " ");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
  const like = `%${q}%`;

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  let roomsQuery = supabase
    .from("rooms")
    .select("id, name, room_type, room_number, display_order")
    .eq("school_id", profile.school_id);

  if (q) {
    roomsQuery = roomsQuery.or(isUuid ? `id.eq.${q},name.ilike.${like},room_type.ilike.${like}` : `name.ilike.${like},room_type.ilike.${like}`);
  }

  const { data: rows, error: loadError } = await roomsQuery
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("room_number", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      room_type: String(formData.get("room_type") || "").trim() || null,
      room_number: formData.get("room_number") ? Number(formData.get("room_number")) : null,
      display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    };

    if (!payload.name) redirect("/rooms?error=" + encodeMsg("Preencha o campo Nome."));

    const { error } = await supabase.from("rooms").insert(payload);
    if (error) redirect("/rooms?error=" + encodeMsg(error.message));

    revalidatePath("/rooms");
    redirect("/rooms?msg=" + encodeMsg("Sala criada com sucesso."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/rooms?error=" + encodeMsg("ID inválido."));

    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
      room_type: String(formData.get("room_type") || "").trim() || null,
      room_number: formData.get("room_number") ? Number(formData.get("room_number")) : null,
      display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    };

    if (!payload.name) redirect("/rooms?error=" + encodeMsg("Preencha o campo Nome."));

    const { error } = await supabase.from("rooms").update(payload).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/rooms?error=" + encodeMsg(error.message));

    revalidatePath("/rooms");
    redirect("/rooms?msg=" + encodeMsg("Sala atualizada."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/rooms?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("rooms").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/rooms?error=" + encodeMsg(error.message));

    revalidatePath("/rooms");
    redirect("/rooms?msg=" + encodeMsg("Sala removida."));
  }

  async function deleteAllAction() {
    "use server";
    const { supabase, profile } = await requireStaff();

    const { error } = await supabase.from("rooms").delete().eq("school_id", profile.school_id);
    if (error) redirect("/rooms?error=" + encodeMsg(error.message));

    revalidatePath("/rooms");
    redirect("/rooms?msg=" + encodeMsg("Todas as salas foram removidas."));
  }

  const rowsTyped = (rows as Row[] | null) ?? [];

  return (
    <Shell title="Salas">
      <div className="grid gap-4">
        <Flash
          message={error || msg || (loadError ? loadError.message : null)}
          variant={error ? "error" : msg ? "success" : "info"}
        />

        <div className="panel p-5">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar</summary>
            <form action={createAction} className="mt-4 grid max-w-xl gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Nome</span>
                  <input name="name" type="text" required className="input" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Tipo</span>
                  <input name="room_type" type="text" className="input" />
                </label>
              </div>

              <button type="submit" className="btn btn-primary w-fit">
                Salvar
              </button>
            </form>
          </details>
        </div>

        <div className="table-wrap">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <form action="/rooms" method="GET" className="flex w-full max-w-md gap-2">
              <input
                name="q"
                type="text"
                placeholder="Pesquisar por nome, tipo (ou ID)"
                defaultValue={q}
                className="input w-full"
              />
              <button type="submit" className="btn btn-secondary">
                Pesquisar
              </button>
              {q ? (
                <a href="/rooms" className="btn btn-ghost">
                  Limpar
                </a>
              ) : null}
            </form>

            <form action={deleteAllAction}>
              <ConfirmButton
                confirmText="Tem certeza que deseja excluir TODOS os registros?"
                type="submit"
                className="btn btn-danger"
              >
                Excluir todos
              </ConfirmButton>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-th">Nome</th>
                  <th className="table-th">Tipo</th>
                  <th className="table-th">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rowsTyped.map((row) => (
                  <tr key={row.id} className="table-row">
                    <td className="table-td">{row.name ?? ""}</td>
                    <td className="table-td">{row.room_type ?? ""}</td>
                    <td className="table-td">
                      <div className="flex flex-wrap items-center gap-2">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                          <form action={updateAction} className="mt-3 grid w-[360px] gap-3">
                            <input type="hidden" name="id" value={row.id} />

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Nome</span>
                              <input name="name" type="text" defaultValue={row.name ?? ""} required className="input" />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Tipo</span>
                              <input name="room_type" type="text" defaultValue={row.room_type ?? ""} className="input" />
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
                    <td colSpan={3} className="table-td text-zinc-600 dark:text-zinc-400">
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
