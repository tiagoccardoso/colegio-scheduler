import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { requireStaff } from "@/lib/require-staff";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  analyzeStoredPreEnrollmentFile,
  applyViaCepToStudentDraft,
  buildEnrollmentPayloadFromProposal,
  buildFieldConfidenceFromExtractions,
  buildProposalFromExtractions,
  buildStudentPayloadFromProposal,
  findStrongDuplicateCandidates,
  PRE_ENROLLMENT_BUCKET,
  type ExistingStudentCandidate,
  type ExtractedGuardian,
  type PreEnrollmentProposal,
  type ProposalFieldConfidence,
} from "@/lib/student-pre-enrollment";
import { ITINERARY_AXIS_OPTIONS, OFFER_MODEL_OPTIONS } from "@/lib/novo-ensino-medio-students";

const CURRENT_YEAR = new Date().getFullYear();

type IntakeRow = {
  id: string;
  school_id: string;
  intake_name: string | null;
  status: string | null;
  notes: string | null;
  analysis_summary: string | null;
  analysis_warnings: string[] | null;
  proposed_student: Record<string, unknown> | null;
  proposed_guardians: ExtractedGuardian[] | null;
  proposed_enrollment: Record<string, unknown> | null;
  converted_student_id: string | null;
  converted_enrollment_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type IntakeFileRow = {
  id: string;
  school_id: string;
  pre_enrollment_id: string;
  document_type: string | null;
  document_name: string | null;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  analysis_status: string | null;
  analysis_summary: string | null;
  ai_payload: Record<string, unknown> | null;
  created_at: string | null;
};

type ClassRow = { id: string; name: string | null; shift: string | null };

type StudentLite = ExistingStudentCandidate;

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanUpper(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text || null;
}

function cleanDigits(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/\D+/g, "").trim();
  return digits || null;
}

function cleanDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function formatDate(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  const date = new Date(`${text.length === 10 ? `${text}T00:00:00` : text}`);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatBytes(value: number | null | undefined) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num <= 0) return "—";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function safeName(value: string) {
  return String(value || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120) || "arquivo";
}

function tone(status: string | null | undefined) {
  const key = String(status ?? "").trim().toUpperCase();
  if (key === "CONVERTIDO") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (key === "ANALISADO" || key === "REVISADO") return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200";
  if (key === "ERRO") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200";
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";
}

function fileTone(status: string | null | undefined) {
  const key = String(status ?? "").trim().toUpperCase();
  if (key === "ANALISADO") return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200";
  if (key === "ERRO") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200";
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";
}

function duplicateTone(reason: string | null | undefined) {
  const key = String(reason ?? "").trim().toUpperCase();
  if (key === "CPF_EXATO") return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200";
  return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200";
}

