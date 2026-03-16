import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { requireStaff } from "@/lib/require-staff";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  badgeToneForOutcome,
  CERTIFICATION_STATUS_OPTIONS,
  cleanNullable,
  cleanUpperNullable,
  computeCompletionPercent,
  formatPercent,
  HISTORY_OUTCOME_OPTIONS,
  normalizeDecimal,
  normalizeInteger,
  normalizeYear,
  optionLabel,
  QUALIFICATION_TYPE_OPTIONS,
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
  entry_cohort: number | null;
  curriculum_version: string | null;
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
  started_at: string | null;
  concluded_at: string | null;
  created_at?: string | null;
};

function classLabel(row: ClassRow | null | undefined) {
  if (!row) return "Sem turma";
  const shift = String(row.shift ?? "").trim();
  return `${row.name ?? "Turma"}${shift ? ` • ${shift}` : ""}`;
}

function pickLatestHistory(rows: HistoryRow[]) {
  return [...rows].sort((a, b) => {
    const yearA = Number(a.school_year ?? 0);
    const yearB = Number(b.school_year ?? 0);
    if (yearA !== yearB) return yearB - yearA;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  })[0] ?? null;
}

function pickLatestTrack(rows: TrackRow[]) {
  return [...rows].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0] ?? null;
}

