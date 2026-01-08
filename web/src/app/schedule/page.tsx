import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { ScheduleClassPicker } from "@/components/ScheduleClassPicker";
import { ScheduleAssistant } from "@/components/ScheduleAssistant";
import { ScheduleAutoBuilder } from "@/components/ScheduleAutoBuilder";
import { validateNoConflicts } from "@/lib/schedule/validate";
import { normalizeShiftOrNull } from "@/lib/schedule/rules";

type ClassRow = { id: string; name: string; shift: string | null };
type SubjectRow = { id: string; name: string };
type TeacherRow = { id: string; name: string };
type RoomRow = { id: string; name: string };
type TimeSlotRow = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  shift: string | null;
  period_index: number | null;
};

type ScheduleRow = {
  id: string;
  time_slot_id: string;
  subject_id: string;
  teacher_id: string;
  room_id: string | null;
  subject: { name: string } | null;
  teacher: { name: string } | null;
  room: { name: string } | null;
};

const WEEKDAYS: { key: number; label: string }[] = [
  { key: 1, label: "Seg" },
  { key: 2, label: "Ter" },
  { key: 3, label: "Qua" },
  { key: 4, label: "Qui" },
  { key: 5, label: "Sex" },
];

function periodKey(ts: TimeSlotRow) {
  // Prefer the canonical period index (1..6). Fallback to the time range for older data.
  return ts.period_index ? String(ts.period_index) : `${ts.starts_at}-${ts.ends_at}`;
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};


  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;
  const classId = typeof sp.classId === "string" ? sp.classId : null;

  const { data: classes } = await supabase.from("classes").select("id, name, shift").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: subjects } = await supabase.from("subjects").select("id, name").eq("school_id", profile.school_id).order("name", { ascending: true });
  const subjectsSafe = ((subjects as any) ?? []) as any[];
  const { data: teachers } = await supabase.from("teachers").select("id, name").eq("school_id", profile.school_id).order("name", { ascending: true });
  const { data: rooms } = await supabase.from("rooms").select("id, name").eq("school_id", profile.school_id).order("name", { ascending: true });

  const selectedClass = classId ? (classes as ClassRow[] | null)?.find((c) => c.id === classId) : null;
  const selectedShift = selectedClass?.shift ?? null;

  
  const preferredShift = selectedShift ? normalizeShiftOrNull(selectedShift) : null;

  const { data: timeSlotsAll } = await supabase
    .from("time_slots")
    .select("id, weekday, starts_at, ends_at, shift, period_index")
    .eq("school_id", profile.school_id)
    .in("weekday", WEEKDAYS.map((w) => w.key))
    .order("weekday", { ascending: true })
    .order("period_index", { ascending: true })
    .order("starts_at", { ascending: true });

  const allSlots = ((timeSlotsAll as TimeSlotRow[] | null) ?? []).filter((s) => s?.id);

  // Decide which shift to render: prefer the class shift, otherwise infer the most common shift from slots.
  const counts = new Map<string, number>();
  for (const s of allSlots) {
    const sh = normalizeShiftOrNull(s.shift);
    if (!sh) continue;
    counts.set(sh, (counts.get(sh) ?? 0) + 1);
  }

  let effectiveShift: string | null = null;
  if (preferredShift && (counts.get(preferredShift) ?? 0) > 0) {
    effectiveShift = preferredShift;
  } else {
    let best: string | null = null;
    let bestN = 0;
    for (const [sh, n] of counts.entries()) {
      if (n > bestN) {
        best = sh;
        bestN = n;
      }
    }
    effectiveShift = best;
  }

  const timeSlots = effectiveShift ? allSlots.filter((s) => normalizeShiftOrNull(s.shift) === effectiveShift) : allSlots;

  const shiftNote =
    classId && preferredShift && effectiveShift && preferredShift !== effectiveShift
      ? `A turma está com turno "${String(selectedShift)}", mas não há horários cadastrados para esse turno. Exibindo "${effectiveShift}". Ajuste o turno da turma ou cadastre horários para o turno correto.`
      : null;

  const periods = new Map<string, { starts_at: string; ends_at: string }>();
  const slotByDayAndPeriod = new Map<string, TimeSlotRow>();

  (timeSlots as TimeSlotRow[] | null)?.forEach((ts) => {
    periods.set(periodKey(ts), { starts_at: ts.starts_at, ends_at: ts.ends_at });
    slotByDayAndPeriod.set(`${ts.weekday}|${periodKey(ts)}`, ts);
  });

  const periodList = Array.from(periods.entries())
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => Number(a.key) - Number(b.key));

  let schedules: ScheduleRow[] = [];
  let requirements: { subject_id: string; lessons_per_week: number }[] = [];

  if (classId) {
    const { data: sched } = await supabase
      .from("schedules")
      .select(
        "id, time_slot_id, subject_id, teacher_id, room_id, subject:subjects(name), teacher:teachers(name), room:rooms(name)",
      )
      .eq("school_id", profile.school_id)
      .eq("class_id", classId);

    schedules = (sched as any) ?? [];

    // Matriz curricular (aulas/semana por disciplina)
    const { data: req } = await supabase
      .from("class_subject_requirements")
      .select("subject_id, lessons_per_week, max_per_day, block_size, min_days, prefer_consecutive")
      .eq("school_id", profile.school_id)
      .eq("class_id", classId);

    requirements = (req as any) ?? [];
  }

  const reqBySubject = new Map<string, number>();
  for (const r of requirements) {
    const sid = String((r as any)?.subject_id ?? "");
    const lpw = Number((r as any)?.lessons_per_week ?? 0);
    if (sid && Number.isFinite(lpw) && lpw > 0) reqBySubject.set(sid, lpw);
  }
  const requirementsEnabled = reqBySubject.size > 0;
  const totalRequired = Array.from(reqBySubject.values()).reduce((a, b) => a + b, 0);
  const totalSlots = ((timeSlots as TimeSlotRow[] | null) ?? []).length;
  const scheduleBySlot = new Map<string, ScheduleRow>();
  schedules.forEach((s) => scheduleBySlot.set(s.time_slot_id, s));

  const aiEnabled = process.env.AI_SCHEDULER_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY);

  async function upsertAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const class_id = String(formData.get("class_id") || "");
    const time_slot_id = String(formData.get("time_slot_id") || "");
    const subject_id = String(formData.get("subject_id") || "");
    const teacher_id = String(formData.get("teacher_id") || "");
    const room_id_raw = String(formData.get("room_id") || "");
    const room_id = room_id_raw ? room_id_raw : null;

    if (!class_id || !time_slot_id || !subject_id || !teacher_id) {
      redirect("/schedule?error=" + encodeMsg("Preencha os campos obrigatórios."));
    }

    // Load core entities for deterministic validation
    const { data: cls } = await supabase
      .from("classes")
      .select("id,shift")
      .eq("id", class_id)
      .maybeSingle();

    const { data: slot } = await supabase
      .from("time_slots")
      .select("id,weekday,shift,period_index")
      .eq("id", time_slot_id)
      .maybeSingle();

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id,subject_id,default_room_id,shifts,availability,subject_ids,class_ids,room_ids,available_weekdays")
      .eq("id", teacher_id)
      .maybeSingle();

    if (!cls || !slot || !teacher) {
      redirect(
        "/schedule?classId=" +
          encodeURIComponent(class_id) +
          "&error=" +
          encodeMsg("Turma, professor ou horário inválido."),
      );
    }

    // Shift rules: the time slot shift must match the class shift, and the teacher must accept it.
    const classShift = String((cls as any).shift ?? "");
    const slotShift = String((slot as any).shift ?? "");
    if (classShift && slotShift && classShift !== slotShift) {
      redirect(
        "/schedule?classId=" +
          encodeURIComponent(class_id) +
          "&error=" +
          encodeMsg("O horário selecionado não pertence ao turno da turma."),
      );
    }

    const teacherShifts = (((teacher as any).shifts ?? []) as string[]).filter(Boolean);
    if (teacherShifts.length) {
      const targetShift = slotShift || classShift;
      if (targetShift && !teacherShifts.includes(targetShift)) {
        redirect(
          "/schedule?classId=" +
            encodeURIComponent(class_id) +
            "&error=" +
            encodeMsg("Professor não atende este turno."),
        );
      }
    }

    // Availability rules: prefer detailed availability(shift->weekday->periods); fallback to available_weekdays.
    const availability = (teacher as any).availability as any;
    const weekday = Number((slot as any).weekday);
    const periodIndex = Number((slot as any).period_index);

    const hasDetailedAvailability = availability && typeof availability === "object";
    if (hasDetailedAvailability && (slotShift || classShift) && Number.isFinite(weekday) && Number.isFinite(periodIndex)) {
      const sKey = String(slotShift || classShift);
      const dKey = String(weekday);
      const allowedPeriods = (availability?.[sKey]?.[dKey] ?? null) as any;
      if (!Array.isArray(allowedPeriods) || (allowedPeriods as any[]).length === 0 || !(allowedPeriods as any[]).includes(periodIndex)) {
        redirect(
          "/schedule?classId=" +
            encodeURIComponent(class_id) +
            "&error=" +
            encodeMsg("Professor indisponível neste dia/período."),
        );
      }
    } else {
      const availableWeekdays = ((teacher as any).available_weekdays ?? []) as number[];
      if (availableWeekdays.length && !availableWeekdays.includes(weekday)) {
        redirect(
          "/schedule?classId=" +
            encodeURIComponent(class_id) +
            "&error=" +
            encodeMsg("Professor indisponível neste dia da semana."),
        );
      }
    }

    const allowedClasses = (((teacher as any).class_ids ?? []) as string[]).filter(Boolean);
    if (allowedClasses.length && !allowedClasses.includes(class_id)) {
      redirect(
        "/schedule?classId=" +
          encodeURIComponent(class_id) +
          "&error=" +
          encodeMsg("Professor não está habilitado para esta turma."),
      );
    }

    const primarySubject = String((teacher as any).subject_id ?? "");
    const allowedSubjects = (((teacher as any).subject_ids ?? []) as string[]).filter(Boolean);
    if (primarySubject && subject_id && primarySubject !== subject_id) {
      redirect(
        "/schedule?classId=" +
          encodeURIComponent(class_id) +
          "&error=" +
          encodeMsg("Disciplina não compatível com este professor."),
      );
    }
    if (!primarySubject && allowedSubjects.length && !allowedSubjects.includes(subject_id)) {
      redirect(
        "/schedule?classId=" +
          encodeURIComponent(class_id) +
          "&error=" +
          encodeMsg("Professor não está habilitado para esta disciplina."),
      );
    }

    const allowedRooms = (((teacher as any).room_ids ?? []) as string[]).filter(Boolean);
    if (room_id && allowedRooms.length && !allowedRooms.includes(room_id)) {
      redirect(
        "/schedule?classId=" +
          encodeURIComponent(class_id) +
          "&error=" +
          encodeMsg("Professor não está habilitado para esta sala."),
      );
    }

    const { data: existing } = await supabase
      .from("schedules")
      .select("id")
      .eq("class_id", class_id)
      .eq("time_slot_id", time_slot_id)
      .maybeSingle();

    const conflict = await validateNoConflicts({ supabase, class_id, time_slot_id, teacher_id, room_id, schedule_id: existing?.id ?? null });
    if (conflict) {
      redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg(conflict.message));
    }

    let result;
    if (existing?.id) {
      result = await supabase.from("schedules").update({ subject_id, teacher_id, room_id }).eq("id", existing.id);
    } else {
      result = await supabase.from("schedules").insert({
        school_id: profile.school_id,
        class_id,
        time_slot_id,
        subject_id,
        teacher_id,
        room_id,
      });
    }

    if (result.error) {
      redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg(result.error.message));
    }

    revalidatePath("/schedule");
    redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&msg=" + encodeMsg("Aula salva."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const id = String(formData.get("id") || "");
    const class_id = String(formData.get("class_id") || "");
    if (!id) redirect("/schedule?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg(error.message));

    revalidatePath("/schedule");
    redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&msg=" + encodeMsg("Aula removida."));
  }


