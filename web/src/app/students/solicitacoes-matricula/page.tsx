import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  applyViaCepToStudentDraft,
  buildEnrollmentPayloadFromProposal,
  buildStudentPayloadFromProposal,
  type ExistingStudentCandidate,
  findStrongDuplicateCandidates,
  type PreEnrollmentProposal,
} from "@/lib/student-pre-enrollment";
import {
  ENROLLMENT_STATUS_OPTIONS,
  ITINERARY_AXIS_OPTIONS,
  OFFER_MODEL_OPTIONS,
  RISK_LEVEL_OPTIONS,
} from "@/lib/novo-ensino-medio-students";

const CURRENT_YEAR = new Date().getFullYear();

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
};

type SubmissionRow = {
  id: string;
  school_id: string;
  school_name: string | null;
  student_name: string | null;
  student_birth_date: string | null;
  student_cpf: string | null;
  student_email: string | null;
  student_phone: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  desired_grade: string | null;
  shift_preference: string | null;
  previous_school: string | null;
  notes: string | null;
  decision_notes: string | null;
  status: string | null;
  source: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  converted_student_id: string | null;
  converted_enrollment_id: string | null;
  payload: Record<string, any> | null;
  created_at: string | null;
};

type StudentLite = ExistingStudentCandidate;

type Draft = {
  student: NonNullable<PreEnrollmentProposal["student"]>;
  guardians: NonNullable<PreEnrollmentProposal["guardians"]>;
  enrollment: NonNullable<PreEnrollmentProposal["enrollment"]>;
  desired_grade: string | null;
  shift_preference: string | null;
  notes: string | null;
  decision_notes: string | null;
};

function inputValue(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanDigits(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/\D+/g, "").trim();
  return digits || null;
}

function cleanUpper(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text || null;
}

function cleanNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function statusTone(status: string | null | undefined) {
  switch (String(status ?? "").toUpperCase()) {
    case "APROVADA":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "CONVERTIDA":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200";
    case "REJEITADA":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200";
  }
}

function formatDateBR(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
}

function classLabel(row: ClassRow | null | undefined) {
  if (!row) return "Sem turma";
  const shift = String(row.shift ?? "").trim();
  return `${row.name ?? "Turma"}${shift ? ` • ${shift}` : ""}`;
}

function fieldFromSubmission<T extends keyof SubmissionRow>(submission: SubmissionRow, field: T) {
  const direct = submission[field];
  if (direct != null && String(direct).trim() !== "") return direct;
  const payload = (submission.payload ?? {}) as Record<string, any>;
  const value = payload[String(field)];
  return value == null || String(value).trim() === "" ? null : value;
}

function asDraft(submission: SubmissionRow): Draft {
  const enrollmentPayload = ((submission.payload ?? {}).enrollment ?? {}) as Record<string, any>;
  return {
    student: {
      full_name: String(fieldFromSubmission(submission, "student_name") ?? "").trim() || null,
      birth_date: String(fieldFromSubmission(submission, "student_birth_date") ?? "").trim() || null,
      cpf: String(fieldFromSubmission(submission, "student_cpf") ?? "").trim() || null,
      email: String(fieldFromSubmission(submission, "student_email") ?? "").trim() || null,
      mobile_phone: String(fieldFromSubmission(submission, "student_phone") ?? "").trim() || null,
      phone: String(fieldFromSubmission(submission, "student_phone") ?? "").trim() || null,
      school_origin_name: String(fieldFromSubmission(submission, "previous_school") ?? "").trim() || null,
      previous_grade: String(fieldFromSubmission(submission, "desired_grade") ?? "").trim() || null,
    },
    guardians: [
      {
        full_name: String(fieldFromSubmission(submission, "guardian_name") ?? "").trim() || null,
        email: String(fieldFromSubmission(submission, "guardian_email") ?? "").trim() || null,
        mobile_phone: String(fieldFromSubmission(submission, "guardian_phone") ?? "").trim() || null,
        phone: String(fieldFromSubmission(submission, "guardian_phone") ?? "").trim() || null,
        relationship: "RESPONSÁVEL",
        is_legal_guardian: true,
        is_financial_guardian: true,
        lives_with_student: false,
      },
    ],
    enrollment: {
      class_id: String(enrollmentPayload.class_id ?? "").trim() || null,
      school_year: typeof enrollmentPayload.school_year === "number" ? enrollmentPayload.school_year : CURRENT_YEAR,
      entry_cohort: typeof enrollmentPayload.entry_cohort === "number" ? enrollmentPayload.entry_cohort : CURRENT_YEAR,
      curriculum_version: String(enrollmentPayload.curriculum_version ?? "").trim() || null,
      offer_model: String(enrollmentPayload.offer_model ?? "").trim().toUpperCase() || null,
      enrollment_status: String(enrollmentPayload.enrollment_status ?? "ATIVA").trim().toUpperCase() || "ATIVA",
      itinerary_axis: String(enrollmentPayload.itinerary_axis ?? "").trim().toUpperCase() || null,
      itinerary_name: String(enrollmentPayload.itinerary_name ?? "").trim() || null,
      project_of_life_notes: String(enrollmentPayload.project_of_life_notes ?? "").trim() || null,
      risk_level: String(enrollmentPayload.risk_level ?? "BAIXO").trim().toUpperCase() || "BAIXO",
      enrollment_date: String(enrollmentPayload.enrollment_date ?? new Date().toISOString().slice(0, 10)).trim() || new Date().toISOString().slice(0, 10),
    },
    desired_grade: String(fieldFromSubmission(submission, "desired_grade") ?? "").trim() || null,
    shift_preference: String(fieldFromSubmission(submission, "shift_preference") ?? "").trim() || null,
    notes: String(fieldFromSubmission(submission, "notes") ?? "").trim() || null,
    decision_notes: String(fieldFromSubmission(submission, "decision_notes") ?? "").trim() || null,
  };
}

