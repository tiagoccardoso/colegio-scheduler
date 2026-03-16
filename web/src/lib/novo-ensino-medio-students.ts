export type Option = { value: string; label: string };

export const OFFER_MODEL_OPTIONS: Option[] = [
  { value: "NEM_REGULAR", label: "Ensino médio regular por áreas" },
  { value: "NEM_TECNICO_800", label: "Técnico articulado (800h)" },
  { value: "NEM_TECNICO_1000", label: "Técnico articulado (1.000h)" },
  { value: "NEM_TECNICO_1200", label: "Técnico articulado (1.200h)" },
  { value: "QUALIFICACAO_PROFISSIONAL", label: "Qualificação profissional" },
];

export const ENROLLMENT_STATUS_OPTIONS: Option[] = [
  { value: "ATIVA", label: "Ativa" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "TRANCADA", label: "Trancada" },
  { value: "TRANSFERIDA", label: "Transferida" },
  { value: "CONCLUIDA", label: "Concluída" },
  { value: "CANCELADA", label: "Cancelada" },
];

export const STUDENT_STATUS_OPTIONS: Option[] = [
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
  { value: "EGRESSO", label: "Egresso" },
];

export const RISK_LEVEL_OPTIONS: Option[] = [
  { value: "BAIXO", label: "Baixo" },
  { value: "MEDIO", label: "Médio" },
  { value: "ALTO", label: "Alto" },
  { value: "CRITICO", label: "Crítico" },
];

export const ITINERARY_AXIS_OPTIONS: Option[] = [
  { value: "LINGUAGENS", label: "Linguagens e suas Tecnologias" },
  { value: "MATEMATICA", label: "Matemática e suas Tecnologias" },
  { value: "CIENCIAS_NATUREZA", label: "Ciências da Natureza e suas Tecnologias" },
  { value: "CIENCIAS_HUMANAS", label: "Ciências Humanas e Sociais Aplicadas" },
  { value: "TECNICO", label: "Formação Técnica e Profissional" },
  { value: "INTEGRADO", label: "Percurso integrado / híbrido" },
];

export const ITINERARY_SELECTION_STATUS_OPTIONS: Option[] = [
  { value: "PENDENTE", label: "Pendente" },
  { value: "ESCOLHIDO", label: "Escolhido pelo estudante" },
  { value: "ALOCAO_REDE", label: "Alocado pela rede/escola" },
  { value: "ALTERADO", label: "Alterado posteriormente" },
];

export const ATTENDANCE_STATUS_OPTIONS: Option[] = [
  { value: "PRESENTE", label: "Presente" },
  { value: "FALTA", label: "Falta" },
  { value: "ATRASO", label: "Atraso" },
  { value: "JUSTIFICADA", label: "Falta justificada" },
];

export const ASSESSMENT_TYPE_OPTIONS: Option[] = [
  { value: "PROVA", label: "Prova" },
  { value: "TRABALHO", label: "Trabalho" },
  { value: "PROJETO", label: "Projeto" },
  { value: "PORTFOLIO", label: "Portfólio" },
  { value: "SEMINARIO", label: "Seminário" },
  { value: "OBSERVACAO", label: "Observação" },
];

export const ASSESSMENT_RESULT_OPTIONS: Option[] = [
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "SATISFATORIO", label: "Satisfatório" },
  { value: "ABAIXO_ESPERADO", label: "Abaixo do esperado" },
  { value: "RECUPERACAO", label: "Recuperação" },
];

export const RISK_INDICATOR_OPTIONS: Option[] = [
  { value: "FREQUENCIA", label: "Frequência" },
  { value: "RENDIMENTO", label: "Rendimento" },
  { value: "REMATRICULA", label: "Rematrícula" },
  { value: "PROJETO_DE_VIDA", label: "Projeto de Vida" },
  { value: "COMPORTAMENTO", label: "Comportamento" },
  { value: "OUTROS", label: "Outros" },
];