async function saveRequirementsAction(formData: FormData) {
  "use server";
  const { supabase, profile } = await requireDirector();

  const class_id = String(formData.get("class_id") || "");
  if (!class_id) redirect("/schedule?error=" + encodeMsg("Turma inválida."));

  const { data: subj } = await supabase
    .from("subjects")
    .select("id")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const subjectIds = ((subj as any[] | null) ?? []).map((s) => String(s.id));

  const rows: any[] = [];
for (const s of subjectsSafe) {
  const sid = String((s as any).id);
  const lpw = Number(formData.get(`req_${sid}`) || 0);
  const maxpd = Number(formData.get(`max_${sid}`) || 0);
  const mind = Number(formData.get(`minDays_${sid}`) || 0);
  const blk = Number(formData.get(`block_${sid}`) || 0);
  const pref = Boolean(formData.get(`cons_${sid}`));

  if (Number.isFinite(lpw) && lpw > 0) {
    rows.push({
      school_id: profile.school_id,
      class_id,
      subject_id: sid,
      lessons_per_week: lpw,
      max_per_day: Number.isFinite(maxpd) && maxpd > 0 ? maxpd : null,
      min_days: Number.isFinite(mind) && mind > 0 ? mind : null,
      block_size: Number.isFinite(blk) && blk > 1 ? blk : null,
      prefer_consecutive: pref,
    });
  }
}

// Robust save: replace all requirements for the class (no dependency on unique indexes).
const { error: delErr } = await supabase
  .from("class_subject_requirements")
  .delete()
  .eq("school_id", profile.school_id)
  .eq("class_id", class_id);
if (delErr) redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg(delErr.message));

