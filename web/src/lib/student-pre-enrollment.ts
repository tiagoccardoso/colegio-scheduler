import { extractPdfTextFromUrl } from "@/lib/pdf-text";
import { openaiChatJsonSchema, OpenAIError } from "@/lib/openai-chat";

export const PRE_ENROLLMENT_BUCKET = "student-documents";

export type PreEnrollmentStatus =
  | "RASCUNHO"
  | "DOCUMENTOS_ENVIADOS"
  | "ANALISANDO"
  | "ANALISADO"
  | "REVISADO"
  | "CONVERTIDO"
  | "ERRO";

export type PreEnrollmentFileStatus = "PENDENTE" | "ANALISADO" | "IGNORADO" | "ERRO";

export type ExtractedGuardian = {
  full_name?: string | null;
  relationship?: string | null;
  cpf?: string | null;
  rg?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  email?: string | null;
  profession?: string | null;
  is_legal_guardian?: boolean | null;
  is_financial_guardian?: boolean | null;
  lives_with_student?: boolean | null;
};

export type ExtractedStudent = {
  registration_number?: string | null;
  full_name?: string | null;
  social_name?: string | null;
  birth_date?: string | null;
  cpf?: string | null;
  rg?: string | null;
  rg_issuer?: string | null;
  rg_state?: string | null;
  birth_certificate_number?: string | null;
  nationality?: string | null;
  naturalness_city?: string | null;
  naturalness_state?: string | null;
  sex?: string | null;
  gender_identity?: string | null;
  race_color?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  zip_code?: string | null;
  street?: string | null;
  street_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state_code?: string | null;
  mother_name?: string | null;
  father_name?: string | null;
  nis_number?: string | null;
  sus_card_number?: string | null;
  blood_type?: string | null;
  school_origin_name?: string | null;
  school_origin_network?: string | null;
  school_origin_city?: string | null;
  school_origin_state?: string | null;
  previous_school_year?: number | null;
  previous_grade?: string | null;
  transfer_type?: string | null;
};

export type ExtractedEnrollment = {
  school_year?: number | null;
  entry_cohort?: number | null;
  curriculum_version?: string | null;
  offer_model?: string | null;
  itinerary_axis?: string | null;
  itinerary_name?: string | null;
  project_of_life_notes?: string | null;
};

export type ExtractedDocument = {
  document_type: string | null;
  summary: string | null;
  warnings: string[];
  confidence: number | null;
  student: ExtractedStudent;
  guardians: ExtractedGuardian[];
  enrollment: ExtractedEnrollment;
};


export type ExistingStudentCandidate = {
  id: string;
  full_name?: string | null;
  registration_number?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  rg?: string | null;
  birth_certificate_number?: string | null;
};

export type StrongDuplicateCandidate = {
  id: string;
  full_name: string | null;
  registration_number: string | null;
  cpf: string | null;
  birth_date: string | null;
  rg: string | null;
  birth_certificate_number: string | null;
  reason: "CPF_EXATO" | "NOME_E_DATA_EXATOS" | "RG_EXATO" | "CERTIDAO_EXATA";
};

export type PreEnrollmentProposal = {
  student: ExtractedStudent;
  guardians: ExtractedGuardian[];
  enrollment: ExtractedEnrollment & { class_id?: string | null; enrollment_status?: string | null; risk_level?: string | null; enrollment_date?: string | null };
  warnings: string[];
  summary: string;
  detected_documents: Array<{ name: string; document_type: string | null; confidence: number | null; summary: string | null }>;
};

export type ProposalFieldConfidence = Record<string, { level: "ALTA" | "MEDIA" | "BAIXA"; score: number; sources: string[] }>;


