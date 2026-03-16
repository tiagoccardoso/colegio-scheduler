import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { validateRoomCatalog } from "@/lib/novo-ensino-medio";

type Row = {
  id: string;
  name: string | null;
  room_type: string | null;
  room_number?: number | null;
  display_order?: number | null;
  capacity?: number | null;
  building_block?: string | null;
  supports_digital_education?: boolean | null;
  supports_professional_training?: boolean | null;
  is_accessible?: boolean | null;
  notes?: string | null;
};

function parseCheckbox(value: FormDataEntryValue | null) { return String(value ?? "") === "on"; }

function RoomFields({ row }: { row?: Partial<Row> | null }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Nome *</span><input name="name" type="text" defaultValue={row?.name ?? ""} required className="input" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Tipo *</span><input name="room_type" type="text" defaultValue={row?.room_type ?? ""} className="input" placeholder="Ex.: Sala regular, laboratório" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Bloco/andar</span><input name="building_block" type="text" defaultValue={row?.building_block ?? ""} className="input" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2"><span className="text-sm font-semibold">Número</span><input name="room_number" type="number" defaultValue={row?.room_number ?? ""} className="input" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Ordem</span><input name="display_order" type="number" defaultValue={row?.display_order ?? ""} className="input" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Capacidade *</span><input name="capacity" type="number" min={1} max={300} defaultValue={row?.capacity ?? ""} className="input" /></label>
      </div>
      <label className="grid gap-2"><span className="text-sm font-semibold">Observações</span><textarea name="notes" defaultValue={row?.notes ?? ""} rows={3} className="input min-h-[100px]" /></label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="supports_digital_education" type="checkbox" defaultChecked={!!row?.supports_digital_education} className="h-4 w-4" /> Suporta educação digital</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="supports_professional_training" type="checkbox" defaultChecked={!!row?.supports_professional_training} className="h-4 w-4" /> Suporta formação técnica</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="is_accessible" type="checkbox" defaultChecked={!!row?.is_accessible} className="h-4 w-4" /> Sala acessível</label>
      </div>
    </>
  );
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};
  const qRaw = typeof sp.q === "string" ? sp.q : "";
  const q = qRaw.trim().replace(/,/g, " ");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
  const like = `%${q}%`;
  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  let roomsQuery = supabase.from("rooms").select("id,name,room_type,room_number,display_order,capacity,building_block,supports_digital_education,supports_professional_training,is_accessible,notes").eq("school_id", profile.school_id);
  if (q) roomsQuery = roomsQuery.or(isUuid ? `id.eq.${q},name.ilike.${like},room_type.ilike.${like}` : `name.ilike.${like},room_type.ilike.${like},building_block.ilike.${like}`);
  const { data: rows, error: loadError } = await roomsQuery.order("display_order", { ascending: true, nullsFirst: false }).order("room_number", { ascending: true, nullsFirst: false }).order("name", { ascending: true });

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      room_type: String(formData.get("room_type") || "").trim() || null,
      room_number: formData.get("room_number") ? Number(formData.get("room_number")) : null,
      display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
      building_block: String(formData.get("building_block") || "").trim() || null,
      supports_digital_education: parseCheckbox(formData.get("supports_digital_education")),
      supports_professional_training: parseCheckbox(formData.get("supports_professional_training")),
      is_accessible: parseCheckbox(formData.get("is_accessible")),
      notes: String(formData.get("notes") || "").trim() || null,
    };
    if (!payload.name) redirect("/rooms?error=" + encodeMsg("Preencha o campo Nome."));
    const { error } = await supabase.from("rooms").insert(payload);
    if (error) redirect("/rooms?error=" + encodeMsg(error.message));
    revalidatePath("/rooms");
    redirect("/rooms?msg=" + encodeMsg("Sala criada."));
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
      capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
      building_block: String(formData.get("building_block") || "").trim() || null,
      supports_digital_education: parseCheckbox(formData.get("supports_digital_education")),
      supports_professional_training: parseCheckbox(formData.get("supports_professional_training")),
      is_accessible: parseCheckbox(formData.get("is_accessible")),
      notes: String(formData.get("notes") || "").trim() || null,
    };
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

  const rowsTyped = (rows as Row[] | null) ?? [];

  return (
    <Shell title="Salas" subtitle="No NEM, sala não é só nome e número: laboratório, capacidade e acessibilidade fazem diferença no mundo real.">
      <div className="grid gap-4">
        <Flash message={error || msg || loadError?.message || null} variant={error ? "error" : msg ? "success" : "info"} />
        <div className="panel p-5">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar sala</summary>
            <form action={createAction} className="mt-4 grid max-w-4xl gap-4">
              <RoomFields />
              <button type="submit" className="btn btn-primary w-fit">Salvar</button>
            </form>
          </details>
        </div>
        <div className="table-wrap">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <form action="/rooms" method="GET" className="flex w-full max-w-md gap-2">
              <input name="q" type="text" placeholder="Pesquisar por nome, tipo ou bloco" defaultValue={q} className="input w-full" />
              <button type="submit" className="btn btn-secondary">Pesquisar</button>
              {q ? <a href="/rooms" className="btn btn-ghost">Limpar</a> : null}
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-th">Sala</th>
                  <th className="table-th">Infraestrutura</th>
                  <th className="table-th">Cadastro</th>
                  <th className="table-th">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rowsTyped.map((row) => {
                  const flags = validateRoomCatalog(row);
                  return (
                    <tr key={row.id} className="table-row align-top">
                      <td className="table-td">
                        <div className="grid gap-1">
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-xs text-zinc-500">{row.room_type || "Tipo não informado"}</div>
                          <div className="text-xs text-zinc-500">Bloco {row.building_block || "—"} • Capacidade {row.capacity || "—"}</div>
                        </div>
                      </td>
                      <td className="table-td text-sm">
                        <div className="grid gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                          <div>{row.supports_digital_education ? "Suporta educação digital" : "Sem marcação de educação digital"}</div>
                          <div>{row.supports_professional_training ? "Suporta formação técnica" : "Sem marcação técnica"}</div>
                          <div>{row.is_accessible ? "Acessível" : "Acessibilidade não validada"}</div>
                        </div>
                      </td>
                      <td className="table-td">{flags.length ? <div className="text-xs text-amber-700 dark:text-amber-300">{flags.slice(0, 3).join(" ")}</div> : <div className="text-xs text-emerald-700 dark:text-emerald-300">Cadastro de sala completo.</div>}</td>
                      <td className="table-td">
                        <div className="flex flex-wrap items-center gap-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                            <form action={updateAction} className="mt-3 grid w-[min(700px,92vw)] gap-4">
                              <input type="hidden" name="id" value={row.id} />
                              <RoomFields row={row} />
                              <button type="submit" className="btn btn-primary w-fit">Atualizar</button>
                            </form>
                          </details>
                          <form action={deleteAction}><input type="hidden" name="id" value={row.id} /><ConfirmButton confirmText="Tem certeza que deseja excluir?" type="submit" className="btn btn-danger">Excluir</ConfirmButton></form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rowsTyped.length === 0 ? <tr className="table-row"><td colSpan={4} className="table-td text-zinc-500">Nenhuma sala cadastrada.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