function buildDraftFromForm(formData: FormData, submission: SubmissionRow): Draft {
  const base = asDraft(submission);
  return {
    student: {
      ...base.student,
      full_name: cleanText(formData.get("student_name")),
      birth_date: cleanDate(formData.get("student_birth_date")),
      cpf: cleanDigits(formData.get("student_cpf")),
      email: cleanText(formData.get("student_email")),
      mobile_phone: cleanText(formData.get("student_phone")),
      phone: cleanText(formData.get("student_phone")),
      school_origin_name: cleanText(formData.get("previous_school")),
      previous_grade: cleanText(formData.get("desired_grade")),
    },
    guardians: [
      {
        ...base.guardians[0],
        full_name: cleanText(formData.get("guardian_name")),
        email: cleanText(formData.get("guardian_email")),
        mobile_phone: cleanText(formData.get("guardian_phone")),
        phone: cleanText(formData.get("guardian_phone")),
        relationship: cleanText(formData.get("guardian_relationship")) ?? "RESPONSÁVEL",
        is_legal_guardian: true,
        is_financial_guardian: true,
        lives_with_student: false,
      },
    ],
    enrollment: {
      ...base.enrollment,
      class_id: cleanText(formData.get("class_id")),
      school_year: cleanNumber(formData.get("school_year")) ?? CURRENT_YEAR,
      entry_cohort: cleanNumber(formData.get("entry_cohort")) ?? CURRENT_YEAR,
      curriculum_version: cleanText(formData.get("curriculum_version")),
      offer_model: cleanUpper(formData.get("offer_model")),
      enrollment_status: cleanUpper(formData.get("enrollment_status")) ?? "ATIVA",
      itinerary_axis: cleanUpper(formData.get("itinerary_axis")),
      itinerary_name: cleanText(formData.get("itinerary_name")),
      project_of_life_notes: cleanText(formData.get("project_of_life_notes")),
      risk_level: cleanUpper(formData.get("risk_level")) ?? "BAIXO",
      enrollment_date: cleanDate(formData.get("enrollment_date")) ?? new Date().toISOString().slice(0, 10),
    },
    desired_grade: cleanText(formData.get("desired_grade")),
    shift_preference: cleanText(formData.get("shift_preference")),
    notes: cleanText(formData.get("notes")),
    decision_notes: cleanText(formData.get("decision_notes")),
  };
}

