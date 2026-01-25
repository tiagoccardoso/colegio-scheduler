import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/authz";
import { deriveLegacyFieldsFromTeachingRules } from "@/lib/schedule/teaching-rules";

type Shift = "MANHA" | "TARDE" | "NOITE";

type TeachingRule = {
  subject_id: string;
  room_id: string;
  class_id: string;
  shift: Shift;
  period_index: number;
  weekdays: number[]; // 1 item (1..5)
};

type Action = {
  type: "move_rule" | "delete_rule" | "note";
  teacher_id: string;
  match: {
    class_id: string;
    subject_id: string;
    room_id: string;
    shift: string;
    period_index: number;
    weekday: number;
  };
  to: { weekday: number; period_index: number };
  note: string;
};

type ReqBody = {
  actions?: Action[] | null;
};

function normalizeShift(v: any): Shift | null {
  const k = String(v ?? "").trim().toUpperCase();
  if (!k) return null;
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return (["MANHA", "TARDE", "NOITE"] as any).includes(k) ? (k as Shift) : null;
}

function clampInt(n: any, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

function atomicize(raw: any): TeachingRule[] {
  const out: TeachingRule[] = [];
  if (!Array.isArray(raw)) return out;
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const subject_id = String((r as any).subject_id ?? "").trim();
    const class_id = String((r as any).class_id ?? "").trim();
    const room_id = String((r as any).room_id ?? "").trim();
    const shift = normalizeShift((r as any).shift);
    const period_index = clampInt((r as any).period_index, 1, 12);
    if (!subject_id || !class_id || !room_id || !shift) continue;

    const weekdaysRaw = Array.isArray((r as any).weekdays) ? (r as any).weekdays.map((n: any) => Number(n)) : [];
    const weekdays = weekdaysRaw.filter((d: number) => Number.isFinite(d) && d >= 1 && d <= 5);
    const days = weekdays.length ? weekdays : [1, 2, 3, 4, 5];
    for (const wd of days) {
      out.push({ subject_id, class_id, room_id, shift, period_index, weekdays: [wd] });
    }
  }
  return out;
}

function ruleKey(r: TeachingRule) {
  return `${r.shift}:${r.period_index}:${r.weekdays?.[0] ?? 0}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const actions = Array.isArray(body?.actions) ? body.actions : [];

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

    const byTeacher = new Map<string, Action[]>();
    for (const a of actions) {
      const teacherId = String((a as any)?.teacher_id ?? "").trim();
      if (!teacherId) continue;
      if (!byTeacher.has(teacherId)) byTeacher.set(teacherId, []);
      byTeacher.get(teacherId)!.push(a);
    }

    const warnings: string[] = [];
    const applied: { teacher_id: string; changed: number }[] = [];

    for (const [teacherId, items] of byTeacher.entries()) {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id,teaching_rules")
        .eq("id", teacherId)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (!teacher) {
        warnings.push(`Professor não encontrado: ${teacherId}.`);
        continue;
      }

      const rules = atomicize((teacher as any).teaching_rules);
      const used = new Set<string>();
      const dedup: TeachingRule[] = [];
      for (const r of rules) {
        const k = ruleKey(r);
        if (used.has(k)) continue;
        used.add(k);
        dedup.push(r);
      }

      let changed = 0;

      function findIndex(m: any) {
        const cls = String(m?.class_id ?? "").trim();
        const subj = String(m?.subject_id ?? "").trim();
        const room = String(m?.room_id ?? "").trim();
        const sh = normalizeShift(m?.shift) ?? null;
        const p = clampInt(m?.period_index, 1, 12);
        const wd = clampInt(m?.weekday, 1, 5);
        if (!cls || !subj || !room || !sh) return -1;
        return dedup.findIndex(
          (r) =>
            r.class_id === cls &&
            r.subject_id === subj &&
            r.room_id === room &&
            r.shift === sh &&
            r.period_index === p &&
            Number(r.weekdays?.[0] ?? 0) === wd,
        );
      }

      for (const a of items) {
        const type = String((a as any)?.type ?? "");
        if (type === "note") continue;
        const idx = findIndex((a as any)?.match);
        if (idx < 0) {
          warnings.push(`Não encontrei a regra para aplicar ação (${type}) no professor ${teacherId}.`);
          continue;
        }

        if (type === "delete_rule") {
          dedup.splice(idx, 1);
          changed += 1;
          continue;
        }

        if (type === "move_rule") {
          const toWd = clampInt((a as any)?.to?.weekday, 1, 5);
          const toP = clampInt((a as any)?.to?.period_index, 1, 12);
          if (!toWd || !toP) {
            warnings.push(`Ação inválida (move_rule) no professor ${teacherId}: destino inválido.`);
            continue;
          }
          const r = dedup[idx];
          const next: TeachingRule = { ...r, period_index: toP, weekdays: [toWd] };

          // Evita duplicar slot no mesmo professor
          const exists = dedup.some((x, j) => j !== idx && ruleKey(x) === ruleKey(next));
          if (exists) {
            warnings.push(`Move ignorado: já existe regra no mesmo slot (${ruleKey(next)}) para o professor ${teacherId}.`);
            continue;
          }
          dedup[idx] = next;
          changed += 1;
          continue;
        }
      }

      if (changed === 0) continue;

      const derived = deriveLegacyFieldsFromTeachingRules(dedup as any);

      const { error: upErr } = await supabase
        .from("teachers")
        .update({
          teaching_rules: dedup as any,
          shifts: derived.shifts,
          availability: derived.availability,
          available_weekdays: derived.available_weekdays,
          subject_id: derived.subject_id,
          default_room_id: derived.default_room_id,
          subject_ids: derived.subject_ids,
          room_ids: derived.room_ids,
          class_ids: derived.class_ids,
        })
        .eq("id", teacherId)
        .eq("school_id", schoolId);

      if (upErr) {
        warnings.push(`Falha ao salvar regras do professor ${teacherId}: ${upErr.message}`);
        continue;
      }

      applied.push({ teacher_id: teacherId, changed });
    }

    return NextResponse.json({ ok: true, applied, warnings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
