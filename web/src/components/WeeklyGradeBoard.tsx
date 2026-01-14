"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";

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

type ActivityType = "AULA" | "HA";

type ScheduleRow = {
  id: string;
  time_slot_id: string;
  teacher_id: string;
  activity_type: ActivityType | string | null;
  class_id: string | null;
  subject_id: string | null;
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

const WEEKDAYS: { key: number; label: string }[] = [
  { key: 1, label: "Seg" },
  { key: 2, label: "Ter" },
  { key: 3, label: "Qua" },
  { key: 4, label: "Qui" },
  { key: 5, label: "Sex" },
];

function fmtEvent(action: string) {
  switch (action) {
    case "set":
      return "Editar";
    case "move":
      return "Mover";
    case "delete":
      return "Excluir";
    default:
      return action;
  }
}

function isoToShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { ok: false, error: json?.error || res.statusText };
    return { ok: true, data: json as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erro de rede" };
  }
}

function normActivityType(v: any): ActivityType {
  const t = String(v || "AULA").trim().toUpperCase();
  return t === "HA" ? "HA" : "AULA";
}

export function WeeklyGradeBoard(props: {
  shift: string;
  shiftOptions: { key: string; label: string }[];
  teachers: TeacherRow[];
  classes: RefRow[];
  subjects: RefRow[];
  rooms: RefRow[];
  timeSlots: TimeSlotRow[];
  initialSchedules: ScheduleRow[];
  initialEvents: AuditEvent[];
}) {
  const { shift, shiftOptions, teachers, classes, subjects, rooms, timeSlots } = props;

  const [schedules, setSchedules] = useState<ScheduleRow[]>(props.initialSchedules ?? []);
  const [events, setEvents] = useState<AuditEvent[]>(props.initialEvents ?? []);
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [editing, setEditing] = useState<{
    open: boolean;
    teacherId: string;
    timeSlotId: string;
  } | null>(null);

  const byTeacherDayPeriod = useMemo(() => {
    const m = new Map<string, ScheduleRow>();
    for (const s of schedules) {
      const wd = s.time_slot?.weekday;
      const p = s.time_slot?.period_index;
      if (!wd || !p) continue;
      m.set(`${s.teacher_id}|${wd}|${p}`, s);
    }
    return m;
  }, [schedules]);

  const timeSlotByDayPeriod = useMemo(() => {
    const m = new Map<string, TimeSlotRow>();
    for (const ts of timeSlots) {
      const p = ts.period_index;
      if (!p) continue;
      m.set(`${ts.weekday}|${p}`, ts);
    }
    return m;
  }, [timeSlots]);

  const maxPeriods = useMemo(() => {
    let mx = 0;
    for (const ts of timeSlots) mx = Math.max(mx, Number(ts.period_index ?? 0));
    return mx > 0 ? mx : 6;
  }, [timeSlots]);

  const classOptions = useMemo(() => {
    const arr = [...classes].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return arr;
  }, [classes]);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name ?? ""])), [subjects]);

  async function refresh() {
    const r = await apiJson<{ schedules: ScheduleRow[]; events: AuditEvent[] }>(
      `/api/weekly-grade/state?shift=${encodeURIComponent(shift)}`,
    );
    if (!r.ok) {
      setBanner({ kind: "error", text: r.error });
      return;
    }
    setSchedules(r.data.schedules ?? []);
    setEvents(r.data.events ?? []);
  }

  function goShift(newShift: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("shift", newShift);
    window.location.assign(`${window.location.pathname}?${params.toString()}`);
  }

  function cellKey(teacherId: string, weekday: number, period: number) {
    return `${teacherId}|${weekday}|${period}`;
  }

  function scheduleFor(teacherId: string, weekday: number, period: number) {
    return byTeacherDayPeriod.get(cellKey(teacherId, weekday, period)) || null;
  }

  function timeSlotFor(weekday: number, period: number) {
    return timeSlotByDayPeriod.get(`${weekday}|${period}`) || null;
  }

  async function onDrop(e: DragEvent, targetTeacherId: string, weekday: number, period: number) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
    let scheduleId = "";
    try {
      const parsed = JSON.parse(raw);
      scheduleId = String(parsed?.scheduleId || "");
    } catch {
      scheduleId = String(raw || "");
    }
    if (!scheduleId) return;

    const targetSlot = timeSlotFor(weekday, period);
    if (!targetSlot?.id) {
      setBanner({ kind: "error", text: "Slot inválido (configure os horários)." });
      return;
    }

    const already = scheduleFor(targetTeacherId, weekday, period);
    if (already) {
      setBanner({ kind: "error", text: "Destino já ocupado. Remova ou mova o item existente primeiro." });
      return;
    }

    const r = await apiJson<{ schedules: ScheduleRow[]; events: AuditEvent[] }>("/api/weekly-grade/move", {
      method: "POST",
      body: JSON.stringify({ scheduleId, targetTimeSlotId: targetSlot.id, targetTeacherId, shift }),
    });

    if (!r.ok) {
      setBanner({ kind: "error", text: r.error });
      return;
    }
    setBanner({ kind: "info", text: "Movido." });
    setSchedules(r.data.schedules ?? []);
    setEvents(r.data.events ?? []);
  }

  function openEditor(teacherId: string, timeSlotId: string) {
    setEditing({ open: true, teacherId, timeSlotId });
  }

  async function saveEditor(values: {
    scheduleId?: string;
    teacherId: string;
    timeSlotId: string;
    activityType: ActivityType;
    classId?: string;
    subjectId?: string;
    roomId: string | null;
    notes: string | null;
  }) {
    const r = await apiJson<{ schedules: ScheduleRow[]; events: AuditEvent[] }>("/api/weekly-grade/set", {
      method: "POST",
      body: JSON.stringify({ ...values, shift }),
    });

    if (!r.ok) {
      setBanner({ kind: "error", text: r.error });
      return;
    }
    setBanner({ kind: "info", text: "Salvo." });
    setEditing(null);
    setSchedules(r.data.schedules ?? []);
    setEvents(r.data.events ?? []);
  }

  async function deleteSchedule(scheduleId: string) {
    const r = await apiJson<{ schedules: ScheduleRow[]; events: AuditEvent[] }>("/api/weekly-grade/delete", {
      method: "POST",
      body: JSON.stringify({ scheduleId, shift }),
    });
    if (!r.ok) {
      setBanner({ kind: "error", text: r.error });
      return;
    }
    setBanner({ kind: "info", text: "Excluído." });
    setEditing(null);
    setSchedules(r.data.schedules ?? []);
    setEvents(r.data.events ?? []);
  }

  async function undo(eventId: string) {
    const r = await apiJson<{ schedules: ScheduleRow[]; events: AuditEvent[] }>("/api/weekly-grade/undo", {
      method: "POST",
      body: JSON.stringify({ eventId, shift }),
    });
    if (!r.ok) {
      setBanner({ kind: "error", text: r.error });
      return;
    }
    setBanner({ kind: "info", text: "Undo aplicado." });
    setSchedules(r.data.schedules ?? []);
    setEvents(r.data.events ?? []);
  }

  async function redo(eventId: string) {
    const r = await apiJson<{ schedules: ScheduleRow[]; events: AuditEvent[] }>("/api/weekly-grade/redo", {
      method: "POST",
      body: JSON.stringify({ eventId, shift }),
    });
    if (!r.ok) {
      setBanner({ kind: "error", text: r.error });
      return;
    }
    setBanner({ kind: "info", text: "Redo aplicado." });
    setSchedules(r.data.schedules ?? []);
    setEvents(r.data.events ?? []);
  }

  const editorModel = useMemo(() => {
    if (!editing) return null;
    const { teacherId, timeSlotId } = editing;
    const teacher = teachers.find((t) => t.id === teacherId) || null;
    const slot = timeSlots.find((t) => t.id === timeSlotId) || null;
    const schedule = schedules.find((s) => s.teacher_id === teacherId && s.time_slot_id === timeSlotId) || null;

    const act = normActivityType(schedule?.activity_type);
    return {
      teacher,
      slot,
      schedule,
      defaults: {
        activityType: act as ActivityType,
        classId: act === "AULA" ? (schedule?.class_id || "") : "",
        subjectId: act === "AULA" ? (schedule?.subject_id || teacher?.subject_id || "") : "",
        roomId: act === "AULA" ? (schedule?.room_id ?? teacher?.default_room_id ?? "") : "",
        notes: schedule?.notes || "",
      },
    };
  }, [editing, schedules, teachers, timeSlots]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Turno</span>
          <select
            value={shift}
            onChange={(e) => goShift(e.target.value)}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          >
            {shiftOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Atualizar
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Imprimir
          </button>
        </div>
      </div>

      <div className="hidden print:block">
        <div className="text-lg font-semibold">Grade semanal</div>
        <div className="text-sm text-zinc-600">
          Turno: {shiftOptions.find((s) => s.key === shift)?.label || shift} • Gerado em: {new Date().toLocaleString()}
        </div>
      </div>

      {banner ? (
        <div
          className={
            "print:hidden rounded-xl border px-4 py-3 text-sm " +
            (banner.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200"
              : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200")
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr,340px]">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                    Professor
                  </th>
                  {WEEKDAYS.map((d) => (
                    <th
                      key={d.key}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="sticky left-0 z-10 w-[220px] bg-white px-4 py-3 align-top dark:bg-zinc-950">
                      <div className="grid gap-1">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">{t.name || "(sem nome)"}</span>
                        <span className="text-xs text-zinc-500">{t.subject_id ? subjectById.get(t.subject_id) || "" : ""}</span>
                      </div>
                    </td>

                    {WEEKDAYS.map((d) => (
                      <td key={d.key} className="px-3 py-3 align-top">
                        <div className="grid gap-2">
                          {Array.from({ length: maxPeriods }, (_, i) => i + 1).map((p) => {
                            const ts = timeSlotFor(d.key, p);
                            const s = scheduleFor(t.id, d.key, p);
                            const empty = !s;
                            const canDrop = Boolean(ts?.id);
                            const act = normActivityType(s?.activity_type);

                            return (
                              <div
                                key={p}
                                onDragOver={(e) => {
                                  if (canDrop) e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  if (canDrop) void onDrop(e, t.id, d.key, p);
                                }}
                                className={
                                  "rounded-xl border px-3 py-2 text-xs transition " +
                                  (empty
                                    ? "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-900"
                                    : "border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900")
                                }
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (ts?.id) openEditor(t.id, ts.id);
                                      else setBanner({ kind: "error", text: "Slot não configurado em Horários." });
                                    }}
                                    className="text-left grow"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold">
                                        {p}º {ts?.starts_at && ts?.ends_at ? `${ts.starts_at}–${ts.ends_at}` : ""}
                                      </span>
                                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                        {empty ? "vazio" : act === "HA" ? "HA" : ""}
                                      </span>
                                    </div>

                                    {s ? (
                                      act === "HA" ? (
                                        <div className="mt-1 grid gap-1">
                                          <div className="text-xs font-semibold">Hora Atividade</div>
                                          {s.notes ? (
                                            <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{s.notes}</div>
                                          ) : (
                                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">(sem observações)</div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="mt-1 grid gap-1">
                                          <div className="text-xs font-semibold">
                                            {s.class?.name || "Turma"}
                                            {s.subject?.name ? ` — ${s.subject.name}` : ""}
                                          </div>
                                          <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
                                            {s.room?.name ? `Sala ${s.room.name}` : ""}
                                            {s.notes ? (s.room?.name ? ` · ${s.notes}` : s.notes) : ""}
                                          </div>
                                        </div>
                                      )
                                    ) : (
                                      <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Clique para adicionar</div>
                                    )}
                                  </button>

                                  {s ? (
                                    <div
                                      draggable
                                      onDragStart={(e) => {
                                        e.dataTransfer.setData(
                                          "application/json",
                                          JSON.stringify({ scheduleId: s.id }),
                                        );
                                        e.dataTransfer.effectAllowed = "move";
                                      }}
                                      title="Arrastar"
                                      className="print:hidden cursor-grab select-none rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-50 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                                    >
                                      ⠿
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}

                {teachers.length === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={6} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                      Nenhum professor encontrado para este turno.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Histórico</h2>
          </div>
          <div className="mt-3 grid gap-2">
            {events.map((ev) => {
              const undone = Boolean(ev.undone_at);
              return (
                <div key={ev.id} className="rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <div className="font-semibold">
                        {fmtEvent(ev.action)}
                        {undone ? " (desfeito)" : ""}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{isoToShort(ev.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {undone ? (
                        <button
                          type="button"
                          onClick={() => void redo(ev.id)}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                        >
                          Redo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void undo(ev.id)}
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {events.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Sem alterações recentes.</div>
            ) : null}
          </div>
        </div>
      </div>

      {editorModel?.teacher && editorModel.slot ? (
        <EditorModal
          open={Boolean(editing?.open)}
          teacher={editorModel.teacher}
          slot={editorModel.slot}
          schedule={editorModel.schedule}
          classOptions={classOptions}
          subjects={subjects}
          rooms={rooms}
          defaults={editorModel.defaults}
          onClose={() => setEditing(null)}
          onSave={(v) => void saveEditor(v)}
          onDelete={(sid) => void deleteSchedule(sid)}
        />
      ) : null}

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          table, th, td { border: 1px solid #333 !important; }
          .sticky { position: static !important; }
          button, input, select, textarea { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

function EditorModal(props: {
  open: boolean;
  teacher: TeacherRow;
  slot: TimeSlotRow;
  schedule: ScheduleRow | null;
  classOptions: RefRow[];
  subjects: RefRow[];
  rooms: RefRow[];
  defaults: { activityType: ActivityType; classId: string; subjectId: string; roomId: string; notes: string };
  onClose: () => void;
  onSave: (args: {
    scheduleId?: string;
    teacherId: string;
    timeSlotId: string;
    activityType: ActivityType;
    classId?: string;
    subjectId?: string;
    roomId: string | null;
    notes: string | null;
  }) => void;
  onDelete: (scheduleId: string) => void;
}) {
  const { open, teacher, slot, schedule, classOptions, subjects, rooms, defaults, onClose, onSave, onDelete } = props;

  const [activityType, setActivityType] = useState<ActivityType>(defaults.activityType);
  const [classId, setClassId] = useState(defaults.classId);
  const [subjectId, setSubjectId] = useState(defaults.subjectId);
  const [roomId, setRoomId] = useState(defaults.roomId);
  const [notes, setNotes] = useState(defaults.notes);

  useEffect(() => {
    setActivityType(defaults.activityType);
    setClassId(defaults.classId);
    setSubjectId(defaults.subjectId);
    setRoomId(defaults.roomId);
    setNotes(defaults.notes);
  }, [defaults.activityType, defaults.classId, defaults.subjectId, defaults.roomId, defaults.notes, open]);

  if (!open) return null;

  const isHa = activityType === "HA";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center print:hidden">
      <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <h3 className="text-base font-semibold">Editar slot</h3>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {teacher.name || "Professor"} · {WEEKDAYS.find((w) => w.key === slot.weekday)?.label || slot.weekday} · {slot.period_index}º ({slot.starts_at}–{slot.ends_at})
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Tipo</span>
            <select
              value={activityType}
              onChange={(e) => {
                const t = normActivityType(e.target.value);
                setActivityType(t);
                if (t === "HA") {
                  setClassId("");
                  setSubjectId("");
                  setRoomId("");
                }
              }}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            >
              <option value="AULA">Aula</option>
              <option value="HA">Hora Atividade (HA)</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Turma</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={isHa}
              className={
                "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                (isHa
                  ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
              }
            >
              <option value="">Selecione...</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.shift ? `(${c.shift})` : ""}
                </option>
              ))}
            </select>
            {isHa ? (
              <span className="text-xs text-zinc-500">HA não utiliza turma/disciplina.</span>
            ) : null}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Disciplina</span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={isHa}
                className={
                  "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                  (isHa
                    ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
                }
              >
                <option value="">—</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Sala</span>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={isHa}
                className={
                  "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                  (isHa
                    ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
                }
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Observações</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (activityType === "AULA") {
                  if (!classId) return;
                  if (!subjectId) return;
                }
                onSave({
                  scheduleId: schedule?.id,
                  teacherId: teacher.id,
                  timeSlotId: slot.id,
                  activityType,
                  classId: activityType === "AULA" ? classId : undefined,
                  subjectId: activityType === "AULA" ? subjectId : undefined,
                  roomId: activityType === "AULA" && roomId ? roomId : null,
                  notes: notes ? notes : null,
                });
              }}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Salvar
            </button>

            {schedule ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Excluir este item da grade?")) onDelete(schedule.id);
                }}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Excluir
              </button>
            ) : null}
          </div>

          {activityType === "AULA" && (!classId || !subjectId) ? (
            <div className="text-xs text-zinc-500">Para salvar Aula, selecione Turma e Disciplina.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
