import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { WeeklyGradeBoard } from "@/components/WeeklyGradeBoard";

type TeacherRow = {
  id: string;
  name: string | null;
  shifts: string[] | null;
  subject_id: string | null;
  default_room_id: string | null;
};

type RefRow = { id: string; name: string | null; shift?: string | null };

type TimeSlotRow = {
  id: string;
  weekday: number;
  period_index: number | null;
  shift: string | null;
  starts_at: string;
  ends_at: string;
};

type ScheduleRow = {
  id: string;
  time_slot_id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  room_id: string | null;
  notes: string | null;
  time_slot: { weekday: number; period_index: number | null; shift: string | null } | null;
  class: { name: string | null; shift: string | null } | null;
  subject: { name: string | null } | null;
  room: { name: string | null } | null;
};

type AuditEvent = {
  id: string;
  action: string;
  created_at: string;
  undone_at: string | null;
  redone_at: string | null;
};

const SHIFT_OPTIONS: { key: string; label: string }[] = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};


  const shift =
    typeof sp.shift === "string" && SHIFT_OPTIONS.some((s) => s.key === sp.shift)
      ? sp.shift
      : "MANHA";

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id,name,shifts,subject_id,default_room_id")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const visibleTeachers = ((teachers as TeacherRow[] | null) ?? []).filter((t) => {
    const shifts = (t.shifts ?? []) as string[];
    return shifts.length === 0 || shifts.includes(shift);
  });

  const { data: classes } = await supabase
    .from("classes")
    .select("id,name,shift")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("id,weekday,period_index,shift,starts_at,ends_at")
    .eq("school_id", profile.school_id)
    .eq("shift", shift)
    .in("weekday", [1, 2, 3, 4, 5])
    .order("weekday", { ascending: true })
    .order("period_index", { ascending: true })
    .order("starts_at", { ascending: true });

  const timeSlotIds = ((timeSlots as TimeSlotRow[] | null) ?? []).map((t) => t.id);

  let schedules: ScheduleRow[] = [];
  if (timeSlotIds.length) {
    const { data: sched } = await supabase
      .from("schedules")
      .select(
        "id,time_slot_id,teacher_id,class_id,subject_id,room_id,notes,time_slot:time_slots(weekday,period_index,shift),class:classes(name,shift),subject:subjects(name),room:rooms(name)",
      )
      .eq("school_id", profile.school_id)
      .in("time_slot_id", timeSlotIds);

    schedules = (sched as any) ?? [];
  }

  const { data: events } = await supabase
    .from("schedule_audit_events")
    .select("id,action,created_at,undone_at,redone_at")
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const noCalendar = timeSlotIds.length === 0;

  return (
    <Shell title="Grade semanal" subtitle="Arraste e solte para mover aulas. Clique em um slot para editar.">
      <div className="grid gap-4">
        <Flash
          message={
            noCalendar
              ? "Nenhum horário encontrado para este turno. Configure em Horários."
              : null
          }
          variant={noCalendar ? "info" : "info"}
        />

        <WeeklyGradeBoard
          shift={shift}
          shiftOptions={SHIFT_OPTIONS}
          teachers={visibleTeachers}
          classes={((classes as RefRow[] | null) ?? []) as any}
          subjects={((subjects as RefRow[] | null) ?? []) as any}
          rooms={((rooms as RefRow[] | null) ?? []) as any}
          timeSlots={((timeSlots as TimeSlotRow[] | null) ?? [])}
          initialSchedules={schedules}
          initialEvents={((events as AuditEvent[] | null) ?? [])}
        />
      </div>
    </Shell>
  );
}
