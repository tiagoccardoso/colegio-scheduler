import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/authz";
import { openaiChatJsonSchema, OpenAIError } from "@/lib/openai-chat";

type ConflictKind = "teacher" | "room" | "class" | "slot";

type ConflictRow = {
  id: string;
  kind: ConflictKind;
  shift: string;
  weekday: number;
  period_index: number;
  slot: { id: string; label: string } | null;
  message: string;
  requested: {
    teacherId: string | null;
    teacherName: string;
    classId: string | null;
    className: string | null;
    subjectId?: string | null;
    subjectName?: string | null;
    roomId?: string | null;
    roomName?: string | null;
  };
  blockedBy:
    | {
        source: "existing" | "planned";
        activityType: "AULA" | "HA";
        teacherId: string | null;
        teacherName: string;
        classId: string | null;
        className: string | null;
        subjectId?: string | null;
        subjectName?: string | null;
        roomId?: string | null;
        roomName?: string | null;
      }
    | null;
};

type ReqBody = {
  shift?: string | null;
  conflicts?: ConflictRow[] | null;
};

type CandidateSlot = {
  time_slot_id: string;
  weekday: number;
  period_index: number;
  label: string;
};

function normShift(v: any) {
  const k = String(v ?? "").trim().toUpperCase();
  if (!k) return "MANHA";
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return k;
}

function clampInt(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function slotLabel(ts: any) {
  const wd = Number(ts?.weekday ?? 0);
  const p = Number(ts?.period_index ?? 0);
  const range = ts?.starts_at && ts?.ends_at ? `${ts.starts_at}–${ts.ends_at}` : p ? `${p}º` : "";
  const w = wd === 1 ? "Seg" : wd === 2 ? "Ter" : wd === 3 ? "Qua" : wd === 4 ? "Qui" : wd === 5 ? "Sex" : "Dia";
  return `${w} ${range}`.trim();
}

function chunkArray<T>(arr: T[], size: number) {
  const out: T[][] = [];
  const n = Math.max(1, Math.trunc(size || 1));
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function uniqStrings(list: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of list) {
    const v = String(s ?? "").trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          rationale: { type: "string" },
          actions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["move_rule", "delete_rule", "note"] },
                teacher_id: { type: "string" },
                match: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    class_id: { type: "string" },
                    subject_id: { type: "string" },
                    room_id: { type: "string" },
                    shift: { type: "string", enum: ["", "MANHA", "TARDE", "NOITE"] },
                    period_index: { type: "integer", minimum: 0, maximum: 12 },
                    weekday: { type: "integer", minimum: 0, maximum: 5 },
                  },
                  required: ["class_id", "subject_id", "room_id", "shift", "period_index", "weekday"],
                },
                to: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    weekday: { type: "integer", minimum: 0, maximum: 5 },
                    period_index: { type: "integer", minimum: 0, maximum: 12 },
                  },
                  required: ["weekday", "period_index"],
                },
                note: { type: "string" },
              },
              required: ["type", "teacher_id", "match", "to", "note"],
            },
          },
        },
        required: ["title", "rationale", "actions"],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "suggestions", "warnings", "questions"],
};

function buildCandidates(args: {
  timeSlots: any[];
  busyTeacher: Map<string, Set<string>>;
  busyClass: Map<string, Set<string>>;
  busyRoom: Map<string, Set<string>>;
  conflict: ConflictRow;
}): CandidateSlot[] {
  const { timeSlots, busyTeacher, busyClass, busyRoom, conflict } = args;
  const teacherId = conflict?.requested?.teacherId ? String(conflict.requested.teacherId) : "";
  const classId = conflict?.requested?.classId ? String(conflict.requested.classId) : "";
  const roomId = conflict?.requested?.roomId ? String(conflict.requested.roomId) : "";
  const originWd = clampInt(conflict?.weekday, 1, 5);
  const originP = clampInt(conflict?.period_index, 1, 12);
  const originSlotId = conflict?.slot?.id ? String(conflict.slot.id) : "";

  if (!teacherId || !classId) return [];

  const free: CandidateSlot[] = [];
  for (const ts of timeSlots) {
    const sid = String(ts?.id ?? "");
    if (!sid) continue;
    if (originSlotId && sid === originSlotId) continue;
    const wd = clampInt(ts?.weekday, 1, 5);
    const p = clampInt(ts?.period_index, 1, 12);

    const bt = busyTeacher.get(sid);
    const bc = busyClass.get(sid);
    const br = busyRoom.get(sid);

    const okTeacher = !bt || !bt.has(teacherId);
    const okClass = !bc || !bc.has(classId);
    const okRoom = !roomId ? true : !br || !br.has(roomId);

    if (!okTeacher || !okClass || !okRoom) continue;

    free.push({ time_slot_id: sid, weekday: wd, period_index: p, label: slotLabel(ts) });
  }

  free.sort((a, b) => {
    const aSameDay = a.weekday === originWd ? 0 : 1;
    const bSameDay = b.weekday === originWd ? 0 : 1;
    if (aSameDay !== bSameDay) return aSameDay - bSameDay;
    const aDp = Math.abs(a.period_index - originP);
    const bDp = Math.abs(b.period_index - originP);
    if (aDp !== bDp) return aDp - bDp;
    const aDw = Math.abs(a.weekday - originWd);
    const bDw = Math.abs(b.weekday - originWd);
    if (aDw !== bDw) return aDw - bDw;
    return a.label.localeCompare(b.label);
  });

  // Mantém poucas opções para reduzir tokens (a IA só precisa de alguns candidatos plausíveis).
  return free.slice(0, 4);
}

