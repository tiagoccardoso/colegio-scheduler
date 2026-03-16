export type NemComponentType =
  | "FGB"
  | "ITINERARIO"
  | "FORMACAO_TECNICA"
  | "ELETIVA"
  | "PROJETO_DE_VIDA"
  | "PROJETO_INTEGRADOR"
  | "APOIO";

export type NemKnowledgeArea =
  | "LINGUAGENS"
  | "MATEMATICA"
  | "CIENCIAS_NATUREZA"
  | "CIENCIAS_HUMANAS"
  | "TECNICA"
  | "INTEGRACAO";

export type NemRequiredComponentCode =
  | "LP"
  | "LI"
  | "ART"
  | "EDF"
  | "MAT"
  | "BIO"
  | "FIS"
  | "QUI"
  | "FIL"
  | "GEO"
  | "HIS"
  | "SOC";

export type NemOfferModel =
  | "NEM_REGULAR"
  | "NEM_TECNICO_800"
  | "NEM_TECNICO_1000"
  | "NEM_TECNICO_1200"
  | "QUALIFICACAO_PROFISSIONAL";

export type NemSeriesYear = "1A" | "2A" | "3A" | "4A";

export type NemItineraryAxis =
  | "LINGUAGENS"
  | "MATEMATICA"
  | "CIENCIAS_NATUREZA"
  | "CIENCIAS_HUMANAS"
  | "TECNICO"
  | "INTEGRADO";

export type NemTeacherAcademicDegree =
  | "LICENCIATURA"
  | "BACHARELADO"
  | "TECNOLOGO"
  | "ESPECIALIZACAO"
  | "MESTRADO"
  | "DOUTORADO"
  | "NOTORIO_SABER"
  | "OUTRO";

export type NemProjectOfLifeMode = "TRANSVERSAL" | "COMPONENTE";

export type NemSettings = {
  weeks_per_school_year: number;
  minutes_per_lesson: number;
  total_annual_hours_target: number;
  fgb_min_hours_regular: number;
  itinerary_min_hours_regular: number;
  technical_fgb_min_hours_800: number;
  technical_fgb_min_hours_1000: number;
  technical_fgb_min_hours_1200: number;
  min_itineraries_per_school: number;
  state_code?: string | null;
  state_curriculum_name?: string | null;
  state_curriculum_version?: string | null;
  state_reference_url?: string | null;
  curriculum_alignment_notes?: string | null;
  state_override_total_annual_hours_target?: number | null;
  state_override_fgb_min_hours_regular?: number | null;
  state_override_itinerary_min_hours_regular?: number | null;
  state_override_min_itineraries_per_school?: number | null;
  required_fgb_codes_override?: string[] | null;
  enforce_digital_education?: boolean;
  enforce_project_of_life?: boolean;
  project_of_life_mode?: NemProjectOfLifeMode | null;
  require_portuguese_and_math_every_year?: boolean;
  require_spanish_offer?: boolean;
  require_itineraries_presential?: boolean;
};

export type NemSubjectMeta = {
  id: string;
  name: string | null;
  short_name?: string | null;
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
  language_code?: string | null;
  is_spanish_optative?: boolean | null;
};

export type NemRequirementLike = {
  subject_id: string;
  lessons_per_week: number;
};

export type NemClassMeta = {
  id: string;
  name: string | null;
  shift?: string | null;
  offer_model?: string | null;
  entry_cohort?: number | null;
  curriculum_version?: string | null;
  series_year?: string | null;
  school_year?: number | null;
  itinerary_axis?: string | null;
  itinerary_name?: string | null;
  itinerary_offer_id?: string | null;
  is_presential?: boolean | null;
  max_students?: number | null;
  vacancies?: number | null;
  active?: boolean | null;
  pedagogical_notes?: string | null;
};


export type NemItineraryOffer = {
  id: string;
  school_id?: string | null;
  name: string | null;
  code?: string | null;
  axis?: string | null;
  offer_model?: string | null;
  entry_cohort?: number | null;
  curriculum_version?: string | null;
  total_hours?: number | null;
  is_presential?: boolean | null;
  active?: boolean | null;
};

export type NemCohortComplianceReport = {
  cohortKey: string;
  classIds: string[];
  seriesCovered: string[];
  totalEstimatedHours: number;
  fgbHours: number;
  itineraryHours: number;
  technicalHours: number;
  projectOfLifeHours: number;
  digitalEducationHours: number;
  spanishOfferCount: number;
  requiredFgbCodesPresent: string[];
  missingRequiredFgbCodes: string[];
  flags: string[];
  status: "ok" | "warning" | "critical";
};

export type NemTeacherMeta = {
  id: string;
  name: string | null;
  cpf?: string | null;
  email?: string | null;
  academic_degree?: string | null;
  licensure_area?: string | null;
  additional_areas?: string[] | null;
  employee_code?: string | null;
  can_teach_nem?: boolean | null;
  can_teach_technical?: boolean | null;
  training_notes?: string | null;
};

export type NemRoomMeta = {
  id: string;
  name: string | null;
  room_type?: string | null;
  capacity?: number | null;
  supports_digital_education?: boolean | null;
  supports_professional_training?: boolean | null;
  is_accessible?: boolean | null;
};

