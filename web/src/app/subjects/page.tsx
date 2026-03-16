import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  NEM_COMPONENT_TYPE_OPTIONS,
  NEM_ITINERARY_AXIS_OPTIONS,
  NEM_KNOWLEDGE_AREA_OPTIONS,
  NEM_REQUIRED_COMPONENT_OPTIONS,
  PATCH_NEM_MESSAGE,
  isMissingColumnOrTableError,
  labelNemComponentType,
  labelNemItineraryAxis,
  labelNemKnowledgeArea,
  labelNemRequiredComponent,
  normalizeNemComponentType,
  normalizeNemItineraryAxis,
  normalizeNemKnowledgeArea,
  normalizeNemRequiredComponent,
  validateSubjectCatalog,
} from "@/lib/novo-ensino-medio";

type Row = {
  id: string;
  name: string | null;
  short_name?: string | null;
  display_order?: number | null;
  component_type?: string | null;
  knowledge_area?: string | null;
  nem_component_code?: string | null;
  is_digital_education?: boolean | null;
  is_project_of_life?: boolean | null;
  is_elective?: boolean | null;
  is_professional_training?: boolean | null;
  curriculum_notes?: string | null;
  annual_hours?: number | null;
  weekly_lessons_suggested?: number | null;
  itinerary_axis?: string | null;
  syllabus?: string | null;
  teacher_qualification_required?: string | null;
  is_mandatory?: boolean | null;
};

function parseCheckbox(value: FormDataEntryValue | null) {
  return String(value ?? "") === "on";
}

function getSubjectPayload(formData: FormData) {
  return {
    name: String(formData.get("name") || "").trim() || null,
    short_name: String(formData.get("short_name") || "").trim() || null,
    display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    component_type: normalizeNemComponentType(formData.get("component_type")),
    knowledge_area: normalizeNemKnowledgeArea(formData.get("knowledge_area")),
    nem_component_code: normalizeNemRequiredComponent(formData.get("nem_component_code")),
    is_digital_education: parseCheckbox(formData.get("is_digital_education")),
    is_project_of_life: parseCheckbox(formData.get("is_project_of_life")),
    is_elective: parseCheckbox(formData.get("is_elective")),
    is_professional_training: parseCheckbox(formData.get("is_professional_training")),
    curriculum_notes: String(formData.get("curriculum_notes") || "").trim() || null,
    annual_hours: formData.get("annual_hours") ? Number(formData.get("annual_hours")) : null,
    weekly_lessons_suggested: formData.get("weekly_lessons_suggested") ? Number(formData.get("weekly_lessons_suggested")) : null,
    itinerary_axis: normalizeNemItineraryAxis(formData.get("itinerary_axis")),
    syllabus: String(formData.get("syllabus") || "").trim() || null,
    teacher_qualification_required: String(formData.get("teacher_qualification_required") || "").trim() || null,
    is_mandatory: parseCheckbox(formData.get("is_mandatory")),
  };
}

function handleNemMutationError(error: any) {
  if (isMissingColumnOrTableError(error)) return PATCH_NEM_MESSAGE;
  return error?.message || "Não foi possível salvar o componente.";
}

function badgeClass(kind: "base" | "ok" | "warn") {
  if (kind === "ok") return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (kind === "warn") return "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300";
  return "inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200";
}

