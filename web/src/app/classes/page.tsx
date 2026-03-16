import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ClassRequirementsEditor } from "@/components/ClassRequirementsEditor";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  DEFAULT_NEM_SETTINGS,
  NEM_ITINERARY_AXIS_OPTIONS,
  NEM_OFFER_MODEL_OPTIONS,
  NEM_SERIES_YEAR_OPTIONS,
  PATCH_NEM_MESSAGE,
  computeNemCompliance,
  groupRequirementsByComponentType,
  isMissingColumnOrTableError,
  labelNemItineraryAxis,
  labelNemOfferModel,
  labelNemSeriesYear,
  mergeNemSettings,
  normalizeNemItineraryAxis,
  normalizeNemOfferModel,
  normalizeNemSeriesYear,
  validateClassCatalog,
} from "@/lib/novo-ensino-medio";

type Row = {
  id: string;
  name: string | null;
  shift: string | null;
  level?: string | null;
  stage?: string | null;
  default_room_id?: string | null;
  display_order?: number | null;
  entry_cohort?: number | null;
  curriculum_version?: string | null;
  offer_model?: string | null;
  series_year?: string | null;
  school_year?: number | null;
  itinerary_axis?: string | null;
  itinerary_name?: string | null;
  max_students?: number | null;
  vacancies?: number | null;
  active?: boolean | null;
  pedagogical_notes?: string | null;
};

type SubjectRow = {
  id: string;
  name: string | null;
  component_type?: string | null;
  knowledge_area?: string | null;
  nem_component_code?: string | null;
  is_digital_education?: boolean | null;
  is_project_of_life?: boolean | null;
};

type RequirementRow = {
  id: string;
  class_id: string;
  subject_id: string;
  lessons_per_week: number;
};

type RequirementInput = { subject_id: string; lessons_per_week: number };
type RoomRow = { id: string; name: string | null };

const SHIFT_OPTIONS = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];

function normalizeShift(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().toUpperCase();
  return SHIFT_OPTIONS.some((item) => item.key === raw) ? raw : null;
}

function shiftLabel(shift: string | null | undefined) {
  const key = String(shift ?? "").trim().toUpperCase();
  const label = SHIFT_OPTIONS.find((item) => item.key === key)?.label;
  return label || key || "—";
}

function sanitizeRequirementsJson(raw: FormDataEntryValue | null, validSubjectIds: Set<string>) {
  const source = String(raw ?? "[]").trim() || "[]";
  let parsed: any[];
  try {
    const value = JSON.parse(source);
    parsed = Array.isArray(value) ? value : [];
  } catch {
    return { error: "Os componentes da turma estão em um formato inválido." } as const;
  }

  const items: RequirementInput[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    const subjectId = String(entry?.subject_id ?? "").trim();
    if (!subjectId) continue;
    if (!validSubjectIds.has(subjectId)) return { error: "Um dos componentes selecionados não pertence a esta escola." } as const;
    if (seen.has(subjectId)) return { error: "Há componentes repetidos na turma." } as const;
    const lessons = Math.max(1, Math.min(40, Number(entry?.lessons_per_week ?? 0) || 0));
    if (!lessons) return { error: "Informe a quantidade de aulas por semana de cada componente." } as const;
    seen.add(subjectId);
    items.push({ subject_id: subjectId, lessons_per_week: lessons });
  }

  return { items } as const;
}

