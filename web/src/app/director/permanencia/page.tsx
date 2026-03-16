import Link from "next/link";
import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import {
  badgeToneForAlert,
  badgeToneForRisk,
  computeAssessmentAverage,
  computeAttendanceRate,
  formatPercent,
  optionLabel,
  RISK_INDICATOR_OPTIONS,
  RISK_LEVEL_OPTIONS,
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
  risk_level: string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
};

type AttendanceRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  status: string | null;
};

type AssessmentRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  score: number | null;
  max_score: number | null;
};

type AlertRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  indicator_type: string | null;
  severity: string | null;
  status: string | null;
  action_plan: string | null;
  identified_at: string | null;
};

function classLabel(row: ClassRow | null | undefined) {
  if (!row) return "Sem turma";
  const shift = String(row.shift ?? "").trim();
  return `${row.name ?? "Turma"}${shift ? ` • ${shift}` : ""}`;
}

export default async function DirectorPermanenciaPage() {
  const { supabase, profile } = await requireDirector();

  const [studentsRes, enrollmentsRes, classesRes, attendanceRes, assessmentsRes, alertsRes] = await Promise.all([
    supabase.from("students").select("id, full_name, registration_number").eq("school_id", profile.school_id).order("full_name", { ascending: true }),
    supabase
      .from("student_enrollments")
      .select("id, student_id, class_id, school_year, enrollment_status, itinerary_name, risk_level")
      .eq("school_id", profile.school_id)
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase
      .from("student_attendance_records")
      .select("id, student_id, enrollment_id, status")
      .eq("school_id", profile.school_id)
      .gte("reference_date", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10)),
    supabase
      .from("student_assessment_records")
      .select("id, student_id, enrollment_id, score, max_score")
      .eq("school_id", profile.school_id)
      .gte("reference_date", new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString().slice(0, 10)),
    supabase
      .from("student_risk_alerts")
      .select("id, student_id, enrollment_id, indicator_type, severity, status, action_plan, identified_at")
      .eq("school_id", profile.school_id)
      .order("identified_at", { ascending: false })
      .limit(50),
  ]);

  const students = (studentsRes.data as StudentRow[] | null) ?? [];
  const enrollments = (enrollmentsRes.data as EnrollmentRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const attendance = (attendanceRes.data as AttendanceRow[] | null) ?? [];
  const assessments = (assessmentsRes.data as AssessmentRow[] | null) ?? [];
  const alerts = (alertsRes.data as AlertRow[] | null) ?? [];

  const studentMap = new Map(students.map((row) => [row.id, row]));
  const classMap = new Map(classes.map((row) => [row.id, row]));
  const enrollmentMap = new Map(enrollments.map((row) => [row.id, row]));

  const attendanceRate = computeAttendanceRate(attendance);
  const assessmentAverage = computeAssessmentAverage(assessments.map((row) => ({ score: row.score, max_score: row.max_score })));
  const activeEnrollments = enrollments.filter((row) => String(row.enrollment_status ?? "").toUpperCase() === "ATIVA");
  const openAlerts = alerts.filter((row) => String(row.status ?? "").toUpperCase() !== "RESOLVIDO");
  const highRiskEnrollments = activeEnrollments.filter((row) => {
    const risk = String(row.risk_level ?? "").toUpperCase();
    return risk === "ALTO" || risk === "CRITICO";
  });

  const attendanceByEnrollment = new Map<string, AttendanceRow[]>();
  for (const row of attendance) {
    const key = String(row.enrollment_id ?? "");
    if (!key) continue;
    const list = attendanceByEnrollment.get(key) ?? [];
    list.push(row);
    attendanceByEnrollment.set(key, list);
  }

  const assessmentByEnrollment = new Map<string, AssessmentRow[]>();
  for (const row of assessments) {
    const key = String(row.enrollment_id ?? "");
    if (!key) continue;
    const list = assessmentByEnrollment.get(key) ?? [];
    list.push(row);
    assessmentByEnrollment.set(key, list);
  }

  const alertsByEnrollment = new Map<string, AlertRow[]>();
  for (const row of openAlerts) {
    const key = String(row.enrollment_id ?? "");
    if (!key) continue;
    const list = alertsByEnrollment.get(key) ?? [];
    list.push(row);
    alertsByEnrollment.set(key, list);
  }

  const classRows = classes
    .map((classRow) => {
      const classEnrollments = activeEnrollments.filter((row) => row.class_id === classRow.id);
      const attendanceRecords = classEnrollments.flatMap((row) => attendanceByEnrollment.get(row.id) ?? []);
      const classAttendanceRate = computeAttendanceRate(attendanceRecords);
      const classAlerts = classEnrollments.flatMap((row) => alertsByEnrollment.get(row.id) ?? []);
      return {
        classRow,
        students: classEnrollments.length,
        attendanceRate: classAttendanceRate,
        alerts: classAlerts.length,
        highRisk: classEnrollments.filter((row) => {
          const risk = String(row.risk_level ?? "").toUpperCase();
          return risk === "ALTO" || risk === "CRITICO";
        }).length,
      };
    })
    .sort((a, b) => b.alerts - a.alerts || (a.attendanceRate ?? 100) - (b.attendanceRate ?? 100));

  const spotlight = activeEnrollments
    .map((enrollment) => {
      const student = studentMap.get(enrollment.student_id);
      const classRow = classMap.get(enrollment.class_id);
      const attendanceRateByStudent = computeAttendanceRate(attendanceByEnrollment.get(enrollment.id) ?? []);
      const assessmentRateByStudent = computeAssessmentAverage(assessmentByEnrollment.get(enrollment.id) ?? []);
      const openAlertsByStudent = alertsByEnrollment.get(enrollment.id) ?? [];
      const riskWeight = ["BAIXO", "MEDIO", "ALTO", "CRITICO"].indexOf(String(enrollment.risk_level ?? "BAIXO").toUpperCase());
      return {
        enrollment,
        student,
        classRow,
        attendanceRate: attendanceRateByStudent,
        assessmentRate: assessmentRateByStudent,
        openAlerts: openAlertsByStudent,
        rank: (riskWeight < 0 ? 0 : riskWeight) * 10 + openAlertsByStudent.length * 5 + (attendanceRateByStudent != null ? 100 - attendanceRateByStudent : 0),
      };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 8);

  const combinedError =
    studentsRes.error?.message ||
    enrollmentsRes.error?.message ||
    classesRes.error?.message ||
    attendanceRes.error?.message ||
    assessmentsRes.error?.message ||
    alertsRes.error?.message ||
    null;

  return (
    <Shell
      title="Permanência e trajetória"
      subtitle="Painel executivo para vigiar evasão, rendimento e alertas do Novo Ensino Médio sem cair no teatro das planilhas órfãs."
    >
      <div className="grid gap-4">
        {combinedError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {combinedError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Estudantes ativos", value: activeEnrollments.length, helper: "Matrículas ativas nas turmas." },
            { label: "Presença 30 dias", value: formatPercent(attendanceRate), helper: "Baseada nos registros pedagógicos lançados." },
            { label: "Média avaliativa", value: formatPercent(assessmentAverage), helper: "Média dos registros com nota e máximo." },
            { label: "Alertas em aberto", value: openAlerts.length, helper: "Casos que pedem intervenção." },
          ].map((card) => (
            <div key={card.label} className="panel p-4">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{card.helper}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Mapa de permanência por turma</div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Mistura risco declarado, alertas abertos e presença recente para dar uma visão rápida de onde apertar primeiro.
                </div>
              </div>
              <Link href="/students/acompanhamento" className="btn btn-secondary">
                Abrir acompanhamento
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Turma</th>
                    <th className="table-th">Estudantes</th>
                    <th className="table-th">Presença</th>
                    <th className="table-th">Alto risco</th>
                    <th className="table-th">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {classRows.map((row) => (
                    <tr key={row.classRow.id} className="table-row">
                      <td className="table-td font-medium">{classLabel(row.classRow)}</td>
                      <td className="table-td">{row.students}</td>
                      <td className="table-td">{formatPercent(row.attendanceRate)}</td>
                      <td className="table-td">{row.highRisk}</td>
                      <td className="table-td">{row.alerts}</td>
                    </tr>
                  ))}
                  {classRows.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={5} className="table-td text-zinc-500 dark:text-zinc-400">
                        Ainda não há turmas com trajetória estudantil registrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-lg font-semibold">Radar de intervenção</div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Os oito casos mais quentes da panela pedagógica, ordenados por risco, alertas e sinais de frequência.
            </div>
            <div className="mt-4 grid gap-3">
              {spotlight.map((item) => (
                <div key={item.enrollment.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.student?.full_name ?? "Aluno"}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{classLabel(item.classRow)}</div>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeToneForRisk(item.enrollment.risk_level)}`}>
                      {optionLabel(RISK_LEVEL_OPTIONS, item.enrollment.risk_level)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <div>Presença recente: <strong>{formatPercent(item.attendanceRate)}</strong></div>
                    <div>Média avaliativa: <strong>{formatPercent(item.assessmentRate)}</strong></div>
                    <div>Itinerário: <strong>{item.enrollment.itinerary_name || "—"}</strong></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.openAlerts.length ? item.openAlerts.map((alert) => (
                      <span key={alert.id} className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeToneForAlert(alert.severity)}`}>
                        {optionLabel(RISK_INDICATOR_OPTIONS, alert.indicator_type)} · {optionLabel(RISK_SEVERITY_OPTIONS, alert.severity)}
                      </span>
                    )) : <span className="text-xs text-zinc-500 dark:text-zinc-400">Sem alerta aberto. Só já merece olho vivo.</span>}
                  </div>
                </div>
              ))}
              {spotlight.length === 0 ? (
                <div className="rounded-2xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  Ainda não há dados suficientes para montar o radar de intervenção.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="table-wrap">
            <div className="border-b border-zinc-100 p-4 font-semibold dark:border-zinc-900">Alertas em aberto</div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Aluno</th>
                    <th className="table-th">Indicador</th>
                    <th className="table-th">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {openAlerts.map((alert) => {
                    const enrollment = enrollmentMap.get(String(alert.enrollment_id ?? ""));
                    const student = enrollment ? studentMap.get(enrollment.student_id) : studentMap.get(alert.student_id);
                    return (
                      <tr key={alert.id} className="table-row align-top">
                        <td className="table-td">
                          <div className="font-medium">{student?.full_name ?? "Aluno"}</div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{enrollment ? classLabel(classMap.get(enrollment.class_id)) : "Sem matrícula"}</div>
                        </td>
                        <td className="table-td">{optionLabel(RISK_INDICATOR_OPTIONS, alert.indicator_type)}</td>
                        <td className="table-td">
                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeToneForAlert(alert.severity)}`}>
                              {optionLabel(RISK_SEVERITY_OPTIONS, alert.severity)}
                            </span>
                            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                              {optionLabel(RISK_STATUS_OPTIONS, alert.status)}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap">
                            {alert.action_plan || "Sem plano de ação registrado ainda."}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {openAlerts.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={3} className="table-td text-zinc-500 dark:text-zinc-400">
                        Nenhum alerta aberto. Que continue assim, sem superstição.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-lg font-semibold">Leitura gerencial desta fase</div>
            <div className="mt-3 grid gap-3 text-sm text-zinc-700 dark:text-zinc-300">
              <p>
                O sistema já saiu do modo “grade bonita” e entrou no terreno onde o Novo Ensino Médio realmente dói ou funciona:
                percurso estudantil, permanência, avaliação e intervenção.
              </p>
              <p>
                O que este painel te entrega agora é uma bússola para decisão. O que ainda depende de próxima etapa é amarrar tudo a
                histórico escolar oficial, relatórios de conformidade por coorte e fluxos completos de certificação técnica.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-sm font-semibold">Já coberto nesta fase</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    <li>Cadastro e matrícula do estudante</li>
                    <li>Escolha inicial de itinerário</li>
                    <li>Projeto de Vida com registro textual</li>
                    <li>Frequência, avaliação e alertas</li>
                    <li>Dashboard de permanência</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="text-sm font-semibold">Próximo passo natural</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    <li>Histórico escolar e ficha individual</li>
                    <li>Relatórios oficiais por coorte</li>
                    <li>Regras completas de técnico integrado</li>
                    <li>Busca ativa com workflow e comunicação</li>
                    <li>Versionamento curricular por estudante</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
