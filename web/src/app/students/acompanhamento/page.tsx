import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  ASSESSMENT_RESULT_OPTIONS,
  ASSESSMENT_TYPE_OPTIONS,
  ATTENDANCE_STATUS_OPTIONS,
  badgeToneForAlert,
  cleanNullable,
  cleanUpperNullable,
  computeAssessmentAverage,
  computeAttendanceRate,
  formatPercent,
  optionLabel,
  RISK_INDICATOR_OPTIONS,
  RISK_SEVERITY_OPTIONS,
  RISK_STATUS_OPTIONS,
} from "@/lib/novo-ensino-medio-students";

type StudentRow = {
  id: string;
  full_name: string | null;
  registration_number: string | null;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  class_id: string;
  school_year: number | null;
  enrollment_status: string | null;
  itinerary_name: string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
};

type SubjectRow = {
  id: string;
  name: string | null;
};

type AttendanceRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  subject_id: string | null;
  reference_date: string | null;
  status: string | null;
  notes: string | null;
  created_at?: string | null;
};

type AssessmentRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  subject_id: string | null;
  assessment_title: string | null;
  assessment_type: string | null;
  reference_date: string | null;
  score: number | null;
  max_score: number | null;
  result_status: string | null;
  evidence_url: string | null;
  notes: string | null;
  created_at?: string | null;
};

type AlertRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  indicator_type: string | null;
  severity: string | null;
  status: string | null;
  identified_at: string | null;
  action_plan: string | null;
  responsible_name: string | null;
  notes: string | null;
  resolved_at: string | null;
  created_at?: string | null;
};

function classLabel(row: ClassRow | null | undefined) {
  if (!row) return "Sem turma";
  const shift = String(row.shift ?? "").trim();
  return `${row.name ?? "Turma"}${shift ? ` • ${shift}` : ""}`;
}

function enrollmentLabel(enrollment: EnrollmentRow, students: Map<string, StudentRow>, classes: Map<string, ClassRow>) {
  const student = students.get(enrollment.student_id);
  const classRow = classes.get(enrollment.class_id);
  return `${student?.full_name ?? "Aluno"} — ${classLabel(classRow)}${enrollment.school_year ? ` • ${enrollment.school_year}` : ""}`;
}

