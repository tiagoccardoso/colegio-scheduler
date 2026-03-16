export type Option = { value: string; label: string };

export const DOCUMENT_ISSUE_TYPE_OPTIONS: Option[] = [
  { value: "DECLARACAO_MATRICULA", label: "Declaração de matrícula" },
  { value: "DECLARACAO_FREQUENCIA", label: "Declaração de frequência" },
  { value: "BOLETIM_SINTETICO", label: "Boletim sintético" },
  { value: "HISTORICO_ESCOLAR_NEM", label: "Histórico escolar do NEM" },
  { value: "CERTIFICADO_TRILHA_TECNICA", label: "Certificado de trilha técnica" },
  { value: "DECLARACAO_PROJETO_VIDA", label: "Declaração de Projeto de Vida" },
];

export type DocumentSettingsRow = {
  school_id: string;
  institution_name_override: string | null;
  network_name: string | null;
  city: string | null;
  state_code: string | null;
  ordinance_reference: string | null;
  header_text: string | null;
  footer_text: string | null;
  principal_name: string | null;
  principal_role_label: string | null;
  secretary_name: string | null;
  secretary_role_label: string | null;
  default_history_observation: string | null;
};

export function documentIssueTypeLabel(value: string | null | undefined, fallback = "Documento") {
  const key = String(value ?? "").trim().toUpperCase();
  if (!key) return fallback;
  return DOCUMENT_ISSUE_TYPE_OPTIONS.find((item) => item.value === key)?.label ?? key.replaceAll("_", " ");
}

export function cleanNullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function cleanUpperNullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text || null;
}

export function normalizeIsoDate(value: FormDataEntryValue | null, fallback = new Date()) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback.toISOString().slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return fallback.toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function formatDatePtBr(value: string | null | undefined, fallback = "—") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatLongDatePtBr(value: string | null | undefined, fallback = "—") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function parseJsonObject<T>(value: unknown, fallback: T): T {
  if (value && typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function defaultIssueNumber(issueType: string | null | undefined, issuedAt: string | null | undefined, studentRegistration: string | null | undefined) {
  const typeKey = String(issueType ?? "DOC").trim().toUpperCase() || "DOC";
  const date = String(issuedAt ?? "").trim() || new Date().toISOString().slice(0, 10);
  const year = date.slice(0, 4) || String(new Date().getFullYear());
  const suffix = String(studentRegistration ?? "").trim().slice(-4) || "0000";
  return `${typeKey}/${year}/${suffix}`;
}

export function truthyCount(values: Array<string | null | undefined>) {
  return values.filter((value) => String(value ?? "").trim()).length;
}

export function documentSettingsCompleteness(settings: Partial<DocumentSettingsRow> | null | undefined) {
  if (!settings) return 0;
  return truthyCount([
    settings.institution_name_override,
    settings.network_name,
    settings.city,
    settings.state_code,
    settings.ordinance_reference,
    settings.principal_name,
    settings.principal_role_label,
    settings.secretary_name,
    settings.secretary_role_label,
  ]);
}
