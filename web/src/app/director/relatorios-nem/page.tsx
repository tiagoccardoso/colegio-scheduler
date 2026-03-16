import Link from "next/link";

import { Shell } from "@/components/Shell";
import { requireDirector } from "@/lib/require-director";
import {
  CERTIFICATION_STATUS_OPTIONS,
  computeCompletionPercent,
  formatPercent,
  HISTORY_OUTCOME_OPTIONS,
  optionLabel,
  QUALIFICATION_TYPE_OPTIONS,
} from "@/lib/novo-ensino-medio-students";
import { labelNemOfferModel } from "@/lib/novo-ensino-medio";

type StudentRow = {
  id: string;
  full_name: string | null;
};

type EnrollmentRow = {
  id: string;
  student_id: string;
  class_id: string;
  school_year: number | null;
  entry_cohort: number | null;
  offer_model: string | null;
  enrollment_status: string | null;
};

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
};

type HistoryRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  school_year: number | null;
  outcome_status: string | null;
  fgb_hours_completed: number | null;
  itinerary_hours_completed: number | null;
  technical_hours_completed: number | null;
  attendance_rate: number | null;
  assessment_average: number | null;
};

type TrackRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  qualification_type: string | null;
  total_hours: number | null;
  completed_hours: number | null;
  certification_status: string | null;
};

type AlertRow = {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  severity: string | null;
  status: string | null;
};

function classLabel(row: ClassRow | null | undefined) {
  if (!row) return "Sem turma";
  const shift = String(row.shift ?? "").trim();
  return `${row.name ?? "Turma"}${shift ? ` • ${shift}` : ""}`;
}

