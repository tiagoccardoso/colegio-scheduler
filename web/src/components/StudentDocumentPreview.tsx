import {
  documentIssueTypeLabel,
  formatDatePtBr,
  formatLongDatePtBr,
  parseJsonObject,
  type DocumentSettingsRow,
} from "@/lib/novo-ensino-medio-documents";
import {
  CERTIFICATION_STATUS_OPTIONS,
  HISTORY_OUTCOME_OPTIONS,
  OFFER_MODEL_OPTIONS,
  QUALIFICATION_TYPE_OPTIONS,
  optionLabel,
} from "@/lib/novo-ensino-medio-students";

type IssueRow = {
  id: string;
  issue_type: string | null;
  issue_number: string | null;
  issued_at: string | null;
  requested_by: string | null;
  notes: string | null;
  signatory_snapshot: unknown;
  document_payload: unknown;
  created_at?: string | null;
};

type SignatorySnapshot = {
  principal_name?: string | null;
  principal_role_label?: string | null;
  secretary_name?: string | null;
  secretary_role_label?: string | null;
};

type Payload = {
  student_name?: string | null;
  social_name?: string | null;
  registration_number?: string | null;
  school_year?: number | null;
  class_name?: string | null;
  shift?: string | null;
  series_year?: string | null;
  curriculum_version?: string | null;
  offer_model?: string | null;
  entry_cohort?: number | null;
  itinerary_axis?: string | null;
  itinerary_name?: string | null;
  elective_name?: string | null;
  project_of_life_notes?: string | null;
  attendance_rate?: number | null;
  assessment_average?: number | null;
  outcome_status?: string | null;
  fgb_hours_completed?: number | null;
  itinerary_hours_completed?: number | null;
  technical_hours_completed?: number | null;
  final_notes?: string | null;
  track_name?: string | null;
  partner_name?: string | null;
  qualification_type?: string | null;
  certification_status?: string | null;
  certification_title?: string | null;
  completed_hours?: number | null;
  total_hours?: number | null;
  progress_percent?: number | null;
};

function seriesLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toUpperCase();
  if (!key) return "Ensino Médio";
  if (key === "1A") return "1ª série do Ensino Médio";
  if (key === "2A") return "2ª série do Ensino Médio";
  if (key === "3A") return "3ª série do Ensino Médio";
  if (key === "4A") return "4ª série do Ensino Médio";
  return `${key} do Ensino Médio`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Number(value).toFixed(1)}%`;
}

function institutionLabel(schoolName: string, settings: Partial<DocumentSettingsRow> | null | undefined) {
  const override = String(settings?.institution_name_override ?? "").trim();
  return override || schoolName || "Instituição de Ensino";
}

function cityState(settings: Partial<DocumentSettingsRow> | null | undefined) {
  const city = String(settings?.city ?? "").trim();
  const state = String(settings?.state_code ?? "").trim().toUpperCase();
  if (city && state) return `${city}/${state}`;
  return city || state || "";
}

function renderBody(issueType: string | null | undefined, payload: Payload) {
  const fullName = payload.social_name?.trim() || payload.student_name?.trim() || "o(a) estudante";
  const registration = payload.registration_number ? `matrícula ${payload.registration_number}` : "matrícula não informada";
  const classInfo = [payload.class_name, payload.shift].filter(Boolean).join(" • ");
  const schoolYear = payload.school_year ? String(payload.school_year) : "ano letivo vigente";
  const series = seriesLabel(payload.series_year);
  const itinerary = payload.itinerary_name || payload.itinerary_axis || "itinerário ainda não definido";
  const offerModel = optionLabel(OFFER_MODEL_OPTIONS, payload.offer_model, "modelo de oferta em implantação");
  const outcome = optionLabel(HISTORY_OUTCOME_OPTIONS, payload.outcome_status, "em andamento");
  const qualType = optionLabel(QUALIFICATION_TYPE_OPTIONS, payload.qualification_type, "trilha profissional");
  const certStatus = optionLabel(CERTIFICATION_STATUS_OPTIONS, payload.certification_status, "em andamento");

  switch (String(issueType ?? "").trim().toUpperCase()) {
    case "DECLARACAO_MATRICULA":
      return (
        <>
          <p>
            Declaramos, para os devidos fins, que <strong>{fullName}</strong>, {registration}, encontra-se regularmente
            matriculado(a) na <strong>{series}</strong>, no ano letivo de <strong>{schoolYear}</strong>,
            {classInfo ? <> na turma <strong>{classInfo}</strong>,</> : null} em oferta <strong>{offerModel}</strong>.
          </p>
          <p className="mt-3">
            No âmbito do Novo Ensino Médio, o estudante está vinculado ao percurso <strong>{itinerary}</strong>
            {payload.curriculum_version ? <> e à versão curricular <strong>{payload.curriculum_version}</strong></> : null}.
          </p>
        </>
      );
    case "DECLARACAO_FREQUENCIA":
      return (
        <>
          <p>
            Declaramos que <strong>{fullName}</strong>, {registration}, estudante da <strong>{series}</strong> no ano de
            <strong> {schoolYear}</strong>, apresentou frequência consolidada de <strong>{formatPercent(payload.attendance_rate)}</strong>
            {classInfo ? <> na turma <strong>{classInfo}</strong></> : null}.
          </p>
          <p className="mt-3">
            O acompanhamento foi realizado considerando componentes da Formação Geral Básica, do itinerário
            formativo e demais registros da vida escolar disponíveis até a presente data.
          </p>
        </>
      );
    case "BOLETIM_SINTETICO":
      return (
        <>
          <p>
            Síntese do desempenho de <strong>{fullName}</strong>, {registration}, referente ao ano letivo de <strong>{schoolYear}</strong>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Frequência</div>
              <div className="mt-1 text-lg font-semibold">{formatPercent(payload.attendance_rate)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Média global</div>
              <div className="mt-1 text-lg font-semibold">{formatPercent(payload.assessment_average)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Situação</div>
              <div className="mt-1 text-lg font-semibold">{outcome}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Itinerário</div>
              <div className="mt-1 text-lg font-semibold">{itinerary}</div>
            </div>
          </div>
        </>
      );
    case "HISTORICO_ESCOLAR_NEM":
      return (
        <>
          <p>
            Certificamos que <strong>{fullName}</strong>, {registration}, cursou a <strong>{series}</strong> no ano de
            <strong> {schoolYear}</strong>, sob oferta <strong>{offerModel}</strong>, com situação final <strong>{outcome}</strong>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">FGB cumprida</div>
              <div className="mt-1 text-lg font-semibold">{payload.fgb_hours_completed ?? 0} h</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Itinerário cumprido</div>
              <div className="mt-1 text-lg font-semibold">{payload.itinerary_hours_completed ?? 0} h</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Carga técnica</div>
              <div className="mt-1 text-lg font-semibold">{payload.technical_hours_completed ?? 0} h</div>
            </div>
          </div>
          <p className="mt-3">
            Itinerário: <strong>{itinerary}</strong>
            {payload.curriculum_version ? <> • versão curricular <strong>{payload.curriculum_version}</strong></> : null}
            {payload.entry_cohort ? <> • coorte de ingresso <strong>{payload.entry_cohort}</strong></> : null}.
          </p>
          {payload.final_notes ? <p className="mt-3 whitespace-pre-line">Observações: {payload.final_notes}</p> : null}
        </>
      );
    case "CERTIFICADO_TRILHA_TECNICA":
      return (
        <>
          <p>
            Certificamos que <strong>{fullName}</strong>, {registration}, participou da trilha de <strong>{qualType}</strong>
            denominada <strong>{payload.track_name || "trilha não informada"}</strong>.
          </p>
          <p className="mt-3">
            Parceiro executor: <strong>{payload.partner_name || "não informado"}</strong>. Situação da certificação:
            <strong> {certStatus}</strong>.
            {payload.certification_title ? <> Título registrado: <strong>{payload.certification_title}</strong>.</> : null}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Horas concluídas</div>
              <div className="mt-1 text-lg font-semibold">{payload.completed_hours ?? 0} h</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Horas totais</div>
              <div className="mt-1 text-lg font-semibold">{payload.total_hours ?? 0} h</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Progresso</div>
              <div className="mt-1 text-lg font-semibold">{formatPercent(payload.progress_percent)}</div>
            </div>
          </div>
        </>
      );
    case "DECLARACAO_PROJETO_VIDA":
      return (
        <>
          <p>
            Declaramos que <strong>{fullName}</strong>, {registration}, participa do acompanhamento de Projeto de Vida no âmbito do
            Novo Ensino Médio, articulando escolhas de itinerário, metas formativas e transição para estudos e trabalho.
          </p>
          <p className="mt-3">
            Registro pedagógico consolidado: <strong>{payload.project_of_life_notes || "em acompanhamento pela equipe escolar"}</strong>.
          </p>
        </>
      );
    default:
      return (
        <p>
          Documento emitido para <strong>{fullName}</strong>, {registration}, referente ao ano letivo de <strong>{schoolYear}</strong>.
        </p>
      );
  }
}

export function StudentDocumentPreview({
  schoolName,
  settings,
  issue,
  hideMeta = false,
}: {
  schoolName: string;
  settings?: Partial<DocumentSettingsRow> | null;
  issue: IssueRow;
  hideMeta?: boolean;
}) {
  const payload = parseJsonObject<Payload>(issue.document_payload, {});
  const signatories = parseJsonObject<SignatorySnapshot>(issue.signatory_snapshot, {});
  const place = cityState(settings);
  const headerText = String(settings?.header_text ?? "").trim();
  const footerText = String(settings?.footer_text ?? "").trim();
  const ordinance = String(settings?.ordinance_reference ?? "").trim();
  const institution = institutionLabel(schoolName, settings);
  const network = String(settings?.network_name ?? "").trim();

  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="border-b border-zinc-200 pb-4 text-center dark:border-zinc-800">
        <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">Documento escolar</div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{institution}</h1>
        {network ? <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{network}</div> : null}
        {headerText ? <div className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{headerText}</div> : null}
      </header>

      {!hideMeta ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          <div>
            <strong>{documentIssueTypeLabel(issue.issue_type)}</strong>
            {issue.issue_number ? <> • nº {issue.issue_number}</> : null}
          </div>
          <div>
            Emitido em {formatDatePtBr(issue.issued_at)}
            {issue.requested_by ? <> • solicitado por {issue.requested_by}</> : null}
          </div>
        </div>
      ) : null}

      <section className="mt-6 text-[15px] leading-7 text-zinc-900 dark:text-zinc-100">
        <h2 className="text-center text-lg font-semibold uppercase tracking-[0.18em]">
          {documentIssueTypeLabel(issue.issue_type)}
        </h2>
        <div className="mt-5">{renderBody(issue.issue_type, payload)}</div>
      </section>

      <section className="mt-6 text-sm text-zinc-700 dark:text-zinc-300">
        {issue.notes ? <p className="whitespace-pre-line">Observações do documento: {issue.notes}</p> : null}
        {footerText ? <p className="mt-3 whitespace-pre-line">{footerText}</p> : null}
        {ordinance ? <p className="mt-3">Base de emissão interna: {ordinance}.</p> : null}
      </section>

      <footer className="mt-10 grid gap-8 sm:grid-cols-2">
        <div className="text-center">
          <div className="border-t border-zinc-300 pt-3 text-sm dark:border-zinc-700">{signatories.principal_name || settings?.principal_name || "Direção"}</div>
          <div className="text-xs text-zinc-500">{signatories.principal_role_label || settings?.principal_role_label || "Direção"}</div>
        </div>
        <div className="text-center">
          <div className="border-t border-zinc-300 pt-3 text-sm dark:border-zinc-700">{signatories.secretary_name || settings?.secretary_name || "Secretaria Escolar"}</div>
          <div className="text-xs text-zinc-500">{signatories.secretary_role_label || settings?.secretary_role_label || "Secretaria Escolar"}</div>
        </div>
      </footer>

      <div className="mt-8 text-center text-xs text-zinc-500">
        {place ? `${place}, ` : ""}{formatLongDatePtBr(issue.issued_at)}
      </div>
    </article>
  );
}
