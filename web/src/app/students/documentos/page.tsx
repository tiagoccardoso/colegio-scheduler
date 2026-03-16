import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { requireStaff } from "@/lib/require-staff";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  cleanNullableText,
  defaultIssueNumber,
  documentIssueTypeLabel,
  DOCUMENT_ISSUE_TYPE_OPTIONS,
  formatDatePtBr,
  normalizeIsoDate,
  type DocumentSettingsRow,
} from "@/lib/novo-ensino-medio-documents";
import {
  computeCompletionPercent,
  optionLabel,
  OFFER_MODEL_OPTIONS,
} from "@/lib/novo-ensino-medio-students";

type StudentRow = {
  id: string;
  full_name: string | null;
  social_name: string | null;
  registration_number: string | null;
  status: string | null;
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
  created_at?: string | null;
};

type HistoryRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  school_year: number | null;
  series_year: string | null;
  curriculum_version: string | null;
  outcome_status: string | null;
  fgb_hours_completed: number | null;
  itinerary_hours_completed: number | null;
  technical_hours_completed: number | null;
  attendance_rate: number | null;
  assessment_average: number | null;
  final_notes: string | null;
  created_at?: string | null;
};

type TrackRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  track_name: string | null;
  partner_name: string | null;
  qualification_type: string | null;
  total_hours: number | null;
  completed_hours: number | null;
  certification_status: string | null;
  certification_title: string | null;
  notes: string | null;
  created_at?: string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
};

type DocumentIssueRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  history_record_id: string | null;
  issue_type: string | null;
  issue_number: string | null;
  issued_at: string | null;
  requested_by: string | null;
  notes: string | null;
  created_at?: string | null;
};

function pickLatestByCreatedAt<T extends { created_at?: string | null }>(rows: T[]) {
  return [...rows].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0] ?? null;
}

function pickActiveEnrollment(rows: EnrollmentRow[]) {
  return [...rows].sort((a, b) => {
    const aActive = String(a.enrollment_status ?? "").toUpperCase() === "ATIVA" ? 0 : 1;
    const bActive = String(b.enrollment_status ?? "").toUpperCase() === "ATIVA" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return Number(b.school_year ?? 0) - Number(a.school_year ?? 0);
  })[0] ?? null;
}

function classLabel(row: ClassRow | null | undefined) {
  if (!row) return "Sem turma";
  const shift = String(row.shift ?? "").trim();
  return `${row.name ?? "Turma"}${shift ? ` • ${shift}` : ""}`;
}

