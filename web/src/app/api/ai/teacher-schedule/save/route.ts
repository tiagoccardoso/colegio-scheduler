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

type ReqBody = {
  teacherId: string;
  criteria?: string;
  teaching_rules?: TeachingRule[];
};

type RefRow = { id: string; name: string | null; shift?: string | null; default_room_id?: string | null };

function normalizeShift(v: any): Shift | null {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return null;
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return (["MANHA", "TARDE", "NOITE"] as any).includes(key) ? (key as Shift) : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const teacherId = String(body?.teacherId ?? "").trim();
    const criteria = String(body?.criteria ?? "").trim();

    if (!teacherId) return NextResponse.json({ error: "teacherId obrigatório." }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("school_id, role").eq("user_id", user.id).maybeSingle();
    if (!profile || !isStaffRole((profile as any).role)) {
      return NextResponse.json({ error: "Apenas equipe pode salvar horários." }, { status: 403 });
    }
    const schoolId = String((profile as any).school_id);

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id,default_room_id")
      .eq("id", teacherId)
      .eq("school_id", schoolId)
      .maybeSingle();
    if (!teacher) return NextResponse.json({ error: "Professor não encontrado." }, { status: 404 });

    const [{ data: subjects }, { data: rooms }, { data: classes }] = await Promise.all([
      supabase.from("subjects").select("id,name").eq("school_id", schoolId),
      supabase.from("rooms").select("id,name").eq("school_id", schoolId),
      supabase.from("classes").select("id,name,shift,default_room_id").eq("school_id", schoolId),
    ]);

    const subjIds = new Set(((subjects as RefRow[]) ?? []).map((s) => s.id));
    const roomIds = new Set(((rooms as RefRow[]) ?? []).map((r) => r.id));
    const classesArr = ((classes as RefRow[]) ?? []);
    const classById = new Map(classesArr.map((c) => [c.id, c]));
    const anyRoom = (rooms as RefRow[] | null)?.[0]?.id ?? null;
    const teacherDefaultRoom = String((teacher as any).default_room_id ?? "").trim();

    const rawRules = Array.isArray(body?.teaching_rules) ? body.teaching_rules : [];
    const errors: string[] = [];
    const used = new Set<string>();
    const cleaned: TeachingRule[] = [];

    for (const item of rawRules) {
      const subject_id = String((item as any).subject_id ?? "").trim();
      const class_id = String((item as any).class_id ?? "").trim();
      let room_id = String((item as any).room_id ?? "").trim();
      const shift = normalizeShift((item as any).shift);
      const period_index = Number((item as any).period_index);
      const weekdaysRaw = Array.isArray((item as any).weekdays) ? (item as any).weekdays.map((n: any) => Number(n)) : [];
      const weekday = weekdaysRaw.length ? Number(weekdaysRaw[0]) : NaN;

      if (!subject_id || !subjIds.has(subject_id)) {
        errors.push("Disciplina inválida em um dos itens.");
        continue;
      }
      if (!class_id || !classById.has(class_id)) {
        errors.push("Turma inválida em um dos itens.");
        continue;
      }
      if (!shift) {
        errors.push("Turno inválido em um dos itens.");
        continue;
      }
      if (!Number.isFinite(period_index) || period_index < 1 || period_index > 6) {
        errors.push("Período inválido em um dos itens.");
        continue;
      }
      if (!Number.isFinite(weekday) || weekday < 1 || weekday > 5) {
        errors.push("Dia da semana inválido em um dos itens.");
        continue;
      }

      const cls = classById.get(class_id)!;
      const clsShift = normalizeShift((cls as any).shift);
      if (clsShift && clsShift !== shift) {
        errors.push(`Turma ${cls.name ?? class_id} não pertence ao turno ${shift}.`);
        continue;
      }

      if (!room_id || !roomIds.has(room_id)) {
        const clsDefault = String((cls as any).default_room_id ?? "").trim();
        if (clsDefault && roomIds.has(clsDefault)) room_id = clsDefault;
        else if (teacherDefaultRoom && roomIds.has(teacherDefaultRoom)) room_id = teacherDefaultRoom;
        else if (anyRoom) room_id = anyRoom;
      }

      if (!room_id || !roomIds.has(room_id)) {
        errors.push("Sala inválida em um dos itens.");
        continue;
      }

      const key = `${shift}:${period_index}:${weekday}`;
      if (used.has(key)) {
        errors.push("Existe mais de uma aula no mesmo dia/turno/período.");
        continue;
      }
      used.add(key);

      cleaned.push({
        subject_id,
        class_id,
        room_id,
        shift,
        period_index,
        weekdays: [weekday],
      });
    }

    if (errors.length) {
      // evita lista infinita repetida
      const unique = Array.from(new Set(errors)).slice(0, 8);
      return NextResponse.json({ error: unique.join(" ") }, { status: 400 });
    }

    // Regra de cadastro: precisa ter pelo menos uma turma (via regras) OU critérios preenchidos
    if (cleaned.length === 0 && !criteria) {
      return NextResponse.json({ error: "Informe pelo menos uma turma vinculada (aulas na grade) ou preencha o campo Critérios." }, { status: 400 });
    }

    const derived = deriveLegacyFieldsFromTeachingRules(cleaned as any);

    const { error: upErr } = await supabase
      .from("teachers")
      .update({
        restrictions: criteria || null,
        teaching_rules: cleaned as any,
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
      return NextResponse.json({ error: upErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, msg: "Horários do professor salvos." });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
