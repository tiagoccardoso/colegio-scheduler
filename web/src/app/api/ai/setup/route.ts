import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveLegacyFieldsFromTeachingRules } from "@/lib/schedule/teaching-rules";

export const runtime = "nodejs";

type InMsg = { role: "user" | "assistant"; content: string };

type SClient = Awaited<ReturnType<typeof createClient>>;


function extractFirstJsonCodeBlock(text: string): any | null {
  const src = String(text || "");
  const m = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (m ? m[1] : "").trim();
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

type SetupPlan = {
  action: "apply";
  subjects?: { name: string; short_name?: string | null }[];
  rooms?: { name: string; short_name?: string | null }[];
  classes?: { name: string; shift?: string | null }[];
  timeSlots?: any;
  teachers?: any[];
  buildSchedule?: { shift?: string | null } | null;
};

function asString(v: any) {
  return v == null ? "" : String(v);
}

function normalizeKey(v: any) {
  // Normaliza nomes vindos do chat vs banco (acentos/maiúsculas/espaços)
  return asString(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeShift(v: any) {
  const s = asString(v).trim().toUpperCase();
  if (s === "MANHÃ") return "MANHA";
  if (s === "MANHA" || s === "TARDE" || s === "NOITE") return s;
  return "MANHA";
}

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function getProfileForRequest(supabase: SClient, token?: string | null) {
  // 1) Identifica o usuário (via cookie OU via Bearer token)
  const { data: auth } = token ? await supabase.auth.getUser(token) : await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return { user: null, profile: null };

  // Ajuda o TypeScript a entender que `user` não é nulo dentro das closures abaixo.
  const userId = user.id;

  // 2) Busca o profile. Atenção: quando autenticamos só por Bearer token,
  // o client "anon" NÃO fica autenticado para as queries seguintes; então
  // a consulta em `profiles` sob RLS pode retornar null. Para esses casos,
  // usamos o service role apenas para ler o profile do próprio usuário.
  // Este projeto usa majoritariamente profiles.user_id = auth.users.id.
  // Alguns bancos antigos usam profiles.id como vínculo.
  // IMPORTANT: não podemos selecionar colunas que talvez não existam (ex.: "id"),
  // senão o PostgREST retorna erro e a autenticação falha mesmo com profile válido.

  async function fetchProfileWith(client: any) {
    // 1) tenta schema novo (user_id)
    const byUserId = await client
      .from("profiles")
      .select("user_id, school_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!byUserId?.error && byUserId?.data) return byUserId.data;

    // Se a coluna user_id não existir (ou banco antigo), tenta schema legado (id)
    const byId = await client
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", userId)
      .maybeSingle();

    if (!byId?.error && byId?.data) return byId.data;
    return null;
  }

  let profile: any = null;
  if (token) {
    // token valida o usuário, mas queries anônimas podem falhar por RLS.
    const admin = createAdminClient();
    profile = await fetchProfileWith(admin);
  } else {
    profile = await fetchProfileWith(supabase);
    // Fallback defensivo (cookies/proxy/RLS): tenta via admin também.
    if (!profile) {
      const admin = createAdminClient();
      profile = await fetchProfileWith(admin);
    }
  }

  return { user, profile };
}

async function applySetupPlan(opts: {
  schoolId: string;
  plan: SetupPlan;
  cookieHeader: string | null;
}): Promise<{ execLog: string[]; warnings: string[] }> {
  const { schoolId, plan, cookieHeader } = opts;
  const admin = createAdminClient();
  const execLog: string[] = [];
  const warnings: string[] = [];

  // 1) Subjects
  const subjectNameToId = new Map<string, string>();
  if (Array.isArray(plan.subjects) && plan.subjects.length) {
    for (const s of plan.subjects) {
      const name = asString((s as any).name).trim();
      if (!name) continue;
      const short_name = asString((s as any).short_name).trim() || null;
      const { data, error } = await admin
        .from("subjects")
        .insert({ school_id: schoolId, name, short_name })
        .select("id")
        .maybeSingle();
      if (error) {
        const { data: found } = await admin
          .from("subjects")
          .select("id,name,short_name")
          .eq("school_id", schoolId)
          .ilike("name", name)
          .maybeSingle();
        if (found?.id) {
          subjectNameToId.set(normalizeKey(name), found.id);
          warnings.push(`Disciplina '${name}' já existia (reutilizada).`);
          continue;
        }
        throw new Error(`Erro ao criar disciplina '${name}': ${error.message}`);
      }
      if (data?.id) subjectNameToId.set(normalizeKey(name), data.id);
      execLog.push(`Disciplina criada: ${name}`);
    }
  }

  // Carrega subjects existentes também (para resolução por nome/short_name)
  const { data: subjectsExisting } = await admin
    .from("subjects")
    .select("id,name,short_name")
    .eq("school_id", schoolId);
  for (const s of (subjectsExisting as any[]) ?? []) {
    const n = normalizeKey(s?.name);
    if (n && s?.id) subjectNameToId.set(n, s.id);
    const sn = normalizeKey(s?.short_name);
    if (sn && s?.id) subjectNameToId.set(sn, s.id);
  }

  // 2) Rooms
  const roomNameToId = new Map<string, string>();
  // Quando o fluxo é executado em etapas (salas cadastradas em uma etapa anterior),
  // o plano atual pode não trazer `rooms`. Guardamos uma opção padrão do banco.
  let firstRoomId: string | null = null;
  if (Array.isArray(plan.rooms) && plan.rooms.length) {
    for (const r of plan.rooms) {
      const name = asString((r as any).name).trim();
      if (!name) continue;
      const { data, error } = await admin
        .from("rooms")
        // A tabela `rooms` no projeto não possui `short_name` (apenas `name`, `room_number`, `display_order`, ...).
        // Inserimos somente colunas garantidas para evitar erro "schema cache".
        .insert({ school_id: schoolId, name })
        .select("id")
        .maybeSingle();
      if (error) {
        const { data: found } = await admin
          .from("rooms")
          .select("id,name")
          .eq("school_id", schoolId)
          .ilike("name", name)
          .maybeSingle();
        if (found?.id) {
          roomNameToId.set(normalizeKey(name), found.id);
          warnings.push(`Sala '${name}' já existia (reutilizada).`);
          continue;
        }
        throw new Error(`Erro ao criar sala '${name}': ${error.message}`);
      }
      if (data?.id) roomNameToId.set(normalizeKey(name), data.id);
      execLog.push(`Sala criada: ${name}`);
    }
  }

  const { data: roomsExisting } = await admin
    .from("rooms")
    .select("id,name")
    .eq("school_id", schoolId);
  for (const r of (roomsExisting as any[]) ?? []) {
    const n = normalizeKey(r?.name);
    if (n && r?.id) roomNameToId.set(n, r.id);
    if (!firstRoomId && r?.id) firstRoomId = r.id;
  }

  // 3) Classes
  const classNameToId = new Map<string, string>();
  let firstClassId: string | null = null;
  if (Array.isArray(plan.classes) && plan.classes.length) {
    for (const c of plan.classes) {
      const name = asString((c as any).name).trim();
      if (!name) continue;
      const shift = normalizeShift((c as any).shift);
      const { data, error } = await admin
        .from("classes")
        .insert({ school_id: schoolId, name, shift })
        .select("id")
        .maybeSingle();
      if (error) {
        const { data: found } = await admin
          .from("classes")
          .select("id,name")
          .eq("school_id", schoolId)
          .ilike("name", name)
          .maybeSingle();
        if (found?.id) {
          classNameToId.set(normalizeKey(name), found.id);
          warnings.push(`Turma '${name}' já existia (reutilizada).`);
          continue;
        }
        throw new Error(`Erro ao criar turma '${name}': ${error.message}`);
      }
      if (data?.id) classNameToId.set(normalizeKey(name), data.id);
      execLog.push(`Turma criada: ${name} (${shift})`);
    }
  }

  const { data: classesExisting } = await admin
    .from("classes")
    .select("id,name")
    .eq("school_id", schoolId);
  for (const c of (classesExisting as any[]) ?? []) {
    const n = normalizeKey(c?.name);
    if (n && c?.id) classNameToId.set(n, c.id);
    if (!firstClassId && c?.id) firstClassId = c.id;
  }

  // 4) Time slots
  if (plan.timeSlots) {
    const ts = plan.timeSlots as any;
    const entries: any[] = Array.isArray(ts?.entries) ? ts.entries : [];
    const shift = normalizeShift(ts?.shift);
    if (entries.length) {
      for (const e of entries) {
        const weekday = Number(e?.weekday);
        const period_index = Number(e?.period_index);
        const starts_at = asString(e?.starts_at).trim();
        const ends_at = asString(e?.ends_at).trim();
        const eShift = normalizeShift(e?.shift ?? shift);
        if (!weekday || !period_index || !starts_at || !ends_at) continue;
        const { error } = await admin.from("time_slots").insert({
          school_id: schoolId,
          weekday,
          shift: eShift,
          period_index,
          starts_at,
          ends_at,
        });
        if (error) warnings.push(`Horário ${weekday}/${eShift} período ${period_index}: ${error.message}`);
        else execLog.push(`Horário criado: dia ${weekday} ${eShift} período ${period_index} (${starts_at}-${ends_at})`);
      }
    } else {
      const weekdays = Array.isArray(ts?.weekdays) && ts.weekdays.length ? ts.weekdays.map((n: any) => Number(n)).filter(Boolean) : [1,2,3,4,5];
      const periods = Number(ts?.periods || ts?.periodCount || 0) || 0;
      const periodMinutes = Number(ts?.periodMinutes || ts?.durationMinutes || 0) || 50;
      const startTime = asString(ts?.startTime || "07:00").trim();
      if (periods > 0 && startTime) {
        const [sh, sm] = startTime.split(":").map((x) => Number(x));
        for (const wd of weekdays) {
          let curMin = sh * 60 + sm;
          for (let i = 1; i <= periods; i++) {
            const st = `${String(Math.floor(curMin / 60)).padStart(2,"0")}:${String(curMin % 60).padStart(2,"0")}`;
            curMin += periodMinutes;
            const en = `${String(Math.floor(curMin / 60)).padStart(2,"0")}:${String(curMin % 60).padStart(2,"0")}`;
            const { error } = await admin.from("time_slots").insert({
              school_id: schoolId,
              weekday: wd,
              shift,
              period_index: i,
              starts_at: st,
              ends_at: en,
            });
            if (error) warnings.push(`Horário ${wd}/${shift} período ${i}: ${error.message}`);
            else execLog.push(`Horário criado: dia ${wd} ${shift} período ${i} (${st}-${en})`);
          }
        }
      } else {
        warnings.push("timeSlots informado, mas faltam campos (periods/startTime).");
      }
    }
  }

  // 5) Teachers
  if (Array.isArray(plan.teachers) && plan.teachers.length) {
    for (const t of plan.teachers) {
      const name = asString((t as any).name).trim();
      if (!name) continue;
      const short_name = asString((t as any).short_name).trim() || null;
      const email = asString((t as any).email).trim() || null;
      const allow_interjornada_lt_11 = Boolean((t as any).allow_interjornada_lt_11);

      const subject_ids: string[] = [];
      const subjects = (t as any).subjects ?? (t as any).subject_ids ?? [];
      if (Array.isArray(subjects)) {
        for (const s of subjects) {
          // Pode vir como string ("Português") ou objeto ({ name: "Português" })
          const val = asString(typeof s === "object" ? (s as any)?.name : s).trim();
          if (!val) continue;
          if (val.includes("-")) subject_ids.push(val);
          else {
            const resolved = subjectNameToId.get(normalizeKey(val));
            if (resolved) subject_ids.push(resolved);
          }
        }
      }

      let teaching_rules: any = (t as any).teaching_rules;
      if (!Array.isArray(teaching_rules) && typeof teaching_rules === "string") {
        try { teaching_rules = JSON.parse(teaching_rules); } catch { teaching_rules = []; }
      }
      if (!Array.isArray(teaching_rules)) teaching_rules = [];

      const rulesByName: any[] = Array.isArray((t as any).rulesByName) ? (t as any).rulesByName : [];
      for (const r of rulesByName) {
        const subjectName = asString(r?.subject).trim();
        const roomName = asString(r?.room).trim();
        const className = asString(r?.class).trim();
        const shift = normalizeShift(r?.shift);
        const period_index = Number(r?.period_index);
        const weekdays = Array.isArray(r?.weekdays) ? r.weekdays.map((n: any) => Number(n)).filter(Boolean) : null;

        const sid = subjectNameToId.get(normalizeKey(subjectName));
        const rid = roomNameToId.get(normalizeKey(roomName));
        const cid = classNameToId.get(normalizeKey(className));
        if (!sid || !rid || !cid || !period_index) continue;
        teaching_rules.push({ subject_id: sid, room_id: rid, class_id: cid, shift, period_index, weekdays });
      }

      // Suporte a um formato mais simples vindo do chat:
      // teachers: [{ name, subjects:["Matemática"], schedule:{"segunda":[1,2],"terça":[3]} , shift:"MANHÃ", class:"Turma A", room:"Sala 1" }]
      // Se class/room não vierem, usamos defaults (e avisamos) para garantir que as telas/grade consigam trabalhar.
      const schedule = (t as any).schedule;
      if (schedule && typeof schedule === "object" && !Array.isArray(schedule)) {
        const weekdayMap: Record<string, number> = {
          "seg": 1,
          "segunda": 1,
          "segunda-feira": 1,
          "ter": 2,
          "terca": 2,
          "terça": 2,
          "terça-feira": 2,
          "qua": 3,
          "quarta": 3,
          "quarta-feira": 3,
          "qui": 4,
          "quinta": 4,
          "quinta-feira": 4,
          "sex": 5,
          "sexta": 5,
          "sexta-feira": 5,
        };

        const teacherShift = normalizeShift((t as any).shift || (plan.buildSchedule as any)?.shift || (plan.classes?.[0] as any)?.shift || "MANHA");

        // Resolve turma(s)
        const classNamesRaw = (t as any).classes ?? (t as any).turmas ?? (t as any).class ?? (t as any).turma;
        let classIds: string[] = [];
        const classNames: string[] = Array.isArray(classNamesRaw)
          ? classNamesRaw.map((x: any) => asString(x).trim()).filter(Boolean)
          : [asString(classNamesRaw).trim()].filter(Boolean);
        for (const cn of classNames) {
          const cid = classNameToId.get(normalizeKey(cn));
          if (cid) classIds.push(cid);
        }
        if (classIds.length === 0) {
          // Fluxo em etapas: o plano atual pode não conter `classes`.
          // Usa a primeira turma já cadastrada no banco para garantir que teaching_rules seja preenchido.
          if (firstClassId) {
            classIds = [firstClassId];
            warnings.push(`Professor '${name}': turma não informada; usando a primeira turma cadastrada como padrão.`);
          }
        }

        // Resolve sala(s)
        const roomNamesRaw = (t as any).rooms ?? (t as any).salas ?? (t as any).room ?? (t as any).sala;
        let roomIds: string[] = [];
        const roomNames: string[] = Array.isArray(roomNamesRaw)
          ? roomNamesRaw.map((x: any) => asString(x).trim()).filter(Boolean)
          : [asString(roomNamesRaw).trim()].filter(Boolean);
        for (const rn of roomNames) {
          const rid = roomNameToId.get(normalizeKey(rn));
          if (rid) roomIds.push(rid);
        }
        if (roomIds.length === 0) {
          // Fluxo em etapas: o plano atual pode não conter `rooms`.
          // Usa a primeira sala já cadastrada no banco para garantir que teaching_rules seja preenchido.
          if (firstRoomId) {
            roomIds = [firstRoomId];
            warnings.push(`Professor '${name}': sala não informada; usando a primeira sala cadastrada como padrão.`);
          }
        }

        // Resolve disciplina (se várias, usa a primeira e avisa)
        const subjectId = subject_ids[0] || null;
        if (!subjectId) {
          warnings.push(`Professor '${name}': disciplinas ausentes; não foi possível gerar vínculos por horário.`);
        }
        if (subject_ids.length > 1) {
          warnings.push(`Professor '${name}': múltiplas disciplinas informadas; usando apenas a primeira para gerar vínculos por horário.`);
        }

        if (subjectId && classIds.length && roomIds.length) {
          // Usa apenas a primeira turma/sala por padrão para evitar colisões impossíveis (mesmo professor em duas turmas no mesmo horário)
          const cid = classIds[0];
          const rid = roomIds[0];

          for (const [k, v] of Object.entries(schedule)) {
            const key = asString(k).trim().toLowerCase();
            const wd = weekdayMap[key] ?? weekdayMap[key.slice(0, 3)] ?? null;
            if (!wd) continue;
            const periods: number[] = Array.isArray(v)
              ? v.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n >= 1 && n <= 30)
              : [];
            for (const p of periods) {
              teaching_rules.push({
                subject_id: subjectId,
                room_id: rid,
                class_id: cid,
                shift: teacherShift,
                period_index: p,
                weekdays: [wd],
              });
            }
          }
        }
        if (subjectId && (!classIds.length || !roomIds.length)) {
          if (!classIds.length) warnings.push(`Professor '${name}': nenhuma turma encontrada para vincular no horário (cadastre turmas antes ou informe a turma no professor).`);
          if (!roomIds.length) warnings.push(`Professor '${name}': nenhuma sala encontrada para vincular no horário (cadastre salas antes ou informe a sala no professor).`);
        }
      }

      // Deriva os campos legados que o restante do sistema e as telas usam.
      // Isso faz com que a tela de Professores mostre Disciplinas/Turmas/Salas/Turnos corretamente.
      const derived = deriveLegacyFieldsFromTeachingRules((teaching_rules as any[]) ?? []);

      const payload: any = {
        school_id: schoolId,
        name,
        short_name,
        email,
        allow_interjornada_lt_11,
        teaching_rules,

        // Campos derivados (compatibilidade/legado)
        shifts: derived.shifts,
        availability: derived.availability,
        available_weekdays: derived.available_weekdays,
        subject_id: derived.subject_id,
        default_room_id: derived.default_room_id,
        subject_ids: derived.subject_ids ?? [],
        room_ids: derived.room_ids ?? [],
        class_ids: derived.class_ids ?? [],
      };

      const { error } = await admin.from("teachers").insert(payload);
      if (error) warnings.push(`Professor '${name}': ${error.message}`);
      else execLog.push(`Professor criado: ${name}`);
    }
  }

  // Revalidate related pages
  try {
    revalidatePath("/subjects");
    revalidatePath("/rooms");
    revalidatePath("/classes");
    revalidatePath("/teachers");
    revalidatePath("/time-slots");
    revalidatePath("/schedule");
    revalidatePath("/weekly-grade");
  } catch {
    // ignore
  }

  // 6) Build schedule via existing endpoint (uses user cookie)
  if (plan.buildSchedule && cookieHeader) {
    const shift = normalizeShift(plan.buildSchedule?.shift);
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL;
      if (!base || !base.startsWith("http")) {
        warnings.push("NEXT_PUBLIC_SITE_URL não configurado; não foi possível montar a grade automaticamente.");
        return { execLog, warnings };
      }
      const url = `${base}/api/ai/build-global-schedule`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieHeader },
        body: JSON.stringify({ shift }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) warnings.push(j?.error || "Falha ao montar a grade.");
      else execLog.push(`Grade montada para o turno ${shift}.`);
    } catch {
      warnings.push("Não foi possível chamar o gerador de grade automaticamente.");
    }
  }

  return { execLog, warnings };
}

const MAX_MESSAGES = 24;
const MAX_CHARS = 2600;

function normalizeMessages(input: any): InMsg[] {
  const arr = Array.isArray(input) ? input : [];
  const out: InMsg[] = [];
  for (const raw of arr) {
    const role: InMsg["role"] = raw?.role === "assistant" ? "assistant" : "user";
    const content = String(raw?.content ?? "").trim();
    if (!content) continue;
    out.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  return out.slice(-MAX_MESSAGES);
}

async function parseInput(req: Request): Promise<{ message: string; transcript: string | null; chatLog: InMsg[] }> {
  const ct = req.headers.get("content-type") || "";

  // JSON (texto)
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as any;
    const message = String(body?.message ?? "").trim();
    const chatLog = normalizeMessages(body?.chatLog);
    return { message, transcript: null, chatLog };
  }

  // FormData (áudio opcional)
  const fd = await req.formData();
  const message = String(fd.get("message") || "").trim();

  let chatLogRaw: any = [];
  try {
    const s = String(fd.get("chatLog") || "[]");
    chatLogRaw = JSON.parse(s);
  } catch {
    chatLogRaw = [];
  }
  const chatLog = normalizeMessages(chatLogRaw);

  const audio = fd.get("audio");
  if (!audio || !(audio instanceof Blob) || audio.size === 0) {
    return { message, transcript: null, chatLog };
  }

  // Transcrição via OpenAI (quando áudio enviado)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return { message, transcript: null, chatLog };

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

  const tfd = new FormData();
  tfd.append("model", model);

  // Em ambientes Node/Next, o FormData recebido costuma materializar o áudio como File (subtipo de Blob).
  // Para evitar problemas de tipagem (e runtime) entre File/Blob, anexamos o Blob com filename quando necessário.
  const blob = audio as Blob;
  // Preferir manter File quando existir; caso contrário, anexar como Blob + filename (padrão do FormData).
  if (typeof File !== "undefined" && audio instanceof File) {
    tfd.append("file", audio);
  } else {
    // O terceiro argumento define o filename; a API de transcrição aceita Blob.
    tfd.append("file", blob, "audio.webm");
  }

const tr = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
    body: tfd,
  });

  const trJson = await tr.json().catch(() => ({} as any));
  const transcript = String(trJson?.text ?? "").trim();

  return { message, transcript: transcript || null, chatLog };
}