export const NEM_COMPONENT_TYPE_OPTIONS: Array<{ value: NemComponentType; label: string; description: string }> = [
  { value: "FGB", label: "Formação Geral Básica", description: "Componentes obrigatórios da base comum do ensino médio." },
  { value: "ITINERARIO", label: "Itinerário formativo", description: "Aprofundamento por área do conhecimento." },
  { value: "FORMACAO_TECNICA", label: "Formação técnica e profissional", description: "Curso técnico, qualificação ou trilha profissional." },
  { value: "ELETIVA", label: "Eletiva", description: "Componente optativo complementar." },
  { value: "PROJETO_DE_VIDA", label: "Projeto de Vida", description: "Acompanhamento transversal das escolhas e transições." },
  { value: "PROJETO_INTEGRADOR", label: "Projeto integrador", description: "Integração curricular entre componentes e áreas." },
  { value: "APOIO", label: "Apoio / recomposição", description: "Apoio pedagógico, reforço ou recomposição de aprendizagens." },
];

export const NEM_KNOWLEDGE_AREA_OPTIONS: Array<{ value: NemKnowledgeArea; label: string }> = [
  { value: "LINGUAGENS", label: "Linguagens e suas Tecnologias" },
  { value: "MATEMATICA", label: "Matemática e suas Tecnologias" },
  { value: "CIENCIAS_NATUREZA", label: "Ciências da Natureza e suas Tecnologias" },
  { value: "CIENCIAS_HUMANAS", label: "Ciências Humanas e Sociais Aplicadas" },
  { value: "TECNICA", label: "Formação Técnica e Profissional" },
  { value: "INTEGRACAO", label: "Integração / Transversal" },
];

export const NEM_REQUIRED_COMPONENT_OPTIONS: Array<{ value: NemRequiredComponentCode; label: string; area: NemKnowledgeArea }> = [
  { value: "LP", label: "Língua Portuguesa e suas Literaturas", area: "LINGUAGENS" },
  { value: "LI", label: "Língua Inglesa", area: "LINGUAGENS" },
  { value: "ART", label: "Artes", area: "LINGUAGENS" },
  { value: "EDF", label: "Educação Física", area: "LINGUAGENS" },
  { value: "MAT", label: "Matemática", area: "MATEMATICA" },
  { value: "BIO", label: "Biologia", area: "CIENCIAS_NATUREZA" },
  { value: "FIS", label: "Física", area: "CIENCIAS_NATUREZA" },
  { value: "QUI", label: "Química", area: "CIENCIAS_NATUREZA" },
  { value: "FIL", label: "Filosofia", area: "CIENCIAS_HUMANAS" },
  { value: "GEO", label: "Geografia", area: "CIENCIAS_HUMANAS" },
  { value: "HIS", label: "História", area: "CIENCIAS_HUMANAS" },
  { value: "SOC", label: "Sociologia", area: "CIENCIAS_HUMANAS" },
];

export const NEM_OFFER_MODEL_OPTIONS: Array<{ value: NemOfferModel; label: string; description: string }> = [
  { value: "NEM_REGULAR", label: "Ensino médio regular por áreas", description: "FGB + itinerários de aprofundamento por áreas." },
  { value: "NEM_TECNICO_800", label: "Técnico articulado (800h)", description: "FGB + formação técnica de 800 horas." },
  { value: "NEM_TECNICO_1000", label: "Técnico articulado (1.000h)", description: "FGB + formação técnica de 1.000 horas." },
  { value: "NEM_TECNICO_1200", label: "Técnico articulado (1.200h)", description: "FGB + formação técnica de 1.200 horas." },
  { value: "QUALIFICACAO_PROFISSIONAL", label: "Qualificação profissional", description: "FGB + trilha profissional sem curso técnico completo." },
];

export const NEM_SERIES_YEAR_OPTIONS: Array<{ value: NemSeriesYear; label: string }> = [
  { value: "1A", label: "1ª série" },
  { value: "2A", label: "2ª série" },
  { value: "3A", label: "3ª série" },
  { value: "4A", label: "4ª série" },
];

export const NEM_ITINERARY_AXIS_OPTIONS: Array<{ value: NemItineraryAxis; label: string }> = [
  { value: "LINGUAGENS", label: "Aprofundamento em Linguagens" },
  { value: "MATEMATICA", label: "Aprofundamento em Matemática" },
  { value: "CIENCIAS_NATUREZA", label: "Aprofundamento em Ciências da Natureza" },
  { value: "CIENCIAS_HUMANAS", label: "Aprofundamento em Ciências Humanas" },
  { value: "TECNICO", label: "Trilha técnica e profissional" },
  { value: "INTEGRADO", label: "Percurso integrado / híbrido" },
];

export const NEM_TEACHER_ACADEMIC_DEGREE_OPTIONS: Array<{ value: NemTeacherAcademicDegree; label: string }> = [
  { value: "LICENCIATURA", label: "Licenciatura" },
  { value: "BACHARELADO", label: "Bacharelado" },
  { value: "TECNOLOGO", label: "Tecnólogo" },
  { value: "ESPECIALIZACAO", label: "Especialização" },
  { value: "MESTRADO", label: "Mestrado" },
  { value: "DOUTORADO", label: "Doutorado" },
  { value: "NOTORIO_SABER", label: "Notório saber" },
  { value: "OUTRO", label: "Outro" },
];