const DOC_PRIORITY: Record<string, number> = {
  CERTIDAO_NASCIMENTO: 100,
  RG: 95,
  CIN: 95,
  CPF: 90,
  CARTAO_SUS: 85,
  NIS: 84,
  COMPROVANTE_RESIDENCIA: 80,
  HISTORICO_ESCOLAR: 88,
  DECLARACAO_TRANSFERENCIA: 87,
  FICHA_MATRICULA: 86,
  DOCUMENTO_RESPONSAVEL: 83,
  OUTRO: 10,
};

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["document_type", "summary", "warnings", "confidence", "student", "guardians", "enrollment"],
  properties: {
    document_type: { type: ["string", "null"] },
    summary: { type: ["string", "null"] },
    warnings: { type: "array", items: { type: "string" } },
    confidence: { type: ["number", "null"] },
    student: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        [
          "registration_number","full_name","social_name","birth_date","cpf","rg","rg_issuer","rg_state","birth_certificate_number","nationality","naturalness_city","naturalness_state","sex","gender_identity","race_color","email","phone","mobile_phone","zip_code","street","street_number","address_complement","neighborhood","city","state_code","mother_name","father_name","nis_number","sus_card_number","blood_type","school_origin_name","school_origin_network","school_origin_city","school_origin_state","previous_school_year","previous_grade","transfer_type"
        ].map((k) => [k, { type: ["string", "null"] }]),
      ),
    },
    guardians: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          full_name: { type: ["string", "null"] },
          relationship: { type: ["string", "null"] },
          cpf: { type: ["string", "null"] },
          rg: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          mobile_phone: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          profession: { type: ["string", "null"] },
          is_legal_guardian: { type: ["boolean", "null"] },
          is_financial_guardian: { type: ["boolean", "null"] },
          lives_with_student: { type: ["boolean", "null"] },
        },
      },
    },
    enrollment: {
      type: "object",
      additionalProperties: false,
      properties: {
        school_year: { type: ["number", "null"] },
        entry_cohort: { type: ["number", "null"] },
        curriculum_version: { type: ["string", "null"] },
        offer_model: { type: ["string", "null"] },
        itinerary_axis: { type: ["string", "null"] },
        itinerary_name: { type: ["string", "null"] },
        project_of_life_notes: { type: ["string", "null"] },
      },
    },
  },
} as const;

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanDigits(value: unknown) {
  const digits = String(value ?? "").replace(/\D+/g, "").trim();
  return digits || null;
}

function cleanDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function cleanUf(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(text) ? text : null;
}

function cleanMaybeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function normalizeDocType(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return null;
  const map: Record<string, string> = {
    CERTIDÃO: "CERTIDAO_NASCIMENTO",
    CERTIDAO: "CERTIDAO_NASCIMENTO",
    CERTIDAO_DE_NASCIMENTO: "CERTIDAO_NASCIMENTO",
    CIN: "CIN",
    IDENTIDADE: "RG",
    COMPROVANTE_DE_RESIDENCIA: "COMPROVANTE_RESIDENCIA",
    RESIDENCIA: "COMPROVANTE_RESIDENCIA",
    HISTORICO: "HISTORICO_ESCOLAR",
    HISTORICO_ESCOLAR_PDF: "HISTORICO_ESCOLAR",
    DECLARACAO: "DECLARACAO_TRANSFERENCIA",
  };
  return map[text] ?? text;
}

function normalizeStudent(student: ExtractedStudent): ExtractedStudent {
  return {
    registration_number: cleanText(student.registration_number),
    full_name: cleanText(student.full_name),
    social_name: cleanText(student.social_name),
    birth_date: cleanDate(student.birth_date),
    cpf: cleanDigits(student.cpf),
    rg: cleanText(student.rg),
    rg_issuer: cleanText(student.rg_issuer),
    rg_state: cleanUf(student.rg_state),
    birth_certificate_number: cleanText(student.birth_certificate_number),
    nationality: cleanText(student.nationality),
    naturalness_city: cleanText(student.naturalness_city),
    naturalness_state: cleanUf(student.naturalness_state),
    sex: cleanText(student.sex)?.toUpperCase() ?? null,
    gender_identity: cleanText(student.gender_identity)?.toUpperCase() ?? null,
    race_color: cleanText(student.race_color)?.toUpperCase() ?? null,
    email: cleanText(student.email),
    phone: cleanText(student.phone),
    mobile_phone: cleanText(student.mobile_phone),
    zip_code: cleanDigits(student.zip_code),
    street: cleanText(student.street),
    street_number: cleanText(student.street_number),
    address_complement: cleanText(student.address_complement),
    neighborhood: cleanText(student.neighborhood),
    city: cleanText(student.city),
    state_code: cleanUf(student.state_code),
    mother_name: cleanText(student.mother_name),
    father_name: cleanText(student.father_name),
    nis_number: cleanDigits(student.nis_number),
    sus_card_number: cleanDigits(student.sus_card_number),
    blood_type: cleanText(student.blood_type),
    school_origin_name: cleanText(student.school_origin_name),
    school_origin_network: cleanText(student.school_origin_network)?.toUpperCase() ?? null,
    school_origin_city: cleanText(student.school_origin_city),
    school_origin_state: cleanUf(student.school_origin_state),
    previous_school_year: cleanMaybeNumber(student.previous_school_year),
    previous_grade: cleanText(student.previous_grade),
    transfer_type: cleanText(student.transfer_type)?.toUpperCase() ?? null,
  };
}

