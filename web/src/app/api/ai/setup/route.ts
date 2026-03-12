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
  // Observação: a IA (ou o usuário) pode enviar strings ao invés de objetos.
  // Ex.: subjects: ["Matemática"] / rooms: ["Sala 1"]. Normalizamos na aplicação.
  subjects?: ({ name: string; short_name?: string | null } | string)[];
  rooms?: ({ name: string; short_name?: string | null } | string)[];
  classes?: { name: string; shift?: string | null }[];
  timeSlots?: any;
  teachers?: any[];
  curriculumMatrix?: any[];
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

  function getNameLike(v: any): string {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "object") return asString((v as any).name ?? (v as any).nome ?? (v as any).title).trim();
    return asString(v);
  }

  // 1) Subjects
  const subjectNameToId = new Map<string, string>();
  const subjectsInput: any[] =
    (Array.isArray((plan as any).subjects) && (plan as any).subjects) ||
    (Array.isArray((plan as any).disciplinas) && (plan as any).disciplinas) ||
    (Array.isArray((plan as any).disciplines) && (plan as any).disciplines) ||
    [];

  if (Array.isArray(subjectsInput) && subjectsInput.length) {
    for (const s of subjectsInput) {
      const name = getNameLike(s).trim();
      if (!name) continue;
      const short_name = typeof s === "object" ? (asString((s as any).short_name).trim() || null) : null;
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

  const roomsInput: any[] =
    (Array.isArray((plan as any).rooms) && (plan as any).rooms) ||
    (Array.isArray((plan as any).salas) && (plan as any).salas) ||
    [];

  if (Array.isArray(roomsInput) && roomsInput.length) {
    for (const r of roomsInput) {
      const name = getNameLike(r).trim();
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
  const classNameToShift = new Map<string, string>();
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
      classNameToShift.set(normalizeKey(name), shift);
      execLog.push(`Turma criada: ${name} (${shift})`);
    }
  }

  const { data: classesExisting } = await admin
    .from("classes")
    .select("id,name,shift")
    .eq("school_id", schoolId);
  for (const c of (classesExisting as any[]) ?? []) {
    const n = normalizeKey(c?.name);
    if (n && c?.id) classNameToId.set(n, c.id);
    if (n && c?.shift) classNameToShift.set(n, normalizeShift(c.shift));
    if (!firstClassId && c?.id) firstClassId = c.id;
  }

  // 4) Matriz curricular / distribuição de disciplinas por turma
  const curriculumMatrixInput: any[] =
    (Array.isArray((plan as any).curriculumMatrix) && (plan as any).curriculumMatrix) ||
    (Array.isArray((plan as any).matrix) && (plan as any).matrix) ||
    (Array.isArray((plan as any).matrizCurricular) && (plan as any).matrizCurricular) ||
    (Array.isArray((plan as any).matriz) && (plan as any).matriz) ||
    (Array.isArray((plan as any).classSubjectRequirements) && (plan as any).classSubjectRequirements) ||
    [];

  if (Array.isArray(curriculumMatrixInput) && curriculumMatrixInput.length) {
    for (const rawRow of curriculumMatrixInput) {
      if (!rawRow || typeof rawRow !== "object") continue;

      const classRaw =
        (rawRow as any).class ??
        (rawRow as any).turma ??
        (rawRow as any).class_name ??
        (rawRow as any).className ??
        (rawRow as any).class_id ??
        null;
      const subjectRaw =
        (rawRow as any).subject ??
        (rawRow as any).disciplina ??
        (rawRow as any).subject_name ??
        (rawRow as any).subjectName ??
        (rawRow as any).subject_id ??
        null;
      const lessonsPerWeek = Math.max(
        1,
        Math.min(
          40,
          Number(
            (rawRow as any).lessons_per_week ??
              (rawRow as any).lessonsPerWeek ??
              (rawRow as any).aulas_por_semana ??
              (rawRow as any).aulasPerWeek ??
              0,
          ) || 0,
        ),
      );

      const classIdRaw = asString((rawRow as any).class_id).trim();
      const subjectIdRaw = asString((rawRow as any).subject_id).trim();
      const className = getNameLike(classRaw).trim();
      const subjectName = getNameLike(subjectRaw).trim();

      const classId =
        classIdRaw ||
        (className.includes("-") ? className : classNameToId.get(normalizeKey(className)) || "");
      const subjectId =
        subjectIdRaw ||
        (subjectName.includes("-") ? subjectName : subjectNameToId.get(normalizeKey(subjectName)) || "");

      if (!classId || !subjectId || !lessonsPerWeek) {
        warnings.push(
          `Matriz curricular ignorada: verifique turma, disciplina e aulas/semana (${className || classId || "turma?"} / ${subjectName || subjectId || "disciplina?"}).`,
        );
        continue;
      }

      const payload = {
        school_id: schoolId,
        class_id: classId,
        subject_id: subjectId,
        lessons_per_week: lessonsPerWeek,
      };

      const { data: existing } = await admin
        .from("class_subject_requirements")
        .select("id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("subject_id", subjectId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await admin
          .from("class_subject_requirements")
          .update({ lessons_per_week: lessonsPerWeek })
          .eq("id", existing.id)
          .eq("school_id", schoolId);
        if (error) {
          warnings.push(
            `Matriz curricular (${className || classId} / ${subjectName || subjectId}): ${error.message}`,
          );
          continue;
        }
        execLog.push(
          `Matriz curricular atualizada: ${className || classId} — ${subjectName || subjectId} (${lessonsPerWeek} aulas/semana)`,
        );
        continue;
      }

      const { error } = await admin.from("class_subject_requirements").insert(payload);
      if (error) {
        warnings.push(
          `Matriz curricular (${className || classId} / ${subjectName || subjectId}): ${error.message}`,
        );
        continue;
      }
      execLog.push(
        `Matriz curricular criada: ${className || classId} — ${subjectName || subjectId} (${lessonsPerWeek} aulas/semana)`,
      );
    }
  }

  // 5) Time slots
  // Guardamos uma contagem padrão de períodos por turno para ajudar a criar disponibilidade de professores.
  const defaultPeriodCountByShift = new Map<string, number>();
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

        if (Number.isFinite(period_index) && period_index > 0) {
          const prev = defaultPeriodCountByShift.get(eShift) ?? 0;
          if (period_index > prev) defaultPeriodCountByShift.set(eShift, period_index);
        }

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
        const prev = defaultPeriodCountByShift.get(shift) ?? 0;
        if (periods > prev) defaultPeriodCountByShift.set(shift, periods);

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
      "sab": 6,
      "sábado": 6,
      "sabado": 6,
      "dom": 7,
      "domingo": 7,
    };

    function uniq<T>(arr: T[]) {
      return Array.from(new Set(arr));
    }

    function parseWeekdaysAny(raw: any): number[] | null {
      if (raw == null) return null;

      const collect: number[] = [];
      const push = (v: any) => {
        if (v == null) return;
        if (typeof v === "number" || (typeof v === "string" && v.trim().match(/^\d+$/))) {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 1 && n <= 7) collect.push(n);
          return;
        }
        const key = asString(v).trim().toLowerCase();
        if (!key) return;

        // ranges like "seg-sex" / "segunda a sexta"
        if (key.includes("-") || key.includes(" a ")) {
          const parts = key
            .replace(/\s+/g, " ")
            .replace("até", "a")
            .split(/-| a /)
            .map((s) => s.trim())
            .filter(Boolean);
          if (parts.length === 2) {
            const a = weekdayMap[parts[0]] ?? weekdayMap[parts[0].slice(0, 3)];
            const b = weekdayMap[parts[1]] ?? weekdayMap[parts[1].slice(0, 3)];
            if (a && b) {
              const start = Math.min(a, b);
              const end = Math.max(a, b);
              for (let i = start; i <= end; i++) collect.push(i);
              return;
            }
          }
        }

        // comma/semicolon separated
        const tokens = key.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        if (tokens.length > 1) {
          for (const t of tokens) push(t);
          return;
        }

        const wd = weekdayMap[key] ?? weekdayMap[key.slice(0, 3)] ?? null;
        if (wd) collect.push(wd);
      };

      if (Array.isArray(raw)) {
        for (const v of raw) push(v);
      } else {
        push(raw);
      }

      const out = uniq(collect).filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b);
      return out.length ? out : null;
    }

    function parsePeriodIndexesAny(raw: any): number[] {
      if (raw == null) return [];
      const out: number[] = [];
      const push = (v: any) => {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 1 && n <= 30) out.push(n);
      };

      // array => list
      if (Array.isArray(raw)) {
        for (const v of raw) push(v);
        return uniq(out).sort((a, b) => a - b);
      }

      // object range
      if (raw && typeof raw === "object") {
        const start = Number((raw as any).start ?? (raw as any).from ?? (raw as any).ini ?? (raw as any).begin);
        const end = Number((raw as any).end ?? (raw as any).to ?? (raw as any).fim ?? (raw as any).finish);
        if (Number.isFinite(start) && Number.isFinite(end) && start >= 1 && end >= start) {
          for (let i = start; i <= end && i <= 30; i++) out.push(i);
          return uniq(out).sort((a, b) => a - b);
        }
      }

      // string range "1-3" / "1..6" / "1 a 6"
      if (typeof raw === "string") {
        const s = raw.trim().toLowerCase();
        const m = s.match(/(\d+)\s*(?:-|\.\.|a|até)\s*(\d+)/);
        if (m) {
          const a = Number(m[1]);
          const b = Number(m[2]);
          if (Number.isFinite(a) && Number.isFinite(b) && a >= 1 && b >= a) {
            for (let i = a; i <= b && i <= 30; i++) out.push(i);
            return uniq(out).sort((a, b) => a - b);
          }
        }
        // comma separated
        if (s.includes(",") || s.includes(";")) {
          s.split(/[;,]/)
            .map((x) => x.trim())
            .filter(Boolean)
            .forEach((x) => push(x));
          return uniq(out).sort((a, b) => a - b);
        }
      }

      push(raw);
      return uniq(out).sort((a, b) => a - b);
    }

    function parseWeekdays(raw: any): number[] {
      const arr: number[] = Array.isArray(raw)
        ? raw
            .map((n: any) => Number(n))
            .filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 7)
        : [];
      const out = arr.length ? uniq(arr).sort((a, b) => a - b) : [1, 2, 3, 4, 5];
      return out;
    }

    function parsePeriods(raw: any, fallbackCount: number): number[] {
      if (Array.isArray(raw)) {
        const arr = raw.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 30);
        if (arr.length) return uniq(arr).sort((a, b) => a - b);
      }
      const start = Number(raw?.start ?? raw?.from ?? raw?.ini);
      const end = Number(raw?.end ?? raw?.to ?? raw?.fim);
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 1 && end >= start && end <= 30) {
        const out: number[] = [];
        for (let i = start; i <= end; i++) out.push(i);
        return out;
      }
      const count = Number(raw) || fallbackCount;
      const n = Number.isFinite(count) && count > 0 ? Math.min(30, count) : fallbackCount;
      const out: number[] = [];
      for (let i = 1; i <= n; i++) out.push(i);
      return out;
    }

    function normalizeAvailability(raw: any): any | null {
      if (!raw || typeof raw !== "object") return null;
      const out: any = {};
      for (const [k, v] of Object.entries(raw)) {
        const shift = normalizeShift(k);
        if (!shift) continue;
        if (!v || typeof v !== "object") continue;
        out[shift] ??= {};
        for (const [dayKey, periodsRaw] of Object.entries(v as any)) {
          const d = Number(dayKey);
          if (!Number.isFinite(d) || d < 1 || d > 7) continue;
          const periods = Array.isArray(periodsRaw)
            ? periodsRaw.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 30)
            : [];
          if (!periods.length) continue;
          out[shift][String(d)] = uniq(periods).sort((a, b) => a - b);
        }
      }
      return Object.keys(out).length ? out : null;
    }

    const fallbackShiftFromPlan = normalizeShift(
      (plan.buildSchedule as any)?.shift || (plan.classes?.[0] as any)?.shift || "MANHA",
    );

    for (const t of plan.teachers) {
      const name = asString((t as any).name).trim();
      if (!name) continue;

      const short_name = asString((t as any).short_name).trim() || null;
      const email = asString((t as any).email).trim() || null;
      const allow_interjornada_lt_11 = Boolean((t as any).allow_interjornada_lt_11);

      // --- Disciplinas
      const subject_ids: string[] = [];
      const subjects = (t as any).subjects ?? (t as any).disciplinas ?? (t as any).subject_ids ?? [];
      if (Array.isArray(subjects)) {
        for (const s of subjects) {
          const val = asString(typeof s === "object" ? (s as any)?.name : s).trim();
          if (!val) continue;
          if (val.includes("-")) subject_ids.push(val);
          else {
            const resolved = subjectNameToId.get(normalizeKey(val));
            if (resolved) subject_ids.push(resolved);
          }
        }
      }

      // --- Turmas
      const classNamesRaw = (t as any).classes ?? (t as any).turmas ?? (t as any).class ?? (t as any).turma ?? (t as any).class_ids;
      const classNames: string[] = Array.isArray(classNamesRaw)
        ? classNamesRaw.map((x: any) => asString(typeof x === "object" ? (x as any)?.name : x).trim()).filter(Boolean)
        : [asString(typeof classNamesRaw === "object" ? (classNamesRaw as any)?.name : classNamesRaw).trim()].filter(Boolean);
      const class_ids: string[] = [];
      for (const cn of classNames) {
        if (!cn) continue;
        if (cn.includes("-")) class_ids.push(cn);
        else {
          const resolved = classNameToId.get(normalizeKey(cn));
          if (resolved) class_ids.push(resolved);
        }
      }

      // --- Salas
      const roomNamesRaw = (t as any).rooms ?? (t as any).salas ?? (t as any).room ?? (t as any).sala ?? (t as any).room_ids;
      const roomNames: string[] = Array.isArray(roomNamesRaw)
        ? roomNamesRaw.map((x: any) => asString(typeof x === "object" ? (x as any)?.name : x).trim()).filter(Boolean)
        : [asString(typeof roomNamesRaw === "object" ? (roomNamesRaw as any)?.name : roomNamesRaw).trim()].filter(Boolean);
      const room_ids: string[] = [];
      for (const rn of roomNames) {
        if (!rn) continue;
        if (rn.includes("-")) room_ids.push(rn);
        else {
          const resolved = roomNameToId.get(normalizeKey(rn));
          if (resolved) room_ids.push(resolved);
        }
      }

      // --- Turnos
      const shiftsRaw = (t as any).shifts ?? (t as any).turnos ?? (t as any).shift ?? (t as any).turno;
      const shifts: string[] = Array.isArray(shiftsRaw)
        ? shiftsRaw.map((s: any) => normalizeShift(s)).filter(Boolean)
        : [normalizeShift(shiftsRaw)].filter(Boolean);

      if (shifts.length === 0) {
        const firstClassName = classNames[0] ? normalizeKey(classNames[0]) : "";
        const inferred = firstClassName ? classNameToShift.get(firstClassName) : null;
        shifts.push(inferred || fallbackShiftFromPlan || "MANHA");
      }

      // --- Disponibilidade
      // - Se vier em availability, respeitamos.
      // - Se vier em schedule (ex.: {"segunda":[1,2,3]}), convertemos.
      // - Senão, criamos automaticamente seg-sex e todos os períodos do turno.
      let available_weekdays = parseWeekdays((t as any).weekdays ?? (t as any).dias_semana);
      const schedule = (t as any).schedule;
      const periodsRaw =
        (t as any).periods ?? (t as any).periodos ?? (t as any).period_range ?? (t as any).periodRange ?? (t as any).periodCount;

      const availabilityFromRaw = normalizeAvailability((t as any).availability);
      let availability: any | null = availabilityFromRaw;

      if (!availability && schedule && typeof schedule === "object" && !Array.isArray(schedule)) {
        // Usa apenas o primeiro turno como base.
        const baseShift = shifts[0] ? normalizeShift(shifts[0]) : fallbackShiftFromPlan;
        availability = { [baseShift]: {} };
        const daySet = new Set<number>();
        for (const [k, v] of Object.entries(schedule)) {
          const key = asString(k).trim().toLowerCase();
          const wd = weekdayMap[key] ?? weekdayMap[key.slice(0, 3)] ?? null;
          if (!wd) continue;
          const p = Array.isArray(v)
            ? v.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n >= 1 && n <= 30)
            : [];
          if (!p.length) continue;
          availability[baseShift][String(wd)] = uniq(p).sort((a, b) => a - b);
          daySet.add(wd);
        }
        const days = Array.from(daySet).sort((a, b) => a - b);
        if (days.length) available_weekdays = days;
      }

      if (!availability) {
        const baseShift = shifts[0] ? normalizeShift(shifts[0]) : fallbackShiftFromPlan;
        const fallbackPeriods = defaultPeriodCountByShift.get(baseShift) ?? defaultPeriodCountByShift.get(fallbackShiftFromPlan) ?? 6;
        const periods = parsePeriods(periodsRaw, fallbackPeriods);

        availability = {};
        for (const s of shifts) {
          const sh = normalizeShift(s);
          if (!sh) continue;
          availability[sh] ??= {};
          for (const d of available_weekdays) {
            availability[sh][String(d)] = periods;
          }
        }
      }

      // --- Teaching rules (opcional)
      let teaching_rules: any = (t as any).teaching_rules;
      if (!Array.isArray(teaching_rules) && typeof teaching_rules === "string") {
        try {
          teaching_rules = JSON.parse(teaching_rules);
        } catch {
          teaching_rules = [];
        }
      }
      if (!Array.isArray(teaching_rules)) teaching_rules = [];

      // --- Habilitações por horário (combinação Disciplina + Sala + Turno + Período + Turma)
      // Aceita formatos:
      // - rulesByName: [{ subject, room, class, shift, period_index, weekdays }]
      // - habilitacoes/habilitações/horarios: [{ disciplina, sala, turma, turno, periodos, dias }]
      // O backend resolve nomes -> IDs.

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

      const habilRaw =
        (t as any).habilitacoes ??
        (t as any)["habilitações"] ??
        (t as any).habilitacao ??
        (t as any).habilitations ??
        (t as any).allocations ??
        (t as any).horarios ??
        (t as any)["horário"] ??
        (t as any).horarios_por_professor ??
        null;

      const habilArr: any[] = Array.isArray(habilRaw) ? habilRaw : [];
      for (const h of habilArr) {
        if (!h || typeof h !== "object") continue;
        const subjectName = asString((h as any).subject ?? (h as any).disciplina ?? (h as any).discipline).trim();
        const roomName = asString((h as any).room ?? (h as any).sala).trim();
        const className = asString((h as any).class ?? (h as any).turma).trim();

        const sid = subjectNameToId.get(normalizeKey(subjectName));
        const rid = roomNameToId.get(normalizeKey(roomName));
        const cid = classNameToId.get(normalizeKey(className));
        if (!sid || !rid || !cid) continue;

        const inferredShift = classNameToShift.get(normalizeKey(className)) ?? null;
        const shift = normalizeShift(
          (h as any).shift ?? (h as any).turno ?? inferredShift ?? shifts?.[0] ?? fallbackShiftFromPlan,
        );

        const weekdays =
          parseWeekdaysAny((h as any).weekdays ?? (h as any).dias ?? (h as any).dia ?? (h as any).weekday) ?? null;

        const periods = parsePeriodIndexesAny(
          (h as any).periods ??
            (h as any).periodos ??
            (h as any)["períodos"] ??
            (h as any).periodo ??
            (h as any)["período"] ??
            (h as any).period_index ??
            (h as any).periodIndex,
        );
        if (periods.length === 0) continue;

        for (const p of periods) {
          teaching_rules.push({ subject_id: sid, room_id: rid, class_id: cid, shift, period_index: p, weekdays });
        }
      }

      // Dedup de habilitações no professor
      if (Array.isArray(teaching_rules) && teaching_rules.length) {
        const seen = new Set<string>();
        const cleaned: any[] = [];
        for (const r of teaching_rules) {
          if (!r || typeof r !== "object") continue;
          const sid = asString((r as any).subject_id).trim();
          const rid = asString((r as any).room_id).trim();
          const cid = asString((r as any).class_id).trim();
          const sh = normalizeShift((r as any).shift);
          const p = Number((r as any).period_index);
          if (!sid || !rid || !cid || !sh || !Number.isFinite(p) || p < 1) continue;
          const w = (r as any).weekdays;
          const wKey =
            Array.isArray(w) && w.length
              ? uniq(w.map((n: any) => Number(n)).filter(Boolean))
                  .sort((a, b) => a - b)
                  .join(",")
              : "*";
          const key = `${sid}|${rid}|${cid}|${sh}|${p}|${wKey}`;
          if (seen.has(key)) continue;
          seen.add(key);
          cleaned.push({
            subject_id: sid,
            room_id: rid,
            class_id: cid,
            shift: sh,
            period_index: p,
            weekdays:
              Array.isArray(w) && w.length
                ? uniq(w.map((n: any) => Number(n)).filter(Boolean)).sort((a, b) => a - b)
                : null,
          });
        }
        teaching_rules = cleaned;
      }

      const hasRules = Array.isArray(teaching_rules) && teaching_rules.length > 0;
      const derived = hasRules ? deriveLegacyFieldsFromTeachingRules((teaching_rules as any[]) ?? []) : null;

      // Importante: quando NÃO há rules, precisamos garantir que os campos legados estejam preenchidos
      // (para a tela de Professores e para o gerador de grade).
      const payload: any = {
        school_id: schoolId,
        name,
        short_name,
        email,
        allow_interjornada_lt_11,
        teaching_rules: hasRules ? teaching_rules : [],

        shifts: derived?.shifts ?? shifts,
        availability: derived ? derived.availability : availability,
        available_weekdays: derived?.available_weekdays ?? available_weekdays,
        subject_id: derived?.subject_id ?? (subject_ids.length === 1 ? subject_ids[0] : null),
        default_room_id: derived?.default_room_id ?? (room_ids.length === 1 ? room_ids[0] : null),
        subject_ids: derived?.subject_ids ?? uniq(subject_ids),
        room_ids: derived?.room_ids ?? uniq(room_ids),
        class_ids: derived?.class_ids ?? uniq(class_ids),
      };

      if ((payload.subject_ids ?? []).length === 0) {
        warnings.push(`Professor '${name}': disciplinas não informadas; a grade pode ficar incompleta.`);
      }

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
    revalidatePath("/director/matriz-curricular");
    revalidatePath("/director/parametros-grade");
  } catch {
    // ignore
  }

  // 6) Montagem de grade
  // Não disparamos o gerador automaticamente aqui: isso evita erros no chat e mantém o fluxo oficial no menu.
  if (plan.buildSchedule) {
    const shift = normalizeShift(plan.buildSchedule?.shift);
    warnings.push(
      `Cadastros concluídos. Para gerar a grade do turno ${shift || "MANHA"}, acesse no menu principal: Montar Grade.`
    );
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

Objetivo: permitir cadastros avulsos ou completos no sistema. Se o usuário pedir apenas uma coisa, foque apenas nessa coisa. Se ele pedir um fluxo completo, guie etapa por etapa.

Regras:
- Sempre trabalhe em português (Brasil).
- Se o pedido for específico (ex.: "cadastre a disciplina Matemática"), NÃO peça dados de áreas não relacionadas.
- Se faltarem dados para aquele cadastro específico, faça perguntas objetivas e curtas.
- Antes de executar qualquer cadastro, confirme um "plano" resumido do que será criado.
- Quando o usuário confirmar, devolva somente o JSON do plano em bloco de código.
- Nunca diga que montou a grade se ainda faltarem professores/habilitações.

Como decidir o que coletar:
1) Disciplinas: basta o nome (e short_name se o usuário informar).
2) Salas: basta o nome.
3) Turmas: nome + turno.
4) Horários/time slots: turno, dias da semana, quantidade de períodos, duração em minutos e horário inicial.
5) Matriz curricular / distribuição de disciplinas por turma (antes dos professores):
   - Colete turma + disciplina + aulas por semana.
   - Isso pode ser cadastrado mesmo sem professores definidos.
   - Use isso quando o usuário quiser "distribuir disciplinas por turma", "montar a matriz" ou definir a carga semanal por disciplina.