export const DEFAULT_NEM_SETTINGS: NemSettings = {
  weeks_per_school_year: 40,
  minutes_per_lesson: 50,
  total_annual_hours_target: 3000,
  fgb_min_hours_regular: 2400,
  itinerary_min_hours_regular: 600,
  technical_fgb_min_hours_800: 2200,
  technical_fgb_min_hours_1000: 2100,
  technical_fgb_min_hours_1200: 2100,
  min_itineraries_per_school: 2,
  state_code: null,
  state_curriculum_name: null,
  state_curriculum_version: null,
  state_reference_url: null,
  curriculum_alignment_notes: null,
  state_override_total_annual_hours_target: null,
  state_override_fgb_min_hours_regular: null,
  state_override_itinerary_min_hours_regular: null,
  state_override_min_itineraries_per_school: null,
  required_fgb_codes_override: NEM_REQUIRED_COMPONENT_OPTIONS.map((item) => item.value),
  enforce_digital_education: true,
  enforce_project_of_life: true,
  project_of_life_mode: "TRANSVERSAL",
  require_portuguese_and_math_every_year: true,
  require_spanish_offer: false,
  require_itineraries_presential: true,
};

export function normalizeNemComponentType(value: unknown): NemComponentType | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (NEM_COMPONENT_TYPE_OPTIONS.find((item) => item.value === key)?.value as NemComponentType | undefined) ?? null;
}

export function normalizeNemKnowledgeArea(value: unknown): NemKnowledgeArea | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (NEM_KNOWLEDGE_AREA_OPTIONS.find((item) => item.value === key)?.value as NemKnowledgeArea | undefined) ?? null;
}

export function normalizeNemRequiredComponent(value: unknown): NemRequiredComponentCode | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (NEM_REQUIRED_COMPONENT_OPTIONS.find((item) => item.value === key)?.value as NemRequiredComponentCode | undefined) ?? null;
}

export function normalizeNemOfferModel(value: unknown): NemOfferModel | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (NEM_OFFER_MODEL_OPTIONS.find((item) => item.value === key)?.value as NemOfferModel | undefined) ?? null;
}

export function normalizeNemSeriesYear(value: unknown): NemSeriesYear | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (NEM_SERIES_YEAR_OPTIONS.find((item) => item.value === key)?.value as NemSeriesYear | undefined) ?? null;
}

export function normalizeNemItineraryAxis(value: unknown): NemItineraryAxis | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (NEM_ITINERARY_AXIS_OPTIONS.find((item) => item.value === key)?.value as NemItineraryAxis | undefined) ?? null;
}

export function normalizeTeacherAcademicDegree(value: unknown): NemTeacherAcademicDegree | null {
  const key = String(value ?? "").trim().toUpperCase();
  return (NEM_TEACHER_ACADEMIC_DEGREE_OPTIONS.find((item) => item.value === key)?.value as NemTeacherAcademicDegree | undefined) ?? null;
}

export function labelNemComponentType(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return NEM_COMPONENT_TYPE_OPTIONS.find((item) => item.value === key)?.label ?? (key || "Não classificado");
}

export function labelNemKnowledgeArea(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return NEM_KNOWLEDGE_AREA_OPTIONS.find((item) => item.value === key)?.label ?? (key || "Sem área");
}

export function labelNemRequiredComponent(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return NEM_REQUIRED_COMPONENT_OPTIONS.find((item) => item.value === key)?.label ?? (key || "Não definido");
}

export function labelNemOfferModel(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return NEM_OFFER_MODEL_OPTIONS.find((item) => item.value === key)?.label ?? (key || "Não configurado");
}

export function labelNemSeriesYear(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return NEM_SERIES_YEAR_OPTIONS.find((item) => item.value === key)?.label ?? (key || "Série não definida");
}

export function labelNemItineraryAxis(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return NEM_ITINERARY_AXIS_OPTIONS.find((item) => item.value === key)?.label ?? (key || "Sem eixo definido");
}

export function labelTeacherAcademicDegree(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return NEM_TEACHER_ACADEMIC_DEGREE_OPTIONS.find((item) => item.value === key)?.label ?? (key || "Não informado");
}

