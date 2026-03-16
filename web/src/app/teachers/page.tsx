import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { TeacherTeachingRulesEditor } from "@/components/TeacherTeachingRulesEditor";
import { deriveLegacyFieldsFromTeachingRules, parseTeachingRulesJson } from "@/lib/schedule/teaching-rules";
import {
  NEM_TEACHER_ACADEMIC_DEGREE_OPTIONS,
  labelTeacherAcademicDegree,
  normalizeTeacherAcademicDegree,
  validateTeacherCatalog,
} from "@/lib/novo-ensino-medio";

type Row = {
  id: string;
  name: string | null;
  short_name?: string | null;
  email: string | null;
  shifts: string[] | null;
  subject_id: string | null;
  default_room_id: string | null;
  class_ids: string[] | null;
  restrictions: string | null;
  availability: any | null;
  allow_interjornada_lt_11?: boolean | null;
  teaching_rules?: any | null;
  subject_ids: string[] | null;
  room_ids: string[] | null;
  available_weekdays: number[] | null;
  cpf?: string | null;
  academic_degree?: string | null;
  licensure_area?: string | null;
  additional_areas?: string[] | null;
  employee_code?: string | null;
  can_teach_nem?: boolean | null;
  can_teach_technical?: boolean | null;
  curriculum_lattes_url?: string | null;
  training_notes?: string | null;
};

type RefRow = { id: string; name: string | null; shift?: string | null };

const SHIFTS: { key: string; label: string }[] = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];
const ALL_SHIFT_KEYS = SHIFTS.map((item) => item.key);

function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }
function parseCheckbox(value: FormDataEntryValue | null) { return String(value ?? "") === "on"; }
function parseCsvArray(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  return raw.length ? uniq(raw) : [];
}

function normalizeTeacherScopeFromRules(derived: ReturnType<typeof deriveLegacyFieldsFromTeachingRules>, parsedRulesLength: number) {
  if (parsedRulesLength > 0) {
    return {
      shifts: derived.shifts,
      availability: derived.availability,
      available_weekdays: derived.available_weekdays,
      subject_id: derived.subject_id,
      default_room_id: derived.default_room_id,
      subject_ids: derived.subject_ids ?? [],
      room_ids: derived.room_ids ?? [],
      class_ids: derived.class_ids ?? [],
    };
  }
  return {
    shifts: ALL_SHIFT_KEYS,
    availability: null,
    available_weekdays: [1, 2, 3, 4, 5] as number[],
    subject_id: null,
    default_room_id: null,
    subject_ids: [] as string[],
    room_ids: [] as string[],
    class_ids: [] as string[],
  };
}

function labelList(ids: string[] | null | undefined, dict: Map<string, string>, emptyLabel = "—") {
  const arr = (ids ?? []).map((id) => dict.get(id) || id).filter(Boolean);
  return arr.length ? arr.join(", ") : emptyLabel;
}