function normalizeGuardian(guardian: ExtractedGuardian): ExtractedGuardian {
  return {
    full_name: cleanText(guardian.full_name),
    relationship: cleanText(guardian.relationship),
    cpf: cleanDigits(guardian.cpf),
    rg: cleanText(guardian.rg),
    phone: cleanText(guardian.phone),
    mobile_phone: cleanText(guardian.mobile_phone),
    email: cleanText(guardian.email),
    profession: cleanText(guardian.profession),
    is_legal_guardian: guardian.is_legal_guardian ?? null,
    is_financial_guardian: guardian.is_financial_guardian ?? null,
    lives_with_student: guardian.lives_with_student ?? null,
  };
}

function normalizeEnrollment(enrollment: ExtractedEnrollment): ExtractedEnrollment {
  return {
    school_year: cleanMaybeNumber(enrollment.school_year),
    entry_cohort: cleanMaybeNumber(enrollment.entry_cohort),
    curriculum_version: cleanText(enrollment.curriculum_version),
    offer_model: cleanText(enrollment.offer_model)?.toUpperCase() ?? null,
    itinerary_axis: cleanText(enrollment.itinerary_axis)?.toUpperCase() ?? null,
    itinerary_name: cleanText(enrollment.itinerary_name),
    project_of_life_notes: cleanText(enrollment.project_of_life_notes),
  };
}

function priorityFor(docType: string | null | undefined) {
  return DOC_PRIORITY[String(docType ?? "").trim().toUpperCase()] ?? 0;
}

function scoreValue(value: unknown) {
  return value == null || value === "" ? -1 : 1;
}

function pickBestValue<T>(current: T | null | undefined, next: T | null | undefined, currentPriority: number, nextPriority: number) {
  if (scoreValue(next) < 0) return { value: current ?? null, priority: currentPriority };
  if (scoreValue(current) < 0 || nextPriority >= currentPriority) return { value: next ?? null, priority: nextPriority };
  return { value: current ?? null, priority: currentPriority };
}

function confidenceLevelFromScore(score: number): "ALTA" | "MEDIA" | "BAIXA" {
  if (score >= 0.85) return "ALTA";
  if (score >= 0.55) return "MEDIA";
  return "BAIXA";
}

export function buildFieldConfidenceFromExtractions(files: Array<{ name: string; extracted: ExtractedDocument }>): ProposalFieldConfidence {
  const fieldConfidence: ProposalFieldConfidence = {};
  const pushField = (field: string, value: unknown, score: number, source: string) => {
    if (value == null || value === "") return;
    const existing = fieldConfidence[field];
    if (!existing || score > existing.score) {
      fieldConfidence[field] = { level: confidenceLevelFromScore(score), score, sources: [source] };
      return;
    }
    if (!existing.sources.includes(source)) existing.sources.push(source);
  };

  for (const file of files) {
    const docType = normalizeDocType(file.extracted.document_type) ?? "OUTRO";
    const baseConfidence = Math.max(0, Math.min(1, Number(file.extracted.confidence ?? 0.4) || 0.4));
    const normalizedStudent = normalizeStudent(file.extracted.student ?? {});
    const normalizedEnrollment = normalizeEnrollment(file.extracted.enrollment ?? {});
    for (const [key, value] of Object.entries(normalizedStudent)) pushField(`student.${key}`, value, baseConfidence, docType);
    for (const [key, value] of Object.entries(normalizedEnrollment)) pushField(`enrollment.${key}`, value, baseConfidence, docType);
    for (const [guardianIndex, guardian] of (file.extracted.guardians ?? []).map(normalizeGuardian).entries()) {
      for (const [key, value] of Object.entries(guardian)) pushField(`guardians.${guardianIndex}.${key}`, value, baseConfidence, docType);
    }
  }

  return fieldConfidence;
}