export async function POST(req: Request) {
  try {
    if (process.env.AI_SCHEDULER_ENABLED !== "true") {
      return NextResponse.json({ error: "IA desabilitada." }, { status: 400 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const shift = normShift(body?.shift ?? "MANHA");
    const conflictsIn = Array.isArray(body?.conflicts) ? body.conflicts : [];
    const conflicts = conflictsIn;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.school_id) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 400 });
    if (!isStaffRole((profile as any).role)) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const schoolId = String(profile.school_id);

    const { data: timeSlots } = await supabase
      .from("time_slots")
      .select("id,weekday,shift,period_index,starts_at,ends_at")
      .eq("school_id", schoolId)
      .eq("shift", shift)
      .in("weekday", [1, 2, 3, 4, 5])
      .order("weekday", { ascending: true })
      .order("period_index", { ascending: true })
      .order("starts_at", { ascending: true });

    const slots = ((timeSlots as any[]) ?? []).filter((t) => t?.id && t?.weekday && t?.period_index);
    const slotIds = slots.map((s) => String(s.id));

    // Detecta se existe coluna activity_type (bases antigas podem não ter)
    let hasActivityType = true;
    {
      const probe = await supabase.from("schedules").select("activity_type").limit(1);
      if (probe.error) hasActivityType = false;
    }

    let schedules: any[] = [];
    if (slotIds.length) {
      const sel = hasActivityType
        ? "id,time_slot_id,teacher_id,class_id,room_id,activity_type"
        : "id,time_slot_id,teacher_id,class_id,room_id";
      const res = await supabase.from("schedules").select(sel).eq("school_id", schoolId).in("time_slot_id", slotIds);
      if (res.error) {
        const legacy = await supabase
          .from("schedules")
          .select("id,time_slot_id,teacher_id,class_id,room_id")
          .eq("school_id", schoolId)
          .in("time_slot_id", slotIds);
        schedules = (legacy.data as any[]) ?? [];
      } else {
        schedules = (res.data as any[]) ?? [];
      }
    }

    const busyTeacher = new Map<string, Set<string>>();
    const busyClass = new Map<string, Set<string>>();
    const busyRoom = new Map<string, Set<string>>();

    function addBusy(map: Map<string, Set<string>>, slotId: string, id: string) {
      if (!id) return;
      map.set(slotId, map.get(slotId) ?? new Set());
      map.get(slotId)!.add(id);
    }

    for (const s of schedules) {
      const slotId = String(s?.time_slot_id ?? "");
      if (!slotId) continue;
      const tid = s?.teacher_id ? String(s.teacher_id) : "";
      const cid = s?.class_id ? String(s.class_id) : "";
      const rid = s?.room_id ? String(s.room_id) : "";
      if (tid) addBusy(busyTeacher, slotId, tid);
      if (cid) addBusy(busyClass, slotId, cid);
      if (rid) addBusy(busyRoom, slotId, rid);
    }

    const compact = conflicts.map((c) => {
      const candidates = buildCandidates({ timeSlots: slots, busyTeacher, busyClass, busyRoom, conflict: c });
      return {
        id: c.id,
        kind: c.kind,
        message: c.message,
        requested: {
          teacherId: c.requested.teacherId,
          teacherName: c.requested.teacherName,
          classId: c.requested.classId,
          className: c.requested.className,
          subjectId: (c.requested as any).subjectId ?? null,
          subjectName: (c.requested as any).subjectName ?? null,
          roomId: (c.requested as any).roomId ?? null,
          roomName: (c.requested as any).roomName ?? null,
        },
        slot: c.slot ? { id: c.slot.id, label: c.slot.label } : null,
        weekday: c.weekday,
        period_index: c.period_index,
        blockedBy: c.blockedBy
          ? {
              source: c.blockedBy.source,
              activityType: c.blockedBy.activityType,
              teacherName: c.blockedBy.teacherName,
              className: c.blockedBy.className,
              subjectName: (c.blockedBy as any).subjectName ?? null,
              roomName: (c.blockedBy as any).roomName ?? null,
            }
          : null,
        candidates,
      };
    });

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const sys =
      "Idioma obrigatório: Português do Brasil (pt-BR). " +
      "Escreva TODOS os campos de texto (summary, title, rationale, note, warnings, questions) em Português-BR. " +
      "Nunca responda em inglês. " +
      "Você é um assistente que ajuda a RESOLVER conflitos da grade escolar. " +
      "Você receberá conflitos detectados ao montar a grade a partir das regras de professores. " +
      "Sua tarefa: sugerir mudanças no cadastro de regras (movendo uma aula para um slot livre) para reduzir conflitos. " +
      "Use SOMENTE os slots candidatos fornecidos. " +
      "Retorne estritamente JSON conforme o schema, sem texto fora do JSON.";

    const batchSizeEnv = Number(process.env.AI_CONFLICT_BATCH_SIZE ?? "18");
    const batchSize = Number.isFinite(batchSizeEnv) && batchSizeEnv > 0 ? Math.trunc(batchSizeEnv) : 18;
    const batches = chunkArray(compact, batchSize);

    const allSuggestions: any[] = [];
    const allWarnings: string[] = [];
    const allQuestions: string[] = [];
    const parts: string[] = [];

    for (let i = 0; i < batches.length; i++) {
      const userPayload = {
        language: "pt-BR",
        shift,
        batch: { index: i + 1, total: batches.length },
        note: "Cada conflito representa uma tentativa de alocar uma aula (teacherId + classId + subjectId + roomId) em weekday/period_index. Sugira ações para mover a regra para outro slot livre.",
        conflicts: batches[i],
        outputRules: [
          "Sempre responda em Português-BR (pt-BR). Não use Inglês.",
          "Para cada conflito, sugira no máximo 1 ação move_rule (se houver candidatos) OU uma ação note (se não houver).",
          "Use SOMENTE slots em candidates para move_rule.",
          "Evite ações duplicadas para o mesmo professor e mesmo slot.",
          "Não invente IDs; use os IDs que aparecem em requested.*.",
          "Retorne estritamente JSON conforme o schema, sem texto fora do JSON.",
        ],
      };

      const result = await openaiChatJsonSchema<{
        summary: string;
        suggestions: any[];
        warnings: string[];
        questions: string[];
      }>({
        apiKey,
        model,
        schemaName: "global_conflicts_resolver",
        schema,
        temperature: 0.2,
        userIdForSafetyIdentifier: user.id,
        maxCompletionTokens: 1800,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      });

      parts.push(String((result as any)?.summary ?? ""));
      const sugg = Array.isArray((result as any)?.suggestions) ? (result as any).suggestions : [];
      const warn = Array.isArray((result as any)?.warnings) ? (result as any).warnings : [];
      const ques = Array.isArray((result as any)?.questions) ? (result as any).questions : [];
      allSuggestions.push(...sugg);
      allWarnings.push(...warn);
      allQuestions.push(...ques);
    }

    // Normalização defensiva: garantir arrays e remover duplicados
    const out = {
      summary:
        batches.length <= 1
          ? String(parts[0] ?? "")
          : `Sugestões geradas em ${batches.length} partes.\n` +
            parts
              .map((p, idx) => {
                const t = String(p ?? "").trim();
                return t ? `Parte ${idx + 1}: ${t}` : `Parte ${idx + 1}: (sem resumo)`;
              })
              .join("\n"),
      suggestions: allSuggestions,
      warnings: uniqStrings(allWarnings),
      questions: uniqStrings(allQuestions),
      meta: {
        shift,
        conflicts_sent: compact.length,
        batches: batches.length,
        batch_size: batchSize,
      },
    };

    return NextResponse.json(out);
  } catch (e: any) {
    if (e instanceof OpenAIError) {
      return NextResponse.json({ error: e.message }, { status: e.status || 400 });
    }
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