const SYSTEM_PROMPT = `
Você é o assistente de parametrização do sistema "Colégio Scheduler".

Objetivo: guiar o usuário para parametrizar tudo (Disciplinas, Salas, Turmas, Horários/Time Slots, Professores e, ao final, montar a grade do turno solicitado).

Regras:
- Sempre trabalhe em português (Brasil).
- Se faltarem dados, faça perguntas objetivas.
- Antes de executar qualquer cadastro, confirme um "plano" resumido do que será criado.
- Quando o usuário confirmar, execute.

Dados essenciais que você deve coletar (se não vierem no pedido):
1) Turno (MANHÃ/TARDE/NOITE) e dias da semana usados.
2) Quantidade de períodos e duração em minutos.
3) Lista de disciplinas.
4) Lista de salas.
5) Lista de turmas (nome + turno).
6) Professores: nome, disciplinas que leciona, e distribuição/carga por dia/período.
7) Restrições: indisponibilidades/HA, preferências, regras especiais.

Formato de resposta:
- Responda com instruções claras.
- Quando possível, termine com uma lista de perguntas faltantes.

IMPORTANTE: nesta versão, você NÃO deve fingir que executou ações.
Quando o usuário confirmar, responda com um JSON em um bloco de código contendo:
{
  "action": "apply",
  "subjects": [...],
  "rooms": [...],
  "classes": [...],
  "timeSlots": {...},
  "teachers": [...],
  "buildSchedule": {"shift":"MANHÃ"}
}

O backend valida e aplica.
`;