function summarize(documents: ExtractedDocument[]) {
  const names = documents.map((doc) => doc.document_type || "OUTRO");
  const warnings = Array.from(new Set(documents.flatMap((doc) => doc.warnings || []))).filter(Boolean);
  const summary = documents
    .map((doc) => doc.summary)
    .filter((item): item is string => !!item)
    .slice(0, 3)
    .join(" • ");
  return { names, warnings, summary };
}

export function buildProposalFromExtractions(files: Array<{ name: string; extracted: ExtractedDocument }>): PreEnrollmentProposal {
  const student: ExtractedStudent = {};
  const enrollment: PreEnrollmentProposal["enrollment"] = {
    class_id: null,
    enrollment_status: "ATIVA",
    risk_level: "BAIXO",
    enrollment_date: new Date().toISOString().slice(0, 10),
  };
  const guardians: ExtractedGuardian[] = [];
  const fieldPriority = new Map<string, number>();

  const setStudent = (key: keyof ExtractedStudent, value: ExtractedStudent[keyof ExtractedStudent], priority: number) => {
    const currentPriority = fieldPriority.get(`student.${String(key)}`) ?? -1;
    const studentRecord = student as Partial<Record<keyof ExtractedStudent, ExtractedStudent[keyof ExtractedStudent]>>;
    const currentValue = studentRecord[key] ?? null;
    const pick = pickBestValue(currentValue, value, currentPriority, priority);
    studentRecord[key] = pick.value;
    fieldPriority.set(`student.${String(key)}`, pick.priority);
  };

  const setEnrollment = (key: keyof ExtractedEnrollment, value: ExtractedEnrollment[keyof ExtractedEnrollment], priority: number) => {
    const currentPriority = fieldPriority.get(`enrollment.${String(key)}`) ?? -1;
    const enrollmentRecord = enrollment as Partial<Record<keyof ExtractedEnrollment, ExtractedEnrollment[keyof ExtractedEnrollment] | string | null>>;
    const currentValue = (enrollmentRecord[key] as ExtractedEnrollment[keyof ExtractedEnrollment] | null | undefined) ?? null;
    const pick = pickBestValue(currentValue, value, currentPriority, priority);
    enrollmentRecord[key] = pick.value as ExtractedEnrollment[keyof ExtractedEnrollment] | null;
    fieldPriority.set(`enrollment.${String(key)}`, pick.priority);
  };

  for (const file of files) {
    const extracted = file.extracted;
    const docType = normalizeDocType(extracted.document_type);
    const priority = priorityFor(docType);
    const normalizedStudent = normalizeStudent(extracted.student ?? {});
    const normalizedEnrollment = normalizeEnrollment(extracted.enrollment ?? {});

    for (const [key, value] of Object.entries(normalizedStudent) as Array<[keyof ExtractedStudent, ExtractedStudent[keyof ExtractedStudent]]>) {
      setStudent(key, value, priority);
    }
    for (const [key, value] of Object.entries(normalizedEnrollment) as Array<[keyof ExtractedEnrollment, ExtractedEnrollment[keyof ExtractedEnrollment]]>) {
      setEnrollment(key, value, priority);
    }

    for (const guardian of (extracted.guardians ?? []).map(normalizeGuardian)) {
      if (!guardian.full_name && !guardian.cpf) continue;
      const existing = guardians.find(
        (item) => (guardian.cpf && item.cpf && guardian.cpf === item.cpf) || (guardian.full_name && item.full_name && guardian.full_name === item.full_name),
      );
      if (!existing) guardians.push(guardian);
    }
  }

  const meta = summarize(files.map((item) => item.extracted));
  return {
    student,
    guardians,
    enrollment,
    warnings: meta.warnings,
    summary: meta.summary || `Foram analisados ${files.length} documento(s): ${meta.names.join(", ")}.`,
    detected_documents: files.map((item) => ({
      name: item.name,
      document_type: normalizeDocType(item.extracted.document_type),
      confidence: item.extracted.confidence ?? null,
      summary: item.extracted.summary ?? null,
    })),
  };
}