export function mergeNemSettings(input?: Partial<NemSettings> | null): NemSettings {
  const requiredCodes = normalizeRequiredCodesArray(input?.required_fgb_codes_override);
  return {
    weeks_per_school_year: clampNumber(input?.weeks_per_school_year, 20, 60, DEFAULT_NEM_SETTINGS.weeks_per_school_year),
    minutes_per_lesson: clampNumber(input?.minutes_per_lesson, 30, 90, DEFAULT_NEM_SETTINGS.minutes_per_lesson),
    total_annual_hours_target: clampNumber(input?.total_annual_hours_target, 600, 5000, DEFAULT_NEM_SETTINGS.total_annual_hours_target),
    fgb_min_hours_regular: clampNumber(input?.fgb_min_hours_regular, 400, 5000, DEFAULT_NEM_SETTINGS.fgb_min_hours_regular),
    itinerary_min_hours_regular: clampNumber(input?.itinerary_min_hours_regular, 0, 3000, DEFAULT_NEM_SETTINGS.itinerary_min_hours_regular),
    technical_fgb_min_hours_800: clampNumber(input?.technical_fgb_min_hours_800, 400, 5000, DEFAULT_NEM_SETTINGS.technical_fgb_min_hours_800),
    technical_fgb_min_hours_1000: clampNumber(input?.technical_fgb_min_hours_1000, 400, 5000, DEFAULT_NEM_SETTINGS.technical_fgb_min_hours_1000),
    technical_fgb_min_hours_1200: clampNumber(input?.technical_fgb_min_hours_1200, 400, 5000, DEFAULT_NEM_SETTINGS.technical_fgb_min_hours_1200),
    min_itineraries_per_school: clampNumber(input?.min_itineraries_per_school, 1, 10, DEFAULT_NEM_SETTINGS.min_itineraries_per_school),
    state_code: normalizeStateCode(input?.state_code),
    state_curriculum_name: normalizeText(input?.state_curriculum_name),
    state_curriculum_version: normalizeText(input?.state_curriculum_version),
    state_reference_url: normalizeText(input?.state_reference_url),
    curriculum_alignment_notes: normalizeText(input?.curriculum_alignment_notes),
    state_override_total_annual_hours_target: normalizeOptionalNumber(input?.state_override_total_annual_hours_target, 600, 5000),
    state_override_fgb_min_hours_regular: normalizeOptionalNumber(input?.state_override_fgb_min_hours_regular, 400, 5000),
    state_override_itinerary_min_hours_regular: normalizeOptionalNumber(input?.state_override_itinerary_min_hours_regular, 0, 3000),
    state_override_min_itineraries_per_school: normalizeOptionalNumber(input?.state_override_min_itineraries_per_school, 1, 10),
    required_fgb_codes_override: requiredCodes.length ? requiredCodes : DEFAULT_NEM_SETTINGS.required_fgb_codes_override,
    enforce_digital_education: input?.enforce_digital_education !== false,
    enforce_project_of_life: input?.enforce_project_of_life !== false,
    project_of_life_mode: normalizeProjectOfLifeMode(input?.project_of_life_mode),
    require_portuguese_and_math_every_year: input?.require_portuguese_and_math_every_year !== false,
    require_spanish_offer: input?.require_spanish_offer === true,
    require_itineraries_presential: input?.require_itineraries_presential !== false,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeOptionalNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizeStateCode(value: unknown) {
  const key = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(key) ? key : null;
}

function normalizeRequiredCodesArray(value: unknown): NemRequiredComponentCode[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? String(value).split(",") : [];
  const unique = new Set<NemRequiredComponentCode>();
  for (const entry of raw) {
    const code = normalizeNemRequiredComponent(entry);
    if (code) unique.add(code);
  }
  return Array.from(unique);
}

export function getEffectiveNemThresholds(settingsLike?: Partial<NemSettings> | null) {
  const settings = mergeNemSettings(settingsLike ?? null);
  return {
    totalAnnualHoursTarget: settings.state_override_total_annual_hours_target ?? settings.total_annual_hours_target,
    fgbMinHoursRegular: settings.state_override_fgb_min_hours_regular ?? settings.fgb_min_hours_regular,
    itineraryMinHoursRegular: settings.state_override_itinerary_min_hours_regular ?? settings.itinerary_min_hours_regular,
    minItinerariesPerSchool: settings.state_override_min_itineraries_per_school ?? settings.min_itineraries_per_school,
    requiredFgbCodes: settings.required_fgb_codes_override?.length ? settings.required_fgb_codes_override : DEFAULT_NEM_SETTINGS.required_fgb_codes_override!,
    enforceDigitalEducation: settings.enforce_digital_education !== false,
    enforceProjectOfLife: settings.enforce_project_of_life !== false,
    projectOfLifeMode: normalizeProjectOfLifeMode(settings.project_of_life_mode) ?? DEFAULT_NEM_SETTINGS.project_of_life_mode!,
    requirePortugueseAndMathEveryYear: settings.require_portuguese_and_math_every_year !== false,
    requireSpanishOffer: settings.require_spanish_offer === true,
    requireItinerariesPresential: settings.require_itineraries_presential !== false,
  };
}

export function normalizeProjectOfLifeMode(value: unknown): NemProjectOfLifeMode | null {
  const key = String(value ?? "").trim().toUpperCase();
  return key === "TRANSVERSAL" || key === "COMPONENTE" ? (key as NemProjectOfLifeMode) : null;
}


function annualHoursFromLessons(lessonsPerWeek: number, settings: NemSettings) {
  return Number(((Number(lessonsPerWeek) || 0) * settings.weeks_per_school_year * settings.minutes_per_lesson) / 60);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export type NemComplianceReport = {
  totalLessonsPerWeek: number;
  estimatedAnnualHours: number;
  estimatedFgbHours: number;
  estimatedItineraryHours: number;
  estimatedTechnicalHours: number;
  estimatedProjectOfLifeHours: number;
  estimatedDigitalEducationHours: number;
  requiredFgbCodesPresent: string[];
  missingRequiredFgbCodes: string[];
  flags: string[];
  status: "ok" | "warning" | "critical";
};

export function validateClassCatalog(item?: Partial<NemClassMeta> | null) {
  const flags: string[] = [];
  if (!item) {
    return ["Turma sem metadados curriculares."];
  }
  if (!normalizeNemSeriesYear(item.series_year)) flags.push("Série não definida.");
  if (!item.school_year) flags.push("Ano letivo da turma não informado.");
  if (!item.entry_cohort) flags.push("Coorte de ingresso não informada.");
  if (!normalizeNemOfferModel(item.offer_model)) flags.push("Modelo de oferta do NEM não configurado.");
  if (!normalizeText(item.curriculum_version)) flags.push("Versão curricular da turma não informada.");
  if (!normalizeNemItineraryAxis(item.itinerary_axis)) flags.push("Eixo de itinerário não definido.");
  if (!normalizeText(item.itinerary_name) && !normalizeText(item.itinerary_offer_id)) flags.push("Nome do itinerário/trilha não informado.");
  if (item.is_presential === false) flags.push("Turma marcada como não presencial; confirme aderência da oferta à norma da rede.");
  if (!item.max_students || Number(item.max_students) <= 0) flags.push("Capacidade máxima da turma não informada.");
  if (item.active === false) flags.push("Turma marcada como inativa.");
  return flags;
}

export function validateSubjectCatalog(item?: Partial<NemSubjectMeta> | null) {
  const flags: string[] = [];
  if (!item) return ["Componente sem metadados curriculares."];
  const componentType = normalizeNemComponentType(item.component_type);
  if (!componentType) flags.push("Tipo curricular não classificado.");
  if (!normalizeNemKnowledgeArea(item.knowledge_area)) flags.push("Área do conhecimento não definida.");
  if (!item.annual_hours || Number(item.annual_hours) <= 0) flags.push("Carga horária anual não informada.");
  if (!item.weekly_lessons_suggested || Number(item.weekly_lessons_suggested) <= 0) flags.push("Sugestão de aulas semanais não informada.");
  if (!normalizeText(item.syllabus)) flags.push("Ementa/descrição do componente não informada.");
  if (!normalizeText(item.teacher_qualification_required)) flags.push("Habilitação docente requerida não informada.");
  if (componentType === "FGB" && !normalizeNemRequiredComponent(item.nem_component_code)) {
    flags.push("Código do componente obrigatório da FGB não informado.");
  }
  if (componentType === "ITINERARIO" && !normalizeNemItineraryAxis(item.itinerary_axis)) {
    flags.push("Eixo de itinerário do componente não informado.");
  }
  if (String(item.language_code ?? "").trim().toUpperCase() === "ES" && item.is_spanish_optative !== true) {
    flags.push("Componente de espanhol deveria estar marcado como oferta optativa/preferencial.");
  }
  return flags;
}

export function validateTeacherCatalog(item?: Partial<NemTeacherMeta> | null) {
  const flags: string[] = [];
  if (!item) return ["Docente sem cadastro detalhado."];
  if (!normalizeText(item.name)) flags.push("Nome do docente ausente.");
  if (!normalizeText(item.cpf)) flags.push("CPF do docente não informado.");
  if (!normalizeTeacherAcademicDegree(item.academic_degree)) flags.push("Titulação principal não informada.");
  if (!normalizeText(item.licensure_area)) flags.push("Área principal de habilitação não informada.");
  if (item.can_teach_nem !== true) flags.push("Docente ainda não sinalizado como apto para turmas do Novo Ensino Médio.");
  return flags;
}

export function validateRoomCatalog(item?: Partial<NemRoomMeta> | null) {
  const flags: string[] = [];
  if (!item) return ["Sala sem cadastro detalhado."];
  if (!normalizeText(item.name)) flags.push("Nome da sala ausente.");
  if (!normalizeText(item.room_type)) flags.push("Tipo de sala não informado.");
  if (!item.capacity || Number(item.capacity) <= 0) flags.push("Capacidade da sala não informada.");
  if (item.is_accessible !== true) flags.push("Acessibilidade da sala ainda não validada.");
  return flags;
}

export function computeNemCompliance(args: {
  classItem?: NemClassMeta | null;
  requirements: NemRequirementLike[];
  subjectById: Map<string, NemSubjectMeta>;
  settings?: Partial<NemSettings> | null;
}): NemComplianceReport {
  const settings = mergeNemSettings(args.settings ?? null);
  const effective = getEffectiveNemThresholds(settings);
  const offerModel = normalizeNemOfferModel(args.classItem?.offer_model ?? "") ?? "NEM_REGULAR";
  const seenRequired = new Set<string>();

  let totalLessonsPerWeek = 0;
  let estimatedAnnualHours = 0;
  let estimatedFgbHours = 0;
  let estimatedItineraryHours = 0;
  let estimatedTechnicalHours = 0;
  let estimatedProjectOfLifeHours = 0;
  let estimatedDigitalEducationHours = 0;

  for (const requirement of args.requirements) {
    const lessons = Math.max(0, Number(requirement.lessons_per_week ?? 0) || 0);
    if (!lessons) continue;
    totalLessonsPerWeek += lessons;
    const annualHours = annualHoursFromLessons(lessons, settings);
    estimatedAnnualHours += annualHours;

    const subject = args.subjectById.get(String(requirement.subject_id));
    const componentType = normalizeNemComponentType(subject?.component_type ?? "");
    const requiredCode = normalizeNemRequiredComponent(subject?.nem_component_code ?? "");

    if (componentType === "FGB") estimatedFgbHours += annualHours;
    if (componentType === "ITINERARIO") estimatedItineraryHours += annualHours;
    if (componentType === "FORMACAO_TECNICA") estimatedTechnicalHours += annualHours;
    if (subject?.is_project_of_life) estimatedProjectOfLifeHours += annualHours;
    if (subject?.is_digital_education) estimatedDigitalEducationHours += annualHours;
    if (requiredCode) seenRequired.add(requiredCode);
  }

  const flags = [...validateClassCatalog(args.classItem)];
  const requiredFgbCodes = effective.requiredFgbCodes;
  const missingRequiredFgbCodes = requiredFgbCodes.filter((code) => !seenRequired.has(code));

  if (estimatedAnnualHours < effective.totalAnnualHoursTarget) {
    flags.push(`Carga anual estimada abaixo da meta efetiva da escola (${round1(estimatedAnnualHours)}h de ${effective.totalAnnualHoursTarget}h).`);
  }

  const expectedFgbMin =
    offerModel === "NEM_TECNICO_800"
      ? settings.technical_fgb_min_hours_800
      : offerModel === "NEM_TECNICO_1000"
        ? settings.technical_fgb_min_hours_1000
        : offerModel === "NEM_TECNICO_1200"
          ? settings.technical_fgb_min_hours_1200
          : effective.fgbMinHoursRegular;

  if (estimatedFgbHours < expectedFgbMin) {
    flags.push(`FGB estimada abaixo do mínimo esperado para o modelo da turma (${round1(estimatedFgbHours)}h de ${expectedFgbMin}h).`);
  }

  if (offerModel === "NEM_REGULAR" || offerModel === "QUALIFICACAO_PROFISSIONAL") {
    if (estimatedItineraryHours < effective.itineraryMinHoursRegular) {
      flags.push(`Itinerário estimado abaixo do mínimo esperado (${round1(estimatedItineraryHours)}h de ${effective.itineraryMinHoursRegular}h).`);
    }
  }

  if (["NEM_TECNICO_800", "NEM_TECNICO_1000", "NEM_TECNICO_1200"].includes(offerModel) && estimatedTechnicalHours <= 0) {
    flags.push("A turma está marcada como técnico articulado, mas não possui componentes classificados como Formação Técnica e Profissional.");
  }

  if ((offerModel === "NEM_REGULAR" || offerModel === "QUALIFICACAO_PROFISSIONAL") && estimatedItineraryHours <= 0) {
    flags.push("A turma ainda não possui componentes classificados como Itinerário Formativo.");
  }

  if (missingRequiredFgbCodes.length) {
    flags.push(`Componentes obrigatórios da FGB ainda não mapeados: ${missingRequiredFgbCodes.map(labelNemRequiredComponent).join(", ")}.`);
  }

  if (effective.enforceDigitalEducation && estimatedDigitalEducationHours <= 0) {
    flags.push("Educação digital ainda não apareceu em nenhum componente vinculado à turma.");
  }

  if (effective.enforceProjectOfLife && effective.projectOfLifeMode === "COMPONENTE" && estimatedProjectOfLifeHours <= 0) {
    flags.push("Projeto de Vida configurado como componente, mas ainda não apareceu em nenhum componente vinculado à turma.");
  }

  if (effective.requireSpanishOffer) {
    const hasSpanish = args.requirements.some((requirement) => {
      const subject = args.subjectById.get(String(requirement.subject_id));
      return String(subject?.language_code ?? "").trim().toUpperCase() === "ES" || subject?.is_spanish_optative === true;
    });
    if (!hasSpanish) flags.push("A escola configurou monitoramento de espanhol, mas a turma não possui oferta identificada.");
  }

  if (effective.requireItinerariesPresential && args.classItem?.is_presential === false) {
    flags.push("A turma foi marcada como não presencial e a régua da escola exige itinerários presenciais.");
  }

  const status: NemComplianceReport["status"] =
    flags.length >= 4 ? "critical" : flags.length > 0 ? "warning" : "ok";

  return {
    totalLessonsPerWeek,
    estimatedAnnualHours: round1(estimatedAnnualHours),
    estimatedFgbHours: round1(estimatedFgbHours),
    estimatedItineraryHours: round1(estimatedItineraryHours),
    estimatedTechnicalHours: round1(estimatedTechnicalHours),
    estimatedProjectOfLifeHours: round1(estimatedProjectOfLifeHours),
    estimatedDigitalEducationHours: round1(estimatedDigitalEducationHours),
    requiredFgbCodesPresent: Array.from(seenRequired),
    missingRequiredFgbCodes,
    flags,
    status,
  };
}

export function groupRequirementsByComponentType(args: {
  requirements: NemRequirementLike[];
  subjectById: Map<string, NemSubjectMeta>;
  settings?: Partial<NemSettings> | null;
}) {
  const settings = mergeNemSettings(args.settings ?? null);
  const totals = new Map<string, { lessonsPerWeek: number; annualHours: number }>();

  for (const requirement of args.requirements) {
    const subject = args.subjectById.get(String(requirement.subject_id));
    const key = normalizeNemComponentType(subject?.component_type) ?? "SEM_CLASSIFICACAO";
    const entry = totals.get(key) ?? { lessonsPerWeek: 0, annualHours: 0 };
    const lessons = Math.max(0, Number(requirement.lessons_per_week ?? 0) || 0);
    entry.lessonsPerWeek += lessons;
    entry.annualHours += annualHoursFromLessons(lessons, settings);
    totals.set(key, entry);
  }

  return Array.from(totals.entries()).map(([key, value]) => ({
    key,
    label: key === "SEM_CLASSIFICACAO" ? "Sem classificação NEM" : labelNemComponentType(key),
    lessonsPerWeek: value.lessonsPerWeek,
    annualHours: round1(value.annualHours),
  }));
}

export function computeNetworkCurriculumAlignment(args: {
  classes: NemClassMeta[];
  requirementsByClass: Map<string, NemRequirementLike[]>;
  subjectById: Map<string, NemSubjectMeta>;
  settings?: Partial<NemSettings> | null;
  itineraryOffers?: NemItineraryOffer[] | null;
}) {
  const effective = getEffectiveNemThresholds(args.settings ?? null);
  const itinerarySubjects = new Set<string>();
  const itineraryAreas = new Set<string>();
  const itineraryOffers = (args.itineraryOffers ?? []).filter((item) => item?.active !== false);
  const formalOfferIds = new Set<string>();
  const formalOfferAreas = new Set<string>();
  const flags: string[] = [];

  for (const offer of itineraryOffers) {
    if (offer?.id) formalOfferIds.add(String(offer.id));
    const axis = normalizeNemItineraryAxis(offer?.axis) ?? normalizeNemKnowledgeArea(offer?.axis);
    if (axis) formalOfferAreas.add(axis);
    if (effective.requireItinerariesPresential && offer?.is_presential === false) {
      flags.push(`Oferta de itinerário ${offer.name ?? offer.id} marcada como não presencial.`);
    }
  }

  for (const classItem of args.classes) {
    const requirements = args.requirementsByClass.get(String(classItem.id)) ?? [];
    for (const req of requirements) {
      const subject = args.subjectById.get(String(req.subject_id));
      if (normalizeNemComponentType(subject?.component_type) === "ITINERARIO") {
        itinerarySubjects.add(String(req.subject_id));
        const area = normalizeNemKnowledgeArea(subject?.knowledge_area) ?? normalizeNemItineraryAxis(subject?.itinerary_axis);
        if (area) itineraryAreas.add(area);
      }
    }
    const classFlags = validateClassCatalog(classItem);
    if (classFlags.length) {
      flags.push(`${classItem.name ?? "Turma"}: ${classFlags[0]}`);
    }
  }

  const effectiveItineraryCount = formalOfferIds.size || itinerarySubjects.size;
  const effectiveAreas = formalOfferAreas.size ? formalOfferAreas : itineraryAreas;

  if (effectiveItineraryCount < effective.minItinerariesPerSchool) {
    flags.push(
      `A escola ainda não atingiu o mínimo configurado de itinerários distintos (${effectiveItineraryCount} de ${effective.minItinerariesPerSchool}).`,
    );
  }

  if (effectiveAreas.size === 0) {
    flags.push("Nenhuma área de itinerário foi identificada na oferta atual da escola.");
  }

  const settings = mergeNemSettings(args.settings ?? null);
  if (settings.state_code && !settings.state_curriculum_name) {
    flags.push("Há UF configurada, mas o nome do currículo estadual ainda não foi registrado.");
  }

  return {
    itinerarySubjectsCount: itinerarySubjects.size,
    itineraryOffersCount: effectiveItineraryCount,
    itineraryAreasCount: effectiveAreas.size,
    itineraryAreas: Array.from(effectiveAreas),
    flags,
    status: flags.length ? (flags.length >= 2 ? "critical" : "warning") : ("ok" as "ok" | "warning" | "critical"),
  };
}

export function isMissingColumnOrTableError(error: any) {
  const code = String(error?.code ?? "").toUpperCase();
  const msg = String(error?.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "42P01" ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

export const PATCH_NEM_MESSAGE =
  "Os campos do Novo Ensino Médio ainda não existem no banco. Rode os patches do NEM no Supabase para liberar classificação curricular, coortes, conformidade e cadastros completos.";


export function computeCohortCompliance(args: {
  classes: NemClassMeta[];
  requirementsByClass: Map<string, NemRequirementLike[]>;
  subjectById: Map<string, NemSubjectMeta>;
  settings?: Partial<NemSettings> | null;
  entryCohort: number;
  curriculumVersion?: string | null;
}) : NemCohortComplianceReport {
  const effective = getEffectiveNemThresholds(args.settings ?? null);
  const cohortClasses = args.classes.filter((item) => Number(item.entry_cohort ?? 0) === Number(args.entryCohort) && (!args.curriculumVersion || String(item.curriculum_version ?? "") === String(args.curriculumVersion)));
  const flags: string[] = [];
  const seriesCovered = new Set<string>();
  const requiredCodes = new Set<string>();
  const yearlyTracker = new Map<string, Set<string>>();
  let totalEstimatedHours = 0;
  let fgbHours = 0;
  let itineraryHours = 0;
  let technicalHours = 0;
  let projectOfLifeHours = 0;
  let digitalEducationHours = 0;
  let spanishOfferCount = 0;

  for (const classItem of cohortClasses) {
    if (classItem.series_year) seriesCovered.add(String(classItem.series_year));
    const report = computeNemCompliance({ classItem, requirements: args.requirementsByClass.get(String(classItem.id)) ?? [], subjectById: args.subjectById, settings: args.settings });
    totalEstimatedHours += report.estimatedAnnualHours;
    fgbHours += report.estimatedFgbHours;
    itineraryHours += report.estimatedItineraryHours;
    technicalHours += report.estimatedTechnicalHours;
    projectOfLifeHours += report.estimatedProjectOfLifeHours;
    digitalEducationHours += report.estimatedDigitalEducationHours;
    report.requiredFgbCodesPresent.forEach((code) => requiredCodes.add(code));

    const yearKey = String(classItem.series_year ?? "SEM_SERIE");
    const tracker = yearlyTracker.get(yearKey) ?? new Set<string>();
    const requirements = args.requirementsByClass.get(String(classItem.id)) ?? [];
    for (const req of requirements) {
      const subject = args.subjectById.get(String(req.subject_id));
      const requiredCode = normalizeNemRequiredComponent(subject?.nem_component_code);
      if (requiredCode) tracker.add(requiredCode);
      const isSpanish = String(subject?.language_code ?? "").trim().toUpperCase() === "ES" || subject?.is_spanish_optative === true;
      if (isSpanish) spanishOfferCount += 1;
    }
    yearlyTracker.set(yearKey, tracker);
  }

  const missingRequiredFgbCodes = effective.requiredFgbCodes.filter((code) => !requiredCodes.has(code));
  if (!cohortClasses.length) flags.push("Nenhuma turma encontrada para a coorte informada.");
  if (!["1A", "2A", "3A"].every((series) => seriesCovered.has(series))) flags.push("A coorte não cobre as três séries obrigatórias do percurso regular.");
  if (missingRequiredFgbCodes.length) flags.push(`A coorte ainda não cobre todos os componentes obrigatórios da FGB: ${missingRequiredFgbCodes.map(labelNemRequiredComponent).join(", ")}.`);
  if (effective.requirePortugueseAndMathEveryYear) {
    for (const series of ["1A", "2A", "3A"]) {
      const tracker = yearlyTracker.get(series) ?? new Set<string>();
      const missing = ["LP", "MAT"].filter((code) => !tracker.has(code));
      if (missing.length) flags.push(`${labelNemSeriesYear(series)} sem presença anual validada de ${missing.map(labelNemRequiredComponent).join(" e ")}.`);
    }
  }
  if (fgbHours < effective.fgbMinHoursRegular) flags.push(`A coorte acumulou ${round1(fgbHours)}h de FGB, abaixo do mínimo de ${effective.fgbMinHoursRegular}h.`);
  if (itineraryHours < effective.itineraryMinHoursRegular) flags.push(`A coorte acumulou ${round1(itineraryHours)}h de itinerário, abaixo do mínimo de ${effective.itineraryMinHoursRegular}h.`);
  if (effective.requireSpanishOffer && spanishOfferCount <= 0) flags.push("A escola marcou monitoramento de espanhol, mas a coorte não possui oferta identificada.");
  if (effective.enforceDigitalEducation && digitalEducationHours <= 0) flags.push("Educação digital não foi identificada na trajetória da coorte.");
  if (effective.enforceProjectOfLife && effective.projectOfLifeMode === "COMPONENTE" && projectOfLifeHours <= 0) flags.push("Projeto de Vida configurado como componente, mas não foi identificado na trajetória da coorte.");

  const status: NemCohortComplianceReport["status"] = flags.length >= 4 ? "critical" : flags.length > 0 ? "warning" : "ok";
  const curriculumVersionLabel = args.curriculumVersion ? `/${args.curriculumVersion}` : "";
  return {
    cohortKey: `${args.entryCohort}${curriculumVersionLabel}`,
    classIds: cohortClasses.map((item) => String(item.id)),
    seriesCovered: Array.from(seriesCovered),
    totalEstimatedHours: round1(totalEstimatedHours),
    fgbHours: round1(fgbHours),
    itineraryHours: round1(itineraryHours),
    technicalHours: round1(technicalHours),
    projectOfLifeHours: round1(projectOfLifeHours),
    digitalEducationHours: round1(digitalEducationHours),
    spanishOfferCount,
    requiredFgbCodesPresent: Array.from(requiredCodes),
    missingRequiredFgbCodes,
    flags,
    status,
  };
}
