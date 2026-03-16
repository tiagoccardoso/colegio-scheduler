import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  badgeToneForRisk,
  cleanNullable,
  cleanUpperNullable,
  DOCUMENT_TYPE_OPTIONS,
  ENROLLMENT_STATUS_OPTIONS,
  formatDateBR,
  GUARDIAN_RELATIONSHIP_OPTIONS,
  GUARDIAN_TYPE_OPTIONS,
  ITINERARY_AXIS_OPTIONS,
  normalizeBoolean,
  normalizeOptionalYear,
  normalizeYear,
  OFFER_MODEL_OPTIONS,
  optionLabel,
  RACE_COLOR_OPTIONS,
  RISK_LEVEL_OPTIONS,
  sanitizeFileName,
  SCHOOL_ORIGIN_NETWORK_OPTIONS,
  SEX_OPTIONS,
  STUDENT_STATUS_OPTIONS,
  TRANSFER_TYPE_OPTIONS,
  GENDER_IDENTITY_OPTIONS,
} from "@/lib/novo-ensino-medio-students";

const CURRENT_YEAR = new Date().getFullYear();
const DOCUMENT_BUCKET = "student-documents";

function boolValue(value: boolean | null | undefined) {
  return !!value;
}

type StudentRow = {
  id: string;
  registration_number: string | null;
  full_name: string | null;
  social_name: string | null;
  birth_date: string | null;
  status: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  cpf: string | null;
  rg: string | null;
  rg_issuer: string | null;
  rg_state: string | null;
  birth_certificate_number: string | null;
  nationality: string | null;
  naturalness_city: string | null;
  naturalness_state: string | null;
  sex: string | null;
  gender_identity: string | null;
  race_color: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state_code: string | null;
  mother_name: string | null;
  father_name: string | null;
  nis_number: string | null;
  sus_card_number: string | null;
  blood_type: string | null;
  allergy_notes: string | null;
  health_notes: string | null;
  medication_notes: string | null;
  has_disability: boolean | null;
  disability_details: string | null;
  has_aee: boolean | null;
  uses_school_transport: boolean | null;
  social_program_notes: string | null;
  school_origin_name: string | null;
  school_origin_network: string | null;
  school_origin_city: string | null;
  school_origin_state: string | null;
  previous_school_year: number | null;
  previous_grade: string | null;
  transfer_type: string | null;
  transfer_date: string | null;
  created_at?: string | null;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  class_id: string;
  school_year: number | null;
  entry_cohort: number | null;
  curriculum_version: string | null;
  offer_model: string | null;
  enrollment_status: string | null;
  itinerary_axis: string | null;
  itinerary_name: string | null;
  elective_name: string | null;
  project_of_life_notes: string | null;
  risk_level: string | null;
  enrollment_date: string | null;
  created_at?: string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
};

type GuardianRow = {
  id: string;
  student_id: string;
  guardian_type: string | null;
  full_name: string | null;
  relationship: string | null;
  cpf: string | null;
  rg: string | null;
  phone: string | null;
  mobile_phone: string | null;
  email: string | null;
  profession: string | null;
  is_legal_guardian: boolean | null;
  is_financial_guardian: boolean | null;
  lives_with_student: boolean | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state_code: string | null;
  notes: string | null;
  created_at: string | null;
};

type DocumentRow = {
  id: string;
  student_id: string;
  document_type: string | null;
  document_name: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  issued_at: string | null;
  expires_at: string | null;
  required_on_enrollment: boolean | null;
  notes: string | null;
  created_at: string | null;
};

function classLabel(row: ClassRow | null | undefined) {
  if (!row) return "Sem turma";
  const shift = String(row.shift ?? "").trim();
  return `${row.name ?? "Turma"}${shift ? ` • ${shift}` : ""}`;
}

function pickPrimaryEnrollment(rows: EnrollmentRow[]) {
  return [...rows].sort((a, b) => {
    const statusA = String(a.enrollment_status ?? "").toUpperCase() === "ATIVA" ? 0 : 1;
    const statusB = String(b.enrollment_status ?? "").toUpperCase() === "ATIVA" ? 0 : 1;
    if (statusA !== statusB) return statusA - statusB;

    const yearA = Number(a.school_year ?? 0);
    const yearB = Number(b.school_year ?? 0);
    if (yearA !== yearB) return yearB - yearA;

    const createdA = new Date(a.created_at ?? 0).getTime();
    const createdB = new Date(b.created_at ?? 0).getTime();
    return createdB - createdA;
  })[0] ?? null;
}

