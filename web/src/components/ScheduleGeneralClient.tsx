"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import {
  ScheduleEditorModal,
  type ClassOption,
  type RefOption,
  type TeacherOption,
  type TimeSlotInfo,
} from "@/components/ScheduleEditorModal";
import { PrintButton } from "@/components/PrintButton";

type GradeByClassResp = {
  ok: boolean;
  shift: string;
  school?: { name: string | null };
  editor?: {
    teachers: TeacherOption[];
    classes: ClassOption[];
    subjects: RefOption[];
    rooms: RefOption[];
  };
  timeSlots: {
    id: string;
    weekday: number;
    period_index: number | null;
    starts_at: string | null;
    ends_at: string | null;
  }[];
  classes: { id: string; header: { sala: string; levelStage: string; turma: string } }[];
  grid: Record<
    string,
    Record<
      string,
      {
        scheduleId?: string;
        timeSlotId: string;
        teacherId: string;
        classId: string;
        subjectId: string;
        roomId?: string | null;
        subject: string;
        teacher: string;
        room?: string | null;
        notes?: string | null;
        isTeacherAbsent?: boolean;
        replacementTeacherId?: string | null;
        replacementTeacherName?: string | null;
      }
    >
  >;
};

type HaResp = {
  ok: boolean;
  shift: string;
  items: {
    teacherId: string;
    teacherName: string;
    slots: { weekday: number; period_index: number | null; timeSlotId: string; notes: string | null; isTeacherAbsent?: boolean; replacementTeacherId?: string | null; replacementTeacherName?: string | null }[];
  }[];
};

type BuildResp = {
  ok: boolean;
  shift: string;
  overwrite: boolean;
  applied: number;
  skipped: number;
  conflicts?: {
    total: number;
    teacher: number;
    room: number;
    class: number;
    preview?: string[];
  };
  warnings?: string[];
  summary?: string;
  skippedAll?: boolean;
};

type StateResp = { ok: boolean; shift: string; hasGrade: boolean; aulaCount: number };

type GeneralResp = {
  ok: boolean;
  shift: string;
  timeSlots: { weekday: number; period_index: number | null; starts_at: string | null; ends_at: string | null }[];
  items: {
    id: string;
    teacherId: string;
    teacherName: string;
    weekday: number;
    weekdayLabel: string;
    period_index: number | null;
    starts_at: string | null;
    ends_at: string | null;
    activity_type: "AULA" | "HA" | string;
    className: string | null;
    subjectName: string | null;
    roomName?: string | null;
    notes: string | null;
    isTeacherAbsent?: boolean;
    replacementTeacherId?: string | null;
    replacementTeacherName?: string | null;
  }[];
};

const WEEKDAY = ["", "2ª FEIRA", "3ª FEIRA", "4ª FEIRA", "5ª FEIRA", "6ª FEIRA"];
const DAYS = [1, 2, 3, 4, 5];