function submissionUpdatePayload(submission: SubmissionRow, draft: Draft, userId: string, status: string) {
  return {
    student_name: draft.student.full_name ?? null,
    student_birth_date: draft.student.birth_date ?? null,
    student_cpf: draft.student.cpf ?? null,
    student_email: draft.student.email ?? null,
    student_phone: draft.student.mobile_phone ?? draft.student.phone ?? null,
    guardian_name: draft.guardians[0]?.full_name ?? null,
    guardian_email: draft.guardians[0]?.email ?? null,
    guardian_phone: draft.guardians[0]?.mobile_phone ?? draft.guardians[0]?.phone ?? null,
    desired_grade: draft.desired_grade ?? null,
    shift_preference: draft.shift_preference ?? null,
    previous_school: draft.student.school_origin_name ?? null,
    notes: draft.notes ?? null,
    decision_notes: draft.decision_notes ?? null,
    status,
    approved_by: status === "APROVADA" || status === "CONVERTIDA" ? userId : submission.approved_by,
    approved_at: status === "APROVADA" || status === "CONVERTIDA" ? new Date().toISOString() : submission.approved_at,
    payload: {
      ...(submission.payload ?? {}),
      school_id: submission.school_id,
      school_name: submission.school_name,
      student_name: draft.student.full_name ?? null,
      student_birth_date: draft.student.birth_date ?? null,
      student_cpf: draft.student.cpf ?? null,
      student_email: draft.student.email ?? null,
      student_phone: draft.student.mobile_phone ?? draft.student.phone ?? null,
      guardian_name: draft.guardians[0]?.full_name ?? null,
      guardian_email: draft.guardians[0]?.email ?? null,
      guardian_phone: draft.guardians[0]?.mobile_phone ?? draft.guardians[0]?.phone ?? null,
      desired_grade: draft.desired_grade ?? null,
      shift_preference: draft.shift_preference ?? null,
      previous_school: draft.student.school_origin_name ?? null,
      notes: draft.notes ?? null,
      decision_notes: draft.decision_notes ?? null,
      enrollment: draft.enrollment,
    },
  };
}