export default async function DirectorNemReportsPage() {
  const { supabase, profile } = await requireDirector();

  const [studentsRes, enrollmentsRes, classesRes, historiesRes, tracksRes, alertsRes] = await Promise.all([
    supabase.from("students").select("id, full_name").eq("school_id", profile.school_id),
    supabase
      .from("student_enrollments")
      .select("id, student_id, class_id, school_year, entry_cohort, offer_model, enrollment_status")
      .eq("school_id", profile.school_id),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id),
    supabase
      .from("student_history_records")
      .select("id, student_id, enrollment_id, school_year, outcome_status, fgb_hours_completed, itinerary_hours_completed, technical_hours_completed, attendance_rate, assessment_average")
      .eq("school_id", profile.school_id),
    supabase
      .from("student_professional_tracks")
      .select("id, student_id, enrollment_id, qualification_type, total_hours, completed_hours, certification_status")
      .eq("school_id", profile.school_id),
    supabase
      .from("student_risk_alerts")
      .select("id, student_id, enrollment_id, severity, status")
      .eq("school_id", profile.school_id),
  ]);

  const students = (studentsRes.data as StudentRow[] | null) ?? [];
  const enrollments = (enrollmentsRes.data as EnrollmentRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const histories = (historiesRes.data as HistoryRow[] | null) ?? [];
  const tracks = (tracksRes.data as TrackRow[] | null) ?? [];
  const alerts = (alertsRes.data as AlertRow[] | null) ?? [];

  const combinedError =
    studentsRes.error?.message ||
    enrollmentsRes.error?.message ||
    classesRes.error?.message ||
    historiesRes.error?.message ||
    tracksRes.error?.message ||
    alertsRes.error?.message ||
    null;

  const classMap = new Map(classes.map((row) => [row.id, row]));
  const historyByStudent = new Map<string, HistoryRow[]>();
  for (const row of histories) {
    const list = historyByStudent.get(row.student_id) ?? [];
    list.push(row);
    historyByStudent.set(row.student_id, list);
  }

  const alertByEnrollment = new Map<string, AlertRow[]>();
  for (const row of alerts.filter((item) => String(item.status ?? "").toUpperCase() !== "RESOLVIDO")) {
    const key = String(row.enrollment_id ?? "");
    if (!key) continue;
    const list = alertByEnrollment.get(key) ?? [];
    list.push(row);
    alertByEnrollment.set(key, list);
  }

  const cohortSummary = Array.from(
    enrollments.reduce((map, row) => {
      const key = String(row.entry_cohort ?? "SEM_COORTE");
      const current = map.get(key) ?? { key, students: new Set<string>(), active: 0, withHistory: 0, concluded: 0 };
      current.students.add(row.student_id);
      if (String(row.enrollment_status ?? "").toUpperCase() === "ATIVA") current.active += 1;
      const studentHistories = historyByStudent.get(row.student_id) ?? [];
      if (studentHistories.length) current.withHistory += 1;
      if (studentHistories.some((h) => {
        const s = String(h.outcome_status ?? "").toUpperCase();
        return s === "APROVADO" || s === "CONCLUIDO";
      })) current.concluded += 1;
      map.set(key, current);
      return map;
    }, new Map<string, { key: string; students: Set<string>; active: number; withHistory: number; concluded: number }>())
      .values(),
  )
    .map((row) => ({
      cohort: row.key,
      students: row.students.size,
      active: row.active,
      withHistory: row.withHistory,
      concluded: row.concluded,
    }))
    .sort((a, b) => String(a.cohort).localeCompare(String(b.cohort)));

  const offerSummary = Array.from(
    enrollments.reduce((map, row) => {
      const key = String(row.offer_model ?? "SEM_MODELO");
      const current = map.get(key) ?? { key, total: 0, active: 0, alerts: 0 };
      current.total += 1;
      if (String(row.enrollment_status ?? "").toUpperCase() === "ATIVA") current.active += 1;
      current.alerts += (alertByEnrollment.get(row.id) ?? []).length;
      map.set(key, current);
      return map;
    }, new Map<string, { key: string; total: number; active: number; alerts: number }>())
      .values(),
  ).sort((a, b) => b.total - a.total);

  const classGaps = classes
    .map((classRow) => {
      const classEnrollments = enrollments.filter((enrollment) => enrollment.class_id === classRow.id && String(enrollment.enrollment_status ?? "").toUpperCase() === "ATIVA");
      const withHistory = classEnrollments.filter((enrollment) => (historyByStudent.get(enrollment.student_id) ?? []).length > 0).length;
      return {
        classRow,
        active: classEnrollments.length,
        withoutHistory: Math.max(0, classEnrollments.length - withHistory),
        alerts: classEnrollments.reduce((sum, enrollment) => sum + (alertByEnrollment.get(enrollment.id) ?? []).length, 0),
      };
    })
    .sort((a, b) => b.withoutHistory - a.withoutHistory || b.alerts - a.alerts)
    .slice(0, 8);

  const trackSummary = Array.from(
    tracks.reduce((map, row) => {
      const key = `${row.qualification_type ?? "SEM_TIPO"}__${row.certification_status ?? "SEM_STATUS"}`;
      const current = map.get(key) ?? { qualification_type: row.qualification_type, certification_status: row.certification_status, total: 0, completion: [] as number[] };
      current.total += 1;
      const pct = computeCompletionPercent(row.completed_hours, row.total_hours);
      if (pct != null) current.completion.push(pct);
      map.set(key, current);
      return map;
    }, new Map<string, { qualification_type: string | null; certification_status: string | null; total: number; completion: number[] }>())
      .values(),
  )
    .map((row) => ({
      ...row,
      avgCompletion: row.completion.length ? row.completion.reduce((a, b) => a + b, 0) / row.completion.length : null,
    }))
    .sort((a, b) => b.total - a.total);

  const totalActive = enrollments.filter((row) => String(row.enrollment_status ?? "").toUpperCase() === "ATIVA").length;
  const totalWithHistory = new Set(histories.map((row) => row.student_id)).size;
  const totalWithoutHistory = Math.max(0, students.length - totalWithHistory);
  const openAlerts = alerts.filter((row) => String(row.status ?? "").toUpperCase() !== "RESOLVIDO").length;

  return (
    <Shell
      title="Relatórios NEM"
      subtitle="Painel executivo para enxergar coortes, modelos de oferta, lacunas documentais e trilhas técnicas sem depender do xamanismo do Excel."
    >
      <div className="grid gap-4">
        {combinedError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {combinedError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: "Matrículas ativas", value: totalActive, helper: "Base viva da operação." },
            { label: "Estudantes com histórico", value: totalWithHistory, helper: "Já documentados no ciclo anual." },
            { label: "Sem histórico", value: totalWithoutHistory, helper: "Onde a secretaria ainda está devendo memória institucional." },
            { label: "Alertas abertos", value: openAlerts, helper: "Casos que ainda pedem intervenção." },
          ].map((card) => (
            <div key={card.label} className="panel p-4">
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{card.label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</div>
              <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{card.helper}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Coortes e documentação</div>
                <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Visão de quantos estudantes estão ativos por coorte e quantos já têm histórico consolidado.
                </div>
              </div>
              <Link href="/students/historicos" className="btn btn-secondary">
                Abrir históricos
              </Link>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Coorte</th>
                    <th className="table-th">Estudantes</th>
                    <th className="table-th">Ativos</th>
                    <th className="table-th">Com histórico</th>
                    <th className="table-th">Concluídos</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortSummary.map((row) => (
                    <tr key={row.cohort} className="table-row">
                      <td className="table-td">{row.cohort === "SEM_COORTE" ? "Sem coorte" : row.cohort}</td>
                      <td className="table-td">{row.students}</td>
                      <td className="table-td">{row.active}</td>
                      <td className="table-td">{row.withHistory}</td>
                      <td className="table-td">{row.concluded}</td>
                    </tr>
                  ))}
                  {cohortSummary.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={5} className="table-td text-zinc-500 dark:text-zinc-400">Nenhuma matrícula encontrada.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-lg font-semibold">Modelos de oferta</div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Onde estão os estudantes e quantos alertas seguem abertos por tipo de oferta.
            </div>
            <div className="mt-4 grid gap-3">
              {offerSummary.length ? offerSummary.map((row) => (
                <div key={row.key} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="font-medium">{labelNemOfferModel(row.key)}</div>
                  <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    {row.total} matrícula(s) • {row.active} ativa(s) • {row.alerts} alerta(s)
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  Ainda não há dados suficientes para resumir os modelos de oferta.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="panel p-5">
            <div className="text-lg font-semibold">Turmas com lacuna documental</div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Turmas com estudantes ativos, mas sem histórico anual consolidado.
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Turma</th>
                    <th className="table-th">Ativos</th>
                    <th className="table-th">Sem histórico</th>
                    <th className="table-th">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {classGaps.map((row) => (
                    <tr key={row.classRow.id} className="table-row">
                      <td className="table-td">{classLabel(row.classRow)}</td>
                      <td className="table-td">{row.active}</td>
                      <td className="table-td">{row.withoutHistory}</td>
                      <td className="table-td">{row.alerts}</td>
                    </tr>
                  ))}
                  {classGaps.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={4} className="table-td text-zinc-500 dark:text-zinc-400">Nenhuma turma com dados suficientes.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel p-5">
            <div className="text-lg font-semibold">Trilhas técnicas e certificação</div>
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Distribuição por tipo de qualificação e status de certificação.
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="table-th">Tipo</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Registros</th>
                    <th className="table-th">Progresso médio</th>
                  </tr>
                </thead>
                <tbody>
                  {trackSummary.map((row, index) => (
                    <tr key={`${row.qualification_type}-${row.certification_status}-${index}`} className="table-row">
                      <td className="table-td">{optionLabel(QUALIFICATION_TYPE_OPTIONS, row.qualification_type, "Sem tipo")}</td>
                      <td className="table-td">{optionLabel(CERTIFICATION_STATUS_OPTIONS, row.certification_status, "Sem status")}</td>
                      <td className="table-td">{row.total}</td>
                      <td className="table-td">{formatPercent(row.avgCompletion)}</td>
                    </tr>
                  ))}
                  {trackSummary.length === 0 ? (
                    <tr className="table-row">
                      <td colSpan={4} className="table-td text-zinc-500 dark:text-zinc-400">Nenhuma trilha técnica ou profissional cadastrada.</td>
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