function labelShiftList(shifts: string[] | null | undefined) {
  const normalized = (shifts ?? []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  if (normalized.length === 0 || ALL_SHIFT_KEYS.every((key) => normalized.includes(key))) return "Todos";
  const arr = normalized.map((s) => SHIFTS.find((x) => x.key === s)?.label ?? s).filter(Boolean);
  return arr.length ? uniq(arr).join(", ") : "Todos";
}

function TeacherFields({ row }: { row?: Partial<Row> | null }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Nome *</span><input name="name" type="text" defaultValue={row?.name ?? ""} required className="input" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Nome curto</span><input name="short_name" type="text" defaultValue={row?.short_name ?? ""} className="input" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Matrícula/registro interno</span><input name="employee_code" type="text" defaultValue={row?.employee_code ?? ""} className="input" /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2"><span className="text-sm font-semibold">CPF *</span><input name="cpf" type="text" defaultValue={row?.cpf ?? ""} className="input" /></label>
        <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">E-mail</span><input name="email" type="email" defaultValue={row?.email ?? ""} className="input" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Titulação principal *</span>
          <select name="academic_degree" defaultValue={(row?.academic_degree ?? "").toUpperCase()} className="input h-10">
            <option value="">Selecione</option>
            {NEM_TEACHER_ACADEMIC_DEGREE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2"><span className="text-sm font-semibold">Área principal de habilitação *</span><input name="licensure_area" type="text" defaultValue={row?.licensure_area ?? ""} className="input" placeholder="Ex.: Licenciatura em História" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Áreas adicionais (separadas por vírgula)</span><input name="additional_areas" type="text" defaultValue={(row?.additional_areas ?? []).join(", ")} className="input" placeholder="Ex.: Sociologia, Projeto de Vida" /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2"><span className="text-sm font-semibold">Currículo/Lattes</span><input name="curriculum_lattes_url" type="url" defaultValue={row?.curriculum_lattes_url ?? ""} className="input" /></label>
        <label className="grid gap-2"><span className="text-sm font-semibold">Critérios/restrições operacionais</span><input name="restrictions" type="text" defaultValue={row?.restrictions ?? ""} className="input" /></label>
      </div>
      <label className="grid gap-2"><span className="text-sm font-semibold">Observações de formação</span><textarea name="training_notes" defaultValue={row?.training_notes ?? ""} rows={3} className="input min-h-[100px]" /></label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="can_teach_nem" type="checkbox" defaultChecked={row?.can_teach_nem !== false} className="h-4 w-4" /> Habilitado para o Novo Ensino Médio</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="can_teach_technical" type="checkbox" defaultChecked={!!row?.can_teach_technical} className="h-4 w-4" /> Pode atuar em formação técnica</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input name="allow_interjornada_lt_11" type="checkbox" defaultChecked={!!row?.allow_interjornada_lt_11} className="h-4 w-4" /> Permitir interjornada &lt; 11h</label>
      </div>
    </>
  );
}

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};
  const q = typeof (sp as any)?.q === "string" ? String((sp as any).q).trim() : "";
  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("teachers")
    .select("id,name,short_name,email,shifts,subject_id,default_room_id,class_ids,restrictions,availability,allow_interjornada_lt_11,teaching_rules,subject_ids,room_ids,available_weekdays,cpf,academic_degree,licensure_area,additional_areas,employee_code,can_teach_nem,can_teach_technical,curriculum_lattes_url,training_notes")
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: false });

  const { data: subjects } = await supabase.from("subjects").select("id,name").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: classes } = await supabase.from("classes").select("id,name,shift").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: rooms } = await supabase.from("rooms").select("id,name").eq("school_id", profile.school_id).order("name", { ascending: true });

  const subjectById = new Map((((subjects as RefRow[] | null) ?? [])).map((s) => [s.id, s.name ?? ""]));
  const classById = new Map((((classes as RefRow[] | null) ?? [])).map((c) => [c.id, c.name ?? ""]));
  const roomById = new Map((((rooms as RefRow[] | null) ?? [])).map((r) => [r.id, r.name ?? ""]));
  const typedRows = (rows as Row[] | null) ?? [];

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const parsedRules = parseTeachingRulesJson(formData.get("teaching_rules_json"));
    const derived = deriveLegacyFieldsFromTeachingRules(parsedRules);
    const normalizedScope = normalizeTeacherScopeFromRules(derived, parsedRules.length);
    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      short_name: String(formData.get("short_name") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      restrictions: String(formData.get("restrictions") || "").trim() || null,
      allow_interjornada_lt_11: parseCheckbox(formData.get("allow_interjornada_lt_11")),
      teaching_rules: parsedRules,
      shifts: normalizedScope.shifts,
      availability: normalizedScope.availability,
      available_weekdays: normalizedScope.available_weekdays,
      subject_id: normalizedScope.subject_id,
      default_room_id: normalizedScope.default_room_id,
      subject_ids: normalizedScope.subject_ids,
      room_ids: normalizedScope.room_ids,
      class_ids: normalizedScope.class_ids,
      cpf: String(formData.get("cpf") || "").trim() || null,
      academic_degree: normalizeTeacherAcademicDegree(formData.get("academic_degree")),
      licensure_area: String(formData.get("licensure_area") || "").trim() || null,
      additional_areas: parseCsvArray(formData.get("additional_areas")),
      employee_code: String(formData.get("employee_code") || "").trim() || null,
      can_teach_nem: parseCheckbox(formData.get("can_teach_nem")),
      can_teach_technical: parseCheckbox(formData.get("can_teach_technical")),
      curriculum_lattes_url: String(formData.get("curriculum_lattes_url") || "").trim() || null,
      training_notes: String(formData.get("training_notes") || "").trim() || null,
    };
    if (!payload.name) redirect("/teachers?error=" + encodeMsg("Preencha o nome do docente."));
    const { error } = await supabase.from("teachers").insert(payload);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));
    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Docente cadastrado."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "");
    if (!id) redirect("/teachers?error=" + encodeMsg("ID inválido."));
    const parsedRules = parseTeachingRulesJson(formData.get("teaching_rules_json"));
    const derived = deriveLegacyFieldsFromTeachingRules(parsedRules);
    const normalizedScope = normalizeTeacherScopeFromRules(derived, parsedRules.length);
    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
      short_name: String(formData.get("short_name") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      restrictions: String(formData.get("restrictions") || "").trim() || null,
      allow_interjornada_lt_11: parseCheckbox(formData.get("allow_interjornada_lt_11")),
      teaching_rules: parsedRules,
      shifts: normalizedScope.shifts,
      availability: normalizedScope.availability,
      available_weekdays: normalizedScope.available_weekdays,
      subject_id: normalizedScope.subject_id,
      default_room_id: normalizedScope.default_room_id,
      subject_ids: normalizedScope.subject_ids,
      room_ids: normalizedScope.room_ids,
      class_ids: normalizedScope.class_ids,
      cpf: String(formData.get("cpf") || "").trim() || null,
      academic_degree: normalizeTeacherAcademicDegree(formData.get("academic_degree")),
      licensure_area: String(formData.get("licensure_area") || "").trim() || null,
      additional_areas: parseCsvArray(formData.get("additional_areas")),
      employee_code: String(formData.get("employee_code") || "").trim() || null,
      can_teach_nem: parseCheckbox(formData.get("can_teach_nem")),
      can_teach_technical: parseCheckbox(formData.get("can_teach_technical")),
      curriculum_lattes_url: String(formData.get("curriculum_lattes_url") || "").trim() || null,
      training_notes: String(formData.get("training_notes") || "").trim() || null,
    };
    const { error } = await supabase.from("teachers").update(payload).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));
    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Docente atualizado."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "");
    if (!id) redirect("/teachers?error=" + encodeMsg("ID inválido."));
    const { error } = await supabase.from("teachers").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));
    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Docente removido."));
  }

  const filteredRows = q ? typedRows.filter((row) => [row.name, row.email, row.licensure_area, row.employee_code].some((value) => String(value ?? "").toLowerCase().includes(q.toLowerCase()))) : typedRows;

  return (
    <Shell title="Docentes" subtitle="O cadastro agora guarda titulação, habilitação e aptidão para NEM/técnico. Afinal, currículo bom sem professor habilitado é castelo de areia com crachá.">
      <div className="grid gap-4">
        <Flash message={error || msg || loadError?.message || null} variant={error ? "error" : msg ? "success" : "info"} />

        <div className="panel p-5">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar docente</summary>
            <form action={createAction} className="mt-4 grid gap-4">
              <TeacherFields />
              <TeacherTeachingRulesEditor subjects={(subjects as RefRow[] | null) ?? []} classes={(classes as RefRow[] | null) ?? []} rooms={(rooms as RefRow[] | null) ?? []} />
              <button type="submit" className="btn btn-primary w-fit">Salvar</button>
            </form>
          </details>
        </div>

        <div className="table-wrap">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <form action="/teachers" method="GET" className="flex w-full max-w-md gap-2">
              <input name="q" type="text" placeholder="Pesquisar por nome, e-mail ou habilitação" defaultValue={q} className="input w-full" />
              <button type="submit" className="btn btn-secondary">Pesquisar</button>
              {q ? <a href="/teachers" className="btn btn-ghost">Limpar</a> : null}
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-th">Docente</th>
                  <th className="table-th">Habilitação</th>
                  <th className="table-th">Regras</th>
                  <th className="table-th">Cadastro</th>
                  <th className="table-th">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const flags = validateTeacherCatalog(row);
                  return (
                    <tr key={row.id} className="table-row align-top">
                      <td className="table-td">
                        <div className="grid gap-1">
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-xs text-zinc-500">{row.email || "Sem e-mail"} • CPF {row.cpf || "—"}</div>
                          <div className="text-xs text-zinc-500">Registro {row.employee_code || "—"}</div>
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="grid gap-1">
                          <div>{labelTeacherAcademicDegree(row.academic_degree)}</div>
                          <div className="text-xs text-zinc-500">{row.licensure_area || "Sem habilitação principal"}</div>
                          <div className="text-xs text-zinc-500">{(row.additional_areas ?? []).join(", ") || "Sem áreas adicionais"}</div>
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="grid gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                          <div>Turnos: {labelShiftList(row.shifts)}</div>
                          <div>Componentes: {labelList(row.subject_ids, subjectById)}</div>
                          <div>Salas: {labelList(row.room_ids, roomById)}</div>
                          <div>Turmas: {labelList(row.class_ids, classById)}</div>
                        </div>
                      </td>
                      <td className="table-td">
                        {flags.length ? <div className="text-xs text-amber-700 dark:text-amber-300">{flags.slice(0, 3).join(" ")}</div> : <div className="text-xs text-emerald-700 dark:text-emerald-300">Cadastro docente completo para o NEM.</div>}
                      </td>
                      <td className="table-td">
                        <div className="flex flex-wrap items-center gap-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                            <form action={updateAction} className="mt-3 grid w-[min(960px,92vw)] gap-4">
                              <input type="hidden" name="id" value={row.id} />
                              <TeacherFields row={row} />
                              <TeacherTeachingRulesEditor subjects={(subjects as RefRow[] | null) ?? []} classes={(classes as RefRow[] | null) ?? []} rooms={(rooms as RefRow[] | null) ?? []} initialRules={row.teaching_rules ?? []} />
                              <button type="submit" className="btn btn-primary w-fit">Atualizar</button>
                            </form>
                          </details>
                          <form action={deleteAction}><input type="hidden" name="id" value={row.id} /><ConfirmButton confirmText="Tem certeza que deseja excluir?" type="submit" className="btn btn-danger">Excluir</ConfirmButton></form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 ? <tr className="table-row"><td colSpan={5} className="table-td text-zinc-500">Nenhum docente encontrado.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