function formatBytes(value: number | null | undefined) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return "—";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function inputValue(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function StudentFormFields({
  student,
  enrollment,
  classes,
}: {
  student?: Partial<StudentRow> | null;
  enrollment?: Partial<EnrollmentRow> | null;
  classes: ClassRow[];
}) {
  const currentYear = enrollment?.school_year ?? CURRENT_YEAR;
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-sm font-semibold">Identificação do estudante</div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Nome completo *</span>
            <input name="full_name" type="text" defaultValue={inputValue(student?.full_name)} required className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Matrícula interna</span>
            <input name="registration_number" type="text" defaultValue={inputValue(student?.registration_number)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Nome social</span>
            <input name="social_name" type="text" defaultValue={inputValue(student?.social_name)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Data de nascimento</span>
            <input name="birth_date" type="date" defaultValue={inputValue(student?.birth_date)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Status do cadastro</span>
            <select name="status" className="input" defaultValue={String(student?.status ?? "ATIVO").toUpperCase()}>
              {STUDENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">CPF</span>
            <input name="cpf" type="text" defaultValue={inputValue(student?.cpf)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">RG</span>
            <input name="rg" type="text" defaultValue={inputValue(student?.rg)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Órgão emissor</span>
            <input name="rg_issuer" type="text" defaultValue={inputValue(student?.rg_issuer)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">UF do RG</span>
            <input name="rg_state" type="text" maxLength={2} defaultValue={inputValue(student?.rg_state)} className="input" />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Certidão de nascimento</span>
            <input name="birth_certificate_number" type="text" defaultValue={inputValue(student?.birth_certificate_number)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Sexo</span>
            <select name="sex" className="input" defaultValue={String(student?.sex ?? "").toUpperCase()}>
              <option value="">Selecione</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Identidade de gênero</span>
            <select name="gender_identity" className="input" defaultValue={String(student?.gender_identity ?? "").toUpperCase()}>
              <option value="">Selecione</option>
              {GENDER_IDENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Raça/cor</span>
            <select name="race_color" className="input" defaultValue={String(student?.race_color ?? "").toUpperCase()}>
              <option value="">Selecione</option>
              {RACE_COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Nacionalidade</span>
            <input name="nationality" type="text" defaultValue={inputValue(student?.nationality ?? "Brasileira")} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Naturalidade — cidade</span>
            <input name="naturalness_city" type="text" defaultValue={inputValue(student?.naturalness_city)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Naturalidade — UF</span>
            <input name="naturalness_state" type="text" maxLength={2} defaultValue={inputValue(student?.naturalness_state)} className="input" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-sm font-semibold">Contato e endereço</div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">E-mail</span>
            <input name="email" type="email" defaultValue={inputValue(student?.email)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Telefone</span>
            <input name="phone" type="text" defaultValue={inputValue(student?.phone)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Celular</span>
            <input name="mobile_phone" type="text" defaultValue={inputValue(student?.mobile_phone)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">CEP</span>
            <input name="zip_code" type="text" defaultValue={inputValue(student?.zip_code)} className="input" />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Logradouro</span>
            <input name="street" type="text" defaultValue={inputValue(student?.street)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Número</span>
            <input name="street_number" type="text" defaultValue={inputValue(student?.street_number)} className="input" />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Complemento</span>
            <input name="address_complement" type="text" defaultValue={inputValue(student?.address_complement)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Bairro</span>
            <input name="neighborhood" type="text" defaultValue={inputValue(student?.neighborhood)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Cidade</span>
            <input name="city" type="text" defaultValue={inputValue(student?.city)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">UF</span>
            <input name="state_code" type="text" maxLength={2} defaultValue={inputValue(student?.state_code)} className="input" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-sm font-semibold">Filiação, benefícios e saúde</div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Mãe</span>
            <input name="mother_name" type="text" defaultValue={inputValue(student?.mother_name)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Pai</span>
            <input name="father_name" type="text" defaultValue={inputValue(student?.father_name)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Contato principal na matrícula</span>
            <input name="guardian_name" type="text" defaultValue={inputValue(student?.guardian_name)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Telefone do contato principal</span>
            <input name="guardian_phone" type="text" defaultValue={inputValue(student?.guardian_phone)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">NIS</span>
            <input name="nis_number" type="text" defaultValue={inputValue(student?.nis_number)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Cartão SUS</span>
            <input name="sus_card_number" type="text" defaultValue={inputValue(student?.sus_card_number)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Tipo sanguíneo</span>
            <input name="blood_type" type="text" defaultValue={inputValue(student?.blood_type)} className="input" />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <input name="has_disability" type="checkbox" defaultChecked={boolValue(student?.has_disability)} />
            Possui deficiência
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <input name="has_aee" type="checkbox" defaultChecked={boolValue(student?.has_aee)} />
            Recebe AEE
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <input name="uses_school_transport" type="checkbox" defaultChecked={boolValue(student?.uses_school_transport)} />
            Usa transporte escolar
          </label>
          <label className="grid gap-2 xl:col-span-3">
            <span className="text-sm font-semibold">Detalhes de deficiência / acessibilidade</span>
            <textarea name="disability_details" rows={3} defaultValue={inputValue(student?.disability_details)} className="input min-h-[90px]" />
          </label>
          <label className="grid gap-2 xl:col-span-3">
            <span className="text-sm font-semibold">Alergias</span>
            <textarea name="allergy_notes" rows={3} defaultValue={inputValue(student?.allergy_notes)} className="input min-h-[90px]" />
          </label>
          <label className="grid gap-2 xl:col-span-3">
            <span className="text-sm font-semibold">Saúde e observações clínicas</span>
            <textarea name="health_notes" rows={3} defaultValue={inputValue(student?.health_notes)} className="input min-h-[90px]" />
          </label>
          <label className="grid gap-2 xl:col-span-3">
            <span className="text-sm font-semibold">Medicamentos de uso contínuo</span>
            <textarea name="medication_notes" rows={3} defaultValue={inputValue(student?.medication_notes)} className="input min-h-[90px]" />
          </label>
          <label className="grid gap-2 xl:col-span-3">
            <span className="text-sm font-semibold">Programas sociais / benefícios</span>
            <textarea name="social_program_notes" rows={3} defaultValue={inputValue(student?.social_program_notes)} className="input min-h-[90px]" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-sm font-semibold">Escola de origem e transferência</div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Escola de origem</span>
            <input name="school_origin_name" type="text" defaultValue={inputValue(student?.school_origin_name)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Rede</span>
            <select name="school_origin_network" className="input" defaultValue={String(student?.school_origin_network ?? "").toUpperCase()}>
              <option value="">Selecione</option>
              {SCHOOL_ORIGIN_NETWORK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Cidade da escola de origem</span>
            <input name="school_origin_city" type="text" defaultValue={inputValue(student?.school_origin_city)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">UF da escola de origem</span>
            <input name="school_origin_state" type="text" maxLength={2} defaultValue={inputValue(student?.school_origin_state)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Ano cursado anteriormente</span>
            <input name="previous_school_year" type="number" min={2010} max={2100} defaultValue={inputValue(student?.previous_school_year)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Série / etapa anterior</span>
            <input name="previous_grade" type="text" defaultValue={inputValue(student?.previous_grade)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Tipo de ingresso</span>
            <select name="transfer_type" className="input" defaultValue={String(student?.transfer_type ?? "").toUpperCase()}>
              <option value="">Selecione</option>
              {TRANSFER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Data da transferência/ingresso</span>
            <input name="transfer_date" type="date" defaultValue={inputValue(student?.transfer_date)} className="input" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="text-sm font-semibold">Matrícula inicial e trilha do estudante</div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Turma atual</span>
            <select name="class_id" className="input" defaultValue={inputValue(enrollment?.class_id)}>
              <option value="">Salvar sem turma agora</option>
              {classes.map((row) => (
                <option key={row.id} value={row.id}>
                  {classLabel(row)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Data da matrícula</span>
            <input name="enrollment_date" type="date" defaultValue={inputValue(enrollment?.enrollment_date)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Ano letivo</span>
            <input name="school_year" type="number" min={2024} max={2100} defaultValue={inputValue(currentYear)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Coorte de ingresso</span>
            <input name="entry_cohort" type="number" min={2024} max={2100} defaultValue={inputValue(enrollment?.entry_cohort ?? CURRENT_YEAR)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Versão curricular</span>
            <input name="curriculum_version" type="text" defaultValue={inputValue(enrollment?.curriculum_version)} className="input" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Modelo de oferta</span>
            <select name="offer_model" className="input" defaultValue={String(enrollment?.offer_model ?? "REGULAR_AREAS").toUpperCase()}>
              {OFFER_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Status da matrícula</span>
            <select name="enrollment_status" className="input" defaultValue={String(enrollment?.enrollment_status ?? "ATIVA").toUpperCase()}>
              {ENROLLMENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Risco inicial</span>
            <select name="risk_level" className="input" defaultValue={String(enrollment?.risk_level ?? "BAIXO").toUpperCase()}>
              {RISK_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Eixo do itinerário</span>
            <select name="itinerary_axis" className="input" defaultValue={String(enrollment?.itinerary_axis ?? "").toUpperCase()}>
              <option value="">Definir depois</option>
              {ITINERARY_AXIS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Nome do itinerário</span>
            <input name="itinerary_name" type="text" defaultValue={inputValue(enrollment?.itinerary_name)} className="input" />
          </label>
          <label className="grid gap-2 xl:col-span-2">
            <span className="text-sm font-semibold">Eletiva / aprofundamento local</span>
            <input name="elective_name" type="text" defaultValue={inputValue(enrollment?.elective_name)} className="input" />
          </label>
          <label className="grid gap-2 xl:col-span-3">
            <span className="text-sm font-semibold">Projeto de Vida</span>
            <textarea name="project_of_life_notes" rows={4} defaultValue={inputValue(enrollment?.project_of_life_notes)} className="input min-h-[110px]" />
          </label>
          <label className="grid gap-2 xl:col-span-3">
            <span className="text-sm font-semibold">Observações gerais</span>
            <textarea name="notes" rows={4} defaultValue={inputValue(student?.notes)} className="input min-h-[110px]" />
          </label>
        </div>
      </div>
    </div>
  );
}

function StudentSummary({ student }: { student: StudentRow }) {
  return (
    <div className="grid gap-1 text-sm">
      <div className="font-semibold">{student.full_name ?? "—"}</div>
      <div className="text-zinc-500 dark:text-zinc-400">Matrícula: {student.registration_number || "—"}</div>
      <div className="text-zinc-500 dark:text-zinc-400">CPF: {student.cpf || "—"}</div>
      <div className="text-zinc-500 dark:text-zinc-400">Nascimento: {formatDateBR(student.birth_date)}</div>
      <div className="text-zinc-500 dark:text-zinc-400">Contato principal: {student.guardian_name || "—"}</div>
    </div>
  );
}

function buildStudentPayload(formData: FormData, profileSchoolId: string) {
  return {
    school_id: profileSchoolId,
    registration_number: cleanNullable(formData.get("registration_number")),
    full_name: cleanNullable(formData.get("full_name")),
    social_name: cleanNullable(formData.get("social_name")),
    birth_date: cleanNullable(formData.get("birth_date")),
    status: cleanUpperNullable(formData.get("status")) ?? "ATIVO",
    guardian_name: cleanNullable(formData.get("guardian_name")),
    guardian_phone: cleanNullable(formData.get("guardian_phone")),
    notes: cleanNullable(formData.get("notes")),
    cpf: cleanNullable(formData.get("cpf")),
    rg: cleanNullable(formData.get("rg")),
    rg_issuer: cleanNullable(formData.get("rg_issuer")),
    rg_state: cleanUpperNullable(formData.get("rg_state")),
    birth_certificate_number: cleanNullable(formData.get("birth_certificate_number")),
    nationality: cleanNullable(formData.get("nationality")),
    naturalness_city: cleanNullable(formData.get("naturalness_city")),
    naturalness_state: cleanUpperNullable(formData.get("naturalness_state")),
    sex: cleanUpperNullable(formData.get("sex")),
    gender_identity: cleanUpperNullable(formData.get("gender_identity")),
    race_color: cleanUpperNullable(formData.get("race_color")),
    email: cleanNullable(formData.get("email")),
    phone: cleanNullable(formData.get("phone")),
    mobile_phone: cleanNullable(formData.get("mobile_phone")),
    zip_code: cleanNullable(formData.get("zip_code")),
    street: cleanNullable(formData.get("street")),
    street_number: cleanNullable(formData.get("street_number")),
    address_complement: cleanNullable(formData.get("address_complement")),
    neighborhood: cleanNullable(formData.get("neighborhood")),
    city: cleanNullable(formData.get("city")),
    state_code: cleanUpperNullable(formData.get("state_code")),
    mother_name: cleanNullable(formData.get("mother_name")),
    father_name: cleanNullable(formData.get("father_name")),
    nis_number: cleanNullable(formData.get("nis_number")),
    sus_card_number: cleanNullable(formData.get("sus_card_number")),
    blood_type: cleanNullable(formData.get("blood_type")),
    allergy_notes: cleanNullable(formData.get("allergy_notes")),
    health_notes: cleanNullable(formData.get("health_notes")),
    medication_notes: cleanNullable(formData.get("medication_notes")),
    has_disability: normalizeBoolean(formData.get("has_disability")),
    disability_details: cleanNullable(formData.get("disability_details")),
    has_aee: normalizeBoolean(formData.get("has_aee")),
    uses_school_transport: normalizeBoolean(formData.get("uses_school_transport")),
    social_program_notes: cleanNullable(formData.get("social_program_notes")),
    school_origin_name: cleanNullable(formData.get("school_origin_name")),
    school_origin_network: cleanUpperNullable(formData.get("school_origin_network")),
    school_origin_city: cleanNullable(formData.get("school_origin_city")),
    school_origin_state: cleanUpperNullable(formData.get("school_origin_state")),
    previous_school_year: normalizeOptionalYear(formData.get("previous_school_year")),
    previous_grade: cleanNullable(formData.get("previous_grade")),
    transfer_type: cleanUpperNullable(formData.get("transfer_type")),
    transfer_date: cleanNullable(formData.get("transfer_date")),
  };
}

function buildEnrollmentPayload(formData: FormData, schoolId: string, studentId: string, classId: string) {
  return {
    school_id: schoolId,
    student_id: studentId,
    class_id: classId,
    school_year: normalizeYear(formData.get("school_year"), CURRENT_YEAR),
    entry_cohort: normalizeOptionalYear(formData.get("entry_cohort")),
    curriculum_version: cleanNullable(formData.get("curriculum_version")),
    offer_model: cleanUpperNullable(formData.get("offer_model")),
    enrollment_status: cleanUpperNullable(formData.get("enrollment_status")) ?? "ATIVA",
    itinerary_axis: cleanUpperNullable(formData.get("itinerary_axis")),
    itinerary_name: cleanNullable(formData.get("itinerary_name")),
    elective_name: cleanNullable(formData.get("elective_name")),
    project_of_life_notes: cleanNullable(formData.get("project_of_life_notes")),
    risk_level: cleanUpperNullable(formData.get("risk_level")) ?? "BAIXO",
    enrollment_date: cleanNullable(formData.get("enrollment_date")),
  };
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [studentsRes, enrollmentsRes, classesRes, guardiansRes, documentsRes] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, registration_number, full_name, social_name, birth_date, status, guardian_name, guardian_phone, notes, cpf, rg, rg_issuer, rg_state, birth_certificate_number, nationality, naturalness_city, naturalness_state, sex, gender_identity, race_color, email, phone, mobile_phone, zip_code, street, street_number, address_complement, neighborhood, city, state_code, mother_name, father_name, nis_number, sus_card_number, blood_type, allergy_notes, health_notes, medication_notes, has_disability, disability_details, has_aee, uses_school_transport, social_program_notes, school_origin_name, school_origin_network, school_origin_city, school_origin_state, previous_school_year, previous_grade, transfer_type, transfer_date, created_at",
      )
      .eq("school_id", profile.school_id)
      .order("full_name", { ascending: true }),
    supabase
      .from("student_enrollments")
      .select(
        "id, student_id, class_id, school_year, entry_cohort, curriculum_version, offer_model, enrollment_status, itinerary_axis, itinerary_name, elective_name, project_of_life_notes, risk_level, enrollment_date, created_at",
      )
      .eq("school_id", profile.school_id)
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase
      .from("student_guardians")
      .select(
        "id, student_id, guardian_type, full_name, relationship, cpf, rg, phone, mobile_phone, email, profession, is_legal_guardian, is_financial_guardian, lives_with_student, zip_code, street, street_number, address_complement, neighborhood, city, state_code, notes, created_at",
      )
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_document_files")
      .select(
        "id, student_id, document_type, document_name, storage_path, mime_type, file_size_bytes, issued_at, expires_at, required_on_enrollment, notes, created_at",
      )
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false }),
  ]);

  const students = (studentsRes.data as StudentRow[] | null) ?? [];
  const enrollments = (enrollmentsRes.data as EnrollmentRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const guardians = (guardiansRes.data as GuardianRow[] | null) ?? [];
  const documents = (documentsRes.data as DocumentRow[] | null) ?? [];

  const classMap = new Map(classes.map((row) => [row.id, row]));
  const enrollmentsByStudent = new Map<string, EnrollmentRow[]>();
  for (const enrollment of enrollments) {
    const list = enrollmentsByStudent.get(enrollment.student_id) ?? [];
    list.push(enrollment);
    enrollmentsByStudent.set(enrollment.student_id, list);
  }
  const guardiansByStudent = new Map<string, GuardianRow[]>();
  for (const guardian of guardians) {
    const list = guardiansByStudent.get(guardian.student_id) ?? [];
    list.push(guardian);
    guardiansByStudent.set(guardian.student_id, list);
  }
  const documentsByStudent = new Map<string, DocumentRow[]>();
  for (const document of documents) {
    const list = documentsByStudent.get(document.student_id) ?? [];
    list.push(document);
    documentsByStudent.set(document.student_id, list);
  }

  const signedEntries = await Promise.all(
    documents.map(async (document) => {
      if (!document.storage_path) return [document.id, null] as const;
      const { data } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrl(document.storage_path, 60 * 60);
      return [document.id, data?.signedUrl ?? null] as const;
    }),
  );
  const documentUrlMap = new Map(signedEntries);

  const rows = students.map((student) => {
    const primaryEnrollment = pickPrimaryEnrollment(enrollmentsByStudent.get(student.id) ?? []);
    return {
      student,
      enrollment: primaryEnrollment,
      classRow: primaryEnrollment ? classMap.get(primaryEnrollment.class_id) ?? null : null,
      guardians: guardiansByStudent.get(student.id) ?? [],
      documents: documentsByStudent.get(student.id) ?? [],
    };
  });

  const totalStudents = rows.length;
  const activeEnrollments = rows.filter((row) => String(row.enrollment?.enrollment_status ?? "").toUpperCase() === "ATIVA").length;
  const noClassCount = rows.filter((row) => !row.enrollment).length;
  const highRiskCount = rows.filter((row) => {
    const risk = String(row.enrollment?.risk_level ?? "").toUpperCase();
    return risk === "ALTO" || risk === "CRITICO";
  }).length;
  const documentsCount = documents.length;

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const studentPayload = buildStudentPayload(formData, profile.school_id);
    if (!studentPayload.full_name) redirect("/students?error=" + encodeMsg("Informe o nome completo do estudante."));

    const { data: student, error: studentError } = await supabase.from("students").insert(studentPayload).select("id").single();
    if (studentError || !student?.id) {
      redirect("/students?error=" + encodeMsg(studentError?.message || "Não foi possível cadastrar o estudante."));
    }

    const classId = cleanNullable(formData.get("class_id"));
    if (classId) {
      const enrollmentPayload = buildEnrollmentPayload(formData, profile.school_id, String(student.id), classId);
      const { error: enrollmentError } = await supabase.from("student_enrollments").insert(enrollmentPayload);
      if (enrollmentError) redirect("/students?error=" + encodeMsg(enrollmentError.message));
    }

    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Estudante cadastrado. Agora você pode anexar responsáveis e documentos."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const studentId = String(formData.get("id") || "").trim();
    const enrollmentId = String(formData.get("enrollment_id") || "").trim();
    if (!studentId) redirect("/students?error=" + encodeMsg("ID do estudante inválido."));

    const studentPayload = buildStudentPayload(formData, profile.school_id);
    if (!studentPayload.full_name) redirect("/students?error=" + encodeMsg("Informe o nome completo do estudante."));

    const { error: studentError } = await supabase.from("students").update(studentPayload).eq("id", studentId).eq("school_id", profile.school_id);
    if (studentError) redirect("/students?error=" + encodeMsg(studentError.message));

    const classId = cleanNullable(formData.get("class_id"));
    if (enrollmentId && classId) {
      const enrollmentPayload = buildEnrollmentPayload(formData, profile.school_id, studentId, classId);
      const { error: enrollmentError } = await supabase
        .from("student_enrollments")
        .update(enrollmentPayload)
        .eq("id", enrollmentId)
        .eq("school_id", profile.school_id);
      if (enrollmentError) redirect("/students?error=" + encodeMsg(enrollmentError.message));
    } else if (!enrollmentId && classId) {
      const enrollmentPayload = buildEnrollmentPayload(formData, profile.school_id, studentId, classId);
      const { error: enrollmentError } = await supabase.from("student_enrollments").insert(enrollmentPayload);
      if (enrollmentError) redirect("/students?error=" + encodeMsg(enrollmentError.message));
    } else if (enrollmentId && !classId) {
      const { error: enrollmentError } = await supabase.from("student_enrollments").delete().eq("id", enrollmentId).eq("school_id", profile.school_id);
      if (enrollmentError) redirect("/students?error=" + encodeMsg(enrollmentError.message));
    }

    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Cadastro do estudante atualizado."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "").trim();
    if (!id) redirect("/students?error=" + encodeMsg("ID do estudante inválido."));

    const studentDocs = await supabase.from("student_document_files").select("storage_path").eq("school_id", profile.school_id).eq("student_id", id);
    const paths = ((studentDocs.data as Array<{ storage_path: string | null }> | null) ?? [])
      .map((row) => row.storage_path)
      .filter((row): row is string => !!row);
    if (paths.length) await supabase.storage.from(DOCUMENT_BUCKET).remove(paths);

    const { error } = await supabase.from("students").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/students?error=" + encodeMsg(error.message));

    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Estudante removido."));
  }

  async function createGuardianAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const studentId = String(formData.get("student_id") || "").trim();
    const fullName = cleanNullable(formData.get("full_name"));
    if (!studentId || !fullName) redirect("/students?error=" + encodeMsg("Informe estudante e nome do responsável."));

    const { error } = await supabase.from("student_guardians").insert({
      school_id: profile.school_id,
      student_id: studentId,
      guardian_type: cleanUpperNullable(formData.get("guardian_type")),
      full_name: fullName,
      relationship: cleanUpperNullable(formData.get("relationship")),
      cpf: cleanNullable(formData.get("cpf")),
      rg: cleanNullable(formData.get("rg")),
      phone: cleanNullable(formData.get("phone")),
      mobile_phone: cleanNullable(formData.get("mobile_phone")),
      email: cleanNullable(formData.get("email")),
      profession: cleanNullable(formData.get("profession")),
      is_legal_guardian: normalizeBoolean(formData.get("is_legal_guardian")),
      is_financial_guardian: normalizeBoolean(formData.get("is_financial_guardian")),
      lives_with_student: normalizeBoolean(formData.get("lives_with_student")),
      zip_code: cleanNullable(formData.get("zip_code")),
      street: cleanNullable(formData.get("street")),
      street_number: cleanNullable(formData.get("street_number")),
      address_complement: cleanNullable(formData.get("address_complement")),
      neighborhood: cleanNullable(formData.get("neighborhood")),
      city: cleanNullable(formData.get("city")),
      state_code: cleanUpperNullable(formData.get("state_code")),
      notes: cleanNullable(formData.get("notes")),
    });

    if (error) redirect("/students?error=" + encodeMsg(error.message));
    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Responsável adicionado."));
  }

  async function updateGuardianAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "").trim();
    const fullName = cleanNullable(formData.get("full_name"));
    if (!id || !fullName) redirect("/students?error=" + encodeMsg("Responsável inválido."));

    const { error } = await supabase
      .from("student_guardians")
      .update({
        guardian_type: cleanUpperNullable(formData.get("guardian_type")),
        full_name: fullName,
        relationship: cleanUpperNullable(formData.get("relationship")),
        cpf: cleanNullable(formData.get("cpf")),
        rg: cleanNullable(formData.get("rg")),
        phone: cleanNullable(formData.get("phone")),
        mobile_phone: cleanNullable(formData.get("mobile_phone")),
        email: cleanNullable(formData.get("email")),
        profession: cleanNullable(formData.get("profession")),
        is_legal_guardian: normalizeBoolean(formData.get("is_legal_guardian")),
        is_financial_guardian: normalizeBoolean(formData.get("is_financial_guardian")),
        lives_with_student: normalizeBoolean(formData.get("lives_with_student")),
        zip_code: cleanNullable(formData.get("zip_code")),
        street: cleanNullable(formData.get("street")),
        street_number: cleanNullable(formData.get("street_number")),
        address_complement: cleanNullable(formData.get("address_complement")),
        neighborhood: cleanNullable(formData.get("neighborhood")),
        city: cleanNullable(formData.get("city")),
        state_code: cleanUpperNullable(formData.get("state_code")),
        notes: cleanNullable(formData.get("notes")),
      })
      .eq("id", id)
      .eq("school_id", profile.school_id);

    if (error) redirect("/students?error=" + encodeMsg(error.message));
    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Responsável atualizado."));
  }

  async function deleteGuardianAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "").trim();
    if (!id) redirect("/students?error=" + encodeMsg("Responsável inválido."));

    const { error } = await supabase.from("student_guardians").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/students?error=" + encodeMsg(error.message));
    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Responsável removido."));
  }

  async function uploadDocumentAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const studentId = String(formData.get("student_id") || "").trim();
    const documentType = cleanUpperNullable(formData.get("document_type"));
    const documentName = cleanNullable(formData.get("document_name"));
    const fileEntry = formData.get("file");
    if (!studentId || !documentType || !(fileEntry instanceof File) || fileEntry.size <= 0) {
      redirect("/students?error=" + encodeMsg("Selecione o estudante, o tipo do documento e o arquivo."));
    }
    const file = fileEntry as File;
    if (file.size > 10 * 1024 * 1024) {
      redirect("/students?error=" + encodeMsg("Arquivo muito grande. Envie até 10MB por documento."));
    }

    const docId = crypto.randomUUID();
    const safeName = sanitizeFileName(file.name || `${docId}.bin`);
    const storagePath = `schools/${profile.school_id}/students/${studentId}/${docId}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(DOCUMENT_BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (uploadError) redirect("/students?error=" + encodeMsg(uploadError.message));

    const { error: insertError } = await supabase.from("student_document_files").insert({
      id: docId,
      school_id: profile.school_id,
      student_id: studentId,
      document_type: documentType,
      document_name: documentName || safeName,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      issued_at: cleanNullable(formData.get("issued_at")),
      expires_at: cleanNullable(formData.get("expires_at")),
      required_on_enrollment: normalizeBoolean(formData.get("required_on_enrollment")),
      notes: cleanNullable(formData.get("notes")),
    });

    if (insertError) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
      redirect("/students?error=" + encodeMsg(insertError.message));
    }

    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Documento anexado."));
  }

  async function deleteDocumentAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "").trim();
    const path = String(formData.get("storage_path") || "").trim();
    if (!id || !path) redirect("/students?error=" + encodeMsg("Documento inválido."));

    await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
    const { error } = await supabase.from("student_document_files").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/students?error=" + encodeMsg(error.message));

    revalidatePath("/students");
    redirect("/students?msg=" + encodeMsg("Documento removido."));
  }

  const combinedError = error || studentsRes.error?.message || enrollmentsRes.error?.message || classesRes.error?.message || guardiansRes.error?.message || documentsRes.error?.message || null;

  return (
    <Shell
      title="Estudantes"
      subtitle="Cadastro completo para matrícula: identificação, endereço, saúde, escola de origem, responsáveis e anexos de documentos."
    >
      <div className="grid gap-4">
        <Flash message={combinedError || msg} variant={combinedError ? "error" : msg ? "success" : "info"} />

        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: "Estudantes cadastrados", value: totalStudents, helper: "Base ativa da escola." },
            { label: "Matrículas ativas", value: activeEnrollments, helper: "Vínculos correntes por turma." },
            { label: "Sem turma", value: noClassCount, helper: "Cadastro sem matrícula atual." },
            { label: "Risco alto/crítico", value: highRiskCount, helper: "Sinal de permanência." },
            { label: "Documentos anexados", value: documentsCount, helper: "Arquivos da matrícula e comprovações." },
          ].map((card) => (
            <div key={card.label} className="panel p-4">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{card.helper}</div>
            </div>
          ))}
        </div>

        <div className="panel p-5">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar estudante e matrícula inicial</summary>
            <form action={createAction} className="mt-4 grid gap-4">
              <StudentFormFields classes={classes} />
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-300">
                Responsáveis adicionais e documentos do estudante são anexados após salvar o cadastro inicial. Isso evita pedir ao banco um ID do aluno antes de o aluno existir — um capricho metafísico que o SQL não curte.
              </div>
              <button type="submit" className="btn btn-primary w-fit">
                Salvar estudante
              </button>
            </form>
          </details>
        </div>

        <div className="table-wrap">
          <div className="border-b border-zinc-100 p-4 text-sm text-zinc-600 dark:border-zinc-900 dark:text-zinc-400">
            Cada linha abaixo reúne cadastro, matrícula principal, responsáveis e documentos. É o ponto onde secretaria, pedagógico e vida real finalmente se encontram.
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-th">Estudante</th>
                  <th className="table-th">Matrícula atual</th>
                  <th className="table-th">Responsáveis e documentos</th>
                  <th className="table-th">Risco</th>
                  <th className="table-th">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, enrollment, classRow, guardians, documents }) => (
                  <tr key={student.id} className="table-row align-top">
                    <td className="table-td">
                      <StudentSummary student={student} />
                    </td>
                    <td className="table-td">
                      {enrollment ? (
                        <div className="grid gap-1 text-sm">
                          <div className="font-medium">{classLabel(classRow)}</div>
                          <div className="text-zinc-500 dark:text-zinc-400">Ano letivo: {enrollment.school_year ?? "—"}</div>
                          <div className="text-zinc-500 dark:text-zinc-400">Data: {formatDateBR(enrollment.enrollment_date)}</div>
                          <div className="text-zinc-500 dark:text-zinc-400">Status: {optionLabel(ENROLLMENT_STATUS_OPTIONS, enrollment.enrollment_status)}</div>
                          <div className="text-zinc-500 dark:text-zinc-400">Coorte: {enrollment.entry_cohort ?? "—"}</div>
                          <div className="text-zinc-500 dark:text-zinc-400">Itinerário: {enrollment.itinerary_name || optionLabel(ITINERARY_AXIS_OPTIONS, enrollment.itinerary_axis)}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">Sem matrícula atual.</span>
                      )}
                    </td>
                    <td className="table-td">
                      <div className="grid gap-3 text-sm">
                        <div>
                          <div className="font-medium">Responsáveis ({guardians.length})</div>
                          {guardians.length ? (
                            <ul className="mt-1 grid gap-1 text-zinc-600 dark:text-zinc-300">
                              {guardians.slice(0, 3).map((guardian) => (
                                <li key={guardian.id}>
                                  {guardian.full_name || "—"} • {optionLabel(GUARDIAN_RELATIONSHIP_OPTIONS, guardian.relationship, "Vínculo não informado")}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-1 text-zinc-500 dark:text-zinc-400">Nenhum responsável adicional cadastrado.</div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">Documentos ({documents.length})</div>
                          {documents.length ? (
                            <ul className="mt-1 grid gap-1 text-zinc-600 dark:text-zinc-300">
                              {documents.slice(0, 3).map((document) => (
                                <li key={document.id}>
                                  {optionLabel(DOCUMENT_TYPE_OPTIONS, document.document_type, document.document_name || "Documento")}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-1 text-zinc-500 dark:text-zinc-400">Nenhum documento anexado.</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-td">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeToneForRisk(enrollment?.risk_level)}`}>
                        {optionLabel(RISK_LEVEL_OPTIONS, enrollment?.risk_level, "Sem sinal")}
                      </span>
                    </td>
                    <td className="table-td">
                      <div className="flex flex-col gap-3">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Editar cadastro</summary>
                          <form action={updateAction} className="mt-3 grid w-[min(96vw,1100px)] gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                            <input type="hidden" name="id" value={student.id} />
                            <input type="hidden" name="enrollment_id" value={enrollment?.id ?? ""} />
                            <StudentFormFields student={student} enrollment={enrollment} classes={classes} />
                            <button type="submit" className="btn btn-primary w-fit">
                              Atualizar cadastro
                            </button>
                          </form>
                        </details>

                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Responsáveis</summary>
                          <div className="mt-3 grid w-[min(96vw,1100px)] gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                            <div className="grid gap-3">
                              {guardians.map((guardian) => (
                                <form key={guardian.id} action={updateGuardianAction} className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                                  <input type="hidden" name="id" value={guardian.id} />
                                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <label className="grid gap-2 xl:col-span-2">
                                      <span className="text-sm font-semibold">Nome completo</span>
                                      <input name="full_name" type="text" defaultValue={inputValue(guardian.full_name)} required className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">Tipo</span>
                                      <select name="guardian_type" className="input" defaultValue={String(guardian.guardian_type ?? "").toUpperCase()}>
                                        <option value="">Selecione</option>
                                        {GUARDIAN_TYPE_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">Parentesco</span>
                                      <select name="relationship" className="input" defaultValue={String(guardian.relationship ?? "").toUpperCase()}>
                                        <option value="">Selecione</option>
                                        {GUARDIAN_RELATIONSHIP_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">CPF</span>
                                      <input name="cpf" type="text" defaultValue={inputValue(guardian.cpf)} className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">RG</span>
                                      <input name="rg" type="text" defaultValue={inputValue(guardian.rg)} className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">Telefone</span>
                                      <input name="phone" type="text" defaultValue={inputValue(guardian.phone)} className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">Celular</span>
                                      <input name="mobile_phone" type="text" defaultValue={inputValue(guardian.mobile_phone)} className="input" />
                                    </label>
                                    <label className="grid gap-2 xl:col-span-2">
                                      <span className="text-sm font-semibold">E-mail</span>
                                      <input name="email" type="email" defaultValue={inputValue(guardian.email)} className="input" />
                                    </label>
                                    <label className="grid gap-2 xl:col-span-2">
                                      <span className="text-sm font-semibold">Profissão</span>
                                      <input name="profession" type="text" defaultValue={inputValue(guardian.profession)} className="input" />
                                    </label>
                                    <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                                      <input name="is_legal_guardian" type="checkbox" defaultChecked={boolValue(guardian.is_legal_guardian)} />
                                      Responsável legal
                                    </label>
                                    <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                                      <input name="is_financial_guardian" type="checkbox" defaultChecked={boolValue(guardian.is_financial_guardian)} />
                                      Responsável financeiro
                                    </label>
                                    <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                                      <input name="lives_with_student" type="checkbox" defaultChecked={boolValue(guardian.lives_with_student)} />
                                      Mora com o estudante
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">CEP</span>
                                      <input name="zip_code" type="text" defaultValue={inputValue(guardian.zip_code)} className="input" />
                                    </label>
                                    <label className="grid gap-2 xl:col-span-2">
                                      <span className="text-sm font-semibold">Logradouro</span>
                                      <input name="street" type="text" defaultValue={inputValue(guardian.street)} className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">Número</span>
                                      <input name="street_number" type="text" defaultValue={inputValue(guardian.street_number)} className="input" />
                                    </label>
                                    <label className="grid gap-2 xl:col-span-2">
                                      <span className="text-sm font-semibold">Complemento</span>
                                      <input name="address_complement" type="text" defaultValue={inputValue(guardian.address_complement)} className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">Bairro</span>
                                      <input name="neighborhood" type="text" defaultValue={inputValue(guardian.neighborhood)} className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">Cidade</span>
                                      <input name="city" type="text" defaultValue={inputValue(guardian.city)} className="input" />
                                    </label>
                                    <label className="grid gap-2">
                                      <span className="text-sm font-semibold">UF</span>
                                      <input name="state_code" type="text" maxLength={2} defaultValue={inputValue(guardian.state_code)} className="input" />
                                    </label>
                                    <label className="grid gap-2 xl:col-span-4">
                                      <span className="text-sm font-semibold">Observações</span>
                                      <textarea name="notes" rows={3} defaultValue={inputValue(guardian.notes)} className="input min-h-[80px]" />
                                    </label>
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                    <button type="submit" className="btn btn-primary">Salvar responsável</button>
                                    <button formAction={deleteGuardianAction} name="id" value={guardian.id} className="btn btn-danger">
                                      Excluir
                                    </button>
                                  </div>
                                </form>
                              ))}
                            </div>

                            <form action={createGuardianAction} className="grid gap-3 rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
                              <input type="hidden" name="student_id" value={student.id} />
                              <div className="text-sm font-semibold">Adicionar responsável</div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <label className="grid gap-2 xl:col-span-2">
                                  <span className="text-sm font-semibold">Nome completo</span>
                                  <input name="full_name" type="text" required className="input" />
                                </label>
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">Tipo</span>
                                  <select name="guardian_type" className="input" defaultValue="PRINCIPAL">
                                    {GUARDIAN_TYPE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">Parentesco</span>
                                  <select name="relationship" className="input" defaultValue="RESPONSAVEL_LEGAL">
                                    {GUARDIAN_RELATIONSHIP_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">CPF</span><input name="cpf" type="text" className="input" /></label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">RG</span><input name="rg" type="text" className="input" /></label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">Telefone</span><input name="phone" type="text" className="input" /></label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">Celular</span><input name="mobile_phone" type="text" className="input" /></label>
                                <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">E-mail</span><input name="email" type="email" className="input" /></label>
                                <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Profissão</span><input name="profession" type="text" className="input" /></label>
                                <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"><input name="is_legal_guardian" type="checkbox" defaultChecked />Responsável legal</label>
                                <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"><input name="is_financial_guardian" type="checkbox" />Responsável financeiro</label>
                                <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"><input name="lives_with_student" type="checkbox" />Mora com o estudante</label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">CEP</span><input name="zip_code" type="text" className="input" /></label>
                                <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Logradouro</span><input name="street" type="text" className="input" /></label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">Número</span><input name="street_number" type="text" className="input" /></label>
                                <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Complemento</span><input name="address_complement" type="text" className="input" /></label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">Bairro</span><input name="neighborhood" type="text" className="input" /></label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">Cidade</span><input name="city" type="text" className="input" /></label>
                                <label className="grid gap-2"><span className="text-sm font-semibold">UF</span><input name="state_code" type="text" maxLength={2} className="input" /></label>
                                <label className="grid gap-2 xl:col-span-4"><span className="text-sm font-semibold">Observações</span><textarea name="notes" rows={3} className="input min-h-[80px]" /></label>
                              </div>
                              <button type="submit" className="btn btn-primary w-fit">Adicionar responsável</button>
                            </form>
                          </div>
                        </details>

                        <details>
                          <summary className="cursor-pointer text-sm font-semibold">Documentos</summary>
                          <div className="mt-3 grid w-[min(96vw,1100px)] gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                            <div className="grid gap-3">
                              {documents.length ? (
                                documents.map((document) => (
                                  <div key={document.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="font-semibold">{document.document_name || optionLabel(DOCUMENT_TYPE_OPTIONS, document.document_type)}</div>
                                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                          {optionLabel(DOCUMENT_TYPE_OPTIONS, document.document_type)} • {formatBytes(document.file_size_bytes)} • enviado em {formatDateBR(document.created_at?.slice(0, 10))}
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                          Emissão: {formatDateBR(document.issued_at)} • Validade: {formatDateBR(document.expires_at)}
                                          {document.required_on_enrollment ? " • obrigatório na matrícula" : ""}
                                        </div>
                                        {document.notes ? <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{document.notes}</div> : null}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {documentUrlMap.get(document.id) ? (
                                          <a href={documentUrlMap.get(document.id) ?? "#"} target="_blank" rel="noreferrer" className="btn">
                                            Abrir
                                          </a>
                                        ) : null}
                                        <form action={deleteDocumentAction}>
                                          <input type="hidden" name="id" value={document.id} />
                                          <input type="hidden" name="storage_path" value={document.storage_path} />
                                          <ConfirmButton confirmText="Remover este documento?" type="submit" className="btn btn-danger">
                                            Excluir
                                          </ConfirmButton>
                                        </form>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                                  Nenhum documento anexado ainda.
                                </div>
                              )}
                            </div>

                            <form action={uploadDocumentAction} className="grid gap-3 rounded-2xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
                              <input type="hidden" name="student_id" value={student.id} />
                              <div className="text-sm font-semibold">Anexar documento do estudante</div>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">Tipo de documento</span>
                                  <select name="document_type" className="input" defaultValue="CERTIDAO_NASCIMENTO">
                                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-2 xl:col-span-2">
                                  <span className="text-sm font-semibold">Nome amigável</span>
                                  <input name="document_name" type="text" placeholder="Ex.: Histórico escolar 2025" className="input" />
                                </label>
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">Arquivo</span>
                                  <input name="file" type="file" required className="input pt-3" />
                                </label>
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">Data de emissão</span>
                                  <input name="issued_at" type="date" className="input" />
                                </label>
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">Validade</span>
                                  <input name="expires_at" type="date" className="input" />
                                </label>
                                <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 xl:col-span-2">
                                  <input name="required_on_enrollment" type="checkbox" defaultChecked />
                                  Documento obrigatório para efetivação da matrícula
                                </label>
                                <label className="grid gap-2 xl:col-span-4">
                                  <span className="text-sm font-semibold">Observações</span>
                                  <textarea name="notes" rows={3} className="input min-h-[80px]" />
                                </label>
                              </div>
                              <button type="submit" className="btn btn-primary w-fit">Anexar documento</button>
                            </form>
                          </div>
                        </details>

                        <form action={deleteAction}>
                          <input type="hidden" name="id" value={student.id} />
                          <ConfirmButton confirmText="Tem certeza que deseja excluir este estudante e toda a trajetória vinculada?" type="submit" className="btn btn-danger">
                            Excluir estudante
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr className="table-row">
                    <td colSpan={5} className="table-td text-zinc-600 dark:text-zinc-400">
                      Nenhum estudante cadastrado ainda.
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