export const RISK_SEVERITY_OPTIONS: Option[] = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];

export const RISK_STATUS_OPTIONS: Option[] = [
  { value: "ABERTO", label: "Aberto" },
  { value: "EM_ACOMPANHAMENTO", label: "Em acompanhamento" },
  { value: "RESOLVIDO", label: "Resolvido" },
];

export function optionLabel(options: Option[], value: string | null | undefined, fallback = "—") {
  const key = String(value ?? "").trim().toUpperCase();
  if (!key) return fallback;
  return options.find((item) => item.value === key)?.label ?? key.replaceAll("_", " ");
}

export function cleanNullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function cleanUpperNullable(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text || null;
}

export function normalizeYear(value: FormDataEntryValue | null, fallback = new Date().getFullYear()) {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.trunc(num);
  if (rounded < 2020 || rounded > 2100) return fallback;
  return rounded;
}

export function normalizeOptionalYear(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.trunc(num);
  if (rounded < 2020 || rounded > 2100) return null;
  return rounded;
}

export function normalizeDecimal(value: FormDataEntryValue | null, max = 100) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(max, num));
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function badgeToneForRisk(value: string | null | undefined) {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "CRITICO") return "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";
  if (key === "ALTO") return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200";
  if (key === "MEDIO") return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200";
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";
}

export function badgeToneForAlert(value: string | null | undefined) {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "CRITICA") return "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";
  if (key === "ALTA") return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200";
  if (key === "MEDIA") return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200";
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";
}

export function computeAttendanceRate(records: Array<{ status: string | null | undefined }>) {
  if (!records.length) return null;
  let positive = 0;
  let total = 0;

  for (const row of records) {
    const key = String(row.status ?? "").trim().toUpperCase();
    if (!key) continue;
    total += 1;
    if (key === "PRESENTE" || key === "ATRASO" || key === "JUSTIFICADA") positive += 1;
  }

  if (!total) return null;
  return (positive / total) * 100;
}

export function computeAssessmentAverage(records: Array<{ score: number | null; max_score: number | null }>) {
  let totalScore = 0;
  let totalMax = 0;

  for (const row of records) {
    const score = Number(row.score ?? 0);
    const max = Number(row.max_score ?? 0);
    if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) continue;
    totalScore += score;
    totalMax += max;
  }

  if (!totalMax) return null;
  return (totalScore / totalMax) * 100;
}

export const HISTORY_OUTCOME_OPTIONS: Option[] = [
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "APROVADO", label: "Aprovado" },
  { value: "REPROVADO", label: "Reprovado" },
  { value: "TRANSFERIDO", label: "Transferido" },
  { value: "CONCLUIDO", label: "Concluído" },
];

export const QUALIFICATION_TYPE_OPTIONS: Option[] = [
  { value: "CURSO_TECNICO", label: "Curso técnico" },
  { value: "QUALIFICACAO", label: "Qualificação profissional" },
  { value: "FIC", label: "FIC / curta duração" },
  { value: "CERTIFICACAO_INTERMEDIARIA", label: "Certificação intermediária" },
];

export const CERTIFICATION_STATUS_OPTIONS: Option[] = [
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "APTA_PARA_CERTIFICAR", label: "Apta para certificar" },
  { value: "CERTIFICADA", label: "Certificada" },
  { value: "INTERROMPIDA", label: "Interrompida" },
];

export function normalizeInteger(value: FormDataEntryValue | null, min = 0, max = 100000) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.max(min, Math.min(max, Math.trunc(num)));
}

export function computeCompletionPercent(completedHours: number | null | undefined, totalHours: number | null | undefined) {
  const completed = Number(completedHours ?? 0);
  const total = Number(totalHours ?? 0);
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(100, (completed / total) * 100));
}

export function badgeToneForOutcome(value: string | null | undefined) {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "CONCLUIDO" || key === "APROVADO") return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (key === "REPROVADO") return "border-red-300 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";
  if (key === "TRANSFERIDO") return "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200";
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";
}