export async function extractFromTextDocument(args: { text: string; userId: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIError("OPENAI_API_KEY não configurada.", 400);
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const text = String(args.text || "").trim();
  if (!text) {
    return {
      document_type: null,
      summary: "Documento sem texto legível para análise.",
      warnings: ["Não foi possível extrair texto útil do documento."],
      confidence: 0.1,
      student: {},
      guardians: [],
      enrollment: {},
    } satisfies ExtractedDocument;
  }

  return openaiChatJsonSchema<ExtractedDocument>({
    apiKey,
    model,
    schemaName: "student_pre_enrollment_extract",
    schema: extractionSchema,
    temperature: 0.1,
    userIdForSafetyIdentifier: args.userId,
    maxCompletionTokens: 2200,
    messages: [
      {
        role: "system",
        content:
          "Você extrai dados de matrícula escolar a partir de documentos brasileiros. Extraia apenas o que estiver explicitamente presente. Não invente dados. Prefira null quando houver dúvida. Use document_type entre RG, CIN, CPF, CERTIDAO_NASCIMENTO, COMPROVANTE_RESIDENCIA, HISTORICO_ESCOLAR, DECLARACAO_TRANSFERENCIA, DOCUMENTO_RESPONSAVEL, CARTAO_SUS, NIS, FICHA_MATRICULA, OUTRO.",
      },
      {
        role: "user",
        content: `Analise o texto abaixo e devolva apenas o JSON conforme o schema.\n\nTEXTO DO DOCUMENTO:\n${text}`,
      },
    ],
  });
}

function tryParseJsonLoose<T>(raw: string): T {
  const s0 = String(raw ?? "").trim();
  try {
    return JSON.parse(s0) as T;
  } catch {
    let s = s0.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    s = s.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(s) as T;
  }
}

export async function extractFromImageDocument(args: { signedUrl: string; userId: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIError("OPENAI_API_KEY não configurada.", 400);
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      store: false,
      max_completion_tokens: 2200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "student_pre_enrollment_extract_image",
          schema: extractionSchema,
          strict: true,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Você extrai dados de matrícula escolar a partir de documentos brasileiros fotografados ou digitalizados. Extraia apenas o que estiver explícito e use null quando houver dúvida. Use document_type entre RG, CIN, CPF, CERTIDAO_NASCIMENTO, COMPROVANTE_RESIDENCIA, HISTORICO_ESCOLAR, DECLARACAO_TRANSFERENCIA, DOCUMENTO_RESPONSAVEL, CARTAO_SUS, NIS, FICHA_MATRICULA, OUTRO.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analise a imagem do documento e devolva apenas o JSON conforme o schema.",
            },
            {
              type: "image_url",
              image_url: { url: args.signedUrl, detail: "high" },
            },
          ],
        },
      ],
    }),
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = json?.error?.message || `Falha ao chamar OpenAI (HTTP ${res.status}).`;
    throw new OpenAIError(msg, res.status);
  }
  const contentAny = json?.choices?.[0]?.message?.content;
  const content =
    typeof contentAny === "string"
      ? contentAny
      : Array.isArray(contentAny)
        ? contentAny.map((p: any) => (typeof p?.text === "string" ? p.text : typeof p === "string" ? p : "")).join("")
        : "";
  return tryParseJsonLoose<ExtractedDocument>(content);
}

export async function analyzeStoredPreEnrollmentFile(args: {
  signedUrl: string;
  mimeType: string | null | undefined;
  userId: string;
}) {
  const mime = String(args.mimeType ?? "").toLowerCase();
  if (mime.includes("pdf")) {
    const { text } = await extractPdfTextFromUrl(args.signedUrl);
    return extractFromTextDocument({ text, userId: args.userId });
  }
  if (mime.startsWith("image/")) {
    return extractFromImageDocument({ signedUrl: args.signedUrl, userId: args.userId });
  }
  try {
    const r = await fetch(args.signedUrl, { cache: "no-store" });
    const text = await r.text();
    return extractFromTextDocument({ text, userId: args.userId });
  } catch {
    return {
      document_type: null,
      summary: "Tipo de arquivo não suportado para leitura automática.",
      warnings: ["Envie PDF ou imagem para extração assistida."],
      confidence: 0.1,
      student: {},
      guardians: [],
      enrollment: {},
    } satisfies ExtractedDocument;
  }
}