export async function POST(req: Request) {
  try {
    if (process.env.AI_SCHEDULER_ENABLED !== "true") {
      return NextResponse.json({ error: "Assistente de parametrização indisponível no momento." }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "Assistente de parametrização indisponível no momento." }, { status: 400 });
    }

    // Se o Dashboard enviar um plano já estruturado para aplicar no banco, aplicamos aqui sem chamar a IA.
    // Importante: precisamos ler o JSON de um clone ANTES de consumir o body na função parseInput().
    const ct = req.headers.get("content-type") || "";
    let peek: any = null;
    if (ct.includes("application/json")) {
      peek = await req.clone().json().catch(() => null);
    }

    const { message, transcript, chatLog } = await parseInput(req);

    const bearer = getBearerToken(req);

    if (peek && typeof peek === "object" && peek.action === "apply" && peek.payload) {
      const supabase = await createClient();
      const { profile } = await getProfileForRequest(supabase, bearer);
      if (!profile?.school_id) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
      if (String(profile.role) !== "director") {
        return NextResponse.json({ error: "Apenas o diretor pode aplicar parametrizações." }, { status: 403 });
      }
      const plan = peek.payload as SetupPlan;
      if (!plan || (plan as any).action !== "apply") return NextResponse.json({ error: "Plano inválido." }, { status: 400 });

      const cookieHeader = req.headers.get("cookie");
      const applied = await applySetupPlan({ schoolId: String(profile.school_id), plan, cookieHeader });

      return NextResponse.json({
        ok: true,
        message: "Cadastros aplicados no banco.",
        execLog: applied.execLog,
        warnings: applied.warnings,
      });
    }



    const supabase = await createClient();
    const { user, profile } = await getProfileForRequest(supabase, bearer);
    if (!user || !profile) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    // Mensagem final enviada para o modelo (áudio tem prioridade)
    const userText = (transcript || message || "").trim();
    if (!userText) {
      return NextResponse.json({ error: "Envie uma mensagem (texto ou áudio)." }, { status: 400 });
    }

    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    // Chamamos o chat: ele devolve perguntas OU um JSON de ação em bloco de código.
    const aiRes = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        store: false,
        max_completion_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...chatLog.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: userText },
        ],
      }),
    });

    const aiJson = await aiRes.json().catch(() => ({} as any));
    if (!aiRes.ok) {
      return NextResponse.json(
        { error: aiJson?.error?.message ?? "Falha ao chamar a IA." },
        { status: 500 },
      );
    }

    const content = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "Resposta vazia." }, { status: 500 });

    // Nesta correção de build, não aplicamos automaticamente no banco.
    // O front já suporta exibir perguntas/logs/avisos; mantemos payload simples.
    const plan = extractFirstJsonCodeBlock(content);

    return NextResponse.json({
      ok: true,
      transcript,
      message: content,
      plan: plan && plan.action === "apply" ? plan : null,
      questions: [],
      execLog: [],
      warnings: [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