function fieldConfidenceBadge(confidenceMap: ProposalFieldConfidence, field: string) {
  const confidence = confidenceMap[field];
  if (!confidence) {
    return <span className="text-xs text-zinc-400 dark:text-zinc-500">Sem confiança calculada</span>;
  }

  const tone =
    confidence.level === "ALTA"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
      : confidence.level === "MEDIA"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
        : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] font-medium ${tone}`}>
      <span>{confidence.level}</span>
      <span>·</span>
      <span>{Math.round(confidence.score * 100)}%</span>
      {confidence.sources.length ? <span>· {confidence.sources.join(", ")}</span> : null}
    </span>
  );
}

function asProposal(intake: IntakeRow): PreEnrollmentProposal {
  const student = (intake.proposed_student ?? {}) as PreEnrollmentProposal["student"];
  const guardians = Array.isArray(intake.proposed_guardians) ? intake.proposed_guardians : [];
  const enrollment = (intake.proposed_enrollment ?? {}) as PreEnrollmentProposal["enrollment"];
  return {
    student,
    guardians,
    enrollment: {
      class_id: String((enrollment as any)?.class_id ?? "").trim() || null,
      enrollment_status: String((enrollment as any)?.enrollment_status ?? "ATIVA").trim().toUpperCase() || "ATIVA",
      risk_level: String((enrollment as any)?.risk_level ?? "BAIXO").trim().toUpperCase() || "BAIXO",
      enrollment_date: String((enrollment as any)?.enrollment_date ?? new Date().toISOString().slice(0, 10)).trim() || new Date().toISOString().slice(0, 10),
      school_year: typeof (enrollment as any)?.school_year === "number" ? (enrollment as any).school_year : CURRENT_YEAR,
      entry_cohort: typeof (enrollment as any)?.entry_cohort === "number" ? (enrollment as any).entry_cohort : CURRENT_YEAR,
      curriculum_version: String((enrollment as any)?.curriculum_version ?? "").trim() || null,
      offer_model: String((enrollment as any)?.offer_model ?? "").trim().toUpperCase() || null,
      itinerary_axis: String((enrollment as any)?.itinerary_axis ?? "").trim().toUpperCase() || null,
      itinerary_name: String((enrollment as any)?.itinerary_name ?? "").trim() || null,
      project_of_life_notes: String((enrollment as any)?.project_of_life_notes ?? "").trim() || null,
    },
    warnings: Array.isArray(intake.analysis_warnings) ? intake.analysis_warnings : [],
    summary: String(intake.analysis_summary ?? "").trim(),
    detected_documents: [],
  };
}

function buildProposalFromForm(formData: FormData, base: PreEnrollmentProposal): PreEnrollmentProposal {
  return {
    ...base,
    student: {
      ...base.student,
      full_name: cleanText(formData.get("student_full_name")),
      social_name: cleanText(formData.get("student_social_name")),
      birth_date: cleanDate(formData.get("student_birth_date")),
      cpf: cleanDigits(formData.get("student_cpf")),
      rg: cleanText(formData.get("student_rg")),
      birth_certificate_number: cleanText(formData.get("student_birth_certificate_number")),
      mother_name: cleanText(formData.get("student_mother_name")),
      father_name: cleanText(formData.get("student_father_name")),
      mobile_phone: cleanText(formData.get("student_mobile_phone")),
      phone: cleanText(formData.get("student_phone")),
      email: cleanText(formData.get("student_email")),
      zip_code: cleanDigits(formData.get("student_zip_code")),
      street: cleanText(formData.get("student_street")),
      street_number: cleanText(formData.get("student_street_number")),
      neighborhood: cleanText(formData.get("student_neighborhood")),
      city: cleanText(formData.get("student_city")),
      state_code: cleanUpper(formData.get("student_state_code")),
      school_origin_name: cleanText(formData.get("student_school_origin_name")),
      previous_grade: cleanText(formData.get("student_previous_grade")),
      previous_school_year: cleanNumber(formData.get("student_previous_school_year")),
    },
    enrollment: {
      ...base.enrollment,
      class_id: cleanText(formData.get("enrollment_class_id")),
      school_year: cleanNumber(formData.get("enrollment_school_year")) ?? CURRENT_YEAR,
      entry_cohort: cleanNumber(formData.get("enrollment_entry_cohort")) ?? CURRENT_YEAR,
      curriculum_version: cleanText(formData.get("enrollment_curriculum_version")),
      offer_model: cleanUpper(formData.get("enrollment_offer_model")),
      enrollment_status: cleanUpper(formData.get("enrollment_status")) ?? "ATIVA",
      risk_level: cleanUpper(formData.get("enrollment_risk_level")) ?? "BAIXO",
      enrollment_date: cleanDate(formData.get("enrollment_date")) ?? new Date().toISOString().slice(0, 10),
      itinerary_axis: cleanUpper(formData.get("enrollment_itinerary_axis")),
      itinerary_name: cleanText(formData.get("enrollment_itinerary_name")),
      project_of_life_notes: cleanText(formData.get("enrollment_project_of_life_notes")),
    },
  };
}

export default async function PreMatriculaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile, user } = await requireStaff();
  const sp = (await searchParams) ?? {};
  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [intakesRes, filesRes, classesRes, convertedStudentsRes] = await Promise.all([
    supabase
      .from("student_pre_enrollments")
      .select("id, school_id, intake_name, status, notes, analysis_summary, analysis_warnings, proposed_student, proposed_guardians, proposed_enrollment, converted_student_id, converted_enrollment_id, created_at, updated_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_pre_enrollment_files")
      .select("id, school_id, pre_enrollment_id, document_type, document_name, storage_path, mime_type, file_size_bytes, analysis_status, analysis_summary, ai_payload, created_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase.from("students").select("id, full_name, registration_number, cpf, birth_date, rg, birth_certificate_number").eq("school_id", profile.school_id),
  ]);

  const intakes = (intakesRes.data as IntakeRow[] | null) ?? [];
  const files = (filesRes.data as IntakeFileRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const convertedStudents = (convertedStudentsRes.data as StudentLite[] | null) ?? [];
  const studentsById = new Map(convertedStudents.map((row) => [row.id, row]));

  const combinedError =
    intakesRes.error?.message || filesRes.error?.message || classesRes.error?.message || convertedStudentsRes.error?.message || null;

  const filesByIntake = new Map<string, IntakeFileRow[]>();
  for (const file of files) {
    const list = filesByIntake.get(file.pre_enrollment_id) ?? [];
    list.push(file);
    filesByIntake.set(file.pre_enrollment_id, list);
  }

  async function createIntakeAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const intakeName = cleanText(formData.get("intake_name"));
    const notes = cleanText(formData.get("notes"));
    if (!intakeName) redirect("/students/pre-matricula?error=" + encodeMsg("Informe um nome para a pré-matrícula."));
    const { error } = await supabase.from("student_pre_enrollments").insert({
      school_id: profile.school_id,
      intake_name: intakeName,
      notes,
      status: "RASCUNHO",
      created_by: user.id,
      updated_by: user.id,
    });
    if (error) redirect("/students/pre-matricula?error=" + encodeMsg(error.message));
    revalidatePath("/students/pre-matricula");
    redirect("/students/pre-matricula?msg=" + encodeMsg("Pré-matrícula criada."));
  }

  async function uploadFilesAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const intakeId = String(formData.get("intake_id") || "").trim();
    const all = formData.getAll("files");
    const uploadFiles = all.filter((item): item is File => item instanceof File && item.size > 0);
    if (!intakeId) redirect("/students/pre-matricula?error=" + encodeMsg("Pré-matrícula inválida."));
    if (!uploadFiles.length) redirect("/students/pre-matricula?error=" + encodeMsg("Envie ao menos um documento."));

    for (const file of uploadFiles) {
      const fileName = safeName(file.name || `documento-${Date.now()}`);
      const storagePath = `schools/${profile.school_id}/pre-enrollments/${intakeId}/${Date.now()}-${fileName}`;
      const { error: uploadError } = await supabase.storage.from(PRE_ENROLLMENT_BUCKET).upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (uploadError) redirect("/students/pre-matricula?error=" + encodeMsg(uploadError.message));
      const { error: insertError } = await supabase.from("student_pre_enrollment_files").insert({
        school_id: profile.school_id,
        pre_enrollment_id: intakeId,
        document_name: file.name || fileName,
        storage_path: storagePath,
        mime_type: file.type || null,
        file_size_bytes: file.size || null,
        analysis_status: "PENDENTE",
        created_by: user.id,
      });
      if (insertError) redirect("/students/pre-matricula?error=" + encodeMsg(insertError.message));
    }

    await supabase.from("student_pre_enrollments").update({ status: "DOCUMENTOS_ENVIADOS", updated_by: user.id }).eq("id", intakeId).eq("school_id", profile.school_id);

    revalidatePath("/students/pre-matricula");
    redirect("/students/pre-matricula?msg=" + encodeMsg("Documentos enviados para a pré-matrícula."));
  }

  async function analyzeIntakeAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const intakeId = String(formData.get("intake_id") || "").trim();
    if (!intakeId) redirect("/students/pre-matricula?error=" + encodeMsg("Pré-matrícula inválida."));

    const { data: intake } = await supabase.from("student_pre_enrollments").select("id, intake_name").eq("id", intakeId).eq("school_id", profile.school_id).maybeSingle();
    if (!intake?.id) redirect("/students/pre-matricula?error=" + encodeMsg("Pré-matrícula não encontrada."));

    await supabase.from("student_pre_enrollments").update({ status: "ANALISANDO", updated_by: user.id }).eq("id", intakeId).eq("school_id", profile.school_id);

    const { data: fileRows, error: filesError } = await supabase
      .from("student_pre_enrollment_files")
      .select("id, document_name, storage_path, mime_type")
      .eq("school_id", profile.school_id)
      .eq("pre_enrollment_id", intakeId)
      .order("created_at", { ascending: true });

    if (filesError) redirect("/students/pre-matricula?error=" + encodeMsg(filesError.message));
    const docs = (fileRows as Array<{ id: string; document_name: string | null; storage_path: string; mime_type: string | null }> | null) ?? [];
    if (!docs.length) redirect("/students/pre-matricula?error=" + encodeMsg("Envie documentos antes de analisar."));

    const extractedFiles: Array<{ name: string; extracted: Awaited<ReturnType<typeof analyzeStoredPreEnrollmentFile>> }> = [];
    const warnings: string[] = [];

    for (const file of docs) {
      const { data: signed } = await supabase.storage.from(PRE_ENROLLMENT_BUCKET).createSignedUrl(file.storage_path, 60 * 20);
      const signedUrl = signed?.signedUrl;
      if (!signedUrl) {
        warnings.push(`Não foi possível abrir ${file.document_name || "documento"} para análise.`);
        await supabase.from("student_pre_enrollment_files").update({ analysis_status: "ERRO", analysis_summary: "Falha ao gerar URL assinada." }).eq("id", file.id).eq("school_id", profile.school_id);
        continue;
      }
      try {
        const extracted = await analyzeStoredPreEnrollmentFile({ signedUrl, mimeType: file.mime_type, userId: user.id });
        extractedFiles.push({ name: file.document_name || "Documento", extracted });
        await supabase
          .from("student_pre_enrollment_files")
          .update({
            document_type: extracted.document_type,
            analysis_status: "ANALISADO",
            analysis_summary: extracted.summary,
            ai_payload: extracted as any,
          })
          .eq("id", file.id)
          .eq("school_id", profile.school_id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao analisar documento.";
        warnings.push(`${file.document_name || "Documento"}: ${message}`);
        await supabase.from("student_pre_enrollment_files").update({ analysis_status: "ERRO", analysis_summary: message }).eq("id", file.id).eq("school_id", profile.school_id);
      }
    }

    const proposal = buildProposalFromExtractions(extractedFiles);
    proposal.student = await applyViaCepToStudentDraft(proposal.student);
    const mergedWarnings = Array.from(new Set([...(proposal.warnings ?? []), ...warnings]));
    const { error: updateError } = await supabase
      .from("student_pre_enrollments")
      .update({
        status: "ANALISADO",
        analysis_summary: proposal.summary,
        analysis_warnings: mergedWarnings,
        proposed_student: proposal.student as any,
        proposed_guardians: proposal.guardians as any,
        proposed_enrollment: proposal.enrollment as any,
        updated_by: user.id,
      })
      .eq("id", intakeId)
      .eq("school_id", profile.school_id);

    if (updateError) redirect("/students/pre-matricula?error=" + encodeMsg(updateError.message));
    revalidatePath("/students/pre-matricula");
    redirect("/students/pre-matricula?msg=" + encodeMsg(`Análise concluída para ${intake.intake_name || "a pré-matrícula"}.`));
  }

  async function saveProposalAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const intakeId = String(formData.get("intake_id") || "").trim();
    if (!intakeId) redirect("/students/pre-matricula?error=" + encodeMsg("Pré-matrícula inválida."));
    const { data: intake, error } = await supabase
      .from("student_pre_enrollments")
      .select("id, analysis_summary, analysis_warnings, proposed_student, proposed_guardians, proposed_enrollment")
      .eq("id", intakeId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (error || !intake?.id) redirect("/students/pre-matricula?error=" + encodeMsg(error?.message || "Pré-matrícula não encontrada."));

    const base = asProposal(intake as IntakeRow);
    const proposal = buildProposalFromForm(formData, base);
    proposal.student = await applyViaCepToStudentDraft(proposal.student);

    const { error: updateError } = await supabase
      .from("student_pre_enrollments")
      .update({
        status: "REVISADO",
        proposed_student: proposal.student as any,
        proposed_guardians: proposal.guardians as any,
        proposed_enrollment: proposal.enrollment as any,
        updated_by: user.id,
      })
      .eq("id", intakeId)
      .eq("school_id", profile.school_id);
    if (updateError) redirect("/students/pre-matricula?error=" + encodeMsg(updateError.message));
    revalidatePath("/students/pre-matricula");
    redirect("/students/pre-matricula?msg=" + encodeMsg("Proposta de cadastro revisada."));
  }

  async function refreshAddressByCepAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const intakeId = String(formData.get("intake_id") || "").trim();
    if (!intakeId) redirect("/students/pre-matricula?error=" + encodeMsg("Pré-matrícula inválida."));
    const { data: intake, error } = await supabase
      .from("student_pre_enrollments")
      .select("id, analysis_summary, analysis_warnings, proposed_student, proposed_guardians, proposed_enrollment")
      .eq("id", intakeId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (error || !intake?.id) redirect("/students/pre-matricula?error=" + encodeMsg(error?.message || "Pré-matrícula não encontrada."));

    const base = asProposal(intake as IntakeRow);
    const proposal = buildProposalFromForm(formData, base);
    proposal.student = await applyViaCepToStudentDraft(proposal.student);

    const { error: updateError } = await supabase
      .from("student_pre_enrollments")
      .update({
        proposed_student: proposal.student as any,
        proposed_guardians: proposal.guardians as any,
        proposed_enrollment: proposal.enrollment as any,
        updated_by: user.id,
      })
      .eq("id", intakeId)
      .eq("school_id", profile.school_id);
    if (updateError) redirect("/students/pre-matricula?error=" + encodeMsg(updateError.message));
    revalidatePath("/students/pre-matricula");
    redirect("/students/pre-matricula?msg=" + encodeMsg("Endereço atualizado pelo CEP."));
  }

  async function convertAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();
    const intakeId = String(formData.get("intake_id") || "").trim();
    if (!intakeId) redirect("/students/pre-matricula?error=" + encodeMsg("Pré-matrícula inválida."));

    const { data: intake, error } = await supabase
      .from("student_pre_enrollments")
      .select("id, intake_name, proposed_student, proposed_guardians, proposed_enrollment")
      .eq("id", intakeId)
      .eq("school_id", profile.school_id)
      .maybeSingle();
    if (error || !intake?.id) redirect("/students/pre-matricula?error=" + encodeMsg(error?.message || "Pré-matrícula não encontrada."));

    const base = asProposal(intake as IntakeRow);
    const proposal = buildProposalFromForm(formData, base);
    proposal.student = await applyViaCepToStudentDraft(proposal.student);
    const { data: existingStudents } = await supabase.from("students").select("id, full_name, registration_number, cpf, birth_date, rg, birth_certificate_number").eq("school_id", profile.school_id);
    const strongDuplicates = findStrongDuplicateCandidates({
      student: proposal.student,
      existingStudents: ((existingStudents as StudentLite[] | null) ?? []),
    });
    if (strongDuplicates.length) {
      const first = strongDuplicates[0];
      redirect("/students/pre-matricula?error=" + encodeMsg(`Conversão bloqueada por duplicidade forte (${first.reason}) com ${first.full_name || first.registration_number || "cadastro existente"}. Revise a proposta antes de converter.`));
    }
    const studentPayload = buildStudentPayloadFromProposal(proposal.student, profile.school_id);
    if (!studentPayload.full_name) redirect("/students/pre-matricula?error=" + encodeMsg("A proposta precisa ter nome completo antes da conversão."));

    const { data: student, error: studentError } = await supabase.from("students").insert(studentPayload).select("id").single();
    if (studentError || !student?.id) redirect("/students/pre-matricula?error=" + encodeMsg(studentError?.message || "Falha ao criar o estudante."));

    let enrollmentId: string | null = null;
    const enrollmentPayload = buildEnrollmentPayloadFromProposal(proposal.enrollment, profile.school_id, String(student.id));
    if (enrollmentPayload) {
      const { data: enrollment, error: enrollmentError } = await supabase.from("student_enrollments").insert(enrollmentPayload).select("id").single();
      if (enrollmentError) redirect("/students/pre-matricula?error=" + encodeMsg(enrollmentError.message));
      enrollmentId = String(enrollment?.id || "") || null;
    }

    for (const guardian of proposal.guardians ?? []) {
      if (!guardian.full_name) continue;
      const { error: guardianError } = await supabase.from("student_guardians").insert({
        school_id: profile.school_id,
        student_id: student.id,
        guardian_type: guardian.is_financial_guardian ? "FINANCEIRO" : guardian.is_legal_guardian ? "LEGAL" : "PRINCIPAL",
        full_name: guardian.full_name,
        relationship: guardian.relationship ?? null,
        cpf: guardian.cpf ?? null,
        rg: guardian.rg ?? null,
        phone: guardian.phone ?? null,
        mobile_phone: guardian.mobile_phone ?? null,
        email: guardian.email ?? null,
        profession: guardian.profession ?? null,
        is_legal_guardian: guardian.is_legal_guardian ?? false,
        is_financial_guardian: guardian.is_financial_guardian ?? false,
        lives_with_student: guardian.lives_with_student ?? false,
      });
      if (guardianError) redirect("/students/pre-matricula?error=" + encodeMsg(guardianError.message));
    }

    const { data: intakeFiles } = await supabase
      .from("student_pre_enrollment_files")
      .select("id, storage_path, document_name, mime_type, file_size_bytes, document_type")
      .eq("school_id", profile.school_id)
      .eq("pre_enrollment_id", intakeId);

    for (const file of ((intakeFiles as any[]) ?? [])) {
      const oldPath = String(file.storage_path || "").trim();
      if (!oldPath) continue;
      const fileName = safeName(String(file.document_name || oldPath.split("/").pop() || "documento"));
      const newPath = `schools/${profile.school_id}/students/${student.id}/${Date.now()}-${fileName}`;
      const { error: moveError } = await supabase.storage.from(PRE_ENROLLMENT_BUCKET).move(oldPath, newPath);
      const finalPath = moveError ? oldPath : newPath;
      const { error: insertDocError } = await supabase.from("student_document_files").insert({
        school_id: profile.school_id,
        student_id: student.id,
        document_type: file.document_type || "OUTRO",
        document_name: file.document_name || fileName,
        storage_path: finalPath,
        mime_type: file.mime_type || null,
        file_size_bytes: file.file_size_bytes || null,
        required_on_enrollment: false,
        created_by: user.id,
      });
      if (insertDocError) redirect("/students/pre-matricula?error=" + encodeMsg(insertDocError.message));
    }

    const { error: intakeUpdateError } = await supabase
      .from("student_pre_enrollments")
      .update({
        status: "CONVERTIDO",
        proposed_student: proposal.student as any,
        proposed_guardians: proposal.guardians as any,
        proposed_enrollment: proposal.enrollment as any,
        converted_student_id: student.id,
        converted_enrollment_id: enrollmentId,
        updated_by: user.id,
      })
      .eq("id", intakeId)
      .eq("school_id", profile.school_id);

    if (intakeUpdateError) redirect("/students/pre-matricula?error=" + encodeMsg(intakeUpdateError.message));

    revalidatePath("/students/pre-matricula");
    revalidatePath("/students");
    redirect("/students/pre-matricula?msg=" + encodeMsg(`Pré-matrícula convertida em cadastro de estudante${intake.intake_name ? ` (${intake.intake_name})` : ""}.`));
  }

  async function deleteIntakeAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const intakeId = String(formData.get("intake_id") || "").trim();
    if (!intakeId) redirect("/students/pre-matricula?error=" + encodeMsg("Pré-matrícula inválida."));
    const { data: fileRows } = await supabase.from("student_pre_enrollment_files").select("storage_path").eq("school_id", profile.school_id).eq("pre_enrollment_id", intakeId);
    const paths = ((fileRows as Array<{ storage_path: string }> | null) ?? []).map((item) => item.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from(PRE_ENROLLMENT_BUCKET).remove(paths);
    const { error } = await supabase.from("student_pre_enrollments").delete().eq("id", intakeId).eq("school_id", profile.school_id);
    if (error) redirect("/students/pre-matricula?error=" + encodeMsg(error.message));
    revalidatePath("/students/pre-matricula");
    redirect("/students/pre-matricula?msg=" + encodeMsg("Pré-matrícula excluída."));
  }

  return (
    <Shell
      title="Pré-matrícula inteligente"
      subtitle="Receba documentos, analise com IA, revise a proposta e converta em estudante + matrícula sem precisar digitar o universo inteiro na unha."
    >
      <div className="grid gap-4">
        <Flash message={combinedError || error || msg} variant={combinedError || error ? "error" : msg ? "success" : "info"} />

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Intakes abertos", value: intakes.filter((item) => String(item.status).toUpperCase() !== "CONVERTIDO").length, helper: "Rascunhos, análises e revisões pendentes." },
            { label: "Documentos enviados", value: files.length, helper: "Arquivos já recebidos na esteira de pré-matrícula." },
            { label: "Analisados", value: files.filter((item) => String(item.analysis_status).toUpperCase() === "ANALISADO").length, helper: "Leituras concluídas por arquivo." },
            { label: "Convertidos", value: intakes.filter((item) => String(item.status).toUpperCase() === "CONVERTIDO").length, helper: "Pré-matrículas já viraram cadastro oficial." },
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
            <div>
              <div className="text-sm font-semibold">Abrir nova pré-matrícula</div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Comece pelo protocolo/intake, envie os documentos e depois rode a análise assistida.</p>
            </div>
            <Link href="/students" className="btn btn-secondary">Voltar para estudantes</Link>
          </div>
          <form action={createIntakeAction} className="mt-4 grid gap-4 md:grid-cols-[1fr,2fr,auto]">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Nome da pré-matrícula</span>
              <input name="intake_name" className="input" placeholder="Ex.: João Silva — 2026" required />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Observações</span>
              <input name="notes" className="input" placeholder="Transferência, cadastro enviado pela família, lote da turma 1A..." />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn btn-primary">Criar intake</button>
            </div>
          </form>
        </div>

        <div className="grid gap-4">
          {intakes.length ? (
            intakes.map((intake) => {
              const intakeFiles = filesByIntake.get(intake.id) ?? [];
              const confidenceMap = buildFieldConfidenceFromExtractions(
                intakeFiles.map((file) => ({
                  name: file.document_name || "Documento",
                  extracted: ((file.ai_payload as Record<string, unknown> | null) ?? {
                    document_type: file.document_type,
                    summary: null,
                    warnings: [],
                    confidence: null,
                    student: {},
                    guardians: [],
                    enrollment: {},
                  }) as any,
                })),
              );
              const proposal = asProposal(intake);
              const convertedStudent = intake.converted_student_id ? studentsById.get(intake.converted_student_id) ?? null : null;
              return (
                <details key={intake.id} className="panel p-5" open>
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold">{intake.intake_name || "Pré-matrícula sem nome"}</div>
                        <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          Criada em {formatDate(intake.created_at)} • {intakeFiles.length} documento(s)
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tone(intake.status)}`}>{intake.status || "RASCUNHO"}</span>
                    </div>
                  </summary>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[1fr,1.4fr]">
                    <div className="grid gap-4">
                      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="text-sm font-semibold">Upload de documentos</div>
                        <form action={uploadFilesAction} className="mt-3 grid gap-3">
                          <input type="hidden" name="intake_id" value={intake.id} />
                          <input name="files" type="file" multiple accept="application/pdf,image/*,.txt" className="input py-3" />
                          <button type="submit" className="btn btn-primary w-fit">Enviar documentos</button>
                        </form>
                        <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">PDFs e imagens funcionam melhor. O sistema tenta ler texto de PDF e usa visão para imagens quando a IA estiver configurada.</div>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">Análise assistida</div>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Classifica documentos, extrai dados e monta a proposta de cadastro.</p>
                          </div>
                          <form action={analyzeIntakeAction}>
                            <input type="hidden" name="intake_id" value={intake.id} />
                            <button type="submit" className="btn btn-secondary">Analisar intake</button>
                          </form>
                        </div>
                        {intake.analysis_summary ? <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-3 text-sm dark:border-zinc-700">{intake.analysis_summary}</div> : null}
                        {proposal.warnings.length ? (
                          <ul className="mt-3 grid gap-2 text-sm">
                            {proposal.warnings.map((warning) => (
                              <li key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">{warning}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="text-sm font-semibold">Arquivos do intake</div>
                        <div className="mt-3 grid gap-3">
                          {intakeFiles.length ? intakeFiles.map((file) => (
                            <div key={file.id} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium">{file.document_name || "Documento"}</div>
                                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{file.mime_type || "tipo não informado"} • {formatBytes(file.file_size_bytes)} • enviado em {formatDate(file.created_at)}</div>
                                </div>
                                <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${fileTone(file.analysis_status)}`}>{file.analysis_status || "PENDENTE"}</span>
                              </div>
                              <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{file.analysis_summary || "Ainda sem resumo de análise."}</div>
                              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Tipo detectado: {file.document_type || "—"}</div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">Nenhum documento enviado ainda.</div>
                          )}
                        </div>
                      </div>

                      <form action={deleteIntakeAction}>
                        <input type="hidden" name="intake_id" value={intake.id} />
                        <ConfirmButton confirmText="Excluir esta pré-matrícula e todos os documentos enviados?" type="submit" className="btn btn-danger">Excluir intake</ConfirmButton>
                      </form>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Proposta de cadastro revisável</div>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">A IA propõe. A secretaria confere. O banco agradece. A realidade também.</p>
                        </div>
                        {convertedStudent ? (
                          <Link href="/students" className="btn btn-secondary">Ver estudante convertido: {convertedStudent.full_name || convertedStudent.registration_number || "abrir"}</Link>
                        ) : null}
                      </div>

                      <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">Ao salvar a proposta, o sistema consulta o ViaCEP automaticamente quando houver CEP válido e preenche rua/bairro/cidade/UF se esses campos estiverem vazios.</div>
                      <form action={saveProposalAction} className="mt-4 grid gap-4">
                        <input type="hidden" name="intake_id" value={intake.id} />
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Nome completo</span><div>{fieldConfidenceBadge(confidenceMap, "student.full_name")}</div><input name="student_full_name" className="input" defaultValue={String(proposal.student.full_name ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Nome social</span><input name="student_social_name" className="input" defaultValue={String(proposal.student.social_name ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Nascimento</span><input name="student_birth_date" type="date" className="input" defaultValue={String(proposal.student.birth_date ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">CPF</span><div>{fieldConfidenceBadge(confidenceMap, "student.cpf")}</div><input name="student_cpf" className="input" defaultValue={String(proposal.student.cpf ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">RG</span><div>{fieldConfidenceBadge(confidenceMap, "student.rg")}</div><input name="student_rg" className="input" defaultValue={String(proposal.student.rg ?? "")} /></label>
                          <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Certidão de nascimento</span><div>{fieldConfidenceBadge(confidenceMap, "student.birth_certificate_number")}</div><input name="student_birth_certificate_number" className="input" defaultValue={String(proposal.student.birth_certificate_number ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Mãe</span><input name="student_mother_name" className="input" defaultValue={String(proposal.student.mother_name ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Pai</span><input name="student_father_name" className="input" defaultValue={String(proposal.student.father_name ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Celular</span><input name="student_mobile_phone" className="input" defaultValue={String(proposal.student.mobile_phone ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Telefone</span><input name="student_phone" className="input" defaultValue={String(proposal.student.phone ?? "")} /></label>
                          <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">E-mail</span><input name="student_email" type="email" className="input" defaultValue={String(proposal.student.email ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">CEP</span><div>{fieldConfidenceBadge(confidenceMap, "student.zip_code")}</div><input name="student_zip_code" className="input" defaultValue={String(proposal.student.zip_code ?? "")} /></label>
                          <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Logradouro</span><div>{fieldConfidenceBadge(confidenceMap, "student.street")}</div><input name="student_street" className="input" defaultValue={String(proposal.student.street ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Número</span><input name="student_street_number" className="input" defaultValue={String(proposal.student.street_number ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Bairro</span><div>{fieldConfidenceBadge(confidenceMap, "student.neighborhood")}</div><input name="student_neighborhood" className="input" defaultValue={String(proposal.student.neighborhood ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Cidade</span><div>{fieldConfidenceBadge(confidenceMap, "student.city")}</div><input name="student_city" className="input" defaultValue={String(proposal.student.city ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">UF</span><div>{fieldConfidenceBadge(confidenceMap, "student.state_code")}</div><input name="student_state_code" maxLength={2} className="input" defaultValue={String(proposal.student.state_code ?? "")} /></label>
                          <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Escola de origem</span><input name="student_school_origin_name" className="input" defaultValue={String(proposal.student.school_origin_name ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Série anterior</span><input name="student_previous_grade" className="input" defaultValue={String(proposal.student.previous_grade ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Ano anterior</span><input name="student_previous_school_year" type="number" min={2010} max={2100} className="input" defaultValue={String(proposal.student.previous_school_year ?? "")} /></label>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Turma de destino</span><select name="enrollment_class_id" className="input" defaultValue={String(proposal.enrollment.class_id ?? "")}><option value="">Definir depois</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.name ?? "Turma"}{row.shift ? ` • ${row.shift}` : ""}</option>)}</select></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Data da matrícula</span><input name="enrollment_date" type="date" className="input" defaultValue={String(proposal.enrollment.enrollment_date ?? new Date().toISOString().slice(0,10))} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Ano letivo</span><input name="enrollment_school_year" type="number" min={2024} max={2100} className="input" defaultValue={String(proposal.enrollment.school_year ?? CURRENT_YEAR)} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Coorte</span><input name="enrollment_entry_cohort" type="number" min={2024} max={2100} className="input" defaultValue={String(proposal.enrollment.entry_cohort ?? CURRENT_YEAR)} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Versão curricular</span><input name="enrollment_curriculum_version" className="input" defaultValue={String(proposal.enrollment.curriculum_version ?? "")} /></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Modelo de oferta</span><select name="enrollment_offer_model" className="input" defaultValue={String(proposal.enrollment.offer_model ?? "")}><option value="">Definir depois</option>{OFFER_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Status</span><select name="enrollment_status" className="input" defaultValue={String(proposal.enrollment.enrollment_status ?? "ATIVA")}><option value="ATIVA">Ativa</option><option value="PENDENTE">Pendente</option></select></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Risco inicial</span><select name="enrollment_risk_level" className="input" defaultValue={String(proposal.enrollment.risk_level ?? "BAIXO")}><option value="BAIXO">Baixo</option><option value="MEDIO">Médio</option><option value="ALTO">Alto</option><option value="CRITICO">Crítico</option></select></label>
                          <label className="grid gap-2"><span className="text-sm font-semibold">Eixo do itinerário</span><select name="enrollment_itinerary_axis" className="input" defaultValue={String(proposal.enrollment.itinerary_axis ?? "")}><option value="">Definir depois</option>{ITINERARY_AXIS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                          <label className="grid gap-2 xl:col-span-2"><span className="text-sm font-semibold">Nome do itinerário</span><input name="enrollment_itinerary_name" className="input" defaultValue={String(proposal.enrollment.itinerary_name ?? "")} /></label>
                          <label className="grid gap-2 xl:col-span-3"><span className="text-sm font-semibold">Projeto de Vida / observação pedagógica</span><textarea name="enrollment_project_of_life_notes" rows={3} className="input min-h-[90px]" defaultValue={String(proposal.enrollment.project_of_life_notes ?? "")} /></label>
                        </div>

                        <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
                          <div className="font-semibold">Responsáveis sugeridos ({proposal.guardians.length})</div>
                          {proposal.guardians.length ? (
                            <ul className="mt-2 grid gap-2 text-zinc-600 dark:text-zinc-300">
                              {proposal.guardians.map((guardian, index) => (
                                <li key={`${guardian.full_name || "guardian"}-${index}`}>{guardian.full_name || "Responsável sem nome"}{guardian.relationship ? ` • ${guardian.relationship}` : ""}{guardian.cpf ? ` • CPF ${guardian.cpf}` : ""}</li>
                              ))}
                            </ul>
                          ) : (
                            <div className="mt-2 text-zinc-500 dark:text-zinc-400">Nenhum responsável identificado automaticamente. Você ainda poderá adicionar depois no cadastro do estudante.</div>
                          )}
                        </div>

                        {(() => {
                          const strongDuplicates = findStrongDuplicateCandidates({ student: proposal.student, existingStudents: convertedStudents });
                          return strongDuplicates.length ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/30">
                              <div className="text-sm font-semibold text-rose-800 dark:text-rose-200">Duplicidade forte detectada</div>
                              <div className="mt-1 text-sm text-rose-700 dark:text-rose-300">A conversão será bloqueada enquanto houver coincidência forte por CPF, RG, certidão ou por nome + data de nascimento.</div>
                              <ul className="mt-3 grid gap-2 text-sm">
                                {strongDuplicates.map((match) => (
                                  <li key={match.id} className={`rounded-xl border px-3 py-2 ${duplicateTone(match.reason)}`}>
                                    {match.full_name || match.registration_number || match.id}{match.registration_number ? ` • matrícula ${match.registration_number}` : ""}{match.cpf ? ` • CPF ${match.cpf}` : ""}{match.rg ? ` • RG ${match.rg}` : ""}{match.birth_certificate_number ? ` • certidão ${match.birth_certificate_number}` : ""}{match.birth_date ? ` • nasc. ${formatDate(match.birth_date)}` : ""} • {match.reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null;
                        })()}

                        <div className="flex flex-wrap gap-2">
                          <button type="submit" className="btn btn-primary">Salvar proposta revisada</button>
                        </div>
                      </form>

                      {String(intake.status ?? "").toUpperCase() !== "CONVERTIDO" ? (
                        <form action={convertAction} className="mt-3">
                          <input type="hidden" name="intake_id" value={intake.id} />
                          <input type="hidden" name="student_full_name" value={String(proposal.student.full_name ?? "")} />
                          <input type="hidden" name="student_social_name" value={String(proposal.student.social_name ?? "")} />
                          <input type="hidden" name="student_birth_date" value={String(proposal.student.birth_date ?? "")} />
                          <input type="hidden" name="student_cpf" value={String(proposal.student.cpf ?? "")} />
                          <input type="hidden" name="student_rg" value={String(proposal.student.rg ?? "")} />
                          <input type="hidden" name="student_birth_certificate_number" value={String(proposal.student.birth_certificate_number ?? "")} />
                          <input type="hidden" name="student_mother_name" value={String(proposal.student.mother_name ?? "")} />
                          <input type="hidden" name="student_father_name" value={String(proposal.student.father_name ?? "")} />
                          <input type="hidden" name="student_mobile_phone" value={String(proposal.student.mobile_phone ?? "")} />
                          <input type="hidden" name="student_phone" value={String(proposal.student.phone ?? "")} />
                          <input type="hidden" name="student_email" value={String(proposal.student.email ?? "")} />
                          <input type="hidden" name="student_zip_code" value={String(proposal.student.zip_code ?? "")} />
                          <input type="hidden" name="student_street" value={String(proposal.student.street ?? "")} />
                          <input type="hidden" name="student_street_number" value={String(proposal.student.street_number ?? "")} />
                          <input type="hidden" name="student_neighborhood" value={String(proposal.student.neighborhood ?? "")} />
                          <input type="hidden" name="student_city" value={String(proposal.student.city ?? "")} />
                          <input type="hidden" name="student_state_code" value={String(proposal.student.state_code ?? "")} />
                          <input type="hidden" name="student_school_origin_name" value={String(proposal.student.school_origin_name ?? "")} />
                          <input type="hidden" name="student_previous_grade" value={String(proposal.student.previous_grade ?? "")} />
                          <input type="hidden" name="student_previous_school_year" value={String(proposal.student.previous_school_year ?? "")} />
                          <input type="hidden" name="enrollment_class_id" value={String(proposal.enrollment.class_id ?? "")} />
                          <input type="hidden" name="enrollment_date" value={String(proposal.enrollment.enrollment_date ?? "")} />
                          <input type="hidden" name="enrollment_school_year" value={String(proposal.enrollment.school_year ?? CURRENT_YEAR)} />
                          <input type="hidden" name="enrollment_entry_cohort" value={String(proposal.enrollment.entry_cohort ?? CURRENT_YEAR)} />
                          <input type="hidden" name="enrollment_curriculum_version" value={String(proposal.enrollment.curriculum_version ?? "")} />
                          <input type="hidden" name="enrollment_offer_model" value={String(proposal.enrollment.offer_model ?? "")} />
                          <input type="hidden" name="enrollment_status" value={String(proposal.enrollment.enrollment_status ?? "ATIVA")} />
                          <input type="hidden" name="enrollment_risk_level" value={String(proposal.enrollment.risk_level ?? "BAIXO")} />
                          <input type="hidden" name="enrollment_itinerary_axis" value={String(proposal.enrollment.itinerary_axis ?? "")} />
                          <input type="hidden" name="enrollment_itinerary_name" value={String(proposal.enrollment.itinerary_name ?? "")} />
                          <input type="hidden" name="enrollment_project_of_life_notes" value={String(proposal.enrollment.project_of_life_notes ?? "")} />
                          <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">Depois de revisar os campos acima, clique em <strong>Salvar proposta revisada</strong> e só então converta.</div><ConfirmButton confirmText="Converter esta proposta em cadastro oficial do estudante?" type="submit" className="btn btn-secondary">Converter em estudante</ConfirmButton>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </details>
              );
            })
          ) : (
            <div className="panel p-6 text-sm text-zinc-500 dark:text-zinc-400">Nenhuma pré-matrícula criada ainda. Abra um intake, envie os documentos e deixe a IA fazer o trabalho braçal antes da conferência humana.</div>
          )}
        </div>
      </div>
    </Shell>
  );
}