6) Professores:
   - Só são necessários quando o usuário pedir cadastro de professores ou quiser montar a grade automática.
   - Para montar a grade automaticamente, as HABILITAÇÕES POR HORÁRIO são obrigatórias.
   - Cada habilitação é uma combinação: disciplina + sala + turma + turno + período (+ dia da semana).
   - Exemplo: "João dá Matemática na Sala 1 para a Turma 7ºA na 2ª feira no 1º período da manhã".
   - Se o usuário não detalhar dias, pergunte. Se ele realmente quiser "seg-sex", então use weekdays [1,2,3,4,5].
7) BuildSchedule só deve ser incluído se o usuário pedir explicitamente para montar/gerar a grade.

Formato de resposta:
- Responda com instruções claras.
- Quando possível, termine com uma lista curta de perguntas faltantes.

IMPORTANTE: nesta versão, você NÃO deve fingir que executou ações.
Quando o usuário confirmar, responda com um JSON em um bloco de código contendo apenas as chaves necessárias para o pedido. Exemplo completo:
{
  "action": "apply",
  "subjects": [{"name":"Matemática"}],
  "rooms": [{"name":"Sala 1"}],
  "classes": [{"name":"Turma A","shift":"MANHÃ"}],
  "timeSlots": {...},
  "curriculumMatrix": [
    {"class":"Turma A","subject":"Matemática","lessons_per_week":5},
    {"class":"Turma A","subject":"Português","lessons_per_week":4}
  ],
  "teachers": [
    {
      "name": "Nome do Professor",
      "email": "opcional",
      "rulesByName": [
        {"subject":"Matemática","class":"Turma A","room":"Sala 1","shift":"MANHÃ","weekdays":[1],"period_index":1},
        {"subject":"Matemática","class":"Turma A","room":"Sala 1","shift":"MANHÃ","weekdays":[3],"period_index":2}
      ]
    }
  ],
  "buildSchedule": {"shift":"MANHÃ"}
}

Exemplos de pedidos específicos:
- Se o pedido for apenas uma disciplina, devolva só: {"action":"apply","subjects":[{"name":"Matemática"}]}
- Se o pedido for apenas uma turma, devolva só a chave "classes".
- Se o pedido for apenas matriz curricular, devolva só a chave "curriculumMatrix" (e crie também subjects/classes apenas se o usuário pedir isso junto).

Notas importantes sobre o formato:
- Para subjects/rooms/classes, use sempre OBJETOS com a chave "name" (não use apenas strings).
- Para curriculumMatrix, prefira usar nomes legíveis: "class", "subject" e "lessons_per_week".
- Para professores, prefira usar "rulesByName" (habilitações por horário). O backend resolve nomes -> IDs.

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
