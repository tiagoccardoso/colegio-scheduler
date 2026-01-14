import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateNoConflicts } from "@/lib/schedule/validate";

type BuildReq = {
  shift?: string | null;
  /**
   * Se true: apaga as AULAS (mantém HA) do turno e remonta.
   * Se false: só monta se NÃO existir nenhuma aula no turno.
   */
  overwrite?: boolean;
  /** Se informado, monta apenas para estas turmas (ids). */
  classIds?: string[] | null;
};

type TeachingRule = {
  subject_id: string;
  room_id: string;
  class_id: string;
  shift: string;
  period_index: number;
  weekdays?: number[] | null;
};

const WEEKDAY_LABEL: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};

const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];

function normalizeShift(v: any) {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return "MANHA";
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return key;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function safeRules(raw: any): TeachingRule[] {
  if (!Array.isArray(raw)) return [];
  const out: TeachingRule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const subject_id = String((r as any).subject_id ?? "").trim();
    const room_id = String((r as any).room_id ?? "").trim();
    const class_id = String((r as any).class_id ?? "").trim();
    const shift = normalizeShift((r as any).shift ?? "");
    const period_index = Number((r as any).period_index);
    if (!subject_id || !room_id || !class_id) continue;
    if (!Number.isFinite(period_index) || period_index < 1) continue;
    const weekdaysRaw = (r as any).weekdays;
    const weekdays = Array.isArray(weekdaysRaw)
      ? uniq(
          weekdaysRaw
            .map((d: any) => Number(d))
            .filter((d: number) => Number.isFinite(d) && d >= 1 && d <= 7),
        )
      : null;
    out.push({ subject_id, room_id, class_id, shift, period_index, weekdays: weekdays && weekdays.length ? weekdays : null });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as BuildReq;
    const overwrite = Boolean(body?.overwrite);
    const requestedShift = normalizeShift(body?.shift ?? "MANHA");
    const requestedClassIds = Array.isArray(body?.classIds) ? body.classIds.map(String).filter(Boolean) : null;

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

    if (!profile || (profile as any).role !== "director") {
      return NextResponse.json({ error: "Apenas diretor pode usar esta função." }, { status: 403 });
    }

    const schoolId = String((profile as any).school_id);

    // Time slots do turno
    const { data: timeSlots } = await supabase
      .from("time_slots")
      .select("id,weekday,shift,period_index,starts_at,ends_at")
      .eq("school_id", schoolId)
      .eq("shift", requestedShift)
      .in("weekday", [1, 2, 3, 4, 5]);

    const slots = ((timeSlots as any[]) ?? []).filter((t) => t?.id && t?.weekday && t?.period_index);
    if (slots.length === 0) {
      return NextResponse.json(
        { error: `Nenhum horário encontrado para o turno ${requestedShift}. Configure em Horários.` },
        { status: 400 },
      );
    }

    const slotIds = slots.map((s) => String(s.id));
    const slotKeyToId = new Map<string, string>();
    const slotById = new Map<string, any>();
    for (const s of slots) {
      slotKeyToId.set(`${Number(s.weekday)}-${Number(s.period_index)}`, String(s.id));
      slotById.set(String(s.id), s);
    }

    // Detecta se existe coluna activity_type (bases antigas podem não ter)
    let hasActivityType = true;
    {
      const probe = await supabase.from("schedules").select("activity_type").limit(1);
      if (probe.error) hasActivityType = false;
    }

    // Se não é overwrite, e já existe pelo menos 1 aula, não remonta.
    if (!overwrite) {
      if (hasActivityType) {
        const { data: existing } = await supabase
          .from("schedules")
          .select("id,class_id,activity_type")
          .eq("school_id", schoolId)
          .in("time_slot_id", slotIds);
        const aulaCount = ((existing as any[]) ?? []).filter((r) => {
          if (!r?.class_id) return false;
          const t = String(r?.activity_type ?? "").trim().toUpperCase();
          return t !== "HA";
        }).length;
        if (aulaCount > 0) {
          return NextResponse.json({
            ok: true,
            shift: requestedShift,
            overwrite,
            applied: 0,
            skipped: 0,
            skippedAll: true,
            summary: "Grade já existe para este turno; não remontei automaticamente.",
          });
        }
      } else {
        const { data: existing } = await supabase
          .from("schedules")
          .select("id,class_id")
          .eq("school_id", schoolId)
          .in("time_slot_id", slotIds);
        const aulaCount = ((existing as any[]) ?? []).filter((r) => Boolean(r?.class_id)).length;
        if (aulaCount > 0) {
          return NextResponse.json({
            ok: true,
            shift: requestedShift,
            overwrite,
            applied: 0,
            skipped: 0,
            skippedAll: true,
            summary: "Grade já existe para este turno; não remontei automaticamente.",
          });
        }
      }
    }

    // Overwrite: remove AULAS (mantém HA)
    if (overwrite) {
      let delQuery: any = supabase
        .from("schedules")
        .delete()
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds)
        .not("class_id", "is", null);

      if (hasActivityType) {
        delQuery = delQuery.or("activity_type.is.null,activity_type.neq.HA");
      }

      if (requestedClassIds?.length) {
        delQuery = delQuery.in("class_id", requestedClassIds);
      }

      const delRes = await delQuery;
      if (delRes.error) {
        return NextResponse.json({ error: delRes.error.message || "Falha ao limpar grade." }, { status: 400 });
      }
    }

    // Recarrega ocupações (inclui HA e qualquer aula residual)
    let existingSchedules: any[] = [];
    if (slotIds.length) {
      const { data } = await supabase
        .from("schedules")
        .select(hasActivityType ? "id,time_slot_id,teacher_id,room_id,class_id,activity_type" : "id,time_slot_id,teacher_id,room_id,class_id")
        .eq("school_id", schoolId)
        .in("time_slot_id", slotIds);
      existingSchedules = (data as any[]) ?? [];
    }

    const busyTeacher = new Map<string, Set<string>>();
    const busyRoom = new Map<string, Set<string>>();
    const busyClass = new Map<string, Set<string>>();
    for (const s of existingSchedules) {
      const ts = String(s?.time_slot_id ?? "");
      if (!ts) continue;
      const tid = String(s?.teacher_id ?? "");
      const rid = String(s?.room_id ?? "");
      const cid = String(s?.class_id ?? "");
      if (tid) {
        busyTeacher.get(ts) ?? busyTeacher.set(ts, new Set());
        busyTeacher.get(ts)!.add(tid);
      }
      if (rid) {
        busyRoom.get(ts) ?? busyRoom.set(ts, new Set());
        busyRoom.get(ts)!.add(rid);
      }
      if (cid) {
        busyClass.get(ts) ?? busyClass.set(ts, new Set());
        busyClass.get(ts)!.add(cid);
      }
    }

    // Carrega professores e suas regras
    const { data: teachersRaw } = await supabase
      .from("teachers")
      .select("id,name,teaching_rules")
      .eq("school_id", schoolId)
      .order("name", { ascending: true });

    const teachers = ((teachersRaw as any[]) ?? []).filter((t) => t?.id);

    let applied = 0;
    let skipped = 0;
    const warnings: string[] = [];

    const conflictCounts = { teacher: 0, room: 0, class: 0 };
    const conflictPreview: string[] = [];

    function pushPreview(msg: string) {
      if (conflictPreview.length >= 10) return;
      if (!msg) return;
      conflictPreview.push(msg);
    }

    function slotLabel(slotId: string) {
      const ts = slotById.get(slotId);
      if (!ts) return "(horário)";
      const w = WEEKDAY_LABEL?.[Number(ts.weekday) ?? 0] ?? "Dia";
      const p = Number(ts.period_index ?? 0);
      const range = ts.starts_at ? `${ts.starts_at}–${ts.ends_at}` : p ? `${p}º` : "";
      return `${w} ${range}`.trim();
    }

    // Dedup para evitar regras duplicadas no mesmo professor
    const plannedKeys = new Set<string>();

    for (const t of teachers) {
      const teacherId = String(t.id);
      const rules = safeRules((t as any).teaching_rules);
      if (rules.length === 0) continue;

      const rulesForShift = rules.filter((r) => normalizeShift(r.shift) === requestedShift);
      for (const r of rulesForShift) {
        if (requestedClassIds?.length && !requestedClassIds.includes(String(r.class_id))) continue;

        const weekdays = (r.weekdays && r.weekdays.length ? r.weekdays : DEFAULT_WEEKDAYS)
          .map((d) => Number(d))
          .filter((d) => d >= 1 && d <= 5);
        if (weekdays.length === 0) continue;

        for (const wd of weekdays) {
          const slotId = slotKeyToId.get(`${wd}-${Number(r.period_index)}`);
          if (!slotId) {
            skipped += 1;
            continue;
          }

          const key = `${teacherId}|${String(r.class_id)}|${slotId}|${String(r.subject_id)}|${String(r.room_id)}`;
          if (plannedKeys.has(key)) continue;
          plannedKeys.add(key);

          // Conflitos em memória
          if (busyTeacher.get(slotId)?.has(teacherId)) {
            conflictCounts.teacher += 1;
            pushPreview(`Professor ocupado: ${String(t.name ?? "(sem nome)")} em ${slotLabel(slotId)}.`);
            skipped += 1;
            continue;
          }
          if (busyRoom.get(slotId)?.has(String(r.room_id))) {
            conflictCounts.room += 1;
            pushPreview(`Sala ocupada em ${slotLabel(slotId)}.`);
            skipped += 1;
            continue;
          }
          if (busyClass.get(slotId)?.has(String(r.class_id))) {
            conflictCounts.class += 1;
            pushPreview(`Turma já tem aula em ${slotLabel(slotId)}.`);
            skipped += 1;
            continue;
          }

          // Confirmação no banco (inclui HA)
          const conflict = await validateNoConflicts({
            supabase: supabase as any,
            class_id: String(r.class_id),
            time_slot_id: slotId,
            teacher_id: teacherId,
            room_id: String(r.room_id) || null,
          });
          if (conflict) {
            if (conflict.kind === "teacher") conflictCounts.teacher += 1;
            if (conflict.kind === "room") conflictCounts.room += 1;
            if (conflict.kind === "class") conflictCounts.class += 1;
            pushPreview(conflict.message);
            skipped += 1;
            continue;
          }

          const payload: any = {
            school_id: schoolId,
            class_id: String(r.class_id),
            time_slot_id: slotId,
            teacher_id: teacherId,
            subject_id: String(r.subject_id),
            room_id: String(r.room_id),
            notes: null,
          };
          if (hasActivityType) payload.activity_type = "AULA";

          const ins = await supabase.from("schedules").insert(payload);
          if (ins.error) {
            skipped += 1;
            continue;
          }

          applied += 1;

          // Atualiza caches locais
          busyTeacher.get(slotId) ?? busyTeacher.set(slotId, new Set());
          busyTeacher.get(slotId)!.add(teacherId);
          busyRoom.get(slotId) ?? busyRoom.set(slotId, new Set());
          busyRoom.get(slotId)!.add(String(r.room_id));
          busyClass.get(slotId) ?? busyClass.set(slotId, new Set());
          busyClass.get(slotId)!.add(String(r.class_id));
        }
      }
    }

    if (applied === 0 && skipped > 0) {
      warnings.push(
        "Nenhuma aula foi aplicada. Verifique se os professores têm regras (Professores → Habilitações por horário) e se o calendário do turno foi cadastrado (Horários).",
      );
    }

    const totalConflicts = conflictCounts.teacher + conflictCounts.room + conflictCounts.class;
    if (totalConflicts > 0) {
      warnings.push(
        `Conflitos detectados na montagem: Professores (${conflictCounts.teacher}), Turmas (${conflictCounts.class}), Salas (${conflictCounts.room}). Veja em Montar grade → Ver conflitos.`,
      );
    }

    return NextResponse.json({
      ok: true,
      shift: requestedShift,
      overwrite,
      applied,
      skipped,
      conflicts: {
        total: totalConflicts,
        teacher: conflictCounts.teacher,
        room: conflictCounts.room,
        class: conflictCounts.class,
        preview: conflictPreview,
      },
      warnings,
      summary: `Grade montada pelo cadastro dos professores (regras por horário). Aplicadas: ${applied}. Ignoradas: ${skipped}.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