if (rows.length) {
  const { error: insErr } = await supabase.from("class_subject_requirements").insert(rows);
  if (insErr) redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg(insErr.message));
}

  revalidatePath("/schedule");
  redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&msg=" + encodeMsg("Matriz curricular salva."));
}

  return (
    <Shell title="Grade" subtitle="Montagem manual">
      <div className="grid gap-4">
        <Flash message={error || msg} variant={error ? "error" : msg ? "success" : "info"} />
        {shiftNote ? <div className="mt-2"><Flash message={shiftNote} variant="info" /></div> : null}

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          {/*
            IMPORTANT:
            We intentionally avoid a Server Action here.
            Navigation via Server Action can fail silently in some dev/prod setups.
            This client component uses a full page navigation with querystring which is robust.
          */}
          <ScheduleClassPicker classes={((classes as ClassRow[] | null) ?? [])} initialClassId={classId} />
        </div>

        {classId ? (
          <div className="grid gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Matriz curricular</h2>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Defina quantas aulas por semana cada disciplina deve ter <span className="font-medium">nesta turma</span>.
                    Se tudo ficar em 0, a geração automática volta ao modo “balanceado”.
                  </p>
                </div>

                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold">{totalRequired}</span> aulas/semana configuradas •{" "}
                  <span className="font-semibold">{totalSlots}</span> horários cadastrados
                  {requirementsEnabled ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      Ativa
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      Desligada
                    </span>
                  )}
                </div>
              </div>

              <form action={saveRequirementsAction} className="mt-4">
                <input type="hidden" name="class_id" value={classId} />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(((subjects as SubjectRow[] | null) ?? []) as SubjectRow[]).map((s) => (
                    <label key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-900 dark:bg-zinc-950">
                      <span className="truncate font-medium">{s.name}</span>
                      <input
                        name={`req_${s.id}`}
                        type="number"
                        min={0}
                        defaultValue={reqBySubject.get(s.id) ?? 0}
                        className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-right text-sm dark:border-zinc-800 dark:bg-zinc-950"
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  className="mt-4 w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Salvar matriz
                </button>
              </form>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ScheduleAutoBuilder enabled={aiEnabled} classId={classId} shift={effectiveShift} />
              <ScheduleAssistant
                enabled={aiEnabled}
                classId={classId}
                teachers={((teachers as TeacherRow[] | null) ?? [])}
                subjects={((subjects as SubjectRow[] | null) ?? [])}
                rooms={((rooms as RoomRow[] | null) ?? [])}
                timeSlots={((timeSlots as TimeSlotRow[] | null) ?? [])}
              />
            </div>
          </div>
        ) : null}

        {!classId ? <p className="text-sm text-zinc-600 dark:text-zinc-400">Selecione uma turma para visualizar a grade.</p> : null}

        {classId ? (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Horário</th>
                    {WEEKDAYS.map((w) => (
                      <th key={w.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{w.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodList.map((p) => (
                    <tr key={p.key} className="border-t border-zinc-100 dark:border-zinc-900">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{p.starts_at}–{p.ends_at}</td>

                      {WEEKDAYS.map((w) => {
                        const ts = slotByDayAndPeriod.get(`${w.key}|${p.key}`);
                        if (!ts) return <td key={w.key} className="px-4 py-3 text-sm text-zinc-500">—</td>;

                        const sched = scheduleBySlot.get(ts.id);

                        const baseForm = (defaults?: { subject_id?: string; teacher_id?: string; room_id?: string | null }) => (
                          <form action={upsertAction} className="mt-3 grid gap-3">
                            <input type="hidden" name="class_id" value={classId} />
                            <input type="hidden" name="time_slot_id" value={ts.id} />

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Disciplina</span>
                              <select name="subject_id" required defaultValue={defaults?.subject_id ?? ""} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                                <option value="" disabled>Selecione...</option>
                                {(subjects as SubjectRow[] | null)?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Professor</span>
                              <select name="teacher_id" required defaultValue={defaults?.teacher_id ?? ""} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                                <option value="" disabled>Selecione...</option>
                                {(teachers as TeacherRow[] | null)?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                              </select>
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-semibold">Sala (opcional)</span>
                              <select name="room_id" defaultValue={defaults?.room_id ?? ""} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                                <option value="">—</option>
                                {(rooms as RoomRow[] | null)?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                              </select>
                            </label>

                            <button type="submit" className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                              Salvar
                            </button>
                          </form>
                        );

                        return (
                          <td key={w.key} className="px-4 py-3 align-top">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                              {sched ? (
                                <div className="grid gap-2">
                                  <div>
                                    <div className="text-sm font-semibold">{sched.subject?.name ?? "—"}</div>
                                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                      {sched.teacher?.name ?? "—"}{sched.room?.name ? ` · ${sched.room.name}` : ""}
                                    </div>
                                  </div>

                                  <details>
                                    <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                                    {baseForm({ subject_id: sched.subject_id, teacher_id: sched.teacher_id, room_id: sched.room_id })}
                                  </details>

                                  <form action={deleteAction}>
                                    <input type="hidden" name="id" value={sched.id} />
                                    <input type="hidden" name="class_id" value={classId} />
                                    <ConfirmButton confirmText="Remover esta aula?" type="submit" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
                                      Remover
                                    </ConfirmButton>
                                  </form>
                                </div>
                              ) : (
                                <details>
                                  <summary className="cursor-pointer text-sm font-semibold">Adicionar</summary>
                                  {baseForm()}
                                </details>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {periodList.length === 0 ? (
                    <tr className="border-t border-zinc-100 dark:border-zinc-900">
                      <td colSpan={6} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                        Nenhum horário cadastrado. Vá em <strong>Horários</strong> e cadastre primeiro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}