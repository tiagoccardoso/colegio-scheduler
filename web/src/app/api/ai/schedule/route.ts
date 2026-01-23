import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/authz";

type ReqBody = {
  classId: string;
  timeSlotId: string;
  subjectId?: string;
  teacherId?: string;
  roomId?: string | null;
};

type TimeSlotRow = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  shift: string | null;
  period_index: number | null;
};

type TeacherRow = {
  id: string;
  name: string | null;
  shifts: string[] | null;
  subject_id: string | null;
  default_room_id: string | null;
  class_ids: string[] | null;
  restrictions: string | null;
  availability: any | null;

  // legacy
  subject_ids: string[] | null;
  room_ids: string[] | null;
  available_weekdays: number[] | null;
};

type SubjectRow = { id: string; name: string | null };
type RoomRow = { id: string; name: string | null };

const WEEKDAYS: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};

function normalizeShift(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function teacherAcceptsShift(teacher: TeacherRow, shift: string | null) {
  if (!shift) return true;
  const shifts = (teacher.shifts ?? []).map(normalizeShift).filter(Boolean);
  if (shifts.length === 0) return true;
  return shifts.includes(normalizeShift(shift));
}

function teacherAvailable(teacher: TeacherRow, args: { shift: string | null; weekday: number; period_index: number | null }) {
  const { shift, weekday, period_index } = args;

  const availability = teacher.availability;
  if (availability && typeof availability === "object" && shift && Number.isFinite(weekday) && Number.isFinite(period_index)) {
    const allowed = availability?.[normalizeShift(shift)]?.[String(weekday)] as any;
    if (Array.isArray(allowed) && allowed.length > 0) return allowed.includes(Number(period_index));
    if (allowed && typeof allowed === "object") {
      const v = (allowed as any)[String(period_index)] ?? (allowed as any)[Number(period_index) as any];
      return Boolean(v);
    }
    return false;
  }

  const days = (teacher.available_weekdays ?? []).filter((n) => Number.isFinite(n));
  if (days.length === 0) return true;
  return days.includes(weekday);
}

function teacherAllowedForClass(teacher: TeacherRow, classId: string) {
  const allowed = (teacher.class_ids ?? []).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(classId);
}

function teacherAllowsSubject(teacher: TeacherRow, subjectId: string) {
  const primary = teacher.subject_id ? String(teacher.subject_id) : "";
  if (primary) return primary === subjectId;
  const legacy = (teacher.subject_ids ?? []).filter(Boolean);
  if (legacy.length === 0) return true;
  return legacy.includes(subjectId);
}

function teacherAllowsRoom(teacher: TeacherRow, roomId: string) {
  const legacy = (teacher.room_ids ?? []).filter(Boolean);
  if (legacy.length === 0) return true;
  return legacy.includes(roomId);
}

export async function POST(req: Request) {
  try {
    if (process.env.AI_SCHEDULER_ENABLED !== "true") {
      return NextResponse.json({ error: "IA desabilitada." }, { status: 400 });
    }
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada." }, { status: 400 });
    }

    const body = (await req.json()) as ReqBody;
    const classId = String(body?.classId ?? "");
    const timeSlotId = String(body?.timeSlotId ?? "");
    const subjectId = body?.subjectId ? String(body.subjectId) : "";
    const teacherId = body?.teacherId ? String(body.teacherId) : "";
    const roomId = body?.roomId ? String(body.roomId) : null;

    if (!classId || !timeSlotId) {
      return NextResponse.json({ error: "classId e timeSlotId são obrigatórios." }, { status: 400 });
    }

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
    if (!profile || !isStaffRole((profile as any).role)) {
      return NextResponse.json({ error: "Apenas diretor pode usar esta função." }, { status: 403 });
    }
    const schoolId = String((profile as any).school_id);

    const { data: cls } = await supabase
      .from("classes")
      .select("id,name,shift")
      .eq("school_id", schoolId)
      .eq("id", classId)
      .maybeSingle();
    if (!cls) return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    const classShift = normalizeShift((cls as any).shift);

    const { data: slot } = await supabase
      .from("time_slots")
      .select("id,weekday,starts_at,ends_at,shift,period_index")
      .eq("school_id", schoolId)
      .eq("id", timeSlotId)
      .maybeSingle();
    if (!slot) return NextResponse.json({ error: "Horário não encontrado." }, { status: 404 });

    const slotShift = normalizeShift((slot as any).shift ?? classShift);
    if (classShift && slotShift && classShift !== slotShift) {
      return NextResponse.json({ error: "O horário selecionado não pertence ao turno da turma." }, { status: 400 });
    }

    const { data: subjects } = await supabase
      .from("subjects")
      .select("id,name")
      .eq("school_id", schoolId);
    const subjectById = new Map(((subjects as SubjectRow[] | null) ?? []).map((s) => [s.id, s.name ?? null] as const));

    const { data: rooms } = await supabase
      .from("rooms")
      .select("id,name")
      .eq("school_id", schoolId);
    const roomById = new Map(((rooms as RoomRow[] | null) ?? []).map((r) => [r.id, r.name ?? null] as const));

    // Busy entities at the same time slot.
    const { data: busyRows } = await supabase
      .from("schedules")
      .select("teacher_id,room_id,class_id")
      .eq("school_id", schoolId)
      .eq("time_slot_id", timeSlotId);

    const busyTeachers = new Set(((busyRows as any[] | null) ?? []).map((r) => String(r.teacher_id ?? "")).filter(Boolean));
    const busyRooms = new Set(((busyRows as any[] | null) ?? []).map((r) => String(r.room_id ?? "")).filter(Boolean));
    const classAlreadyOccupied = ((busyRows as any[] | null) ?? []).some((r) => String(r.class_id ?? "") === classId);

    const { data: teachers } = await supabase
      .from("teachers")
      .select(
        "id,name,shifts,subject_id,default_room_id,class_ids,restrictions,availability,subject_ids,room_ids,available_weekdays",
      )
      .eq("school_id", schoolId)
      .order("name", { ascending: true });

    const teachersList = ((teachers as TeacherRow[] | null) ?? []).filter((t) => t?.id);

    // Filter teacher candidates respecting deterministic rules.
    const candidates = teachersList
      .filter((t) => !busyTeachers.has(t.id) || (teacherId && t.id === teacherId))
      .filter((t) => teacherAcceptsShift(t, slotShift || null))
      .filter((t) => teacherAvailable(t, { shift: slotShift || null, weekday: (slot as any).weekday, period_index: (slot as any).period_index }))
      .filter((t) => teacherAllowedForClass(t, classId))
      .filter((t) => (subjectId ? teacherAllowsSubject(t, subjectId) : true))
      .filter((t) => (roomId ? teacherAllowsRoom(t, roomId) : true))
      .map((t) => {
        const subjId = t.subject_id ? String(t.subject_id) : (t.subject_ids?.[0] ? String(t.subject_ids[0]) : "");
        const defRoom = t.default_room_id ? String(t.default_room_id) : null;
        return {
          id: t.id,
          name: t.name ?? "(sem nome)",
          subjectId: subjId || null,
          subjectName: subjId ? subjectById.get(subjId) ?? null : null,
          defaultRoomId: defRoom,
          defaultRoomName: defRoom ? roomById.get(defRoom) ?? null : null,
          restrictions: t.restrictions ?? null,
        };
      });

    const freeRooms = ((rooms as RoomRow[] | null) ?? [])
      .filter((r) => r?.id)
      .filter((r) => !busyRooms.has(r.id) || (roomId && r.id === roomId))
      .map((r) => ({ id: r.id, name: r.name ?? null }));

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const weekdayName = WEEKDAYS[(slot as any).weekday] ?? String((slot as any).weekday);

    const sys =
      "Você é um assistente de alocação de grade escolar. Sua saída DEVE ser JSON válido. " +
      "Considere regras duras: (1) não sugerir professor ocupado, (2) respeitar turno e disponibilidade (dia/período), " +
      "(3) respeitar disciplina do professor, (4) respeitar sala ocupada.";

    const prompt = {
      class: { id: classId, name: (cls as any).name ?? null, shift: classShift || null },
      slot: {
        id: timeSlotId,
        weekday: (slot as any).weekday,
        weekdayName,
        shift: slotShift || null,
        periodIndex: (slot as any).period_index ?? null,
        starts_at: (slot as any).starts_at,
        ends_at: (slot as any).ends_at,
      },
      constraints: {
        subjectId: subjectId || null,
        teacherId: teacherId || null,
        roomId: roomId || null,
        classAlreadyOccupied,
      },
      candidates,
      freeRooms,
      outputSchema: {
        summary: "string",
        suggestions: [
          {
            type: "teacher|room|warning",
            title: "string",
            reason: "string",
            proposed: {
              teacherId: "uuid (opcional)",
              subjectId: "uuid (opcional)",
              roomId: "uuid|null (opcional)",
            },
          },
        ],
        warnings: ["string"],
      },
    };

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(prompt) },
        ],
      }),
    });

    const aiJson = await aiRes.json();
    if (!aiRes.ok) {
      return NextResponse.json(
        { error: aiJson?.error?.message ?? "Falha ao chamar OpenAI." },
        { status: 500 },
      );
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(aiJson?.choices?.[0]?.message?.content ?? "null");
    } catch {
      return NextResponse.json({ error: "Resposta da IA não era JSON válido." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      result: {
        summary: parsed?.summary ? String(parsed.summary) : null,
        suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions : [],
        warnings: Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : [],
        meta: {
          candidatesCount: candidates.length,
          freeRoomsCount: freeRooms.length,
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}