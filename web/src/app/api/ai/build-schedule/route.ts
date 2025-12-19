import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateNoConflicts } from "@/lib/schedule/validate";

type ReqBody = {
  classId: string;
  overwrite?: boolean;
};

const WEEKDAY_LABEL: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
};

async function requireDirectorApi() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return { ok: false as const, status: 401 as const, message: "Não autenticado." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, school_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "director") {
    return { ok: false as const, status: 403 as const, message: "Sem permissão." };
  }

  return { ok: true as const, supabase, profile };
}

function includesOrNoRule<T>(arr: T[] | null | undefined, value: T) {
  const a = (arr ?? []) as T[];
  return a.length === 0 || a.includes(value);
}

export async function POST(req: Request) {
  if (process.env.AI_SCHEDULER_ENABLED !== "true") {
    return NextResponse.json({ error: "AI_SCHEDULER_ENABLED=false" }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY não configurada" }, { status: 400 });
  }

  const auth = await requireDirectorApi();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: ReqBody | null = null;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    body = null;
  }

  const classId = String(body?.classId ?? "");
  const overwrite = Boolean(body?.overwrite);
  if (!classId) {
    return NextResponse.json({ error: "classId é obrigatório" }, { status: 400 });
  }

  const { supabase, profile } = auth;

  const { data: cls } = await supabase.from("classes").select("id,name,shift").eq("id", classId).maybeSingle();
  if (!cls) return NextResponse.json({ error: "Turma inválida." }, { status: 400 });

  // Time slots (Seg–Sex)
  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("id,weekday,starts_at,ends_at")
    .eq("school_id", profile.school_id)
    .in("weekday", [1, 2, 3, 4, 5])
    .order("weekday", { ascending: true })
    .order("starts_at", { ascending: true });

  const slotList = (timeSlots as any[] | null) ?? [];
  if (slotList.length === 0) {
    return NextResponse.json({ error: "Cadastre horários (Seg–Sex) antes de gerar a grade." }, { status: 400 });
  }

  // Existing schedules
  const timeSlotIds = slotList.map((s) => s.id);
  const { data: allSched } = await supabase
    .from("schedules")
    .select("id,class_id,time_slot_id,teacher_id,room_id,subject_id")
    .in("time_slot_id", timeSlotIds);

  const schedules = (allSched as any[] | null) ?? [];
  const classSchedules = schedules.filter((s) => s.class_id === classId);
  const classBySlot = new Map<string, any>();
  classSchedules.forEach((s) => classBySlot.set(s.time_slot_id, s));

  // Catalogs
  const { data: subjects } = await supabase.from("subjects").select("id,name").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: rooms } = await supabase.from("rooms").select("id,name").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id,name,subject_ids,class_ids,room_ids,available_weekdays,restrictions")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const teacherList = (teachers as any[] | null) ?? [];
  const subjectList = (subjects as any[] | null) ?? [];
  const roomList = (rooms as any[] | null) ?? [];

  const teacherById = new Map<string, any>(teacherList.map((t) => [t.id, t]));

  // Candidates by time slot
  const candidates = slotList
    .filter((slot) => overwrite || !classBySlot.has(slot.id))
    .map((slot) => {
      const busyTeacherIds = new Set(
        schedules
          .filter((s) => s.time_slot_id === slot.id && s.teacher_id)
          .map((s) => s.teacher_id),
      );
      const busyRoomIds = new Set(
        schedules
          .filter((s) => s.time_slot_id === slot.id && s.room_id)
          .map((s) => s.room_id),
      );

      const freeTeachers = teacherList
        .filter((t) => !busyTeacherIds.has(t.id))
        .filter((t) => includesOrNoRule((t.available_weekdays ?? []) as number[], slot.weekday))
        .filter((t) => includesOrNoRule((t.class_ids ?? []) as string[], classId))
        .map((t) => ({
          id: t.id,
          name: t.name,
          subject_ids: (t.subject_ids ?? []) as string[],
          room_ids: (t.room_ids ?? []) as string[],
          restrictions: t.restrictions ?? null,
        }));

      const freeRooms = roomList.filter((r) => !busyRoomIds.has(r.id)).map((r) => ({ id: r.id, name: r.name }));

      return {
        id: slot.id,
        weekday: slot.weekday,
        weekdayName: WEEKDAY_LABEL?.[slot.weekday] ?? "Dia",
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        freeTeachers,
        freeRooms,
      };
    });

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      summary: overwrite
        ? "Não há horários disponíveis para gerar (verifique seus horários)."
        : "Esta turma já está totalmente preenchida (ou habilite sobrescrever).",
      applied: 0,
      skipped: [],
      warnings: [],
    });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const prompt = {
    goal:
      "Gerar uma grade completa (ou completar a grade) para uma turma, escolhendo professor/disciplinas sem conflitos.",
    hard_rules: [
      "Um professor não pode estar em duas turmas no mesmo horário.",
      "Uma sala não pode ser usada por duas turmas no mesmo horário.",
      "Um professor só pode ser alocado em dias que estejam em available_weekdays.",
      "Se o professor tiver class_ids preenchido, só pode dar aula nessas turmas.",
      "Se o professor tiver subject_ids preenchido, só pode dar essas disciplinas.",
      "Se o professor tiver room_ids preenchido, só pode usar essas salas.",
    ],
    soft_rules: [
      "Evite repetir a mesma disciplina muitas vezes seguidas no mesmo dia.",
      "Tente distribuir as disciplinas de forma balanceada na semana.",
      "Respeite as restrições textuais do professor quando possível.",
    ],
    context: {
      class: cls,
      overwrite,
      subjects: subjectList,
      rooms: roomList,
      slots_to_fill: candidates,
    },
    output_schema: {
      summary: "string",
      assignments: [
        {
          timeSlotId: "string",
          teacherId: "string",
          subjectId: "string",
          roomId: "string|null",
        },
      ],
      warnings: ["string"],
    },
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente de coordenação pedagógica. Responda APENAS com JSON válido no formato pedido.",
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return NextResponse.json({ error: "Falha ao chamar OpenAI", details: text.slice(0, 2000) }, { status: 502 });
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";

  let parsed: any = { summary: "", assignments: [], warnings: [] };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { summary: content, assignments: [], warnings: ["Resposta não estava em JSON."] };
  }

  const skipped: { timeSlotId?: string; reason: string }[] = [];
  let applied = 0;

  // We'll keep local busy sets updated while applying
  const busyTeacherBySlot = new Map<string, Set<string>>();
  const busyRoomBySlot = new Map<string, Set<string>>();

  for (const s of schedules) {
    if (s.teacher_id) {
      if (!busyTeacherBySlot.has(s.time_slot_id)) busyTeacherBySlot.set(s.time_slot_id, new Set());
      busyTeacherBySlot.get(s.time_slot_id)!.add(s.teacher_id);
    }
    if (s.room_id) {
      if (!busyRoomBySlot.has(s.time_slot_id)) busyRoomBySlot.set(s.time_slot_id, new Set());
      busyRoomBySlot.get(s.time_slot_id)!.add(s.room_id);
    }
  }

  const slotSet = new Set(slotList.map((s) => s.id));

  for (const a of (parsed?.assignments ?? []) as any[]) {
    const time_slot_id = String(a?.timeSlotId ?? "");
    const teacher_id = String(a?.teacherId ?? "");
    const subject_id = String(a?.subjectId ?? "");
    const room_id_raw = a?.roomId;
    const room_id = room_id_raw ? String(room_id_raw) : null;

    if (!time_slot_id || !teacher_id || !subject_id) {
      skipped.push({ reason: "Assignment incompleto (faltando timeSlotId/teacherId/subjectId)." });
      continue;
    }

    if (!slotSet.has(time_slot_id)) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Horário inválido na resposta da IA." });
      continue;
    }

    if (!overwrite && classBySlot.has(time_slot_id)) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Já existe aula nesse horário (sobrescrever desativado)." });
      continue;
    }

    const slot = slotList.find((s) => s.id === time_slot_id);
    if (!slot) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Horário não encontrado." });
      continue;
    }

    const teacher = teacherById.get(teacher_id);
    if (!teacher) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Professor inválido." });
      continue;
    }

    if (!includesOrNoRule((teacher.available_weekdays ?? []) as number[], slot.weekday)) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Professor indisponível nesse dia da semana." });
      continue;
    }
    if (!includesOrNoRule((teacher.class_ids ?? []) as string[], classId)) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Professor não está habilitado para esta turma." });
      continue;
    }
    if (!includesOrNoRule((teacher.subject_ids ?? []) as string[], subject_id)) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Professor não está habilitado para esta disciplina." });
      continue;
    }
    if (room_id && !includesOrNoRule((teacher.room_ids ?? []) as string[], room_id)) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Professor não está habilitado para esta sala." });
      continue;
    }

    const busyTeachers = busyTeacherBySlot.get(time_slot_id) ?? new Set<string>();
    if (busyTeachers.has(teacher_id)) {
      skipped.push({ timeSlotId: time_slot_id, reason: "Conflito: professor já ocupado nesse horário." });
      continue;
    }

    if (room_id) {
      const busyRooms = busyRoomBySlot.get(time_slot_id) ?? new Set<string>();
      if (busyRooms.has(room_id)) {
        skipped.push({ timeSlotId: time_slot_id, reason: "Conflito: sala já ocupada nesse horário." });
        continue;
      }
    }

    const conflict = await validateNoConflicts({ supabase, class_id: classId, time_slot_id, teacher_id, room_id });
    if (conflict) {
      skipped.push({ timeSlotId: time_slot_id, reason: conflict.message });
      continue;
    }

    const existing = classBySlot.get(time_slot_id);
    const result = existing?.id
      ? await supabase.from("schedules").update({ subject_id, teacher_id, room_id }).eq("id", existing.id)
      : await supabase.from("schedules").insert({
          school_id: profile.school_id,
          class_id: classId,
          time_slot_id,
          subject_id,
          teacher_id,
          room_id,
        });

    if (result.error) {
      skipped.push({ timeSlotId: time_slot_id, reason: result.error.message });
      continue;
    }

    // mark busy
    if (!busyTeacherBySlot.has(time_slot_id)) busyTeacherBySlot.set(time_slot_id, new Set());
    busyTeacherBySlot.get(time_slot_id)!.add(teacher_id);
    if (room_id) {
      if (!busyRoomBySlot.has(time_slot_id)) busyRoomBySlot.set(time_slot_id, new Set());
      busyRoomBySlot.get(time_slot_id)!.add(room_id);
    }
    applied += 1;
  }

  return NextResponse.json({
    ok: true,
    summary: parsed?.summary ?? "",
    applied,
    skipped,
    warnings: parsed?.warnings ?? [],
  });
}
