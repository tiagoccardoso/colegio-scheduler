import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/authz";
import { openaiChatJsonSchema, OpenAIError } from "@/lib/openai-chat";

type ReqBody = {
  teacherId: string;
  criteria?: string;
};

type RefRow = { id: string; name: string | null; shift?: string | null; default_room_id?: string | null };

type TimeSlotRow = { weekday: number; starts_at: string; ends_at: string; shift: string | null; period_index: number | null };

type Shift = "MANHA" | "TARDE" | "NOITE";

type TeachingRule = {
  subject_id: string;
  room_id: string;
  class_id: string;
  shift: Shift;
  period_index: number;
  weekdays: number[]; // 1 item (1..5)
};

function normalizeShift(v: any): Shift | null {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return null;
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return (["MANHA", "TARDE", "NOITE"] as any).includes(key) ? (key as Shift) : null;
}

function periodsSummary(timeSlots: TimeSlotRow[]) {
  const byShift = new Map<string, Map<number, { starts_at: string; ends_at: string }>>();
  for (const ts of timeSlots) {
    const s = normalizeShift(ts.shift);
    const p = ts.period_index == null ? null : Number(ts.period_index);
    if (!s || !p || !Number.isFinite(p)) continue;
    byShift.set(s, byShift.get(s) ?? new Map());
    const m = byShift.get(s)!;
    if (!m.has(p)) m.set(p, { starts_at: ts.starts_at, ends_at: ts.ends_at });
  }
  const out: any = {};
  for (const [s, m] of byShift.entries()) {
    out[s] = Array.from(m.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([period_index, range]) => ({ period_index, ...range }));
  }
  return out;
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    teaching_rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          subject_id: { type: "string" },
          room_id: { type: "string" },
          class_id: { type: "string" },
          shift: { type: "string", enum: ["MANHA", "TARDE", "NOITE"] },
          period_index: { type: "integer", minimum: 1, maximum: 6 },
          weekdays: {
            type: "array",
            minItems: 1,
            maxItems: 1,
            items: { type: "integer", minimum: 1, maximum: 5 },
          },
        },
        required: ["subject_id", "room_id", "class_id", "shift", "period_index", "weekdays"],
      },
    },
    summary: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
  },
  // Structured Outputs (modo estrito) exige que "required" inclua TODAS as chaves definidas em "properties".
  required: ["teaching_rules", "summary", "warnings", "questions"],
};