function SubjectFields({ row }: { row?: Partial<Row> | null }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Nome *</span>
          <input name="name" type="text" defaultValue={row?.name ?? ""} required className="input" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Nome curto</span>
          <input name="short_name" type="text" defaultValue={row?.short_name ?? ""} className="input" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Ordem</span>
          <input name="display_order" type="number" min={0} defaultValue={row?.display_order ?? ""} className="input" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Tipo curricular *</span>
          <select name="component_type" defaultValue={(row?.component_type ?? "").toUpperCase()} className="input h-10">
            <option value="">Selecione</option>
            {NEM_COMPONENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Área do conhecimento *</span>
          <select name="knowledge_area" defaultValue={(row?.knowledge_area ?? "").toUpperCase()} className="input h-10">
            <option value="">Selecione</option>
            {NEM_KNOWLEDGE_AREA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Componente obrigatório da FGB</span>
          <select name="nem_component_code" defaultValue={(row?.nem_component_code ?? "").toUpperCase()} className="input h-10">
            <option value="">Não se aplica</option>
            {NEM_REQUIRED_COMPONENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Eixo do itinerário</span>
          <select name="itinerary_axis" defaultValue={(row?.itinerary_axis ?? "").toUpperCase()} className="input h-10">
            <option value="">Não se aplica</option>
            {NEM_ITINERARY_AXIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Carga horária anual *</span>
          <input name="annual_hours" type="number" min={1} max={1200} defaultValue={row?.annual_hours ?? ""} className="input" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Aulas semanais sugeridas *</span>
          <input name="weekly_lessons_suggested" type="number" min={1} max={20} defaultValue={row?.weekly_lessons_suggested ?? ""} className="input" />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Habilitação docente requerida *</span>
          <input name="teacher_qualification_required" type="text" defaultValue={row?.teacher_qualification_required ?? ""} className="input" placeholder="Ex.: Licenciatura em Matemática" />
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold">Ementa / objetivos *</span>
        <textarea name="syllabus" defaultValue={row?.syllabus ?? ""} rows={4} className="input min-h-[120px]" />
      </label>
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Observações curriculares</span>
        <textarea name="curriculum_notes" defaultValue={row?.curriculum_notes ?? ""} rows={3} className="input min-h-[100px]" />
      </label>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="is_mandatory" type="checkbox" defaultChecked={!!row?.is_mandatory} className="h-4 w-4" /> Componente obrigatório</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="is_digital_education" type="checkbox" defaultChecked={!!row?.is_digital_education} className="h-4 w-4" /> Conta como educação digital</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="is_project_of_life" type="checkbox" defaultChecked={!!row?.is_project_of_life} className="h-4 w-4" /> Conta como Projeto de Vida</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="is_elective" type="checkbox" defaultChecked={!!row?.is_elective} className="h-4 w-4" /> Eletiva</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="is_professional_training" type="checkbox" defaultChecked={!!row?.is_professional_training} className="h-4 w-4" /> Formação técnica/profissional</label>
      </div>
    </>
  );
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
  const like = `%${q}%`;
  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  let query = supabase.from("subjects").select("id,name,short_name,display_order,component_type,knowledge_area,nem_component_code,is_digital_education,is_project_of_life,is_elective,is_professional_training,curriculum_notes,annual_hours,weekly_lessons_suggested,itinerary_axis,syllabus,teacher_qualification_required,is_mandatory").eq("school_id", profile.school_id);
  if (q) query = query.or(isUuid ? `id.eq.${q},name.ilike.${like},short_name.ilike.${like}` : `name.ilike.${like},short_name.ilike.${like},component_type.ilike.${like}`);
  const { data, error: loadError } = await query.order("display_order", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
  const rows = (data as Row[] | null) ?? [];
  const patchWarning = (!rows.length && isMissingColumnOrTableError(loadError)) ? PATCH_NEM_MESSAGE : null;

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const payload = { school_id: profile.school_id, ...getSubjectPayload(formData) };
    if (!payload.name) redirect("/subjects?error=" + encodeMsg("Preencha o nome do componente."));
    const { error } = await supabase.from("subjects").insert(payload);
    if (error) redirect("/subjects?error=" + encodeMsg(handleNemMutationError(error)));
    revalidatePath("/subjects");
    revalidatePath("/classes");
    revalidatePath("/director/novo-ensino-medio");
    redirect("/subjects?msg=" + encodeMsg("Componente salvo."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "");
    if (!id) redirect("/subjects?error=" + encodeMsg("ID inválido."));
    const { error } = await supabase.from("subjects").update(getSubjectPayload(formData)).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/subjects?error=" + encodeMsg(handleNemMutationError(error)));
    revalidatePath("/subjects");
    revalidatePath("/classes");
    revalidatePath("/director/novo-ensino-medio");
    redirect("/subjects?msg=" + encodeMsg("Componente atualizado."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "");
    if (!id) redirect("/subjects?error=" + encodeMsg("ID inválido."));
    const { error } = await supabase.from("subjects").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/subjects?error=" + encodeMsg(error.message));
    revalidatePath("/subjects");
    revalidatePath("/classes");
    revalidatePath("/director/novo-ensino-medio");
    redirect("/subjects?msg=" + encodeMsg("Componente removido."));
  }

  return (
    <Shell title="Componentes curriculares" subtitle="O cadastro agora guarda tipo, área, carga horária, eixo, ementa e habilitação docente. Sem isso, o NEM vira samba do campo solto.">
      <div className="grid gap-4">
        <Flash message={error || msg || patchWarning || loadError?.message || null} variant={error ? "error" : msg ? "success" : "info"} />

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar componente</summary>
            <form action={createAction} className="mt-4 grid gap-4 max-w-6xl">
              <SubjectFields />
              <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Salvar</button>
            </form>
          </details>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <form action="/subjects" method="GET" className="flex w-full max-w-md gap-2">
              <input name="q" type="text" defaultValue={q} placeholder="Pesquisar por nome ou tipo" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600" />
              <button type="submit" className="btn btn-secondary">Pesquisar</button>
              {q ? <a href="/subjects" className="btn btn-ghost">Limpar</a> : null}
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Componente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Classificação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Carga / Docência</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Cadastro</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const flags = validateSubjectCatalog(row);
                  return (
                    <tr key={row.id} className="border-t border-zinc-100 align-top dark:border-zinc-900">
                      <td className="px-4 py-3 text-sm">
                        <div className="grid gap-1">
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-xs text-zinc-500">{row.short_name || "Sem nome curto"}</div>
                          <div className="flex flex-wrap gap-2">
                            {row.is_mandatory ? <span className={badgeClass("ok")}>Obrigatório</span> : null}
                            {row.is_digital_education ? <span className={badgeClass("base")}>Educação digital</span> : null}
                            {row.is_project_of_life ? <span className={badgeClass("base")}>Projeto de Vida</span> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="grid gap-1">
                          <div>{labelNemComponentType(row.component_type)}</div>
                          <div className="text-xs text-zinc-500">{labelNemKnowledgeArea(row.knowledge_area)}</div>
                          <div className="text-xs text-zinc-500">{row.nem_component_code ? labelNemRequiredComponent(row.nem_component_code) : labelNemItineraryAxis(row.itinerary_axis)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="grid gap-1">
                          <div>{row.annual_hours ?? "—"}h anuais • {row.weekly_lessons_suggested ?? "—"} aula(s)/semana</div>
                          <div className="text-xs text-zinc-500">{row.teacher_qualification_required ?? "Habilitação não informada"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {flags.length ? <div className="text-xs text-amber-700 dark:text-amber-300">{flags.slice(0, 3).join(" ")}</div> : <div className="text-xs text-emerald-700 dark:text-emerald-300">Cadastro curricular completo.</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                            <form action={updateAction} className="mt-3 grid w-[min(960px,92vw)] gap-4">
                              <input type="hidden" name="id" value={row.id} />
                              <SubjectFields row={row} />
                              <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Atualizar</button>
                            </form>
                          </details>
                          <form action={deleteAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <ConfirmButton confirmText="Tem certeza que deseja excluir?" type="submit" className="btn btn-danger">Excluir</ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">Nenhum componente cadastrado.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