export default async function SolicitacoesMatriculaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};
  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [submissionsRes, classesRes, studentsRes] = await Promise.all([
    supabase
      .from("public_enrollment_submissions")
      .select("id, school_id, school_name, student_name, student_birth_date, student_cpf, student_email, student_phone, guardian_name, guardian_email, guardian_phone, desired_grade, shift_preference, previous_school, notes, decision_notes, status, source, submitted_at, approved_at, approved_by, converted_student_id, converted_enrollment_id, payload, created_at")
      .eq("school_id", profile.school_id)
      .order("submitted_at", { ascending: false }),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase.from("students").select("id, full_name, registration_number, cpf, birth_date, rg, birth_certificate_number").eq("school_id", profile.school_id),
  ]);

  const submissions = (submissionsRes.data as SubmissionRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const students = (studentsRes.data as StudentLite[] | null) ?? [];
  const studentsById = new Map(students.map((row) => [row.id, row]));
  const classesById = new Map(classes.map((row) => [row.id, row]));

  async function approveAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const submissionId = String(formData.get("submission_id") || "").trim();
    if (!submissionId) redirect("/students/solicitacoes-matricula?error=" + encodeMsg("Solicitação inválida."));

    const { data: submission, error } = await supabase
      .from("public_enrollment_submissions")
      .select("id, school_id, school_name, student_name, student_birth_date, student_cpf, student_email, student_phone, guardian_name, guardian_email, guardian_phone, desired_grade, shift_preference, previous_school, notes, decision_notes, status, source, submitted_at, approved_at, approved_by, converted_student_id, converted_enrollment_id, payload, created_at")
      .eq("id", submissionId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (error || !submission?.id) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(error?.message || "Solicitação não encontrada."));

    const draft = buildDraftFromForm(formData, submission as SubmissionRow);
    draft.student = await applyViaCepToStudentDraft(draft.student);
    const updatePayload = submissionUpdatePayload(submission as SubmissionRow, draft, user.id, "APROVADA");
    const { error: updateError } = await supabase
      .from("public_enrollment_submissions")
      .update(updatePayload)
      .eq("id", submissionId)
      .eq("school_id", profile.school_id);
    if (updateError) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(updateError.message));

    revalidatePath("/students/solicitacoes-matricula");
    redirect("/students/solicitacoes-matricula?msg=" + encodeMsg("Solicitação aprovada e pronta para efetivação."));
  }

  async function rejectAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const submissionId = String(formData.get("submission_id") || "").trim();
    const decisionNotes = cleanText(formData.get("decision_notes"));
    if (!submissionId) redirect("/students/solicitacoes-matricula?error=" + encodeMsg("Solicitação inválida."));
    const { error } = await supabase
      .from("public_enrollment_submissions")
      .update({ status: "REJEITADA", decision_notes: decisionNotes, approved_at: null, approved_by: null })
      .eq("id", submissionId)
      .eq("school_id", profile.school_id);
    if (error) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(error.message));
    revalidatePath("/students/solicitacoes-matricula");
    redirect("/students/solicitacoes-matricula?msg=" + encodeMsg("Solicitação marcada como rejeitada."));
  }

  async function convertAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const submissionId = String(formData.get("submission_id") || "").trim();
    if (!submissionId) redirect("/students/solicitacoes-matricula?error=" + encodeMsg("Solicitação inválida."));

    const { data: submission, error } = await supabase
      .from("public_enrollment_submissions")
      .select("id, school_id, school_name, student_name, student_birth_date, student_cpf, student_email, student_phone, guardian_name, guardian_email, guardian_phone, desired_grade, shift_preference, previous_school, notes, decision_notes, status, source, submitted_at, approved_at, approved_by, converted_student_id, converted_enrollment_id, payload, created_at")
      .eq("id", submissionId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (error || !submission?.id) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(error?.message || "Solicitação não encontrada."));
    if (submission.converted_student_id) redirect("/students/solicitacoes-matricula?error=" + encodeMsg("Esta solicitação já foi convertida."));

    const draft = buildDraftFromForm(formData, submission as SubmissionRow);
    draft.student = await applyViaCepToStudentDraft(draft.student);
    if (!draft.student.full_name) redirect("/students/solicitacoes-matricula?error=" + encodeMsg("Informe o nome do estudante antes de efetivar."));
    if (!draft.enrollment.class_id) redirect("/students/solicitacoes-matricula?error=" + encodeMsg("Selecione a turma antes de efetivar a matrícula."));

    const { data: existingStudents } = await supabase
      .from("students")
      .select("id, full_name, registration_number, cpf, birth_date, rg, birth_certificate_number")
      .eq("school_id", profile.school_id);
    const strongDuplicates = findStrongDuplicateCandidates({
      student: draft.student,
      existingStudents: ((existingStudents as StudentLite[] | null) ?? []),
    });
    if (strongDuplicates.length) {
      const first = strongDuplicates[0];
      redirect(
        "/students/solicitacoes-matricula?error=" +
          encodeMsg(`Conversão bloqueada por duplicidade forte (${first.reason}) com ${first.full_name || first.registration_number || "cadastro existente"}. Revise os dados antes de efetivar.`),
      );
    }

    const baseStudentPayload = buildStudentPayloadFromProposal(draft.student, profile.school_id);
    const studentPayload = {
      ...baseStudentPayload,
      notes: draft.notes ?? null,
      guardian_name: draft.guardians[0]?.full_name ?? baseStudentPayload.guardian_name,
      guardian_phone: draft.guardians[0]?.mobile_phone ?? draft.guardians[0]?.phone ?? baseStudentPayload.guardian_phone,
      school_origin_name: draft.student.school_origin_name ?? baseStudentPayload.school_origin_name,
      previous_grade: draft.student.previous_grade ?? baseStudentPayload.previous_grade,
    };

    const { data: student, error: studentError } = await supabase.from("students").insert(studentPayload).select("id").single();
    if (studentError || !student?.id) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(studentError?.message || "Falha ao criar o estudante."));

    const enrollmentPayload = buildEnrollmentPayloadFromProposal(draft.enrollment, profile.school_id, String(student.id));
    if (!enrollmentPayload) redirect("/students/solicitacoes-matricula?error=" + encodeMsg("Não foi possível montar a matrícula. Selecione a turma."));

    const { data: enrollment, error: enrollmentError } = await supabase.from("student_enrollments").insert(enrollmentPayload).select("id").single();
    if (enrollmentError || !enrollment?.id) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(enrollmentError?.message || "Falha ao criar a matrícula."));

    const guardian = draft.guardians[0];
    if (guardian?.full_name) {
      const { error: guardianError } = await supabase.from("student_guardians").insert({
        school_id: profile.school_id,
        student_id: student.id,
        guardian_type: "PRINCIPAL",
        full_name: guardian.full_name,
        relationship: guardian.relationship ?? null,
        cpf: guardian.cpf ?? null,
        rg: guardian.rg ?? null,
        phone: guardian.phone ?? null,
        mobile_phone: guardian.mobile_phone ?? null,
        email: guardian.email ?? null,
        profession: guardian.profession ?? null,
        is_legal_guardian: guardian.is_legal_guardian ?? true,
        is_financial_guardian: guardian.is_financial_guardian ?? true,
        lives_with_student: guardian.lives_with_student ?? false,
      });
      if (guardianError) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(guardianError.message));
    }

    const updatePayload = submissionUpdatePayload(submission as SubmissionRow, draft, user.id, "CONVERTIDA");
    const { error: updateError } = await supabase
      .from("public_enrollment_submissions")
      .update({
        ...updatePayload,
        converted_student_id: student.id,
        converted_enrollment_id: enrollment.id,
      })
      .eq("id", submissionId)
      .eq("school_id", profile.school_id);
    if (updateError) redirect("/students/solicitacoes-matricula?error=" + encodeMsg(updateError.message));

    revalidatePath("/students/solicitacoes-matricula");
    revalidatePath("/students");
    redirect("/students/solicitacoes-matricula?msg=" + encodeMsg("Solicitação convertida em estudante e matrícula oficial."));
  }

  const combinedError = error || submissionsRes.error?.message || classesRes.error?.message || studentsRes.error?.message || null;
  const pendingCount = submissions.filter((item) => String(item.status ?? "").toUpperCase() === "PENDENTE").length;
  const approvedCount = submissions.filter((item) => String(item.status ?? "").toUpperCase() === "APROVADA").length;
  const convertedCount = submissions.filter((item) => String(item.status ?? "").toUpperCase() === "CONVERTIDA").length;

  return (
    <Shell
      title="Solicitações de matrícula"
      subtitle="Revise os pedidos enviados pelo site público, aprove os dados e efetive o cadastro do estudante com matrícula oficial no sistema."
    >
      <div className="grid gap-4">
        <Flash message={combinedError || msg} variant={combinedError ? "error" : msg ? "success" : "info"} />

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Solicitações pendentes", value: pendingCount, helper: "Aguardando análise do colégio." },
            { label: "Aprovadas", value: approvedCount, helper: "Prontas para efetivação." },
            { label: "Convertidas", value: convertedCount, helper: "Já viraram estudante + matrícula." },
            { label: "Total recebidas", value: submissions.length, helper: "Histórico do formulário público." },
          ].map((card) => (
            <div key={card.label} className="panel p-4">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{card.helper}</div>
            </div>
          ))}
        </div>

        <div className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Esta tela centraliza as matrículas temporárias enviadas pelo site institucional. Aprove os dados quando estiverem corretos e, em seguida, converta em cadastro definitivo do estudante.
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/students" className="btn btn-secondary">Voltar para estudantes</Link>
              <Link href="/students/pre-matricula" className="btn btn-secondary">Abrir pré-matrícula inteligente</Link>
            </div>
          </div>
        </div>

        {submissions.length ? (
          <div className="grid gap-4">
            {submissions.map((submission) => {
              const draft = asDraft(submission);
              const duplicateCandidates = findStrongDuplicateCandidates({ student: draft.student, existingStudents: students });
              const status = String(submission.status ?? "PENDENTE").toUpperCase();
              const convertedStudent = submission.converted_student_id ? studentsById.get(submission.converted_student_id) ?? null : null;
              const selectedClass = draft.enrollment.class_id ? classesById.get(draft.enrollment.class_id) ?? null : null;

              return (
                <details key={submission.id} open={status !== "CONVERTIDA" && status !== "REJEITADA"} className="panel p-5">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(status)}`}>{status}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Recebida em {formatDateBR(submission.submitted_at || submission.created_at)}</span>
                          {submission.source ? <span className="text-xs text-zinc-500 dark:text-zinc-400">Fonte: {submission.source}</span> : null}
                        </div>
                        <div className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{draft.student.full_name || "Solicitação sem nome"}</div>
                        <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {draft.desired_grade || "Série não informada"}
                          {draft.shift_preference ? ` • ${draft.shift_preference}` : ""}
                          {submission.school_name ? ` • ${submission.school_name}` : ""}
                        </div>
                      </div>

                      <div className="grid gap-1 text-right text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Responsável: {draft.guardians[0]?.full_name || "—"}</span>
                        <span>Turma escolhida: {selectedClass ? classLabel(selectedClass) : "Ainda não definida"}</span>
                        {convertedStudent ? <span>Convertido: {convertedStudent.full_name || convertedStudent.registration_number || "abrir"}</span> : null}
                      </div>
                    </div>
                  </summary>

                  <div className="mt-5 grid gap-4 md:grid-cols-4">
                    <div className="panel-inner p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Estudante</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{draft.student.full_name || "—"}</div>
                      <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        <div>Nascimento: {draft.student.birth_date ? formatDateBR(draft.student.birth_date) : "—"}</div>
                        <div>CPF: {draft.student.cpf || "—"}</div>
                        <div>E-mail: {draft.student.email || "—"}</div>
                        <div>Telefone: {draft.student.mobile_phone || draft.student.phone || "—"}</div>
                      </div>
                    </div>
                    <div className="panel-inner p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Responsável</div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{draft.guardians[0]?.full_name || "—"}</div>
                      <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        <div>E-mail: {draft.guardians[0]?.email || "—"}</div>
                        <div>Telefone: {draft.guardians[0]?.mobile_phone || draft.guardians[0]?.phone || "—"}</div>
                        <div>Relacionamento: {draft.guardians[0]?.relationship || "Responsável"}</div>
                      </div>
                    </div>
                    <div className="panel-inner p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Solicitação</div>
                      <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        <div>Série pretendida: {draft.desired_grade || "—"}</div>
                        <div>Turno preferido: {draft.shift_preference || "—"}</div>
                        <div>Escola de origem: {draft.student.school_origin_name || "—"}</div>
                      </div>
                    </div>
                    <div className="panel-inner p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ação</div>
                      <div className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        <div>Status atual: <strong>{status}</strong></div>
                        <div>Aprovada em: {submission.approved_at ? formatDateBR(submission.approved_at) : "—"}</div>
                        <div>Observações internas: {draft.decision_notes || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {draft.notes ? (
                    <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100">Observações enviadas pelo responsável</div>
                      <div className="mt-2 leading-6">{draft.notes}</div>
                    </div>
                  ) : null}

                  {duplicateCandidates.length ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      <div className="font-semibold">Atenção para possível duplicidade</div>
                      <ul className="mt-2 space-y-1">
                        {duplicateCandidates.map((duplicate) => (
                          <li key={`${submission.id}-${duplicate.id}`}>
                            {duplicate.reason}: {duplicate.full_name || duplicate.registration_number || duplicate.id}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <form action={approveAction} className="mt-5 grid gap-4">
                    <input type="hidden" name="submission_id" value={submission.id} />

                    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="text-sm font-semibold">Revisão dos dados antes da aprovação</div>
                      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="grid gap-2 xl:col-span-2">
                          <span className="text-sm font-semibold">Nome do estudante *</span>
                          <input name="student_name" type="text" defaultValue={inputValue(draft.student.full_name)} required className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Data de nascimento *</span>
                          <input name="student_birth_date" type="date" defaultValue={inputValue(draft.student.birth_date)} required className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">CPF</span>
                          <input name="student_cpf" type="text" defaultValue={inputValue(draft.student.cpf)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">E-mail do estudante</span>
                          <input name="student_email" type="email" defaultValue={inputValue(draft.student.email)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Telefone do estudante</span>
                          <input name="student_phone" type="text" defaultValue={inputValue(draft.student.mobile_phone || draft.student.phone)} className="input" />
                        </label>
                        <label className="grid gap-2 xl:col-span-2">
                          <span className="text-sm font-semibold">Nome do responsável *</span>
                          <input name="guardian_name" type="text" defaultValue={inputValue(draft.guardians[0]?.full_name)} required className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Relacionamento</span>
                          <input name="guardian_relationship" type="text" defaultValue={inputValue(draft.guardians[0]?.relationship)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">E-mail do responsável *</span>
                          <input name="guardian_email" type="email" defaultValue={inputValue(draft.guardians[0]?.email)} required className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Telefone do responsável *</span>
                          <input name="guardian_phone" type="text" defaultValue={inputValue(draft.guardians[0]?.mobile_phone || draft.guardians[0]?.phone)} required className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Série pretendida</span>
                          <input name="desired_grade" type="text" defaultValue={inputValue(draft.desired_grade)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Turno preferido</span>
                          <input name="shift_preference" type="text" defaultValue={inputValue(draft.shift_preference)} className="input" />
                        </label>
                        <label className="grid gap-2 xl:col-span-2">
                          <span className="text-sm font-semibold">Escola de origem</span>
                          <input name="previous_school" type="text" defaultValue={inputValue(draft.student.school_origin_name)} className="input" />
                        </label>
                        <label className="grid gap-2 xl:col-span-3">
                          <span className="text-sm font-semibold">Observações do pedido</span>
                          <textarea name="notes" rows={3} defaultValue={inputValue(draft.notes)} className="input min-h-[96px] py-3" />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="text-sm font-semibold">Parâmetros para efetivação da matrícula</div>
                      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="grid gap-2 xl:col-span-2">
                          <span className="text-sm font-semibold">Turma para efetivar *</span>
                          <select name="class_id" defaultValue={inputValue(draft.enrollment.class_id)} className="input">
                            <option value="">Selecione</option>
                            {classes.map((item) => (
                              <option key={item.id} value={item.id}>{classLabel(item)}</option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Ano letivo</span>
                          <input name="school_year" type="number" defaultValue={inputValue(draft.enrollment.school_year ?? CURRENT_YEAR)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Coorte de entrada</span>
                          <input name="entry_cohort" type="number" defaultValue={inputValue(draft.enrollment.entry_cohort ?? CURRENT_YEAR)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Status da matrícula</span>
                          <select name="enrollment_status" defaultValue={inputValue(draft.enrollment.enrollment_status ?? "ATIVA")} className="input">
                            {ENROLLMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Data da matrícula</span>
                          <input name="enrollment_date" type="date" defaultValue={inputValue(draft.enrollment.enrollment_date)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Versão curricular</span>
                          <input name="curriculum_version" type="text" defaultValue={inputValue(draft.enrollment.curriculum_version)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Modelo de oferta</span>
                          <select name="offer_model" defaultValue={inputValue(draft.enrollment.offer_model)} className="input">
                            <option value="">Selecione</option>
                            {OFFER_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Eixo do itinerário</span>
                          <select name="itinerary_axis" defaultValue={inputValue(draft.enrollment.itinerary_axis)} className="input">
                            <option value="">Selecione</option>
                            {ITINERARY_AXIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Nome do itinerário</span>
                          <input name="itinerary_name" type="text" defaultValue={inputValue(draft.enrollment.itinerary_name)} className="input" />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold">Risco inicial</span>
                          <select name="risk_level" defaultValue={inputValue(draft.enrollment.risk_level ?? "BAIXO")} className="input">
                            {RISK_LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label className="grid gap-2 xl:col-span-3">
                          <span className="text-sm font-semibold">Observações internas / decisão do colégio</span>
                          <textarea name="decision_notes" rows={3} defaultValue={inputValue(draft.decision_notes)} className="input min-h-[96px] py-3" />
                        </label>
                        <label className="grid gap-2 xl:col-span-3">
                          <span className="text-sm font-semibold">Projeto de vida / observações pedagógicas</span>
                          <textarea name="project_of_life_notes" rows={3} defaultValue={inputValue(draft.enrollment.project_of_life_notes)} className="input min-h-[96px] py-3" />
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {status !== "CONVERTIDA" ? <button type="submit" className="btn btn-secondary">Salvar e aprovar solicitação</button> : null}
                      {status !== "CONVERTIDA" ? (
                        <ConfirmButton confirmText="Efetivar esta solicitação como estudante e matrícula oficial?" formAction={convertAction} className="btn btn-primary">
                          Aprovar e efetivar matrícula
                        </ConfirmButton>
                      ) : null}
                      {status !== "CONVERTIDA" && status !== "REJEITADA" ? (
                        <ConfirmButton confirmText="Marcar esta solicitação como rejeitada?" formAction={rejectAction} className="btn btn-ghost">
                          Rejeitar solicitação
                        </ConfirmButton>
                      ) : null}
                      {convertedStudent ? (
                        <Link href="/students" className="btn btn-secondary">Ver estudante convertido: {convertedStudent.full_name || convertedStudent.registration_number || "abrir"}</Link>
                      ) : null}
                    </div>
                  </form>
                </details>
              );
            })}
          </div>
        ) : (
          <div className="panel p-6 text-sm text-zinc-600 dark:text-zinc-400">
            Ainda não há solicitações públicas de matrícula para este colégio.
          </div>
        )}
      </div>
    </Shell>
  );
}