export default async function StudentDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile, user } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [schoolRes, settingsRes, studentsRes, enrollmentsRes, historiesRes, tracksRes, classesRes, issuesRes] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", profile.school_id).maybeSingle(),
    supabase.from("school_document_settings").select("*").eq("school_id", profile.school_id).maybeSingle(),
    supabase.from("students").select("id, full_name, social_name, registration_number, status").eq("school_id", profile.school_id).order("full_name", { ascending: true }),
    supabase
      .from("student_enrollments")
      .select("id, student_id, class_id, school_year, entry_cohort, curriculum_version, offer_model, enrollment_status, itinerary_axis, itinerary_name, elective_name, project_of_life_notes, created_at")
      .eq("school_id", profile.school_id)
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("student_history_records")
      .select("id, student_id, enrollment_id, school_year, series_year, curriculum_version, outcome_status, fgb_hours_completed, itinerary_hours_completed, technical_hours_completed, attendance_rate, assessment_average, final_notes, created_at")
      .eq("school_id", profile.school_id)
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("student_professional_tracks")
      .select("id, student_id, enrollment_id, track_name, partner_name, qualification_type, total_hours, completed_hours, certification_status, certification_title, notes, created_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase
      .from("student_document_issues")
      .select("id, student_id, enrollment_id, history_record_id, issue_type, issue_number, issued_at, requested_by, notes, created_at")
      .eq("school_id", profile.school_id)
      .order("issued_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const schoolName = String((schoolRes.data as any)?.name ?? "Minha escola").trim() || "Minha escola";
  const settings = (settingsRes.data as DocumentSettingsRow | null) ?? null;
  const students = (studentsRes.data as StudentRow[] | null) ?? [];
  const enrollments = (enrollmentsRes.data as EnrollmentRow[] | null) ?? [];
  const histories = (historiesRes.data as HistoryRow[] | null) ?? [];
  const tracks = (tracksRes.data as TrackRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const issues = (issuesRes.data as DocumentIssueRow[] | null) ?? [];

  const combinedError =
    schoolRes.error?.message ||
    settingsRes.error?.message ||
    studentsRes.error?.message ||
    enrollmentsRes.error?.message ||
    historiesRes.error?.message ||
    tracksRes.error?.message ||
    classesRes.error?.message ||
    issuesRes.error?.message ||
    null;

  const classesById = new Map(classes.map((row) => [row.id, row]));
  const studentsById = new Map(students.map((row) => [row.id, row]));

  const enrollmentsByStudent = new Map<string, EnrollmentRow[]>();
  for (const row of enrollments) {
    const list = enrollmentsByStudent.get(row.student_id) ?? [];
    list.push(row);
    enrollmentsByStudent.set(row.student_id, list);
  }

  const historiesByStudent = new Map<string, HistoryRow[]>();
  for (const row of histories) {
    const list = historiesByStudent.get(row.student_id) ?? [];
    list.push(row);
    historiesByStudent.set(row.student_id, list);
  }

  const tracksByStudent = new Map<string, TrackRow[]>();
  for (const row of tracks) {
    const list = tracksByStudent.get(row.student_id) ?? [];
    list.push(row);
    tracksByStudent.set(row.student_id, list);
  }

  const rows = students.map((student) => {
    const activeEnrollment = pickActiveEnrollment(enrollmentsByStudent.get(student.id) ?? []);
    const latestHistory = pickLatestByCreatedAt(historiesByStudent.get(student.id) ?? []);
    const latestTrack = pickLatestByCreatedAt(tracksByStudent.get(student.id) ?? []);
    return {
      student,
      activeEnrollment,
      latestHistory,
      latestTrack,
      classRow: activeEnrollment ? classesById.get(activeEnrollment.class_id) ?? null : null,
    };
  });

  const missingHistoryCount = rows.filter((row) => !row.latestHistory).length;
  const technicalEligibleCount = rows.filter((row) => row.latestTrack).length;

  async function issueDocumentAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();

    const studentId = String(formData.get("student_id") || "").trim();
    const issueType = String(formData.get("issue_type") || "").trim().toUpperCase();
    const requestedBy = cleanNullableText(formData.get("requested_by"));
    const notes = cleanNullableText(formData.get("notes"));
    const issuedAt = normalizeIsoDate(formData.get("issued_at"));

    if (!studentId) {
      redirect("/students/documentos?error=" + encodeMsg("Selecione um estudante para emitir o documento."));
    }
    if (!issueType) {
      redirect("/students/documentos?error=" + encodeMsg("Selecione o tipo de documento."));
    }

    const [settingsRes, studentRes, enrollmentRes, historyRes, trackRes] = await Promise.all([
      supabase.from("school_document_settings").select("*").eq("school_id", profile.school_id).maybeSingle(),
      supabase.from("students").select("id, full_name, social_name, registration_number").eq("school_id", profile.school_id).eq("id", studentId).maybeSingle(),
      supabase
        .from("student_enrollments")
        .select("id, class_id, school_year, entry_cohort, curriculum_version, offer_model, enrollment_status, itinerary_axis, itinerary_name, elective_name, project_of_life_notes")
        .eq("school_id", profile.school_id)
        .eq("student_id", studentId)
        .order("school_year", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("student_history_records")
        .select("id, school_year, series_year, curriculum_version, outcome_status, fgb_hours_completed, itinerary_hours_completed, technical_hours_completed, attendance_rate, assessment_average, final_notes")
        .eq("school_id", profile.school_id)
        .eq("student_id", studentId)
        .order("school_year", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("student_professional_tracks")
        .select("id, track_name, partner_name, qualification_type, total_hours, completed_hours, certification_status, certification_title, notes")
        .eq("school_id", profile.school_id)
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const student = studentRes.data as any;
    const enrollment = enrollmentRes.data as any;
    const history = historyRes.data as any;
    const track = trackRes.data as any;
    const settings = settingsRes.data as any;
    const classRes = enrollment?.class_id
      ? await supabase
          .from("classes")
          .select("id, name, shift")
          .eq("school_id", profile.school_id)
          .eq("id", String(enrollment.class_id))
          .maybeSingle()
      : { data: null };
    const classRow = classRes.data as any;

    if (!student?.id) {
      redirect("/students/documentos?error=" + encodeMsg("Estudante não encontrado."));
    }

    const payload = {
      student_name: student.full_name ?? null,
      social_name: student.social_name ?? null,
      registration_number: student.registration_number ?? null,
      school_year: history?.school_year ?? enrollment?.school_year ?? new Date().getFullYear(),
      class_name: classRow?.name ?? null,
      shift: classRow?.shift ?? null,
      series_year: history?.series_year ?? null,
      curriculum_version: history?.curriculum_version ?? enrollment?.curriculum_version ?? null,
      offer_model: enrollment?.offer_model ?? null,
      entry_cohort: enrollment?.entry_cohort ?? null,
      itinerary_axis: enrollment?.itinerary_axis ?? null,
      itinerary_name: enrollment?.itinerary_name ?? null,
      elective_name: enrollment?.elective_name ?? null,
      project_of_life_notes: enrollment?.project_of_life_notes ?? null,
      attendance_rate: history?.attendance_rate ?? null,
      assessment_average: history?.assessment_average ?? null,
      outcome_status: history?.outcome_status ?? null,
      fgb_hours_completed: history?.fgb_hours_completed ?? 0,
      itinerary_hours_completed: history?.itinerary_hours_completed ?? 0,
      technical_hours_completed: history?.technical_hours_completed ?? 0,
      final_notes: [history?.final_notes, settings?.default_history_observation].filter(Boolean).join("\n"),
      track_name: track?.track_name ?? null,
      partner_name: track?.partner_name ?? null,
      qualification_type: track?.qualification_type ?? null,
      certification_status: track?.certification_status ?? null,
      certification_title: track?.certification_title ?? null,
      completed_hours: track?.completed_hours ?? null,
      total_hours: track?.total_hours ?? null,
      progress_percent: computeCompletionPercent(track?.completed_hours ?? null, track?.total_hours ?? null),
    };

    const signatorySnapshot = {
      principal_name: settings?.principal_name ?? null,
      principal_role_label: settings?.principal_role_label ?? "Direção",
      secretary_name: settings?.secretary_name ?? null,
      secretary_role_label: settings?.secretary_role_label ?? "Secretaria Escolar",
    };

    const issueNumber = cleanNullableText(formData.get("issue_number")) ?? defaultIssueNumber(issueType, issuedAt, student.registration_number ?? null);

    const { error } = await supabase.from("student_document_issues").insert({
      school_id: profile.school_id,
      student_id: student.id,
      enrollment_id: enrollment?.id ?? null,
      history_record_id: history?.id ?? null,
      issue_type: issueType,
      issue_number: issueNumber,
      issued_at: issuedAt,
      requested_by: requestedBy,
      signatory_snapshot: signatorySnapshot,
      document_payload: payload,
      notes,
      created_by: user.id,
    });

    if (error) {
      redirect("/students/documentos?error=" + encodeMsg(error.message));
    }

    revalidatePath("/students/documentos");
    redirect("/students/documentos?msg=" + encodeMsg(`Documento ${documentIssueTypeLabel(issueType).toLowerCase()} emitido.`));
  }

  async function deleteIssueAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("issue_id") || "").trim();
    if (!id) redirect("/students/documentos?error=" + encodeMsg("Documento inválido."));

    const { error } = await supabase.from("student_document_issues").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/students/documentos?error=" + encodeMsg(error.message));

    revalidatePath("/students/documentos");
    redirect("/students/documentos?msg=" + encodeMsg("Documento removido do registro interno."));
  }

  return (
    <Shell
      title="Documentos do aluno"
      subtitle="Emita declarações, histórico do NEM e comprovantes internos a partir da trajetória já registrada no sistema."
    >
      <div className="grid gap-4">
        {msg ? <Flash message={msg} variant="success" /> : null}
        {error ? <Flash message={error} variant="error" /> : null}
        {combinedError ? <Flash message={combinedError} variant="error" /> : null}

        {!settings ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            Os documentos podem ser emitidos mesmo sem configuração, mas a aparência oficial fica manca. Ajuste em <Link href="/director/documentos-nem" className="underline">Documentos NEM</Link>.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <form action={issueDocumentAction} className="panel grid gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Nova emissão</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  O sistema puxa o último histórico, a matrícula ativa e a trilha técnica do estudante. Em outras palavras: menos caça ao dado perdido no labirinto escolar.
                </p>
              </div>
              <Link href="/director/documentos-nem" className="btn btn-secondary">
                Configurar layout
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span>Estudante</span>
                <select name="student_id" defaultValue="" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                  <option value="">Selecione</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {(student.social_name || student.full_name || "Sem nome").trim()}
                      {student.registration_number ? ` • ${student.registration_number}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Tipo de documento</span>
                <select name="issue_type" defaultValue="HISTORICO_ESCOLAR_NEM" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                  {DOCUMENT_ISSUE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span>Data de emissão</span>
                <input
                  type="date"
                  name="issued_at"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Número do documento (opcional)</span>
                <input
                  name="issue_number"
                  placeholder="Deixe em branco para gerar automático"
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span>Solicitado por</span>
                <input
                  name="requested_by"
                  defaultValue={profile.full_name ?? user.email ?? ""}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span>Observações da emissão</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Ex.: segunda via, uso para transferência, apresentação em estágio"
                className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-500">Base escolar: {schoolName}</div>
              <button type="submit" className="btn btn-primary">
                Emitir documento
              </button>
            </div>
          </form>

          <div className="grid gap-4">
            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Painel rápido</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Documentos emitidos</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">{issues.length}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Alunos sem histórico</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">{missingHistoryCount}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Trilhas técnicas disponíveis</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">{technicalEligibleCount}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Layout configurado</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">{settings ? "Sim" : "Não"}</div>
                </div>
              </div>
            </div>

            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Prontos para emissão</h2>
              <div className="mt-3 space-y-3">
                {rows.slice(0, 6).map((row) => (
                  <div key={row.student.id} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="font-medium">{row.student.social_name || row.student.full_name || "Sem nome"}</div>
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      {row.student.registration_number || "Sem matrícula"} • {classLabel(row.classRow)}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      {row.activeEnrollment ? optionLabel(OFFER_MODEL_OPTIONS, row.activeEnrollment.offer_model, "Oferta não informada") : "Sem matrícula ativa"}
                      {row.latestHistory?.school_year ? ` • histórico ${row.latestHistory.school_year}` : " • sem histórico consolidado"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Emissões recentes</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Registro interno dos documentos gerados. Serve para rastreio, reimpressão e para evitar aquele clássico “onde foi parar a declaração?”.
              </p>
            </div>
          </div>

          {issues.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="pb-2 pr-3 font-medium">Documento</th>
                    <th className="pb-2 pr-3 font-medium">Aluno</th>
                    <th className="pb-2 pr-3 font-medium">Data</th>
                    <th className="pb-2 pr-3 font-medium">Solicitante</th>
                    <th className="pb-2 pr-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => {
                    const student = studentsById.get(issue.student_id);
                    return (
                      <tr key={issue.id} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                        <td className="py-3 pr-3">
                          <div className="font-medium">{documentIssueTypeLabel(issue.issue_type)}</div>
                          <div className="text-xs text-zinc-500">{issue.issue_number || "Sem número"}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <div>{student?.social_name || student?.full_name || "Estudante removido"}</div>
                          <div className="text-xs text-zinc-500">{student?.registration_number || "Sem matrícula"}</div>
                        </td>
                        <td className="py-3 pr-3">{formatDatePtBr(issue.issued_at)}</td>
                        <td className="py-3 pr-3">{issue.requested_by || "—"}</td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/students/documentos/${issue.id}`} className="btn btn-secondary">
                              Abrir
                            </Link>
                            <form action={deleteIssueAction}>
                              <input type="hidden" name="issue_id" value={issue.id} />
                              <ConfirmButton
                                className="btn btn-ghost"
                                confirmText="Remover o registro desta emissão?"
                              >
                                Remover
                              </ConfirmButton>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              Nenhum documento emitido ainda. Quando o primeiro sair, ele aparece aqui em vez de evaporar na névoa administrativa.
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
