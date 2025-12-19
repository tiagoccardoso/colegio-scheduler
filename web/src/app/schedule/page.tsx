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

type ClassRow = { id: string; name: string; shift: string | null };
type SubjectRow = { id: string; name: string };
type TeacherRow = { id: string; name: string };
type RoomRow = { id: string; name: string };
type TimeSlotRow = { id: string; weekday: number; starts_at: string; ends_at: string };

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
  return `${ts.starts_at}-${ts.ends_at}`;
}

export default async function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { supabase } = await requireDirector();

  const msg = typeof searchParams?.msg === "string" ? decodeMsg(searchParams?.msg) : null;
  const error = typeof searchParams?.error === "string" ? decodeMsg(searchParams?.error) : null;
  const classId = typeof searchParams?.classId === "string" ? searchParams?.classId : null;

  const { data: classes } = await supabase.from("classes").select("id, name, shift").order("name", { ascending: true });
  const { data: subjects } = await supabase.from("subjects").select("id, name").order("name", { ascending: true });
  const { data: teachers } = await supabase.from("teachers").select("id, name").order("name", { ascending: true });
  const { data: rooms } = await supabase.from("rooms").select("id, name").order("name", { ascending: true });

  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("id, weekday, starts_at, ends_at")
    .in("weekday", WEEKDAYS.map((w) => w.key))
    .order("weekday", { ascending: true })
    .order("starts_at", { ascending: true });

  const periods = new Map<string, { starts_at: string; ends_at: string }>();
  const slotByDayAndPeriod = new Map<string, TimeSlotRow>();

  (timeSlots as TimeSlotRow[] | null)?.forEach((ts) => {
    periods.set(periodKey(ts), { starts_at: ts.starts_at, ends_at: ts.ends_at });
    slotByDayAndPeriod.set(`${ts.weekday}|${periodKey(ts)}`, ts);
  });

  const periodList = Array.from(periods.entries())
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  let schedules: ScheduleRow[] = [];
  if (classId) {
    const { data: sched } = await supabase
      .from("schedules")
      .select("id, time_slot_id, subject_id, teacher_id, room_id, subject:subjects(name), teacher:teachers(name), room:rooms(name)")
      .eq("class_id", classId);

    schedules = (sched as any) ?? [];
  }

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

    // Validate teacher constraints and conflict rules
    const { data: slot } = await supabase
      .from("time_slots")
      .select("id,weekday")
      .eq("id", time_slot_id)
      .maybeSingle();

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id,subject_ids,class_ids,room_ids,available_weekdays")
      .eq("id", teacher_id)
      .maybeSingle();

    if (!slot || !teacher) {
      redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg("Professor ou horário inválido."));
    }

    const available = ((teacher as any).available_weekdays ?? []) as number[];
    if (available.length && !available.includes(slot.weekday)) {
      redirect(
        "/schedule?classId=" +
          encodeURIComponent(class_id) +
          "&error=" +
          encodeMsg("Professor indisponível neste dia da semana."),
      );
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

    const allowedSubjects = (((teacher as any).subject_ids ?? []) as string[]).filter(Boolean);
    if (allowedSubjects.length && !allowedSubjects.includes(subject_id)) {
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

    const conflict = await validateNoConflicts({ supabase, class_id, time_slot_id, teacher_id, room_id });
    if (conflict) {
      redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg(conflict.message));
    }

    const { data: existing } = await supabase
      .from("schedules")
      .select("id")
      .eq("class_id", class_id)
      .eq("time_slot_id", time_slot_id)
      .maybeSingle();

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
    const { supabase } = await requireDirector();

    const id = String(formData.get("id") || "");
    const class_id = String(formData.get("class_id") || "");
    if (!id) redirect("/schedule?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (error) redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&error=" + encodeMsg(error.message));

    revalidatePath("/schedule");
    redirect("/schedule?classId=" + encodeURIComponent(class_id) + "&msg=" + encodeMsg("Aula removida."));
  }

  return (
    <Shell title="Grade" subtitle="Montagem manual">
      <div className="grid gap-4">
        <Flash message={error || msg} variant={error ? "error" : msg ? "success" : "info"} />

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
          <div className="grid gap-4 lg:grid-cols-2">
            <ScheduleAutoBuilder enabled={aiEnabled} classId={classId} />
            <ScheduleAssistant
              enabled={aiEnabled}
              classId={classId}
              teachers={((teachers as TeacherRow[] | null) ?? [])}
              subjects={((subjects as SubjectRow[] | null) ?? [])}
              rooms={((rooms as RoomRow[] | null) ?? [])}
              timeSlots={((timeSlots as TimeSlotRow[] | null) ?? [])}
            />
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