export async function POST(req: Request) {
  try {
    if (process.env.AI_SCHEDULER_ENABLED !== "true") {
      return NextResponse.json({ error: "IA desabilitada." }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada." }, { status: 400 });
    }

    const body = (await req.json()) as ReqBody;
    const teacherId = String(body?.teacherId ?? "").trim();
    const criteria = String(body?.criteria ?? "").trim();

    if (!teacherId) return NextResponse.json({ error: "teacherId obrigatório." }, { status: 400 });
    if (!criteria) return NextResponse.json({ error: "Preencha o campo Critérios para usar a IA." }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("school_id, role").eq("user_id", user.id).maybeSingle();
    if (!profile || !isStaffRole((profile as any).role)) {
      return NextResponse.json({ error: "Apenas equipe pode usar esta função." }, { status: 403 });
    }
    const schoolId = String((profile as any).school_id);

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id,name,default_room_id")
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!teacher) return NextResponse.json({ error: "Professor não encontrado." }, { status: 404 });

    const [{ data: subjects }, { data: rooms }, { data: classes }, { data: timeSlots }] = await Promise.all([
      supabase.from("subjects").select("id,name").eq("school_id", schoolId).order("name", { ascending: true }),
      supabase.from("rooms").select("id,name").eq("school_id", schoolId).order("name", { ascending: true }),
      supabase.from("classes").select("id,name,shift,default_room_id").eq("school_id", schoolId).order("name", { ascending: true }),
      supabase
        .from("time_slots")
        .select("weekday,starts_at,ends_at,shift,period_index")
        .eq("school_id", schoolId)
        .order("weekday", { ascending: true })
        .order("starts_at", { ascending: true }),
    ]);

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const userPayload = {
      teacher: { id: teacher.id, name: (teacher as any).name ?? null, default_room_id: (teacher as any).default_room_id ?? null },
      criteria,
      classes: ((classes as RefRow[]) ?? []).map((c) => ({
        id: c.id,
        name: c.name ?? c.id,
        shift: c.shift ?? null,
        default_room_id: (c as any).default_room_id ?? null,
      })),
      subjects: ((subjects as RefRow[]) ?? []).map((s) => ({ id: s.id, name: s.name ?? s.id })),
      rooms: ((rooms as RefRow[]) ?? []).map((r) => ({ id: r.id, name: r.name ?? r.id })),
      timeSlotsByShift: periodsSummary((timeSlots as any[]) ?? []),
      outputNotes: [
        "Cada item de teaching_rules representa UMA aula fixa em um slot: (shift + period_index + weekday).",
        "weekdays deve ter EXATAMENTE 1 elemento (1=Seg ... 5=Sex).",
        "shift deve respeitar o turno da turma (se a turma tiver shift definido).",
        "room_id: se não houver sala explícita, prefira default_room_id da turma; senão, use teacher.default_room_id; senão, escolha uma sala da lista.",
        "Se faltar informação essencial (ex.: quais turmas, ou qual disciplina), NÃO invente: coloque uma pergunta em questions e deixe teaching_rules vazio ou parcial.",
      ],
    };

    const sys =
      "Você é um assistente que transforma critérios em uma proposta de horários para professor. " +
      "Você DEVE responder estritamente no formato JSON (schema), sem texto fora do JSON.";

    const result = await openaiChatJsonSchema<{
      teaching_rules: TeachingRule[];
      summary: string;
      warnings: string[];
      questions: string[];
    }>({
      apiKey,
      model,
      schemaName: "teacher_schedule_preview",
      schema,
      userIdForSafetyIdentifier: user.id,
      temperature: 0.2,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      maxCompletionTokens: 1200,
    });

    // Sanitização: IDs válidos + sem duplicar slot + coerência com turno da turma
    const subjIds = new Set(((subjects as RefRow[]) ?? []).map((s) => s.id));
    const roomIds = new Set(((rooms as RefRow[]) ?? []).map((r) => r.id));
    const classesArr = ((classes as RefRow[]) ?? []);
    const classById = new Map(classesArr.map((c) => [c.id, c]));
    const anyRoom = (rooms as RefRow[] | null)?.[0]?.id ?? null;
    const teacherDefaultRoom = String((teacher as any).default_room_id ?? "").trim();

    const warnings = Array.isArray(result.warnings) ? [...result.warnings] : [];
    const questions = Array.isArray(result.questions) ? [...result.questions] : [];

    const out: TeachingRule[] = [];
    const used = new Set<string>();

    for (const r of Array.isArray(result.teaching_rules) ? result.teaching_rules : []) {
      const subject_id = String((r as any).subject_id ?? "").trim();
      const class_id = String((r as any).class_id ?? "").trim();
      let room_id = String((r as any).room_id ?? "").trim();
      const shift = normalizeShift((r as any).shift);
      const period_index = Number((r as any).period_index);
      const weekdays = Array.isArray((r as any).weekdays) ? (r as any).weekdays.map((n: any) => Number(n)) : [];
      const weekday = weekdays.length ? Number(weekdays[0]) : NaN;

      if (!subject_id || !subjIds.has(subject_id)) {
        warnings.push(`Ignorado: disciplina inválida (${subject_id || "vazio"}).`);
        continue;
      }
      if (!class_id || !classById.has(class_id)) {
        warnings.push(`Ignorado: turma inválida (${class_id || "vazio"}).`);
        continue;
      }
      if (!shift) {
        warnings.push("Ignorado: shift inválido.");
        continue;
      }
      if (!Number.isFinite(period_index) || period_index < 1 || period_index > 6) {
        warnings.push("Ignorado: period_index inválido.");
        continue;
      }
      if (!Number.isFinite(weekday) || weekday < 1 || weekday > 5) {
        warnings.push("Ignorado: weekday inválido.");
        continue;
      }

      const cls = classById.get(class_id)!;
      const clsShift = normalizeShift((cls as any).shift);
      if (clsShift && clsShift !== shift) {
        warnings.push(`Ignorado: turma ${cls.name ?? class_id} é do turno ${clsShift}, mas o item veio como ${shift}.`);
        continue;
      }

      if (!room_id || !roomIds.has(room_id)) {
        const clsDefault = String((cls as any).default_room_id ?? "").trim();
        if (clsDefault && roomIds.has(clsDefault)) room_id = clsDefault;
        else if (teacherDefaultRoom && roomIds.has(teacherDefaultRoom)) room_id = teacherDefaultRoom;
        else if (anyRoom) room_id = anyRoom;
      }
      if (!room_id || !roomIds.has(room_id)) {
        warnings.push(`Ignorado: sala inválida (${room_id || "vazio"}).`);
        continue;
      }

      const key = `${shift}:${period_index}:${weekday}`;
      if (used.has(key)) {
        warnings.push(`Ignorado: conflito interno (duas aulas no mesmo slot ${key}).`);
        continue;
      }
      used.add(key);

      out.push({
        subject_id,
        class_id,
        room_id,
        shift,
        period_index,
        weekdays: [weekday],
      });
    }

    return NextResponse.json({
      teaching_rules: out,
      summary: typeof result.summary === "string" ? result.summary : "",
      warnings,
      questions,
    });
  } catch (e: any) {
    const msg = e instanceof OpenAIError ? e.message : e?.message ?? "Erro inesperado.";
    const status = e instanceof OpenAIError && e.status ? e.status : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