export default async function StudentTrackingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [studentsRes, enrollmentsRes, classesRes, subjectsRes, attendanceRes, assessmentsRes, alertsRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, registration_number")
      .eq("school_id", profile.school_id)
      .order("full_name", { ascending: true }),
    supabase
      .from("student_enrollments")
      .select("id, student_id, class_id, school_year, enrollment_status, itinerary_name")
      .eq("school_id", profile.school_id)
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase.from("subjects").select("id, name").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase
      .from("student_attendance_records")
      .select("id, student_id, enrollment_id, subject_id, reference_date, status, notes, created_at")
      .eq("school_id", profile.school_id)
      .order("reference_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("student_assessment_records")
      .select("id, student_id, enrollment_id, subject_id, assessment_title, assessment_type, reference_date, score, max_score, result_status, evidence_url, notes, created_at")
      .eq("school_id", profile.school_id)
      .order("reference_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("student_risk_alerts")
      .select("id, student_id, enrollment_id, indicator_type, severity, status, identified_at, action_plan, responsible_name, notes, resolved_at, created_at")
      .eq("school_id", profile.school_id)
      .order("identified_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const students = (studentsRes.data as StudentRow[] | null) ?? [];
  const enrollments = (enrollmentsRes.data as EnrollmentRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const subjects = (subjectsRes.data as SubjectRow[] | null) ?? [];
  const attendance = (attendanceRes.data as AttendanceRow[] | null) ?? [];
  const assessments = (assessmentsRes.data as AssessmentRow[] | null) ?? [];
  const alerts = (alertsRes.data as AlertRow[] | null) ?? [];

  const studentMap = new Map(students.map((row) => [row.id, row]));
  const classMap = new Map(classes.map((row) => [row.id, row]));
  const subjectMap = new Map(subjects.map((row) => [row.id, row]));
  const enrollmentMap = new Map(enrollments.map((row) => [row.id, row]));

  const attendanceRate = computeAttendanceRate(attendance);
  const assessmentAverage = computeAssessmentAverage(assessments.map((row) => ({ score: row.score, max_score: row.max_score })));
  const openAlertsCount = alerts.filter((row) => String(row.status ?? "").toUpperCase() !== "RESOLVIDO").length;

  async function attendanceAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();

    const enrollmentId = String(formData.get("attendance_enrollment_id") || "").trim();
    const referenceDate = cleanNullable(formData.get("attendance_reference_date"));
    const status = cleanUpperNullable(formData.get("attendance_status"));

    if (!enrollmentId) redirect("/students/acompanhamento?error=" + encodeMsg("Selecione a matrícula do estudante."));
    if (!referenceDate) redirect("/students/acompanhamento?error=" + encodeMsg("Informe a data da frequência."));
    if (!status) redirect("/students/acompanhamento?error=" + encodeMsg("Selecione o status de frequência."));

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select("id, student_id")
      .eq("id", enrollmentId)
      .eq("school_id", profile.school_id)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      redirect("/students/acompanhamento?error=" + encodeMsg(enrollmentError?.message || "Matrícula não encontrada."));
    }

    const payload = {
      school_id: profile.school_id,
      student_id: String((enrollment as any).student_id),
      enrollment_id: String((enrollment as any).id),
      subject_id: cleanNullable(formData.get("attendance_subject_id")),
      reference_date: referenceDate,
      status,
      notes: cleanNullable(formData.get("attendance_notes")),
      created_by: user.id,
    };

    const { error } = await supabase.from("student_attendance_records").insert(payload);
    if (error) redirect("/students/acompanhamento?error=" + encodeMsg(error.message));

    revalidatePath("/students/acompanhamento");
    revalidatePath("/students/historicos");
    revalidatePath("/director/permanencia");
    revalidatePath("/director/relatorios-nem");
    redirect("/students/acompanhamento?msg=" + encodeMsg("Frequência registrada."));
  }

  async function assessmentAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();

    const enrollmentId = String(formData.get("assessment_enrollment_id") || "").trim();
    const title = cleanNullable(formData.get("assessment_title"));
    const assessmentType = cleanUpperNullable(formData.get("assessment_type"));
    const referenceDate = cleanNullable(formData.get("assessment_reference_date"));

    if (!enrollmentId) redirect("/students/acompanhamento?error=" + encodeMsg("Selecione a matrícula do estudante."));
    if (!title) redirect("/students/acompanhamento?error=" + encodeMsg("Informe o título da avaliação."));
    if (!assessmentType) redirect("/students/acompanhamento?error=" + encodeMsg("Selecione o tipo da avaliação."));
    if (!referenceDate) redirect("/students/acompanhamento?error=" + encodeMsg("Informe a data da avaliação."));

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select("id, student_id")
      .eq("id", enrollmentId)
      .eq("school_id", profile.school_id)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      redirect("/students/acompanhamento?error=" + encodeMsg(enrollmentError?.message || "Matrícula não encontrada."));
    }

    const rawScore = cleanNullable(formData.get("assessment_score"));
    const rawMaxScore = cleanNullable(formData.get("assessment_max_score"));
    const score = rawScore ? Number(rawScore.replace(",", ".")) : null;
    const maxScore = rawMaxScore ? Number(rawMaxScore.replace(",", ".")) : null;

    const payload = {
      school_id: profile.school_id,
      student_id: String((enrollment as any).student_id),
      enrollment_id: String((enrollment as any).id),
      subject_id: cleanNullable(formData.get("assessment_subject_id")),
      assessment_title: title,
      assessment_type: assessmentType,
      reference_date: referenceDate,
      score: Number.isFinite(score as number) ? score : null,
      max_score: Number.isFinite(maxScore as number) ? maxScore : null,
      result_status: cleanUpperNullable(formData.get("assessment_result_status")),
      evidence_url: cleanNullable(formData.get("assessment_evidence_url")),
      notes: cleanNullable(formData.get("assessment_notes")),
      created_by: user.id,
    };

    const { error } = await supabase.from("student_assessment_records").insert(payload);
    if (error) redirect("/students/acompanhamento?error=" + encodeMsg(error.message));

    revalidatePath("/students/acompanhamento");
    revalidatePath("/students/historicos");
    revalidatePath("/director/permanencia");
    revalidatePath("/director/relatorios-nem");
    redirect("/students/acompanhamento?msg=" + encodeMsg("Avaliação registrada."));
  }

  async function alertAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();

    const enrollmentId = String(formData.get("alert_enrollment_id") || "").trim();
    const indicatorType = cleanUpperNullable(formData.get("alert_indicator_type"));
    const identifiedAt = cleanNullable(formData.get("alert_identified_at"));

    if (!enrollmentId) redirect("/students/acompanhamento?error=" + encodeMsg("Selecione a matrícula do estudante."));
    if (!indicatorType) redirect("/students/acompanhamento?error=" + encodeMsg("Selecione o indicador do alerta."));
    if (!identifiedAt) redirect("/students/acompanhamento?error=" + encodeMsg("Informe a data de identificação."));

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("student_enrollments")
      .select("id, student_id")
      .eq("id", enrollmentId)
      .eq("school_id", profile.school_id)
      .maybeSingle();

    if (enrollmentError || !enrollment) {
      redirect("/students/acompanhamento?error=" + encodeMsg(enrollmentError?.message || "Matrícula não encontrada."));
    }

    const payload = {
      school_id: profile.school_id,
      student_id: String((enrollment as any).student_id),
      enrollment_id: String((enrollment as any).id),
      indicator_type: indicatorType,
      severity: cleanUpperNullable(formData.get("alert_severity")) ?? "MEDIA",
      status: cleanUpperNullable(formData.get("alert_status")) ?? "ABERTO",
      identified_at: identifiedAt,
      action_plan: cleanNullable(formData.get("alert_action_plan")),
      responsible_name: cleanNullable(formData.get("alert_responsible_name")),
      notes: cleanNullable(formData.get("alert_notes")),
      created_by: user.id,
    };

    const { error } = await supabase.from("student_risk_alerts").insert(payload);
    if (error) redirect("/students/acompanhamento?error=" + encodeMsg(error.message));

    revalidatePath("/students/acompanhamento");
    revalidatePath("/students/historicos");
    revalidatePath("/director/permanencia");
    revalidatePath("/director/relatorios-nem");
    redirect("/students/acompanhamento?msg=" + encodeMsg("Alerta pedagógico registrado."));
  }

  async function resolveAlertAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("id") || "").trim();
    if (!id) redirect("/students/acompanhamento?error=" + encodeMsg("Alerta inválido."));

    const { error } = await supabase
      .from("student_risk_alerts")
      .update({ status: "RESOLVIDO", resolved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("school_id", profile.school_id);

    if (error) redirect("/students/acompanhamento?error=" + encodeMsg(error.message));

    revalidatePath("/students/acompanhamento");
    revalidatePath("/students/historicos");
    revalidatePath("/director/permanencia");
    revalidatePath("/director/relatorios-nem");
    redirect("/students/acompanhamento?msg=" + encodeMsg("Alerta marcado como resolvido."));
  }

  const combinedError =
    error ||
    studentsRes.error?.message ||
    enrollmentsRes.error?.message ||
    classesRes.error?.message ||
    subjectsRes.error?.message ||
    attendanceRes.error?.message ||
    assessmentsRes.error?.message ||
    alertsRes.error?.message ||
    null;

  return (
    <Shell
      title="Acompanhamento do aluno"
      subtitle="Frequência, avaliação com evidências e alertas de permanência — o nervo pedagógico do Novo Ensino Médio."
    >
      <div className="grid gap-4">
        <Flash message={combinedError || msg} variant={combinedError ? "error" : msg ? "success" : "info"} />

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Registros de frequência", value: attendance.length, helper: `Últimos ${attendance.length} lançamentos.` },
            { label: "Presença recente", value: formatPercent(attendanceRate), helper: "Presente, atraso e justificada contam a favor." },
            { label: "Média avaliativa", value: formatPercent(assessmentAverage), helper: "Percentual sobre notas com máximo informado." },
            { label: "Alertas abertos", value: openAlertsCount, helper: "Casos ainda sem resolução final." },
          ].map((card) => (
            <div key={card.label} className="panel p-4">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{card.helper}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="panel p-5">
            <div className="text-sm font-semibold">Lançar frequência</div>
            <form action={attendanceAction} className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Matrícula</span>
                <select name="attendance_enrollment_id" className="input" defaultValue="">
                  <option value="">Selecione</option>
                  {enrollments.map((enrollment) => (
                    <option key={enrollment.id} value={enrollment.id}>
                      {enrollmentLabel(enrollment, studentMap, classMap)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Data</span>
                  <input name="attendance_reference_date" type="date" className="input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Status</span>
                  <select name="attendance_status" className="input" defaultValue="PRESENTE">
                    {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Componente curricular</span>
                <select name="attendance_subject_id" className="input" defaultValue="">
                  <option value="">Registro geral</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name ?? "Componente"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Observações</span>
                <textarea name="attendance_notes" rows={4} className="input min-h-[110px]" />
              </label>
              <button type="submit" className="btn btn-primary w-fit">
                Salvar frequência
              </button>
            </form>
          </div>

          <div className="panel p-5">
            <div className="text-sm font-semibold">Registrar avaliação</div>
            <form action={assessmentAction} className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Matrícula</span>
                <select name="assessment_enrollment_id" className="input" defaultValue="">
                  <option value="">Selecione</option>
                  {enrollments.map((enrollment) => (
                    <option key={enrollment.id} value={enrollment.id}>
                      {enrollmentLabel(enrollment, studentMap, classMap)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Título</span>
                <input name="assessment_title" type="text" className="input" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Tipo</span>
                  <select name="assessment_type" className="input" defaultValue="PROVA">
                    {ASSESSMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Data</span>
                  <input name="assessment_reference_date" type="date" className="input" />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Componente curricular</span>
                <select name="assessment_subject_id" className="input" defaultValue="">
                  <option value="">Registro geral</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name ?? "Componente"}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Nota obtida</span>
                  <input name="assessment_score" type="number" step="0.01" className="input" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Nota máxima</span>
                  <input name="assessment_max_score" type="number" step="0.01" className="input" />
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Resultado</span>
                <select name="assessment_result_status" className="input" defaultValue="EM_ANDAMENTO">
                  {ASSESSMENT_RESULT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Link da evidência</span>
                <input name="assessment_evidence_url" type="url" className="input" placeholder="https://" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Observações</span>
                <textarea name="assessment_notes" rows={4} className="input min-h-[110px]" />
              </label>
              <button type="submit" className="btn btn-primary w-fit">
                Salvar avaliação
              </button>
            </form>
          </div>

          <div className="panel p-5">
            <div className="text-sm font-semibold">Abrir alerta pedagógico</div>
            <form action={alertAction} className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Matrícula</span>
                <select name="alert_enrollment_id" className="input" defaultValue="">
                  <option value="">Selecione</option>
                  {enrollments.map((enrollment) => (
                    <option key={enrollment.id} value={enrollment.id}>
                      {enrollmentLabel(enrollment, studentMap, classMap)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Indicador</span>
                  <select name="alert_indicator_type" className="input" defaultValue="FREQUENCIA">
                    {RISK_INDICATOR_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Data</span>
                  <input name="alert_identified_at" type="date" className="input" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Severidade</span>
                  <select name="alert_severity" className="input" defaultValue="MEDIA">
                    {RISK_SEVERITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Status</span>
                  <select name="alert_status" className="input" defaultValue="ABERTO">
                    {RISK_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Responsável</span>
                <input name="alert_responsible_name" type="text" className="input" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Plano de ação</span>
                <textarea name="alert_action_plan" rows={4} className="input min-h-[110px]" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Observações</span>
                <textarea name="alert_notes" rows={3} className="input min-h-[90px]" />
              </label>
              <button type="submit" className="btn btn-primary w-fit">
                Salvar alerta
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="table-wrap">
            <div className="border-b border-zinc-100 p-4 font-semibold dark:border-zinc-900">Últimas frequências</div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Aluno</th>
                    <th className="table-th">Data</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((row) => (
                    <tr key={row.id} className="table-row">
                      <td className="table-td">
                        <div className="font-medium">{studentMap.get(row.student_id)?.full_name ?? "Aluno"}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {subjectMap.get(String(row.subject_id ?? ""))?.name ?? "Registro geral"}
                        </div>
                      </td>
                      <td className="table-td">{row.reference_date ?? "—"}</td>
                      <td className="table-td">{optionLabel(ATTENDANCE_STATUS_OPTIONS, row.status)}</td>
                    </tr>
                  ))}
                  {attendance.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={3} className="table-td text-zinc-500 dark:text-zinc-400">
                        Nenhum lançamento ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-wrap">
            <div className="border-b border-zinc-100 p-4 font-semibold dark:border-zinc-900">Últimas avaliações</div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Aluno</th>
                    <th className="table-th">Avaliação</th>
                    <th className="table-th">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((row) => (
                    <tr key={row.id} className="table-row">
                      <td className="table-td">
                        <div className="font-medium">{studentMap.get(row.student_id)?.full_name ?? "Aluno"}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {subjectMap.get(String(row.subject_id ?? ""))?.name ?? "Registro geral"}
                        </div>
                      </td>
                      <td className="table-td">
                        <div className="font-medium">{row.assessment_title ?? "Avaliação"}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{optionLabel(ASSESSMENT_TYPE_OPTIONS, row.assessment_type)}</div>
                      </td>
                      <td className="table-td">
                        <div>{optionLabel(ASSESSMENT_RESULT_OPTIONS, row.result_status)}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {row.score != null && row.max_score != null ? `${row.score}/${row.max_score}` : "Sem nota numérica"}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {assessments.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={3} className="table-td text-zinc-500 dark:text-zinc-400">
                        Nenhuma avaliação lançada ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-wrap">
            <div className="border-b border-zinc-100 p-4 font-semibold dark:border-zinc-900">Alertas pedagógicos</div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Aluno</th>
                    <th className="table-th">Indicador</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((row) => (
                    <tr key={row.id} className="table-row align-top">
                      <td className="table-td">
                        <div className="font-medium">{studentMap.get(row.student_id)?.full_name ?? "Aluno"}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {enrollmentMap.get(String(row.enrollment_id ?? ""))?.itinerary_name ?? "Sem trilha registrada"}
                        </div>
                      </td>
                      <td className="table-td">
                        <div>{optionLabel(RISK_INDICATOR_OPTIONS, row.indicator_type)}</div>
                        <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeToneForAlert(row.severity)}`}>
                          {optionLabel(RISK_SEVERITY_OPTIONS, row.severity)}
                        </span>
                      </td>
                      <td className="table-td">
                        <div>{optionLabel(RISK_STATUS_OPTIONS, row.status)}</div>
                        {String(row.status ?? "").toUpperCase() !== "RESOLVIDO" ? (
                          <form action={resolveAlertAction} className="mt-2">
                            <input type="hidden" name="id" value={row.id} />
                            <ConfirmButton confirmText="Marcar este alerta como resolvido?" type="submit" className="btn btn-secondary text-xs">
                              Resolver
                            </ConfirmButton>
                          </form>
                        ) : (
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Resolvido em {row.resolved_at?.slice(0, 10) ?? "—"}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {alerts.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={3} className="table-td text-zinc-500 dark:text-zinc-400">
                        Nenhum alerta registrado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