export const SEX_OPTIONS: Option[] = [
  { value: "MASCULINO", label: "Masculino" },
  { value: "FEMININO", label: "Feminino" },
  { value: "NAO_INFORMADO", label: "Não informar" },
];

export const GENDER_IDENTITY_OPTIONS: Option[] = [
  { value: "CISGENERO", label: "Cisgênero" },
  { value: "TRANSGENERO", label: "Transgênero" },
  { value: "NAO_BINARIO", label: "Não binário" },
  { value: "PREFERE_NAO_INFORMAR", label: "Prefere não informar" },
  { value: "OUTRO", label: "Outro" },
];

export const RACE_COLOR_OPTIONS: Option[] = [
  { value: "BRANCA", label: "Branca" },
  { value: "PRETA", label: "Preta" },
  { value: "PARDA", label: "Parda" },
  { value: "AMARELA", label: "Amarela" },
  { value: "INDIGENA", label: "Indígena" },
  { value: "NAO_DECLARADA", label: "Não declarada" },
];

export const SCHOOL_ORIGIN_NETWORK_OPTIONS: Option[] = [
  { value: "PUBLICA_MUNICIPAL", label: "Pública municipal" },
  { value: "PUBLICA_ESTADUAL", label: "Pública estadual" },
  { value: "PUBLICA_FEDERAL", label: "Pública federal" },
  { value: "PRIVADA", label: "Privada" },
  { value: "EXTERIOR", label: "Exterior" },
  { value: "NAO_INFORMADA", label: "Não informada" },
];

export const TRANSFER_TYPE_OPTIONS: Option[] = [
  { value: "INGRESSO_NOVO", label: "Ingresso novo" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "REMANEJAMENTO", label: "Remanejamento interno" },
  { value: "REINGRESSO", label: "Reingresso" },
  { value: "CONTINUIDADE", label: "Continuidade" },
];

export const GUARDIAN_RELATIONSHIP_OPTIONS: Option[] = [
  { value: "MAE", label: "Mãe" },
  { value: "PAI", label: "Pai" },
  { value: "AVO", label: "Avó" },
  { value: "AVO_M", label: "Avô" },
  { value: "TIO", label: "Tio/Tia" },
  { value: "IRMAO", label: "Irmão/Irmã" },
  { value: "RESPONSAVEL_LEGAL", label: "Responsável legal" },
  { value: "OUTRO", label: "Outro" },
];

export const GUARDIAN_TYPE_OPTIONS: Option[] = [
  { value: "PRINCIPAL", label: "Principal" },
  { value: "LEGAL", label: "Legal" },
  { value: "FINANCEIRO", label: "Financeiro" },
  { value: "EMERGENCIA", label: "Emergência" },
  { value: "OUTRO", label: "Outro" },
];

export const DOCUMENT_TYPE_OPTIONS: Option[] = [
  { value: "CERTIDAO_NASCIMENTO", label: "Certidão de nascimento" },
  { value: "RG", label: "RG / identidade" },
  { value: "CPF", label: "CPF" },
  { value: "COMPROVANTE_RESIDENCIA", label: "Comprovante de residência" },
  { value: "HISTORICO_ESCOLAR", label: "Histórico escolar" },
  { value: "DECLARACAO_TRANSFERENCIA", label: "Declaração de transferência" },
  { value: "FOTO", label: "Foto do estudante" },
  { value: "CARTAO_VACINA", label: "Carteira de vacinação" },
  { value: "LAUDO_MEDICO", label: "Laudo médico" },
  { value: "NIS", label: "Comprovante de NIS" },
  { value: "SUS", label: "Cartão SUS" },
  { value: "OUTRO", label: "Outro documento" },
];

export function normalizeBoolean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "on" || text === "true" || text === "1" || text === "sim";
}

export function sanitizeFileName(value: string) {
  return String(value || "arquivo")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120) || "arquivo";
}

export function formatDateBR(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}
