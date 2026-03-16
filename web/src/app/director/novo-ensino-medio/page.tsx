import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { requireDirector } from "@/lib/require-director";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  DEFAULT_NEM_SETTINGS,
  NEM_COMPONENT_TYPE_OPTIONS,
  NEM_REQUIRED_COMPONENT_OPTIONS,
  PATCH_NEM_MESSAGE,
  computeNemCompliance,
  computeNetworkCurriculumAlignment,
  getEffectiveNemThresholds,
  isMissingColumnOrTableError,
  labelNemComponentType,
  labelNemKnowledgeArea,
  labelNemOfferModel,
  labelNemRequiredComponent,
  labelNemSeriesYear,
  mergeNemSettings,
  normalizeStateCode,
} from "@/lib/novo-ensino-medio";

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
  entry_cohort?: number | null;
  curriculum_version?: string | null;
  offer_model?: string | null;
  series_year?: string | null;
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

const BRAZILIAN_STATE_OPTIONS = [
  ["AC", "Acre"],
  ["AL", "Alagoas"],
  ["AP", "Amapá"],
  ["AM", "Amazonas"],
  ["BA", "Bahia"],
  ["CE", "Ceará"],
  ["DF", "Distrito Federal"],
  ["ES", "Espírito Santo"],
  ["GO", "Goiás"],
  ["MA", "Maranhão"],
  ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"],
  ["PA", "Pará"],
  ["PB", "Paraíba"],
  ["PR", "Paraná"],
  ["PE", "Pernambuco"],
  ["PI", "Piauí"],
  ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"],
  ["RR", "Roraima"],
  ["SC", "Santa Catarina"],
  ["SP", "São Paulo"],
  ["SE", "Sergipe"],
  ["TO", "Tocantins"],
] as const;

function shiftLabel(shift: string | null | undefined) {
  const key = String(shift ?? "").trim().toUpperCase();
  if (key === "MANHA") return "Manhã";
  if (key === "TARDE") return "Tarde";
  if (key === "NOITE") return "Noite";
  return key || "—";
}

function toneClass(status: "ok" | "warning" | "critical") {
  if (status === "ok") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (status === "critical") {
    return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300";
  }
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
}

function parseNumber(formData: FormData, key: string, fallback: number) {
  const raw = Number(formData.get(key));
  return Number.isFinite(raw) ? raw : fallback;
}

function parseOptionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export default async function DirectorNovoEnsinoMedioPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};
  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [classesRes, subjectsRes, requirementsRes, settingsRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name,shift,entry_cohort,curriculum_version,offer_model,series_year")
      .eq("school_id", profile.school_id)
      .order("name", { ascending: true }),
    supabase
      .from("subjects")
      .select("id,name,component_type,knowledge_area,nem_component_code,is_digital_education,is_project_of_life")
      .eq("school_id", profile.school_id)
      .order("name", { ascending: true }),
    supabase
      .from("class_subject_requirements")
      .select("id,class_id,subject_id,lessons_per_week")
      .eq("school_id", profile.school_id),
    supabase.from("school_curriculum_settings").select("*").eq("school_id", profile.school_id).maybeSingle(),
  ]);

  const missingPatch = [classesRes.error, subjectsRes.error, settingsRes.error].some((item) => isMissingColumnOrTableError(item));

  const classes = ((classesRes.data as ClassRow[] | null) ?? []).map((item) => ({
    ...item,
    entry_cohort: item.entry_cohort ?? null,
    curriculum_version: item.curriculum_version ?? null,
    offer_model: item.offer_model ?? null,
    series_year: item.series_year ?? null,
  }));
  const subjects = ((subjectsRes.data as SubjectRow[] | null) ?? []).map((item) => ({
    ...item,
    component_type: item.component_type ?? null,
    knowledge_area: item.knowledge_area ?? null,
    nem_component_code: item.nem_component_code ?? null,
    is_digital_education: Boolean(item.is_digital_education),
    is_project_of_life: Boolean(item.is_project_of_life),
  }));
  const requirements = ((requirementsRes.data as RequirementRow[] | null) ?? []).map((item) => ({
    ...item,
    lessons_per_week: Number(item.lessons_per_week ?? 0),
  }));
  const settings = missingPatch ? DEFAULT_NEM_SETTINGS : mergeNemSettings((settingsRes.data as any) ?? null);
  const effective = getEffectiveNemThresholds(settings);

  const requirementsByClass = new Map<string, RequirementRow[]>();
  for (const item of requirements) {
    const list = requirementsByClass.get(String(item.class_id)) ?? [];
    list.push(item);
    requirementsByClass.set(String(item.class_id), list);
  }
  const subjectById = new Map(subjects.map((item) => [String(item.id), item]));

  const reports = classes.map((classItem) => ({
    classItem,
    requirements: requirementsByClass.get(String(classItem.id)) ?? [],
    compliance: computeNemCompliance({
      classItem,
      requirements: requirementsByClass.get(String(classItem.id)) ?? [],
      subjectById: subjectById as any,
      settings,
    }),
  }));

  const networkAlignment = computeNetworkCurriculumAlignment({
    classes: classes as any,
    requirementsByClass: requirementsByClass as any,
    subjectById: subjectById as any,
    settings,
  });

  const totals = {
    totalClasses: classes.length,
    ok: reports.filter((item) => item.compliance.status === "ok").length,
    warning: reports.filter((item) => item.compliance.status === "warning").length,
    critical: reports.filter((item) => item.compliance.status === "critical").length,
    subjectsConfigured: subjects.filter((item) => item.component_type).length,
    subjectsUnclassified: subjects.filter((item) => !item.component_type).length,
    digitalTagged: subjects.filter((item) => item.is_digital_education).length,
    projectOfLifeTagged: subjects.filter((item) => item.is_project_of_life).length,
  };

  const componentDistribution = NEM_COMPONENT_TYPE_OPTIONS.map((option) => ({
    ...option,
    count: subjects.filter((item) => String(item.component_type ?? "").toUpperCase() === option.value).length,
  }));

  const unclassifiedSubjects = subjects.filter((item) => !item.component_type);

  async function saveSettingsAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const requiredCodes = formData
      .getAll("required_fgb_codes_override")
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean);

    const payload = {
      school_id: profile.school_id,
      weeks_per_school_year: parseNumber(formData, "weeks_per_school_year", DEFAULT_NEM_SETTINGS.weeks_per_school_year),
      minutes_per_lesson: parseNumber(formData, "minutes_per_lesson", DEFAULT_NEM_SETTINGS.minutes_per_lesson),
      total_annual_hours_target: parseNumber(formData, "total_annual_hours_target", DEFAULT_NEM_SETTINGS.total_annual_hours_target),
      fgb_min_hours_regular: parseNumber(formData, "fgb_min_hours_regular", DEFAULT_NEM_SETTINGS.fgb_min_hours_regular),
      itinerary_min_hours_regular: parseNumber(formData, "itinerary_min_hours_regular", DEFAULT_NEM_SETTINGS.itinerary_min_hours_regular),
      technical_fgb_min_hours_800: parseNumber(formData, "technical_fgb_min_hours_800", DEFAULT_NEM_SETTINGS.technical_fgb_min_hours_800),
      technical_fgb_min_hours_1000: parseNumber(formData, "technical_fgb_min_hours_1000", DEFAULT_NEM_SETTINGS.technical_fgb_min_hours_1000),
      technical_fgb_min_hours_1200: parseNumber(formData, "technical_fgb_min_hours_1200", DEFAULT_NEM_SETTINGS.technical_fgb_min_hours_1200),
      min_itineraries_per_school: parseNumber(formData, "min_itineraries_per_school", DEFAULT_NEM_SETTINGS.min_itineraries_per_school),
      state_code: normalizeStateCode(formData.get("state_code")) ?? null,
      state_curriculum_name: String(formData.get("state_curriculum_name") || "").trim() || null,
      state_curriculum_version: String(formData.get("state_curriculum_version") || "").trim() || null,
      state_reference_url: String(formData.get("state_reference_url") || "").trim() || null,
      curriculum_alignment_notes: String(formData.get("curriculum_alignment_notes") || "").trim() || null,
      state_override_total_annual_hours_target: parseOptionalNumber(formData, "state_override_total_annual_hours_target"),
      state_override_fgb_min_hours_regular: parseOptionalNumber(formData, "state_override_fgb_min_hours_regular"),
      state_override_itinerary_min_hours_regular: parseOptionalNumber(formData, "state_override_itinerary_min_hours_regular"),
      state_override_min_itineraries_per_school: parseOptionalNumber(formData, "state_override_min_itineraries_per_school"),
      required_fgb_codes_override: requiredCodes.length ? requiredCodes : DEFAULT_NEM_SETTINGS.required_fgb_codes_override,
      enforce_digital_education: formData.get("enforce_digital_education") === "on",
      enforce_project_of_life: formData.get("enforce_project_of_life") === "on",
    };

    const { error } = await supabase.from("school_curriculum_settings").upsert(payload, { onConflict: "school_id" });
    if (error) {
      const message = isMissingColumnOrTableError(error)
        ? "Rode também o arquivo db/patch_novo_ensino_medio_fase5.sql para liberar currículo estadual e validação automática avançada."
        : error.message;
      redirect("/director/novo-ensino-medio?error=" + encodeMsg(message));
    }

    revalidatePath("/director/novo-ensino-medio");
    revalidatePath("/classes");
    redirect("/director/novo-ensino-medio?msg=" + encodeMsg("Parâmetros do Novo Ensino Médio atualizados."));
  }

  return (
    <Shell
      title="Novo Ensino Médio"
      subtitle="Configure a régua da rede, alinhe o currículo estadual e acompanhe a conformidade da escola por turma e por oferta global."
    >
      <div className="grid gap-4">
        <Flash
          message={
            error ||
            msg ||
            (missingPatch
              ? "Os campos da fase 5 ainda não existem no banco. Rode o arquivo db/patch_novo_ensino_medio_fase5.sql para liberar currículo estadual e validação automática avançada."
              : classesRes.error?.message || subjectsRes.error?.message || settingsRes.error?.message || null)
          }
          variant={error ? "error" : msg ? "success" : "info"}
        />

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Turmas conformes</div>
            <div className="mt-2 text-2xl font-semibold">{totals.ok}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">de {totals.totalClasses} turmas analisadas</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Turmas com alerta</div>
            <div className="mt-2 text-2xl font-semibold">{totals.warning}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">ajustes parciais na matriz</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Turmas críticas</div>
            <div className="mt-2 text-2xl font-semibold">{totals.critical}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">lacunas regulatórias relevantes</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Itinerários distintos na oferta</div>
            <div className="mt-2 text-2xl font-semibold">{networkAlignment.itinerarySubjectsCount}</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">mínimo efetivo: {effective.minItinerariesPerSchool}</div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr,1.8fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Parâmetros da escola e da rede</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  A régua federal continua aqui, mas agora você também pode registrar o currículo estadual específico e seus overrides locais.
                </p>
              </div>
              <Link href="/classes" className="btn btn-secondary">
                Ver turmas
              </Link>
            </div>

            <form action={saveSettingsAction} className="mt-4 grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Semanas letivas usadas no cálculo</span>
                  <input name="weeks_per_school_year" type="number" min={20} max={60} defaultValue={settings.weeks_per_school_year} className="input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Minutos por aula</span>
                  <input name="minutes_per_lesson" type="number" min={30} max={90} defaultValue={settings.minutes_per_lesson} className="input" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Meta anual total federal (h)</span>
                  <input name="total_annual_hours_target" type="number" min={600} max={5000} defaultValue={settings.total_annual_hours_target} className="input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">FGB mínima federal (h)</span>
                  <input name="fgb_min_hours_regular" type="number" min={400} max={5000} defaultValue={settings.fgb_min_hours_regular} className="input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Itinerário mínimo federal (h)</span>
                  <input name="itinerary_min_hours_regular" type="number" min={0} max={3000} defaultValue={settings.itinerary_min_hours_regular} className="input" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">FGB mínima técnico 800h</span>
                  <input name="technical_fgb_min_hours_800" type="number" min={400} max={5000} defaultValue={settings.technical_fgb_min_hours_800} className="input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">FGB mínima técnico 1.000h</span>
                  <input name="technical_fgb_min_hours_1000" type="number" min={400} max={5000} defaultValue={settings.technical_fgb_min_hours_1000} className="input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">FGB mínima técnico 1.200h</span>
                  <input name="technical_fgb_min_hours_1200" type="number" min={400} max={5000} defaultValue={settings.technical_fgb_min_hours_1200} className="input" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">UF do currículo adotado</span>
                  <select name="state_code" defaultValue={settings.state_code ?? ""} className="input h-10">
                    <option value="">Não informado</option>
                    {BRAZILIAN_STATE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 xl:col-span-2">
                  <span className="text-sm font-semibold">Nome do currículo estadual específico</span>
                  <input name="state_curriculum_name" defaultValue={settings.state_curriculum_name ?? ""} className="input" placeholder="Ex.: Referencial Curricular do Ensino Médio da rede" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Versão / ano da norma</span>
                  <input name="state_curriculum_version" defaultValue={settings.state_curriculum_version ?? ""} className="input" placeholder="2025" />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">URL de referência normativa</span>
                <input name="state_reference_url" defaultValue={settings.state_reference_url ?? ""} className="input" placeholder="https://..." />
              </label>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Carga total efetiva da rede (h)</span>
                  <input name="state_override_total_annual_hours_target" type="number" min={600} max={5000} defaultValue={settings.state_override_total_annual_hours_target ?? ""} className="input" placeholder="Usar federal" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">FGB efetiva da rede (h)</span>
                  <input name="state_override_fgb_min_hours_regular" type="number" min={400} max={5000} defaultValue={settings.state_override_fgb_min_hours_regular ?? ""} className="input" placeholder="Usar federal" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Itinerário efetivo da rede (h)</span>
                  <input name="state_override_itinerary_min_hours_regular" type="number" min={0} max={3000} defaultValue={settings.state_override_itinerary_min_hours_regular ?? ""} className="input" placeholder="Usar federal" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Mínimo efetivo de itinerários</span>
                  <input name="state_override_min_itineraries_per_school" type="number" min={1} max={10} defaultValue={settings.state_override_min_itineraries_per_school ?? ""} className="input" placeholder="Usar federal" />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Observações de alinhamento</span>
                <textarea
                  name="curriculum_alignment_notes"
                  defaultValue={settings.curriculum_alignment_notes ?? ""}
                  className="input min-h-24 py-3"
                  placeholder="Ex.: a rede usa matriz própria por coorte, espanhol optativo fora da base semanal, aprofundamento compartilhado em polo regional..."
                />
              </label>

              <div className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold">Componentes obrigatórios monitorados</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Por padrão, o sistema vigia todos os componentes obrigatórios da FGB. Ajuste só se a sua rede formalizar outra forma de rastreamento.
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {NEM_REQUIRED_COMPONENT_OPTIONS.map((option) => {
                    const checked = (settings.required_fgb_codes_override ?? []).includes(option.value);
                    return (
                      <label key={option.value} className="flex items-start gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                        <input type="checkbox" name="required_fgb_codes_override" value={option.value} defaultChecked={checked} className="mt-1 h-4 w-4" />
                        <span>
                          <span className="block font-medium">{option.label}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">{labelNemKnowledgeArea(option.area)}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                  <input type="checkbox" name="enforce_digital_education" defaultChecked={settings.enforce_digital_education !== false} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="block font-semibold">Exigir educação digital nas validações</span>
                    <span className="text-zinc-500 dark:text-zinc-400">Quando marcado, a turma recebe alerta se não houver componente com educação digital sinalizada.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                  <input type="checkbox" name="enforce_project_of_life" defaultChecked={settings.enforce_project_of_life !== false} className="mt-1 h-4 w-4" />
                  <span>
                    <span className="block font-semibold">Exigir Projeto de Vida nas validações</span>
                    <span className="text-zinc-500 dark:text-zinc-400">Quando marcado, a turma recebe alerta se a matriz ainda não trouxer Projeto de Vida.</span>
                  </span>
                </label>
              </div>

              <label className="grid gap-2 md:max-w-xs">
                <span className="text-sm font-semibold">Mínimo de itinerários distintos na régua federal</span>
                <input name="min_itineraries_per_school" type="number" min={1} max={10} defaultValue={settings.min_itineraries_per_school} className="input" />
              </label>

              <button type="submit" className="btn btn-primary w-fit">
                Salvar régua curricular
              </button>
            </form>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
              <h2 className="text-base font-semibold">Régua efetiva aplicada pelo motor</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Carga total</div>
                  <div className="mt-1 text-xl font-semibold">{effective.totalAnnualHoursTarget}h</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">FGB regular</div>
                  <div className="mt-1 text-xl font-semibold">{effective.fgbMinHoursRegular}h</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Itinerário regular</div>
                  <div className="mt-1 text-xl font-semibold">{effective.itineraryMinHoursRegular}h</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Itinerários mínimos</div>
                  <div className="mt-1 text-xl font-semibold">{effective.minItinerariesPerSchool}</div>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Currículo estadual</div>
                  <div className="mt-2 text-sm font-medium">{settings.state_curriculum_name || "Ainda não informado"}</div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {(settings.state_code ? `UF ${settings.state_code}` : "UF não definida") + (settings.state_curriculum_version ? ` • versão ${settings.state_curriculum_version}` : "")}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Componentes obrigatórios monitorados</div>
                  <div className="mt-2 text-sm font-medium">{(effective.requiredFgbCodes ?? []).length} componentes</div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {(effective.requiredFgbCodes ?? []).map((code) => labelNemRequiredComponent(code)).join(", ")}
                  </div>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl border p-5 shadow-sm ${toneClass(networkAlignment.status)}`}>
              <h2 className="text-base font-semibold">Validação automática da oferta da escola</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-70">Itinerários distintos</div>
                  <div className="mt-1 text-2xl font-semibold">{networkAlignment.itinerarySubjectsCount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-70">Áreas de itinerário</div>
                  <div className="mt-1 text-2xl font-semibold">{networkAlignment.itineraryAreasCount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-70">Status</div>
                  <div className="mt-1 text-sm font-semibold">
                    {networkAlignment.status === "ok" ? "Conforme" : networkAlignment.status === "warning" ? "Ajustes pendentes" : "Crítico"}
                  </div>
                </div>
              </div>
              {networkAlignment.flags.length ? (
                <ul className="mt-4 grid gap-2 text-sm">
                  {networkAlignment.flags.map((flag) => (
                    <li key={flag} className="rounded-xl bg-white/60 px-3 py-2 dark:bg-black/20">
                      {flag}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm">A oferta global da escola já atende a régua configurada para itinerários e alinhamento do currículo.</p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
              <h2 className="text-base font-semibold">Classificação dos componentes</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {componentDistribution.map((item) => (
                  <div key={item.value} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold">{item.count}</div>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-400 md:grid-cols-3">
                <div>Componentes classificados: <strong className="text-zinc-900 dark:text-zinc-100">{totals.subjectsConfigured}</strong></div>
                <div>Educação digital sinalizada: <strong className="text-zinc-900 dark:text-zinc-100">{totals.digitalTagged}</strong></div>
                <div>Projeto de Vida sinalizado: <strong className="text-zinc-900 dark:text-zinc-100">{totals.projectOfLifeTagged}</strong></div>
              </div>
            </div>
          </div>
        </div>

        {unclassifiedSubjects.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Componentes ainda sem classificação NEM</h2>
                <p className="mt-1 text-sm opacity-80">Eles continuam existindo no cadastro, mas o motor regulatório fica míope enquanto esses itens não recebem tipo curricular, área e, quando cabível, código obrigatório.</p>
              </div>
              <Link href="/subjects" className="btn btn-secondary">
                Abrir componentes
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {unclassifiedSubjects.map((subject) => (
                <span key={subject.id} className="rounded-full border border-amber-300 bg-white/80 px-3 py-1 dark:border-amber-800 dark:bg-black/20">
                  {subject.name || "Sem nome"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Validação automática por turma</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Cada turma é comparada com a régua efetiva da rede, incluindo carga horária, componentes obrigatórios, educação digital e Projeto de Vida.
              </p>
            </div>
            <Link href="/subjects" className="btn btn-secondary">
              Ajustar componentes
            </Link>
          </div>

          <div className="mt-4 grid gap-4">
            {reports.length ? (
              reports.map(({ classItem, compliance }) => (
                <article key={classItem.id} className={`rounded-2xl border p-4 ${toneClass(compliance.status)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{classItem.name || "Turma sem nome"}</h3>
                      <p className="mt-1 text-sm opacity-80">
                        {shiftLabel(classItem.shift)} • {labelNemSeriesYear(classItem.series_year)} • {labelNemOfferModel(classItem.offer_model)}
                        {classItem.entry_cohort ? ` • coorte ${classItem.entry_cohort}` : ""}
                        {classItem.curriculum_version ? ` • ${classItem.curriculum_version}` : ""}
                      </p>
                    </div>
                    <div className="grid gap-1 text-right text-sm">
                      <div>
                        <span className="font-semibold">Carga total:</span> {compliance.estimatedAnnualHours}h
                      </div>
                      <div>
                        <span className="font-semibold">FGB:</span> {compliance.estimatedFgbHours}h
                      </div>
                      <div>
                        <span className="font-semibold">Itinerário:</span> {compliance.estimatedItineraryHours}h
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
                    <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                      <div className="text-xs uppercase tracking-wide opacity-70">Aulas por semana</div>
                      <div className="mt-1 text-lg font-semibold">{compliance.totalLessonsPerWeek}</div>
                    </div>
                    <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                      <div className="text-xs uppercase tracking-wide opacity-70">Formação técnica</div>
                      <div className="mt-1 text-lg font-semibold">{compliance.estimatedTechnicalHours}h</div>
                    </div>
                    <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                      <div className="text-xs uppercase tracking-wide opacity-70">Educação digital</div>
                      <div className="mt-1 text-lg font-semibold">{compliance.estimatedDigitalEducationHours}h</div>
                    </div>
                    <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
                      <div className="text-xs uppercase tracking-wide opacity-70">Projeto de Vida</div>
                      <div className="mt-1 text-lg font-semibold">{compliance.estimatedProjectOfLifeHours}h</div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr,1fr] text-sm">
                    <div>
                      <div className="font-semibold">Pendências e alertas</div>
                      {compliance.flags.length ? (
                        <ul className="mt-2 grid gap-2">
                          {compliance.flags.map((flag) => (
                            <li key={flag} className="rounded-xl bg-white/60 px-3 py-2 dark:bg-black/20">
                              {flag}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 dark:bg-black/20">A turma já atende a régua configurada para o Novo Ensino Médio.</p>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">Componentes obrigatórios presentes</div>
                      <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 dark:bg-black/20">
                        {compliance.requiredFgbCodesPresent.length
                          ? compliance.requiredFgbCodesPresent.map((code) => labelNemRequiredComponent(code)).join(", ")
                          : "Nenhum componente obrigatório mapeado ainda."}
                      </p>
                      {compliance.missingRequiredFgbCodes.length ? (
                        <>
                          <div className="mt-3 font-semibold">Ainda faltando</div>
                          <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 dark:bg-black/20">
                            {compliance.missingRequiredFgbCodes.map((code) => labelNemRequiredComponent(code)).join(", ")}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Nenhuma turma cadastrada ainda. Cadastre turmas e componha a matriz para o motor regulatório ter algo para mastigar.
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