async function syncClassRequirements(args: {
  supabase: any;
  schoolId: string;
  classId: string;
  requirements: RequirementInput[];
}) {
  const { supabase, schoolId, classId, requirements } = args;
  const { data: existingRows, error: existingError } = await supabase
    .from("class_subject_requirements")
    .select("id,subject_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId);
  if (existingError) throw new Error(existingError.message || "Não foi possível carregar os componentes da turma.");

  const existing = (existingRows as Array<{ id: string; subject_id: string }> | null) ?? [];
  const incomingSubjectIds = new Set(requirements.map((item) => item.subject_id));
  const deleteIds = existing.filter((item) => !incomingSubjectIds.has(String(item.subject_id))).map((item) => String(item.id));

  if (deleteIds.length) {
    const { error } = await supabase.from("class_subject_requirements").delete().eq("school_id", schoolId).in("id", deleteIds);
    if (error) throw new Error(error.message || "Não foi possível remover componentes antigos da turma.");
  }

  if (requirements.length) {
    const payload = requirements.map((item) => ({ school_id: schoolId, class_id: classId, subject_id: item.subject_id, lessons_per_week: item.lessons_per_week }));
    const { error } = await supabase.from("class_subject_requirements").upsert(payload, { onConflict: "school_id,class_id,subject_id" });
    if (error) throw new Error(error.message || "Não foi possível salvar os componentes da turma.");
  }
}

function revalidateClassPaths() {
  revalidatePath("/classes");
  revalidatePath("/curriculum-matrix");
  revalidatePath("/director/matriz-curricular");
  revalidatePath("/director/parametros-grade");
  revalidatePath("/director/novo-ensino-medio");
}

function parseCheckbox(value: FormDataEntryValue | null) {
  return String(value ?? "") === "on";
}

function getClassPayload(formData: FormData) {
  return {
    name: String(formData.get("name") || "").trim() || null,
    shift: normalizeShift(formData.get("shift")),
    level: String(formData.get("level") || "").trim() || null,
    stage: String(formData.get("stage") || "").trim() || null,
    default_room_id: String(formData.get("default_room_id") || "").trim() || null,
    display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    entry_cohort: formData.get("entry_cohort") ? Number(formData.get("entry_cohort")) : null,
    curriculum_version: String(formData.get("curriculum_version") || "").trim() || null,
    offer_model: normalizeNemOfferModel(formData.get("offer_model")),
    series_year: normalizeNemSeriesYear(formData.get("series_year")),
    school_year: formData.get("school_year") ? Number(formData.get("school_year")) : null,
    itinerary_axis: normalizeNemItineraryAxis(formData.get("itinerary_axis")),
    itinerary_name: String(formData.get("itinerary_name") || "").trim() || null,
    max_students: formData.get("max_students") ? Number(formData.get("max_students")) : null,
    vacancies: formData.get("vacancies") ? Number(formData.get("vacancies")) : null,
    active: formData.get("active") ? parseCheckbox(formData.get("active")) : true,
    pedagogical_notes: String(formData.get("pedagogical_notes") || "").trim() || null,
  };
}

function handleClassMutationError(error: any) {
  if (isMissingColumnOrTableError(error)) return PATCH_NEM_MESSAGE;
  return error?.message || "Não foi possível salvar a turma.";
}

function complianceTone(status: "ok" | "warning" | "critical") {
  if (status === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (status === "critical") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300";
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
}

function roomLabel(roomId: string | null | undefined, roomById: Map<string, string>) {
  if (!roomId) return "Sem sala padrão";
  return roomById.get(roomId) || "Sala não encontrada";
}

function ClassFormFields({ row, rooms }: { row?: Partial<Row> | null; rooms: RoomRow[] }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Nome *</span>
          <input name="name" type="text" defaultValue={row?.name ?? ""} required className="input" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Turno</span>
          <select name="shift" defaultValue={(row?.shift ?? "").toUpperCase()} className="input h-10">
            <option value="">—</option>
            {SHIFT_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Série *</span>
          <select name="series_year" defaultValue={(row?.series_year ?? "").toUpperCase()} className="input h-10">
            <option value="">Selecione</option>
            {NEM_SERIES_YEAR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Ano letivo *</span>
          <input name="school_year" type="number" min={2024} max={2035} defaultValue={row?.school_year ?? new Date().getFullYear()} className="input" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Coorte de ingresso *</span>
          <input name="entry_cohort" type="number" min={2024} max={2035} defaultValue={row?.entry_cohort ?? ""} className="input" placeholder="Ex.: 2026" />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Versão curricular *</span>
          <input name="curriculum_version" type="text" defaultValue={row?.curriculum_version ?? ""} className="input" placeholder="Ex.: NEM-2026-v1" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Modelo de oferta *</span>
          <select name="offer_model" defaultValue={(row?.offer_model ?? "NEM_REGULAR").toUpperCase()} className="input h-10">
            {NEM_OFFER_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Eixo do itinerário *</span>
          <select name="itinerary_axis" defaultValue={(row?.itinerary_axis ?? "").toUpperCase()} className="input h-10">
            <option value="">Selecione</option>
            {NEM_ITINERARY_AXIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Nome do itinerário/trilha *</span>
          <input name="itinerary_name" type="text" defaultValue={row?.itinerary_name ?? ""} className="input" placeholder="Ex.: Ciências Humanas Aplicadas" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Capacidade máxima *</span>
          <input name="max_students" type="number" min={1} max={200} defaultValue={row?.max_students ?? ""} className="input" />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Vagas iniciais</span>
          <input name="vacancies" type="number" min={0} max={200} defaultValue={row?.vacancies ?? ""} className="input" />
        </label>
        <label className="grid gap-2 xl:col-span-2">
          <span className="text-sm font-semibold">Sala padrão</span>
          <select name="default_room_id" defaultValue={row?.default_room_id ?? ""} className="input h-10">
            <option value="">Sem sala padrão</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name ?? "Sala"}</option>)}
          </select>
        </label>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-semibold">Observações pedagógicas</span>
        <textarea name="pedagogical_notes" defaultValue={row?.pedagogical_notes ?? ""} rows={3} className="input min-h-[110px]" />
      </label>

      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input name="active" type="checkbox" defaultChecked={row?.active !== false} className="h-4 w-4 rounded border-zinc-300" />
        Turma ativa para matrícula e grade
      </label>
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

  const { data: settingsRow } = await supabase.from("school_curriculum_settings").select("*").eq("school_id", profile.school_id).maybeSingle();
  const settings = mergeNemSettings(settingsRow ?? DEFAULT_NEM_SETTINGS);

  let classesQuery = supabase
    .from("classes")
    .select("id,name,shift,level,stage,default_room_id,display_order,entry_cohort,curriculum_version,offer_model,series_year,school_year,itinerary_axis,itinerary_name,max_students,vacancies,active,pedagogical_notes")
    .eq("school_id", profile.school_id);
  if (q) classesQuery = classesQuery.or(isUuid ? `id.eq.${q},name.ilike.${like},offer_model.ilike.${like},itinerary_name.ilike.${like}` : `name.ilike.${like},offer_model.ilike.${like},itinerary_name.ilike.${like}`);
  const { data: rowsData, error: loadError } = await classesQuery.order("school_year", { ascending: false, nullsFirst: false }).order("name", { ascending: true });

  const { data: subjectsData } = await supabase.from("subjects").select("id,name,component_type,knowledge_area,nem_component_code,is_digital_education,is_project_of_life").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: roomsData } = await supabase.from("rooms").select("id,name").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: reqRows } = await supabase.from("class_subject_requirements").select("id,class_id,subject_id,lessons_per_week").eq("school_id", profile.school_id);

  const rows = (rowsData as Row[] | null) ?? [];
  const subjects = (subjectsData as SubjectRow[] | null) ?? [];
  const rooms = (roomsData as RoomRow[] | null) ?? [];
  const requirements = (reqRows as RequirementRow[] | null) ?? [];

  const subjectById = new Map(subjects.map((item) => [item.id, item]));
  const roomById = new Map(rooms.map((room) => [room.id, room.name ?? "Sala"]));
  const requirementsByClass = new Map<string, RequirementRow[]>();
  for (const req of requirements) {
    const arr = requirementsByClass.get(req.class_id) ?? [];
    arr.push(req);
    requirementsByClass.set(req.class_id, arr);
  }

  const validSubjectIds = new Set(subjects.map((item) => item.id));
  const patchWarning = (!rows.length && isMissingColumnOrTableError(loadError)) ? PATCH_NEM_MESSAGE : null;

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const parsedRequirements = sanitizeRequirementsJson(formData.get("requirements_json"), validSubjectIds);
    if ("error" in parsedRequirements) {
      const errorMessage = parsedRequirements.error ?? "Os componentes da turma estão em um formato inválido.";
      redirect("/classes?error=" + encodeMsg(errorMessage));
    }
    const payload = { school_id: profile.school_id, ...getClassPayload(formData) };
    if (!payload.name) redirect("/classes?error=" + encodeMsg("Preencha o nome da turma."));
    const { data, error } = await supabase.from("classes").insert(payload).select("id").single();
    if (error) redirect("/classes?error=" + encodeMsg(handleClassMutationError(error)));
    try {
      await syncClassRequirements({ supabase, schoolId: profile.school_id, classId: data.id, requirements: parsedRequirements.items });
    } catch (err: any) {
      redirect("/classes?error=" + encodeMsg(err?.message || "Não foi possível salvar os componentes da turma."));
    }
    revalidateClassPaths();
    redirect("/classes?msg=" + encodeMsg("Turma cadastrada."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "");
    if (!id) redirect("/classes?error=" + encodeMsg("ID inválido."));
    const parsedRequirements = sanitizeRequirementsJson(formData.get("requirements_json"), validSubjectIds);
    if ("error" in parsedRequirements) {
      const errorMessage = parsedRequirements.error ?? "Os componentes da turma estão em um formato inválido.";
      redirect("/classes?error=" + encodeMsg(errorMessage));
    }
    const payload = getClassPayload(formData);
    const { error } = await supabase.from("classes").update(payload).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/classes?error=" + encodeMsg(handleClassMutationError(error)));
    try {
      await syncClassRequirements({ supabase, schoolId: profile.school_id, classId: id, requirements: parsedRequirements.items });
    } catch (err: any) {
      redirect("/classes?error=" + encodeMsg(err?.message || "Não foi possível salvar os componentes da turma."));
    }
    revalidateClassPaths();
    redirect("/classes?msg=" + encodeMsg("Turma atualizada."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "");
    if (!id) redirect("/classes?error=" + encodeMsg("ID inválido."));
    const { error } = await supabase.from("classes").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/classes?error=" + encodeMsg(error.message));
    revalidateClassPaths();
    redirect("/classes?msg=" + encodeMsg("Turma removida."));
  }

  return (
    <Shell title="Turmas" subtitle="O cadastro da turma agora cobre ano letivo, coorte, oferta, eixo e capacidade — o mínimo para o NEM não virar um bicho de sete cabeças na secretaria.">
      <div className="grid gap-4">
        <Flash message={error || msg || patchWarning || loadError?.message || null} variant={error ? "error" : msg ? "success" : "info"} />

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar turma</summary>
            <form action={createAction} className="mt-4 grid gap-4">
              <ClassFormFields rooms={rooms} />
              <ClassRequirementsEditor subjects={subjects} />
              <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">Salvar</button>
            </form>
          </details>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <form action="/classes" method="GET" className="flex w-full max-w-md gap-2">
              <input name="q" type="text" defaultValue={q} placeholder="Pesquisar turma, oferta ou itinerário" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600" />
              <button type="submit" className="btn btn-secondary">Pesquisar</button>
              {q ? <a href="/classes" className="btn btn-ghost">Limpar</a> : null}
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Turma</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Oferta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Cadastro</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Conformidade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const classRequirements = requirementsByClass.get(row.id) ?? [];
                  const grouped = groupRequirementsByComponentType({ requirements: classRequirements, subjectById: subjectById as any, settings });
                  const compliance = computeNemCompliance({ classItem: row, requirements: classRequirements, subjectById: subjectById as any, settings });
                  const catalogFlags = validateClassCatalog(row);
                  return (
                    <tr key={row.id} className="border-t border-zinc-100 align-top dark:border-zinc-900">
                      <td className="px-4 py-3 text-sm">
                        <div className="grid gap-1">
                          <div className="font-semibold">{row.name}</div>
                          <div className="text-xs text-zinc-500">{shiftLabel(row.shift)} • {labelNemSeriesYear(row.series_year)} • {row.school_year ?? "Ano ?"}</div>
                          <div className="text-xs text-zinc-500">Coorte {row.entry_cohort ?? "—"} • {roomLabel(row.default_room_id, roomById)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="grid gap-1">
                          <div>{labelNemOfferModel(row.offer_model)}</div>
                          <div className="text-xs text-zinc-500">{labelNemItineraryAxis(row.itinerary_axis)} • {row.itinerary_name ?? "Sem nome"}</div>
                          <div className="text-xs text-zinc-500">Capacidade: {row.max_students ?? "—"} • Vagas: {row.vacancies ?? "—"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="grid gap-2">
                          <div className="flex flex-wrap gap-2">
                            {grouped.length ? grouped.map((item) => <span key={item.key} className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">{item.label}: {item.lessonsPerWeek}</span>) : <span className="text-xs text-zinc-500">Sem componentes vinculados.</span>}
                          </div>
                          {catalogFlags.length ? <div className="text-xs text-amber-700 dark:text-amber-300">{catalogFlags.slice(0, 2).join(" ")}</div> : <div className="text-xs text-emerald-700 dark:text-emerald-300">Cadastro principal completo.</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className={`grid gap-2 rounded-2xl border px-3 py-3 ${complianceTone(compliance.status)}`}>
                          <div className="text-xs font-semibold uppercase tracking-wide">{compliance.status === "ok" ? "OK" : compliance.status === "critical" ? "Crítico" : "Atenção"}</div>
                          <div className="text-sm">{compliance.estimatedAnnualHours}h • FGB {compliance.estimatedFgbHours}h • Itinerário {compliance.estimatedItineraryHours}h</div>
                          <div className="text-xs">{compliance.flags.length ? compliance.flags.slice(0, 2).join(" ") : "Sem alertas principais."}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                            <form action={updateAction} className="mt-3 grid w-[min(900px,92vw)] gap-4">
                              <input type="hidden" name="id" value={row.id} />
                              <input type="hidden" name="level" value={row.level ?? ""} />
                              <input type="hidden" name="stage" value={row.stage ?? ""} />
                              <input type="hidden" name="display_order" value={row.display_order ?? ""} />
                              <ClassFormFields row={row} rooms={rooms} />
                              <ClassRequirementsEditor subjects={subjects} initialValue={classRequirements.map((item) => ({ subject_id: item.subject_id, lessons_per_week: item.lessons_per_week }))} />
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
                {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">Nenhuma turma cadastrada.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