export function buildStudentPayloadFromProposal(input: PreEnrollmentProposal["student"], schoolId: string) {
  const student = normalizeStudent(input);
  return {
    school_id: schoolId,
    registration_number: student.registration_number ?? null,
    full_name: student.full_name ?? null,
    social_name: student.social_name ?? null,
    birth_date: student.birth_date ?? null,
    status: "ATIVO",
    guardian_name: student.mother_name ?? student.father_name ?? null,
    guardian_phone: student.mobile_phone ?? student.phone ?? null,
    notes: null,
    cpf: student.cpf ?? null,
    rg: student.rg ?? null,
    rg_issuer: student.rg_issuer ?? null,
    rg_state: student.rg_state ?? null,
    birth_certificate_number: student.birth_certificate_number ?? null,
    nationality: student.nationality ?? null,
    naturalness_city: student.naturalness_city ?? null,
    naturalness_state: student.naturalness_state ?? null,
    sex: student.sex ?? null,
    gender_identity: student.gender_identity ?? null,
    race_color: student.race_color ?? null,
    email: student.email ?? null,
    phone: student.phone ?? null,
    mobile_phone: student.mobile_phone ?? null,
    zip_code: student.zip_code ?? null,
    street: student.street ?? null,
    street_number: student.street_number ?? null,
    address_complement: student.address_complement ?? null,
    neighborhood: student.neighborhood ?? null,
    city: student.city ?? null,
    state_code: student.state_code ?? null,
    mother_name: student.mother_name ?? null,
    father_name: student.father_name ?? null,
    nis_number: student.nis_number ?? null,
    sus_card_number: student.sus_card_number ?? null,
    blood_type: student.blood_type ?? null,
    allergy_notes: null,
    health_notes: null,
    medication_notes: null,
    has_disability: false,
    disability_details: null,
    has_aee: false,
    uses_school_transport: false,
    social_program_notes: null,
    school_origin_name: student.school_origin_name ?? null,
    school_origin_network: student.school_origin_network ?? null,
    school_origin_city: student.school_origin_city ?? null,
    school_origin_state: student.school_origin_state ?? null,
    previous_school_year: student.previous_school_year ?? null,
    previous_grade: student.previous_grade ?? null,
    transfer_type: student.transfer_type ?? null,
    transfer_date: null,
  };
}

export function buildEnrollmentPayloadFromProposal(input: PreEnrollmentProposal["enrollment"], schoolId: string, studentId: string) {
  if (!input.class_id) return null;
  return {
    school_id: schoolId,
    student_id: studentId,
    class_id: input.class_id,
    school_year: cleanMaybeNumber(input.school_year) ?? new Date().getFullYear(),
    entry_cohort: cleanMaybeNumber(input.entry_cohort) ?? new Date().getFullYear(),
    curriculum_version: cleanText(input.curriculum_version),
    offer_model: cleanText(input.offer_model)?.toUpperCase() ?? null,
    enrollment_status: cleanText(input.enrollment_status)?.toUpperCase() ?? "ATIVA",
    itinerary_axis: cleanText(input.itinerary_axis)?.toUpperCase() ?? null,
    itinerary_name: cleanText(input.itinerary_name),
    elective_name: null,
    project_of_life_notes: cleanText(input.project_of_life_notes),
    risk_level: cleanText(input.risk_level)?.toUpperCase() ?? "BAIXO",
    enrollment_date: cleanDate(input.enrollment_date) ?? new Date().toISOString().slice(0, 10),
  };
}


