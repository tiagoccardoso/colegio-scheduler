"use client";

import { useMemo, useState } from "react";

type TeacherRow = { id: string; name: string };
type SubjectRow = { id: string; name: string };
type RoomRow = { id: string; name: string };
type TimeSlotRow = { id: string; weekday: number; starts_at: string; ends_at: string; shift?: string | null; period_index?: number | null };

const WEEKDAY_LABEL: Record<number, string> = {
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
};

function slotLabel(ts: TimeSlotRow) {
  const w = WEEKDAY_LABEL?.[ts.weekday] ?? "Dia";
  const p = ts.period_index ? `${ts.period_index}º ` : "";
  const sh = ts.shift ? ` (${ts.shift})` : "";
  return `${w} ${p}${ts.starts_at}–${ts.ends_at}${sh}`;
}

export function ScheduleAssistant(props: {
  enabled: boolean;
  classId: string;
  teachers: TeacherRow[];
  subjects: SubjectRow[];
  rooms: RoomRow[];
  timeSlots: TimeSlotRow[];
  initial?: { timeSlotId?: string; teacherId?: string; subjectId?: string; roomId?: string | null };
}) {
  const { enabled, classId, teachers, subjects, rooms, timeSlots, initial } = props;

  const sortedSlots = useMemo(() => {
    return [...timeSlots].sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.starts_at.localeCompare(b.starts_at);
    });
  }, [timeSlots]);

  const [timeSlotId, setTimeSlotId] = useState(initial?.timeSlotId ?? "");
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? "");
  const [teacherId, setTeacherId] = useState(initial?.teacherId ?? "");
  const [roomId, setRoomId] = useState(initial?.roomId ?? "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          timeSlotId,
          subjectId: subjectId || undefined,
          teacherId: teacherId || undefined,
          roomId: roomId ? roomId : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Erro ao consultar a IA.");
        return;
      }

      setResult(json?.result ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold">Assistente IA</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Para habilitar, defina <code className="px-1">AI_SCHEDULER_ENABLED=true</code> e
          <code className="px-1">OPENAI_API_KEY</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Assistente IA</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Sugestões para evitar conflitos e otimizar decisões de alocação.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading || !timeSlotId}
          className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Analisando..." : "Sugerir"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Horário</span>
          <select
            value={timeSlotId}
            onChange={(e) => setTimeSlotId(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">Selecione...</option>
            {sortedSlots.map((ts) => (
              <option key={ts.id} value={ts.id}>
                {slotLabel(ts)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">Disciplina</span>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">(opcional)</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">Professor</span>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">(opcional)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">Sala</span>
          <select
            value={roomId ?? ""}
            onChange={(e) => setRoomId(e.target.value)}
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">(opcional)</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 grid gap-3">
          {result.summary ? <p className="text-sm text-zinc-700 dark:text-zinc-200">{result.summary}</p> : null}

          <div className="grid gap-2">
            {(result.suggestions ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Nenhuma sugestão retornada.</p>
            ) : (
              (result.suggestions ?? []).map((s: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-900 dark:bg-zinc-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{s.title ?? `Sugestão ${idx + 1}`}</p>
                    {s.type ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                        {s.type}
                      </span>
                    ) : null}
                  </div>
                  {s.reason ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{s.reason}</p> : null}
                  {s.proposed ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-50 p-2 text-xs text-zinc-700 dark:bg-black/40 dark:text-zinc-200">
                      {JSON.stringify(s.proposed, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {(result.warnings ?? []).length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <ul className="list-disc pl-5">
                {(result.warnings ?? []).map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
