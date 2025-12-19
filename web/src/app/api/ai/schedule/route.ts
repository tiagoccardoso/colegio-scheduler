import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ReqBody = {
  classId: string;
  timeSlotId: string;
  subjectId?: string;
  teacherId?: string;
  roomId?: string | null;
};

function includesOrNoRule<T>(arr: T[] | null | undefined, value: T) {
  const a = (arr ?? []) as T[];
  return a.length === 0 || a.includes(value);
}

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

export async function POST(req: Request) {
  if (process.env.AI_SCHEDULER_ENABLED !== "true") {
    return NextResponse.json(
      { error: "AI_SCHEDULER_ENABLED=false" },
      { status: 403 },
    );
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

  if (!body?.classId || !body?.timeSlotId) {
    return NextResponse.json({ error: "classId e timeSlotId são obrigatórios" }, { status: 400 });
  }

  const { supabase } = auth;
  const { classId, timeSlotId, subjectId, teacherId, roomId } = body;

  // Load core context
  const { data: cls } = await supabase
    .from("classes")
    .select("id,name,shift")
    .eq("id", classId)
    .maybeSingle();

  const { data: slot } = await supabase
    .from("time_slots")
    .select("id,weekday,starts_at,ends_at")
    .eq("id", timeSlotId)
    .maybeSingle();

  if (!cls || !slot) {
    return NextResponse.json({ error: "Turma ou horário inválido." }, { status: 400 });
  }

  // Busy teachers / rooms in the chosen slot
  const { data: busyTeachers } = await supabase
    .from("schedules")
    .select("teacher_id")
    .eq("time_slot_id", timeSlotId)
    .not("teacher_id", "is", null);

  const busyTeacherIds = new Set(
    (busyTeachers as any[] | null)?.map((r) => r.teacher_id).filter(Boolean) ?? [],
  );

  const { data: allTeachers } = await supabase
    .from("teachers")
    .select("id,name,subject_ids,class_ids,room_ids,available_weekdays,restrictions")
    .eq("school_id", auth.profile.school_id)
    .order("name", { ascending: true });

  const freeTeachers = ((allTeachers as any[] | null) ?? [])
    .filter((t) => !busyTeacherIds.has(t.id))
    .filter((t) => includesOrNoRule((t.available_weekdays ?? []) as number[], slot.weekday))
    .filter((t) => includesOrNoRule((t.class_ids ?? []) as string[], classId))
    .filter((t) => (subjectId ? includesOrNoRule((t.subject_ids ?? []) as string[], subjectId) : true))
    .filter((t) => (roomId ? includesOrNoRule((t.room_ids ?? []) as string[], roomId) : true))
    .map((t) => ({
      id: t.id,
      name: t.name,
      subject_ids: (t.subject_ids ?? []) as string[],
      class_ids: (t.class_ids ?? []) as string[],
      room_ids: (t.room_ids ?? []) as string[],
      available_weekdays: (t.available_weekdays ?? []) as number[],
      restrictions: t.restrictions ?? null,
    }));

  const { data: busyRooms } = await supabase
    .from("schedules")
    .select("room_id")
    .eq("time_slot_id", timeSlotId)
    .not("room_id", "is", null);

  const busyRoomIds = new Set((busyRooms as any[] | null)?.map((r) => r.room_id).filter(Boolean) ?? []);

  const { data: allRooms } = await supabase
    .from("rooms")
    .select("id,name")
    .eq("school_id", auth.profile.school_id)
    .order("name", { ascending: true });
  const freeRooms = (allRooms as any[] | null)?.filter((r) => !busyRoomIds.has(r.id)) ?? [];

  // Class schedule for the same weekday (helps explain conflicts and options)
  const { data: classDaySched } = await supabase
    .from("schedules")
    .select(
      "time_slot:time_slots(weekday,starts_at,ends_at), subject:subjects(name), teacher:teachers(name), room:rooms(name)",
    )
    .eq("class_id", classId);

  const classDay = (classDaySched as any[] | null)?.filter((r) => r.time_slot?.weekday === slot.weekday) ?? [];

  // Teacher schedule for the same weekday (if teacherId provided)
  let teacherDay: any[] = [];
  if (teacherId) {
    const { data: teacherSched } = await supabase
      .from("schedules")
      .select(
        "time_slot:time_slots(weekday,starts_at,ends_at), class:classes(name), subject:subjects(name), room:rooms(name)",
      )
      .eq("teacher_id", teacherId);

    teacherDay = (teacherSched as any[] | null)?.filter((r) => r.time_slot?.weekday === slot.weekday) ?? [];
  }

  const weekdayName = WEEKDAY_LABEL?.[slot.weekday as number] ?? "Dia";

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const prompt = {
    goal:
      "Sugerir a melhor decisão para montar/ajustar a grade escolar sem conflitos de professor e sala.",
    hard_rules: [
      "Um professor não pode estar em duas turmas no mesmo horário.",
      "Uma sala não pode ser usada por duas turmas no mesmo horário.",
      "Uma turma tem no máximo uma aula por horário.",
      "Um professor só pode ser alocado nos dias marcados em available_weekdays.",
      "Se o professor tiver subject_ids preenchido, só pode dar essas disciplinas.",
      "Se o professor tiver class_ids preenchido, só pode dar aula nessas turmas.",
      "Se o professor tiver room_ids preenchido, só pode usar essas salas.",
    ],
    context: {
      class: cls,
      slot: {
        id: slot.id,
        weekday: slot.weekday,
        weekdayName,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
      },
      desired: {
        subjectId: subjectId ?? null,
        teacherId: teacherId ?? null,
        roomId: roomId ?? null,
      },
      availability: {
        freeTeachers,
        freeRooms,
      },
      current: {
        classDay,
        teacherDay,
      },
    },
    output_schema: {
      summary: "string",
      suggestions: [
        {
          title: "string",
          type: "PLACE|MOVE|SWAP",
          proposed: {
            timeSlotId: "string|null",
            teacherId: "string|null",
            roomId: "string|null",
          },
          reason: "string",
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
      temperature: 0.2,
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
    return NextResponse.json(
      { error: "Falha ao chamar OpenAI", details: text.slice(0, 2000) },
      { status: 502 },
    );
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";

  let parsed: any = { summary: "", suggestions: [], warnings: [] };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { summary: content, suggestions: [], warnings: ["Resposta não estava em JSON."] };
  }

  return NextResponse.json({ ok: true, result: parsed });
}