export function normalizeNameForComparison(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeZipCodeForLookup(value: string | null | undefined) {
  const zip = String(value ?? "").replace(/\D+/g, "").trim();
  return zip.length === 8 ? zip : null;
}

export async function fetchAddressFromViaCep(zipCode: string | null | undefined) {
  const normalized = normalizeZipCodeForLookup(zipCode);
  if (!normalized) return null;
  const res = await fetch(`https://viacep.com.br/ws/${normalized}/json/`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || json.erro === true) return null;
  return {
    zip_code: normalized,
    street: cleanText(json.logradouro),
    neighborhood: cleanText(json.bairro),
    city: cleanText(json.localidade),
    state_code: cleanUf(json.uf),
    address_complement: cleanText(json.complemento),
  };
}

export async function applyViaCepToStudentDraft(student: ExtractedStudent) {
  const address = await fetchAddressFromViaCep(student.zip_code ?? null);
  if (!address) return normalizeStudent(student);
  return normalizeStudent({
    ...student,
    zip_code: student.zip_code ?? address.zip_code,
    street: student.street ?? address.street,
    neighborhood: student.neighborhood ?? address.neighborhood,
    city: student.city ?? address.city,
    state_code: student.state_code ?? address.state_code,
    address_complement: student.address_complement ?? address.address_complement,
  });
}

export function findStrongDuplicateCandidates(args: {
  student: ExtractedStudent;
  existingStudents: ExistingStudentCandidate[];
}) {
  const normalizedCpf = cleanDigits(args.student.cpf);
  const normalizedRg = cleanText(args.student.rg)?.toUpperCase() ?? null;
  const normalizedCert = cleanText(args.student.birth_certificate_number)?.toUpperCase() ?? null;
  const normalizedName = normalizeNameForComparison(args.student.full_name ?? null);
  const normalizedBirthDate = cleanDate(args.student.birth_date ?? null);

  const matches: StrongDuplicateCandidate[] = [];
  for (const existing of args.existingStudents) {
    const existingCpf = cleanDigits(existing.cpf ?? null);
    const existingRg = cleanText(existing.rg ?? null)?.toUpperCase() ?? null;
    const existingCert = cleanText(existing.birth_certificate_number ?? null)?.toUpperCase() ?? null;
    const existingName = normalizeNameForComparison(existing.full_name ?? null);
    const existingBirthDate = cleanDate(existing.birth_date ?? null);

    if (normalizedCpf && existingCpf && normalizedCpf === existingCpf) {
      matches.push({
        id: existing.id,
        full_name: existing.full_name ?? null,
        registration_number: existing.registration_number ?? null,
        cpf: existing.cpf ?? null,
        birth_date: existing.birth_date ?? null,
        rg: existing.rg ?? null,
        birth_certificate_number: existing.birth_certificate_number ?? null,
        reason: "CPF_EXATO",
      });
      continue;
    }

    if (normalizedRg && existingRg && normalizedRg === existingRg) {
      matches.push({
        id: existing.id,
        full_name: existing.full_name ?? null,
        registration_number: existing.registration_number ?? null,
        cpf: existing.cpf ?? null,
        birth_date: existing.birth_date ?? null,
        rg: existing.rg ?? null,
        birth_certificate_number: existing.birth_certificate_number ?? null,
        reason: "RG_EXATO",
      });
      continue;
    }

    if (normalizedCert && existingCert && normalizedCert === existingCert) {
      matches.push({
        id: existing.id,
        full_name: existing.full_name ?? null,
        registration_number: existing.registration_number ?? null,
        cpf: existing.cpf ?? null,
        birth_date: existing.birth_date ?? null,
        rg: existing.rg ?? null,
        birth_certificate_number: existing.birth_certificate_number ?? null,
        reason: "CERTIDAO_EXATA",
      });
      continue;
    }

    if (normalizedName && normalizedBirthDate && existingName && existingBirthDate && normalizedName === existingName && normalizedBirthDate === existingBirthDate) {
      matches.push({
        id: existing.id,
        full_name: existing.full_name ?? null,
        registration_number: existing.registration_number ?? null,
        cpf: existing.cpf ?? null,
        birth_date: existing.birth_date ?? null,
        rg: existing.rg ?? null,
        birth_certificate_number: existing.birth_certificate_number ?? null,
        reason: "NOME_E_DATA_EXATOS",
      });
    }
  }

  const unique = new Map<string, StrongDuplicateCandidate>();
  for (const match of matches) if (!unique.has(match.id)) unique.set(match.id, match);
  return Array.from(unique.values());
}