function normShift(v: string | null | undefined) {
  const k = String(v || "").trim().toUpperCase();
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return "MANHA";
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

export function ScheduleGeneralClient(props: {
  initialShift?: string | null;
  initialClassId?: string | null;
}) {
  const [shift, setShift] = useState<string>(normShift(props.initialShift ?? "MANHA"));
  const [selectedClassId, setSelectedClassId] = useState<string>(props.initialClassId ?? "");
  const [filterClassId, setFilterClassId] = useState<string>(props.initialClassId ?? "");

  const [building, setBuilding] = useState(false);
  const [buildInfo, setBuildInfo] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildConflicts, setBuildConflicts] = useState<BuildResp["conflicts"] | null>(null);

  const [data, setData] = useState<GradeByClassResp | null>(null);
  const [ha, setHa] = useState<HaResp | null>(null);
  const [general, setGeneral] = useState<GeneralResp | null>(null);
  const [gradeState, setGradeState] = useState<StateResp | null>(null);
  const [loading, setLoading] = useState(false);

  const [nonce, setNonce] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    | null
    | {
        scheduleId?: string | null;
        lockClassId: string;
        slot: TimeSlotInfo;
        defaults: {
          activityType: "AULA" | "HA";
          teacherId: string;
          classId: string;
          subjectId: string;
          roomId: string;
          notes: string;
          isTeacherAbsent: boolean;
          replacementTeacherId: string;
        };
      }
  >(null);

  async function fetchState(targetShift: string) {
    const params = new URLSearchParams();
    params.set("shift", targetShift);

    const [gradeRes, haRes, generalRes, stateRes] = await Promise.all([
      fetch(`/api/grades/classes?${params.toString()}`).then((r) => r.json()),
      fetch(`/api/grades/ha?${params.toString()}`).then((r) => r.json()),
      fetch(`/api/grades/general?${params.toString()}`).then((r) => r.json()),
      fetch(`/api/ai/global-schedule-state?${params.toString()}`).then((r) => r.json()),
    ]);

    setData(gradeRes);
    setHa(haRes);
    setGeneral(generalRes);
    setGradeState(stateRes);
  }

  async function runBuild(targetShift: string) {
    return await runBuildWithOverwrite(targetShift, false);
  }

  async function runBuildWithOverwrite(targetShift: string, overwrite: boolean) {
    setBuilding(true);
    setBuildError(null);
    setBuildInfo(null);
    setBuildConflicts(null);
    try {
      const res = await fetch("/api/ai/build-global-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift: targetShift, overwrite }),
      });
      const json = (await res.json()) as any as BuildResp;
      if (!res.ok) {
        setBuildError((json as any)?.error || "Falha ao montar a grade.");
      } else {
        setBuildInfo(json?.summary || `Grade montada. Aplicadas: ${json.applied}. Ignoradas: ${json.skipped}.`);
        if (json?.conflicts && Number(json.conflicts.total ?? 0) > 0) setBuildConflicts(json.conflicts);
      }
      return json;
    } catch (e: any) {
      setBuildError(e?.message || "Erro de rede ao montar a grade.");
      return null;
    } finally {
      setBuilding(false);
    }
  }

  async function clearGrade(targetShift: string) {
    setBuilding(true);
    setBuildError(null);
    setBuildInfo(null);
    try {
      const res = await fetch("/api/ai/clear-global-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift: targetShift }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBuildError(json?.error || "Falha ao excluir a grade.");
      } else {
        setBuildInfo(`Grade excluída. Registros removidos: ${Number(json?.deleted ?? 0)}.`);
      }
    } catch (e: any) {
      setBuildError(e?.message || "Erro de rede ao excluir a grade.");
    } finally {
      setBuilding(false);
    }
  }

  // Ao entrar na tela (e ao trocar turno): monta apenas se ainda não existir grade.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Verifica se já existe grade; se não existir, monta.
      try {
        const st = (await fetch(`/api/ai/global-schedule-state?shift=${shift}`).then((r) => r.json())) as StateResp;
        if (!cancelled) setGradeState(st);
        if (!cancelled && st?.ok && !st.hasGrade) {
          await runBuildWithOverwrite(shift, false);
        }
      } catch {
        // se falhar a checagem, tenta carregar mesmo assim.
      }
      if (cancelled) return;
      await fetchState(shift);
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift, nonce]);

  const slotByKey = useMemo(() => {
    const m = new Map<string, TimeSlotInfo>();
    for (const ts of data?.timeSlots || []) {
      const p = ts.period_index;
      if (!p) continue;
      m.set(`${ts.weekday}-${p}`, {
        id: ts.id,
        weekday: ts.weekday,
        period_index: ts.period_index,
        starts_at: ts.starts_at,
        ends_at: ts.ends_at,
      });
    }
    return m;
  }, [data?.timeSlots]);

  const perDay = useMemo(() => {
    const map: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    (data?.timeSlots || []).forEach((s) => {
      if (!s.period_index) return;
      if (!map[s.weekday].includes(s.period_index)) map[s.weekday].push(s.period_index);
    });
    for (const d of DAYS) map[d].sort((a, b) => a - b);
    return map;
  }, [data?.timeSlots]);

  const visibleClasses = useMemo(() => {
    const all = data?.classes || [];
    if (!filterClassId) return all;
    return all.filter((c) => c.id === filterClassId);
  }, [data?.classes, filterClassId]);

  const haItems = useMemo(() => {
    const items = ha?.items || [];
    // Se estamos filtrando por turma, HA continua sendo relevante para conflitos (mas pode poluir a tela).
    // Mostramos sempre, mas em detalhes recolhíveis.
    return items;
  }, [ha?.items]);

  const haBySlot = useMemo(() => {
    const map: Record<
      string,
      {
        teacherName: string;
        notes: string | null;
        isTeacherAbsent: boolean;
        replacementTeacherName: string | null;
      }[]
    > = {};

    for (const t of haItems) {
      for (const s of t.slots || []) {
        const wd = Number(s.weekday);
        const p = Number(s.period_index ?? 0);
        if (!(wd >= 1 && wd <= 5)) continue;
        if (!p) continue;
        const k = `${wd}-${p}`;
        map[k] ||= [];
        map[k].push({ teacherName: t.teacherName, notes: s.notes ?? null, isTeacherAbsent: Boolean((s as any)?.isTeacherAbsent), replacementTeacherName: (s as any)?.replacementTeacherName ?? null });
      }
    }

    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => String(a.teacherName).localeCompare(String(b.teacherName)));
    }
    return map;
  }, [haItems]);

  const generalByTeacher = useMemo(() => {
    const items = general?.items || [];
    const map = new Map<string, { teacherId: string; teacherName: string; rows: typeof items }>();
    for (const it of items) {
      const key = it.teacherId;
      if (!map.has(key)) map.set(key, { teacherId: it.teacherId, teacherName: it.teacherName, rows: [] as any });
      map.get(key)!.rows.push(it);
    }
    // Ensure stable order by teacher name
    return Array.from(map.values()).sort((a, b) => String(a.teacherName).localeCompare(String(b.teacherName)));
  }, [general?.items]);

  function applyFilter() {
    setFilterClassId(selectedClassId);
    // Mantém URL "compartilhável" sem recarregar.
    const params = new URLSearchParams(window.location.search);
    params.set("shift", shift);
    if (selectedClassId) params.set("classId", selectedClassId);
    else params.delete("classId");
    const url = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="grid gap-4">
      {banner ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 shadow-sm dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200">
          {banner}
        </div>
      ) : null}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Turno</span>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/30"
            >
              <option value="MANHA">Manhã</option>
              <option value="TARDE">Tarde</option>
              <option value="NOITE">Noite</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Filtrar por turma</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-10 min-w-[260px] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/30"
            >
              <option value="">Todas as turmas</option>
              {(data?.classes || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.header.turma}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={applyFilter}
            className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Carregar
          </button>

          <button
            type="button"
            disabled={building}
            onClick={async () => {
              const ok = window.confirm(
                "Remontar grade vai limpar as AULAS deste turno e montar novamente a partir do cadastro dos professores. Deseja continuar?",
              );
              if (!ok) return;
              await runBuildWithOverwrite(shift, true);
              await fetchState(shift);
            }}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Montar grade
          </button>

          <button
            type="button"
            disabled={building}
            onClick={async () => {
              const ok = window.confirm(
                "Excluir grade vai remover todas as AULAS deste turno (mantém Hora Atividade). Deseja continuar?",
              );
              if (!ok) return;
              await clearGrade(shift);
              await fetchState(shift);
            }}
            className="btn btn-danger h-10 disabled:opacity-60"
          >
            Excluir grade
          </button>

          <PrintButton className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900">
            Imprimir
          </PrintButton>

          <a
            href="/schedule/manual"
            className="ml-auto h-10 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Edição manual
          </a>
        </div>

        <div className="mt-3 grid gap-2 text-sm">
          <div className="text-zinc-600 dark:text-zinc-400">Dica: clique em uma célula da grade para adicionar/editar uma aula.</div>
          {gradeState?.ok ? (
            <div className="text-zinc-600 dark:text-zinc-400">
              {gradeState.hasGrade
                ? `Grade encontrada neste turno (${gradeState.aulaCount} aula(s)). Não remonto automaticamente.`
                : "Nenhuma grade encontrada neste turno. Se existir cadastro de professores, vou montar automaticamente."}
            </div>
          ) : null}
          {building ? (
            <div className="text-zinc-600 dark:text-zinc-400">Montando/atualizando a grade…</div>
          ) : null}
          {buildError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {buildError}
            </div>
          ) : null}
          {buildInfo ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
              {buildInfo}
            </div>
          ) : null}

          {buildConflicts && buildConflicts.total > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <div className="font-semibold">Conflitos de horário detectados durante a montagem</div>
                  <div className="text-sm text-amber-800/90 dark:text-amber-200/90">
                    Total: {buildConflicts.total} • Professores: {buildConflicts.teacher} • Turmas: {buildConflicts.class} • Salas: {buildConflicts.room}
                  </div>
                  {Array.isArray(buildConflicts.preview) && buildConflicts.preview.length ? (
                    <ul className="mt-1 list-disc pl-5 text-sm">
                      {buildConflicts.preview.slice(0, 5).map((m, idx) => (
                        <li key={idx}>{m}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <a
                  href={`/schedule/conflicts?shift=${encodeURIComponent(shift)}`}
                  className="h-9 rounded-xl bg-amber-900 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
                >
                  Ver conflitos
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {data?.school?.name && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="font-semibold">{data?.school?.name ?? ""}</div>
        </div>
      )}

      {loading && <div className="text-sm text-zinc-600 dark:text-zinc-400">Carregando grade…</div>}

      {/* Visão geral por professor (inclui HA) */}
      {general?.ok && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="text-sm font-semibold">Visão geral por professor (Aulas + Hora Atividade)</div>
          <div className="mt-3 grid gap-3">
            {generalByTeacher.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">Nenhum registro encontrado para este turno.</div>
            ) : null}
            {generalByTeacher.map((t) => (
              <div key={t.teacherId} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-900">
                <div className="text-sm font-semibold">{t.teacherName}</div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900 w-32">Dia</th>
                        <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900 w-20">Período</th>
                        <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900 w-24">Tipo</th>
                        <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Turma</th>
                        <th className="border border-zinc-200 bg-zinc-100 p-2 text-left font-semibold dark:border-zinc-800 dark:bg-zinc-900">Disciplina</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((r) => {
                        const isHa = String(r.activity_type || "").toUpperCase() === "HA";
                        return (
                          <tr key={r.id}>
                            <td className="border border-zinc-200 p-2 dark:border-zinc-800">{r.weekdayLabel}</td>
                            <td className="border border-zinc-200 p-2 dark:border-zinc-800">{r.period_index ? `${r.period_index}º` : "—"}</td>
                            <td className="border border-zinc-200 p-2 dark:border-zinc-800">
                              {isHa ? "Hora Atividade" : "Aula"}
                            </td>
                            <td className="border border-zinc-200 p-2 dark:border-zinc-800">
                              {isHa ? "—" : r.className || "—"}
                            </td>
                            <td className="border border-zinc-200 p-2 dark:border-zinc-800">
                              {isHa ? "—" : r.subjectName || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.ok && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <table className="min-w-full w-max border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-30 border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 w-28"></th>
                {visibleClasses.map((c) => (
                  <th
                    key={c.id}
                    className="border border-zinc-200 bg-zinc-100 p-2 text-left align-bottom text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 min-w-[220px]"
                  >
                    <div className="text-sm font-bold">{c.header.sala}</div>
                    <div className="text-[11px] font-medium">{c.header.levelStage}</div>
                    <div className="text-sm font-semibold">{c.header.turma}</div>
                  </th>
                ))}

                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 w-56">
                  Hora Atividade
                </th>
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <Fragment key={`day-block-${d}`}>
                  <tr key={`day-${d}`}>
                    <td
                      colSpan={2 + (visibleClasses?.length || 0)}
                      className="border border-zinc-200 bg-zinc-50 p-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {WEEKDAY[d]}
                    </td>
                  </tr>
                  {perDay[d].map((p) => (
                    <tr key={`${d}-${p}`}>
                      <td className="sticky left-0 z-20 border border-zinc-200 p-2 text-center text-xs dark:border-zinc-800 w-28 bg-white dark:bg-zinc-950">
                        {p}º
                      </td>
                      {visibleClasses.map((c) => {
                        const key = `${d}-${p}`;
                        const cell = data.grid?.[key]?.[c.id];
                        const slot = slotByKey.get(key) || null;
                        return (
                          <td
                            key={c.id}
                            className="border border-zinc-200 p-2 align-top text-xs dark:border-zinc-800 h-16 min-w-[220px] cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                            onClick={() => {
                              if (!slot) return;
                              setBanner(null);
                              setEditing({
                                scheduleId: (cell as any)?.scheduleId ?? null,
                                lockClassId: c.id,
                                slot,
                                defaults: {
                                  activityType: "AULA",
                                  teacherId: String((cell as any)?.teacherId ?? ""),
                                  classId: c.id,
                                  subjectId: String((cell as any)?.subjectId ?? ""),
                                  roomId: String((cell as any)?.roomId ?? ""),
                                  notes: String((cell as any)?.notes ?? ""),
                                  isTeacherAbsent: Boolean((cell as any)?.isTeacherAbsent),
                                  replacementTeacherId: String((cell as any)?.replacementTeacherId ?? ""),
                                },
                              });
                            }}
                          >
                            {cell ? (
                              <div className="leading-tight">
                                <div className="font-semibold">{cell.subject}</div>
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
                                  {cell.teacher}
                                  {cell.room ? ` • ${cell.room}` : ""}
                                </div>
                                {(cell as any)?.isTeacherAbsent ? (
                                  <div className="mt-1 grid gap-0.5">
                                    <div className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">Falta</div>
                                    <div className="text-[10px] text-zinc-600 dark:text-zinc-300">
                                      {(cell as any)?.replacementTeacherName ? `Subst.: ${(cell as any).replacementTeacherName}` : "Sem substituto"}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                        );
                      })}

                      <td className="border border-zinc-200 p-2 align-top text-xs dark:border-zinc-800">
                        {(() => {
                          const list = haBySlot[`${d}-${p}`] || [];
                          if (list.length === 0) return null;
                          return (
                            <div className="grid gap-1 leading-tight">
                              {list.map((it, idx) => (
                                <div key={`${it.teacherName}-${idx}`} className="rounded-lg bg-zinc-50 px-2 py-1 dark:bg-zinc-900">
                                  <div className="text-[11px] font-semibold">HA</div>
                                  <div className="text-[10px] text-zinc-600 dark:text-zinc-300">{it.teacherName}</div>
                                  {it.notes ? (
                                    <div className="text-[10px] text-zinc-600 dark:text-zinc-300">{it.notes}</div>
                                  ) : null}
                                  {it.isTeacherAbsent ? (
                                    <div className="text-[10px] text-amber-700 dark:text-amber-200">
                                      {it.replacementTeacherName ? `Falta • Subst.: ${it.replacementTeacherName}` : "Falta • sem substituto"}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {editing && data?.editor ? (
        <ScheduleEditorModal
          open={Boolean(editing)}
          scheduleId={editing.scheduleId ?? undefined}
          slot={editing.slot}
          teachers={data.editor.teachers}
          classes={data.editor.classes}
          subjects={data.editor.subjects}
          rooms={data.editor.rooms}
          lockClassId={editing.lockClassId}
          defaults={editing.defaults}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            setBanner(null);
            const r = await apiJson<any>("/api/weekly-grade/set", {
              method: "POST",
              body: JSON.stringify({ shift, ...payload }),
            });
            if (!r.ok) {
              setBanner(r.error);
              return;
            }
            setEditing(null);
            setNonce((n) => n + 1);
          }}
          onDelete={async (sid) => {
            setBanner(null);
            const r = await apiJson<any>("/api/weekly-grade/delete", {
              method: "POST",
              body: JSON.stringify({ shift, scheduleId: sid }),
            });
            if (!r.ok) {
              setBanner(r.error);
              return;
            }
            setEditing(null);
            setNonce((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}
