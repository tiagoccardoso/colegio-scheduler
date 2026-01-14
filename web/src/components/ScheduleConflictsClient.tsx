"use client";

import { useEffect, useMemo, useState } from "react";

type ConflictKind = "teacher" | "room" | "class" | "slot";

type ConflictRow = {
  id: string;
  kind: ConflictKind;
  shift: string;
  weekday: number;
  period_index: number;
  slot: { id: string; label: string; starts_at: string | null; ends_at: string | null } | null;
  message: string;
  requested: {
    teacherId: string | null;
    teacherName: string;
    classId: string | null;
    className: string | null;
    subjectName: string | null;
    roomName: string | null;
    ruleIndex?: number | null;
  };
  blockedBy: {
    source: "existing" | "planned";
    activityType: "AULA" | "HA";
    teacherId: string | null;
    teacherName: string;
    classId: string | null;
    className: string | null;
    subjectName: string | null;
    roomName: string | null;
  } | null;
};

type ConflictsResp = {
  ok: boolean;
  shift: string;
  counts: { total: number; teacher: number; room: number; class: number; slot: number };
  conflicts: ConflictRow[];
  error?: string;
};

function normShift(v: string | null | undefined) {
  const k = String(v || "").trim().toUpperCase();
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return "MANHA";
}

function kindLabel(kind: ConflictKind) {
  if (kind === "teacher") return "Professor";
  if (kind === "room") return "Sala";
  if (kind === "class") return "Turma";
  return "Horário";
}

export function ScheduleConflictsClient({ initialShift }: { initialShift?: string | null }) {
  const [shift, setShift] = useState(normShift(initialShift ?? "MANHA"));
  const [kind, setKind] = useState<"all" | ConflictKind>("all");
  const [query, setQuery] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConflictsResp | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("shift", shift);
        const res = await fetch(`/api/ai/global-schedule-conflicts?${params.toString()}`);
        const json = (await res.json()) as ConflictsResp;
        if (cancelled) return;
        if (!res.ok) {
          setError((json as any)?.error || "Falha ao carregar conflitos.");
          setData(null);
          return;
        }
        setData(json);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Erro de rede ao carregar conflitos.");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shift]);

  const rows = useMemo(() => {
    const base = (data?.conflicts ?? []).slice();
    const q = query.trim().toLowerCase();
    return base
      .filter((c) => (kind === "all" ? true : c.kind === kind))
      .filter((c) => {
        if (!q) return true;
        const hay = [
          c.message,
          c.requested.teacherName,
          c.requested.className,
          c.requested.subjectName,
          c.requested.roomName,
          c.blockedBy?.teacherName,
          c.blockedBy?.className,
          c.blockedBy?.subjectName,
          c.blockedBy?.roomName,
          c.slot?.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [data, kind, query]);

  const counts = data?.counts ?? { total: 0, teacher: 0, room: 0, class: 0, slot: 0 };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={`/schedule?shift=${encodeURIComponent(shift)}`}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          ← Voltar para Montar grade
        </a>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold">Turno</label>
          <select
            value={shift}
            onChange={(e) => setShift(normShift(e.target.value))}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-900 dark:bg-zinc-950"
          >
            <option value="MANHA">Manhã</option>
            <option value="TARDE">Tarde</option>
            <option value="NOITE">Noite</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-sm font-semibold">Resumo</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Total: {counts.total} • Professores: {counts.teacher} • Turmas: {counts.class} • Salas: {counts.room}
              {counts.slot ? ` • Horários ausentes: ${counts.slot}` : ""}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Os conflitos são simulados na mesma ordem usada ao montar a grade (professores em ordem alfabética).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-900 dark:bg-zinc-950"
            >
              <option value="all">Todos</option>
              <option value="teacher">Professor</option>
              <option value="class">Turma</option>
              <option value="room">Sala</option>
              <option value="slot">Horário</option>
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-10 w-[260px] max-w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-900 dark:bg-zinc-950 dark:focus:border-zinc-700"
            />
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-zinc-600 dark:text-zinc-400">Carregando conflitos…</div> : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Tipo</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Horário</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Tentativa</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Bloqueado por</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                      Nenhum conflito encontrado para este filtro.
                    </td>
                  </tr>
                ) : null}

                {rows.map((c) => {
                  const attempt = [
                    c.requested.teacherName,
                    c.requested.className ? `Turma ${c.requested.className}` : null,
                    c.requested.subjectName,
                    c.requested.roomName,
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  const blocked = c.blockedBy
                    ? [
                        c.blockedBy.activityType === "HA" ? "HA" : "Aula",
                        c.blockedBy.teacherName,
                        c.blockedBy.className ? `Turma ${c.blockedBy.className}` : null,
                        c.blockedBy.subjectName,
                        c.blockedBy.roomName,
                        c.blockedBy.source === "planned" ? "(regra anterior)" : "(já cadastrado)",
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    : "—";

                  const focusTeacherId = c.requested.teacherId;
                  const focusBlockedTeacherId = c.blockedBy?.teacherId;

                  return (
                    <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-900">
                      <td className="px-4 py-3 align-top text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {kindLabel(c.kind)}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-zinc-800 dark:text-zinc-200">
                        {c.slot?.label ?? "(horário ausente)"}
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{c.shift}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{attempt}</div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{c.message}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-zinc-800 dark:text-zinc-200">{blocked}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          {focusTeacherId ? (
                            <a
                              href={`/teachers?focus=${encodeURIComponent(focusTeacherId)}#teacher-${encodeURIComponent(focusTeacherId)}`}
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                            >
                              Editar professor
                            </a>
                          ) : null}

                          {focusBlockedTeacherId && focusBlockedTeacherId !== focusTeacherId ? (
                            <a
                              href={`/teachers?focus=${encodeURIComponent(focusBlockedTeacherId)}#teacher-${encodeURIComponent(focusBlockedTeacherId)}`}
                              className="h-9 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                            >
                              Ver professor bloqueador
                            </a>
                          ) : null}

                          {c.requested.classId ? (
                            <a
                              href={`/schedule/manual?classId=${encodeURIComponent(c.requested.classId)}`}
                              className="h-9 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                            >
                              Ajustar turma
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
