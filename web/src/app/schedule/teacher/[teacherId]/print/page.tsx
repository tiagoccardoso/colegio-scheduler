import { requireStaff } from "@/lib/require-staff";
import { PrintButton } from "@/components/PrintButton";

type TimeSlotRow = { id: string; weekday: number; starts_at: string; ends_at: string };

type ScheduleRow = {
  id: string;
  time_slot_id: string;
  subject_id: string;
  teacher_id: string;
  room_id: string | null;
  class_id: string;
  subject: { name: string } | null;
  room: { name: string } | null;
  class: { name: string } | null;
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

export default async function Page({ params }: { params: { teacherId: string } }) {
  const { supabase } = await requireStaff();

  const teacherId = params.teacherId;

  const { data: teacher } = await supabase.from("teachers").select("id, name").eq("id", teacherId).maybeSingle();

  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("id, weekday, starts_at, ends_at")
    .in("weekday", WEEKDAYS.map((w) => w.key))
    .order("weekday", { ascending: true })
    .order("starts_at", { ascending: true });

  const periods = new Map<string, { starts_at: string; ends_at: string }>();
  const slotByDayAndPeriod = new Map<string, TimeSlotRow>();

  ((timeSlots as TimeSlotRow[] | null) ?? []).forEach((ts) => {
    periods.set(periodKey(ts), { starts_at: ts.starts_at, ends_at: ts.ends_at });
    slotByDayAndPeriod.set(`${ts.weekday}|${periodKey(ts)}`, ts);
  });

  const periodList = Array.from(periods.entries())
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const timeSlotIds = ((timeSlots as TimeSlotRow[] | null) ?? []).map((t) => t.id);

  let schedules: ScheduleRow[] = [];
  if (timeSlotIds.length > 0) {
    const { data: sched } = await supabase
      .from("schedules")
      .select(
        "id, time_slot_id, subject_id, teacher_id, room_id, class_id, subject:subjects(name), room:rooms(name), class:classes(name)",
      )
      .eq("teacher_id", teacherId)
      .in("time_slot_id", timeSlotIds);

    schedules = (sched as any) ?? [];
  }

  const bySlot = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    if (!bySlot.has(s.time_slot_id)) bySlot.set(s.time_slot_id, []);
    bySlot.get(s.time_slot_id)!.push(s);
  }

  const title = `Grade do Professor${teacher?.name ? ` — ${teacher.name}` : ""}`;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <a
            href={`/schedule?teacherId=${encodeURIComponent(teacherId)}`}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            ← Voltar
          </a>

          <PrintButton />
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Semana (Seg–Sex) · Horários cadastrados
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Horário</th>
                  {WEEKDAYS.map((w) => (
                    <th
                      key={w.key}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {w.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodList.map((p) => (
                  <tr key={p.key} className="border-t border-zinc-100">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {p.starts_at}–{p.ends_at}
                    </td>

                    {WEEKDAYS.map((w) => {
                      const ts = slotByDayAndPeriod.get(`${w.key}|${p.key}`);
                      if (!ts)
                        return (
                          <td key={w.key} className="px-4 py-3 text-sm text-zinc-500">
                            —
                          </td>
                        );

                      const items = bySlot.get(ts.id) ?? [];
                      const conflict = items.length > 1;

                      return (
                        <td key={w.key} className="px-4 py-3 align-top">
                          <div
                            className={
                              "rounded-2xl border p-3 " +
                              (conflict ? "border-red-300 bg-red-50" : "border-zinc-200 bg-zinc-50")
                            }
                          >
                            {items.length === 0 ? (
                              <div className="text-sm text-zinc-500">—</div>
                            ) : (
                              <div className="grid gap-2">
                                {conflict ? (
                                  <div className="text-xs font-semibold text-red-700">
                                    Conflito: mais de uma aula no mesmo horário
                                  </div>
                                ) : null}
                                {items.map((it) => (
                                  <div key={it.id} className="grid gap-0.5">
                                    <div className="text-sm font-semibold">{it.subject?.name ?? "—"}</div>
                                    <div className="text-xs text-zinc-600">
                                      {it.class?.name ?? "Turma"}
                                      {it.room?.name ? ` · ${it.room.name}` : ""}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {periodList.length === 0 ? (
                  <tr className="border-t border-zinc-100">
                    <td colSpan={6} className="px-4 py-6 text-sm text-zinc-600">
                      Nenhum horário cadastrado. Vá em <strong>Horários</strong> e cadastre primeiro.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-xs text-zinc-500">
          Dica: use a função de impressão do navegador para salvar como PDF.
        </div>
      </div>
    </div>
  );
}