export default async function StudentHistoriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [studentsRes, enrollmentsRes, classesRes, historyRes, tracksRes] = await Promise.all([
    supabase.from("students").select("id, full_name, registration_number").eq("school_id", profile.school_id).order("full_name", { ascending: true }),
    supabase
      .from("student_enrollments")
      .select("id, student_id, class_id, school_year, entry_cohort, curriculum_version, offer_model, enrollment_status")
      .eq("school_id", profile.school_id)
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase
      .from("student_history_records")
      .select("id, student_id, enrollment_id, school_year, series_year, curriculum_version, outcome_status, fgb_hours_completed, itinerary_hours_completed, technical_hours_completed, attendance_rate, assessment_average, final_notes, created_at")
      .eq("school_id", profile.school_id)
      .order("school_year", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("student_professional_tracks")
      .select("id, student_id, enrollment_id, track_name, partner_name, qualification_type, total_hours, completed_hours, certification_status, certification_title, notes, started_at, concluded_at, created_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false }),
  ]);

  const students = (studentsRes.data as StudentRow[] | null) ?? [];
  const enrollments = (enrollmentsRes.data as EnrollmentRow[] | null) ?? [];
  const classes = (classesRes.data as ClassRow[] | null) ?? [];
  const histories = (historyRes.data as HistoryRow[] | null) ?? [];
  const tracks = (tracksRes.data as TrackRow[] | null) ?? [];

  const combinedError =
    studentsRes.error?.message ||
    enrollmentsRes.error?.message ||
    classesRes.error?.message ||
    historyRes.error?.message ||
    tracksRes.error?.message ||
    null;

  const enrollmentMap = new Map(enrollments.map((row) => [row.id, row]));
  const classMap = new Map(classes.map((row) => [row.id, row]));

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
    const studentEnrollments = enrollmentsByStudent.get(student.id) ?? [];
    const latestHistory = pickLatestHistory(historiesByStudent.get(student.id) ?? []);
    const latestTrack = pickLatestTrack(tracksByStudent.get(student.id) ?? []);
    const activeEnrollment = [...studentEnrollments].sort((a, b) => {
      const activeA = String(a.enrollment_status ?? "").toUpperCase() === "ATIVA" ? 0 : 1;
      const activeB = String(b.enrollment_status ?? "").toUpperCase() === "ATIVA" ? 0 : 1;
      if (activeA !== activeB) return activeA - activeB;
      return Number(b.school_year ?? 0) - Number(a.school_year ?? 0);
    })[0] ?? null;

    return {
      student,
      activeEnrollment,
      classRow: activeEnrollment ? classMap.get(activeEnrollment.class_id) ?? null : null,
      latestHistory,
      latestTrack,
      allEnrollments: studentEnrollments,
    };
  });

  const historiesCount = histories.length;
  const concludedCount = histories.filter((row) => {
    const status = String(row.outcome_status ?? "").toUpperCase();
    return status === "CONCLUIDO" || status === "APROVADO";
  }).length;
  const withoutHistoryCount = rows.filter((row) => !row.latestHistory).length;
  const technicalTracksCount = tracks.filter((row) => String(row.certification_status ?? "").toUpperCase() !== "INTERROMPIDA").length;
  const certifiedCount = tracks.filter((row) => String(row.certification_status ?? "").toUpperCase() === "CERTIFICADA").length;

  async function saveHistoryAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();

    const id = String(formData.get("history_id") || "").trim();
    const studentId = String(formData.get("student_id") || "").trim();
    const schoolYear = normalizeYear(formData.get("school_year"), new Date().getFullYear());

    if (!studentId) {
      redirect("/students/historicos?error=" + encodeMsg("Selecione um estudante para salvar o histórico."));
    }

    const payload = {
      school_id: profile.school_id,
      student_id: studentId,
      enrollment_id: cleanNullable(formData.get("enrollment_id")),
      school_year: schoolYear,
      series_year: cleanUpperNullable(formData.get("series_year")),
      curriculum_version: cleanNullable(formData.get("curriculum_version")),
      outcome_status: cleanUpperNullable(formData.get("outcome_status")) ?? "EM_ANDAMENTO",
      fgb_hours_completed: normalizeInteger(formData.get("fgb_hours_completed"), 0, 6000) ?? 0,
      itinerary_hours_completed: normalizeInteger(formData.get("itinerary_hours_completed"), 0, 3000) ?? 0,
      technical_hours_completed: normalizeInteger(formData.get("technical_hours_completed"), 0, 3000) ?? 0,
      attendance_rate: normalizeDecimal(formData.get("attendance_rate"), 100),
      assessment_average: normalizeDecimal(formData.get("assessment_average"), 100),
      final_notes: cleanNullable(formData.get("final_notes")),
      created_by: user.id,
    };

    const query = id
      ? supabase.from("student_history_records").update(payload).eq("id", id).eq("school_id", profile.school_id)
      : supabase.from("student_history_records").insert(payload);

    const { error } = await query;
    if (error) redirect("/students/historicos?error=" + encodeMsg(error.message));

    revalidatePath("/students/historicos");
    revalidatePath("/director/relatorios-nem");
    revalidatePath("/director/permanencia");
    redirect("/students/historicos?msg=" + encodeMsg(id ? "Histórico atualizado." : "Histórico lançado."));
  }

  async function deleteHistoryAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("history_id") || "").trim();
    if (!id) redirect("/students/historicos?error=" + encodeMsg("Histórico inválido."));

    const { error } = await supabase.from("student_history_records").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/students/historicos?error=" + encodeMsg(error.message));

    revalidatePath("/students/historicos");
    revalidatePath("/director/relatorios-nem");
    redirect("/students/historicos?msg=" + encodeMsg("Histórico removido."));
  }

  async function saveTrackAction(formData: FormData) {
    "use server";
    const { supabase, profile, user } = await requireStaff();

    const id = String(formData.get("track_id") || "").trim();
    const studentId = String(formData.get("track_student_id") || "").trim();
    const trackName = cleanNullable(formData.get("track_name"));

    if (!studentId) redirect("/students/historicos?error=" + encodeMsg("Selecione um estudante para salvar a trilha."));
    if (!trackName) redirect("/students/historicos?error=" + encodeMsg("Informe o nome da trilha técnica ou profissional."));

    const payload = {
      school_id: profile.school_id,
      student_id: studentId,
      enrollment_id: cleanNullable(formData.get("track_enrollment_id")),
      track_name: trackName,
      partner_name: cleanNullable(formData.get("partner_name")),
      qualification_type: cleanUpperNullable(formData.get("qualification_type")),
      total_hours: normalizeInteger(formData.get("total_hours"), 0, 4000),
      completed_hours: normalizeInteger(formData.get("completed_hours"), 0, 4000) ?? 0,
      certification_status: cleanUpperNullable(formData.get("certification_status")) ?? "EM_ANDAMENTO",
      certification_title: cleanNullable(formData.get("certification_title")),
      notes: cleanNullable(formData.get("track_notes")),
      started_at: cleanNullable(formData.get("started_at")),
      concluded_at: cleanNullable(formData.get("concluded_at")),
      created_by: user.id,
    };

    const query = id
      ? supabase.from("student_professional_tracks").update(payload).eq("id", id).eq("school_id", profile.school_id)
      : supabase.from("student_professional_tracks").insert(payload);

    const { error } = await query;
    if (error) redirect("/students/historicos?error=" + encodeMsg(error.message));

    revalidatePath("/students/historicos");
    revalidatePath("/director/relatorios-nem");
    redirect("/students/historicos?msg=" + encodeMsg(id ? "Trilha atualizada." : "Trilha registrada."));
  }

  async function deleteTrackAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();
    const id = String(formData.get("track_id") || "").trim();
    if (!id) redirect("/students/historicos?error=" + encodeMsg("Trilha inválida."));

    const { error } = await supabase.from("student_professional_tracks").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/students/historicos?error=" + encodeMsg(error.message));

    revalidatePath("/students/historicos");
    revalidatePath("/director/relatorios-nem");
    redirect("/students/historicos?msg=" + encodeMsg("Trilha removida."));
  }

  return (
    <Shell
      title="Histórico e trilhas"
      subtitle="Consolide o percurso anual do estudante, some horas de FGB/itinerário/técnico e registre trilhas profissionais sem deixar a secretaria refém do caos artesanal."
    >
      <div className="grid gap-4">
        <Flash message={error || msg || combinedError} variant={error || combinedError ? "error" : msg ? "success" : "info"} />

        <div className="grid gap-3 md:grid-cols-5">
          {[
            { label: "Históricos lançados", value: historiesCount, helper: "Registros anuais disponíveis." },
            { label: "Aprovados/concluídos", value: concludedCount, helper: "Percursos já fechados." },
            { label: "Sem histórico", value: withoutHistoryCount, helper: "Estudantes que ainda pedem consolidação." },
            { label: "Trilhas ativas", value: technicalTracksCount, helper: "Registros técnicos em andamento." },
            { label: "Certificações", value: certifiedCount, helper: "Trilhas já certificadas." },
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
              <div className="text-lg font-semibold">Fechamento escolar do Novo Ensino Médio</div>
              <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Esta etapa amarra o que foi ofertado, frequentado e avaliado. Sem ela, o sistema sabe muito sobre a rotina e pouco sobre o resultado final.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/students/acompanhamento" className="btn btn-secondary">
                Abrir acompanhamento
              </Link>
              <Link href="/director/relatorios-nem" className="btn btn-secondary">
                Relatórios NEM
              </Link>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-th">Estudante</th>
                  <th className="table-th">Turma atual</th>
                  <th className="table-th">Histórico anual</th>
                  <th className="table-th">Trilha técnica/profissional</th>
                  <th className="table-th">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const latestHistory = row.latestHistory;
                  const latestTrack = row.latestTrack;
                  const latestEnrollment = latestHistory?.enrollment_id ? enrollmentMap.get(latestHistory.enrollment_id) ?? row.activeEnrollment : row.activeEnrollment;
                  const completion = computeCompletionPercent(latestTrack?.completed_hours, latestTrack?.total_hours);
                  return (
                    <tr key={row.student.id} className="table-row align-top">
                      <td className="table-td">
                        <div className="font-medium">{row.student.full_name ?? "Sem nome"}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Matrícula: {row.student.registration_number || "—"}</div>
                      </td>
                      <td className="table-td">
                        <div>{classLabel(row.classRow)}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {latestEnrollment?.school_year ? `Ano letivo ${latestEnrollment.school_year}` : "Sem matrícula ativa"}
                        </div>
                      </td>
                      <td className="table-td">
                        {latestHistory ? (
                          <div className="grid gap-2">
                            <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs font-semibold ${badgeToneForOutcome(latestHistory.outcome_status)}`}>
                              {optionLabel(HISTORY_OUTCOME_OPTIONS, latestHistory.outcome_status)}
                            </span>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {latestHistory.school_year ? `Ano ${latestHistory.school_year}` : "Ano não informado"}
                              {latestHistory.series_year ? ` • ${latestHistory.series_year}` : ""}
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-300">
                              FGB {latestHistory.fgb_hours_completed ?? 0}h • Itinerário {latestHistory.itinerary_hours_completed ?? 0}h • Técnico {latestHistory.technical_hours_completed ?? 0}h
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-300">
                              Frequência {formatPercent(latestHistory.attendance_rate)} • Média {formatPercent(latestHistory.assessment_average)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">Sem histórico lançado.</span>
                        )}
                      </td>
                      <td className="table-td">
                        {latestTrack ? (
                          <div className="grid gap-2">
                            <div className="font-medium">{latestTrack.track_name ?? "Trilha"}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {optionLabel(QUALIFICATION_TYPE_OPTIONS, latestTrack.qualification_type)} • {optionLabel(CERTIFICATION_STATUS_OPTIONS, latestTrack.certification_status)}
                            </div>
                            <div className="text-xs text-zinc-600 dark:text-zinc-300">
                              {latestTrack.completed_hours ?? 0}h de {latestTrack.total_hours ?? "—"}h
                              {completion != null ? ` • ${formatPercent(completion)}` : ""}
                            </div>
                            {latestTrack.partner_name ? (
                              <div className="text-xs text-zinc-600 dark:text-zinc-300">Parceiro: {latestTrack.partner_name}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-500 dark:text-zinc-400">Sem trilha registrada.</span>
                        )}
                      </td>
                      <td className="table-td">
                        <div className="flex flex-col gap-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Editar histórico</summary>
                            <form action={saveHistoryAction} className="mt-3 grid w-[380px] max-w-full gap-3">
                              <input type="hidden" name="history_id" value={latestHistory?.id ?? ""} />
                              <input type="hidden" name="student_id" value={row.student.id} />
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Matrícula vinculada</span>
                                <select name="enrollment_id" defaultValue={latestHistory?.enrollment_id ?? row.activeEnrollment?.id ?? ""} className="input">
                                  <option value="">Sem vínculo direto</option>
                                  {row.allEnrollments.map((enrollment) => (
                                    <option key={enrollment.id} value={enrollment.id}>
                                      {classLabel(classMap.get(enrollment.class_id))} • {enrollment.school_year ?? "Ano"}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Ano letivo</span>
                                  <input name="school_year" type="number" defaultValue={latestHistory?.school_year ?? row.activeEnrollment?.school_year ?? new Date().getFullYear()} className="input" />
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Série</span>
                                  <select name="series_year" defaultValue={latestHistory?.series_year ?? ""} className="input">
                                    <option value="">Selecione</option>
                                    <option value="1A">1ª série</option>
                                    <option value="2A">2ª série</option>
                                    <option value="3A">3ª série</option>
                                    <option value="4A">4ª série</option>
                                  </select>
                                </label>
                              </div>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Versão curricular</span>
                                <input name="curriculum_version" type="text" defaultValue={latestHistory?.curriculum_version ?? row.activeEnrollment?.curriculum_version ?? ""} className="input" />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Resultado</span>
                                <select name="outcome_status" defaultValue={latestHistory?.outcome_status ?? "EM_ANDAMENTO"} className="input">
                                  {HISTORY_OUTCOME_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Horas FGB</span>
                                  <input name="fgb_hours_completed" type="number" defaultValue={latestHistory?.fgb_hours_completed ?? 0} className="input" />
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Horas itinerário</span>
                                  <input name="itinerary_hours_completed" type="number" defaultValue={latestHistory?.itinerary_hours_completed ?? 0} className="input" />
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Horas técnicas</span>
                                  <input name="technical_hours_completed" type="number" defaultValue={latestHistory?.technical_hours_completed ?? 0} className="input" />
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Frequência (%)</span>
                                  <input name="attendance_rate" type="number" step="0.01" min="0" max="100" defaultValue={latestHistory?.attendance_rate ?? ""} className="input" />
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Média (%)</span>
                                  <input name="assessment_average" type="number" step="0.01" min="0" max="100" defaultValue={latestHistory?.assessment_average ?? ""} className="input" />
                                </label>
                              </div>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Observações finais</span>
                                <textarea name="final_notes" defaultValue={latestHistory?.final_notes ?? ""} rows={3} className="input min-h-[96px]" />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <button type="submit" className="btn btn-primary">Salvar histórico</button>
                              </div>
                            </form>
                            {latestHistory ? (
                              <form action={deleteHistoryAction} className="mt-2">
                                <input type="hidden" name="history_id" value={latestHistory.id} />
                                <ConfirmButton confirmText="Excluir este histórico anual?" type="submit" className="btn btn-danger">Excluir</ConfirmButton>
                              </form>
                            ) : null}
                          </details>

                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Editar trilha</summary>
                            <form action={saveTrackAction} className="mt-3 grid w-[380px] max-w-full gap-3">
                              <input type="hidden" name="track_id" value={latestTrack?.id ?? ""} />
                              <input type="hidden" name="track_student_id" value={row.student.id} />
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Matrícula vinculada</span>
                                <select name="track_enrollment_id" defaultValue={latestTrack?.enrollment_id ?? row.activeEnrollment?.id ?? ""} className="input">
                                  <option value="">Sem vínculo direto</option>
                                  {row.allEnrollments.map((enrollment) => (
                                    <option key={enrollment.id} value={enrollment.id}>
                                      {classLabel(classMap.get(enrollment.class_id))} • {enrollment.school_year ?? "Ano"}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Nome da trilha</span>
                                <input name="track_name" type="text" defaultValue={latestTrack?.track_name ?? ""} className="input" />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Parceiro / executora</span>
                                <input name="partner_name" type="text" defaultValue={latestTrack?.partner_name ?? ""} className="input" />
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Tipo</span>
                                  <select name="qualification_type" defaultValue={latestTrack?.qualification_type ?? ""} className="input">
                                    <option value="">Selecione</option>
                                    {QUALIFICATION_TYPE_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Status</span>
                                  <select name="certification_status" defaultValue={latestTrack?.certification_status ?? "EM_ANDAMENTO"} className="input">
                                    {CERTIFICATION_STATUS_OPTIONS.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Carga total (h)</span>
                                  <input name="total_hours" type="number" defaultValue={latestTrack?.total_hours ?? ""} className="input" />
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Horas cumpridas</span>
                                  <input name="completed_hours" type="number" defaultValue={latestTrack?.completed_hours ?? 0} className="input" />
                                </label>
                              </div>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Título da certificação</span>
                                <input name="certification_title" type="text" defaultValue={latestTrack?.certification_title ?? ""} className="input" />
                              </label>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Início</span>
                                  <input name="started_at" type="date" defaultValue={latestTrack?.started_at ?? ""} className="input" />
                                </label>
                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold">Conclusão</span>
                                  <input name="concluded_at" type="date" defaultValue={latestTrack?.concluded_at ?? ""} className="input" />
                                </label>
                              </div>
                              <label className="grid gap-1">
                                <span className="text-xs font-semibold">Observações</span>
                                <textarea name="track_notes" defaultValue={latestTrack?.notes ?? ""} rows={3} className="input min-h-[96px]" />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <button type="submit" className="btn btn-primary">Salvar trilha</button>
                              </div>
                            </form>
                            {latestTrack ? (
                              <form action={deleteTrackAction} className="mt-2">
                                <input type="hidden" name="track_id" value={latestTrack.id} />
                                <ConfirmButton confirmText="Excluir esta trilha técnica/profissional?" type="submit" className="btn btn-danger">Excluir</ConfirmButton>
                              </form>
                            ) : null}
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr className="table-row">
                    <td colSpan={5} className="table-td text-zinc-500 dark:text-zinc-400">Nenhum estudante cadastrado.</td>
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
